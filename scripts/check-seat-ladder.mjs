// scripts/check-seat-ladder.mjs
//
// What a company is charged, and who counts as a seat.
//
// ══ The loophole this exists to close ══════════════════════════════════════
//
// Billing on the ROLE name is gameable, and not subtly. clampPermissions
// restricts what a GRANTER may hand out, and owners and admins are
// unrestricted:
//
//     if (actorRole === "owner" || actorRole === "admin") return requested;
//
// So an owner can set twenty estimators to Crew — free — and then hand each one
// `quotes: view_create_edit` through the custom grid. Twenty people writing
// quotes on a one-seat plan, every row on screen labelled Crew. The assertions
// below run exactly that attack.
//
// ══ And the one that costs money the other way ═════════════════════════════
//
// A promotion with no end date, or one nobody remembered to switch off, is a
// permanent discount wearing a promotion's clothes. `endsAt` is required and
// checked against the clock, not against whether somebody tidied up.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-seat-ladder.mjs

import {
  SEAT_LADDER,
  ladderFor,
  tierFor,
  countSeats,
  isBillableSeat,
  priceFor,
  promotionIsLive,
  promotionApplies,
  currencyForCountry,
  currencyLabel,
  SUPPORTED_CURRENCIES,
  ANNUAL_FREE_MONTHS,
  defaultAnnualPrice,
  annualComparison,
  annualDeal,
  annualDealText,
  planMoney,
  customTier,
  customTierFor,
  customPlanSplit,
  customSeatsFromTierKey,
  customPlanName,
  customSeatsAllowed,
  CUSTOM_CREW_GAP,
  CUSTOM_SEAT_PRICE,
  CUSTOM_MIN_SEATS,
  CUSTOM_MAX_SEATS,
  CUSTOM_QUICK_PICKS,
  MAX_COMPANY_PEOPLE,
} from "@/lib/pricing/ladder";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { MESSAGES } from "@/app/i18n/messages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const member = (preset, over = {}) => ({
  role: PRESET_TO_ROLE[preset] || "employee",
  permissions: { ...PERMISSION_PRESETS[preset].values, ...(over.permissions || {}) },
  active: true,
  ...over,
});

console.log("\nThe ladder the owner signed off");
const shape = SEAT_LADDER.map((t) => `${t.seats}+${t.crewSeats}=${t.seats + t.crewSeats}`);
ok("four rungs", SEAT_LADDER.length === 4);
ok("seats are 1 / 3 / 6 / 10",
  JSON.stringify(SEAT_LADDER.map((t) => t.seats)) === "[1,3,6,10]");
ok("crew are 5 / 8 / 11 / 15",
  JSON.stringify(SEAT_LADDER.map((t) => t.crewSeats)) === "[5,8,11,15]");
// The numbers that go on the pricing page.
ok("people are 6 / 11 / 17 / 25",
  JSON.stringify(SEAT_LADDER.map((t) => t.seats + t.crewSeats)) === "[6,11,17,25]",
  shape.join(" "));
ok("prices are 99 / 169 / 269 / 369",
  JSON.stringify(SEAT_LADDER.map((t) => t.price)) === "[99,169,269,369]");

console.log("\nA seat is what you can DO, not what you are called");
ok("Crew is free", isBillableSeat(member("worker")) === false);
// Estimator IS a seat, and this assertion flipping is the point of that preset
// existing. It was "Worker (full view)": free, because view_only sits below the
// billing threshold, while holding showPricing and the whole client book — so a
// company could seat forty of them and give forty people the rate card for
// nothing. It creates quotes now, which is what makes it billable.
//
// Note what it is NOT: role `employee`, so no `user:manage`. Dispatcher and
// Manager reach the billing tier through `supervisor`, which carries authority
// over people that an estimator has no use for. A role can be PAID without
// being SENIOR, and that is only expressible because seats are counted off the
// grid rather than the role.
ok("Estimator IS a seat — it writes quotes",
  isBillableSeat(member("estimator")) === true);
ok("...without becoming a supervisor",
  PRESET_TO_ROLE.estimator === "employee");
ok("Dispatcher is a seat", isBillableSeat(member("dispatcher")) === true);
ok("Manager is a seat", isBillableSeat(member("manager")) === true);
ok("Owner is a seat", isBillableSeat({ role: "owner", permissions: null, active: true }) === true);
ok("Admin is a seat", isBillableSeat({ role: "admin", permissions: null, active: true }) === true);

