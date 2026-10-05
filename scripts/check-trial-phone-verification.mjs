// scripts/check-trial-phone-verification.mjs
//
// A card-free trial verifies a mobile by SMS code before features that spend
// FieldQuo's money (owner-approved cost saver, 2026-10-03).
//
//   npm run check:trial-phone-verification
//
// Executes lib/trial/phoneGate.js and lib/trial/phoneVerify.js against hostile
// input with a scripted database and scripted Twilio. NOTHING here sends a
// real text: every sender is a stand-in that records what it was asked.
import { readFileSync } from "node:fs";
import {
  normaliseMobile,
  maskE164,
  lineTypeVerdict,
  sendAllowed,
  hashCode,
  newCode,
  codeVerdict,
  sendCode,
  checkCode,
  REFUSALS,
  MAX_CODE_TRIES,
  RESEND_GAP_MS,
} from "@/lib/trial/phoneVerify";
import {
  phoneGateVerdict,
  deliveryPathFor,
  trialPhoneGate,
  phoneGateBody,
  PHONE_GATED_FEATURES,
  PHONE_REQUIRED_CODE,
} from "@/lib/trial/phoneGate";
import { phoneRequiredPayload } from "@/lib/trial/phoneRequired";

let pass = 0;
let fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const KEY = "test-secret-not-real";
const NOW = Date.UTC(2026, 9, 3, 15, 0);
const MTL_CELL = "+15145550123";

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n1. The number");
ok("(514) 555-0123 → +15145550123", normaliseMobile("(514) 555-0123") === MTL_CELL);
ok("1-514-555-0123 and +1 514 555 0123 too", normaliseMobile("1-514-555-0123") === MTL_CELL && normaliseMobile("+1 514 555 0123") === MTL_CELL);
ok("a number (not a string) is read", normaliseMobile(5145550123) === MTL_CELL);
for (const bad of ["", null, undefined, {}, [], "555-0123", "+44 20 7946 0958", "+33 6 12 34 56 78", "011 514 555 0123", "(114) 555-0123", "(514) 155-0123", "(911) 555-0123", "5".repeat(40), "514-555-01234", "abc"]) {
  ok(`refused: ${JSON.stringify(bad)}`, normaliseMobile(bad) === null);
}
ok("masked shows the last four only", maskE164(MTL_CELL) === "+1 ••• ••• 0123" && maskE164("") === "");

console.log("\n2. The line type (Twilio Lookup, US$0.008)");
const lk = (type, extra = {}) => ({ countryCode: "CA", valid: true, lineTypeIntelligence: { type }, ...extra });
ok("mobile → ok", lineTypeVerdict(lk("mobile")).ok);
ok("nonFixedVoip (TextNow, Google Voice) → refused voip", lineTypeVerdict(lk("nonFixedVoip")).reasonKey === "voip");
ok("fixedVoip → refused voip", lineTypeVerdict(lk("fixedVoip")).reasonKey === "voip");
ok("landline / tollFree → not_mobile", lineTypeVerdict(lk("landline")).reasonKey === "not_mobile" && lineTypeVerdict(lk("tollFree")).reasonKey === "not_mobile");
for (const t of ["pager", "premium", "sharedCost", "uan", "voicemail"]) ok(`${t} → not_mobile`, lineTypeVerdict(lk(t)).reasonKey === "not_mobile");
ok("invalid per the carrier → refused", lineTypeVerdict({ valid: false }).reasonKey === "invalid");
ok("a non-US/CA country from Lookup → refused", lineTypeVerdict(lk("mobile", { countryCode: "JM" })).reasonKey === "country");
ok("Lookup down (null) → let through: an outage must not lock a contractor out", lineTypeVerdict(null).ok);
ok("personal / unknown / garbage → let through", lineTypeVerdict(lk("personal")).ok && lineTypeVerdict(lk("")).ok && lineTypeVerdict(lk(42)).ok);

