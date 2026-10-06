// scripts/check-meta-history.mjs
//
//   npm run check:meta-history
//
// The owner's report of 2026-10-03, executed rather than read:
//
//   "the leads doesn't seem to fetch all the leads from facebook only the new
//    ones … same thing for the messages in fb and instagram … also images and
//    video were not probably fetched" — and "remove the penalty if they are
//   sourced from somewhere else", and "validate FB leads with messages to not
//   create a copy … determine if a client is a lead, if it is a converted
//   client".
//
// Sections:
//   1. Meta's error payloads and the field fallback (lib/meta/client.js)
//   2. Attachments: the named subfields, the 25 MB Messenger ceiling, the
//      Instagram reel, and the re-delivery merge that keeps a durable copy
//      and revives an expired link
//   3. The identity matcher against hostile people
//   4. The message reviewer's verdict, a lying model, and redaction
//   5. The conversation history walk, end to end against an in-memory Graph
//      and the db stub: resolved history, no unread storm, idempotent
//      re-runs, rate limits, resumable cursor, auth refusal
//   6. The lead-form history walk: every page, silent history, live leads
//      announced, fold-in instead of a duplicate, client tie, undo
//   7. The live poll reads every page and holds its cursor when it cannot
//   8. Source-level guards: nothing wakes for history; no ads_management
//
// Run through db-stub-loader so lib/db is the scriptable stand-in.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyMetaError,
  isUnknownFieldError,
  isTooMuchDataError,
  nextConversationCursor,
  conversationFields,
  ATTACHMENT_SUBFIELDS,
  META_PAGES_SCOPE,
  META_LEADS_SCOPE,
  META_MESSAGING_SCOPE,
  META_OAUTH_SCOPE,
} from "../lib/meta/client.js";
import { graphAttachmentsToStored, graphConversationToEvents } from "../lib/messaging/pageImport.js";
import { parseMessagingEnvelope } from "../lib/messaging/envelope.js";
import { mergeAttachmentsOnRedelivery, normaliseAttachment, hasFetchableMedia, MEDIA_FETCH_MAX_ATTEMPTS } from "../lib/messaging/attachments.js";
import { maxBytesFor, MESSENGER_MAX_BYTES, rehostAttachment } from "../lib/messaging/mediaFetch.js";
import { matchLeadIdentity, namesDisagree, planFoldIn, leadAddress } from "../lib/leads/identityMatch.js";
import { threadContacts, undoIdentityLink } from "../lib/leads/identityLinks.js";
import { reviewVerdict, verdictMakesLead, publicReview, reviewForLead, conversionDocuments } from "../lib/leads/messageReview.js";
import { buildTranscript, verifyExtraction, extractionSchema, NOT_LEAD_REASON_ENUM } from "../lib/ai/conversationLeadExtract.js";
import { assertStrictSchema } from "../lib/ai/jsonSchema.js";
import {
  ensureBackfills,
  continueBackfills,
  backfillState,
  stateAfterRefusal,
  rowRunnable,
  isHistoryLead,
  MAX_CONSECUTIVE_ERRORS,
  HISTORY_AI_PER_RUN,
} from "../lib/meta/historyBackfill.js";
import { pollForm, POLL_MAX_PAGES } from "../lib/meta/leadsFetch.js";
import { savePageMessagingChannels } from "../lib/messaging/pageChannels.js";
import { savePageConnection } from "../lib/meta/pageConnection.js";
import { createScoredLead } from "../lib/leads/createLead.js";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";
import { db } from "@/lib/db";

