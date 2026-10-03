// scripts/check-demo-live-recipients.mjs
//
//   npm run check:demo-live-recipients
//
// "Can the demo accounts send actual emails and have the text messages sent
// when someone books, so that it can be shown to a client?" — and then: "Not
// the info that's already there, but if we need to create a new quote or
// create a client." (owner, 2026-10-03)
//
// ══ What this file EXECUTES ═══════════════════════════════════════════════
//
// The gate (lib/demo/simulatedSpend.js demoSendVerdict), both vendor seams
// that ask it (lib/email/resend.js sendEmail, lib/sms/twilioClient.js
// sendSms), the create paths' marker (demoLiveStamp), the money refusals and
// the portal pay route — against an in-memory Prisma (memory-db-loader.mjs),
// with no Resend key and no Twilio credentials, so "reached the vendor" is
// observable as the vendor branch's own answer ({ skipped } for mail, a
// refused Twilio call with a delivery row for a text) and "simulated" as the
// substitute's ({ simulated: true } and an *.simulated activity row).
//
// The fixtures the brief named, each a hostile case:
//   §1  the pure matcher — case, formatting, partial lists, the window edge
//   §2  a seeded client's address — never real, even after a rep edits it
//   §3  a public booking — real for THAT address only, inside the window
//   §4  an expired window — simulated, and said so
//   §5  the cap reached — simulated, and said so
//   §6  a real company — always real, never asked about live clients
//   §7  a database failure — a failed send, never a send and never simulated
//   §8  another demo's live recipient — not shared
//   §9  a reset (rep demo retired; pool demo wiped) — simulated
//   §10 SMS — the system number, STOP wins, US needs registration
//   §11 the seams and the markers, by source
//   §12 money — a demo never reaches Stripe; the pay step still works
//   §13 the client-facing pages carry no demo block

import { readFileSync } from "node:fs";

// Before any product module loads: resend.js reads its key at import, and
// the point of §3/§6 is to watch the REAL branch answer "no key".
delete process.env.RESEND_API_KEY;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_API_KEY_SID;
delete process.env.TWILIO_API_KEY_SECRET;
delete process.env.TWILIO_PHONE_NUMBER;
delete process.env.STRIPE_SECRET_KEY;
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";

const { db } = await import("@/lib/db");
const {
  demoSendVerdict, demoLiveStamp, claimLiveDemoSend, refuseDemoCharge, isDemoCompany,
} = await import("@/lib/demo/simulatedSpend");
const {
  matchLiveRecipients, demoSendNoteKey, LIVE_DAILY_CAP, LIVE_ACTION, LIVE_WINDOW_HOURS, nanpDigits,
} = await import("@/lib/demo/liveRecipients");
const { sendEmail } = await import("@/lib/email/resend");
const { sendSms } = await import("@/lib/sms/twilioClient");
const { forgetSystemNumber } = await import("@/lib/sms/systemNumber");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const NOW = new Date();
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000);
const T = db.__tables;
const rowsOf = (t) => T[t] || [];
const actions = (companyId, action) => rowsOf("activityLog").filter((r) => r.companyId === companyId && r.action === action);

async function fresh() {
  db.__reset();
  await db.company.create({ data: { id: "demoA", name: "Northline Refinishing", slug: "demo-a", isDemo: true, demoRetiredAt: null, email: "office@demo-a.example.com" } });
  await db.company.create({ data: { id: "demoB", name: "Southside Roofing", slug: "demo-b", isDemo: true, demoRetiredAt: null } });
  await db.company.create({ data: { id: "real", name: "Real Painters Inc", slug: "real", isDemo: false } });
  // FieldQuo's own system number — what a live demo text goes FROM.
  await db.platformSmsNumber.create({ data: { e164: "+17162747905", purpose: "system", active: true } });
}

/** A client exactly as a create route writes it: data built field by field, plus the server's stamp. */
async function createLikeTheRoute(companyId, data, { body = {} } = {}) {
  // `body` is what a hostile browser sent; the routes never spread it, and
  // neither does this — it exists to prove a body-borne marker is ignored.
  void body;
  return db.client.create({ data: { companyId, ...data, ...(await demoLiveStamp(companyId)) } });
}