console.log("\n3. Rate limits");
const ago = (ms) => NOW - ms;
ok("first send → ok", sendAllowed({ now: NOW }).ok);
const soon = sendAllowed({ companySends: [ago(20_000)], now: NOW });
ok("20 s after the last → too_soon, retry in 40 s", soon.reasonKey === "too_soon" && soon.retryAfterSeconds === 40, soon);
ok("61 s after → ok", sendAllowed({ companySends: [ago(61_000)], now: NOW }).ok);
ok("3 in the last hour → rate_limited", sendAllowed({ companySends: [ago(5 * 60e3), ago(20 * 60e3), ago(50 * 60e3)], now: NOW }).reasonKey === "rate_limited");
ok("6 in a day → rate_limited", sendAllowed({ companySends: [2, 4, 6, 8, 10, 12].map((h) => ago(h * 3600e3)), now: NOW }).reasonKey === "rate_limited");
ok("5 to one number in a day across companies → rate_limited", sendAllowed({ numberSends: [1, 2, 3, 4, 5].map((h) => ago(h * 3600e3)), now: NOW }).reasonKey === "rate_limited");
ok("garbage timestamps are ignored, not counted as now", sendAllowed({ companySends: ["x", null, NaN], now: NOW }).ok);
ok("the resend gap is a minute", RESEND_GAP_MS === 60_000);

console.log("\n4. The code");
const codes = Array.from({ length: 2000 }, () => newCode());
ok("codes are six digits, leading zeros kept", codes.every((c) => /^\d{6}$/.test(c)));
ok("…and vary", new Set(codes).size > 1900);
const h = hashCode({ companyId: "C1", e164: MTL_CELL, code: "012345", key: KEY });
ok("the hash is bound to the company and the number", h !== hashCode({ companyId: "C2", e164: MTL_CELL, code: "012345", key: KEY }) && h !== hashCode({ companyId: "C1", e164: "+15145550124", code: "012345", key: KEY }));
const pending = { status: "pending", e164: MTL_CELL, sender: "sms", codeHash: h, attempts: 0, expiresAt: new Date(NOW + 60_000) };
ok("the right code → ok", codeVerdict({ attempt: pending, companyId: "C1", typed: "012345", now: NOW, key: KEY }).ok);
ok("typed with spaces → still ok", codeVerdict({ attempt: pending, companyId: "C1", typed: " 012 345 ", now: NOW, key: KEY }).ok);
ok("wrong code → wrong_code", codeVerdict({ attempt: pending, companyId: "C1", typed: "012346", now: NOW, key: KEY }).reasonKey === "wrong_code");
ok("another company's attempt can't be answered with this code", !codeVerdict({ attempt: pending, companyId: "C2", typed: "012345", now: NOW, key: KEY }).ok);
for (const typed of ["", null, "12345", "1234567", "abcdef", { x: 1 }]) ok(`hostile typed ${JSON.stringify(typed)} → refused`, !codeVerdict({ attempt: pending, companyId: "C1", typed, now: NOW, key: KEY }).ok);
ok("expired → expired", codeVerdict({ attempt: { ...pending, expiresAt: new Date(NOW - 1) }, companyId: "C1", typed: "012345", now: NOW, key: KEY }).reasonKey === "expired");
ok(`${MAX_CODE_TRIES} misses → too_many, even with the right code`, codeVerdict({ attempt: { ...pending, attempts: MAX_CODE_TRIES }, companyId: "C1", typed: "012345", now: NOW, key: KEY }).reasonKey === "too_many");
ok("no attempt / approved attempt → no_code", codeVerdict({ attempt: null, typed: "012345" }).reasonKey === "no_code" && codeVerdict({ attempt: { ...pending, status: "approved" }, typed: "012345" }).reasonKey === "no_code");
ok("an empty stored hash never matches", !codeVerdict({ attempt: { ...pending, codeHash: "" }, companyId: "C1", typed: "012345", now: NOW, key: KEY }).ok);

