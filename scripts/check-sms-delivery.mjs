// scripts/check-sms-delivery.mjs
//
//   npm run check:sms-delivery
//
// Did the text ARRIVE? — executed, not asserted from the source.
//
// Twilio's 201 means queued. US carriers drop texts from a number not
// registered for A2P 10DLC (30034) after that 201, and FieldQuo recorded the
// 201 and nothing else. model SmsDelivery, /api/sms/status and the reconcile
// cron fix that; this drives each of them offline:
//
//   1. the status order — forward only, failure final, late "sent" ignored
//   2. code → plain reason, and no invented cause for an unknown code
//   3. which rows the reconcile cron asks Twilio about, and that the Prisma
//      WHERE and the one-row predicate agree on a grid of rows
//   4. the store against an in-memory database: the callback racing the
//      send, duplicates, out-of-order, a SID that doesn't match, the thread
//      mirror and its tenant scope
//   5. sendSms itself over a stub Twilio: the payload is byte-for-byte what it
//      was (md5) plus `statusCallback`; a refusal is recorded with its code; a
//      demo sends nothing and tracks nothing; a database that cannot write
//      the row still sends the text
//   6. X-Twilio-Signature on /api/sms/status — the real route, a real HMAC:
//      a signed callback advances the row, a tampered `?d=`, body or token is
//      refused and changes nothing
//
// Nothing here opens a connection. Twilio's client is replaced (for
// lib/sms/twilioClient.js only) and so is @/lib/db; the signature is computed
// with the real twilio library.

import { register } from "node:module";
import { createHash } from "node:crypto";