// ════════════════════════════════════════════════════════════════════════════
section("§1 The pure matcher");
{
  const live = [{ email: "pat@gmail.com", phone: "819-238-7263", demoLiveAt: hoursAgo(1) }];
  ok("same address, different case and spaces → live", matchLiveRecipients({ channel: "email", to: "  Pat@Gmail.com ", records: live, now: NOW }).live === true);
  ok("a phone however typed → live", matchLiveRecipients({ channel: "sms", to: "+18192387263", records: live, now: NOW }).live === true);
  ok("one live and one other in the same send → the whole send is simulated", matchLiveRecipients({ channel: "email", to: ["pat@gmail.com", "x@y.com"], records: live, now: NOW }).reason === "not_live");
  ok("no recipient → simulated, never real", matchLiveRecipients({ channel: "email", to: [], records: live, now: NOW }).reason === "no_recipient");
  ok("a record without the marker never matches", matchLiveRecipients({ channel: "email", to: "pat@gmail.com", records: [{ email: "pat@gmail.com", demoLiveAt: null }], now: NOW }).reason === "not_live");
  ok(`${LIVE_WINDOW_HOURS}h + 1 min → expired`, matchLiveRecipients({ channel: "email", to: "pat@gmail.com", records: [{ email: "pat@gmail.com", demoLiveAt: hoursAgo(LIVE_WINDOW_HOURS + 1 / 60) }], now: NOW }).reason === "expired");
  ok("a marker in the future (clock skew beyond a minute) is not trusted", matchLiveRecipients({ channel: "email", to: "pat@gmail.com", records: [{ email: "pat@gmail.com", demoLiveAt: new Date(NOW.getTime() + 3600e3) }], now: NOW }).live === false);
  ok("non-NANP digits are no phone", nanpDigits("12345") === null && nanpDigits("+1 (819) 238-7263") === "8192387263");
  ok("banner: a real send says nothing demo", demoSendNoteKey({ simulated: false }) === null);
  ok("banner: live → 'really went out'", demoSendNoteKey({ demoLive: true }) === "app.demo.sentLive");
  ok("banner: cap → says the cap", demoSendNoteKey({ simulated: true, simulatedReason: "cap" }) === "app.demo.notEmailedCap");
  ok("banner: seeded → says only live clients get mail", demoSendNoteKey({ simulated: true, simulatedReason: "not_live" }) === "app.demo.notEmailedNotLive");
  ok("banner: any other simulated reason → the original sentence", demoSendNoteKey({ simulated: true, simulatedReason: "retired" }) === "app.demo.notEmailed");
}