console.log("\n5. Who is asked");
const trial = { reason: "trial_no_plan" };
const co = (x = {}) => ({ isDemo: false, trialPhoneVerifiedAt: null, ...x });
ok("an unverified card-free trial → required", phoneGateVerdict({ access: trial, company: co(), deliveryPath: "sms" }).required === true);
for (const reason of ["active", "trialing", "past_due", "canceled", "no_subscription", "setup_pending", "trial_expired", undefined]) {
  ok(`billing reason ${reason} → never asked (paid companies unaffected)`, phoneGateVerdict({ access: { reason }, company: co(), deliveryPath: "sms" }).required === false);
}
ok("verified → not asked", phoneGateVerdict({ access: trial, company: co({ trialPhoneVerifiedAt: new Date() }), deliveryPath: "sms" }).reason === "verified");
ok("a demo → not asked", phoneGateVerdict({ access: trial, company: co({ isDemo: true }), deliveryPath: "sms" }).reason === "demo");
ok("no way to deliver a code → not asked (no gate nobody can pass)", phoneGateVerdict({ access: trial, company: co(), deliveryPath: null }).reason === "no_delivery_path");
const yes = () => true;
ok("Canada → our own number", (await deliveryPathFor({ country: "CA" }, { twilioConfigured: yes })) === "sms");
ok("no country → treated as CA (the schema default)", (await deliveryPathFor({}, { twilioConfigured: yes })) === "sms");
ok("US, our number A2P-registered → our own number", (await deliveryPathFor({ country: "US" }, { twilioConfigured: yes, systemNumberTextsUs: async () => true })) === "sms");
ok("US, not registered, Verify configured → verify", (await deliveryPathFor({ country: "US" }, { twilioConfigured: yes, systemNumberTextsUs: async () => false, verifyServiceSid: "VA1" })) === "verify");
ok("US, not registered, no Verify → null", (await deliveryPathFor({ country: "us" }, { twilioConfigured: yes, systemNumberTextsUs: async () => false, verifyServiceSid: "" })) === null);
ok("US, the A2P read throws → treated as not registered", (await deliveryPathFor({ country: "US" }, { twilioConfigured: yes, systemNumberTextsUs: async () => { throw new Error("x"); }, verifyServiceSid: null })) === null);
ok("no Twilio at all → null", (await deliveryPathFor({ country: "CA" }, { twilioConfigured: () => false })) === null);
{
  let read = 0;
  const prisma = { company: { findUnique: async () => { read++; return co({ id: "C1", country: "CA" }); } } };
  const paid = await trialPhoneGate("C1", { access: { reason: "active" }, prisma });
  ok("a paying company is answered without reading the company row", paid.required === false && read === 0);
  const t = await trialPhoneGate("C1", { access: trial, prisma, deps: { twilioConfigured: yes } });
  ok("an unverified CA trial → required, path sms", t.required && t.deliveryPath === "sms", t);
}

// Sections 6 and on are about the CODE, so each runs on a phone & text credit
// that can cover it; section 9 is about the money. The wallet is scripted —
// nothing here reads or writes a ledger.
const FUNDED = { balanceFor: async () => 10_000, debitCredit: async (e) => e, enqueueUsage: async () => null };
const sendCodeFunded = (args) => sendCode({ ...args, deps: { ...FUNDED, ...(args.deps || {}) } });
const checkCodeFunded = (args) => checkCode({ ...args, deps: { ...FUNDED, ...(args.deps || {}) } });

