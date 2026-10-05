// scripts/check-social-leads.mjs
//
//   npm run check:social-leads
//
// Leads from Facebook / Instagram / WhatsApp conversations, and the check that
// they converted — executed against hostile fixtures rather than read:
//
//   lib/leads/conversationLead.js          extraction, the cost rule, dedupe,
//                                          never-overwrite, the whole capture
//                                          against a scripted database
//   lib/ai/conversationLeadExtract.js      the witness test on a model that lies
//   lib/attribution/conversionEvidence.js  confirmed vs possible, address as
//                                          additive evidence, the shared phone
//   lib/contacts/matchContact.js           the opt-in close-spelling name rule
//   lib/messaging/envelope.js (+WhatsApp)  Meta's click-to-message referral
//   lib/analytics/campaignRollup.js        inferred quotes and paid revenue
//
// The owner's eight hostile cases are sections 1–8; the rest are the rules a
// future edit could quietly undo.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-social-leads.mjs

import {
  deterministicContacts,
  contactSignature,
  aiRunDecision,
  decideKind,
  buildFieldEvidence,
  planLeadWrite,
  findDuplicateLead,
  captureLeadFromConversation,
  MAX_AI_RUNS_PER_THREAD,
  MIN_TEXT_FOR_AI,
  LEAD_AD_JOIN_DAYS,
} from "@/lib/leads/conversationLead";
import {
  verifyExtraction,
  buildTranscript,
  appearsIn,
  extractionSchema,
  extractConversationLead,
  CONVERSATION_KINDS,
  AI_FEATURE,
} from "@/lib/ai/conversationLeadExtract";
import { verifyConversion, matchConversation } from "@/lib/attribution/conversionEvidence";
import { namesClose, matchContactAgainst, addressKey, addressAgreement } from "@/lib/contacts/matchContact";
import { parseMessagingEnvelope, cleanReferral } from "@/lib/messaging/envelope";
import { parseWhatsAppEnvelope } from "@/lib/messaging/whatsappEnvelope";
import { buildCampaignRollup } from "@/lib/analytics/campaignRollup";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";
import { PAYER_FEATURES, companyLedgerFor } from "@/lib/ai/featurePayer";
import { WALLET_ESTIMATES, estimateChargeCents } from "@/lib/ai/walletMeter";
import { poolForKind, POOLS } from "@/lib/voice/credits";
import { shapeConversion } from "@/lib/leads/linkedDocuments";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)?.slice(0, 400)}` : ""}`);
    console.log(`  ✗ ${label}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);

const CO = "co_1";
const OTHER = "co_2";
const day = (n) => new Date(Date.UTC(2026, 8, 1) + n * 86400000);
const msg = (id, direction, body, extra = {}) => ({ id, direction, body, sentAt: day(0), attachments: null, private: false, ...extra });

// ── A scripted database ─────────────────────────────────────────────────────
//
// Every query is RECORDED with its where-clause, so section 10 can assert the
// tenant is on every one. A method nobody scripted throws by name.
function fakeDb({ thread, leads = [], services = [] }) {
  const calls = [];
  const writes = [];
  const state = { thread: { ...thread }, leads: leads.map((l) => ({ ...l })) };
  const db = {
    calls,
    writes,
    state,
    messageThread: {
      async findFirst(args) {
        calls.push(["messageThread.findFirst", args.where]);
        if (args.where.id !== state.thread.id || args.where.companyId !== state.thread.companyId) return null;
        return { ...state.thread };
      },
      async update(args) {
        calls.push(["messageThread.update", args.where]);
        writes.push(["messageThread.update", args]);
        Object.assign(state.thread, args.data);
        return { ...state.thread };
      },
      async updateMany(args) {
        calls.push(["messageThread.updateMany", args.where]);
        writes.push(["messageThread.updateMany", args]);
        const w = args.where;
        if (w.id === state.thread.id && w.companyId === state.thread.companyId && (w.leadId !== null || !state.thread.leadId)) {
          Object.assign(state.thread, args.data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    leadRequest: {
      async findFirst(args) {
        calls.push(["leadRequest.findFirst", args.where]);
        return state.leads.find((l) => l.id === args.where.id && l.companyId === args.where.companyId) || null;
      },
      async findMany(args) {
        calls.push(["leadRequest.findMany", args.where]);
        return state.leads
          .filter((l) => l.companyId === args.where.companyId && (!args.where.status?.in || args.where.status.in.includes(l.status)))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      },
      async update(args) {
        calls.push(["leadRequest.update", args.where]);
        writes.push(["leadRequest.update", args]);
        const l = state.leads.find((x) => x.id === args.where.id);
        if (l) Object.assign(l, args.data);
        return { id: args.where.id };
      },
    },
    companyServiceCategory: {
      async findMany(args) {
        calls.push(["companyServiceCategory.findMany", args.where]);
        return services.map((s) => ({ category: s }));
      },
    },
  };
  return db;
}

function depsFor(db, { ai = null, campaign = null } = {}) {
  const created = [];
  const extractCalls = [];
  const campaignAsks = [];
  return {
    created,
    extractCalls,
    campaignAsks,
    deps: {
      aiConfigured: () => true,
      rescore: async () => null,
      resolveCampaign: async ({ companyId, adId }) => {
        campaignAsks.push({ companyId, adId });
        return campaign ? { ...campaign } : null;
      },
      extract: async (args) => {
        extractCalls.push(args);
        if (!ai) return { ok: false, reason: "unconfigured", metered: false };
        const { index } = buildTranscript(args.messages);
        return { ok: true, metered: true, ...verifyExtraction(ai(args), index, args.services) };
      },
      createLead: async (input) => {
        created.push(input);
        const row = { id: `lead_new_${created.length}`, companyId: input.companyId, name: input.name, email: input.email || null, phone: input.phone || null, categoryId: input.categoryId || null, timeline: input.timeline || null, intake: input.intake || null, source: input.source, status: "new", createdAt: day(0), metaCampaignId: null, conversationEvidence: null };
        db.state.leads.push(row);
        return row;
      },
    },
  };
}

const field = (value = null, message = null) => ({ value, message });
const AI_NONE = { name: field(), phone: field(), email: field(), address: field(), area: field(), serviceId: "none", serviceMessage: null, timeline: "unknown", timelineMessage: null, summary: null, reason: "r" };

// ════════════════════════════════════════════════════════════════════════════
section("1. A phone written five ways is one phone");
// ════════════════════════════════════════════════════════════════════════════
{
  const spellings = ["(613) 555-0142", "613.555.0142", "+1 613 555 0142", "6135550142", "1-613-555-0142"];
  const sigs = spellings.map((p) => contactSignature(deterministicContacts({ messages: [msg("m1", "in", `call me at ${p} thanks`)] })));
  ok("every spelling is found in the customer's text", sigs.every((s) => s.length === 1), sigs);
  ok("…and all five normalise to the same E.164 key", new Set(sigs.map((s) => s[0])).size === 1 && sigs[0][0] === "phone:+16135550142", sigs);

  const det = deterministicContacts({
    messages: [
      msg("m1", "in", "hi, need my deck stained"),
      msg("m2", "out", "Sure! Our office is 613-555-9999, office@contractor.com"),
      msg("m3", "in", "my cell is 613.555.0142"),
    ],
  });
  ok("the customer's number is taken, with the message it came from", det.phone?.value === "613.555.0142" && det.phone.messageId === "m3" && /613\.555\.0142/.test(det.phone.quote), det.phone);
  ok("the CONTRACTOR's own number and email in an outbound message are never taken", det.email === null && !String(det.phone?.value).includes("9999"), det);

  const lead = { id: "L1", companyId: CO, name: "Someone", email: null, phone: "+1 (613) 555-0142", status: "new", source: "self_quote", createdAt: day(-2) };
  const dup = findDuplicateLead({ leads: [lead], companyId: CO, contact: { phone: "6135550142" } });
  ok("a lead stored as '+1 (613) 555-0142' is found from '6135550142'", dup.lead?.id === "L1" && dup.how.includes("phone"), dup);

  const wa = deterministicContacts({ messages: [msg("w1", "in", "hola")], platform: "whatsapp", participantExternalId: "16135550142" });
  ok("on WhatsApp the participant id IS the phone, labelled as such", wa.phone?.value === "+16135550142" && wa.phone.method === "whatsapp_number", wa.phone);
}

// ════════════════════════════════════════════════════════════════════════════
section("2. A misspelled name");
// ════════════════════════════════════════════════════════════════════════════
{
  ok("'Marie Tremblai' is close to 'Marie Tremblay'", namesClose("Marie Tremblai", "Marie Tremblay"));
  ok("…and to 'Tremblay, Marie' (surname first)", namesClose("Marie Tremblai", "Tremblay, Marie"));
  ok("'Marie Bremblay' is NOT — the first letter is the one people do not get wrong", !namesClose("Marie Bremblay", "Marie Tremblay"));
  ok("'Al Smith' / 'Ali Smith' is NOT — a short token must match exactly", !namesClose("Al Smith", "Ali Smith"));
  ok("an exact match is not 'close' (it is reported as `name`, once)", !namesClose("Marie Tremblay", "marie tremblay"));
  ok("a one-word name is never close to anything", !namesClose("Marie", "Maria"));

  const clients = [{ id: "c1", companyId: CO, name: "Marie Tremblay", email: null, phone: null, address: "12 Elm Street", city: "Ottawa", province: "ON K1A 0B1", createdAt: day(-100) }];
  const off = matchContactAgainst({ clients, companyId: CO, contact: { name: "Marie Tremblai" } });
  ok("the close-spelling rule is OFF by default — existing callers score exactly as before", off.confidence === "none", off.confidence);
  const alone = matchConversation({ clients, companyId: CO, contact: { name: "Marie Tremblai" } });
  ok("a misspelled name ALONE is only `possible`", alone.confidence === "possible" && !alone.client && alone.reasons.includes("name_similar"), alone);
  const withAddr = matchConversation({ clients, companyId: CO, contact: { name: "Marie Tremblai", address: "12 elm st, ottawa K1A0B1" } });
  ok("a misspelled name PLUS an agreeing address is `likely` and links", withAddr.confidence === "likely" && withAddr.client?.id === "c1" && withAddr.reasons.includes("address"), withAddr);

  const quotes = [{ id: "q1", clientId: "c1", status: "accepted", createdAt: day(3), total: 4200, quoteNumber: "Q-0123", siteAddress: null }];
  const v1 = verifyConversion({ conversation: { id: "t", source: "meta_messenger", startedAt: day(0) }, contact: { name: "Marie Tremblai" }, clients, quotes, companyId: CO });
  ok("name-only → status possible, NOT countable", v1.status === "possible" && v1.countable === false, v1);
  ok("…and the possible quote is shown for a person to check", v1.possible?.quote?.number === "Q-0123", v1.possible);
}

// ════════════════════════════════════════════════════════════════════════════
section("3. An address written two ways");
// ════════════════════════════════════════════════════════════════════════════
{
  const a = addressKey("12 Elm Street, Ottawa, ON K1A 0B1");
  const b = addressKey("12 elm st k1a0b1");
  ok("'12 Elm Street, Ottawa, ON K1A 0B1' agrees with '12 elm st k1a0b1'", addressAgreement(a, b) === "agree", { a, b });
  ok("a different house number on the same street disagrees", addressAgreement(addressKey("14 Elm St"), addressKey("12 Elm Street")) === "disagree");

  // The address in a chat is where the WORK is. Matched against the quote's
  // site, it is evidence; against a different home address, it is NOT a conflict.
  const clients = [{ id: "c1", companyId: CO, name: "Paul Gagnon", email: null, phone: null, address: "99 Home Rd", city: "Gatineau", province: "QC", createdAt: day(-50) }];
  const quotes = [{ id: "q1", clientId: "c1", status: "sent", createdAt: day(2), total: 900, quoteNumber: "Q-7", siteAddress: "12 Elm Street, Ottawa" }];
  const m = matchConversation({ clients, quotes, companyId: CO, contact: { name: "Paul Gagnon", address: "12 elm st" } });
  ok("name + the quote's SITE address is `likely`, with the record named", m.confidence === "likely" && m.addressOn.some((x) => x.type === "quote" && x.id === "q1"), m);
  ok("…and the client's different HOME address is not counted as a conflict", !(m.conflicts || []).includes("address"), m.conflicts);
  const onlyAddr = matchConversation({ clients, quotes, companyId: CO, contact: { address: "12 Elm St" } });
  ok("an address with no name, phone or email is only `possible`", onlyAddr.confidence === "possible" && !onlyAddr.client, onlyAddr);
}

// ════════════════════════════════════════════════════════════════════════════
section("4. One phone shared by two clients");
// ════════════════════════════════════════════════════════════════════════════
{
  const clients = [
    { id: "c1", companyId: CO, name: "Jean Roy", email: null, phone: "613-555-0100", address: "5 Oak Ave", city: "Ottawa", province: "ON", createdAt: day(-300) },
    { id: "c2", companyId: CO, name: "Lise Roy", email: null, phone: "(613) 555-0100", address: "88 Pine Rd", city: "Ottawa", province: "ON", createdAt: day(-200) },
  ];
  const quotes = [
    { id: "q1", clientId: "c1", status: "accepted", createdAt: day(5), total: 1000, quoteNumber: "Q-1", siteAddress: null },
    { id: "q2", clientId: "c2", status: "accepted", createdAt: day(5), total: 2000, quoteNumber: "Q-2", siteAddress: null },
  ];
  const conversation = { id: "t", source: "meta_messenger", startedAt: day(0) };
  const tie = verifyConversion({ conversation, contact: { phone: "6135550100" }, clients, quotes, companyId: CO });
  ok("phone alone, two clients → a tie → possible, never counted", tie.status === "possible" && tie.ambiguous && !tie.countable && !tie.clientId, tie);
  const byAddr = verifyConversion({ conversation, contact: { phone: "6135550100", address: "88 Pine Road" }, clients, quotes, companyId: CO });
  ok("phone + an address that agrees with ONE of them → that one, confirmed", byAddr.status === "confirmed" && byAddr.clientId === "c2" && byAddr.tieBrokenBy === "address" && byAddr.quote?.id === "q2", byAddr);
  const byName = verifyConversion({ conversation, contact: { phone: "6135550100", name: "Lise Roy" }, clients, quotes, companyId: CO });
  ok("phone + a name that agrees with one → that one, confirmed", byName.status === "confirmed" && byName.clientId === "c2", byName);
  const both = verifyConversion({ conversation, contact: { phone: "6135550100", address: "1 Elsewhere St" }, clients, quotes, companyId: CO });
  ok("phone + an address agreeing with NEITHER → the tie stands", both.status === "possible" && both.ambiguous, both);
}

// ════════════════════════════════════════════════════════════════════════════
section("5. A lead-ad lead, then a message from the same person — no duplicate");
// ════════════════════════════════════════════════════════════════════════════
{
  const formLead = { id: "L_form", companyId: CO, name: "Marie Tremblay", email: "marie@example.com", phone: "+16135550142", categoryId: null, timeline: null, intake: { roofType: "shingles" }, source: "meta_lead_form", status: "new", createdAt: day(-3), metaCampaignId: "CAMP_FORM", metaCampaignName: "Spring roofs", conversationEvidence: null };
  const thread = {
    id: "T1", companyId: CO, leadId: null, participantName: "Marie Tremblay", participantExternalId: "PSID1", routingIntent: null, adReferral: null, leadCapture: null, createdAt: day(0),
    channel: { platform: "facebook" },
    // Newest first, as the query returns them.
    messages: [
      msg("m3", "in", "it's 12 Elm Street, Ottawa"),
      msg("m2", "out", "Thanks! What's the address?"),
      msg("m1", "in", "Hi I filled in your form, my number is (613) 555-0142, I need the roof redone asap"),
    ],
  };
  const db = fakeDb({ thread, leads: [formLead], services: [{ id: "svc_roof", label: "Roofing" }] });
  const { deps, created } = depsFor(db, {
    ai: () => ({ ...AI_NONE, kind: "work_request", summary: "Roof replacement", address: field("12 Elm Street, Ottawa", 3), serviceId: "svc_roof", serviceMessage: 1, timeline: "asap", timelineMessage: 1 }),
  });
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "T1", prisma: db, deps, now: day(0) });
  ok("no second lead is created", created.length === 0 && r.leadId === "L_form", { created, r });
  const lead = db.state.leads.find((l) => l.id === "L_form");
  ok("the form lead is enriched with what the conversation added: address, service, timeline", lead.intake?.address === "12 Elm Street, Ottawa" && lead.categoryId === "svc_roof" && lead.timeline === "asap", lead);
  ok("…the form's own intake answers survive", lead.intake?.roofType === "shingles", lead.intake);
  ok("…the form's phone, email and name were not touched", lead.phone === "+16135550142" && lead.email === "marie@example.com" && lead.name === "Marie Tremblay", lead);
  ok("…the form's campaign is kept", lead.metaCampaignId === "CAMP_FORM", lead.metaCampaignId);
  ok("…each written field carries the message it came from", lead.conversationEvidence?.fields?.address?.messageId === "m3" && lead.conversationEvidence?.fields?.service?.messageId === "m1", lead.conversationEvidence?.fields);
  ok("…and the thread is linked to the lead", db.state.thread.leadId === "L_form", db.state.thread.leadId);

  // The realistic case: on Messenger they never type their number — but the
  // Facebook profile name is the one Meta pre-filled the form with.
  const quiet = { ...thread, id: "T2", messages: [msg("q1", "in", "Hi, I sent the form about my roof, when can you come?")] };
  const db2 = fakeDb({ thread: quiet, leads: [formLead] });
  const d2 = depsFor(db2, { ai: () => ({ ...AI_NONE, kind: "work_request", summary: "Roof" }) });
  const r2 = await captureLeadFromConversation({ companyId: CO, threadId: "T2", prisma: db2, deps: d2.deps, now: day(0) });
  ok("same Facebook name as a form lead within the window → joined, not duplicated", d2.created.length === 0 && r2.leadId === "L_form", r2);
  ok("…and the evidence says it was joined on name and timing", (db2.state.leads[0].conversationEvidence?.joinedOn || []).includes("profile_name"), db2.state.leads[0].conversationEvidence?.joinedOn);

  const old = { ...formLead, createdAt: day(-(LEAD_AD_JOIN_DAYS + 5)) };
  const db3 = fakeDb({ thread: quiet, leads: [old] });
  const d3 = depsFor(db3, { ai: () => ({ ...AI_NONE, kind: "work_request" }) });
  await captureLeadFromConversation({ companyId: CO, threadId: "T2", prisma: db3, deps: d3.deps, now: day(0) });
  ok("a same-name form lead OUTSIDE the window is not joined on name alone", d3.created.length === 1, d3.created.length);

  const twin = { ...formLead, id: "L_twin", phone: "+16135559999", email: "other@example.com" };
  const dup = findDuplicateLead({ leads: [twin], companyId: CO, contact: { phone: "6135550142" }, participantName: "Marie Tremblay", threadStartedAt: day(0) });
  ok("a same-name form lead whose phone DISAGREES is not joined", dup.lead === null, dup);
  const other = findDuplicateLead({ leads: [{ ...formLead, companyId: OTHER }], companyId: CO, contact: { phone: "6135550142" } });
  ok("another company's lead is never a duplicate", other.lead === null, other);
}

// ════════════════════════════════════════════════════════════════════════════
section("6. Spam makes no lead");
// ════════════════════════════════════════════════════════════════════════════
{
  const thread = { id: "T6", companyId: CO, leadId: null, participantName: "Meta Support Team", participantExternalId: "PSID6", routingIntent: null, adReferral: null, leadCapture: null, createdAt: day(0), channel: { platform: "instagram" }, messages: [msg("s1", "in", "Your page will be disabled in 24h. Verify now at http://meta-verify.example and call +1 613 555 0199")] };
  const db = fakeDb({ thread });
  const d = depsFor(db, { ai: () => ({ ...AI_NONE, kind: "spam" }) });
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "T6", prisma: db, deps: d.deps, now: day(0) });
  ok("no lead is created for spam", d.created.length === 0 && !r.leadId, r);
  // Since 2026-10-05 the rules recognise this one for free (lib/leads/
  // qualification.js — "your page will be…"), so the model is never paid to.
  ok("the verdict is kept on the thread — by the rules, with no model read", db.state.thread.leadCapture?.kind === "spam" && db.state.thread.leadCapture.aiRuns === 0 && db.state.thread.leadCapture.qualification?.tier === "not_relevant", db.state.thread.leadCapture);
  const again = aiRunDecision({ capture: db.state.thread.leadCapture, signature: ["phone:+16135550100"], inboundChars: 200, inboundCount: 5 });
  ok("…and spam is never read again, even when a 'new' number appears", again.run === false && again.why === "spam", again);
}

// ════════════════════════════════════════════════════════════════════════════
section("7. An existing customer's complaint makes no lead");
// ════════════════════════════════════════════════════════════════════════════
{
  const openLead = { id: "L7", companyId: CO, name: "Bob Lee", email: null, phone: "613-555-0177", categoryId: null, timeline: null, intake: null, source: "self_quote", status: "new", createdAt: day(-10), metaCampaignId: null, conversationEvidence: null };
  const thread = { id: "T7", companyId: CO, leadId: null, participantName: "Bob Lee", participantExternalId: "PSID7", routingIntent: "problem", adReferral: null, leadCapture: null, createdAt: day(0), channel: { platform: "facebook" }, messages: [msg("c1", "in", "The deck you stained last month is already peeling. Call me 613-555-0177")] };
  const db = fakeDb({ thread, leads: [openLead] });
  const d = depsFor(db, { ai: () => ({ ...AI_NONE, kind: "existing_customer_issue", phone: field("613-555-0177", 1) }) });
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "T7", prisma: db, deps: d.deps, now: day(0) });
  ok("no lead is created for a complaint about finished work", d.created.length === 0, d.created);
  ok("…and the open lead that shares the phone is NOT touched", !db.writes.some(([k]) => k === "leadRequest.update") && !r.leadId, db.writes.map((w) => w[0]));
  ok("the front desk's `problem` alone never counts as wanting work", decideKind({ routingIntent: "problem" }).kind === null);
  ok("…while `price` and `book` do, labelled as the front desk's", decideKind({ routingIntent: "price" }).kind === "work_request" && decideKind({ routingIntent: "book" }).method === "front_desk");
  ok("an earlier MODEL verdict outranks the front desk", decideKind({ routingIntent: "price", capture: { kind: "not_work", kindMethod: "ai" } }).kind === "not_work");
}

// ════════════════════════════════════════════════════════════════════════════
section("8. A field a person edited is never overwritten");
// ════════════════════════════════════════════════════════════════════════════
{
  const staffLead = { id: "L8", companyId: CO, name: "M. Tremblay (call after 5)", email: null, phone: "613-555-9999", categoryId: "svc_paint", timeline: null, intake: { address: "1 Staff Typed Ave" }, source: "meta_messenger", status: "contacted", createdAt: day(-1), metaCampaignId: null, conversationEvidence: { fields: { name: { value: "Marie Tremblay", method: "profile" } } } };
  const thread = { id: "T8", companyId: CO, leadId: "L8", participantName: "Marie Tremblay", participantExternalId: "PSID8", routingIntent: null, adReferral: null, leadCapture: { kind: "work_request", kindMethod: "ai", aiRuns: 1, contactsSeen: [] }, createdAt: day(-1), channel: { platform: "facebook" }, messages: [msg("e2", "in", "I'm Marie Tremblay, call 613-555-0142, it's 12 Elm St. Also email marie@example.com")] };
  const db = fakeDb({ thread, leads: [staffLead], services: [{ id: "svc_roof", label: "Roofing" }] });
  const d = depsFor(db, { ai: () => ({ ...AI_NONE, kind: "work_request", name: field("Marie Tremblay", 1), serviceId: "svc_roof", serviceMessage: 1 }) });
  await captureLeadFromConversation({ companyId: CO, threadId: "T8", prisma: db, deps: d.deps, now: day(0) });
  const lead = db.state.leads[0];
  ok("the phone staff typed stays", lead.phone === "613-555-9999", lead.phone);
  ok("the name staff edited stays (it is no longer the profile name we wrote)", lead.name === "M. Tremblay (call after 5)", lead.name);
  ok("the address staff typed stays", lead.intake.address === "1 Staff Typed Ave", lead.intake);
  ok("the service staff picked stays", lead.categoryId === "svc_paint", lead.categoryId);
  ok("an EMPTY column is filled (email)", lead.email === "marie@example.com", lead.email);
  const skipped = (lead.conversationEvidence?.skipped || []).map((s) => s.field).sort();
  ok("what was not written is recorded, with what was kept", JSON.stringify(skipped) === JSON.stringify(["address", "name", "phone", "service"]) && lead.conversationEvidence.skipped.find((s) => s.field === "phone").kept === "613-555-9999", lead.conversationEvidence?.skipped);

  // Our OWN earlier value may be improved on: a profile name nobody edited
  // gives way to the name they typed.
  const plan = planLeadWrite({ lead: { name: "Marie T" }, fields: { name: { value: "Marie Tremblay" } }, previous: { name: { value: "Marie T", method: "profile" } } });
  ok("a value this file wrote, untouched since, may be replaced by a better reading", plan.data.name === "Marie Tremblay" && plan.written.includes("name"), plan);
  const keep = planLeadWrite({ lead: { phone: "" }, fields: { phone: { value: "613-555-0142" } } });
  ok("an empty-string column counts as empty", keep.data.phone === "613-555-0142", keep);
}

// ════════════════════════════════════════════════════════════════════════════
section("9. The model is a witness, not an author");
// ════════════════════════════════════════════════════════════════════════════
{
  const messages = [
    msg("a", "in", "hi, I need my fence painted"),
    msg("b", "out", "Sure, I'm Dave, call me at 613-555-1111"),
    msg("c", "in", "great, I'm Ana Silva, 22 Birch Cres"),
    msg("p", "out", "internal: same street as the Lopez job", { private: true }),
  ];
  const { index, text } = buildTranscript(messages);
  ok("a private note never reaches the transcript", !/Lopez/.test(text) && index.size === 3, text);
  const lied = verifyExtraction(
    {
      kind: "work_request", reason: "x", summary: "Paint a fence",
      name: field("Ana Silva", 3),
      phone: field("613-555-1111", 2), // the CONTRACTOR's message
      email: field("ana@example.com", 3), // never said
      address: field("22 Birch Crescent, Ottawa", 3), // completed by the model
      area: field(null, null),
      serviceId: "svc_invented", serviceMessage: 1,
      timeline: "asap", timelineMessage: 99,
    },
    index,
    [{ id: "svc_paint", label: "Painting" }],
  );
  ok("a name the customer typed is kept, with its message", lied.fields.name?.value === "Ana Silva" && lied.fields.name.message.id === "c", lied.fields.name);
  ok("a phone from a BUSINESS message is refused", !lied.fields.phone && lied.refused.some((r) => r.field === "phone" && r.why === "not_from_customer_message"), lied.refused);
  ok("an email nobody wrote is refused", !lied.fields.email && lied.refused.some((r) => r.field === "email"), lied.refused);
  ok("an address the model completed ('Crescent, Ottawa') is refused", !lied.fields.address, lied.fields.address);
  ok("a service that is not the company's own is refused", !lied.fields.service && lied.refused.some((r) => r.field === "service"), lied.refused);
  ok("a timeline citing a message that does not exist keeps the key but no evidence", lied.fields.timeline?.value === "asap" && lied.fields.timeline.message === null, lied.fields.timeline);
  ok("an unknown kind becomes `undetermined`, never a lead", verifyExtraction({ kind: "definitely_a_lead" }, index, []).kind === "undetermined");
  ok("phones compare on digits — '613 555 0142' is in '(613) 555-0142'", appearsIn("613 555 0142", "call (613) 555-0142", "phone"));

  const f = buildFieldEvidence({ det: {}, ai: { ok: false }, participantName: "Ana S." });
  ok("with no typed name, the profile name stands in and says so", f.name?.value === "Ana S." && f.name.method === "profile" && f.name.messageId === null, f.name);
  ok("…and nothing else is invented", Object.keys(f).join() === "name", Object.keys(f));

  const schema = extractionSchema(["svc_paint"]);
  ok("the schema passes the strict-output lint", assertStrictSchema(schema).ok, assertStrictSchema(schema).errors);
  ok("the schema declares no money field", !/(price|total|amount|cost|subtotal|deposit|dollars|cents|margin|rate)/i.test(JSON.stringify(schema)));
  ok("every kind is in the closed list", JSON.stringify(schema.properties.kind.enum) === JSON.stringify(CONVERSATION_KINDS));
}

// ════════════════════════════════════════════════════════════════════════════
section("10. The cost rule, the meter and the tenant");
// ════════════════════════════════════════════════════════════════════════════
{
  ok("'hi' is not worth a model call", aiRunDecision({ inboundChars: 2, inboundCount: 1 }).run === false);
  ok(`${MIN_TEXT_FOR_AI}+ characters of customer text is: the first read`, aiRunDecision({ inboundChars: MIN_TEXT_FOR_AI, inboundCount: 1 }).why === "first_read");
  ok("still undetermined → read again on the NEXT customer message", aiRunDecision({ capture: { kind: "undetermined", aiRuns: 1, inboundAtRun: 1 }, inboundCount: 2 }).run === true);
  ok("…but not on an outbound message (no new customer text)", aiRunDecision({ capture: { kind: "undetermined", aiRuns: 1, inboundAtRun: 2 }, inboundCount: 2 }).run === false);
  const seen = { kind: "work_request", aiRuns: 1, contactsSeen: ["phone:+16135550142"] };
  ok("a work request is NOT re-read on a message with nothing new", aiRunDecision({ capture: seen, signature: ["phone:+16135550142"], inboundCount: 4 }).run === false);
  ok("…and IS re-read when a new contact detail appears", aiRunDecision({ capture: seen, signature: ["email:a@b.co", "phone:+16135550142"], inboundCount: 4 }).why === "new_contact_details");
  ok(`never more than ${MAX_AI_RUNS_PER_THREAD} reads per conversation`, aiRunDecision({ capture: { ...seen, aiRuns: MAX_AI_RUNS_PER_THREAD }, signature: ["email:new@x.co"] }).why === "cap_reached");
  ok("no key, no call", aiRunDecision({ inboundChars: 100, aiConfigured: false }).run === false);

  ok("the feature is registered, wired, and paid from the company's AI credit", PAYER_FEATURES.some((f) => f.feature === AI_FEATURE && f.wired && f.defaultPayer === "company") && companyLedgerFor(AI_FEATURE) === "wallet");
  ok("its debit lands in the AI wallet, not the voice wallet", poolForKind(AI_FEATURE) === POOLS.AI);
  ok("it has a pre-call estimate on the standard tier", WALLET_ESTIMATES[AI_FEATURE]?.tier === "standard" && estimateChargeCents(AI_FEATURE) >= 1, estimateChargeCents(AI_FEATURE));

  // The real extraction, metered: a refused gate spends nothing.
  let completed = 0;
  const refused = await extractConversationLead({
    companyId: CO, threadId: "T", messages: [msg("x", "in", "I need a new roof please")],
    deps: { meterFor: async () => ({ check: async () => ({ allowed: false, code: "no_credit" }), record: async () => null }), complete: async () => { completed += 1; return { ok: true, data: {} }; } },
  });
  ok("no AI credit → the model is never called, and the answer says why", refused.ok === false && refused.reason === "no_credit" && completed === 0, refused);
  let recorded = null;
  const metered = await extractConversationLead({
    companyId: CO, threadId: "T", run: 2, messages: [msg("x", "in", "I need a new roof please")],
    deps: {
      meterFor: async () => ({ check: async () => ({ allowed: true }), record: async (u, o) => { recorded = { u, o }; } }),
      complete: async ({ onUsage }) => { await onUsage({ model: "gpt-5-mini", promptTokens: 900, completionTokens: 300 }); return { ok: true, data: { ...AI_NONE, kind: "work_request" } }; },
    },
  });
  ok("a call that ran is recorded once, keyed to the thread and the run", metered.ok && recorded?.o?.ref === `${AI_FEATURE}:T:2`, recorded);

  // Every query the capture made carried the tenant.
  const thread = { id: "T10", companyId: CO, leadId: null, participantName: "Zoe Park", participantExternalId: "P10", routingIntent: null, adReferral: { adId: "120000000001", adTitle: "Deck staining" }, leadCapture: null, createdAt: day(0), channel: { platform: "instagram" }, messages: [msg("z1", "in", "How much to stain a 300 sq ft deck? I'm at zoe@example.com")] };
  const db = fakeDb({ thread, services: [{ id: "svc_deck", label: "Deck staining" }] });
  const d = depsFor(db, { ai: () => ({ ...AI_NONE, kind: "work_request", summary: "Stain a 300 sq ft deck", serviceId: "svc_deck", serviceMessage: 1 }), campaign: { campaignId: "CAMP_DECK", campaignName: "Deck season" } });
  const r = await captureLeadFromConversation({ companyId: CO, threadId: "T10", prisma: db, deps: d.deps, now: day(0) });
  ok("a work request with nobody on file creates ONE lead through the shared creator", d.created.length === 1 && r.created && d.created[0].source === "meta_instagram", d.created);
  ok("…named from the profile (they never typed a name), with the email they typed", d.created[0].name === "Zoe Park" && d.created[0].email === "zoe@example.com", d.created[0]);
  ok("…its `message` is the customer's own words, not the model's summary", /How much to stain/.test(d.created[0].message), d.created[0].message);
  const made = db.state.leads[0];
  ok("the click-to-message ad is resolved to its campaign and stamped on the lead", made.metaCampaignId === "CAMP_DECK" && made.metaCampaignName === "Deck season", made);
  ok("…the campaign lookup was asked for OUR company and the thread's stored ad id", d.campaignAsks.length === 1 && d.campaignAsks[0].companyId === CO && d.campaignAsks[0].adId === "120000000001", d.campaignAsks);
  ok("…and the lead's evidence names the ad", made.conversationEvidence?.campaign?.adTitle === "Deck staining", made.conversationEvidence?.campaign);
  ok("every read and write carried companyId (or targeted a row the capture had just proved)", db.calls.every(([k, w]) => k === "leadRequest.update" || k === "messageThread.update" || w?.companyId === CO), db.calls.filter(([k, w]) => w?.companyId !== CO));
  const foreign = await captureLeadFromConversation({ companyId: OTHER, threadId: "T10", prisma: fakeDb({ thread }), deps: d.deps });
  ok("another company cannot reach this thread", foreign.acted === false && foreign.reason === "unknown_thread", foreign);
  const web = fakeDb({ thread: { ...thread, id: "T11", channel: { platform: "web" } } });
  ok("FieldQuo's own web chat is not a Meta conversation and is left alone", (await captureLeadFromConversation({ companyId: CO, threadId: "T11", prisma: web, deps: d.deps })).reason === "not_a_meta_conversation");
}

// ════════════════════════════════════════════════════════════════════════════
section("11. Meta's click-to-message referral is kept");
// ════════════════════════════════════════════════════════════════════════════
{
  const body = {
    object: "page",
    entry: [{
      id: "PAGE1",
      messaging: [
        { sender: { id: "U1" }, recipient: { id: "PAGE1" }, timestamp: 1, message: { mid: "m.1", text: "Hi", referral: { ad_id: "120000000001", source: "ADS", type: "OPEN_THREAD", ads_context_data: { ad_title: "Deck staining" } } } },
        { sender: { id: "U2" }, recipient: { id: "PAGE1" }, timestamp: 2, referral: { ad_id: "120000000002", source: "ADS", type: "OPEN_THREAD" } },
        { sender: { id: "U3" }, recipient: { id: "PAGE1" }, timestamp: 3, postback: { title: "Get Started", referral: { ad_id: "120000000003", source: "ADS" } } },
        { sender: { id: "PAGE1" }, recipient: { id: "U1" }, timestamp: 4, message: { mid: "m.2", text: "Hello!", is_echo: true, referral: { ad_id: "999" } } },
        { sender: { id: "U4" }, recipient: { id: "PAGE1" }, timestamp: 5, postback: { title: "Menu", payload: "X" } },
      ],
    }],
  };
  const parsed = parseMessagingEnvelope(body);
  const [m1, ref2, ref3, echo] = parsed.events;
  ok("an ad id inside the first message is kept on the message event", m1.kind === "message" && m1.referral?.adId === "120000000001" && m1.referral.adTitle === "Deck staining", m1.referral);
  ok("a standalone messaging_referrals event becomes a `referral` event", ref2.kind === "referral" && ref2.referral.adId === "120000000002", ref2);
  ok("a Get Started postback's referral is kept too", ref3.kind === "referral" && ref3.referral.adId === "120000000003", ref3);
  ok("an echo (the Page talking) never carries a referral", echo.kind === "message" && echo.direction === "out" && echo.referral === null, echo);
  ok("a postback with no ad is still dropped and counted", parsed.dropped === 1 && parsed.events.length === 4, parsed);
  ok("a non-numeric ad id is refused", cleanReferral({ adId: "<script>", source: null }) === null);

  const wa = parseWhatsAppEnvelope({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: { metadata: { phone_number_id: "PN1" }, contacts: [{ wa_id: "16135550142", profile: { name: "Ana" } }], messages: [{ id: "wamid.1", from: "16135550142", timestamp: "1700000000", type: "text", text: { body: "Hi from your ad" }, referral: { source_type: "ad", source_id: "120000000009", headline: "Fence painting" } }] } }] }],
  });
  const w = wa.events.find((e) => e.kind === "message");
  ok("a click-to-WhatsApp ad maps onto the same shape", w?.referral?.adId === "120000000009" && w.referral.adTitle === "Fence painting", w?.referral);
}

// ════════════════════════════════════════════════════════════════════════════
section("12. Conversion: recorded beats inferred, possible is never counted, money is what was paid");
// ════════════════════════════════════════════════════════════════════════════
{
  const clients = [{ id: "c1", companyId: CO, name: "Ana Silva", email: "ana@example.com", phone: null, address: null, createdAt: day(-5) }];
  const quotes = [
    { id: "q_old", clientId: "c1", status: "accepted", createdAt: day(-2), total: 500, quoteNumber: "Q-OLD" },
    { id: "q_new", clientId: "c1", status: "accepted", createdAt: day(4), total: 3000, acceptedTotal: 2800, quoteNumber: "Q-0123" },
  ];
  const jobs = [{ id: "j1", quoteId: "q_new", clientId: "c1", status: "completed" }];
  const invoices = [
    { id: "i1", quoteId: "q_new", jobId: "j1", total: 2800, amountPaid: 1000, status: "sent", invoiceNumber: "INV-45", parentInvoiceId: null, version: 1 },
    { id: "i1v2", quoteId: "q_new", jobId: "j1", total: 2800, amountPaid: 2800, status: "paid", invoiceNumber: "INV-45", parentInvoiceId: "i1", version: 2 },
  ];
  const v = verifyConversion({ conversation: { id: "t", source: "meta_messenger", startedAt: day(0) }, contact: { email: "ANA@example.com" }, clients, quotes, jobs, invoices, companyId: CO });
  ok("an exact email → confirmed, won, on the quote that FOLLOWED the conversation", v.status === "confirmed" && v.outcome === "won" && v.quote?.number === "Q-0123", v);
  ok("…the quote raised before the conversation is not credited to it", v.quote?.id !== "q_old");
  ok("…the paid figure is the LATEST invoice version's, counted once", v.invoices?.paid === 2800 && v.invoices.fullyPaid && v.invoices.count === 1, v.invoices);
  ok("…and it is countable", v.countable === true);
  const rec = verifyConversion({ conversation: { id: "t", startedAt: day(0), quoteId: "q_old" }, contact: { name: "Nobody Atall" }, clients, quotes, jobs, invoices, companyId: CO });
  ok("a recorded link wins over every inference, even with no contact match", rec.status === "confirmed" && rec.quote?.id === "q_old" && rec.matchedOn[0] === "recorded_link", rec);
  const shaped = shapeConversion(v, { quotes: true, jobs: true, invoices: false, money: false });
  ok("the drawer's shape hides invoices from a member without the invoices dial", shaped.invoices?.restricted === true && shaped.quote?.total === undefined, shaped);
  ok("verifyConversion refuses to run without a tenant", (() => { try { verifyConversion({}); return false; } catch { return true; } })());
}

// ════════════════════════════════════════════════════════════════════════════
section("13. Revenue by campaign counts confirmed inferences apart, and paid money");
// ════════════════════════════════════════════════════════════════════════════
{
  const r = buildCampaignRollup({
    spendRows: [],
    leads: [
      { id: "l1", metaCampaignId: "A", metaCampaignName: "Decks", quoteId: "q1", source: "meta_lead_form" },
      { id: "l2", metaCampaignId: "A", metaCampaignName: "Decks", quoteId: null, inferredQuoteId: "q2", source: "meta_messenger" },
      { id: "l3", metaCampaignId: "A", metaCampaignName: "Decks", quoteId: null, source: "meta_instagram" },
    ],
    jobs: [{ id: "j1", quoteId: "q1" }, { id: "j2", quoteId: "q2" }],
    invoices: [
      { id: "i1", parentInvoiceId: null, version: 1, total: 1000, amountPaid: 1000, jobId: "j1", quoteId: "q1" },
      { id: "i2", parentInvoiceId: null, version: 1, total: 2000, amountPaid: 500, jobId: "j2", quoteId: "q2" },
    ],
    companyCurrency: "CAD",
    asOf: day(0),
  });
  const A = r.campaigns.find((c) => c.campaignId === "A");
  ok("three leads, two from conversations", A.leads === 3 && A.conversationLeads === 2, A);
  ok("two quotes, ONE of them inferred — and said so", A.quotes === 2 && A.inferredQuotes === 1, A);
  ok("invoiced 3000, paid 1500 — paid is what was collected", A.revenue === 3000 && A.paid === 1500, A);
  ok("totals carry both", r.totals.inferredQuotes === 1 && r.totals.paid === 1500, r.totals);
  const none = buildCampaignRollup({ spendRows: [], leads: [{ id: "x", metaCampaignId: "B", quoteId: null }], jobs: [], invoices: [], companyCurrency: "CAD", asOf: day(0) });
  ok("nothing invoiced → paid is null, never 0", none.campaigns[0].paid === null && none.totals.paid === null, none.campaigns[0]);
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
