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
  ANNUAL_FREE_MONTHS,
  defaultAnnualPrice,
  annualComparison,
} from "@/lib/pricing/ladder";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

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
ok("...and therefore fit no tier", tierFor(attack) === null);

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
ok("12 seats is a conversation, not the top tier", tierFor({ seats: 12, crew: 4 }) === null);

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

console.log("\nCurrency comes from the address, and cannot be chosen");
ok("Canada is CAD", currencyForCountry("CA") === "CAD");
ok("the United States is USD", currencyForCountry("US") === "USD");
ok("spelled out works too", currencyForCountry("Canada") === "CAD" && currencyForCountry("united states") === "USD");
// The two prices are the same NUMBER, not a conversion — so picking a currency
// is picking a discount. Unknown must therefore never resolve to one.
ok("no country is NOT CAD", currencyForCountry(null) === null);
ok("an empty country is NOT CAD", currencyForCountry("  ") === null);
ok("a country we do not price is null, not a guess", currencyForCountry("GB") === null);
// A bare $ in front of an American price shown to a Canadian is the ambiguity
// the address rule exists to remove.
ok("USD is written US$", currencyLabel("USD") === "US$");
ok("CAD is written CA$", currencyLabel("CAD") === "CA$");

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