// ── The attack ──────────────────────────────────────────────────────────────
// Role says employee. Grid says they can write quotes. They are a seat.
const smuggled = member("worker", { permissions: { quotes: "view_create_edit" } });
ok("a Crew member GRANTED quote-create is a seat", isBillableSeat(smuggled) === true);
ok("...and via jobs", isBillableSeat(member("worker", { permissions: { jobs: "view_create_edit" } })) === true);
ok("...and via invoices", isBillableSeat(member("worker", { permissions: { invoices: "view_create_edit" } })) === true);
// requests is the same act one screen earlier.
ok("...and via requests", isBillableSeat(member("worker", { permissions: { requests: "view_create_edit" } })) === true);
// Twenty smuggled estimators must not fit on a one-seat plan.
const attack = countSeats([
  { role: "owner", permissions: null, active: true },
  ...Array.from({ length: 20 }, () => smuggled),
]);
ok("twenty smuggled estimators count as twenty-one seats", attack.seats === 21, attack.seats);
ok("...and therefore fit no PUBLISHED rung — only a custom size, priced for all twenty-one",
  tierFor(attack)?.custom === true && tierFor(attack).seats === 21);

console.log("\nWho is NOT billed");
const roster = [
  { role: "owner", permissions: null, active: true },
  member("dispatcher"),
  member("worker"),
  member("worker"),
  member("manager", { active: false }),   // deactivated
];
const counted = countSeats(roster);
ok("a deactivated manager is not a seat", counted.seats === 2, counted.seats);
ok("crew counted separately", counted.crew === 2, counted.crew);
ok("an empty roster costs nothing", countSeats([]).seats === 0);
ok("garbage in the roster does not become a seat",
  countSeats([null, undefined, 42, "x"]).seats === 0);

console.log("\nWhich tier fits — crew counts, not just seats");
ok("1 seat + 2 crew is Solo", tierFor({ seats: 1, crew: 2 })?.tierKey === "solo");
// The trap: seats fit Solo, crew do not. Answering Solo would seat six people
// and lock four out with no explanation.
ok("1 seat + 9 crew is NOT Solo", tierFor({ seats: 1, crew: 9 })?.tierKey !== "solo");
ok("2 seats + 6 crew is Crew", tierFor({ seats: 2, crew: 6 })?.tierKey === "crew");
ok("6 + 11 is Shop exactly at the boundary", tierFor({ seats: 6, crew: 11 })?.tierKey === "shop");
ok("12 seats is not the top tier — it is the smallest custom size that holds them",
  tierFor({ seats: 12, crew: 4 })?.tierKey === "custom-12");
ok("more than a hundred people is a conversation, not a plan", tierFor({ seats: 48, crew: 0 }) === null && tierFor({ seats: 10, crew: 91 }) === null);

console.log("\nA promotion ends on its date, not when somebody remembers");
const promo = {
  active: true, label: "3 months", endsAt: new Date("2026-09-01"),
  discountKind: "percent", discountValue: 30, durationMonths: 3,
};
ok("live the day before", promotionIsLive(promo, new Date("2026-08-31")) === true);
ok("dead ON the end date", promotionIsLive(promo, new Date("2026-09-01")) === false);
ok("dead after", promotionIsLive(promo, new Date("2026-09-02")) === false);
ok("the switch beats the date", promotionIsLive({ ...promo, active: false }, new Date("2026-08-01")) === false);
// A discount with no end is a price. Refused rather than honoured for ever.
ok("no end date is not a promotion", promotionIsLive({ ...promo, endsAt: null }, new Date("2026-08-01")) === false);
ok("a junk end date is not a promotion",
  promotionIsLive({ ...promo, endsAt: "not a date" }, new Date("2026-08-01")) === false);
ok("not yet started", promotionIsLive({ ...promo, startsAt: new Date("2026-09-10"), endsAt: new Date("2026-10-01") }, new Date("2026-08-27")) === false);