// ── Two substitutions, registered AFTER the alias loader so they run first ──
const HOOKS = `
export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/db") {
    // A proxy, so a case can swap the database under a module that already
    // imported it (the "table missing" case below).
    return { url: "data:text/javascript,export const db = new Proxy({}, { get: (_, k) => globalThis.__smsCheckDb[k] });", shortCircuit: true };
  }
  if (specifier === "next/server") return next("next/server.js", context);
  if (specifier === "twilio" && /\\/lib\\/sms\\/[^/]*twilioClient[^/]*\\.js$/.test(context.parentURL || "")) {
    return { url: "data:text/javascript,export default (...a) => globalThis.__twilioFactory(...a);", shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");

// ═══ An in-memory database, just big enough ════════════════════════════════
function cmp(value, cond) {
  if (cond && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(value);
    if ("not" in cond) return cond.not === null ? value != null : value !== cond.not;
    let okAll = true;
    if ("lt" in cond) okAll &&= value != null && new Date(value) < cond.lt;
    if ("gt" in cond) okAll &&= value != null && new Date(value) > cond.gt;
    if ("gte" in cond) okAll &&= value != null && new Date(value) >= cond.gte;
    return okAll;
  }
  return cond === null ? value == null : value === cond;
}
function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((w) => matches(row, w));
    if (k === "thread") return row.threadCompanyId === v.companyId;
    return cmp(row[k], v);
  });
}
function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    row[k] = v && typeof v === "object" && "increment" in v ? (row[k] || 0) + v.increment : v;
  }
}
function makeDb({ failCreate = false } = {}) {
  let n = 0;
  const t = { smsDelivery: [], message: [], company: [{ id: "co_real", isDemo: false }, { id: "co_demo", isDemo: true }] };
  const model = (name) => ({
    create: async ({ data }) => {
      if (failCreate && name === "smsDelivery") throw new Error('relation "SmsDelivery" does not exist');
      const row = { id: `${name}_${++n}`, status: "pending", callbackCount: 0, sentAt: new Date(), sid: null, errorCode: null, lastCallbackAt: null, reconciledAt: null, ...data };
      t[name].push(row);
      return { ...row };
    },
    findUnique: async ({ where }) => t[name].find((r) => matches(r, where)) || null,
    findFirst: async ({ where }) => t[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where } = {}) => t[name].filter((r) => matches(r, where)),
    update: async ({ where, data }) => {
      const r = t[name].find((x) => matches(x, where));
      if (!r) throw new Error("not found");
      applyData(r, data);
      return r;
    },
    updateMany: async ({ where, data }) => {
      const hit = t[name].filter((r) => matches(r, where));
      hit.forEach((r) => applyData(r, data));
      return { count: hit.length };
    },
  });
  return { t, smsDelivery: model("smsDelivery"), message: model("message"), company: model("company"), platformErrorLog: { create: async () => ({}) } };
}

globalThis.__smsCheckDb = makeDb();
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";

const S = await import("@/lib/sms/deliveryStatus");
const store = await import("@/lib/sms/deliveryStore");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. Status only moves forward; a failure is final\n");
{
  const { canAdvance, statusesThatMayAdvanceTo, isTerminal, normaliseStatus } = S;
  ok("queued → sent", canAdvance("queued", "sent"));
  ok("sent → delivered", canAdvance("sent", "delivered"));
  ok("pending → failed (Twilio refused the create)", canAdvance("pending", "failed"));
  ok("delivered → sent is ignored (late, out-of-order callback)", !canAdvance("delivered", "sent"));
  ok("delivered → undelivered is ignored (first carrier verdict wins)", !canAdvance("delivered", "undelivered"));
  ok("undelivered → delivered is ignored (a failure is final)", !canAdvance("undelivered", "delivered"));
  ok("failed → sent is ignored", !canAdvance("failed", "sent"));
  ok("delivered → read is the one move out of delivered", canAdvance("delivered", "read"));
  ok("queued → queued is not a move (duplicate webhook)", !canAdvance("queued", "queued"));
  ok("accepted → scheduled is not a move (equal rank)", !canAdvance("accepted", "scheduled"));
  ok("an unknown status never applies", !canAdvance("sent", "exploded") && normaliseStatus("exploded") === null);
  ok("Twilio's capitalisation is tolerated", normaliseStatus(" Delivered ") === "delivered");
  ok("the WHERE for delivered excludes delivered and every failure",
    !statusesThatMayAdvanceTo("delivered").some((s) => ["delivered", "undelivered", "failed", "canceled", "read"].includes(s)),
    statusesThatMayAdvanceTo("delivered"));
  ok("the WHERE for sent excludes sent, delivered and failures",
    JSON.stringify(statusesThatMayAdvanceTo("sent").sort()) === JSON.stringify(["accepted", "pending", "queued", "scheduled", "sending"].sort()),
    statusesThatMayAdvanceTo("sent"));
  ok("terminal: delivered, undelivered, failed, unconfirmed", ["delivered", "undelivered", "failed", "unconfirmed"].every(isTerminal) && !isTerminal("sent"));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Error code → plain reason\n");
{
  const { reasonKey, reasonText, normaliseErrorCode, deliveryVerdict, maskPhone } = S;
  ok("30034 names the registration problem", /registered for business texting/.test(reasonText(30034)));
  ok("30034 as Twilio sends it (a string) maps the same", reasonKey("30034") === "app.sms.reason.30034");
  for (const c of [30003, 30005, 30006, 30007, 21610]) ok(`${c} has its own key`, reasonKey(c) === `app.sms.reason.${c}`);
  ok("an unknown code gets the generic key, never a guessed cause", reasonKey(39999) === "app.sms.reason.other");
  ok("an unknown code on the console shows Twilio's own message", reasonText(39999, "Queue overflow") === "Queue overflow");
  ok("an unknown code with no message says so", reasonText(39999) === "Twilio error 39999.");
  ok("no code at all: the carrier didn't say", reasonText(null) === "The carrier didn't say why.");
  ok("junk codes are not stored", normaliseErrorCode("abc") === null && normaliseErrorCode("") === null && normaliseErrorCode(-4) === null);
  ok("verdicts", deliveryVerdict({ status: "delivered" }) === "delivered" && deliveryVerdict({ status: "undelivered" }) === "failed" && deliveryVerdict({ status: "sent" }) === "sent" && deliveryVerdict({ status: "queued" }) === "pending");
  ok("'sent' is NOT dressed up as delivered", deliveryVerdict({ status: "sent" }) !== "delivered");
  ok("a phone is masked to its last four", maskPhone("+15145551234") === "•••• 1234");
  ok("a short or empty phone reveals nothing", maskPhone("12") === "••••" && maskPhone(null) === "••••");

  // Every code with an English reason has a key in all nine app languages.
  const { readFileSync } = await import("node:fs");
  const cat = readFileSync(new URL("../app/i18n/appMessages.js", import.meta.url), "utf8");
  const missing = Object.keys(S.SMS_REASONS).filter((c) => cat.split(`"app.sms.reason.${c}":`).length - 1 !== 9);
  ok("every reason code is translated in all 9 app languages", missing.length === 0, missing);
  ok("…and the fallback too", cat.split(`"app.sms.reason.other":`).length - 1 === 9);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Which rows the reconcile cron asks Twilio about\n");
{
  const { needsReconcile, reconcileWhere, lostSendWhere } = S;
  const now = new Date("2026-09-24T12:00:00Z");
  const ago = (min) => new Date(now.getTime() - min * 60000);
  const base = { sid: "SM" + "a".repeat(32), status: "sent", sentAt: ago(45), reconciledAt: null };
  ok("sent 45 min ago, no callback → asked", needsReconcile(base, now));
  ok("sent 10 min ago → not yet (a callback normally lands in seconds)", !needsReconcile({ ...base, sentAt: ago(10) }, now));
  ok("sent 4 days ago → given up (carrier returns no receipts)", !needsReconcile({ ...base, sentAt: ago(4 * 24 * 60) }, now));
  ok("already delivered → not asked", !needsReconcile({ ...base, status: "delivered" }, now));
  ok("already failed → not asked", !needsReconcile({ ...base, status: "undelivered" }, now));
  ok("no SID → nothing to look up", !needsReconcile({ ...base, sid: null }, now));
  ok("asked 20 min ago → not again yet", !needsReconcile({ ...base, sentAt: ago(120), reconciledAt: ago(20) }, now));
  ok("asked 70 min ago → again", needsReconcile({ ...base, sentAt: ago(180), reconciledAt: ago(70) }, now));
  ok("queued at Twilio for an hour → asked", needsReconcile({ ...base, status: "queued", sentAt: ago(60) }, now));

  // The WHERE the cron runs and the predicate above must agree, row for row.
  const grid = [];
  for (const status of ["pending", "queued", "sent", "delivered", "undelivered", "failed", "accepted"])
    for (const sid of [null, "SM" + "b".repeat(32)])
      for (const sentMin of [5, 31, 600, 71 * 60, 73 * 60])
        for (const rec of [null, 10, 56, 300])
          grid.push({ status, sid, sentAt: ago(sentMin), reconciledAt: rec == null ? null : ago(rec) });
  const where = reconcileWhere(now);
  const disagree = grid.filter((r) => matches(r, where) !== needsReconcile(r, now));
  ok(`reconcileWhere and needsReconcile agree on all ${grid.length} rows`, disagree.length === 0, disagree.slice(0, 2));

  const lost = lostSendWhere(now);
  ok("a row with no SID, pending 45 min → closed as unconfirmed", matches({ sid: null, status: "pending", sentAt: ago(45) }, lost));
  ok("…but not one 5 min old (the send may still be in flight)", !matches({ sid: null, status: "pending", sentAt: ago(5) }, lost));
  ok("…and never a refused send (it is 'failed', already final)", !matches({ sid: null, status: "failed", sentAt: ago(45) }, lost));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The store: races, duplicates, out-of-order, the thread mirror\n");
{
  const db = makeDb();
  const SID = "SM" + "1".repeat(32);
  const row = await store.openDelivery({ companyId: "co_real", purpose: "thread_reply", to: "+15145551234", from: "+17162747905" }, db);
  ok("the row is opened pending, before any send", row && db.t.smsDelivery[0].status === "pending");

  // The "sent" callback lands BEFORE the create call's own reply is recorded.
  let r = await store.applyStatus({ id: row.id, sid: SID, status: "sent", source: "callback" }, db);
  ok("a callback that beats the send finds its row by ?d= and writes the SID", r.applied && db.t.smsDelivery[0].sid === SID);
  await store.recordSendAccepted(row, { sid: SID, status: "queued" }, db);
  ok("…and the send's own late 'queued' does not drag it back", db.t.smsDelivery[0].status === "sent");

  db.t.message.push({ id: "m1", externalId: SID, direction: "out", threadCompanyId: "co_real", deliveredAt: null, failedReason: null });
  db.t.message.push({ id: "m2", externalId: SID, direction: "out", threadCompanyId: "co_other", deliveredAt: null, failedReason: null });

  r = await store.applyStatus({ id: row.id, sid: SID, status: "delivered", source: "callback" }, db);
  ok("delivered advances", r.applied && db.t.smsDelivery[0].status === "delivered");
  ok("…and stamps the thread's Message.deliveredAt", db.t.message[0].deliveredAt instanceof Date);
  ok("…only in the sending company's thread (a SID never crosses tenants)", db.t.message[1].deliveredAt === null);

  const before = db.t.smsDelivery[0].callbackCount;
  r = await store.applyStatus({ id: row.id, sid: SID, status: "sent", source: "callback" }, db);
  ok("a late 'sent' after delivered changes nothing", !r.applied && db.t.smsDelivery[0].status === "delivered");
  ok("…but still counts as a callback that ARRIVED (webhook-health evidence)", db.t.smsDelivery[0].callbackCount === before + 1);
  r = await store.applyStatus({ id: row.id, sid: SID, status: "delivered", source: "callback" }, db);
  ok("a duplicate 'delivered' is idempotent", !r.applied && db.t.smsDelivery[0].status === "delivered");

  r = await store.applyStatus({ id: row.id, sid: "SM" + "9".repeat(32), status: "failed", source: "callback" }, db);
  ok("a callback naming this row but ANOTHER text's SID is refused", r.reason === "sid_mismatch" && db.t.smsDelivery[0].status === "delivered");
  r = await store.applyStatus({ id: row.id, sid: SID, status: "banana", source: "callback" }, db);
  ok("an unknown status is refused", r.reason === "unknown_status");
  r = await store.applyStatus({ id: "nope", sid: SID, status: "sent", source: "callback" }, db);
  ok("an id that names no row is refused", r.reason === "unknown_row");

  // A carrier failure on a conversation reply.
  const SID2 = "SM" + "2".repeat(32);
  const row2 = await store.openDelivery({ companyId: "co_real", purpose: "thread_reply", to: "+12125550123", from: "+17162747905" }, db);
  await store.recordSendAccepted(row2, { sid: SID2, status: "queued" }, db);
  db.t.message.push({ id: "m3", externalId: SID2, direction: "out", threadCompanyId: "co_real", deliveredAt: null, failedReason: null });
  r = await store.applyStatus({ id: row2.id, sid: SID2, status: "undelivered", errorCode: "30034", source: "callback" }, db);
  const d2 = db.t.smsDelivery.find((x) => x.id === row2.id);
  ok("undelivered with 30034 is stored with its code", r.applied && d2.status === "undelivered" && d2.errorCode === 30034);
  ok("…and the reply's Message.failedReason says why", /^sms_30034: Carriers blocked it/.test(db.t.message[2].failedReason || ""), db.t.message[2].failedReason);
  r = await store.applyStatus({ id: row2.id, sid: SID2, status: "delivered", source: "callback" }, db);
  ok("a later 'delivered' does not overturn the failure", !r.applied && d2.status === "undelivered");
  ok("…and the error code a failure left is kept", d2.errorCode === 30034);

  // Not a thread reply: nothing is mirrored.
  const SID3 = "SM" + "3".repeat(32);
  const row3 = await store.openDelivery({ companyId: "co_real", purpose: "booking_confirmation", ref: { type: "appointment", id: "ap1" }, to: "+12125550124" }, db);
  await store.recordSendAccepted(row3, { sid: SID3, status: "queued" }, db);
  db.t.message.push({ id: "m4", externalId: SID3, direction: "out", threadCompanyId: "co_real", deliveredAt: null, failedReason: null });
  await store.applyStatus({ sid: SID3, status: "failed", errorCode: 30006, source: "reconcile" }, db);
  ok("the reconcile path finds a row by SID alone", db.t.smsDelivery.find((x) => x.id === row3.id).status === "failed");
  ok("…and stamps reconciledAt, not lastCallbackAt", db.t.smsDelivery.find((x) => x.id === row3.id).reconciledAt && !db.t.smsDelivery.find((x) => x.id === row3.id).lastCallbackAt);
  ok("a booking confirmation's failure is not written onto some Message row", db.t.message[3].failedReason === null);
  ok("purpose and ref are stored for the calendar", db.t.smsDelivery.find((x) => x.id === row3.id).refType === "appointment");

  const other = await store.openDelivery({ purpose: "made_up_purpose", to: "+15145550000" }, db);
  ok("an unregistered purpose is still tracked, as 'other'", db.t.smsDelivery.find((x) => x.id === other.id).purpose === "other");

  const broken = makeDb({ failCreate: true });
  ok("a database that cannot write the row returns null, never throws", (await store.openDelivery({ purpose: "x", to: "+1" }, broken)) === null);

  // The calendar attach.
  const withTexts = await store.attachCalendarTexts("co_real", [{ kind: "appointment", id: "ap1" }, { kind: "visit", id: "v9" }], db);
  ok("the calendar entry the text was about carries it", withTexts[0].texts?.[0]?.status === "failed");
  ok("an entry with no receipt carries nothing (not 'no text sent')", !("texts" in withTexts[1]));
  const otherCo = await store.attachCalendarTexts("co_other", [{ kind: "appointment", id: "ap1" }], db);
  ok("another company's calendar never sees it", !("texts" in otherCo[0]));

  const receipts = await store.smsReceiptsBySid("co_real", [SID, SID2, "local:abc", null], db);
  ok("thread receipts by SID: only Twilio SIDs, only this company", receipts.size === 2 && receipts.get(SID2).errorCode === 30034);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. sendSms: same payload plus statusCallback; refusals and demos\n");
{
  const { statusCallbackUrl } = store;
  ok("callback URL is the production origin + opaque id", statusCallbackUrl("abc123") === "https://www.fieldquo.com/api/sms/status?d=abc123");
  ok("no callback to localhost (Twilio can't reach it)", statusCallbackUrl("x", "http://localhost:3000") === null && statusCallbackUrl("x", "https://localhost:3000") === null);
  ok("no callback over plain http", statusCallbackUrl("x", "http://example.com") === null);
  ok("no id → no callback", statusCallbackUrl(null) === null);

  const created = [];
  let refuseNext = null;
  globalThis.__twilioFactory = () => ({
    messages: {
      create: async (payload) => {
        created.push(payload);
        if (refuseNext) { const e = refuseNext; refuseNext = null; throw e; }
        return { sid: "SM" + String(created.length).padStart(32, "0"), status: "queued", errorCode: null, errorMessage: null };
      },
    },
  });
  process.env.TWILIO_ACCOUNT_SID = "ACstub";
  process.env.TWILIO_AUTH_TOKEN = "stub";

  globalThis.__smsCheckDb = makeDb();
  const { sendSms } = await import("@/lib/sms/twilioClient");

  // One case per send path's argument shape. The payload each path sent
  // BEFORE this change was exactly { to, from, body } (lib/sms/twilioClient.js
  // at HEAD) — so the md5 of the new payload without statusCallback must
  // equal the md5 of that.
  const cases = [
    { name: "booking confirmation (company line)", args: { to: "514-555-1234", from: "+15145550100", body: "Northline: visit booked Tue 9am", companyId: "co_real", purpose: "booking_confirmation", ref: { type: "appointment", id: "ap1" }, clientId: "cl1" } },
    { name: "reminder (11-digit input)", args: { to: "15145551234", from: "+15145550100", body: "Reminder: tomorrow 9am", companyId: "co_real", purpose: "appointment_reminder", ref: { type: "appointment", id: "ap2" } } },
    { name: "thread reply", args: { to: "+12125550123", from: "+17162747905", body: "Sure — see you then", companyId: "co_real", purpose: "thread_reply" } },
    { name: "FieldQuo's own sales text (no company)", args: { to: "+12125550199", from: "+17166383616", body: "FieldQuo signup link", purpose: "sales_signup_link" } },
    { name: "a caller that passes no purpose", args: { to: "+12125550100", from: "+17166383616", body: "hi", companyId: "co_real" } },
  ];
  for (const c of cases) {
    const n = created.length;
    const res = await sendSms(c.args);
    const payload = created[n];
    const { statusCallback, ...rest } = payload || {};
    const before = { to: payload?.to, from: c.args.from, body: c.args.body };
    ok(`${c.name}: sent`, res.success && res.sid);
    ok(`${c.name}: payload md5 unchanged apart from statusCallback`, md5(rest) === md5(before), { rest, before });
    const tracked = globalThis.__smsCheckDb.t.smsDelivery.find((r) => r.sid === res.sid);
    ok(`${c.name}: tracked with its SID, status queued`, tracked?.status === "queued");
    ok(`${c.name}: statusCallback names that row`, statusCallback === `https://www.fieldquo.com/api/sms/status?d=${tracked?.id}`, statusCallback);
  }
  ok("no purpose → tracked as 'other'", globalThis.__smsCheckDb.t.smsDelivery.at(-1).purpose === "other");

  // Twilio refuses outright (a RestException with a code).
  const e = new Error("Attempt to send to unsubscribed recipient");
  e.code = 21610;
  refuseNext = e;
  const refused = await sendSms({ to: "+12125550111", from: "+17162747905", body: "x", companyId: "co_real", purpose: "on_my_way" });
  const rrow = globalThis.__smsCheckDb.t.smsDelivery.at(-1);
  ok("a refusal still returns { success: false } to the caller", refused.success === false);
  ok("…and is recorded failed with Twilio's code", rrow.status === "failed" && rrow.errorCode === 21610 && rrow.sid === null);

  // A demo company: simulated, never sent, never tracked.
  const rowsBefore = globalThis.__smsCheckDb.t.smsDelivery.length;
  const sentBefore = created.length;
  await sendSms({ to: "+12125550122", from: "+17162747905", body: "demo", companyId: "co_demo", purpose: "booking_confirmation" }).catch(() => {});
  ok("a demo tenant's text reaches neither Twilio nor the receipts table",
    created.length === sentBefore && globalThis.__smsCheckDb.t.smsDelivery.length === rowsBefore);

  // The table missing (deploy before the SQL) must cost the receipt, not the text.
  globalThis.__smsCheckDb = { ...makeDb({ failCreate: true }) };
  const n = created.length;
  const res = await sendSms({ to: "+12125550133", from: "+17162747905", body: "still goes", companyId: "co_real", purpose: "booking_confirmation" });
  ok("no SmsDelivery table: the text is still sent", res.success && created.length === n + 1);
  ok("…with no statusCallback (there is no row to name)", !("statusCallback" in created[n]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. /api/sms/status: the signature is the access control\n");
{
  const twilio = (await import("twilio")).default;
  const TOKEN = "check-auth-token-0123456789abcdef";
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  const db = makeDb();
  globalThis.__smsCheckDb = db;
  const SID = "SM" + "7".repeat(32);
  const row = await store.openDelivery({ companyId: "co_real", purpose: "booking_confirmation", to: "+12125550123" }, db);
  await store.recordSendAccepted(row, { sid: SID, status: "queued" }, db);

  const { POST } = await import("@/app/api/sms/status/route.js");
  const url = `https://www.fieldquo.com/api/sms/status?d=${row.id}`;
  const post = (params, { sign = true, token = TOKEN, signedUrl = url, sendUrl = url } = {}) => {
    const sig = sign ? twilio.getExpectedTwilioSignature(token, signedUrl, params) : null;
    return POST(
      new Request(sendUrl.replace("https://www.fieldquo.com", "http://internal"), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-proto": "https",
          host: "www.fieldquo.com",
          ...(sig ? { "x-twilio-signature": sig } : {}),
        },
        body: new URLSearchParams(params).toString(),
      }),
    );
  };
  const cur = () => db.t.smsDelivery.find((r) => r.id === row.id);

  let res = await post({ MessageSid: SID, MessageStatus: "undelivered", ErrorCode: "30034" }, { sign: false });
  ok("unsigned → 401", res.status === 401);
  ok("…and the row is untouched", cur().status === "queued");

  res = await post({ MessageSid: SID, MessageStatus: "undelivered", ErrorCode: "30034" }, { token: "wrong-token" });
  ok("signed with the wrong token → 401", res.status === 401 && cur().status === "queued");

  res = await post({ MessageSid: SID, MessageStatus: "delivered" }, { signedUrl: `https://www.fieldquo.com/api/sms/status?d=someone_else` });
  ok("a signature for a different ?d= → 401 (the id is covered by the HMAC)", res.status === 401 && cur().status === "queued");

  // Sign one body, send another.
  {
    const params = { MessageSid: SID, MessageStatus: "sent" };
    const sig = twilio.getExpectedTwilioSignature(TOKEN, url, params);
    res = await POST(new Request(url.replace("https://www.fieldquo.com", "http://internal"), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https", host: "www.fieldquo.com", "x-twilio-signature": sig },
      body: new URLSearchParams({ MessageSid: SID, MessageStatus: "delivered" }).toString(),
    }));
    ok("a tampered body → 401", res.status === 401 && cur().status === "queued");
  }

  delete process.env.TWILIO_AUTH_TOKEN;
  res = await post({ MessageSid: SID, MessageStatus: "delivered" });
  ok("no TWILIO_AUTH_TOKEN on the deployment → refused, not waved through", res.status === 401 && cur().status === "queued");
  process.env.TWILIO_AUTH_TOKEN = TOKEN;

  res = await post({ MessageSid: SID, MessageStatus: "undelivered", ErrorCode: "30034", SmsSid: SID, SmsStatus: "undelivered" });
  ok("a genuine signed callback → 204", res.status === 204);
  ok("…and the row says undelivered, 30034, with a callback on record",
    cur().status === "undelivered" && cur().errorCode === 30034 && cur().lastCallbackAt instanceof Date && cur().callbackCount === 1, cur());

  res = await post({ MessageSid: SID, MessageStatus: "sent" });
  ok("Twilio's retry of an older status is answered 2xx (no retry storm) and ignored", res.status === 204 && cur().status === "undelivered");

  res = await post({ AccountSid: "AC1" });
  ok("a signed request with no SID/status is a harmless 204", res.status === 204);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