process.env.META_TOKEN_ENCRYPTION_KEY = process.env.META_TOKEN_ENCRYPTION_KEY || "0".repeat(64);

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 400));
  }
}
const section = (t) => console.log(`\n${t}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = (p) =>
  fs
    .readFileSync(path.join(ROOT, p), "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const NOW = new Date("2026-10-03T12:00:00Z");
const daysAgo = (n, h = 0) => new Date(NOW.getTime() - n * 86400000 - h * 3600000);
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "+0000");
const CO = "company_REAL";
const OTHER = "company_OTHER";
const PAGE_ID = "108765432101234";
const IG_ID = "17841480173629186";
const GRANTED =
  "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages,leads_retrieval,pages_manage_ads";
const CLOUD = (n) => `https://res.cloudinary.com/demo/image/upload/v1/messaging/${CO}/${n}.jpg`;

// ═══════════════════════════════════════════════════════════════════════════
section("1. Meta's error payloads, and the field fallback");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a body that is not JSON is still classified, not thrown", classifyMetaError({ status: 502, body: null }).kind === "unknown_error");
  ok("an empty error object is unknown_error with a sentence", /HTTP 400/.test(classifyMetaError({ status: 400, body: { error: {} } }).message));
  ok("code 190 is an auth error", classifyMetaError({ status: 400, body: { error: { code: 190, message: "Session has expired" } } }).kind === "auth_error");
  const rl = classifyMetaError({ status: 400, body: { error: { code: 32, message: "Page request limit reached" } }, headers: { "retry-after": "not-a-number" } });
  ok("a page rate limit with a garbage retry-after falls back to 300 s", rl.kind === "rate_limited" && rl.retryAfterSeconds === 300, rl);
  ok("Meta's nonexisting-field refusal is recognised", isUnknownFieldError({ ok: false, kind: "unknown_error", message: "(#100) Tried accessing nonexisting field (file_url) on node type (MessageAttachment)" }));
  ok("…and a permission or token refusal is not", !isUnknownFieldError({ ok: false, kind: "auth_error", message: "Error validating access token" }) && !isUnknownFieldError({ ok: true }) && !isUnknownFieldError(null));
  ok("too-much-data is still its own thing", isTooMuchDataError({ ok: false, message: "Please reduce the amount of data you're asking for, then retry your request" }) && !isUnknownFieldError({ ok: false, message: "Please reduce the amount of data you're asking for" }));
  ok("the attachment subfields include the two that carry a URL", /image_data/.test(ATTACHMENT_SUBFIELDS) && /video_data/.test(ATTACHMENT_SUBFIELDS) && /file_url/.test(ATTACHMENT_SUBFIELDS));
  ok("the field list names them, and the bare fallback does not", conversationFields(10).includes(`attachments{${ATTACHMENT_SUBFIELDS}}`) && !conversationFields(10, { bare: true }).includes("image_data"));
  ok("a nested messages page's own cursor is readable", nextConversationCursor({ data: [], paging: { cursors: { after: "M1" }, next: "https://x" } }) === "M1");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Attachments");
// ═══════════════════════════════════════════════════════════════════════════
{
  const video = graphAttachmentsToStored({ data: [{ id: "a", mime_type: "video/mp4", video_data: { url: "https://video.xx.fbcdn.net/v/clip.mp4?oe=1" } }] });
  ok("a Graph video becomes a video with Meta's link in sourceUrl, url null", video?.[0]?.type === "video" && video[0].url === null && /fbcdn/.test(video[0].sourceUrl), video);
  const bare = graphAttachmentsToStored({ data: [{ id: "a", mime_type: "image/jpeg", name: "x.jpg" }] });
  ok("an attachment Meta gave no URL for is kept, named, and NOT fetchable (the old failure)", bare?.[0]?.type === "image" && !hasFetchableMedia(bare), bare);
  ok("Messenger's ceiling is 25 MB for every type", maxBytesFor("image", "facebook") === MESSENGER_MAX_BYTES && maxBytesFor("video", "instagram") === 25 * 1024 * 1024);
  ok("WhatsApp keeps its own, smaller image ceiling", maxBytesFor("image", "whatsapp") === 5 * 1024 * 1024);

  // A 9 MB phone photo on Messenger: refused before, fetched now.
  const nine = Buffer.alloc(9 * 1024 * 1024, 1);
  const fakeFetch = async () => ({ ok: true, status: 200, headers: { get: (h) => (h === "content-length" ? String(nine.length) : h === "content-type" ? "image/jpeg" : null) }, arrayBuffer: async () => nine });
  const uploaded = [];
  const out = await rehostAttachment({
    attachment: { type: "image", sourceUrl: "https://scontent.xx.fbcdn.net/v/big.jpg", mimeType: "image/jpeg" },
    channel: { platform: "facebook" },
    companyId: CO,
    fetchImpl: fakeFetch,
    uploadImpl: async (buf, opts) => { uploaded.push({ bytes: buf.length, folder: opts.folder }); return { secure_url: CLOUD("big") }; },
  });
  ok("a 9 MB Messenger photo is re-hosted (it was refused under WhatsApp's 5 MB)", out.url === CLOUD("big") && uploaded[0]?.folder === `messaging/${CO}`, out);
  const huge = Buffer.alloc(26 * 1024 * 1024, 1);
  const tooBig = await rehostAttachment({
    attachment: { type: "video", sourceUrl: "https://video.xx.fbcdn.net/v/huge.mp4" },
    channel: { platform: "instagram" },
    companyId: CO,
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: (h) => (h === "content-length" ? String(huge.length) : null) }, arrayBuffer: async () => huge }),
    uploadImpl: async () => ({ secure_url: CLOUD("nope") }),
  });
  ok("26 MB on Instagram is refused with a sentence naming the platform's limit", /25 MB Messenger and Instagram/.test(tooBig.error || ""), tooBig);
  const expired = await rehostAttachment({
    attachment: { type: "image", sourceUrl: "https://scontent.xx.fbcdn.net/v/old.jpg?oe=1" },
    channel: { platform: "facebook" },
    companyId: CO,
    fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => null } }),
    uploadImpl: async () => ({ secure_url: CLOUD("x") }),
  });
  ok("an expired Meta link (HTTP 403) is a failure with the status, not a broken image", /HTTP 403/.test(expired.error || ""), expired);
  const evil = await rehostAttachment({
    attachment: { type: "image", sourceUrl: "https://scontent.xx.fbcdn.net.evil.com/x.jpg" },
    channel: { platform: "facebook" },
    companyId: CO,
    fetchImpl: async () => { throw new Error("must not be called"); },
    uploadImpl: async () => ({ secure_url: CLOUD("x") }),
  });
  ok("a lookalike host is never fetched", /not on one of Meta's media hosts/.test(evil.error || ""), evil);

  const reel = parseMessagingEnvelope({ object: "instagram", entry: [{ id: IG_ID, time: 1, messaging: [{ sender: { id: "IGSID_1" }, recipient: { id: IG_ID }, timestamp: NOW.getTime(), message: { mid: "m_reel", attachments: [{ type: "ig_reel", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1" } }] } }] }] });
  ok("an Instagram reel is a video, not a download row", reel.events[0]?.attachments?.[0]?.type === "video", reel.events[0]?.attachments);

  // ── The re-delivery merge ──
  const ready = [{ type: "image", url: CLOUD("a"), sourceUrl: null, fetchAttempts: 1 }];
  const again = [{ type: "image", url: null, sourceUrl: "https://scontent.xx.fbcdn.net/v/a.jpg?oe=2" }];
  const kept = mergeAttachmentsOnRedelivery(ready, again);
  ok("a durable copy survives a re-delivery (never re-downloaded)", kept[0].url === CLOUD("a") && !hasFetchableMedia(kept), kept);
  const deadLink = [{ type: "video", url: null, sourceUrl: "https://video.xx.fbcdn.net/v/v.mp4?oe=OLD", fetchAttempts: MEDIA_FETCH_MAX_ATTEMPTS, fetchError: "The file could not be downloaded (HTTP 403)." }];
  ok("a failed entry at its attempt ceiling is not fetchable on its own", !hasFetchableMedia(deadLink));
  const revived = mergeAttachmentsOnRedelivery(deadLink, [{ type: "video", url: null, sourceUrl: "https://video.xx.fbcdn.net/v/v.mp4?oe=NEW" }]);
  const r0 = normaliseAttachment(revived[0], 0);
  ok("a FRESH link revives an expired failure: pending, attempts reset, new link", r0.state === "pending" && r0.fetchAttempts === 0 && /oe=NEW/.test(r0.sourceUrl) && hasFetchableMedia(revived), r0);
  const same = mergeAttachmentsOnRedelivery(deadLink, [{ type: "video", url: null, sourceUrl: "https://video.xx.fbcdn.net/v/v.mp4?oe=OLD" }]);
  ok("the SAME dead link changes nothing — the failure and its reason stand", normaliseAttachment(same[0], 0).state === "failed" && /403/.test(normaliseAttachment(same[0], 0).fetchError));
  ok("no attachments in a re-delivery leaves the column alone (undefined)", mergeAttachmentsOnRedelivery(ready, null) === undefined && mergeAttachmentsOnRedelivery(ready, []) === undefined);
  const swapped = mergeAttachmentsOnRedelivery(ready, [{ type: "document", url: null, sourceUrl: "https://cdn.fbsbx.com/f.pdf" }]);
  ok("a different type at the same position is the new delivery's truth", swapped[0].type === "document");
  const unavailable = mergeAttachmentsOnRedelivery(bare, [{ type: "image", url: null, sourceUrl: "https://scontent.xx.fbcdn.net/v/now.jpg" }]);
  ok("an attachment stored with no URL becomes fetchable when the re-pull brings one", hasFetchableMedia(unavailable));
  ok("garbage in the column does not throw", Array.isArray(mergeAttachmentsOnRedelivery("garbage", [{ type: "image", sourceUrl: "https://scontent.xx.fbcdn.net/x" }])));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The identity matcher, against hostile people");
// ═══════════════════════════════════════════════════════════════════════════
{
  const lead = (id, o = {}) => ({ id, companyId: CO, name: null, email: null, phone: null, intake: null, conversationEvidence: null, createdAt: daysAgo(1), ...o });
  const client = (id, o = {}) => ({ id, companyId: CO, name: null, email: null, phone: null, address: null, city: null, province: null, country: null, language: null, createdAt: daysAgo(100), ...o });

  ok("an emoji-only display name is no name at all", namesDisagree("🔥🔥", "John Smith") === false);
  const emoji = matchLeadIdentity({ companyId: CO, incoming: { name: "🔥😎", phone: null }, leads: [lead("L1", { name: "🔥😎" })] });
  ok("two emoji names never match each other", emoji.kind === null, emoji);
  ok("nothing to match on is said, not guessed", matchLeadIdentity({ companyId: CO, incoming: {} }).kind === null);

  const byPhone = matchLeadIdentity({ companyId: CO, incoming: { name: "Ana Gomez", phone: "(613) 555-0199" }, leads: [lead("L1", { name: "Ana Gomez", phone: "+16135550199" })] });
  ok("the same phone written two ways, same name: linked to the lead", byPhone.kind === "lead" && byPhone.id === "L1" && byPhone.confidence === "certain" && byPhone.matchedOn.includes("phone"), byPhone);

  const family = matchLeadIdentity({ companyId: CO, incoming: { name: "Mary Smith", phone: "613-555-0150" }, leads: [lead("L2", { name: "John Smith", phone: "6135550150" })] });
  ok("a shared family phone with different first names is NOT linked", family.kind === null && family.possible.some((p) => p.id === "L2" && p.conflicts.includes("name")), family);
  const unnamed = matchLeadIdentity({ companyId: CO, incoming: { name: null, phone: "613-555-0150" }, leads: [lead("L2", { name: "John Smith", phone: "6135550150" })] });
  ok("…while a phone with one side unnamed links", unnamed.kind === "lead" && unnamed.id === "L2", unnamed);

  const missingPhone = matchLeadIdentity({ companyId: CO, incoming: { name: "Ana Gomez", phone: null, email: null }, leads: [lead("L1", { name: "Ana Gomez", phone: "+16135550199" })] });
  ok("missing phone, name alone: only possible, never linked", missingPhone.kind === null && missingPhone.possible[0]?.id === "L1", missingPhone);

  const twoAddresses = matchLeadIdentity({
    companyId: CO,
    incoming: { name: "Marie Tremblay", address: "12 Elm Street, Ottawa K1A 0B1" },
    leads: [lead("L3", { name: "Marie Tremblay", intake: { address: "48 Oak Avenue", postalCode: "K2P 1L4" } })],
  });
  ok("same name, different address: a conflict, not linked", twoAddresses.kind === null, twoAddresses);
  const sameAddress = matchLeadIdentity({
    companyId: CO,
    incoming: { name: "Marie Tremblay", address: "12 Elm Street, Ottawa K1A 0B1" },
    leads: [lead("L3", { name: "Marie Tremblay", intake: { address: "12 Elm St", postalCode: "K1A 0B1" } })],
  });
  ok("same name AND agreeing address: likely, linked", sameAddress.kind === "lead" && sameAddress.confidence === "likely", sameAddress);
  ok("leadAddress reads intake parts", /12 Elm St/.test(leadAddress({ intake: { address: "12 Elm St", city: "Ottawa" } })));

  const other = matchLeadIdentity({ companyId: CO, incoming: { email: "a@b.co" }, leads: [{ ...lead("LX", { email: "a@b.co" }), companyId: OTHER }] });
  ok("another tenant's lead is never a match, even on an exact email", other.kind === null, other);
  ok("no tenant, no answer", (() => { try { matchLeadIdentity({ incoming: {} }); return false; } catch { return true; } })());

  const tie = matchLeadIdentity({ companyId: CO, incoming: { email: "dup@x.co" }, leads: [lead("A", { email: "dup@x.co" }), lead("B", { email: "dup@x.co" })] });
  ok("two leads matching equally: neither is picked", tie.kind === null && tie.ambiguous === true && tie.possible.length === 2, tie);

  const psid = matchLeadIdentity({
    companyId: CO,
    incoming: { psid: "PSID_9", platform: "facebook" },
    threads: [{ id: "T9", companyId: CO, leadId: null, participantName: "x", participantExternalId: "PSID_9", platform: "facebook", contacts: {} }],
  });
  ok("the same Meta id on the same platform is certain", psid.kind === "thread" && psid.matchedOn[0] === "psid" && psid.confidence === "certain", psid);
  const psidOtherPlatform = matchLeadIdentity({
    companyId: CO,
    incoming: { psid: "PSID_9", platform: "instagram" },
    threads: [{ id: "T9", companyId: CO, leadId: null, participantName: "x", participantExternalId: "PSID_9", platform: "facebook", contacts: {} }],
  });
  ok("…but a Messenger id is not an Instagram id", psidOtherPlatform.kind === null);

  const threadWithLead = matchLeadIdentity({
    companyId: CO,
    incoming: { name: "Sam Lee", phone: "6135550177" },
    leads: [lead("LT", { name: "Sam Lee" })],
    threads: [{ id: "TT", companyId: CO, leadId: "LT", participantName: "Sam Lee", participantExternalId: "P1", platform: "facebook", contacts: { phone: "613 555 0177" } }],
  });
  ok("a phone typed in Messenger finds the lead that conversation belongs to", threadWithLead.kind === "lead" && threadWithLead.id === "LT", threadWithLead);

  const toClient = matchLeadIdentity({ companyId: CO, incoming: { name: "Bob Builder", email: "BOB@x.com" }, clients: [client("C1", { name: "Bob Builder", email: "bob@x.com" })] });
  ok("a client on file is matched when no lead is", toClient.kind === "client" && toClient.id === "C1", toClient);
  const leadBeatsClient = matchLeadIdentity({ companyId: CO, incoming: { email: "bob@x.com" }, leads: [lead("LB", { email: "bob@x.com" })], clients: [client("C1", { email: "bob@x.com" })] });
  ok("an open lead is a better home than the client record", leadBeatsClient.kind === "lead");
  const rejected = matchLeadIdentity({ companyId: CO, incoming: { email: "bob@x.com" }, leads: [lead("LB", { email: "bob@x.com" })], rejected: new Set(["lead:LB"]) });
  ok("a pair somebody said is NOT the same person is never proposed again", rejected.kind === null);

  const fold = planFoldIn({ phone: "+1613", email: null }, { phone: "999", email: "New@X.co" });
  ok("folding fills only EMPTY columns and records what was there", !("phone" in fold.data) && fold.data.email === "new@x.co" && fold.wrote.email.before === null, fold);
  ok("threadContacts reads the new values and the old signature list", threadContacts({ contactsSeen: ["phone:+16135550100", "email:a@b.co"] }).phone === "+16135550100" && threadContacts({ contacts: { phone: "x" } }).phone === "x" && threadContacts(null).phone === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The message reviewer");
// ═══════════════════════════════════════════════════════════════════════════
{
  const msgs = [
    { id: "m1", direction: "in", body: "Hi, I'm selling commercial paint at wholesale prices", private: false, sentAt: daysAgo(1) },
    { id: "m2", direction: "out", body: "No thanks", private: false, sentAt: daysAgo(1) },
  ];
  const { index } = buildTranscript(msgs);
  const vendor = verifyExtraction({ kind: "not_work", notLeadReason: "vendor", kindMessage: 1 }, index, []);
  ok("the model's sub-kind and evidence survive verification", vendor.notLeadReason === "vendor" && vendor.kindMessage?.id === "m1", vendor);
  const lying = verifyExtraction({ kind: "not_work", notLeadReason: "definitely_a_vendor", kindMessage: 2 }, index, []);
  ok("an invented sub-kind becomes 'other', and a BUSINESS message is not evidence", lying.notLeadReason === "other" && lying.kindMessage === null, lying);
  ok("spam is spam whatever sub-kind is written beside it", verifyExtraction({ kind: "spam", notLeadReason: "vendor" }, index, []).notLeadReason === "spam");
  ok("a work request carries no not-a-lead reason", verifyExtraction({ kind: "work_request", notLeadReason: "vendor" }, index, []).notLeadReason === null);
  const schema = extractionSchema(["svc_1"]);
  ok("the schema still passes the strict-output lint", assertStrictSchema(schema).ok, assertStrictSchema(schema).errors);
  ok("the sub-kinds are the owner's list plus other/none", NOT_LEAD_REASON_ENUM.join(",") === "spam,wrong_number,job_seeker,vendor,other,none");

  const converted = { status: "confirmed", clientId: "C1", matchedOn: ["phone"], outcome: "won", quote: { id: "Q1", number: "Q-0012", status: "accepted" }, jobId: "J1", invoices: { numbers: ["INV-4"], fullyPaid: true } };
  const v1 = reviewVerdict({ ai: { ok: true, kind: "work_request" }, conversion: converted });
  ok("a quote, job and paid invoice for the matched client: CONVERTED, with the documents", v1.verdict === "converted" && v1.evidence.documents.map((d) => d.type).join(",") === "quote,job,invoice" && !verdictMakesLead(v1), v1);
  const v2 = reviewVerdict({ ai: { ok: true, kind: "spam" }, conversion: converted });
  ok("spam wins even over a client match", v2.verdict === "not_a_lead" && v2.notLeadReason === "spam");
  const noQuote = { status: "confirmed", clientId: "C1", matchedOn: ["email"], outcome: "no_quote" };
  const v3 = reviewVerdict({ ai: { ok: true, kind: "work_request" }, conversion: noQuote, clientDocs: [{ type: "job", id: "J0", number: "Deck 2024", status: "completed" }] });
  ok("a client asking for NEW work: existing client, a lead IS made, their history listed", v3.verdict === "existing_client" && v3.newWork === true && verdictMakesLead(v3) && v3.evidence.documents[0]?.id === "J0", v3);
  const fd = reviewVerdict({ ai: null, conversion: noQuote, decidedKind: "work_request", aiUnavailable: "no_credit" });
  ok("no AI credit, but the front desk read 'book': a known client still gets a lead for new work, and it says AI did not run", fd.verdict === "existing_client" && fd.newWork && verdictMakesLead(fd) && fd.method === "deterministic" && fd.aiUnavailable === "no_credit", fd);
  ok("…and the front desk never overrides the model", reviewVerdict({ ai: { ok: true, kind: "spam" }, decidedKind: "work_request" }).verdict === "not_a_lead");
  const v4 = reviewVerdict({ ai: { ok: true, kind: "existing_customer_issue" }, conversion: noQuote });
  ok("a client with a complaint: existing client, no lead", v4.verdict === "existing_client" && !verdictMakesLead(v4));
  const v5 = reviewVerdict({ ai: null, conversion: null, aiUnavailable: "no_credit" });
  ok("no AI credit and nothing on file: undetermined, and it SAYS the AI did not run", v5.verdict === "undetermined" && v5.aiUnavailable === "no_credit" && v5.method === "deterministic");
  const v6 = reviewVerdict({ ai: null, conversion: converted, aiUnavailable: "no_credit" });
  ok("…while the records alone still say 'converted'", v6.verdict === "converted" && v6.method === "deterministic" && v6.aiUnavailable === "no_credit");
  const v7 = reviewVerdict({ ai: { ok: true, kind: "not_work", notLeadReason: "wrong_number", kindMessage: { id: "m1", body: "sorry wrong number" } } });
  ok("a wrong number is not a lead, with the message it rests on", v7.verdict === "not_a_lead" && v7.notLeadReason === "wrong_number" && v7.evidence.message.messageId === "m1" && /wrong number/.test(v7.evidence.message.quote), v7);
  const possible = reviewVerdict({ ai: { ok: true, kind: "work_request" }, conversion: { status: "possible", candidateIds: ["C2"], matchedOn: ["name"] } });
  ok("a POSSIBLE client match never makes someone a client", possible.verdict === "genuine_lead" && possible.evidence.client === null && possible.evidence.possible.candidateIds[0] === "C2");
  ok("conversionDocuments is empty for anything but confirmed", conversionDocuments({ status: "possible" }).length === 0 && conversionDocuments(null).length === 0);

  const shaped = publicReview({ ...v1, wroteClientId: "C1" }, { quotes: true, jobs: false, invoices: false });
  ok("redaction: a quote number on the quotes dial, a job and invoice hidden on theirs", shaped.documents[0].number === "Q-0012" && shaped.documents[1].restricted === true && shaped.documents[2].restricted === true && !("number" in shaped.documents[2]), shaped.documents);
  const crew = publicReview({ ...v1, wroteClientId: "C1" }, { quotes: true, jobs: true, invoices: true, scoped: true });
  ok("an assignment-scoped member (crew) gets no client, no document numbers, no client undo", crew.client === null && crew.wroteClientId === null && crew.documents.every((d) => d.restricted === true && !("number" in d)), crew);
  ok("the documents route and the thread route both pass the scope", /scoped: seesOnlyAssignedJobs\(full\)/.test(code("app/api/leads/[id]/documents/route.js")) && /scoped: seesOnlyAssignedJobs\(full\)/.test(code("app/api/messaging/threads/[id]/route.js")));
  ok("a stored review of an unknown verdict is not shown", publicReview({ verdict: "maybe" }) === null && publicReview(null) === null);
  const onLead = reviewForLead(v1);
  ok("the copy on the LEAD row keeps no document numbers", onLead.evidence.documents.every((d) => !("number" in d)) && onLead.evidence.documents.length === 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4b. The reviewer inside lead capture — converted makes no copy, undo is respected");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { captureLeadFromConversation } = await import("../lib/leads/conversationLead.js");
  const mkPrisma = (thread, leads = []) => {
    const st = { thread: { ...thread }, leads: leads.map((l) => ({ ...l })) };
    return {
      st,
      messageThread: {
        async findFirst({ where }) { return where.id === st.thread.id && where.companyId === st.thread.companyId ? { ...st.thread } : null; },
        async update({ data }) { Object.assign(st.thread, data); return st.thread; },
        async updateMany({ where, data }) {
          if (where.id !== st.thread.id || where.companyId !== st.thread.companyId) return { count: 0 };
          for (const k of ["leadId", "clientId"]) if (k in where && where[k] === null && st.thread[k]) return { count: 0 };
          Object.assign(st.thread, data);
          return { count: 1 };
        },
      },
      leadRequest: {
        async findFirst({ where }) { return st.leads.find((l) => l.id === where.id && l.companyId === where.companyId) || null; },
        async findMany({ where }) { return st.leads.filter((l) => l.companyId === where.companyId); },
        async update({ where, data }) {
          let l = st.leads.find((x) => x.id === where.id);
          if (!l) { l = { id: where.id, companyId: CO }; st.leads.push(l); }
          Object.assign(l, data);
          return l;
        },
      },
      companyServiceCategory: { async findMany() { return []; } },
    };
  };
  const thread = {
    id: "T_rev", companyId: CO, leadId: null, clientId: null, quoteId: null, participantName: "Ana Gomez", participantExternalId: "PSID_A",
    routingIntent: null, adReferral: null, leadCapture: null, createdAt: daysAgo(2), channel: { platform: "facebook" },
    messages: [{ id: "m1", direction: "in", body: "Hi, I want my fence painted, my number is 613 555 0199", sentAt: daysAgo(2), attachments: null, private: false, imported: true }],
  };
  const created = [];
  const links = [];
  const baseDeps = (conversion) => ({
    aiConfigured: () => true,
    extract: async () => ({ ok: true, metered: true, kind: "work_request", notLeadReason: null, kindMessage: thread.messages[0], fields: {}, refused: [] }),
    createLead: async (input) => { created.push(input); return { id: `L_new_${created.length}`, companyId: CO, ...input, conversationEvidence: null }; },
    rescore: async () => null,
    resolveCampaign: async () => null,
    reviewRecords: async () => ({ conversion, clientDocs: [] }),
    rejected: async () => new Set(),
    linkThread: async (_p, a) => { links.push(["thread", a]); return { id: "lt" }; },
    linkClient: async (_p, a) => { links.push(["client", a]); return { id: "lc" }; },
  });
  const converted = { status: "confirmed", clientId: "C_ana", matchedOn: ["phone"], outcome: "won", quote: { id: "Q9", number: "Q-0009", status: "accepted" }, jobId: null, invoices: null };
  const p1 = mkPrisma(thread);
  const r1 = await captureLeadFromConversation({ companyId: CO, threadId: "T_rev", prisma: p1, deps: baseDeps(converted), now: NOW });
  ok("a converted person asking again makes NO new lead", created.length === 0 && r1.review === "converted", r1);
  ok("…the thread is pointed at their client, remembered as the reviewer's own link", p1.st.thread.clientId === "C_ana" && p1.st.thread.leadCapture.review.wroteClientId === "C_ana", p1.st.thread);
  ok("…and the review keeps the quote it rests on", p1.st.thread.leadCapture.review.evidence.documents[0]?.number === "Q-0009");

  // Somebody presses "Not this client" (PATCH clientId: null); a new message arrives.
  p1.st.thread.clientId = null;
  p1.st.thread.messages = [{ id: "m2", direction: "in", body: "also my email is ana@example.com", sentAt: daysAgo(1), attachments: null, private: false }, ...p1.st.thread.messages];
  const r2 = await captureLeadFromConversation({ companyId: CO, threadId: "T_rev", prisma: p1, deps: baseDeps(converted), now: NOW });
  ok("after 'Not this client' the reviewer never re-links that client", p1.st.thread.clientId === null && r2.review !== "converted", r2);
  ok("…and with the client set aside, the work request becomes a lead", created.length === 1, created);

  const existing = { status: "confirmed", clientId: "C_bob", matchedOn: ["email"], outcome: "no_quote" };
  const p3 = mkPrisma({ ...thread, id: "T_bob", leadCapture: null });
  created.length = 0;
  links.length = 0;
  await captureLeadFromConversation({ companyId: CO, threadId: "T_bob", prisma: p3, deps: baseDeps(existing), now: NOW });
  ok("an existing client asking for new work: a lead, tied to the client", created.length === 1 && links.some(([k, a]) => k === "client" && a.clientId === "C_bob"), links);
  ok("…made from history (imported, 2 days old): stamped importedAt — no alert", created[0]?.importedAt instanceof Date, created[0]);

  const pNoAi = mkPrisma({ ...thread, id: "T_noai" });
  created.length = 0;
  const deps4 = { ...baseDeps(null), aiConfigured: () => false };
  const r4 = await captureLeadFromConversation({ companyId: CO, threadId: "T_noai", prisma: pNoAi, deps: deps4, now: NOW });
  // Since 2026-10-05 the deterministic tier decides first (lib/leads/
  // qualification.js): "I want my fence painted, my number is …" is a buying
  // signal plus a phone — a lead, by the rules, with no model. The review
  // still says the AI did not run, and nothing the person did not type is
  // invented (name from the profile, phone from the pattern).
  ok(
    "no AI: the rules make the lead, the review says the AI did not run, and nothing is invented",
    pNoAi.st.thread.leadCapture.review.aiUnavailable === "ai_unconfigured" &&
      pNoAi.st.thread.leadCapture.qualification?.tier === "lead" &&
      pNoAi.st.thread.leadCapture.qualification?.method === "rules" &&
      created.length === 1 &&
      created[0].name === "Ana Gomez" &&
      !created[0].email,
    { r4, created },
  );

  const pHist = mkPrisma({ ...thread, id: "T_hist" });
  let extracted = 0;
  const deps5 = { ...baseDeps(null), extract: async (...a) => { extracted += 1; return baseDeps(null).extract(...a); } };
  await captureLeadFromConversation({ companyId: CO, threadId: "T_hist", imported: true, allowAi: false, prisma: pHist, deps: deps5, now: NOW });
  ok("history with allowAi false spends nothing on the model, and says why", extracted === 0 && pHist.st.thread.leadCapture.review.aiUnavailable === "history_ai_off");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The conversation history walk");
// ═══════════════════════════════════════════════════════════════════════════

async function seed({ createdAt = daysAgo(5), isDemo = false } = {}) {
  resetDbStub();
  rows.company.push({ id: CO, name: "Truefinish Cabinets", isDemo, createdAt });
  await savePageConnection({
    companyId: CO,
    pageId: PAGE_ID,
    pageName: "Truefinish Cabinets",
    pageAccessToken: "PAGE-TOKEN",
    instagramUserId: IG_ID,
    instagramUsername: "truefinish",
    scopes: GRANTED,
    connectedByUserId: "user_1",
    webhookSubscribedAt: NOW,
    webhookSubscribeError: null,
  });
  await savePageMessagingChannels({
    companyId: CO,
    pageId: PAGE_ID,
    pageName: "Truefinish Cabinets",
    pageToken: "PAGE-TOKEN",
    instagramUserId: IG_ID,
    instagramUsername: "truefinish",
    grantedScopes: GRANTED,
    webhookSubscribedAt: NOW,
    connectedByUserId: "user_1",
  });
}

const SANDRA = {
  id: "t_sandra",
  updated_time: iso(daysAgo(1)),
  participants: { data: [{ name: "Sandra Lemieux", id: "PSID_SANDRA" }, { name: "Truefinish", id: PAGE_ID }] },
  messages: {
    data: [
      { id: "m_a3", created_time: iso(daysAgo(1)), from: { id: "PSID_SANDRA", name: "Sandra Lemieux" }, message: "Are you still able to come Tuesday?" },
      { id: "m_a2", created_time: iso(daysAgo(2)), from: { id: PAGE_ID, name: "Truefinish" }, message: "Sure, what's the address?" },
    ],
    paging: { cursors: { after: "older_sandra" }, next: "https://graph.facebook.com/next" },
  },
};
const SANDRA_OLDER = [
  {
    id: "m_a1",
    created_time: iso(daysAgo(40)),
    from: { id: "PSID_SANDRA", name: "Sandra Lemieux" },
    message: "Hi, I need my deck stained, call 613 555 0142",
    attachments: { data: [{ id: "att_s", mime_type: "image/jpeg", image_data: { url: "https://scontent.xx.fbcdn.net/v/deck.jpg?oe=1" } }] },
  },
];
const MARCO = {
  id: "t_marco",
  updated_time: iso(daysAgo(199)),
  participants: { data: [{ name: "Marco Rossi", id: "PSID_MARCO" }, { name: "Truefinish", id: PAGE_ID }] },
  messages: {
    data: [
      { id: "m_b2", created_time: iso(daysAgo(199)), from: { id: PAGE_ID }, message: "Thanks Marco, see you then" },
      {
        id: "m_b1",
        created_time: iso(daysAgo(200)),
        from: { id: "PSID_MARCO", name: "Marco Rossi" },
        message: "Here's the kitchen",
        attachments: { data: [{ id: "att_m", mime_type: "video/mp4", video_data: { url: "https://video.xx.fbcdn.net/v/kitchen.mp4?oe=OLD" } }] },
      },
    ],
  },
};

function fakeGraph({ pages = { facebook: [[SANDRA], [MARCO]], instagram: [[]] }, older = { t_sandra: [SANDRA_OLDER] }, failAt = null, unknownFieldOnce = false } = {}) {
  const calls = [];
  const msgCalls = [];
  let refusedField = false;
  const fetchConversations = async (args) => {
    calls.push(args);
    if (unknownFieldOnce && !args.bareAttachments && !refusedField) {
      refusedField = true;
      return { ok: false, kind: "unknown_error", message: "(#100) Tried accessing nonexisting field (file_url) on node type (MessageAttachment)" };
    }
    const list = pages[args.platform] || [[]];
    const idx = args.after ? Number(String(args.after).replace("c", "")) : 0;
    if (failAt && failAt.platform === args.platform && failAt.idx === idx && !failAt.done) {
      if (failAt.once) failAt.done = true;
      return { ok: false, ...failAt.result };
    }
    const more = idx + 1 < list.length;
    return { ok: true, data: { data: list[idx] || [], paging: more ? { cursors: { after: `c${idx + 1}` }, next: "https://next" } : { cursors: { after: "end" } } } };
  };
  const fetchMessages = async (args) => {
    msgCalls.push(args);
    const list = older[args.conversationId] || [];
    const idx = args.after === "older_sandra" ? 0 : Number(String(args.after).replace("om", ""));
    const more = idx + 1 < list.length;
    return { ok: true, data: { data: list[idx] || [], paging: more ? { cursors: { after: `om${idx + 1}` }, next: "https://next" } : {} } };
  };
  return { calls, msgCalls, fetchConversations, fetchMessages };
}

{
  await seed();
  const graph = fakeGraph({ unknownFieldOnce: true });
  const captured = [];
  const capture = async (args) => { captured.push(args); return { acted: false, aiRan: args.allowAi, created: false }; };

  const ensured = await ensureBackfills({ companyId: CO, scope: "messages", now: NOW });
  ok("connect-time: one walk queued per granted channel", ensured.kind === "ok" && ensured.rows.length === 2 && ensured.rows.every((r) => r.status === "queued"), ensured);
  const ran = await continueBackfills({ companyId: CO, now: NOW, deps: { fetchConversations: graph.fetchConversations, fetchMessages: graph.fetchMessages, capture } });
  ok("both walks ran to the end", ran.length === 2 && ran.every((r) => r.status === "done"), ran);
  ok("a Graph that refused a named subfield was asked again with the bare field", graph.calls[0].bareAttachments === false && graph.calls[1].bareAttachments === true, graph.calls.map((c) => c.bareAttachments));
  ok("Messenger was paged through Meta's cursor", graph.calls.filter((c) => c.platform === "facebook").map((c) => c.after).join(",") === ",,c1", graph.calls.map((c) => c.after));
  ok("Sandra's OLDER messages were paged from her conversation", graph.msgCalls.length === 1 && graph.msgCalls[0].conversationId === "t_sandra" && graph.msgCalls[0].after === "older_sandra");

  const sandra = rows.messageThread.find((t) => t.externalThreadId === "PSID_SANDRA");
  const marco = rows.messageThread.find((t) => t.externalThreadId === "PSID_MARCO");
  // The ingest's own activity line ("reopened" when Sandra's recent message
  // met her history-resolved thread) is not a Meta message; leave it out.
  const metaRows = rows.message.filter((m) => !String(m.externalId).startsWith("local:"));
  ok("all five messages stored, every one marked imported", metaRows.length === 5 && metaRows.every((m) => m.imported === true), metaRows.map((m) => [m.externalId, m.imported]));
  ok("Sandra's first enquiry (40 days back, beyond the nested fifty) is in", rows.message.some((m) => m.externalId === "m_a1"));
  ok("Sandra wrote yesterday: open, ONE unread — her 40-day-old message added no badge", sandra?.status === "open" && sandra?.unread === 1, sandra);
  ok("Marco is history only: resolved, no unread, no waiting clock", marco?.status === "resolved" && marco?.unread === 0 && !marco?.waitingSince, marco);
  ok("Marco's first-inbound stamp is still recorded (the review reads it)", marco?.firstInboundAt instanceof Date);
  const photo = rows.message.find((m) => m.externalId === "m_a1");
  const vid = rows.message.find((m) => m.externalId === "m_b1");
  ok("history photos and videos are queued for re-hosting", photo?.mediaPending === true && vid?.mediaPending === true && vid.attachments[0].type === "video", [photo?.attachments, vid?.attachments]);
  ok("each conversation was reviewed ONCE, silently", captured.length === 2 && captured.every((c) => c.imported === true));
  ok("the model may read Sandra (recent) and not Marco (200 days)", captured.find((c) => c.threadId === sandra.id)?.allowAi === true && captured.find((c) => c.threadId === marco.id)?.allowAi === false, captured);

  const st = await backfillState(CO);
  const fb = st.messages.find((m) => m.platform === "facebook");
  ok("the card's numbers: 2 conversations, 5 messages, back 200 days", fb?.counts.conversations === 2 && fb?.counts.messages === 5 && new Date(fb.oldestSeenAt).getTime() === daysAgo(200).getTime() && fb.status === "done", fb);
  ok("…and the two attachments counted", fb?.counts.attachments === 2);

  // Re-host the photo (what the media cron does), expire Marco's video.
  photo.attachments = [{ type: "image", url: CLOUD("deck"), sourceUrl: null, fetchAttempts: 1 }];
  photo.mediaPending = false;
  vid.attachments = [{ ...vid.attachments[0], fetchAttempts: MEDIA_FETCH_MAX_ATTEMPTS, fetchError: "The file could not be downloaded (HTTP 403)." }];
  vid.mediaPending = false;

  // "Fetch older" again — from the top, Meta now handing a fresh video link.
  const MARCO_FRESH = JSON.parse(JSON.stringify(MARCO));
  MARCO_FRESH.messages.data[1].attachments.data[0].video_data.url = "https://video.xx.fbcdn.net/v/kitchen.mp4?oe=NEW";
  const graph2 = fakeGraph({ pages: { facebook: [[SANDRA], [MARCO_FRESH]], instagram: [[]] } });
  const before = { threads: rows.messageThread.length, messages: rows.message.length, unread: rows.messageThread.map((t) => t.unread).join(",") };
  const restarted = await ensureBackfills({ companyId: CO, scope: "messages", restart: true, now: NOW });
  ok("Fetch older restarts a finished walk from the top", restarted.rows.every((r) => r.status === "queued" && r.cursor === null));
  await continueBackfills({ companyId: CO, now: NOW, deps: { fetchConversations: graph2.fetchConversations, fetchMessages: graph2.fetchMessages, capture } });
  ok("a second walk writes no new thread and no new message", rows.messageThread.length === before.threads && rows.message.length === before.messages, [rows.message.length, before.messages]);
  ok("…and moves no unread badge", rows.messageThread.map((t) => t.unread).join(",") === before.unread);
  ok("the re-hosted photo is KEPT — not reset to Meta's link, not re-queued", photo.attachments[0].url === CLOUD("deck") && photo.mediaPending === false, photo.attachments);
  ok("the expired video came back to life with the fresh link", vid.mediaPending === true && /oe=NEW/.test(vid.attachments[0].sourceUrl) && vid.attachments[0].fetchAttempts === 0, vid.attachments);
  const fb2 = (await backfillState(CO)).messages.find((m) => m.platform === "facebook");
  ok("the second walk created nothing", fb2.counts.created === 0 && fb2.counts.messages === 5, fb2.counts);
}

{
  // Rate limit mid-walk, then resume from the saved cursor.
  await seed();
  const failAt = { platform: "facebook", idx: 1, once: true, result: { kind: "rate_limited", message: "Page request limit reached", retryAfterSeconds: 120 } };
  const graph = fakeGraph({ failAt });
  const capture = async () => ({ acted: false });
  await ensureBackfills({ companyId: CO, scope: "messages", now: NOW });
  await continueBackfills({ companyId: CO, now: NOW, deps: { fetchConversations: graph.fetchConversations, fetchMessages: graph.fetchMessages, capture } });
  const row = rows.metaHistoryBackfill.find((r) => r.kind === "messenger");
  ok("a rate limit parks the walk with Meta's retry-after and keeps the cursor", row.status === "rate_limited" && row.cursor === "c1" && row.retryAfter.getTime() === NOW.getTime() + 120000, row);
  ok("…and it is not run again before then", !rowRunnable(row, new Date(NOW.getTime() + 60000)) && rowRunnable(row, new Date(NOW.getTime() + 121000)));
  const later = new Date(NOW.getTime() + 121000);
  graph.calls.length = 0;
  await continueBackfills({ companyId: CO, now: later, deps: { fetchConversations: graph.fetchConversations, fetchMessages: graph.fetchMessages, capture } });
  ok("it resumes at the saved cursor, not the top", graph.calls.filter((c) => c.platform === "facebook")[0]?.after === "c1" && row.status === "done", graph.calls.map((c) => c.after));
  ok("Marco arrived on the resumed page", rows.messageThread.some((t) => t.externalThreadId === "PSID_MARCO"));
}

{
  // A dead token stops the walk and flips the channel.
  await seed();
  const graph = fakeGraph({ failAt: { platform: "facebook", idx: 0, result: { kind: "auth_error", message: "Error validating access token" } } });
  await ensureBackfills({ companyId: CO, scope: "messages", now: NOW });
  await continueBackfills({ companyId: CO, now: NOW, deps: { fetchConversations: graph.fetchConversations, fetchMessages: graph.fetchMessages, capture: async () => null } });
  const row = rows.metaHistoryBackfill.find((r) => r.kind === "messenger");
  const channel = rows.messagingChannel.find((c) => c.platform === "facebook");
  ok("an auth refusal stops the walk with the reason", row.status === "error" && row.lastErrorKind === "auth_error", row);
  ok("…and the channel says it needs reconnecting", channel.status === "needs_reauth", channel.status);
  ok("an unexplained error is retried, then stops after MAX_CONSECUTIVE_ERRORS", stateAfterRefusal({ counts: { consecutiveErrors: MAX_CONSECUTIVE_ERRORS - 2 } }, { kind: "unknown_error" }, NOW).status === "queued" && stateAfterRefusal({ counts: { consecutiveErrors: MAX_CONSECUTIVE_ERRORS - 1 } }, { kind: "unknown_error" }, NOW).status === "error");
}

{
  await seed({ isDemo: true });
  const demo = await ensureBackfills({ companyId: CO, scope: "all", now: NOW });
  ok("nothing runs for a demo company", demo.kind === "demo" && rows.metaHistoryBackfill.length === 0);
  ok("the AI budget per run is bounded", HISTORY_AI_PER_RUN > 0 && HISTORY_AI_PER_RUN <= 50);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The lead-form history walk, fold-in, client tie, undo");
// ═══════════════════════════════════════════════════════════════════════════
{
  await seed();
  rows.metaLeadForm.push({ id: "form_row_1", companyId: CO, pageId: PAGE_ID, pageName: "Truefinish", formId: "F1", name: "Free estimate", active: true, cursorLeadCreatedAt: null });
  rows.leadRequest.push({ id: "L_ana", companyId: CO, name: "Ana Gomez", email: null, phone: "+16135550199", intake: null, conversationEvidence: null, source: "meta_messenger", status: "new", createdAt: daysAgo(3), metaCampaignId: null, metaCampaignName: null });
  rows.client.push({ id: "C_bob", companyId: CO, name: "Bob Builder", email: "bob@x.com", phone: null, address: null, city: null, province: null, country: null, language: null, createdAt: daysAgo(400) });

  const f = (name, values) => ({ name, values });
  const LEADS = [
    [
      { id: "lg_zed", created_time: iso(daysAgo(0, 2)), form_id: "F1", field_data: [f("full_name", ["Zed Young"]), f("phone_number", ["613-555-0111"])] },
      { id: "lg_ana", created_time: iso(daysAgo(30)), form_id: "F1", field_data: [f("full_name", ["Ana Gomez"]), f("phone_number", ["(613) 555-0199"]), f("email", ["ana@example.com"])] },
    ],
    [
      { id: "lg_bob", created_time: iso(daysAgo(60)), form_id: "F1", field_data: [f("full_name", ["Bob Builder"]), f("email", ["BOB@x.com"])] },
      { id: "lg_blank", created_time: iso(daysAgo(61)), form_id: "F1", field_data: [f("full_name", [""]), f("custom", ["  "])] },
    ],
  ];
  const leadCalls = [];
  const fetchLeads = async (args) => {
    leadCalls.push(args);
    const idx = args.after ? Number(String(args.after).replace("p", "")) : 0;
    const more = idx + 1 < LEADS.length;
    return { ok: true, data: { data: LEADS[idx] || [], paging: more ? { cursors: { after: `p${idx + 1}` }, next: "https://next" } : {} } };
  };
  const credentialFor = async () => ({ ok: true, pageId: PAGE_ID, pageName: "Truefinish", pageToken: "PAGE-TOKEN", attributionToken: "PAGE-TOKEN" });
  const attribute = async () => ({ campaignId: "CAMP1", campaignName: "Spring decks" });
  const deps = { fetchLeads, credentialFor, attribute };

  const ensured = await ensureBackfills({ companyId: CO, scope: "leads", now: NOW });
  ok("a walk is queued for the active form, floored at Meta's 90 days", ensured.rows.length === 1 && ensured.rows[0].floorAt.getTime() === daysAgo(90).getTime(), ensured.rows);
  await continueBackfills({ companyId: CO, kinds: ["lead_form"], now: NOW, deps });
  ok("every page was read, with the 90-day floor", leadCalls.length === 2 && leadCalls[1].after === "p1" && leadCalls[0].sinceUnixSeconds === Math.floor(daysAgo(90).getTime() / 1000), leadCalls);

  const zed = rows.leadRequest.find((l) => l.metaLeadId === "lg_zed");
  const bob = rows.leadRequest.find((l) => l.metaLeadId === "lg_bob");
  ok("a form filled in two hours ago is a LIVE lead — announced, not history", zed && !zed.importedAt, zed);
  ok("a 60-day-old submission is history: importedAt stamped (no new-lead alert)", bob?.importedAt instanceof Date, bob);
  ok("Ana's form did NOT become a second lead", !rows.leadRequest.some((l) => l.metaLeadId === "lg_ana") && rows.leadRequest.filter((l) => /Ana/.test(l.name)).length === 1);
  const anaLink = rows.leadIdentityLink.find((l) => l.metaLeadId === "lg_ana");
  ok("…it was folded into her Messenger lead, on the phone, with the form kept", anaLink?.leadId === "L_ana" && anaLink.kind === "meta_lead_form" && anaLink.matchedOn.includes("phone") && anaLink.payload.email === "ana@example.com", anaLink);
  const ana = rows.leadRequest.find((l) => l.id === "L_ana");
  ok("…filling only what her lead lacked (email, campaign), her phone untouched", ana.email === "ana@example.com" && ana.phone === "+16135550199" && ana.metaCampaignId === "CAMP1" && anaLink.wrote.email.before === null, ana);
  const bobLink = rows.leadIdentityLink.find((l) => l.kind === "client" && l.leadId === bob?.id);
  ok("Bob is a client on file: his lead is tied to the client", bobLink?.clientId === "C_bob", bobLink);
  ok("the blank submission made nothing", !rows.leadRequest.some((l) => l.metaLeadId === "lg_blank"));
  const form = rows.metaLeadForm[0];
  ok("when the walk finished, the live poll's cursor moved to the newest lead seen", form.cursorLeadCreatedAt?.getTime() === daysAgo(0, 2).getTime(), form.cursorLeadCreatedAt);
  const lf = (await backfillState(CO)).leads[0];
  ok("the card: 2 new leads, 1 matched to an existing one", lf.counts.leads === 2 && lf.counts.linked === 1 && lf.name === "Free estimate", lf.counts);

  // Walk again — nothing duplicates.
  const leadsBefore = rows.leadRequest.length;
  const linksBefore = rows.leadIdentityLink.length;
  await ensureBackfills({ companyId: CO, scope: "leads", restart: true, now: NOW });
  await continueBackfills({ companyId: CO, kinds: ["lead_form"], now: NOW, deps });
  ok("a second walk creates no lead and no link", rows.leadRequest.length === leadsBefore && rows.leadIdentityLink.length === linksBefore);
  const lf2 = (await backfillState(CO)).leads[0];
  ok("…and says why: three already here", lf2.counts.duplicates === 3 && lf2.counts.leads === 0, lf2.counts);

  // "Not the same person" on Ana.
  const undo = await undoIdentityLink(db, { companyId: CO, leadId: "L_ana", linkId: anaLink.id, userId: "user_1", createLead: createScoredLead, now: NOW });
  const split = rows.leadRequest.find((l) => l.id === undo.splitLeadId);
  ok("undo: the form becomes its own lead again, with its leadgen id and campaign", undo.ok && split?.metaLeadId === "lg_ana" && split.metaCampaignId === "CAMP1" && split.source === "meta_lead_form", split);
  ok("…the history stamp travels with it (still no alert)", split?.importedAt instanceof Date);
  ok("…what the link filled on Ana's lead is put back", ana.email === null && ana.metaCampaignId === null, ana);
  ok("…the link row stays, as undone, pointing at the split", anaLink.status === "undone" && anaLink.splitLeadId === split.id);
  ok("undoing twice is refused, not repeated", (await undoIdentityLink(db, { companyId: CO, leadId: "L_ana", linkId: anaLink.id, createLead: createScoredLead })).reason === "already_undone");
  ok("another tenant cannot undo it", (await undoIdentityLink(db, { companyId: OTHER, leadId: "L_ana", linkId: anaLink.id, createLead: createScoredLead })).reason === "not_found");
  const n = rows.leadRequest.length;
  await ensureBackfills({ companyId: CO, scope: "leads", restart: true, now: NOW });
  await continueBackfills({ companyId: CO, kinds: ["lead_form"], now: NOW, deps });
  ok("after the undo, a re-delivery of Ana's form finds the split lead — no third copy", rows.leadRequest.length === n);

  // A person edited the field after the link: the undo must not clobber it.
  rows.leadRequest.push({ id: "L_kim", companyId: CO, name: "Kim", email: null, phone: "+16135550123", intake: null, source: "meta_messenger", status: "new", createdAt: daysAgo(1) });
  rows.leadIdentityLink.push({ id: "link_kim", companyId: CO, leadId: "L_kim", kind: "meta_lead_form", metaLeadId: "lg_kim", status: "linked", payload: { name: "Kim", email: "kim@x.co" }, wrote: { email: { before: null, after: "kim@x.co" } } });
  rows.leadRequest.find((l) => l.id === "L_kim").email = "kim.personal@x.co";
  await undoIdentityLink(db, { companyId: CO, leadId: "L_kim", linkId: "link_kim", createLead: createScoredLead, now: NOW });
  ok("an undo never overwrites a person's later edit", rows.leadRequest.find((l) => l.id === "L_kim").email === "kim.personal@x.co");
  ok("isHistoryLead: older than a day only; garbage is not history", isHistoryLead(iso(daysAgo(2)), NOW) && !isHistoryLead(iso(daysAgo(0, 3)), NOW) && !isHistoryLead("not a date", NOW) && !isHistoryLead(null, NOW));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The live poll reads every page");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pages = (n) => Array.from({ length: n }, (_, i) => [{ id: `lead_${i}`, created_time: iso(daysAgo(0, i + 1)) }]);
  const runPoll = async (n) => {
    const P = pages(n);
    const imported = [];
    const out = await pollForm({
      companyId: CO,
      credential: { pageId: PAGE_ID, pageToken: "T", attributionToken: "T" },
      form: { formId: "F1", pageId: PAGE_ID, cursorLeadCreatedAt: daysAgo(10) },
      fetchLeads: async ({ after }) => {
        const idx = after ? Number(after) : 0;
        return { ok: true, data: { data: P[idx] || [], paging: idx + 1 < P.length ? { cursors: { after: String(idx + 1) }, next: "https://n" } : {} } };
      },
      importLead: async ({ lead }) => { imported.push(lead.id); return { status: "created" }; },
      attribute: async () => null,
    });
    return { out, imported };
  };
  const three = await runPoll(3);
  ok("three pages: all three read (it used to stop at the first hundred)", three.imported.length === 3 && three.out.created === 3 && !three.out.incomplete, three);
  const tooMany = await runPoll(POLL_MAX_PAGES + 2);
  ok("past the page budget it stops AND says so — the cron then holds the cursor", tooMany.imported.length === POLL_MAX_PAGES && tooMany.out.incomplete === true);
  ok("the cron refuses to move the cursor past an incomplete poll", /!result\.incomplete &&/.test(code("app/api/cron/meta-leads/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Source guards");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ingest = code("lib/messaging/ingest.js");
  ok("history is honoured only together with `imported`", /const history = event\.imported === true && event\.history === true;/.test(ingest));
  ok("history never reopens and never counts as unread", /const reopened = !history &&/.test(ingest) && /\.\.\.\(history\s*\?\s*\{\}/.test(ingest));
  ok("the AI employee, the push and live lead capture stay off imported messages", /created && event\.direction === "in" && !event\.imported && !event\.noAutoReply/.test(ingest) && /created && event\.direction === "in" && !event\.imported && \(CAPTURE_PLATFORMS/.test(ingest));
  ok("a history lead sends no new-lead notification", /if \(!importedAt(?: && [^)]*)?\) notifyEvent\(/.test(code("lib/leads/createLead.js")));
  ok("the walk reviews with imported: true", /capture\(\{ companyId, threadId, imported: true, allowAi, now \}\)/.test(code("lib/meta/historyBackfill.js")));
  const allScopes = [META_PAGES_SCOPE, META_LEADS_SCOPE, META_MESSAGING_SCOPE, META_OAUTH_SCOPE].flat().join(",");
  ok("ads_management is NOT requested (owner: later, after the current reviews)", !/ads_management/.test(allScopes) && !/ads_management/.test(code("lib/meta/client.js")), allScopes);
  ok("the forms panel shows folded submissions apart from created leads", /linkedCount/.test(code("app/api/meta/leads/forms/route.js")) && /formLinked/.test(code("app/app/settings/meta-ads/MetaLeadFormsPanel.js")));
  ok("convertLead reuses a client the lead was tied to", /linkedClientId\(db, \{ companyId, leadId: lead\.id \}\)/.test(code("lib/leads/convertLead.js")));
  ok("the history route refuses impersonated writes via memberOrRefusal and gates on billing admin", /isBillingAdmin\(member\.role\)/.test(code("app/api/meta/history/route.js")));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