console.log("\nThe price it produces");
const solo = SEAT_LADDER[0];
const at = (d) => priceFor({ tier: solo, currency: "CAD", promotion: promo, now: new Date(d) });
const during = at("2026-08-27");
ok("30% off 99 is 69.30", during.now === 69.3, during.now);
ok("it always reports what it reverts to", during.revertsTo === 99);
ok("and for how long", during.durationMonths === 3);
ok("and the saving", during.saving === 29.7, during.saving);
ok("after expiry it is the full price", at("2026-09-02").now === 99);
ok("...and says no promotion was applied", at("2026-09-02").promoApplied === false);
// Stripe rejects a zero unit_amount on a one-time line, so a typo that zeroes
// the price must not render as free — it must not move the price at all.
ok("a 100% discount is refused, not rendered free",
  priceFor({ tier: solo, promotion: { ...promo, discountValue: 100 }, now: new Date("2026-08-27") }).now === 99);
ok("a discount bigger than the price is refused",
  priceFor({ tier: solo, promotion: { ...promo, discountKind: "amount", discountValue: 500 }, now: new Date("2026-08-27") }).now === 99);
ok("a zero discount does not claim a promotion",
  priceFor({ tier: solo, promotion: { ...promo, discountValue: 0 }, now: new Date("2026-08-27") }).promoApplied === false);
ok("no promotion at all is just the price",
  priceFor({ tier: solo, promotion: null }).now === 99);

console.log("\nScoping a promotion to some tiers or currencies");
ok("empty lists mean everything", promotionApplies({}, { tierKey: "solo", currency: "CAD" }) === true);
ok("a tier list excludes the others",
  promotionApplies({ tierKeys: ["shop"] }, { tierKey: "solo", currency: "CAD" }) === false);
ok("a currency list excludes the others",
  promotionApplies({ currencies: ["USD"] }, { tierKey: "solo", currency: "CAD" }) === false);
ok("and includes its own",
  promotionApplies({ tierKeys: ["solo"], currencies: ["CAD"] }, { tierKey: "solo", currency: "CAD" }) === true);

// ── Which commitment (2026-09-28) ─────────────────────────────────────────
// A promotion now says whether it discounts the monthly price, the 1-year
// commitment, or both; a row from before the field is monthly, which is what
// priceFor always did with it. The year's own arithmetic (twelve months of
// the monthly price, never stacked on the standing offer) is
// check:promotions-live's; here, only the scope and the monthly side.
ok("a promotion with no appliesTo covers the month only",
  promotionApplies({}, { tierKey: "solo", currency: "CAD", interval: "month" }) === true &&
    promotionApplies({}, { tierKey: "solo", currency: "CAD", interval: "year" }) === false);
ok('"year" covers the year and not the month',
  promotionApplies({ appliesTo: "year" }, { tierKey: "solo", currency: "CAD", interval: "year" }) === true &&
    promotionApplies({ appliesTo: "year" }, { tierKey: "solo", currency: "CAD", interval: "month" }) === false);
ok('"both" covers both', ["month", "year"].every((interval) => promotionApplies({ appliesTo: "both" }, { tierKey: "crew", currency: "AUD", interval })));
ok("asked without an interval, the scope answers as before", promotionApplies({ appliesTo: "year" }, { tierKey: "solo", currency: "CAD" }) === true);
ok('a custom size is matched by "custom" in the tier list, and not by the rungs',
  promotionApplies({ tierKeys: ["custom"] }, { tierKey: "custom-20", currency: "USD" }) === true &&
    promotionApplies({ tierKeys: ["scale"] }, { tierKey: "custom-20", currency: "USD" }) === false);
ok("an AUD scope reaches AUD", promotionApplies({ currencies: ["AUD"] }, { tierKey: "solo", currency: "AUD" }) === true);
ok("priceFor leaves the monthly price alone under a 1-year-only promotion",
  priceFor({ tier: solo, promotion: { ...promo, appliesTo: "year" }, now: new Date("2026-08-27") }).now === 99);
ok("...and still discounts it under \"both\"",
  priceFor({ tier: solo, promotion: { ...promo, appliesTo: "both" }, now: new Date("2026-08-27") }).now === 69.3);

