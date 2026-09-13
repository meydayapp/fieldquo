// scripts/check-resend-inbound.mjs
//
//   npm run check:resend-inbound
//
// The Resend Receiving door is a public URL that writes to the database and
// sends mail, and every rule that keeps it safe is a property of EXECUTION:
//
//   - the signature check accepts Svix's own published vector and refuses a
//     body, id or timestamp altered by one byte;
//   - an unset secret DENIES — never a comparison that cannot fail;
//   - a received email maps onto the documented inbound contract with the
//     sender in `from` and nowhere else, so a token in the From files nowhere;
//   - a redelivered event forwards nothing a second time;
//   - the forwarded copy says what happened, and a file it could not carry
//     is named rather than dropped.
//
// lib/sales/resendInbound.js is pure and lib/sales/resendInboundDoor.js takes
// every dependency as a parameter, so all of that runs here, against fakes,
// with no database and no network. The last section reads source for the one
// thing that cannot be executed without next/server: that the route verifies
// before it parses.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  RECEIVED_EVENT,
  attachmentsNote,
  forwardBodies,
  forwardHeaderLine,
  isResendEmailId,
  readReceivedEvent,
  receivedEmailToContract,
  replyDomainLocalPart,
  signResendWebhook,
  verifyResendWebhook,
} from "@/lib/sales/resendInbound";
import { processReceivedEvent } from "@/lib/sales/resendInboundDoor";
import {
  attachmentTypeFor,
  isResendDownloadUrl,
  rehostInboundAttachments,
} from "@/lib/sales/inboundAttachments";
import { newReplyToken, parseInboundEmail, replyToAddress } from "@/lib/sales/outreach";
import { outreachReadiness } from "@/lib/sales/outreachReadiness";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function read(relative) {
  return stripComments(readFileSync(join(ROOT, relative), "utf8"));
}
function functionBody(src, name) {
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return null;
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Signature — Svix's published vector, then every way to tamper");

// From docs.svix.com/receiving/verifying-payloads/how-manual, verbatim.
const VECTOR = {
  secret: "whsec_plJ3nmyCDGBKInavdOK15jsl",
  payload: '{"event_type":"ping","data":{"success":true}}',
  id: "msg_loFOjxBNrRLzqYUf",
  timestamp: "1731705121",
  signature: "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
};
const AT = Number(VECTOR.timestamp);
const headers = (over = {}) => ({
  id: VECTOR.id,
  timestamp: VECTOR.timestamp,
  signature: VECTOR.signature,
  ...over,
});

ok(
  "our HMAC reproduces Svix's reference signature byte for byte",
  signResendWebhook({ id: VECTOR.id, timestamp: VECTOR.timestamp, body: VECTOR.payload }, VECTOR.secret) ===
    VECTOR.signature.slice(3),
);
ok("the reference request verifies", verifyResendWebhook(headers(), VECTOR.payload, VECTOR.secret, AT).ok);
ok(
  "...within the tolerance window on either side",
  verifyResendWebhook(headers(), VECTOR.payload, VECTOR.secret, AT + 299).ok &&
    verifyResendWebhook(headers(), VECTOR.payload, VECTOR.secret, AT - 299).ok,
);
{
  const v = verifyResendWebhook(headers(), VECTOR.payload, VECTOR.secret, AT + 301);
  ok("a replay outside the window is refused as stale", !v.ok && v.reason === "stale", v);
}
{
  const v = verifyResendWebhook(headers(), VECTOR.payload + " ", VECTOR.secret, AT);
  ok("one added byte in the body → mismatch", !v.ok && v.reason === "mismatch", v);
}
{
  const reserialised = JSON.stringify(JSON.parse(VECTOR.payload), null, 2);
  const v = verifyResendWebhook(headers(), reserialised, VECTOR.secret, AT);
  ok("a parsed-and-reserialised body does NOT verify (the route must use the raw text)", !v.ok, v);
}
ok("a changed id → mismatch", !verifyResendWebhook(headers({ id: "msg_other" }), VECTOR.payload, VECTOR.secret, AT).ok);
ok(
  "a changed timestamp → mismatch (even inside the window)",
  !verifyResendWebhook(headers({ timestamp: String(AT + 1) }), VECTOR.payload, VECTOR.secret, AT).ok,
);
ok("a wrong secret → mismatch", !verifyResendWebhook(headers(), VECTOR.payload, "whsec_" + Buffer.from("nope").toString("base64"), AT).ok);
ok(
  "the same secret without the whsec_ prefix still verifies (Resend shows it both ways)",
  verifyResendWebhook(headers(), VECTOR.payload, VECTOR.secret.slice(6), AT).ok,
);
ok(
  "a rotation header carrying an old and a new signature verifies on the matching one",
  verifyResendWebhook(headers({ signature: `v1,AAAA ${VECTOR.signature}` }), VECTOR.payload, VECTOR.secret, AT).ok,
);
ok("a v2 signature alone is not accepted as v1", !verifyResendWebhook(headers({ signature: VECTOR.signature.replace("v1,", "v2,") }), VECTOR.payload, VECTOR.secret, AT).ok);
for (const missing of ["id", "timestamp", "signature"]) {
  const v = verifyResendWebhook(headers({ [missing]: null }), VECTOR.payload, VECTOR.secret, AT);
  ok(`a missing ${missing} header is refused`, !v.ok && v.reason === "missing", v);
}
ok("a non-numeric timestamp is refused", !verifyResendWebhook(headers({ timestamp: "now" }), VECTOR.payload, VECTOR.secret, AT).ok);

// ═══════════════════════════════════════════════════════════════════════════
section("2. An unset secret DENIES — lib/security/cronAuth.js's bug, from both sides");

for (const unset of [undefined, null, "", 0, false, "   "]) {
  const v = verifyResendWebhook(headers(), VECTOR.payload, unset, AT);
  ok(`secret ${JSON.stringify(unset)} → unconfigured, not a comparison`, !v.ok && v.reason === "unconfigured", v);
}
ok(
  "...even when the signature header is what an empty key would produce",
  !verifyResendWebhook(headers({ signature: "v1," + signResendWebhook({ id: VECTOR.id, timestamp: VECTOR.timestamp, body: VECTOR.payload }, "whsec_AA==") }), VECTOR.payload, undefined, AT).ok,
);
ok("signing with no secret produces nothing to compare against", signResendWebhook({ id: "a", timestamp: "1", body: "{}" }, undefined) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The event, and the email → contract mapping");

const token = newReplyToken();
const EMAIL_ID = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";

// The shape from resend.com/docs/webhooks/emails/received, with our addresses.
const EVENT = {
  type: "email.received",
  created_at: "2026-09-13T10:00:00.000Z",
  data: {
    email_id: EMAIL_ID,
    created_at: "2026-09-13T09:59:59.000Z",
    from: "dana@acme.com",
    to: [`emilio+${token}@reply.fieldquo.com`],
    bcc: [],
    cc: [],
    received_for: [],
    message_id: "<abc-123@acme.com>",
    subject: "Re: quick question about your quotes",
    attachments: [{ id: "att-1", filename: "kitchen-plan.pdf", content_type: "application/pdf", content_disposition: null, content_id: null }],
  },
};

// The shape from resend.com/docs/api-reference/emails/retrieve-received-email.
const RECEIVED = {
  object: "email",
  id: EMAIL_ID,
  to: [`emilio+${token}@reply.fieldquo.com`],
  from: "dana@acme.com",
  created_at: "2026-09-13T09:59:59.000Z",
  subject: "Re: quick question about your quotes",
  html: "<p>Yes, send it over.</p>",
  text: "Yes, send it over.\n\nOn Mon, Emilio wrote:\n> Ref: " + token,
  headers: {
    from: "Dana Ortiz <dana@acme.com>",
    "message-id": "<abc-123@acme.com>",
    "in-reply-to": "<sent-1@fieldquo.com>",
    references: "<sent-1@fieldquo.com>",
    date: "Sun, 13 Sep 2026 09:59:59 +0000",
  },
  bcc: [],
  cc: [],
  reply_to: [],
  received_for: [],
  message_id: "<abc-123@acme.com>",
  attachments: [{ id: "att-1", filename: "kitchen-plan.pdf", content_type: "application/pdf", size: 13264 }],
};

ok("RECEIVED_EVENT is Resend's name for it", RECEIVED_EVENT === "email.received");
{
  const r = readReceivedEvent(EVENT);
  ok("the event is read", r.ok && r.emailId === EMAIL_ID && r.messageId === "<abc-123@acme.com>");
  ok("another event type is refused, not handled", readReceivedEvent({ ...EVENT, type: "email.delivered" }).reason === "not_received_event");
  ok("an event with no email_id is refused", readReceivedEvent({ type: "email.received", data: {} }).reason === "no_email_id");
  ok("garbage does not throw", readReceivedEvent("nope").ok === false && readReceivedEvent(null).ok === false);
}
ok("a Resend id is a UUID", isResendEmailId(EMAIL_ID));
ok("...and a path is not", !isResendEmailId("../domains") && !isResendEmailId("") && !isResendEmailId(null));

{
  const c = receivedEmailToContract(RECEIVED, readReceivedEvent(EVENT));
  ok("from carries the display name from headers.from", c.from === "Dana Ortiz <dana@acme.com>");
  ok("to is the plus-tagged reply address", c.to === `emilio+${token}@reply.fieldquo.com`);
  ok("subject, text, html, messageId, inReplyTo, references, date all map", c.subject === RECEIVED.subject && c.text === RECEIVED.text && c.html === RECEIVED.html && c.messageId === "<abc-123@acme.com>" && c.inReplyTo === "<sent-1@fieldquo.com>" && c.references === "<sent-1@fieldquo.com>" && c.date === RECEIVED.headers.date, c);

  // Then the SAME parser the generic door uses reads it.
  const parsed = parseInboundEmail(c);
  ok("parseInboundEmail finds the token — off the To: header", parsed.token === token);
  ok("...keeps the provider's message id", parsed.providerId === "<abc-123@acme.com>");
  ok("...and the provider's date", parsed.sentAt instanceof Date && parsed.sentAt.getFullYear() === 2026);
  ok("...and the sender, for the echo check only", parsed.fromAddress === "Dana Ortiz <dana@acme.com>");
}
{
  // received_for is where a forwarded copy keeps the plus-tagged address.
  const c = receivedEmailToContract({ ...RECEIVED, to: ["catchall@reply.fieldquo.com"], received_for: [`emilio+${token}@reply.fieldquo.com`] });
  ok("received_for is appended to `to`, so a forwarded reply still carries its token", parseInboundEmail(c).token === token);
}
{
  // The one that matters: a token in the SENDER'S address must file nowhere.
  const hostile = {
    ...RECEIVED,
    from: `attacker+${token}@evil.example`,
    headers: { from: `Mallory <attacker+${token}@evil.example>`, "message-id": "<x@evil.example>" },
    to: ["emilio@reply.fieldquo.com"],
    received_for: [],
    text: "no token here",
    html: "",
    subject: "hello",
  };
  const c = receivedEmailToContract(hostile, {});
  ok("a token in the From is NOT found by the parser", parseInboundEmail(c).token === null, parseInboundEmail(c));
  ok("...because the mapper puts the sender in `from` and in no other field", Object.entries(c).filter(([k, v]) => k !== "from" && String(v).includes(token)).length === 0, c);
}
{
  const c = receivedEmailToContract({ headers: {}, to: null, from: 7 }, {});
  ok("a degenerate email maps to empty strings, not throws", typeof c.from === "string" && c.to === "" && c.text === "");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Where the copy goes — a mailbox of ours, chosen by the address we control");

ok("the local part comes off the reply-domain address", replyDomainLocalPart(`emilio+${token}@reply.fieldquo.com`, "reply.fieldquo.com") === "emilio");
ok("...with a display name and other recipients around it", replyDomainLocalPart(`Emilio <EMILIO+${token}@Reply.FieldQuo.com>, dana@acme.com`, "reply.fieldquo.com") === "emilio");
ok("plain mode (no tag) works too", replyDomainLocalPart("emilio@reply.fieldquo.com", "reply.fieldquo.com") === "emilio");
ok("an address at another domain is ignored", replyDomainLocalPart("emilio+x@fieldquo.com", "reply.fieldquo.com") === null);
ok("no reply domain → nothing", replyDomainLocalPart("emilio@reply.fieldquo.com", "") === null);
ok("a lookalike domain is not matched", replyDomainLocalPart("emilio@reply.fieldquo.com.evil.example", "reply.fieldquo.com") === null);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The forwarded copy says what happened");

{
  const line = forwardHeaderLine({ filed: true, prospect: "Dana · Acme Painting" });
  ok("filed: names the prospect and says to reply from FieldQuo", /Filed on Dana · Acme Painting/.test(line) && /reply from FieldQuo/.test(line));
  ok("...and is honest that a reply from the mailbox is not filed", /not filed/.test(line));
  ok("no_token: says so", /Not filed/.test(forwardHeaderLine({ filed: false, reason: "no_token" })) && /token/.test(forwardHeaderLine({ filed: false, reason: "no_token" })));
  ok("unknown_token: says so", /matches no thread/.test(forwardHeaderLine({ filed: false, reason: "unknown_token" })));
  ok("an unknown reason is still shown, not blanked", /reason: whatever/.test(forwardHeaderLine({ filed: false, reason: "whatever" })));
  ok("attachments not carried are named", /kitchen-plan\.pdf/.test(attachmentsNote(["kitchen-plan.pdf"])));
  ok("...and a long list is truncated with a count", /and 2 more/.test(attachmentsNote(["a", "b", "c", "d", "e", "f", "g"])));
  ok("no missing attachments → no sentence", attachmentsNote([]) === "");

  const bodies = forwardBodies({ headerLine: "Filed on <Dana>", text: "hi", html: "<p>hi</p>" });
  ok("the header line leads the text body", bodies.text.startsWith("Filed on <Dana>"));
  ok("the header line is escaped in the html body, the prospect's html is not", bodies.html.includes("Filed on &lt;Dana&gt;") && bodies.html.includes("<p>hi</p>"));
  ok("a text-only reply gets a <pre>, escaped", /<pre[^>]*>a &lt;b&gt;<\/pre>/.test(forwardBodies({ headerLine: "x", text: "a <b>", html: "" }).html));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Attachments — Resend's hosts only, stored durable or named");

ok("Resend's CDN is allowed", isResendDownloadUrl("https://inbound-cdn.resend.com/x/attachments/y?sig=1"));
ok("a lookalike is not", !isResendDownloadUrl("https://inbound-cdn.resend.com.evil.example/x") && !isResendDownloadUrl("https://resend.com@evil.example/"));
ok("http is not", !isResendDownloadUrl("http://inbound-cdn.resend.com/x"));
ok("types map onto the messaging vocabulary", attachmentTypeFor("image/png") === "image" && attachmentTypeFor("application/pdf") === "document" && attachmentTypeFor("audio/ogg") === "audio" && attachmentTypeFor("application/x-thing") === "other");

{
  const uploads = [];
  const fetchImpl = async (url) => {
    if (url.includes("fails")) return { ok: false, status: 403, headers: new Map() };
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k === "content-type" ? "application/pdf" : null) },
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4 fake").buffer,
    };
  };
  const uploadImpl = async (buffer, opts) => {
    uploads.push({ bytes: buffer.length, opts });
    return { secure_url: `https://res.cloudinary.com/demo/raw/upload/${opts.publicId || "img"}` };
  };
  const r = await rehostInboundAttachments({
    listed: [
      { id: "1", filename: "kitchen-plan.pdf", content_type: "application/pdf", size: 999, download_url: "https://inbound-cdn.resend.com/a/1?sig=x" },
      { id: "2", filename: "photo.jpg", content_type: "image/jpeg", size: 14, download_url: "https://inbound-cdn.resend.com/a/fails?sig=x" },
      { id: "3", filename: "evil.bin", content_type: "application/octet-stream", size: 14, download_url: "https://evil.example/a/3" },
      { id: "4", filename: "no-link.txt", content_type: "text/plain", size: 9 },
    ],
    folder: "sales-inbound/t1",
    fetchImpl,
    uploadImpl,
  });
  ok("a fetched file is stored with a Cloudinary url and a MEASURED size", r.stored[0].url?.startsWith("https://res.cloudinary.com/") && r.stored[0].bytes === 13 && r.stored[0].filename === "kitchen-plan.pdf");
  ok("...uploaded as raw with an extension so it serves a real content type", uploads[0].opts.resourceType === "raw" && /\.pdf$/.test(uploads[0].opts.publicId) && uploads[0].opts.folder === "sales-inbound/t1");
  ok("...and carried on the forwarded copy as base64", r.carried.length === 1 && r.carried[0].filename === "kitchen-plan.pdf" && Buffer.from(r.carried[0].content, "base64").toString().startsWith("%PDF"));
  ok("an HTTP failure is stored by NAME with the reason and no url", r.stored[1].url === null && /HTTP 403/.test(r.stored[1].fetchError) && r.stored[1].filename === "photo.jpg");
  ok("an off-host link is never fetched", r.stored[2].url === null && /not on Resend/.test(r.stored[2].fetchError));
  ok("a metadata-only entry (no download_url) is stored by name", r.stored[3].url === null && /no download link/.test(r.stored[3].fetchError));
  ok("everything not carried is named for the copy's header line", r.notCarried.join(",") === "photo.jpg,evil.bin,no-link.txt", r.notCarried);
  ok("nothing fetched from Resend's host went anywhere but Cloudinary", uploads.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The door end to end, against fakes — and a duplicate event forwards NOTHING");

function fakeWorld({ thread = true } = {}) {
  const receipts = new Map();
  const messages = [];
  const sends = [];
  const errors = [];
  let nextId = 1;
  const THREAD = {
    id: "t1",
    leadId: "l1",
    salesRepId: "r1",
    subject: "quick question about your quotes",
    replyToken: token,
    salesRep: { email: "emilio.login@gmail.com", workEmail: "emilio@fieldquo.com", active: true },
    lead: { id: "l1", email: "dana@acme.com", phone: null, businessName: "Acme Painting", contactName: "Dana" },
  };
  const db = {
    salesInboundReceipt: {
      create: async ({ data }) => {
        if (receipts.has(data.resendEmailId)) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `rc${nextId++}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        receipts.set(data.resendEmailId, row);
        return row;
      },
      findUnique: async ({ where }) => receipts.get(where.resendEmailId) || null,
      update: async ({ where, data }) => {
        const row = [...receipts.values()].find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    salesThread: {
      findUnique: async ({ where }) => (thread && (where.replyToken === token || where.id === "t1") ? THREAD : null),
      updateMany: async () => ({ count: 1 }),
    },
    salesMessage: {
      findFirst: async ({ where }) => messages.find((m) => m.threadId === where.threadId && m.providerId === where.providerId) || null,
      findMany: async () => [],
      create: async ({ data }) => {
        const row = { id: `m${nextId++}`, ...data };
        messages.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = messages.find((m) => m.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    salesRep: {
      findFirst: async ({ where }) => (where.workEmail.startsWith.toLowerCase() === "emilio@" ? { workEmail: "emilio@fieldquo.com" } : null),
    },
    platformSuppression: { findFirst: async () => null, findMany: async () => [] },
    $transaction: async (fn) => fn(db),
  };
  const deps = {
    db,
    getReceivedEmail: async (id) => ({ ...RECEIVED, id }),
    listReceivedAttachments: async () => [
      { id: "att-1", filename: "kitchen-plan.pdf", content_type: "application/pdf", size: 14, download_url: "https://inbound-cdn.resend.com/a/1?sig=x" },
    ],
    sendEmail: async (args) => {
      sends.push(args);
      return { id: `fwd${sends.length}` };
    },
    platformFrom: "FieldQuo <quotes@send.fieldquo.com>",
    replyDomain: "reply.fieldquo.com",
    recordError: async (e) => {
      errors.push(e);
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: (k) => (k === "content-type" ? "application/pdf" : null) },
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.4 fake").buffer,
    }),
    uploadImpl: async (buffer, opts) => ({ secure_url: `https://res.cloudinary.com/demo/raw/upload/${opts.publicId}` }),
  };
  return { db, deps, receipts, messages, sends, errors };
}

{
  const w = fakeWorld();
  const first = await processReceivedEvent(EVENT, w.deps);
  ok("a real reply files on the thread the token names", first.status === 200 && first.body.filed && first.body.threadId === "t1", first.body);
  ok("...and one copy goes to the rep's WORK mailbox", w.sends.length === 1 && w.sends[0].to === "emilio@fieldquo.com", w.sends.map((s) => s.to));
  ok("...from the platform sender, not from the prospect", w.sends[0].from === "FieldQuo <quotes@send.fieldquo.com>");
  ok("...with Reply-To set to the prospect", w.sends[0].replyTo === "dana@acme.com");
  ok("...keeping the prospect's subject, unprefixed", w.sends[0].subject === RECEIVED.subject);
  ok("...saying it was filed, on whom, and where to reply from", /Filed on Dana · Acme Painting in FieldQuo/.test(w.sends[0].text) && /reply from FieldQuo/.test(w.sends[0].text));
  ok("...carrying the prospect's text and html", w.sends[0].text.includes("Yes, send it over.") && w.sends[0].html.includes("<p>Yes, send it over.</p>"));
  ok("...with the attachment on it", w.sends[0].attachments?.length === 1 && w.sends[0].attachments[0].filename === "kitchen-plan.pdf");
  ok("the forward's Resend id is recorded on the message row", w.messages[0].forwardProviderId === "fwd1", w.messages[0]);
  ok("the attachment is stored on the message row, durable", w.messages[0].attachments?.[0]?.url?.startsWith("https://res.cloudinary.com/") && w.messages[0].attachments[0].filename === "kitchen-plan.pdf");
  ok("the stored entry never carries Resend's signed URL", !JSON.stringify(w.messages[0].attachments).includes("inbound-cdn"));
  ok("the receipt records the outcome, the thread, the message and the forward", (() => { const r = w.receipts.get(EMAIL_ID); return r.outcome === "filed" && r.threadId === "t1" && r.salesMessageId === w.messages[0].id && r.forwardProviderId === "fwd1" && r.forwardedTo === "emilio@fieldquo.com"; })(), w.receipts.get(EMAIL_ID));
  ok("the response says it forwarded", first.body.forwarded === true && first.body.forwardedTo === "emilio@fieldquo.com");

  // The redelivery.
  const again = await processReceivedEvent(EVENT, w.deps);
  ok("the SAME event again is answered duplicate, 200", again.status === 200 && again.body.reason === "duplicate", again.body);
  ok("...and forwards NOTHING a second time", w.sends.length === 1, w.sends.length);
  ok("...and files nothing a second time", w.messages.length === 1);
}
{
  // The duplicate check must not fetch: asserted properly, awaited.
  const w = fakeWorld();
  await processReceivedEvent(EVENT, w.deps);
  let fetched = 0;
  await processReceivedEvent(EVENT, { ...w.deps, getReceivedEmail: async () => { fetched++; return RECEIVED; } });
  ok("a duplicate event never calls Resend for the message", fetched === 0);
}
{
  // A token nobody has: still forwarded, to the rep the address names.
  const w = fakeWorld({ thread: false });
  const r = await processReceivedEvent(EVENT, w.deps);
  ok("unknown_token is a 200 with the reason", r.status === 200 && r.body.reason === "unknown_token", r.body);
  ok("...and the human still gets the mail, at the mailbox the reply address's local part names", w.sends.length === 1 && w.sends[0].to === "emilio@fieldquo.com");
  ok("...with a line saying it was NOT filed and why", /Not filed in FieldQuo/.test(w.sends[0].text) && /matches no thread/.test(w.sends[0].text));
  ok("...and the misconfiguration is in the error log", w.errors.some((e) => e.code === "unknown_token"));
  ok("...recorded on the receipt with the forward id", w.receipts.get(EMAIL_ID).outcome === "unknown_token" && w.receipts.get(EMAIL_ID).forwardProviderId === "fwd1");
}
{
  // A token in the From, and nowhere else: NOT filed, whatever the sender says.
  const w = fakeWorld();
  const hostile = {
    ...RECEIVED,
    from: `attacker+${token}@evil.example`,
    headers: { from: `Mallory <attacker+${token}@evil.example>`, "message-id": "<x@evil.example>" },
    to: ["nobody@reply.fieldquo.com"],
    text: "give me the thread",
    html: "",
    attachments: [],
  };
  const r = await processReceivedEvent(EVENT, { ...w.deps, getReceivedEmail: async () => hostile });
  ok("a token carried only in the sender's address files nowhere", r.body.filed === false && r.body.reason === "no_token", r.body);
  ok("...and no thread was touched", w.messages.length === 0);
  ok("...and nothing is forwarded to a rep the address does not name", w.sends.length === 0 && w.receipts.get(EMAIL_ID).forwardError, w.receipts.get(EMAIL_ID));
}
{
  // The rep's own sent copy: discarded, not forwarded.
  const w = fakeWorld();
  const echo = { ...RECEIVED, from: "emilio@fieldquo.com", headers: { from: "Emilio <emilio@fieldquo.com>", "message-id": "<echo@fieldquo.com>" } };
  const r = await processReceivedEvent(EVENT, { ...w.deps, getReceivedEmail: async () => echo });
  ok("own_outbound is discarded", r.body.reason === "own_outbound");
  ok("...and not forwarded back to its author", w.sends.length === 0);
}
{
  // Resend down: 500, receipt marked, and the retry is let through.
  const w = fakeWorld();
  const r = await processReceivedEvent(EVENT, { ...w.deps, getReceivedEmail: async () => { throw new Error("503 from Resend"); } });
  ok("a failure fetching the message is a 500 so Resend retries", r.status === 500, r);
  ok("...recorded on the receipt as error", w.receipts.get(EMAIL_ID).outcome === "error");
  const retry = await processReceivedEvent(EVENT, w.deps);
  ok("...and the retry is processed rather than refused as a duplicate", retry.body.filed === true && w.sends.length === 1, retry.body);
}
{
  // The forward failing does not un-file the message.
  const w = fakeWorld();
  const r = await processReceivedEvent(EVENT, { ...w.deps, sendEmail: async () => ({ error: "Resend refused" }) });
  ok("a refused forward leaves the message filed", r.body.filed === true && w.messages.length === 1);
  ok("...says so in the response", r.body.forwarded === false && /refused/.test(r.body.forwardError));
  ok("...and in the error log, with the Resend id to find the original", w.errors.some((e) => e.code === "forward_failed" && e.detail.resendEmailId === EMAIL_ID));
  ok("...and no forward id is written to the message row", !w.messages[0].forwardProviderId);
}
{
  const w = fakeWorld();
  const r = await processReceivedEvent({ type: "email.delivered", data: { email_id: EMAIL_ID } }, w.deps);
  ok("another event type is ignored, 200, nothing written", r.status === 200 && r.body.ignored && w.receipts.size === 0 && w.sends.length === 0);
  const bad = await processReceivedEvent({ type: "email.received", data: { email_id: "../domains" } }, w.deps);
  ok("an email_id that is not a Resend id never reaches the API", bad.body.ignored && bad.body.reason === "bad_email_id");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Readiness — the reply domain is a set of blockers, never a quiet fall-back");

const READY = {
  repEmail: "emilio@fieldquo.com",
  senderDomainVerified: true,
  replyAddressing: "plus",
  mailingAddress: "1 Rue Example, Montréal QC H1A 1A1",
  inboundSecretSet: false,
  replyDomain: "reply.fieldquo.com",
  replyDomainReceiving: true,
  resendWebhookSecretSet: true,
};
{
  const v = outreachReadiness(READY);
  ok("domain receiving + webhook secret: can send, inbound configured, no warning", v.canSend && v.inboundConfigured && v.warnings.length === 0 && v.replyDomain === "reply.fieldquo.com", v);
}
{
  const v = outreachReadiness({ ...READY, replyDomainReceiving: false });
  ok("domain not receiving in Resend BLOCKS", !v.canSend && v.blockers.some((b) => b.code === "reply_domain_not_receiving"), v.blockers.map((b) => b.code));
  ok("...naming the Receiving toggle and the MX record", /Receiving/.test(v.blockers.find((b) => b.code === "reply_domain_not_receiving").fix) && /MX/.test(v.blockers.find((b) => b.code === "reply_domain_not_receiving").fix));
  ok("...and the sender is handed NO reply domain", v.replyDomain === null);
}
{
  const v = outreachReadiness({ ...READY, resendWebhookSecretSet: false });
  ok("domain set with no webhook secret BLOCKS (replies would reach Resend and nobody)", !v.canSend && v.blockers.some((b) => b.code === "reply_domain_without_webhook"));
  ok("...naming the variable", /RESEND_INBOUND_WEBHOOK_SECRET/.test(v.blockers.find((b) => b.code === "reply_domain_without_webhook").fix));
}
{
  const v = outreachReadiness({ ...READY, replyDomain: "reply.fieldquo.com/inbound" });
  ok("a reply domain that is not a domain BLOCKS", !v.canSend && v.blockers.some((b) => b.code === "reply_domain_invalid"));
}
{
  const v = outreachReadiness({ ...READY, replyDomainReceiving: null });
  ok("'could not ask Resend' is a warning, not a refusal", v.canSend && v.warnings.some((w) => w.code === "reply_domain_unknown"));
  ok("...that says replies would bounce if it is wrong", /bounce/.test(v.warnings.find((w) => w.code === "reply_domain_unknown").fix));
}
{
  const v = outreachReadiness({ ...READY, replyDomain: undefined, replyDomainReceiving: null, resendWebhookSecretSet: false });
  ok("no reply domain and no forwarder secret: sends, warns 'Replies are not being filed'", v.canSend && !v.inboundConfigured && v.warnings.some((w) => /Replies are not being filed/.test(w.title)));
  ok("...naming BOTH doors and their variables", /SALES_REPLY_DOMAIN/.test(v.warnings[0].fix) && /RESEND_INBOUND_WEBHOOK_SECRET/.test(v.warnings[0].fix) && /SALES_INBOUND_SECRET/.test(v.warnings[0].fix));
  ok("...and stays the warning the older check asserts ('mailbox')", /mailbox/i.test(v.warnings[0].fix));
}
{
  const v = outreachReadiness({ ...READY, replyDomain: undefined, replyDomainReceiving: null, resendWebhookSecretSet: false, inboundSecretSet: true });
  ok("the generic door alone still counts as configured", v.canSend && v.inboundConfigured && v.warnings.length === 0);
}
{
  const v = outreachReadiness({ ...READY, replyAddressing: undefined });
  ok("an unset mode with a reply domain is still a blocker, recommending plus", !v.canSend && /"plus"/.test(v.blockers.find((b) => b.code === "reply_addressing_unset").fix) && /SALES_REPLY_DOMAIN/.test(v.blockers.find((b) => b.code === "reply_addressing_unset").fix));
}

section("8b. The Reply-To on the reply domain");
ok("plus: local part kept, domain swapped", replyToAddress("emilio@fieldquo.com", token, "plus", "reply.fieldquo.com") === `emilio+${token}@reply.fieldquo.com`);
ok("plain: local part kept, domain swapped, no tag", replyToAddress("emilio@fieldquo.com", token, "plain", "reply.fieldquo.com") === "emilio@reply.fieldquo.com");
ok("no reply domain: the rep's own address, exactly as before", replyToAddress("emilio@fieldquo.com", token, "plus") === `emilio+${token}@fieldquo.com`);
ok("a reply domain that is not a domain produces NO address, never the rep's own", replyToAddress("emilio@fieldquo.com", token, "plus", "not a domain") === null);

// ═══════════════════════════════════════════════════════════════════════════
section("9. The route: verifies the RAW body before parsing, denies when unset, calls the shared door");

{
  const src = read("app/api/webhooks/resend-inbound/route.js");
  const post = functionBody(src, "POST");
  ok("the route has a POST handler", post !== null);
  ok("it reads request.text(), not request.json()", /request\.text\(\)/.test(post || "") && !/request\.json\(\)/.test(post || ""));
  ok("verifyResendWebhook runs against process.env.RESEND_INBOUND_WEBHOOK_SECRET", /verifyResendWebhook\s*\(/.test(post || "") && /process\.env\.RESEND_INBOUND_WEBHOOK_SECRET/.test(post || ""));
  ok("...with the three svix headers", /svix-id/.test(post || "") && /svix-timestamp/.test(post || "") && /svix-signature/.test(post || ""));
  ok("a failed check is a 401", /status: 401/.test(post || ""));
  ok("...and it happens BEFORE JSON.parse", (post || "").indexOf("status: 401") < (post || "").indexOf("JSON.parse"));
  ok("the route hands off to processReceivedEvent rather than filing inline", /processReceivedEvent\s*\(/.test(post || "") && !/fileInboundMessage/.test(src));
  ok("the sender is never used to look anything up in the route", !/where[\s\S]{0,80}from/.test(post || ""));
}
{
  const generic = read("app/api/webhooks/inbound-sales-email/route.js");
  const door = read("lib/sales/resendInboundDoor.js");
  ok("both doors file through lib/sales/inboundEmail.js — one function, not a copy", /ingestInboundEmail\s*\(/.test(generic) && /ingestInboundEmail\s*\(/.test(door));
  ok("the generic route still checks SALES_INBOUND_SECRET first", /verifyInboundSecret\s*\([\s\S]{0,120}process\.env\.SALES_INBOUND_SECRET/.test(generic));
}
{
  const lib = read("lib/sales/resendInbound.js");
  ok("the mapper never reads a token — that is parseInboundEmail's job, with `from` excluded", !/extractReplyToken/.test(lib));
  const door = read("lib/sales/resendInboundDoor.js");
  ok("the door never selects a thread by anything but the shared filing function", !/salesThread\.findUnique\(\{\s*where:\s*\{\s*replyToken/.test(door) && !/where[\s\S]{0,60}fromAddress/.test(door));
  ok("no Resend SDK client is constructed outside lib/email/resend.js", !/new Resend\(/.test(read("lib/email/resendReceiving.js")) && !/new Resend\(/.test(door));
}
{
  const sender = read("lib/sales/outreachSender.js");
  ok("the sender passes readiness.replyDomain into replyToAddress (never the raw env)", /replyToAddress\(\s*sendingAddress,\s*replyToken,\s*readiness\.replyAddressing,\s*readiness\.replyDomain/.test(sender));
  ok("readiness is asked about receiving and the webhook secret", /replyDomainReceiving/.test(sender) && /RESEND_INBOUND_WEBHOOK_SECRET/.test(sender));
}
{
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  ok("SalesMessage.forwardProviderId exists, nullable", /model SalesMessage \{[\s\S]*?forwardProviderId String\?[\s\S]*?\n\}/.test(schema));
  ok("SalesMessage.attachments exists, nullable Json", /model SalesMessage \{[\s\S]*?attachments Json\?[\s\S]*?\n\}/.test(schema));
  ok("SalesInboundReceipt.resendEmailId is @unique — the idempotency is a constraint", /model SalesInboundReceipt \{[\s\S]*?resendEmailId String @unique/.test(schema));
  const api = read("app/api/sales/threads/[id]/route.js");
  ok("the thread API reads both new columns (written AND read)", /attachments: true/.test(api) && /forwardProviderId: true/.test(api) && /publicAttachments\(/.test(api));
  const ui = read("app/sales/messages/MessageThread.js");
  ok("the thread screen renders attachments and the forwarded note", /m\.attachments/.test(ui) && /forwardedToMailbox/.test(ui) && /app\.salesText\.attachmentNotStored/.test(ui));
  const reps = read("app/platform/sales/reps/page.js");
  ok("/platform/sales/reps shows readiness WARNINGS too, not only blockers", /sending\?\.warnings/.test(reps));
}
{
  const doc = readFileSync(join(ROOT, "docs/SALES-OUTREACH.md"), "utf8");
  ok("docs: §5b exists with the MX record, the dashboard steps and the test", /## 5b\./.test(doc) && /inbound-smtp\./.test(doc) && /I've added the record/.test(doc) && /Test procedure/.test(doc));
  ok("docs: both env vars named", /SALES_REPLY_DOMAIN/.test(doc) && /RESEND_INBOUND_WEBHOOK_SECRET/.test(doc));
  const vercel = readFileSync(join(ROOT, "docs/VERCEL.md"), "utf8");
  ok("docs/VERCEL.md carries both rows", /\| `SALES_REPLY_DOMAIN` \|/.test(vercel) && /\| `RESEND_INBOUND_WEBHOOK_SECRET` \|/.test(vercel));
}
{
  const messages = readFileSync(join(ROOT, "app/i18n/appMessages.js"), "utf8");
  for (const key of ["app.salesText.attachmentNotStored", "app.salesText.attachmentFallbackName", "app.salesText.copyInMailbox"]) {
    const n = messages.split(`"${key}"`).length - 1;
    ok(`${key} is in all nine languages`, n === 9, n);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
