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
  const r = await sendCode({ companyId: "C1", userId: "U1", phone: "(514) 555-0123", deliveryPath: "sms", deps });
  ok("a CA mobile: one text from our own number, masked back", r.ok && texts.length === 1 && r.masked === "+1 ••• ••• 0123", r);
  ok("…the text carries NO companyId (it must not meet the gate it opens)", !("companyId" in texts[0]) && texts[0].purpose === "phone_verification");
  const sentCode = /(\d{6})/.exec(texts[0].body)?.[1];
  ok("…the code is stored only as its hash", db.store.rows[0].codeHash === hashCode({ companyId: "C1", e164: MTL_CELL, code: sentCode, key: KEY }) && !JSON.stringify(db.store.rows).includes(sentCode));
  ok("…one Lookup for the number", lookups.length === 1 && db.store.rows[0].lineType === "mobile");
  const again = await sendCode({ companyId: "C1", phone: "(514) 555-0123", deliveryPath: "sms", deps: { ...deps, now: NOW + 10_000 } });
  ok("a second send 10 s later → too_soon, nothing sent", !again.ok && again.reasonKey === "too_soon" && texts.length === 1);
  const later = await sendCode({ companyId: "C1", phone: "(514) 555-0123", deliveryPath: "sms", deps: { ...deps, now: NOW + 2 * 60_000 } });
  ok("two minutes later → sent, and the Lookup answer is reused (no second US$0.008)", later.ok && texts.length === 2 && lookups.length === 1);
  ok("…and the earlier code stops working", db.store.rows[0].status === "expired");

  // Check the code.
  const lastCode = /(\d{6})/.exec(texts[1].body)[1];
  const wrong = await checkCode({ companyId: "C1", code: lastCode === "000000" ? "111111" : "000000", deps: { prisma: db, now: NOW + 3 * 60_000, key: KEY } });
  ok("a wrong code → wrong_code, and the miss is counted", !wrong.ok && wrong.reasonKey === "wrong_code" && db.store.rows[1].attempts === 1);
  const right = await checkCode({ companyId: "C1", code: lastCode, deps: { prisma: db, now: NOW + 3 * 60_000, key: KEY } });
  ok("the right code → verified, and the company is stamped", right.ok && db.store.companies[0].trialPhoneE164 === MTL_CELL && db.store.companies[0].trialPhoneVerifiedAt instanceof Date);
  ok("…the attempt is approved and cannot be reused", db.store.rows[1].status === "approved" && !(await checkCode({ companyId: "C1", code: lastCode, deps: { prisma: db, now: NOW + 4 * 60_000, key: KEY } })).ok);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }, { id: "OTHER", trialPhoneE164: MTL_CELL, trialPhoneVerifiedAt: new Date(NOW - 86400e3) }] });
  let sent = 0;
  const r = await sendCode({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a number another trial verified → already_used, before any text", !r.ok && r.reasonKey === "already_used" && sent === 0);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }] });
  let sent = 0;
  const r = await sendCode({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("nonFixedVoip") } });
  ok("a VoIP number → refused, nothing sent, nothing stored", !r.ok && r.reasonKey === "voip" && sent === 0 && db.store.rows.length === 0);
  const down = await sendCode({ companyId: "C1", phone: "514 555 0123", deliveryPath: "sms", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => { throw new Error("lookup down"); } } });
  ok("Lookup down → the text still goes", down.ok && sent === 1);
  const failed = await sendCode({ companyId: "C1", phone: "514 555 0124", deliveryPath: "sms", deps: { prisma: db, now: NOW + 5 * 60_000, key: KEY, sendSms: async () => ({ success: false, error: "carrier" }), lookupLineType: async () => lk("mobile") } });
  ok("Twilio refused the text → unavailable, and no pending code is left that can't arrive", !failed.ok && failed.reasonKey === "unavailable" && db.store.rows.length === 1);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }] });
  let sms = 0;
  let started = null;
  const usCell = "(212) 555-0199";
  const r = await sendCode({ companyId: "C1", phone: usCell, deliveryPath: "verify", deps: { prisma: db, now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile", { countryCode: "US" }), verifyStart: async (e) => { started = e; return true; } } });
  ok("a US mobile while our number can't text the US → Twilio Verify, not our number", r.ok && started === "+12125550199" && sms === 0 && db.store.rows[0].sender === "verify" && db.store.rows[0].codeHash === null);
  let checked = null;
  const v = await checkCode({ companyId: "C1", code: "123456", deps: { prisma: db, now: NOW + 60_000, verifyCheck: async (e, c) => { checked = [e, c]; return true; } } });
  ok("…and the code is checked by Verify", v.ok && checked?.[0] === "+12125550199" && checked?.[1] === "123456");
  const ca = await sendCode({ companyId: "C2", phone: "(514) 555-0177", deliveryPath: "verify", deps: { prisma: fakeDb({ companies: [{ id: "C2" }] }), now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a CANADIAN mobile always goes through our own (cheaper) number", ca.ok && sms === 1);
  const none = await sendCode({ companyId: "C3", phone: usCell, deliveryPath: null, deps: { prisma: fakeDb({ companies: [{ id: "C3" }] }), now: NOW, key: KEY, sendSms: async () => { sms++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("a US mobile with no way to reach it → unavailable, nothing sent", !none.ok && none.reasonKey === "unavailable" && sms === 1);
}
{
  const db = fakeDb({ companies: [{ id: "C1" }, { id: "C2" }] });
  const texts = [];
  const deps = (now) => ({ prisma: db, now, key: KEY, sendSms: async (m) => { texts.push(m); return { success: true }; }, lookupLineType: async () => lk("mobile") });
  await sendCode({ companyId: "C1", phone: MTL_CELL, deliveryPath: "sms", deps: deps(NOW) });
  await sendCode({ companyId: "C2", phone: MTL_CELL, deliveryPath: "sms", deps: deps(NOW + 1000) });
  const c1 = /(\d{6})/.exec(texts[0].body)[1];
  const c2 = /(\d{6})/.exec(texts[1].body)[1];
  ok("two trials racing for one number: the first wins", (await checkCode({ companyId: "C1", code: c1, deps: { prisma: db, now: NOW + 2000, key: KEY } })).ok);
  const loser = await checkCode({ companyId: "C2", code: c2, deps: { prisma: db, now: NOW + 3000, key: KEY } });
  ok("…the second, re-asked at the write, is refused already_used", !loser.ok && loser.reasonKey === "already_used" && !db.store.companies[1].trialPhoneVerifiedAt);
}

{
  const saved = { a: process.env.PHONE_CODE_SECRET, b: process.env.BETTER_AUTH_SECRET };
  delete process.env.PHONE_CODE_SECRET;
  delete process.env.BETTER_AUTH_SECRET;
  let sent = 0;
  const r = await sendCode({ companyId: "C9", phone: MTL_CELL, deliveryPath: "sms", deps: { prisma: fakeDb({ companies: [{ id: "C9" }] }), now: NOW, sendSms: async () => { sent++; return { success: true }; }, lookupLineType: async () => lk("mobile") } });
  ok("no secret to hash with → unavailable, and NOTHING is sent (a code we can't store can't be checked)", !r.ok && r.reasonKey === "unavailable" && sent === 0);
  if (saved.a !== undefined) process.env.PHONE_CODE_SECRET = saved.a;
  if (saved.b !== undefined) process.env.BETTER_AUTH_SECRET = saved.b;
}

console.log("\n7. The refusal and the door");
const body = phoneGateBody("ai_call");
ok("a gated route's refusal names the fix and carries the code", body.code === PHONE_REQUIRED_CODE && body.phoneVerification.path === "/app/settings/verify-phone" && /Verify a mobile number/.test(body.error));
ok("an unknown feature never echoes the caller's string", phoneGateBody("<script>").phoneVerification.feature === null);
ok("the browser opens the prompt only for 403 + the code", phoneRequiredPayload(403, body) && !phoneRequiredPayload(402, body) && !phoneRequiredPayload(403, { error: "Forbidden" }));
ok("every refusal key has words", ["invalid", "country", "voip", "not_mobile", "already_used", "too_soon", "rate_limited", "unavailable", "wrong_code", "expired", "too_many", "no_code", "not_needed"].every((k) => typeof REFUSALS[k] === "string"));

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