console.log("\nCurrency comes from the address, and cannot be chosen");
ok("Canada is CAD", currencyForCountry("CA") === "CAD");
ok("the United States is USD", currencyForCountry("US") === "USD");
ok("spelled out works too", currencyForCountry("Canada") === "CAD" && currencyForCountry("united states") === "USD");
// The two prices are the same NUMBER, not a conversion — so picking a currency
// is picking a discount. Unknown must therefore never resolve to one.
ok("no country is NOT CAD", currencyForCountry(null) === null);
ok("an empty country is NOT CAD", currencyForCountry("  ") === null);
// The owner, 2026-09-24: Australia pays the same numbers in AUD; any other
// country Stripe serves pays them in USD; no GBP or EUR rows.
ok("Australia is AUD", currencyForCountry("AU") === "AUD" && currencyForCountry("australia") === "AUD");
ok("the United Kingdom is billed on the USD rows, not GBP", currencyForCountry("GB") === "USD");
ok("...spelled UK too", currencyForCountry("uk") === "USD");
ok("an EU country is billed on the USD rows, not EUR", currencyForCountry("DE") === "USD" && currencyForCountry("ie") === "USD");
ok("New Zealand (Stripe-served, not Australia) is USD", currencyForCountry("NZ") === "USD");
ok("a country Stripe does not serve is null, not a guess", currencyForCountry("UA") === null && currencyForCountry("KE") === null);
ok("a non-country is null", currencyForCountry("ZZ") === null && currencyForCountry("__proto__") === null && currencyForCountry("constructor") === null);
ok("AUD is a priced currency", SUPPORTED_CURRENCIES.includes("AUD") && !SUPPORTED_CURRENCIES.includes("GBP") && !SUPPORTED_CURRENCIES.includes("EUR"));
// A bare $ in front of an American price shown to a Canadian is the ambiguity
// the address rule exists to remove.
ok("USD is written US$", currencyLabel("USD") === "US$");
ok("CAD is written CA$", currencyLabel("CAD") === "CA$");
ok("AUD is written A$", currencyLabel("AUD") === "A$");

console.log("\nA year's commitment actually saves money");
// It did not. The owner said "billed annually instead of the no commitment" and
// that was built literally — same rate, one charge. A commitment that saves
// nothing asks a customer to give up flexibility for nothing, so nobody takes
// it, so the commitment is never bought. Two months free now.
ok("the default is two months free", ANNUAL_FREE_MONTHS === 2);
for (const tier of SEAT_LADDER) {
  const annual = defaultAnnualPrice(tier.price);
  ok(`${tier.label}: a year costs ten months, not twelve`, annual === tier.price * 10, annual);
  const c = annualComparison({ priceMonthly: tier.price, priceAnnual: annual });
  ok(`  ...and it says it saves ${"$"}${c.saves}`, c.saves === tier.price * 2, c.saves);
  ok("  ...at 17%", c.percent === 17, c.percent);
  // The number a buyer checks against the monthly price on the next card.
  ok("  ...with an effective monthly rate below the monthly price", c.perMonth < tier.price);
}
// A plan with no annual price has no annual option — not a free one.
const none = annualComparison({ priceMonthly: 99, priceAnnual: null });
ok("no annual price means no annual option", none.available === false && none.saves === 0);
// And a badge must never print "Save $0".
const same = annualComparison({ priceMonthly: 99, priceAnnual: 1188 });
ok("an annual price equal to twelve months saves nothing, and says so", same.saves === 0);

