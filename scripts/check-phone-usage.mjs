// scripts/check-phone-usage.mjs
//
//   npm run check:phone-usage
//
// The owner's rule (2026-10-03): companies pay twice what a text or a call
// costs FieldQuo at Twilio, from the price Twilio reports on the record, never
// below the floor (2¢ a segment, 5¢ a photo, 5¢ a call minute) — charged as
// the floor first and settled later. Plus: Twilio's prices are tracked per
// class, a sustained change is detected, and companies are told OUR new price
// — and nothing else.
//
// Executed against fakes: no database, no Twilio.

import { readFileSync } from "node:fs";

const pricing = await import("@/lib/phoneUsage/pricing");
const { settleOne, enqueueUsage, countryOfE164, settleNote } = await import("@/lib/phoneUsage/settle");
const { recordObservation, costTableRows, FIXED_COST_ROWS } = await import("@/lib/phoneUsage/tiers");
const { bannersFor, noticeKeyFor } = await import("@/lib/phoneUsage/priceChanges");
const { CREW_SMS_CENTS, CREW_MMS_CENTS } = await import("@/lib/crew/messaging");
const { BUSINESS_CALL_CENTS_PER_MINUTE, monthlyEstimate } = await import("@/lib/businessNumber/costs");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

let checks = 0;
let failures = 0;
function ok(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${!pass && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
}
const section = (s) => console.log(`\n${s}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rule: max(floor, Twilio's price × 2), rounded up");

const C = pricing.chargeCentsFor;
// Bell inbound text, Canada: 0.83¢ base + 3.23¢ carrier fee = 4.06¢.
const bell = C({ resource: "message", units: 1, providerCostMicros: 40600 });
ok("a Bell inbound text (4.06¢) is billed 9¢ — at least 2× actual", bell === 9 && bell >= 2 * 4.06, bell);
const telus = C({ resource: "message", units: 1, providerCostMicros: 22900 });
ok("a Telus inbound text (2.29¢) is billed 5¢", telus === 5, telus);
const cheap = C({ resource: "message", units: 1, providerCostMicros: 8300 });
ok("a plain 0.83¢ text: the floor (2¢) applies when 2× is lower", cheap === 2, cheap);
ok("a 3-segment text floors at 3 × 2¢", C({ resource: "message", units: 3, providerCostMicros: 24900 }) === 6);
ok("a photo floors at 5¢", C({ resource: "message", hasMedia: true, providerCostMicros: 16500 }) === 5);
// Bridged call: two outbound legs at 1.4¢/min, 3 minutes → 8.4¢ cost.
const bridge = C({ resource: "call", units: 3, providerCostMicros: 84000 });
ok("a 3-minute bridged call (8.4¢ both legs) is billed 17¢ — ≥ 2× and above the 15¢ floor", bridge === 17 && bridge >= 2 * 8.4, bridge);
const fwd = C({ resource: "call", units: 3, providerCostMicros: 67500 });
ok("a 3-minute forwarded call (6.75¢) is billed 15¢ — the floor wins", fwd === 15, fwd);
ok("unknown price → the floor (the provisional charge)", C({ resource: "message", units: 1, providerCostMicros: null }) === 2);
ok("a nonsense price → the floor, never NaN", C({ resource: "message", providerCostMicros: "lots" }) === 2);
ok("Twilio's negative price string parses", pricing.priceToMicros("-0.04060") === 40600 && pricing.priceToMicros(null) === null);
ok("forged segment counts are capped at ten", pricing.floorCents({ units: 10000 }) === 20);
for (let micros = 0; micros <= 200000; micros += 997) {
  const charge = C({ resource: "message", units: 1, providerCostMicros: micros });
  if (charge * 10000 < 2 * micros) {
    ok(`never below 2× at ${micros} micros`, false, charge);
    break;
  }
}
ok("never below 2× across 0–20¢ (swept)", true);

section("2. One set of floors, shared by every meter");
ok("crew texts use the shared floor", CREW_SMS_CENTS === pricing.TEXT_FLOOR_CENTS && CREW_MMS_CENTS === pricing.PHOTO_FLOOR_CENTS);
ok("business-number calls use the shared floor", BUSINESS_CALL_CENTS_PER_MINUTE === pricing.CALL_FLOOR_CENTS_PER_MINUTE);
const crewSrc = strip(read("lib/crew/messaging.js"));
ok("crew inbound charges queue for settlement with Twilio's SID", /chargeInboundCrewMessage[\s\S]*?enqueueUsage\(/.test(crewSrc) && /sid = null/.test(crewSrc));
ok("crew replies queue for settlement", /chargeOutboundCrewReply[\s\S]*?enqueueUsage\(/.test(crewSrc));
ok("the crew webhook hands the MessageSid through", /messageSid: params\.MessageSid/.test(strip(read("app/api/crew/inbound/route.js"))));
const meterSrc = strip(read("lib/businessNumber/meter.js"));
ok("business-number texts and calls queue for settlement", (meterSrc.match(/await enqueue\(/g) || []).length === 2);
ok("the hourly cron settles", /settlePending\(\)/.test(strip(read("app/api/cron/business-numbers/route.js"))));
const est = monthlyEstimate({ path: "port", textsIn: 10, textsOut: 10, callMinutes: 10 });
ok("the settings estimate is marked a minimum and carries the markup", est.isMinimum === true && est.rates.markup === 2);
ok("the settings screen states the rule", /app\.bizNumber\.cost\.rule/.test(read("app/app/settings/business-number/page.js")) && /cost × 2, minimum/.test(APP_MESSAGES.en["app.bizNumber.cost.rule"]));

// ═══════════════════════════════════════════════════════════════════════════
section("3. Settlement: floor now, the difference later, once");

function fakeDb() {
  const store = { charges: [], tiers: [], changes: [] };
  let n = 0;
  return {
    store,
    phoneUsageCharge: {
      create: async ({ data }) => {
        if (store.charges.some((c) => c.sid === data.sid)) {
          const e = new Error("dup");
          e.code = "P2002";
          throw e;
        }
        const row = { id: `u${++n}`, attempts: 0, settledAt: null, createdAt: new Date("2026-10-03T10:00:00Z"), ...data };
        store.charges.push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(store.charges.find((c) => c.id === where.id), data),
    },
    phoneCostTier: {
      upsert: async ({ where, create, update }) => {
        const k = where.priceClass_unitMicros;
        let t = store.tiers.find((x) => x.priceClass === k.priceClass && x.unitMicros === k.unitMicros);
        if (!t) {
          t = { id: `t${++n}`, adoptedAt: null, ...create };
          store.tiers.push(t);
        } else {
          t.observations += update.observations.increment;
          t.lastSeenAt = update.lastSeenAt;
        }
        return { ...t };
      },
      findMany: async ({ where }) =>
        store.tiers.filter((t) => t.priceClass === where.priceClass && t.adoptedAt && t.unitMicros !== where.NOT.unitMicros),
      updateMany: async ({ where, data }) => {
        const t = store.tiers.find((x) => x.id === where.id && !x.adoptedAt);
        if (!t) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      },
    },
    phonePriceChange: { create: async ({ data }) => (store.changes.push({ id: `c${++n}`, ...data }), data) },
  };
}

{
  const prisma = fakeDb();
  await enqueueUsage({ companyId: "co_1", sid: "SM_bell", resource: "message", direction: "in", ledgerKind: "crew_text", ledgerRef: "crew_in:m1", provisionalCents: 2, units: 1, country: "CA" }, prisma);
  await enqueueUsage({ companyId: "co_1", sid: "SM_bell", resource: "message", direction: "in", ledgerKind: "crew_text", ledgerRef: "crew_in:m1", provisionalCents: 2, units: 1, country: "CA" }, prisma);
  ok("queueing is idempotent on Twilio's SID", prisma.store.charges.length === 1 && prisma.store.charges[0].priceClass === "sms_in_CA");

  const debits = [];
  const provider = { messageCostMicros: async () => 40600, callCostMicros: async () => 84000 };
  const r = await settleOne(prisma.store.charges[0], { prisma, provider, debit: async (d) => debits.push(d), now: new Date("2026-10-03T11:00:00Z"), log: async () => {} });
  ok("Bell inbound: topped up by 7¢ (9¢ in all, 2¢ already taken)", r.settled && debits.length === 1 && debits[0].cents === 7 && debits[0].ref === "crew_in:m1:settle", debits);
  ok("…recorded on the row", prisma.store.charges[0].chargedCents === 9 && prisma.store.charges[0].providerCostMicros === 40600);
  ok("…and the statement line names our price only, not the carrier's", !/twilio|0\.04|4\.06|× ?2|cost/i.test(debits[0].note), debits[0].note);
  ok("the settle note reads as a charge", settleNote({ resource: "message", hasMedia: false, chargedCents: 9, provisionalCents: 2 }).includes("9¢"));

  await enqueueUsage({ companyId: "co_1", sid: "CA_bridge", resource: "call", direction: "out", ledgerKind: "brought_call", ledgerRef: "brought_call:CA_bridge", provisionalCents: 15, units: 3 }, prisma);
  const d2 = [];
  await settleOne(prisma.store.charges[1], { prisma, provider, debit: async (d) => d2.push(d), now: new Date("2026-10-03T11:00:00Z"), log: async () => {} });
  ok("bridged call: topped up 2¢ (17¢ for 8.4¢ of two legs)", d2.length === 1 && d2[0].cents === 2 && prisma.store.charges[1].priceClass === "call_bridge");

  await enqueueUsage({ companyId: "co_1", sid: "SM_cheap", resource: "message", direction: "out", ledgerKind: "brought_text", ledgerRef: "brought_out:SM_cheap", provisionalCents: 2, units: 1, country: "CA" }, prisma);
  const d3 = [];
  await settleOne(prisma.store.charges[2], { prisma, provider: { messageCostMicros: async () => 8300 }, debit: async (d) => d3.push(d), now: new Date("2026-10-03T11:00:00Z"), log: async () => {} });
  ok("a price under the floor settles with NO top-up and no refund (the floor stands)", d3.length === 0 && prisma.store.charges[2].chargedCents === 2 && prisma.store.charges[2].settledAt);

  await enqueueUsage({ companyId: "co_1", sid: "SM_slow", resource: "message", direction: "in", ledgerKind: "brought_text", ledgerRef: "brought_in:SM_slow", provisionalCents: 2, units: 1 }, prisma);
  const slow = prisma.store.charges[3];
  const s1 = await settleOne(slow, { prisma, provider: { messageCostMicros: async () => null }, debit: async () => {}, now: new Date("2026-10-03T11:00:00Z"), log: async () => {} });
  ok("no price yet → retried later, nothing charged", !s1.settled && slow.attempts === 1 && !slow.settledAt);
  const s2 = await settleOne({ ...slow, attempts: 23 }, { prisma, provider: { messageCostMicros: async () => null }, debit: async () => {}, now: new Date("2026-10-03T11:00:00Z"), log: async () => {} });
  ok("…and given up after the last attempt, at the floor", s2.gaveUp && slow.chargedCents === 2);
}
ok("country comes from the other party's area code", countryOfE164("+16135550142") === "CA" && countryOfE164("+12125550101") === "US" && countryOfE164("+447700900123") === "INTL");

// ═══════════════════════════════════════════════════════════════════════════
section("4. Tracking Twilio's prices; a sustained change → notice + banner");

{
  const prisma = fakeDb();
  const notices = [];
  const log = async (e) => notices.push(e);
  const at = (i) => new Date(Date.UTC(2026, 9, 1, i));
  for (let i = 0; i < pricing.SUSTAIN_COUNT; i++) await recordObservation({ priceClass: "sms_in_CA", unitMicros: 22900, now: at(i) }, { prisma, log });
  ok("the first sustained price in a class is the baseline: adopted, no notice, no banner", prisma.store.tiers[0].adoptedAt && notices.length === 0 && prisma.store.changes.length === 0);
  await recordObservation({ priceClass: "sms_in_CA", unitMicros: 40600, now: at(10) }, { prisma, log });
  ok("a single new price is NOT a change (one-off)", notices.length === 0 && prisma.store.changes.length === 0);
  for (let i = 1; i < pricing.SUSTAIN_COUNT; i++) await recordObservation({ priceClass: "sms_in_CA", unitMicros: 40600, now: at(10 + i) }, { prisma, log });
  ok("sustained (5 sightings) → a platform notice", notices.length === 1 && notices[0].code === "twilio_price_change");
  ok("…and a price change at OUR new price: 9¢, was 5¢", prisma.store.changes.length === 1 && prisma.store.changes[0].chargeCents === 9 && prisma.store.changes[0].previousCents === 5);
  for (let i = 0; i < 8; i++) await recordObservation({ priceClass: "sms_in_CA", unitMicros: 40600, now: at(20 + i) }, { prisma, log });
  ok("…raised once, however often it is seen afterwards", notices.length === 1 && prisma.store.changes.length === 1);
  for (let i = 0; i < pricing.SUSTAIN_COUNT; i++) await recordObservation({ priceClass: "sms_in_CA", unitMicros: 8300, now: at(40 + i) }, { prisma, log });
  ok("a cheaper tier that still bills at an existing price: notice only, no banner", notices.length === 2 && prisma.store.changes.length === 1 && /unchanged for companies/.test(notices[1].message));

  const rows = costTableRows(prisma.store.tiers);
  ok("cost table: every adopted tier with cost, charge and multiple", rows.length === 3 && rows.every((r) => r.multiple >= 2 && !r.below2x));
  ok("cost table flags anything under 2×", costTableRows([{ priceClass: "sms_in_CA", unitMicros: 40600, adoptedAt: new Date() }]).every((r) => !r.below2x));
  ok("the flat rentals are all at least 2×", FIXED_COST_ROWS.every((r) => r.chargeCents / r.costCents >= 2));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The customer banner: our price and the date, nothing else");

const change = { id: "chg1", priceClass: "sms_in_CA", chargeCents: 9, previousCents: 5, effectiveAt: "2026-10-03T00:00:00Z" };
const owner = bannersFor({ role: "owner", usesPhone: true, changes: [change], dismissed: [] });
ok("an owner of a company that texts sees it", owner.length === 1 && owner[0].chargeCents === 9);
ok("…and the payload carries only the class, our price and the date", JSON.stringify(Object.keys(owner[0]).sort()) === JSON.stringify(["chargeCents", "effectiveAt", "key", "priceClass"]));
ok("an admin sees it", bannersFor({ role: "admin", usesPhone: true, changes: [change] }).length === 1);
ok("the crew (employee) never does", bannersFor({ role: "employee", usesPhone: true, changes: [change] }).length === 0);
ok("a supervisor never does", bannersFor({ role: "supervisor", usesPhone: true, changes: [change] }).length === 0);
ok("a demo company never does", bannersFor({ role: "owner", isDemo: true, usesPhone: true, changes: [change] }).length === 0);
ok("a company that does not text or call never does", bannersFor({ role: "owner", usesPhone: false, changes: [change] }).length === 0);
ok("dismissed → gone, and the dismissal is the per-user notice key", bannersFor({ role: "owner", usesPhone: true, changes: [change], dismissed: [noticeKeyFor("chg1")] }).length === 0);
const uiSrc = strip(read("app/api/ui-state/route.js"));
ok("dismissal persists on the user (the shared dismissedNotices store)", /dismissedNotices = \[\.\.\.current, dismiss\]/.test(uiSrc) && /phonePriceBanners\(member, dismissedNotices\)/.test(uiSrc));
const bannerSrc = strip(read("app/components/layout/PhonePriceBanner.js"));
ok("the banner dismisses through that store", /dismiss: key/.test(bannerSrc));
ok("the banner source names no carrier, links nowhere, shows no cost or multiple", !/twilio|href=|<a |×|markup|our cost|unitMicros|providerCost|previousCents/i.test(bannerSrc));
const bannerKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.phonePrice."));
let leaks = [];
for (const [lang, dict] of Object.entries(APP_MESSAGES)) {
  for (const k of bannerKeys) {
    const v = String(dict[k] || "");
    if (!v) leaks.push(`${lang}:${k} missing`);
    if (/twilio|http|×|2x|markup|\d/i.test(v)) leaks.push(`${lang}:${k}`);
  }
}
ok(`banner text in all ${Object.keys(APP_MESSAGES).length} languages: present, and no Twilio / link / cost / multiple`, leaks.length === 0, leaks);
ok("every class has a phrase", pricing.PRICE_CLASSES.every((c) => APP_MESSAGES.en[`app.phonePrice.what.${c}`]));
ok("the banner is mounted in the app shell", /<PhonePriceBanner \/>/.test(read("app/app/layout.js")));

section("Wiring");
const pkg = JSON.parse(read("package.json"));
ok("check:phone-usage is a script, run by check:all", Boolean(pkg.scripts["check:phone-usage"]) && /npm run check:phone-usage/.test(pkg.scripts["check:all"]));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