// ════════════════════════════════════════════════════════════════════════════
section("§2 A seeded client's address is never real — even after a rep edits it");
{
  await fresh();
  // The seeder writes clients with no marker (lib/demo/seedContent.js never
  // calls demoLiveStamp — §11 checks that by source).
  const seeded = await db.client.create({ data: { companyId: "demoA", name: "Seeded Sam", email: "sam@example.com", phone: "416-555-0142", demoLiveAt: null } });
  let v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "sam@example.com" });
  ok("seeded address → simulated (not_live)", v.demo === true && v.live === false && v.reason === "not_live", v);
  // A rep types a real-looking stranger's address onto the seeded row. An
  // update never sets the marker, so it stays simulated.
  await db.client.update({ where: { id: seeded.id }, data: { email: "stranger@gmail.com", phone: "819-555-0177" } });
  v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "stranger@gmail.com" });
  ok("seeded client with an edited email → still simulated", v.live === false && v.reason === "not_live", v);
  const r = await sendEmail({ companyId: "demoA", to: "stranger@gmail.com", subject: "Your quote", text: "hello", html: "<p>hello</p>" });
  ok("sendEmail answers simulated, with the reason", r.simulated === true && r.simulatedReason === "not_live", r);
  ok("…and writes the simulated record, not a live one", actions("demoA", "email.simulated").length === 1 && actions("demoA", LIVE_ACTION.email).length === 0);
  ok("…whose summary says why", /NOT sent \(the recipient isn't a client somebody created live/.test(actions("demoA", "email.simulated")[0]?.summary || ""), actions("demoA", "email.simulated")[0]?.summary);
}

// ════════════════════════════════════════════════════════════════════════════
section("§3 A public booking / live-created client — real for that address only");
{
  await fresh();
  // Exactly what app/api/booking/[companySlug]/confirm does for a new
  // booker: name, email, phone from the form, plus the server's stamp. The
  // hostile body carries its own demoLiveAt for a DIFFERENT client below.
  const booked = await createLikeTheRoute("demoA", { name: "Pat Prospect", email: "pat@gmail.com", phone: "819-238-7263" }, { body: { demoLiveAt: "2020-01-01" } });
  ok("the stamp is a server Date on a demo", booked.demoLiveAt instanceof Date, booked.demoLiveAt);
  let v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" });
  ok("the booker's own address → live", v.demo === true && v.live === true, v);
  v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "someone.else@gmail.com" });
  ok("any other address on the same demo → simulated", v.live === false && v.reason === "not_live", v);

  const r = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject: "Your visit is booked", text: "See you Tuesday", html: "<p>See you Tuesday</p>", from: "Northline Refinishing <quotes@fieldquo.com>" });
  ok("sendEmail takes the REAL branch (no key here → { skipped })", r.skipped === true && !r.simulated, r);
  const live = actions("demoA", LIVE_ACTION.email);
  ok("…after writing exactly one audit row first", live.length === 1, live.length);
  ok("…which names the recipient and says FieldQuo pays", /WAS sent for real to pat@gmail\.com/.test(live[0]?.summary || "") && /FieldQuo pays/.test(live[0]?.summary || ""), live[0]?.summary);
  ok("…and keeps the demo company's From (white-label)", live[0]?.metadata?.from === "Northline Refinishing <quotes@fieldquo.com>", live[0]?.metadata);
  ok("…and no simulated record", actions("demoA", "email.simulated").length === 0);

  // A quote, an invoice, a reminder — every send to that client is the same
  // question with the same answer; the gate never looks at what the mail is.
  for (const subject of ["Quote Q-1001 from Northline", "Invoice INV-1001", "Reminder: your visit tomorrow"]) {
    const s = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject, text: subject, html: subject });
    ok(`"${subject}" to the live client → real`, s.skipped === true && !s.simulated, s);
  }

  // The real company's create path writes no marker at all.
  const realClient = await createLikeTheRoute("real", { name: "Real Client", email: "rc@gmail.com" });
  ok("a real company's client carries no marker", realClient.demoLiveAt === undefined, realClient.demoLiveAt);

  // A lead from the PUBLIC self-quote form is live; the client it converts
  // into carries it (lib/leads/convertLead.js).
  await db.leadRequest.create({ data: { companyId: "demoA", name: "Lee Lead", email: "lee@gmail.com", ...(await demoLiveStamp("demoA")) } });
  v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "lee@gmail.com" });
  ok("a public self-quote lead's address → live (its confirmation goes out)", v.live === true, v);
}

// ════════════════════════════════════════════════════════════════════════════
section("§4 An expired window — simulated");
{
  await fresh();
  await db.client.create({ data: { companyId: "demoA", name: "Old Prospect", email: "old@gmail.com", demoLiveAt: hoursAgo(LIVE_WINDOW_HOURS + 2) } });
  const v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "old@gmail.com" });
  ok("created live 26h ago → simulated (expired)", v.live === false && v.reason === "expired", v);
  const r = await sendEmail({ companyId: "demoA", to: "old@gmail.com", subject: "Follow-up", text: "x", html: "x" });
  ok("sendEmail simulates and says expired", r.simulated === true && r.simulatedReason === "expired", r);
}

// ════════════════════════════════════════════════════════════════════════════
section("§5 The cap reached — simulated");
{
  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263" });
  for (let i = 0; i < LIVE_DAILY_CAP.email; i++) {
    await db.activityLog.create({ data: { companyId: "demoA", action: LIVE_ACTION.email, createdAt: hoursAgo(2) } });
  }
  let v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" });
  ok(`${LIVE_DAILY_CAP.email} real emails in 24h → the next is simulated (cap)`, v.live === false && v.reason === "cap", v);
  const r = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject: "One more", text: "x", html: "x" });
  ok("sendEmail simulates with reason cap — the rep's banner says so", r.simulated === true && r.simulatedReason === "cap" && demoSendNoteKey(r) === "app.demo.notEmailedCap", r);
  ok("…and the cap counts no new live row", actions("demoA", LIVE_ACTION.email).length === LIVE_DAILY_CAP.email);
  // The email cap is not the text cap.
  v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+18192387263" });
  ok("the email cap does not spend the text allowance", v.live === true, v);
  // Rows older than 24h no longer count.
  T.activityLog.forEach((row) => { if (row.action === LIVE_ACTION.email) row.createdAt = hoursAgo(25); });
  v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" });
  ok("a day later the allowance is back", v.live === true, v);
}