console.log("\nThe year is SAID as a deal, from the row's own numbers");
// The owner read "CA$99.00/mo" over "CA$990.00/yr" on /platform/billing/plans
// as a mistake — "did you not know that a year has 12 months". annualDeal()
// is the one wording every surface prints under a yearly figure; these run
// it against rows the console can hold, not just the seeded default.
{
  const cad = (n) => planMoney(n, "CAD");
  const say = (m, a) => annualDealText(annualDeal({ priceMonthly: m, priceAnnual: a }), { money: cad });

  // Whole months — the ladder's own deal on every rung.
  for (const tier of SEAT_LADDER) {
    const d = annualDeal({ priceMonthly: tier.price, priceAnnual: defaultAnnualPrice(tier.price) });
    ok(`${tier.label}: pay ${12 - ANNUAL_FREE_MONTHS} months, get 12`,
      d.kind === "months" && d.monthsPaid === 12 - ANNUAL_FREE_MONTHS && d.saves === tier.price * 2 && !d.warning,
      JSON.stringify(d));
  }
  ok("Solo CAD reads exactly as the owner was promised",
    say(99, 990) === "pay 10 months, get 12 (saves CA$198.00 vs monthly)", say(99, 990));
  {
    const crew = annualDeal({ priceMonthly: 169, priceAnnual: 1690 });
    const usd = annualDealText(crew, { money: (n) => planMoney(n, "USD") });
    const aud = annualDealText(crew, { money: (n) => planMoney(n, "AUD") });
    ok("USD and AUD rows say it in their own money",
      usd.includes(planMoney(338, "USD")) && aud.includes(planMoney(338, "AUD")) && usd !== aud, `${usd} / ${aud}`);
  }
  // The effective monthly price the customer redesign will show large.
  ok("perMonth is the year over twelve, to the cent",
    annualDeal({ priceMonthly: 99, priceAnnual: 990 }).perMonth === 82.5 &&
    annualDeal({ priceMonthly: 99, priceAnnual: 1039.5 }).perMonth === 86.63 &&
    annualDeal({ priceMonthly: 0, priceAnnual: 990 }).perMonth === 82.5 &&
    annualDeal({ priceMonthly: 99, priceAnnual: null }).perMonth === undefined);
  // Never the default: a row edited to nine months says nine.
  ok("an edited row's months are divided out, not assumed", annualDeal({ priceMonthly: 99, priceAnnual: 891 }).monthsPaid === 9);
  ok("one month is singular", say(99, 99) === "pay 1 month, get 12 (saves CA$1,089.00 vs monthly)", say(99, 99));
  // Prisma Decimals arrive as strings.
  ok("Decimal strings read the same as numbers",
    JSON.stringify(annualDeal({ priceMonthly: "99.00", priceAnnual: "990.00" })) === JSON.stringify(annualDeal({ priceMonthly: 99, priceAnnual: 990 })));
  // Whole-ness is decided in cents, so float noise cannot make it fractional.
  ok("cents that divide exactly are whole months", annualDeal({ priceMonthly: 33.33, priceAnnual: 333.3 }).monthsPaid === 10);

  // Fractional — money and a percentage, never "pay 10.5 months".
  const frac = annualDeal({ priceMonthly: 99, priceAnnual: 1039.5 });
  ok("10.5 months is a fraction, not a month count",
    frac.kind === "fraction" && frac.monthsEquivalent === 10.5 && frac.monthsPaid === undefined, JSON.stringify(frac));
  ok("...saving CA$148.50, 12.5%", frac.saves === 148.5 && frac.percent === 12.5, `${frac.saves} ${frac.percent}`);
  ok("...said as money and percent", say(99, 1039.5) === "saves CA$148.50 (12.5%) vs 12 × monthly", say(99, 1039.5));
  ok("a percentage keeps one decimal", annualDeal({ priceMonthly: 100, priceAnnual: 1000.01 }).percent === 16.7);

  // No discount — exactly twelve months.
  const flat = annualDeal({ priceMonthly: 99, priceAnnual: 1188 });
  ok("twelve months is no discount, flagged",
    flat.kind === "noDiscount" && flat.warning === true && flat.extra === 0 && flat.saves === 0, JSON.stringify(flat));
  ok("...and says so", say(99, 1188) === "no annual discount — same as 12 × monthly", say(99, 1188));

  // More expensive than monthly — a typo until proven otherwise.
  const dear = annualDeal({ priceMonthly: 99, priceAnnual: 1200 });
  ok("a year dearer than twelve months is flagged, never a negative saving",
    dear.kind === "noDiscount" && dear.warning === true && dear.saves === 0 && dear.extra === 12, JSON.stringify(dear));
  ok("...and says by how much", say(99, 1200) === "no annual discount — costs CA$12.00 more than 12 × monthly", say(99, 1200));

  // Null — and every other shape of "no annual price" annualPriceOf refuses.
  for (const a of [null, undefined, "", 0, -990, "abc", NaN]) {
    const d = annualDeal({ priceMonthly: 99, priceAnnual: a });
    ok(`annual ${String(a)} is no annual option`, d.kind === "none" && !d.warning, JSON.stringify(d));
  }
  ok("...said as a sentence", say(99, null) === "No annual option", say(99, null));
  ok("a missing deal object is no annual option, not a crash", annualDealText(undefined) === "No annual option");

  // Zero monthly — nothing to compare against: not invented as "no discount",
  // and no division by zero.
  for (const m of [0, null, "", -5]) {
    const d = annualDeal({ priceMonthly: m, priceAnnual: 990 });
    ok(`monthly ${JSON.stringify(m)} with a year: nothing to compare`,
      d.kind === "noMonthly" && !d.warning && d.annual === 990, JSON.stringify(d));
  }
  ok("...said plainly", say(0, 990) === "annual only — no monthly price to compare", say(0, 990));
  ok("zero monthly and no year is simply no annual option", annualDeal({ priceMonthly: 0, priceAnnual: null }).kind === "none");

  // Every kind goes through the caller's t() with its own key.
  const keys = [];
  const spy = (k) => (keys.push(k), k);
  for (const [m, a] of [[99, 990], [99, 99], [99, 1039.5], [99, 1188], [99, 1200], [0, 990], [99, null]]) {
    annualDealText(annualDeal({ priceMonthly: m, priceAnnual: a }), { t: spy, money: cad });
  }
  ok("every kind has its own translation key",
    JSON.stringify(keys) === JSON.stringify([
      "pricing.annualDeal.payMonths", "pricing.annualDeal.payOneMonth", "pricing.annualDeal.saves",
      "pricing.annualDeal.noDiscount", "pricing.annualDeal.costsMore", "pricing.annualDeal.noMonthly",
      "pricing.annualDeal.none",
    ]), JSON.stringify(keys));
  // The symbol path keeps cents only when there are cents.
  ok("symbol formatting: whole units when whole",
    annualDealText(annualDeal({ priceMonthly: 99, priceAnnual: 990 }), { symbol: "CA$" }) === "pay 10 months, get 12 (saves CA$198 vs monthly)");
  ok("...cents when not",
    annualDealText(annualDeal({ priceMonthly: 99, priceAnnual: 1039.5 }), { symbol: "CA$" }) === "saves CA$148.50 (12.5%) vs 12 × monthly");
  ok("the percentage is formatted in the reader's locale",
    annualDealText(annualDeal({ priceMonthly: 99, priceAnnual: 1039.5 }), { symbol: "$", locale: "fr-CA" }).includes("12,5"));

  // Every language carries every key with the SAME placeholders as English —
  // a translation that drops {saves} prints a deal with no number in it.
  const holes = (str) => JSON.stringify([...String(str).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
  const bad = [];
  for (const [lang, dict] of Object.entries(MESSAGES)) {
    for (const k of keys) {
      if (typeof dict[k] !== "string") bad.push(`${lang}:${k} missing`);
      else if (holes(dict[k]) !== holes(MESSAGES.en[k])) bad.push(`${lang}:${k} placeholders`);
    }
  }
  ok(`every language has all ${keys.length} deal keys with English's placeholders`, bad.length === 0, bad.join(", "));
}

console.log("\nThe fifth rung — derived from the four, as the owner asked (2026-09-18)");
{
  const scale = SEAT_LADDER[3];
  const shop = SEAT_LADDER[2];
  ok("crew per seat is the ladder's own gap from Crew upward: five",
    CUSTOM_CREW_GAP === 5 && SEAT_LADDER.slice(1).every((t) => t.crewSeats - t.seats === CUSTOM_CREW_GAP));
  ok("a seat costs the Shop → Scale step, per seat: $25",
    CUSTOM_SEAT_PRICE === 25 && CUSTOM_SEAT_PRICE === (scale.price - shop.price) / (scale.seats - shop.seats));
  ok("the floor is one seat past Scale: eleven", CUSTOM_MIN_SEATS === 11 && CUSTOM_MIN_SEATS === scale.seats + 1);
  ok("the cap is a hundred people in all, which is forty-seven seats and fifty-two crew",
    MAX_COMPANY_PEOPLE === 100 && CUSTOM_MAX_SEATS === 47 && CUSTOM_MAX_SEATS + CUSTOM_MAX_SEATS + CUSTOM_CREW_GAP <= 100 &&
      (CUSTOM_MAX_SEATS + 1) + (CUSTOM_MAX_SEATS + 1) + CUSTOM_CREW_GAP > 100);
  ok("the quick picks are 15 / 20 / 30 / 40, all inside the range",
    JSON.stringify([...CUSTOM_QUICK_PICKS]) === "[15,20,30,40]");

  // The formula, at the three sizes the owner would check by hand.
  const at = (n) => customTier(n);
  ok("custom(11) = $369 + $25 × 1 = $394, 11 seats, 16 crew",
    at(11).price === 394 && at(11).seats === 11 && at(11).crewSeats === 16, JSON.stringify(at(11)));
  ok("custom(20) = $369 + $25 × 10 = $619, 20 seats, 25 crew — 45 people",
    at(20).price === 619 && at(20).crewSeats === 25 && at(20).people === 45, JSON.stringify(at(20)));
  ok("custom(47) = $369 + $25 × 37 = $1,294, 47 seats, 52 crew — 99 people",
    at(47).price === 1294 && at(47).crewSeats === 52 && at(47).people === 99, JSON.stringify(at(47)));
  ok("the year keeps the ladder's discount: custom(20) is $6,190 a year (ten months)",
    at(20).priceAnnual === 6190 && at(20).priceAnnual === defaultAnnualPrice(619));
  ok("...and follows a repriced Scale row's own ratio, not a constant",
    customTier(20, { base: { priceMonthly: 400, priceAnnual: 4400 } }).priceAnnual === 7150 &&
      customTier(20, { base: { priceMonthly: 400, priceAnnual: 4400 } }).price === 650);
  ok("no annual price on Scale means no annual option on the custom plan, never an invented year",
    customTier(20, { base: { priceMonthly: 369, priceAnnual: null } }).priceAnnual === null);
  ok("48 seats is refused, not rounded down to 47", at(48) === null && customSeatsAllowed(48) === false);
  ok("10 seats is refused — that is Scale, not a custom plan", at(10) === null);
  ok("a fraction, a word and a negative are refused",
    at(20.5) === null && customSeatsAllowed("twenty") === false && at(-20) === null);
  ok("the name every surface prints", customPlanName(20) === "Custom · 20 seats · 25 crew" && at(20).name === customPlanName(20));
  ok("the tier key round-trips", customSeatsFromTierKey(at(20).tierKey) === 20 && customSeatsFromTierKey("custom-48") === null && customSeatsFromTierKey("scale") === null);
  ok("a custom size ranks after Scale", at(11).sortOrder === scale.sortOrder + 1);

  // tierFor past Scale: seats need real seats, crew may sit in spare seats.
  ok("tierFor: 5 seats and 21 crew (26 people) is custom-11 — the crew absorb into seats",
    tierFor({ seats: 5, crew: 21 })?.tierKey === "custom-11");
  ok("tierFor: 30 seats and 40 crew (70 people) is custom-33",
    tierFor({ seats: 30, crew: 40 })?.tierKey === "custom-33" && customTierFor({ seats: 30, crew: 40 }).people >= 70);
  ok("tierFor: 47 seats and 52 crew is exactly the largest custom size", tierFor({ seats: 47, crew: 52 })?.tierKey === "custom-47");
  ok("tierFor: 10 seats and 15 crew is still Scale, never a custom size", tierFor({ seats: 10, crew: 15 })?.tierKey === "scale");
  ok("every custom size tierFor returns fits the people it was asked for",
    Array.from({ length: 60 }, (_, s) => s).every((seats) =>
      Array.from({ length: 60 }, (_, c) => c).every((crew) => {
        const t = tierFor({ seats, crew });
        if (!t) return seats > 47 || seats + crew > 99;
        return seats <= t.seats && seats + crew <= t.seats + t.crewSeats;
      })));

  // The Stripe split of a row: two items that sum to the row's price.
  const row = { tierKey: "custom-20", priceMonthly: "619.00", priceAnnual: "6190.00" };
  const split = customPlanSplit(row);
  ok("a custom row splits into Scale's line plus 10 extra seats at $25",
    split.extraSeats === 10 && split.base.priceMonthly === 369 && split.extra.month === 25);
  ok("...and the two sum to the row's price, monthly and yearly",
    split.base.priceMonthly + split.extraSeats * split.extra.month === 619 &&
      split.base.priceAnnual + split.extraSeats * split.extra.year === 6190);
  ok("a row edited below what its seats alone cost cannot be split, and says so",
    customPlanSplit({ tierKey: "custom-20", priceMonthly: 200 }) === null);
  ok("a rung has no split", customPlanSplit({ tierKey: "scale", priceMonthly: 369 }) === null);
}

console.log("\nThe page a customer sees");
const page = ladderFor({ currency: "CAD", promotion: promo, now: new Date("2026-08-27") });
ok("every rung is priced", page.every((t) => t.pricing.now > 0));
ok("every rung shows the revert price", page.every((t) => t.pricing.revertsTo >= t.pricing.now));
ok("people totals reach the page", JSON.stringify(page.map((t) => t.people)) === "[6,11,17,25]");
ok("USD is the same number, not a conversion",
  ladderFor({ currency: "USD" })[0].pricing.regular === ladderFor({ currency: "CAD" })[0].pricing.regular);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