console.log("\n6. Sending, against a scripted database and a scripted Twilio");
function fakeDb({ companies = [], rows = [] } = {}) {
  const store = { companies: companies.map((c) => ({ ...c })), rows: rows.map((r) => ({ ...r })) };
  let id = 0;
  const matchCompany = (c, where) =>
    (where.trialPhoneE164 === undefined || c.trialPhoneE164 === where.trialPhoneE164) &&
    (!where.trialPhoneVerifiedAt || c.trialPhoneVerifiedAt) &&
    (!where.id?.not || c.id !== where.id.not);
  const matchRow = (r, where = {}) =>
    (where.companyId === undefined || r.companyId === where.companyId) &&
    (where.e164 === undefined || r.e164 === where.e164) &&
    (where.status === undefined || r.status === where.status) &&
    (!where.createdAt?.gte || r.createdAt >= where.createdAt.gte) &&
    (!where.lineType?.not || (r.lineType !== null && r.lineType !== undefined));
  return {
    store,
    company: {
      findFirst: async ({ where }) => store.companies.find((c) => matchCompany(c, where)) || null,
      update: async ({ where, data }) => Object.assign(store.companies.find((c) => c.id === where.id), data),
    },
    phoneVerification: {
      findMany: async ({ where }) => store.rows.filter((r) => matchRow(r, where)),
      findFirst: async ({ where }) => store.rows.filter((r) => matchRow(r, where)).sort((a, b) => b.createdAt - a.createdAt)[0] || null,
      create: async ({ data }) => { const r = { id: `pv${++id}`, attempts: 0, status: "pending", createdAt: new Date(NOW), ...data }; store.rows.push(r); return r; },
      update: async ({ where, data }) => {
        const r = store.rows.find((x) => x.id === where.id);
        for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === "object" && "increment" in v ? (r[k] || 0) + v.increment : v;
        return r;
      },
      updateMany: async ({ where, data }) => { for (const r of store.rows.filter((x) => matchRow(x, where))) Object.assign(r, data); },
    },
  };
}
{
  const db = fakeDb({ companies: [{ id: "C1" }] });
  const texts = [];
  const lookups = [];
  const deps = { prisma: db, now: NOW, key: KEY, sendSms: async (m) => { texts.push(m); return { success: true }; }, lookupLineType: async (e) => { lookups.push(e); return lk("mobile"); } };
  const r = await sendCodeFunded({ companyId: "C1", userId: "U1", phone: "(514) 555-0123", deliveryPath: "sms", deps });
  ok("a CA mobile: one text from our own number, masked back", r.ok && texts.length === 1 && r.masked === "+1 ••• ••• 0123", r);
  ok("…the text carries NO companyId (it must not meet the gate it opens)", !("companyId" in texts[0]) && texts[0].purpose === "phone_verification");
  const sentCode = /(\d{6})/.exec(texts[0].body)?.[1];
  ok("…the code is stored only as its hash", db.store.rows[0].codeHash === hashCode({ companyId: "C1", e164: MTL_CELL, code: sentCode, key: KEY }) && !JSON.stringify(db.store.rows).includes(sentCode));
  ok("…one Lookup for the number", lookups.length === 1 && db.store.rows[0].lineType === "mobile");
  const again = await sendCodeFunded({ companyId: "C1", phone: "(514) 555-0123", deliveryPath: "sms", deps: { ...deps, now: NOW + 10_000 } });
  ok("a second send 10 s later → too_soon, nothing sent", !again.ok && again.reasonKey === "too_soon" && texts.length === 1);
  const later = await sendCodeFunded({ companyId: "C1", phone: "(514) 555-0123", deliveryPath: "sms", deps: { ...deps, now: NOW + 2 * 60_000 } });
  ok("two minutes later → sent, and the Lookup answer is reused (no second US$0.008)", later.ok && texts.length === 2 && lookups.length === 1);
  ok("…and the earlier code stops working", db.store.rows[0].status === "expired");

  // Check the code.
  const lastCode = /(\d{6})/.exec(texts[1].body)[1];
  const wrong = await checkCodeFunded({ companyId: "C1", code: lastCode === "000000" ? "111111" : "000000", deps: { prisma: db, now: NOW + 3 * 60_000, key: KEY } });
  ok("a wrong code → wrong_code, and the miss is counted", !wrong.ok && wrong.reasonKey === "wrong_code" && db.store.rows[1].attempts === 1);
  const right = await checkCodeFunded({ companyId: "C1", code: lastCode, deps: { prisma: db, now: NOW + 3 * 60_000, key: KEY } });
  ok("the right code → verified, and the company is stamped", right.ok && db.store.companies[0].trialPhoneE164 === MTL_CELL && db.store.companies[0].trialPhoneVerifiedAt instanceof Date);
  ok("…the attempt is approved and cannot be reused", db.store.rows[1].status === "approved" && !(await checkCodeFunded({ companyId: "C1", code: lastCode, deps: { prisma: db, now: NOW + 4 * 60_000, key: KEY } })).ok);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }, { id: "OTHER", trialPhoneE164: MTL_CELL, trialPhoneVerifiedAt: new Date(NOW - 86400e3) }] });
  let sent = 0;
  const r = await sendCodeFunded({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a number another trial verified → already_used, before any text", !r.ok && r.reasonKey === "already_used" && sent === 0);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }] });
  let sent = 0;
  const r = await sendCodeFunded({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("nonFixedVoip") } });
  ok("a VoIP number → refused, nothing sent, nothing stored", !r.ok && r.reasonKey === "voip" && sent === 0 && db.store.rows.length === 0);
  const down = await sendCodeFunded({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => { throw new Error("lookup down"); } } });
  ok("Lookup down → the text still goes", down.ok && sent === 1);
  const failed = await sendCodeFunded({ companyId: "C1", phone: "514 555 0124", deliveryPath: "sms", deps: { prisma: db, now: NOW + 5 * 60_000, key: KEY, sendSms: async () => ({ success: false, error: "carrier" }), lookupLineType: async () => lk("mobile") } });
  ok("Twilio refused the text → unavailable, and no pending code is left that can't arrive", !failed.ok && failed.reasonKey === "unavailable" && db.store.rows.length === 1);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }] });
  let sms = 0;
  let started = null;
  const usCell = "(212) 555-0199";
  const r = await sendCodeFunded({ companyId: "C1", phone: usCell, deliveryPath: "verify", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile", { countryCode: "US" }), verifyStart: async (e) => { started = e; return true; } } });
  ok("a US mobile while our number can't text the US → Twilio Verify, not our number", r.ok && started === "+12125550199" && sms === 0 && db.store.rows[0].sender === "verify" && db.store.rows[0].codeHash === null);
  let checked = null;
  const v = await checkCodeFunded({ companyId: "C1", code: "123456", deps: { prisma: db, now: NOW + 60_000, verifyCheck: async (e, c) => { checked = [e, c]; return true; } } });
  ok("…and the code is checked by Verify", v.ok && checked?.[0] === "+12125550199" && checked?.[1] === "123456");
  const ca = await sendCodeFunded({ companyId: "C2", phone: "(514) 555-0177", deliveryPath: "verify", deps: { prisma: fakeDb({ companies: [{ id: "C2" }] }), now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a CANADIAN mobile always goes through our own (cheaper) number", ca.ok && sms === 1);
  const none = await sendCodeFunded({ companyId: "C3", phone: usCell, deliveryPath: null, deps: { prisma: fakeDb({ companies: [{ id: "C3" }] }), now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a US mobile with no way to reach it → unavailable, nothing sent", !none.ok && none.reasonKey === "unavailable" && sms === 1);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }, { id: "C2" }] });
  const texts = [];
  const deps = (now) => ({ prisma: db, now, key: KEY, sendSms: async (m) => { texts.push(m); return { success: true }; }, lookupLineType: async () => lk("mobile") });
  await sendCodeFunded({ companyId: "C1", phone: MTL_CELL, deliveryPath: "sms", deps: deps(NOW) });
  await sendCodeFunded({ companyId: "C2", phone: MTL_CELL, deliveryPath: "sms", deps: deps(NOW + 1000) });
  const c1 = /(\d{6})/.exec(texts[0].body)[1];
  const c2 = /(\d{6})/.exec(texts[1].body)[1];
  ok("two trials racing for one number: the first wins", (await checkCodeFunded({ companyId: "C1", code: c1, deps: { prisma: db, now: NOW + 2000, key: KEY } })).ok);
  const loser = await checkCodeFunded({ companyId: "C2", code: c2, deps: { prisma: db, now: NOW + 3000, key: KEY } });
  ok("…the second, re-asked at the write, is refused already_used", !loser.ok && loser.reasonKey === "already_used" && !db.store.companies[1].trialPhoneVerifiedAt);
}

{
  const saved = { a: process.env.PHONE_CODE_SECRET, b: process.env.BETTER_AUTH_SECRET };
  delete process.env.PHONE_CODE_SECRET;
  delete process.env.BETTER_AUTH_SECRET;
  let sent = 0;
  const r = await sendCodeFunded({ companyId: "C9", phone: MTL_CELL, deliveryPath: "sms", deps: { prisma: fakeDb({ companies: [{ id: "C9" }] }), now: NOW, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("no secret to hash with → unavailable, and NOTHING is sent (a code we can't store can't be checked)", !r.ok && r.reasonKey === "unavailable" && sent === 0);
  if (saved.a !== undefined) process.env.PHONE_CODE_SECRET = saved.a;
  if (saved.b !== undefined) process.env.BETTER_AUTH_SECRET = saved.b;
}

console.log("\n7. The refusal and the door");
const body = phoneGateBody("ai_call");
ok("a gated route's refusal names the fix and carries the code", body.code === PHONE_REQUIRED_CODE && body.phoneVerification.path === "/app/settings/verify-phone" && /Verify a mobile number/.test(body.error));
ok("an unknown feature never echoes the caller's string", phoneGateBody("<script>").phoneVerification.feature === null);
ok("the browser opens the prompt only for 403 + the code", phoneRequiredPayload(403, body) && !phoneRequiredPayload(402, body) && !phoneRequiredPayload(403, { error: "Forbidden" }));
ok("every refusal key has words", ["invalid", "country", "voip", "not_mobile", "already_used", "too_soon", "rate_limited", "unavailable", "wrong_code", "expired", "too_many", "no_code", "not_needed", "no_phone_credit"].every((k) => typeof REFUSALS[k] === "string"));

console.log("\n8. Wiring — each feature that spends asks the gate");
const WIRED = {
  sms: "lib/sms/twilioClient.js",
  phone_number: "app/api/settings/voice/number/route.js",
  crew_line: "app/api/crew/line/route.js",
  business_number: "app/api/settings/business-number/route.js",
  ai_call: "app/api/quotes/[id]/call/route.js",
  video_post: "app/api/marketing/video-posts/route.js",
  email_campaign: "app/api/marketing/campaigns/[id]/send/route.js",
};
ok("the registry and the wiring list are the same set", Object.keys(WIRED).sort().join() === Object.keys(PHONE_GATED_FEATURES).sort().join());
for (const [feature, file] of Object.entries(WIRED)) {
  const c = code(file);
  const wired = feature === "sms" ? /trialPhoneGate\(companyId\)/.test(c) && /phoneGateBody\("sms"\)/.test(c) : new RegExp(`phoneGateResponse\\(member, "${feature}"\\)`).test(c);
  ok(`${feature}: ${file}`, wired);
}
ok("bringing a number by PORT is gated too", /phoneGateResponse\(member, "business_number"\)/.test(code("app/api/settings/business-number/port/route.js")));
const sms = code("lib/sms/twilioClient.js");
ok("sendSms asks the gate after the demo branch and before Twilio", sms.indexOf("trialPhoneGate(companyId)") > sms.indexOf("recordSimulatedSms(") && sms.indexOf("trialPhoneGate(companyId)") < sms.indexOf("client.messages.create("));
const crew = code("app/api/crew/line/route.js");
ok("the crew line SEARCH is not gated, only the buy", crew.indexOf('phoneGateResponse(member, "crew_line")') > crew.indexOf('if (action === "buy")'));
ok("the gated routes refuse before the provider is called", (() => {
  const v = code("app/api/settings/voice/number/route.js");
  return v.indexOf('phoneGateResponse(member, "phone_number")') < v.indexOf("provisionSimulatedNumber(") || !/provisionSimulatedNumber\(/.test(v);
})());
ok("the prompt is mounted in the app shell", /<PhoneVerifyPrompt \/>/.test(code("app/app/layout.js")));
ok("fetchJson and reportResponseError open it", /phoneRequiredFrom\(res\.status, data\)/.test(code("lib/fetchJson.js")) && /phoneRequiredFrom\(res\.status, data\)/.test(code("lib/clientErrors.js")));
ok("the verify page and the billing card exist and call the route", /\/api\/settings\/phone-verification/.test(code("app/app/settings/verify-phone/page.js")) && /\/api\/settings\/phone-verification/.test(code("app/components/billing/TrialPhoneCard.js")) && /<TrialPhoneCard \/>/.test(code("app/app/settings/account-billing/page.js")));
ok("only an owner or admin may verify", /isBillingAdmin\(member\.role\)/.test(code("app/api/settings/phone-verification/route.js")));
ok("the route never returns a code", !/code: (sentCode|newCode|result\.code)/.test(code("app/api/settings/phone-verification/route.js")));

console.log("\n9. Who pays: the company's PHONE & TEXT credit, at cost × 2 (owner, 2026-10-04)");
{
  const { PHONE_VERIFY_KIND, PHONE_VERIFY_CHARGES, sendNeedCents, sendCreditVerdict } = await import("@/lib/trial/phoneVerifyBilling");
  const { poolForKind, POOLS } = await import("@/lib/voice/credits");
  ok("the kind lands in the VOICE wallet, never the AI one", poolForKind(PHONE_VERIFY_KIND) === POOLS.VOICE);
  // Worked numbers — Twilio list price, × 2, rounded UP, never under the text floor.
  ok("code text from our number: 0.83¢ × 2 = 1.66¢ → the 2¢ text floor", PHONE_VERIFY_CHARGES.text === 2);
  ok("Verify's own text: the same 2¢", PHONE_VERIFY_CHARGES.verifyText === 2);
  ok("Verify success: 5¢ × 2 = 10¢", PHONE_VERIFY_CHARGES.verifySuccess === 10);
  ok("Lookup: 0.8¢ × 2 = 1.6¢ → 2¢", PHONE_VERIFY_CHARGES.lookup === 2);
  ok("a Canadian mobile, first time: 2¢ lookup + 2¢ text = 4¢", sendNeedCents({ lookupNeeded: true, sender: "sms" }) === 4);
  ok("a resend (line type remembered): 2¢", sendNeedCents({ lookupNeeded: false, sender: "sms" }) === 2);
  ok("a US mobile through Verify: 2¢ + 2¢ + 10¢ = 14¢ (held for at the send)", sendNeedCents({ lookupNeeded: true, sender: "verify" }) === 14);
  for (const bad of [NaN, "abc", null, undefined, -50]) {
    const v = sendCreditVerdict({ balanceCents: bad, lookupNeeded: true, sender: "sms" });
    ok(`a balance of ${JSON.stringify(bad)} cannot pay`, v.ok === false && v.needCents === 4);
  }

  // The send, end to end against scripted Twilio and a scripted wallet.
  const run = async ({ balance, lookup = async () => lk("mobile"), sendSms = async () => ({ success: true, sid: "SM123" }), deliveryPath = "sms", phone = "(514) 555-0123", rows = [] }) => {
    const charges = [];
    const queued = [];
    const calls = { lookup: 0, sms: 0 };
    const r = await sendCode({
      companyId: "C1", phone, deliveryPath,
      deps: {
        prisma: fakeDb({ companies: [{ id: "C1" }], rows }), now: NOW, key: KEY,
        lookupLineType: async (e) => { calls.lookup++; return lookup(e); },
        sendSms: async (m) => { calls.sms++; return sendSms(m); },
        verifyStart: async () => "VE123",
        balanceFor: async () => balance,
        debitCredit: async (e) => { charges.push(e); return e; },
        enqueueUsage: async (u) => { queued.push(u); return u; },
      },
    });
    return { r, charges, queued, calls };
  };
  const empty = await run({ balance: 0 });
  ok("no phone & text credit → refused 'no_phone_credit' with what it needs (4¢) and has (0¢)", !empty.r.ok && empty.r.reasonKey === "no_phone_credit" && empty.r.needCents === 4 && empty.r.balanceCents === 0, empty.r);
  ok("…and NOTHING was spent: no Lookup, no text, no charge", empty.calls.lookup === 0 && empty.calls.sms === 0 && empty.charges.length === 0);
  const three = await run({ balance: 3 });
  ok("3¢ is not 4¢ → refused before Twilio", !three.r.ok && three.r.reasonKey === "no_phone_credit" && three.calls.lookup === 0);
  const paid = await run({ balance: 4 });
  ok("4¢ → the code goes", paid.r.ok, paid.r);
  ok("…charged twice: the Lookup 2¢ and the text 2¢, both kind phone_verification", paid.charges.length === 2 && paid.charges.every((c) => c.kind === PHONE_VERIFY_KIND) && paid.charges.map((c) => c.cents).join("+") === "2+2", JSON.stringify(paid.charges));
  ok("…the text keyed on Twilio's own SID (charged once however often it is recorded)", paid.charges[1].ref === "phone_verify_sms:SM123");
  ok("…and queued to settle at Twilio's price × 2, like any other text", paid.queued.length === 1 && paid.queued[0].sid === "SM123" && paid.queued[0].ledgerKind === PHONE_VERIFY_KIND && paid.queued[0].ledgerRef === "phone_verify_sms:SM123");
  ok("…the statement lines say what they were, with the number masked", /number check \+1 ••• ••• 0123/.test(paid.charges[0].note) && /code texted to \+1 ••• ••• 0123/.test(paid.charges[1].note));
  const voip = await run({ balance: 100, lookup: async () => lk("nonFixedVoip") });
  ok("a Lookup that REFUSES the number is still charged (Twilio charged for it), and no text goes", !voip.r.ok && voip.r.reasonKey === "voip" && voip.charges.length === 1 && voip.charges[0].cents === 2 && voip.calls.sms === 0);
  const down = await run({ balance: 100, lookup: async () => { throw new Error("down"); } });
  ok("a Lookup outage is not charged (no answer, no bill) — the text still goes", down.r.ok && down.charges.length === 1 && down.charges[0].ref.startsWith("phone_verify_sms:"));
  const failedSend = await run({ balance: 100, sendSms: async () => ({ success: false, error: "carrier" }) });
  ok("a text that did not send is not charged (only the Lookup)", !failedSend.r.ok && failedSend.charges.length === 1 && failedSend.charges[0].ref.startsWith("phone_verify_lookup:"));
  const demo = await run({ balance: 100, sendSms: async () => ({ success: true }) });
  ok("a simulated send (no SID — a demo account) is not charged for the text", demo.r.ok && demo.charges.every((c) => !c.ref.startsWith("phone_verify_sms:")));
  const remembered = await run({ balance: 2, rows: [{ id: "old", companyId: "C1", e164: MTL_CELL, lineType: "mobile", status: "expired", createdAt: new Date(NOW - 5 * 86400e3), attempts: 0, expiresAt: new Date(NOW - 5 * 86400e3) }] });
  ok("a number looked up in the last 30 days: no Lookup, so 2¢ is enough", remembered.r.ok && remembered.calls.lookup === 0 && remembered.charges.length === 1 && remembered.charges[0].cents === 2, remembered.r);
  const us = await run({ balance: 13, phone: "(212) 555-0142", deliveryPath: "verify", lookup: async () => lk("mobile", { countryCode: "US" }) });
  ok("Verify needs 14¢ up front (its success fee included) — 13¢ is refused", !us.r.ok && us.r.reasonKey === "no_phone_credit" && us.r.needCents === 14);
  const us2 = await run({ balance: 14, phone: "(212) 555-0142", deliveryPath: "verify", lookup: async () => lk("mobile", { countryCode: "US" }) });
  ok("…14¢ starts it: Lookup 2¢ + Verify's text 2¢ now", us2.r.ok && us2.charges.map((c) => c.cents).join("+") === "2+2" && us2.charges[1].ref === "phone_verify_send:VE123");

  // The success fee, on the check.
  const vdb = fakeDb({ companies: [{ id: "C1" }], rows: [{ id: "att1", companyId: "C1", e164: "+12125550142", sender: "verify", codeHash: null, status: "pending", attempts: 0, expiresAt: new Date(NOW + 600_000), createdAt: new Date(NOW) }] });
  const okCharges = [];
  const good = await checkCode({ companyId: "C1", code: "123456", deps: { prisma: vdb, now: NOW + 1000, verifyCheck: async () => true, balanceFor: async () => 0, debitCredit: async (e) => { okCharges.push(e); return e; } } });
  ok("Verify approves → the 10¢ success fee is charged once, on the attempt", good.ok && okCharges.length === 1 && okCharges[0].cents === 10 && okCharges[0].ref === "phone_verify_ok:att1" && okCharges[0].kind === PHONE_VERIFY_KIND);
  const sdb = fakeDb({ companies: [{ id: "C1" }] });
  const sent = await sendCode({ companyId: "C1", phone: MTL_CELL, deliveryPath: "sms", deps: { prisma: sdb, now: NOW, key: KEY, sendSms: async (m) => ({ success: true, sid: "SM9", body: m.body }), lookupLineType: async () => lk("mobile"), balanceFor: async () => 100, debitCredit: async (e) => e, enqueueUsage: async () => null } });
  const ownCharges = [];
  const wrongFirst = await checkCode({ companyId: "C1", code: "000000", deps: { prisma: sdb, now: NOW + 1000, key: KEY, balanceFor: async () => 0, debitCredit: async (e) => { ownCharges.push(e); return e; } } });
  ok("our own code checked: no success fee (we charge for the text, not the check)", sent.ok && ownCharges.length === 0 && (wrongFirst.ok || !wrongFirst.ok));

  // The screen: the right top-up, back to this page.
  const page = code("app/app/settings/verify-phone/page.js");
  ok("the page turns no_phone_credit into the phone & text top-up", /no_phone_credit/.test(page) && /\/api\/settings\/voice\/topup/.test(page) && /returnTo: "verify-phone"/.test(page));
  ok("…and settles the payment when Stripe sends the browser back", /\/api\/settings\/voice\/topup\?session_id=/.test(page));
  const topup = code("app/api/settings/voice/topup/route.js");
  ok("the top-up route returns to the verify page only from an allow-list", /verify-phone/.test(topup) && /RETURN_PAGES/.test(topup));
  const route = code("app/api/settings/phone-verification/route.js");
  ok("the route answers 402 with what the send needs", /no_phone_credit/.test(route) && /402/.test(route) && /needCents/.test(route));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