// ════════════════════════════════════════════════════════════════════════════
section("§6 A real company — always real");
{
  await fresh();
  const v = await demoSendVerdict({ companyId: "real", channel: "email", to: "anyone@gmail.com" });
  ok("verdict: not a demo", v.demo === false, v);
  const r = await sendEmail({ companyId: "real", to: "anyone@gmail.com", subject: "Quote", text: "x", html: "x" });
  ok("sendEmail takes the real branch", r.skipped === true && !r.simulated, r);
  ok("…writing no demo row of either kind", rowsOf("activityLog").length === 0, rowsOf("activityLog").length);
  const s = await sendSms({ companyId: "real", to: "212-555-0142", body: "Reminder" });
  ok("sendSms takes the real branch for a US number too (no A2P question for real tenants)", s.success === false && !s.simulated && rowsOf("smsDelivery").length === 1, s);
  // And past any number of demo_live rows a real company is never capped.
  for (let i = 0; i < 50; i++) await db.activityLog.create({ data: { companyId: "real", action: LIVE_ACTION.email } });
  ok("a real company is never capped", (await demoSendVerdict({ companyId: "real", channel: "email", to: "x@y.com" })).demo === false);
  ok("no company id (FieldQuo's own mail) → not a demo", (await demoSendVerdict({ companyId: null, channel: "email", to: "x@y.com" })).demo === false);
}

// ════════════════════════════════════════════════════════════════════════════
section("§7 A database failure — a failed send, never a send");
{
  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263" });
  const realFind = db.company.findUnique;
  db.company.findUnique = async () => { const e = new Error("P1001: Can't reach database server"); e.code = "P1001"; throw e; };
  let threw = null;
  try { await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" }); } catch (e) { threw = e; }
  ok("the verdict throws rather than guessing", threw?.code === "P1001", threw?.message);
  const r = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject: "x", text: "x", html: "x" });
  ok("sendEmail returns an error — not sent, not simulated", typeof r.error === "string" && !r.skipped && !r.simulated && !r.id, r);
  const s = await sendSms({ companyId: "demoA", to: "819-238-7263", body: "x" });
  ok("sendSms returns a failure — not sent, not simulated", s.success === false && !s.simulated && rowsOf("smsDelivery").length === 0, s);
  db.company.findUnique = realFind;
  // The same for a failure on the live-client read, past the company row.
  const realMany = db.client.findMany;
  db.client.findMany = async () => { throw new Error("P1001"); };
  const r2 = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject: "x", text: "x", html: "x" });
  ok("a failed live-client read is a failure too", typeof r2.error === "string" && !r2.skipped && !r2.simulated, r2);
  db.client.findMany = realMany;
  ok("…and nothing was recorded as sent for real", actions("demoA", LIVE_ACTION.email).length === 0 && actions("demoA", LIVE_ACTION.sms).length === 0);
  // The audit row failing to write turns a live send into a simulated one.
  const realCreate = db.activityLog.create;
  let calls = 0;
  db.activityLog.create = async (args) => { calls++; if (args?.data?.action === LIVE_ACTION.email) throw new Error("write failed"); return realCreate(args); };
  const r3 = await sendEmail({ companyId: "demoA", to: "pat@gmail.com", subject: "x", text: "x", html: "x" });
  ok("an unrecordable live send is simulated instead (audit_failed)", r3.simulated === true && r3.simulatedReason === "audit_failed", r3);
  db.activityLog.create = realCreate;
  void calls;
}

// ════════════════════════════════════════════════════════════════════════════
section("§8 Another demo's live recipient is not shared");
{
  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263" });
  const v = await demoSendVerdict({ companyId: "demoB", channel: "email", to: "pat@gmail.com" });
  ok("demo B emailing demo A's live client → simulated", v.demo === true && v.live === false && v.reason === "not_live", v);
  const s = await demoSendVerdict({ companyId: "demoB", channel: "sms", to: "+18192387263" });
  ok("…and texting them → simulated", s.live === false && s.reason === "not_live", s);
  // And demo A's cap is not demo B's.
  for (let i = 0; i < LIVE_DAILY_CAP.email; i++) await db.activityLog.create({ data: { companyId: "demoB", action: LIVE_ACTION.email } });
  ok("demo B's spent cap does not cap demo A", (await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" })).live === true);
}

// ════════════════════════════════════════════════════════════════════════════
section("§9 A reset ends it");
{
  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263" });
  ok("before the reset → live", (await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" })).live === true);
  // A rep's reset retires the company (lib/sales/repDemo.js) and keeps its rows.
  await db.company.update({ where: { id: "demoA" }, data: { demoRetiredAt: new Date() } });
  const v = await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" });
  ok("live client on a retired (reset) rep demo → simulated", v.live === false && v.reason === "retired", v);
  // A pool reset / re-dress wipes the clients and leads (lib/demo/seedDemo.js
  // wipeContent) — the live row is gone, so its address is nobody's.
  const wipe = code(read("lib/demo/seedDemo.js"));
  ok("the pool reset wipes clients", /db\.client\.deleteMany\(\{ where: \{ companyId \} \}\)/.test(wipe));
  ok("…and leads", /db\.leadRequest\.deleteMany\(\{ where: \{ companyId \} \}\)/.test(wipe));
  await db.company.update({ where: { id: "demoA" }, data: { demoRetiredAt: null } });
  await db.client.deleteMany({ where: { companyId: "demoA" } });
  ok("after the wipe the same address → simulated", (await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" })).reason === "not_live");
  // The seeder re-creates clients after a reset — newer than the reset, but
  // unmarked. This is why the marker is a column and not "createdAt > reset".
  await db.client.create({ data: { companyId: "demoA", name: "Reseeded", email: "pat@gmail.com", createdAt: new Date() } });
  ok("a re-seeded client with the same address, created after the reset → still simulated", (await demoSendVerdict({ companyId: "demoA", channel: "email", to: "pat@gmail.com" })).reason === "not_live");
}

// ════════════════════════════════════════════════════════════════════════════
section("§10 SMS — FieldQuo's system number, STOP wins, US needs registration");
{
  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263" });
  await createLikeTheRoute("demoA", { name: "Una", email: "una@gmail.com", phone: "212-555-0188" });
  let v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+18192387263" });
  ok("a live Canadian phone → live, from the system number", v.live === true && v.from === "+17162747905", v);
  const s = await sendSms({ companyId: "demoA", to: "819-238-7263", body: "Northline Refinishing: your visit is booked. Reply STOP to opt out.", from: "+14165550199" });
  const delivery = rowsOf("smsDelivery")[0];
  ok("sendSms reaches the vendor (a delivery row is opened)", Boolean(delivery) && !s.simulated, { s, delivery });
  ok("…from the SYSTEM number, not the demo's fictional line the caller passed", delivery?.fromE164 === "+17162747905", delivery?.fromE164);
  ok("…after one audit row", actions("demoA", LIVE_ACTION.sms).length === 1);
  ok("…which keeps the company name in the body (white-label)", /Northline Refinishing/.test(actions("demoA", LIVE_ACTION.sms)[0]?.metadata?.body || ""));

  v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+12125550188" });
  ok("a live US phone while A2P registration is unverified → simulated (us_unregistered)", v.live === false && v.reason === "us_unregistered", v);

  await db.smsOptOut.create({ data: { companyId: "demoA", e164: "+18192387263", optedOut: true } });
  v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+18192387263" });
  ok("a live phone that replied STOP → simulated (opted_out), whatever the caller checked", v.live === false && v.reason === "opted_out", v);

  await fresh();
  await createLikeTheRoute("demoA", { name: "Pat", phone: "819-238-7263" });
  await db.platformSmsNumber.deleteMany({});
  forgetSystemNumber(); // systemSmsNumber caches for a minute; the purchase/release paths call this too
  v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+18192387263" });
  ok("no system number → simulated (no_sms_number), never an attempt from a fictional line", v.live === false && v.reason === "no_sms_number", v);

  for (let i = 0; i < LIVE_DAILY_CAP.sms; i++) await db.activityLog.create({ data: { companyId: "demoA", action: LIVE_ACTION.sms } });
  await db.platformSmsNumber.create({ data: { e164: "+17162747905", purpose: "system", active: true } });
  forgetSystemNumber();
  v = await demoSendVerdict({ companyId: "demoA", channel: "sms", to: "+18192387263" });
  ok(`${LIVE_DAILY_CAP.sms} real texts in 24h → simulated (cap)`, v.live === false && v.reason === "cap", v);
}

// ════════════════════════════════════════════════════════════════════════════
section("§11 The seams and the markers, by source");
{
  const gate = code(read("lib/demo/simulatedSpend.js"));
  const verdictSrc = gate.slice(gate.indexOf("export async function demoSendVerdict"), gate.indexOf("export async function claimLiveDemoSend"));
  ok("the verdict re-reads the company row", verdictSrc.includes("db.company.findUnique(") && verdictSrc.includes("isDemo: true"));
  ok("…and takes no isDemo / live flag from its caller", !/\{\s*companyId,\s*channel,\s*to,\s*now[^}]*\b(isDemo|live|force)\b/.test(verdictSrc));
  ok("…and answers a real company before reading any live client", verdictSrc.indexOf("if (!company?.isDemo) return { demo: false }") < verdictSrc.indexOf("db.client.findMany("));

  for (const [file, fn, vendor] of [["lib/email/resend.js", "sendEmail", "resend.emails.send("], ["lib/sms/twilioClient.js", "sendSms", "client.messages.create("]]) {
    const src = code(read(file));
    const start = src.indexOf(`export async function ${fn}`);
    const body = src.slice(start);
    const g = body.indexOf("demoSendVerdict({ companyId");
    const c = body.indexOf("claimLiveDemoSend(");
    const v = body.indexOf(vendor);
    ok(`${file} asks demoSendVerdict before ${vendor}`, g !== -1 && v !== -1 && g < v, { g, v });
    ok(`${file} records the live send before ${vendor}`, c !== -1 && c < v, { c, v });
    ok(`${file} no longer asks isDemoCompany directly (one gate)`, !body.slice(0, v).includes("isDemoCompany("));
  }

  // Where the marker is written: only the create paths a person drives.
  const STAMPED = [
    ["app/api/clients/route.js", "POST /api/clients — the clients screen and the builder's quick-add"],
    ["app/api/appointments/route.js", "a new client typed into the appointment form"],
    ["app/api/booking/[companySlug]/confirm/route.js", "the PUBLIC booking page"],
    ["app/api/self-quote/route.js", "the PUBLIC request form (its lead)"],
    ["lib/estimate/createEstimateQuote.js", "the PUBLIC instant-quote form (instant_quote only)"],
    ["lib/leads/convertLead.js", "converting a live lead"],
  ];
  for (const [file, what] of STAMPED) ok(`${file} stamps — ${what}`, code(read(file)).includes("demoLiveStamp("));
  ok("the instant-quote stamp is for the public form only, not the phone path", /createdVia === "instant_quote" \? await demoLiveStamp\(company\.id\) : \{\}/.test(code(read("lib/estimate/createEstimateQuote.js"))));
  ok("convertLead carries it only from a live lead", /lead\.demoLiveAt \? await demoLiveStamp\(companyId\) : \{\}/.test(code(read("lib/leads/convertLead.js"))));
  ok("the booking route stamps a NEW client only (inside the create)", (() => {
    const src = code(read("app/api/booking/[companySlug]/confirm/route.js"));
    const create = src.indexOf("client = await db.client.create(");
    const stamp = src.indexOf("demoLiveStamp(company.id)");
    const update = src.indexOf("client = await db.client.update(");
    return create !== -1 && stamp > create && update < create;
  })());

  const NEVER = [
    "lib/demo/seedContent.js", "lib/demo/seedDemo.js", "app/api/clients/import/route.js", "lib/migrations/writes.js",
    "lib/quotes/importTarget.js", "lib/jobs/importPastJob.js", "lib/voice/availability.js", "app/api/marketing/stops/[id]/route.js",
    "app/api/clients/[id]/route.js",
  ];
  for (const file of NEVER) {
    const src = code(read(file));
    ok(`${file} never writes the marker (seed, import, migration, phone, edit)`, !src.includes("demoLiveStamp") && !src.includes("demoLiveAt"));
  }
  const lead = code(read("lib/leads/createLead.js"));
  ok("createScoredLead accepts the marker only as a Date the caller computed", lead.includes("input.demoLiveAt instanceof Date"));
}

// ════════════════════════════════════════════════════════════════════════════
section("§12 Money — a demo never reaches Stripe; the pay step still works");
{
  await fresh();
  let threw = null;
  try { await refuseDemoCharge("demoA"); } catch (e) { threw = e; }
  ok("refuseDemoCharge refuses a demo (409 demo_no_charge)", threw?.status === 409 && threw?.code === "demo_no_charge", threw?.message);
  threw = null;
  try { await refuseDemoCharge("real"); } catch (e) { threw = e; }
  ok("…and lets a real company through", threw === null, threw?.message);

  const { createInvoiceCheckoutSession, createBookingFeeCheckoutSession } = await import("@/lib/stripe");
  // A demo holding a (fake) connected account — the state that used to make
  // every Pay button a real charge. No Stripe key exists here: had the call
  // reached Stripe it would fail differently.
  await db.company.update({ where: { id: "demoA" }, data: { stripeAccountId: "acct_demo", stripeChargesEnabled: true, currency: "CAD" } });
  const demoCo = await db.company.findUnique({ where: { id: "demoA" } });
  threw = null;
  try { await createInvoiceCheckoutSession({ invoice: { id: "i", total: 100, amountPaid: 0, invoiceNumber: "X" }, company: demoCo, successUrl: "s", cancelUrl: "c" }); } catch (e) { threw = e; }
  ok("createInvoiceCheckoutSession refuses a demo before Stripe", threw?.code === "demo_no_charge", threw?.message);
  threw = null;
  try { await createBookingFeeCheckoutSession({ bookingId: "b", company: demoCo, label: "Visit", amountCents: 5000, successUrl: "s", cancelUrl: "c" }); } catch (e) { threw = e; }
  ok("createBookingFeeCheckoutSession refuses a demo before Stripe", threw?.code === "demo_no_charge", threw?.message);
  const { chargeOccurrenceOffSession } = await import("@/lib/servicePlans/stripeMandate");
  const off = await chargeOccurrenceOffSession({ company: demoCo, authorisation: {}, amountCents: 5000, description: "x", idempotencyKey: "k" });
  ok("a saved-card plan charge on a demo fails as demo_no_charge, no Stripe", off.outcome === "failed" && off.code === "demo_no_charge", off);

  // The portal pay route, executed. A live client was emailed an invoice; the
  // prospect presses Pay.
  const client = await createLikeTheRoute("demoA", { name: "Pat", email: "pat@gmail.com", phone: "819-238-7263", portalToken: "tok_pat" });
  await db.invoice.create({ data: { id: "inv1", companyId: "demoA", clientId: client.id, invoiceNumber: "INV-1001", total: 1500, subtotal: 1500, tax: 0, amountPaid: 0, amountDue: 1500, status: "sent", sentAt: new Date(), version: 1, parentInvoiceId: null, language: "en" } });
  const { POST: pay } = await import("../app/api/portal/[token]/pay/route.js");
  const call = (body) => pay(new Request("https://app.example.test/api/portal/tok_pat/pay", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ token: "tok_pat" }) });
  let res = await call({ invoiceId: "inv1" });
  let j = await res.json();
  ok("first press → the demo pay screen, not Stripe Checkout", res.status === 200 && /\/portal\/tok_pat\/demo-pay\?invoice=inv1/.test(j.checkoutUrl || "") && j.demo === true, { status: res.status, j });
  ok("…nothing recorded yet", rowsOf("payment").length === 0);
  res = await call({ invoiceId: "inv1", demoConfirm: true, amount: 1 });
  j = await res.json();
  ok("confirm → the portal's 'Payment received' return", res.status === 200 && /\/portal\/tok_pat\?paid=true$/.test(j.checkoutUrl || ""), { status: res.status, j });
  const payment = rowsOf("payment")[0];
  ok("…the payment is the SERVER's figure ($1,500), not the body's", Number(payment?.amount) === 1500, payment?.amount);
  ok("…its reference says demo, never a Stripe pi_", /^demo_pi_inv1_balance_0$/.test(payment?.stripePaymentIntentId || ""), payment?.stripePaymentIntentId);
  ok("…its note says no card was charged", /no card was charged/.test(payment?.notes || ""), payment?.notes);
  const inv = await db.invoice.findUnique({ where: { id: "inv1" } });
  ok("…and the invoice reads paid for the rep", inv.status === "paid" && Number(inv.amountPaid) === 1500, { status: inv.status, amountPaid: inv.amountPaid });
  res = await call({ invoiceId: "inv1", demoConfirm: true });
  ok("a second press owes nothing and records nothing more", res.status === 400 && rowsOf("payment").length === 1, res.status);

  // A REAL company's portal with no Stripe still refuses, and `demoConfirm`
  // means nothing to it.
  const rc = await db.client.create({ data: { companyId: "real", name: "R", portalToken: "tok_real" } });
  await db.invoice.create({ data: { id: "inv2", companyId: "real", clientId: rc.id, invoiceNumber: "R-1", total: 100, amountPaid: 0, status: "sent", sentAt: new Date(), version: 1, parentInvoiceId: null } });
  const callReal = (body) => pay(new Request("https://app.example.test/api/portal/tok_real/pay", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ token: "tok_real" }) });
  res = await callReal({ invoiceId: "inv2", demoConfirm: true });
  ok("a real company without Stripe: refused, and demoConfirm records nothing", res.status === 400 && rowsOf("payment").length === 1, res.status);

  // Refunding the demo payment never calls Stripe.
  const { issueRefund } = await import("@/lib/invoices/refund");
  const stripeSpy = { refunds: { create: async () => { throw new Error("Stripe was called"); } } };
  const ref = await issueRefund({ companyId: "demoA", invoiceId: "inv1", paymentId: payment.id, amountCents: 50000, method: "stripe", reason: "demo", requestId: "rq1", memberUserId: "u1" }, { db, stripe: stripeSpy });
  ok("refunding a demo payment succeeds without calling Stripe", ref.ok === true && /^demo_re_/.test(ref.stripeRefundId || ref.row?.stripeRefundId || ""), ref.ok ? ref.stripeRefundId || ref.row?.stripeRefundId : ref);

  // By source: every Stripe seam a homeowner or a cron can reach refuses a demo.
  for (const [file, fn] of [
    ["lib/stripe.js", "createInvoiceCheckoutSession"],
    ["lib/stripe.js", "createBookingFeeCheckoutSession"],
    ["lib/servicePlans/stripeMandate.js", "createAuthorisationSetupSession"],
    ["lib/servicePlans/stripeMandate.js", "chargeOccurrenceOffSession"],
  ]) {
    const src = code(read(file));
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    const guard = body.indexOf("refuseDemoCharge(");
    const vendor = body.search(/stripe\.(checkout\.sessions|paymentIntents)\.create\(|\.create\(\s*\{/);
    ok(`${file} ${fn} refuses a demo before any Stripe create`, guard !== -1 && (vendor === -1 || guard < vendor), { guard, vendor });
  }
  const confirm = code(read("app/api/booking/[companySlug]/confirm/route.js"));
  ok("the public booking skips a demo's fee (books it free, never Checkout)", /if \(feeCents > 0 && !demoSkipsFee\)/.test(confirm));
  ok("the portal shows a demo the Pay button (and only card)", /const onlinePayments = Boolean\(stripeAccountId && stripeChargesEnabled\) \|\| demoPayments;/.test(code(read("app/api/portal/[token]/route.js"))));
}

// ════════════════════════════════════════════════════════════════════════════
section("§13 The client-facing pages carry no demo block");
{
  // What a live prospect walks: the quote link (view, add-ons, sign/approve),
  // the booking and its manage links, the portal and invoice. None of these
  // may refuse, hide or simulate anything because the company is a demo — the
  // only demo decisions are the send gate (§2–§10) and money (§12).
  const PUBLIC = [
    "app/api/public/quotes/[token]/route.js",
    "app/q/[token]/QuoteApproval.js",
    "app/api/booking/[companySlug]/route.js",
    "app/api/visit/[token]/route.js",
    "app/api/visit/[token]/reschedule/route.js",
    "app/portal/[token]/ClientPortal.js",
    "app/portal/[token]/invoices/[id]/PortalInvoice.js",
  ];
  for (const file of PUBLIC) {
    const src = code(read(file));
    ok(`${file} has no demo branch`, !/isDemo|isDemoCompany|demoSendVerdict/.test(src));
  }
  // The quote's acceptance mails the client their signed copy through the
  // gate, by company — so a live client receives it for real (§3 executes
  // the gate's answer for exactly that address).
  const quote = code(read("app/api/public/quotes/[token]/route.js"));
  ok("approving a quote mails the client through sendEmail with the company id", /sendEmail\(\{[\s\S]{0,400}companyId/.test(quote));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
