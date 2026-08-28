// scripts/check-depreciation.mjs
//
//   npm run check:depreciation
//
// The truck, and the two ways of getting it wrong.
//
// ══ The owner's sentence ═══════════════════════════════════════════════════
//
//   "i have a truck i still pay it is an overhead but it's also an asset that
//    depreciates."
//
// Three true things about one truck, and until this change the product could
// hold one of them. The two failures that follow are opposites, and both are
// expensive:
//
//   * Count only the loan payment. The loan ends, the payment is dropped, and
//     the truck keeps wearing out and still needs replacing. The break-even
//     price silently falls below the truth — the worst shape of bug in this
//     codebase, because the screen still looks right.
//
//   * Count the payment AND the depreciation. The same $60,000 is charged
//     twice, because the payment repays capital that depreciation already
//     charges for. Every quote goes out too high.
//
// The rule is: depreciation plus the loan INTEREST, never the whole payment,
// and only while an asset is actually carrying the capital cost. This file
// EXECUTES that rule. It does not grep for it.
//
// ══ Why executed, and against hostile input ═══════════════════════════════
//
// A regex over lib/accounting/depreciation.js proves the words are there. It
// does not prove that a life of zero returns 0 rather than Infinity, that a
// salvage value above cost cannot produce a NEGATIVE charge that LOWERS the
// company's price floor, or that an asset linked to a loan does not add
// depreciation on top of the whole payment. Those are arithmetic, and the only
// assertion worth having is the one that runs it — which is how most of the
// real bugs in this repo were found (AGENTS.md, "How to verify").
//
// The invariants asserted, in order of how much money they are worth:
//
//   1. Never NaN, never Infinity, never negative. A NaN in the burn rate
//      serialises to null and the price floor disappears from the screen with
//      nothing saying why; a negative charge subtracts from overhead and
//      quietly lowers the floor.
//   2. Never more than cost − salvage over the whole life, however the dates
//      and the clock are arranged.
//   3. The double-count guard: an asset linked to a loan must not produce
//      depreciation PLUS that loan's full monthly payment.
//   4. And its mirror, which is the failure people actually hit: an asset with
//      NO loan linked must not lose the loan's capital cost from the floor.
//   5. The number reaches the price floor. Depreciation that no pricing screen
//      reads is precisely the "written and never read" defect AGENTS.md names,
//      so lib/analytics/minimumPrice.js is executed end to end against a fake
//      database and the floor is asserted to MOVE.

import { readFileSync } from "node:fs";
import { register } from "node:module";

import {
  monthsBetween,
  depreciableBase,
  monthlyDepreciation,
  assetCharge,
  outstandingBalance,
  monthlyInterest,
  assetOverhead,
  doubleCountWarning,
} from "@/lib/accounting/depreciation";
import { billStatus, summariseBills } from "@/lib/accounting/bills";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const D = (s) => new Date(s);
// Every date in this file is pinned. A check that reads the wall clock passes
// in August and fails in September, and then gets deleted.
const NOW = D("2026-08-28T12:00:00Z");

// The truck from the owner's sentence: $60,000 over five years, financed.
const TRUCK = {
  id: "truck",
  name: "F-250",
  cost: 60000,
  salvageValue: 0,
  inServiceDate: D("2024-08-28T00:00:00Z"),
  usefulLifeMonths: 60,
  disposedOn: null,
  active: true,
  debtId: "loan",
};
const LOAN = {
  id: "loan",
  name: "Truck loan",
  principal: 60000,
  interestRate: 6, // 6% a year — a PERCENT, which is the unit the column means
  monthlyPayment: 1160,
  startDate: D("2024-08-28T00:00:00Z"),
  active: true,
};

// ═══════════════ 1. The straight-line charge itself ════════════════════════

console.log("\nThe monthly charge, on the numbers a contractor would type");

ok("a $60k truck over 60 months is $1,000 a month", monthlyDepreciation(TRUCK) === 1000);
ok(
  "…and a $10k trade-in value takes it to $833.33, not $1,000",
  Math.abs(monthlyDepreciation({ ...TRUCK, salvageValue: 10000 }) - 50000 / 60) < 1e-9,
  monthlyDepreciation({ ...TRUCK, salvageValue: 10000 }),
);
ok("the depreciable base is cost minus salvage", depreciableBase(TRUCK) === 60000);

console.log("\nHostile input never produces a number that moves a price floor wrongly");

// A life of zero is the one that used to be Infinity. Infinity in the overhead
// total makes every downstream price Infinity or NaN.
for (const life of [0, -12, null, undefined, "", "abc", NaN, 0.4]) {
  const v = monthlyDepreciation({ ...TRUCK, usefulLifeMonths: life });
  ok(`life ${JSON.stringify(life)} charges 0, not Infinity or NaN`, v === 0, v);
}
// A negative cost, and a salvage value above cost. Both would give a NEGATIVE
// base, and a negative charge SUBTRACTS from overhead — a typo that lowers the
// company's break-even price is the exact failure this feature exists to stop.
for (const [cost, salvage] of [
  [-60000, 0],
  [1000, 5000],
  [1000, -5000],
  [0, 0],
  ["nonsense", "nonsense"],
  [null, null],
]) {
  const v = monthlyDepreciation({ ...TRUCK, cost, salvageValue: salvage });
  ok(
    `cost ${JSON.stringify(cost)} / salvage ${JSON.stringify(salvage)} is >= 0 and finite`,
    Number.isFinite(v) && v >= 0,
    v,
  );
}
// Absurd values must stay finite. 1e308 * anything overflows.
{
  const v = monthlyDepreciation({ ...TRUCK, cost: 1e308, usefulLifeMonths: 1 });
  ok("an absurd cost stays finite", Number.isFinite(v), v);
}
{
  const v = monthlyDepreciation({});
  ok("a completely empty object charges 0", v === 0, v);
}
{
  const v = monthlyDepreciation(null);
  ok("null charges 0 rather than throwing", v === 0, v);
}

// ═══════════════ 2. The clock ══════════════════════════════════════════════

console.log("\nThe clock: bought today, halfway through, and long finished");

{
  const c = assetCharge({ ...TRUCK, inServiceDate: NOW }, NOW);
  ok("bought today: charging, and nothing written down yet", c.chargeable === true && c.accumulated === 0, c);
  ok("…and its book value is still the full cost", c.bookValue === 60000, c.bookValue);
}
{
  // Two years in: 24 of 60 months.
  const c = assetCharge(TRUCK, NOW);
  ok("two years in: 24 months written down", Math.round(c.accumulated) === 24000, c.accumulated);
  ok("…and worth $36,000 on the books", Math.round(c.bookValue) === 36000, c.bookValue);
  ok("…and still charging $1,000", c.monthly === 1000, c.monthly);
}
{
  // Fully depreciated years ago. This is the case the whole feature exists for:
  // the charge STOPS, and it must not go negative or keep running.
  const old = { ...TRUCK, inServiceDate: D("2015-01-01T00:00:00Z") };
  const c = assetCharge(old, NOW);
  ok("finished long ago: charges nothing", c.monthly === 0 && c.chargeable === false, c);
  ok("…and says WHY", c.reason === "fully_depreciated", c.reason);
  ok("…and never wrote down more than it cost", c.accumulated === 60000, c.accumulated);
  ok("…leaving a book value of exactly the salvage value", c.bookValue === 0, c.bookValue);
}
{
  // Bought, not yet on the road.
  const future = { ...TRUCK, inServiceDate: D("2027-01-01T00:00:00Z") };
  const c = assetCharge(future, NOW);
  ok("not in service yet: no charge", c.monthly === 0 && c.chargeable === false, c);
  ok("…and says why, rather than looking broken", c.reason === "not_in_service", c.reason);
  ok("…and nothing is written down", c.accumulated === 0, c.accumulated);
}
{
  // Sold mid-life. The months it WAS in service really did cost money, so the
  // accumulated figure stops at the disposal rather than at today.
  const sold = { ...TRUCK, disposedOn: D("2025-08-28T00:00:00Z") };
  const c = assetCharge(sold, NOW);
  ok("disposed of mid-life: charges nothing now", c.monthly === 0 && c.chargeable === false, c);
  ok("…and says it was disposed of", c.reason === "disposed", c.reason);
  ok(
    "…and the clock stopped at the sale, not at today",
    Math.round(c.accumulated) === 12000,
    c.accumulated,
  );
}
{
  const retired = { ...TRUCK, active: false };
  const c = assetCharge(retired, NOW);
  ok("a row switched off stops raising the price floor", c.monthly === 0, c);
  ok("…and is reported as inactive, not as sold", c.reason === "inactive", c.reason);
}
{
  const c = assetCharge({ ...TRUCK, usefulLifeMonths: 0 }, NOW);
  ok("a life of zero is 'incomplete', not a divide by zero", c.reason === "incomplete" && c.monthly === 0, c);
}
{
  const c = assetCharge({ ...TRUCK, inServiceDate: "not a date" }, NOW);
  ok("an unparseable in-service date charges 0 and says incomplete", c.monthly === 0 && c.reason === "incomplete", c);
}
{
  // A clock that runs backwards must not produce a negative accumulation.
  const c = assetCharge(TRUCK, D("2020-01-01T00:00:00Z"));
  ok("valued before it existed: nothing charged, nothing negative", c.accumulated === 0 && c.monthly === 0, c);
}

console.log("\nOver a whole life, never more than cost minus salvage — walked month by month");

// The invariant that matters most, checked at every month of a life rather
// than at the two ends, because an off-by-one in monthsBetween would pass a
// two-point test.
{
  const asset = { ...TRUCK, salvageValue: 10000, usefulLifeMonths: 36 };
  const base = 50000;
  let worst = 0;
  let negatives = 0;
  let nonMonotonic = 0;
  let previous = -1;
  for (let m = 0; m <= 48; m++) {
    const at = new Date(Date.UTC(2024, 7 + m, 28, 12));
    const c = assetCharge(asset, at);
    if (!Number.isFinite(c.accumulated) || !Number.isFinite(c.monthly)) negatives++;
    if (c.accumulated < 0 || c.monthly < 0 || c.bookValue < 0) negatives++;
    if (c.accumulated < previous) nonMonotonic++;
    previous = c.accumulated;
    worst = Math.max(worst, c.accumulated);
  }
  ok("never wrote down more than cost minus salvage", worst <= base + 1e-9, worst);
  ok("…and reached exactly that by the end", Math.abs(worst - base) < 1e-9, worst);
  ok("…never negative, never NaN, at any month", negatives === 0, negatives);
  ok("…and never went backwards", nonMonotonic === 0, nonMonotonic);
}

console.log("\nmonthsBetween is a calendar question, not a division");

ok("same day is 0 months", monthsBetween(D("2026-01-15"), D("2026-01-15")) === 0);
ok("one day short of a month is still 0", monthsBetween(D("2026-01-15"), D("2026-02-14")) === 0);
ok("the day of the month is 1", monthsBetween(D("2026-01-15"), D("2026-02-15")) === 1);
ok("a year is 12", monthsBetween(D("2026-01-15"), D("2027-01-15")) === 12);
ok("backwards is 0, never negative", monthsBetween(D("2027-01-15"), D("2026-01-15")) === 0);
ok("an unparseable date is 0, not NaN", monthsBetween("nonsense", D("2026-01-15")) === 0);
ok("a null date is 0", monthsBetween(null, D("2026-01-15")) === 0);

// ═══════════════ 3. Loan interest ══════════════════════════════════════════

console.log("\nThe loan: only the interest is a cost, and it shrinks as it is repaid");

{
  const b0 = outstandingBalance(LOAN, LOAN.startDate);
  const b24 = outstandingBalance(LOAN, NOW);
  ok("nothing repaid on day one", Math.round(b0) === 60000, b0);
  ok("two years in, the balance has fallen", b24 < 60000 && b24 > 0, b24);
  ok("…and interest is a small fraction of the payment, not the whole of it",
    monthlyInterest(LOAN, NOW) < LOAN.monthlyPayment * 0.3, monthlyInterest(LOAN, NOW));
}
{
  // Paid off. A finished loan costs nothing, and the balance must not go
  // negative and start REFUNDING the price floor.
  const b = outstandingBalance(LOAN, D("2035-01-01"));
  ok("a finished loan owes nothing", b === 0, b);
  ok("…and charges no interest", monthlyInterest(LOAN, D("2035-01-01")) === 0);
}
{
  ok("a 0% loan has no interest to charge", monthlyInterest({ ...LOAN, interestRate: 0 }, NOW) === 0);
  ok("a negative rate charges 0, not a refund", monthlyInterest({ ...LOAN, interestRate: -5 }, NOW) === 0);
}
{
  // A payment too small to cover the interest. The balance would compound
  // forever; clamped to the original principal, because a growing debt built
  // out of a typo must not raise a price floor.
  const bad = { ...LOAN, monthlyPayment: 1, interestRate: 30 };
  const b = outstandingBalance(bad, D("2060-01-01"));
  ok("a payment that never covers the interest is clamped at the principal", b === 60000, b);
  ok("…and the charge never exceeds the payment itself",
    monthlyInterest(bad, NOW) <= bad.monthlyPayment, monthlyInterest(bad, NOW));
}
{
  const absurd = { ...LOAN, interestRate: 1e6, monthlyPayment: 0, principal: 1e12 };
  const b = outstandingBalance(absurd, D("2500-01-01"));
  ok("absurd terms stay finite", Number.isFinite(b), b);
  ok("…and the interest stays finite", Number.isFinite(monthlyInterest(absurd, D("2500-01-01"))));
}
for (const debt of [null, {}, { principal: "x", monthlyPayment: "y", interestRate: "z" }]) {
  const b = outstandingBalance(debt, NOW);
  const i = monthlyInterest(debt, NOW);
  ok(`a junk debt row (${JSON.stringify(debt)}) gives 0/0, never NaN`,
    b === 0 && i === 0, { b, i });
}
{
  // No start date means we cannot say how much has been repaid. The full
  // principal is what the row actually tells us; inventing a repayment history
  // would UNDERSTATE the interest and lower the floor.
  const b = outstandingBalance({ ...LOAN, startDate: null }, NOW);
  ok("no start date falls back to the full principal", b === 60000, b);
}

// ═══════════════ 4. THE DOUBLE COUNT — the point of the whole task ═════════

console.log("\nThe double-count guard, executed");

{
  const linked = assetOverhead({ assets: [TRUCK], debts: [LOAN], asOf: NOW });
  const naive = 1000 + LOAN.monthlyPayment; // depreciation + the whole payment
  ok("a linked truck charges its depreciation", linked.depreciation === 1000, linked.depreciation);
  ok("…and the loan's INTEREST", linked.debtInterest > 0, linked.debtInterest);
  ok("…and NOT the loan's principal", linked.debtPrincipalCharged === 0, linked.debtPrincipalCharged);
  // The assertion the task is about, stated as the arithmetic:
  ok(
    "the total is NOT depreciation plus the whole payment",
    linked.monthlyCost < naive,
    { got: linked.monthlyCost, naive },
  );
  ok(
    "…it is depreciation plus interest, to the cent",
    Math.abs(linked.monthlyCost - (linked.depreciation + linked.debtInterest)) < 0.01,
    linked,
  );
  ok("…and the loan is named as interest-only so the screen can say so",
    linked.interestOnlyDebtIds.length === 1 && linked.interestOnlyDebtIds[0] === "loan",
    linked.interestOnlyDebtIds);
  // Cash is still cash. Runway must not fall because the P&L got smarter.
  ok("…while the CASH figure is still the whole payment", linked.debtCash === LOAN.monthlyPayment, linked.debtCash);
}
{
  // The mirror, and the failure people actually hit: no link, so nothing else
  // is carrying the capital cost. Dropping the principal here would be the
  // "floor silently falls below the truth" bug arrived at by being clever.
  const loose = assetOverhead({ assets: [], debts: [LOAN], asOf: NOW });
  ok("a loan with no asset behind it is charged IN FULL",
    loose.debtPrincipalCharged === LOAN.monthlyPayment, loose.debtPrincipalCharged);
  ok("…and contributes no interest on top of that", loose.debtInterest === 0, loose.debtInterest);
  ok("…so the total equals the payment", loose.monthlyCost === LOAN.monthlyPayment, loose.monthlyCost);
}
{
  // The owner's actual fear: the loan ends, and the truck keeps costing.
  const paidOff = assetOverhead({ assets: [TRUCK], debts: [{ ...LOAN, active: false }], asOf: NOW });
  ok("when the loan ends the truck still costs $1,000 a month",
    paidOff.monthlyCost === 1000, paidOff.monthlyCost);
  ok("…and no loan payment is charged any more", paidOff.debtCash === 0, paidOff.debtCash);
}
{
  // Linked, but the truck is finished while the loan runs on. Interest-only
  // would drop the capital cost out of the floor altogether, so the loan goes
  // back to its full payment — the direction that cannot bankrupt anybody.
  const stale = {
    assets: [{ ...TRUCK, inServiceDate: D("2015-01-01") }],
    debts: [LOAN],
    asOf: NOW,
  };
  const r = assetOverhead(stale);
  ok("a fully-depreciated asset does not discount its loan",
    r.debtPrincipalCharged === LOAN.monthlyPayment, r.debtPrincipalCharged);
  ok("…and the loan is not listed as interest-only", r.interestOnlyDebtIds.length === 0, r.interestOnlyDebtIds);
}
{
  // A link pointing at a loan that is not in the set (deleted, or another
  // tenant's id smuggled in). It must NOT discount anything.
  const r = assetOverhead({ assets: [TRUCK], debts: [], asOf: NOW });
  ok("a link to a loan that isn't there discounts nothing", r.interestOnlyDebtIds.length === 0, r);
  ok("…and the asset still charges its depreciation", r.depreciation === 1000, r.depreciation);
}
{
  // A second asset on the SAME loan. The loan is discounted once, not twice —
  // and the discount is a substitution, not a subtraction, so there is no way
  // for it to go negative.
  const r = assetOverhead({
    assets: [TRUCK, { ...TRUCK, id: "trailer", cost: 12000, usefulLifeMonths: 60 }],
    debts: [LOAN],
    asOf: NOW,
  });
  ok("two assets on one loan discount it once", r.interestOnlyDebtIds.length === 1, r.interestOnlyDebtIds);
  ok("…and the total is never negative", r.monthlyCost > 0, r.monthlyCost);
}
for (const args of [undefined, {}, { assets: null, debts: null }, { assets: "x", debts: 7 }]) {
  const r = assetOverhead(args);
  ok(
    `assetOverhead(${JSON.stringify(args)}) returns zeroes, not NaN`,
    Number.isFinite(r.monthlyCost) && r.monthlyCost === 0,
    r.monthlyCost,
  );
}

console.log("\nAnd when it CANNOT tell, it says so rather than guessing");

{
  // An unlinked truck and an unlinked loan, side by side. The server does not
  // pair them by name or by amount — moving a price floor on a string match is
  // worse than the warning.
  const summary = assetOverhead({
    assets: [{ ...TRUCK, debtId: null }],
    debts: [LOAN],
    asOf: NOW,
  });
  const warning = doubleCountWarning(summary, [LOAN]);
  ok("an unlinked asset beside an unlinked loan raises a warning", warning !== null, warning);
  ok("…naming both sides so the screen can point at them",
    warning.unlinkedAssetIds.includes("truck") && warning.unlinkedDebtIds.includes("loan"), warning);
  ok("…and it did NOT silently change the arithmetic",
    summary.monthlyCost === 1000 + LOAN.monthlyPayment, summary.monthlyCost);
}
{
  const linked = assetOverhead({ assets: [TRUCK], debts: [LOAN], asOf: NOW });
  ok("linking them clears the warning", doubleCountWarning(linked, [LOAN]) === null);
}
{
  // Either side alone is ordinary — a paid-off ladder rack, a working-capital
  // loan. Warning about either alone is how a warning gets switched off before
  // the day it matters.
  const assetOnly = assetOverhead({ assets: [{ ...TRUCK, debtId: null }], debts: [], asOf: NOW });
  ok("an asset with no loans anywhere is not a warning", doubleCountWarning(assetOnly, []) === null);
  const debtOnly = assetOverhead({ assets: [], debts: [LOAN], asOf: NOW });
  ok("a loan with no assets anywhere is not a warning", doubleCountWarning(debtOnly, [LOAN]) === null);
}

// ═══════════════ 5. It reaches the price floor ═════════════════════════════
//
// A depreciation charge that no pricing screen reads is the "written and never
// read" defect AGENTS.md names. So the real calculateMinimumPrice is imported
// with "@/lib/db" replaced by a fake, and the floor is asserted to MOVE when
// an asset is added — end to end, through calculateBurnRate, with no copy of
// the arithmetic in this file.

console.log("\nThe charge reaches the minimum price — the real function, a fake database");

const HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db")
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, model) => new Proxy({}, { get: (_x, op) => (...a) => globalThis.__FQ_DB(model, op, ...a) }) });" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

let WORLD = { expense: [], salary: [], debt: [], asset: [], forecastSettings: { jobsPerWeekCapacity: 5 } };
globalThis.__FQ_DB = async (model, op) => {
  if (model === "forecastSettings") return WORLD.forecastSettings;
  if (op === "findMany") return WORLD[model] || [];
  return null;
};

const { calculateMinimumPrice } = await import("@/lib/analytics/minimumPrice");
const { calculateBurnRate } = await import("@/lib/analytics/burnRate");

// A plain business: $4,000 of rent and insurance, no truck at all.
WORLD = {
  ...WORLD,
  expense: [{ amount: 4000, frequency: "monthly" }],
  salary: [],
  debt: [],
  asset: [],
};
const bare = await calculateMinimumPrice({ companyId: "co", targetMargin: 0.2 });
ok("a business with no assets gets a floor from its rent alone", bare.monthlyFixedCosts === 4000, bare);

// Now the truck, financed, with the asset NOT linked. This is what a
// contractor's account looks like the day before they link it.
WORLD = { ...WORLD, debt: [LOAN], asset: [{ ...TRUCK, debtId: null }] };
const unlinked = await calculateMinimumPrice({ companyId: "co", targetMargin: 0.2 });
ok(
  "an unlinked truck raises the floor by depreciation AND the whole payment",
  unlinked.monthlyFixedCosts === 4000 + 1000 + LOAN.monthlyPayment,
  unlinked.monthlyFixedCosts,
);
ok("…and the response carries the warning so the screen can ask", unlinked.doubleCountRisk !== null, unlinked.doubleCountRisk);

// Linked. The floor FALLS, because the double count is gone.
WORLD = { ...WORLD, asset: [TRUCK] };
const linkedFloor = await calculateMinimumPrice({ companyId: "co", targetMargin: 0.2 });
ok(
  "linking the loan removes the double count from the floor",
  linkedFloor.monthlyFixedCosts < unlinked.monthlyFixedCosts,
  { linked: linkedFloor.monthlyFixedCosts, unlinked: unlinked.monthlyFixedCosts },
);
ok(
  "…leaving rent + depreciation + interest",
  Math.abs(linkedFloor.monthlyFixedCosts - (4000 + 1000 + linkedFloor.breakdown.debtInterest)) < 0.02,
  linkedFloor,
);
ok("…and the warning is gone", linkedFloor.doubleCountRisk === null, linkedFloor.doubleCountRisk);
ok("…and the minimum price moved with it", linkedFloor.minimumPrice < unlinked.minimumPrice, {
  linked: linkedFloor.minimumPrice,
  unlinked: unlinked.minimumPrice,
});

// THE FAILURE THE WHOLE TASK IS ABOUT. The loan ends. The truck is still
// wearing out, so the floor must NOT fall by the depreciation as well.
WORLD = { ...WORLD, debt: [{ ...LOAN, active: false }] };
const afterPayoff = await calculateMinimumPrice({ companyId: "co", targetMargin: 0.2 });
ok(
  "when the loan ends the truck's $1,000 is STILL in the floor",
  afterPayoff.monthlyFixedCosts === 5000,
  afterPayoff.monthlyFixedCosts,
);
ok(
  "…which is above the rent-only floor a contractor would otherwise fall back to",
  afterPayoff.monthlyFixedCosts > bare.monthlyFixedCosts,
  { after: afterPayoff.monthlyFixedCosts, bare: bare.monthlyFixedCosts },
);

// Cash and cost are different numbers, and both are reported.
WORLD = { ...WORLD, debt: [LOAN], asset: [TRUCK] };
const burn = await calculateBurnRate({ companyId: "co", cashOnHand: null, asOf: NOW });
ok("cash burn still counts the whole loan payment", burn.breakdown.debt === LOAN.monthlyPayment, burn.breakdown.debt);
ok("…so the runway KPI did not change meaning", burn.totalMonthlyBurn === 4000 + LOAN.monthlyPayment, burn.totalMonthlyBurn);
ok("…while the cost basis counts depreciation instead", burn.totalMonthlyCost !== burn.totalMonthlyBurn, {
  cost: burn.totalMonthlyCost,
  cash: burn.totalMonthlyBurn,
});
ok("the breakdown names the depreciation", burn.breakdown.depreciation === 1000, burn.breakdown.depreciation);
ok(
  "…and the breakdown adds up to the cost total",
  Math.abs(
    burn.breakdown.overhead +
      burn.breakdown.salaries +
      burn.breakdown.depreciation +
      burn.breakdown.debtInterest +
      burn.breakdown.debtChargedInFull -
      burn.totalMonthlyCost,
  ) < 0.02,
  burn.breakdown,
);

// The hourly floor is the same cost basis, for the trades that price by time.
const { calculateHourlyFloor } = await import("@/lib/analytics/minimumPrice");
const hourly = await calculateHourlyFloor({ companyId: "co", billableHoursPerMonth: 100 });
ok("the hourly floor reports the cost basis", hourly.monthlyFixedCosts === burn.totalMonthlyCost, hourly);
// The RATE itself, not just the figure printed above it. Mutation testing found
// this gap: swapping the divisor back to the cash burn left `monthlyFixedCosts`
// correct and the rate a contractor actually charges wrong, and the assertion
// above passed anyway.
ok(
  "…and divides THAT by the billable hours, not the cash burn",
  Math.abs(hourly.hourlyFloor - burn.totalMonthlyCost / 100) < 0.01,
  { hourlyFloor: hourly.hourlyFloor, expected: burn.totalMonthlyCost / 100 },
);
ok(
  "…so the per-person rate follows from it",
  Math.abs(hourly.perCleanerRate - hourly.hourlyFloor) < 0.01,
  hourly,
);

console.log("\nSomething actually READS the columns that were added");

// AGENTS.md: "grep for the field you just added to confirm something reads it."
// A field written and never read is a defect, so each new column is traced to
// a consumer by name rather than assumed.
const burnSrc = readFileSync("lib/analytics/burnRate.js", "utf8");
const depSrc = readFileSync("lib/accounting/depreciation.js", "utf8");
const billSrc = readFileSync("lib/accounting/bills.js", "utf8");
const pageSrc = readFileSync("app/app/settings/overhead/page.js", "utf8");
const minSrc = readFileSync("lib/analytics/minimumPrice.js", "utf8");

ok("burnRate selects the asset register", /db\.asset\.findMany/.test(burnSrc));
ok("…and hands it to the depreciation rule", /assetOverhead\(/.test(burnSrc));
for (const column of ["cost", "salvageValue", "inServiceDate", "usefulLifeMonths", "disposedOn"])
  ok(`Asset.${column} is read by the depreciation maths`, new RegExp(`\\b${column}\\b`).test(depSrc));
ok("Asset.debtId is what the double-count guard reads", /debtId/.test(depSrc));
ok("Expense.dueDate is read by the bills logic", /dueDate/.test(billSrc));
ok("Expense.paidAt is read by the bills logic", /paidAt/.test(billSrc));
ok("the price floor uses the cost basis, not the cash", /totalMonthlyCost/.test(minSrc));
ok("…and no longer divides the cash burn by capacity", !/totalMonthlyBurn \/ jobsPerMonth/.test(minSrc));
ok("the overhead screen renders the depreciation figure", /breakdown\?\.depreciation/.test(pageSrc));
ok("…and the double-count warning", /doubleCountRisk/.test(pageSrc));
ok("…and finally asks for the interest rate it was already sending",
  /placeholder=\{t\("app\.setOverhead\.interestRate"/.test(pageSrc));

console.log("\nThe asset register is gated like the rest of the cost basis");

// A crew member must not be able to read what the company owns. The gate is
// the shared cost-basis rule rather than a new one — see the route header.
const assetsRoute = readFileSync("app/api/assets/route.js", "utf8");
const assetsIdRoute = readFileSync("app/api/assets/[id]/route.js", "utf8");
ok("GET /api/assets requires the cost-basis read", /requireCostBasisRead\(full, "fixedCosts"\)/.test(assetsRoute));
ok("POST /api/assets requires the cost-basis write", /requireCostBasisWrite\(full, "fixedCosts"\)/.test(assetsRoute));
ok(
  "PATCH and DELETE do too",
  (assetsIdRoute.match(/requireCostBasisWrite\(full, "fixedCosts"\)/g) || []).length === 2,
  (assetsIdRoute.match(/requireCostBasisWrite\(full, "fixedCosts"\)/g) || []).length,
);
// The link is a foreign key written from request data, and a foreign one would
// charge this company's overhead against another company's loan.
// The CALL and its use, not the identifier: `/ownedIdsRefusal/` alone matched
// the import line, so replacing the call with `const badLink = null` passed
// this assertion. A check that a gate is imported is not a check that it runs.
const OWNED_CALL = /await ownedIdsRefusal\(NextResponse, db, member\.companyId, \{ debtId \}\)/;
const OWNED_USED = /if \(badLink\) return badLink;/;
ok(
  "the debt link is proved to belong to the caller on create",
  OWNED_CALL.test(assetsRoute) && OWNED_USED.test(assetsRoute),
);
ok(
  "…and on relink, which is the other way a foreign loan gets in",
  OWNED_CALL.test(assetsIdRoute) && OWNED_USED.test(assetsIdRoute),
);
ok("debtId has an ownership rule at all", /debtId:\s*\{\s*model:\s*"debt"/.test(readFileSync("lib/tenant/ownedIds.js", "utf8")));

const { canReadCostBasis } = await import("@/lib/permissions/costBasis");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");
const crew = { role: "employee", permissions: PERMISSION_PRESETS.worker.values };
ok("a crew member cannot read the asset register", canReadCostBasis(crew, "fixedCosts") === false);
const owner = { role: "owner", permissions: null };
ok("…and an owner can", canReadCostBasis(owner, "fixedCosts") === true);

const billsRoute = readFileSync("app/api/bills/route.js", "utf8");
ok("the bills list requires the company-wide expenses level",
  /hasLevel\(full, "expenses", "view_record_edit_all"\)/.test(billsRoute));
ok("…on the write path as well as the read",
  (billsRoute.match(/seesCompanyBills/g) || []).length >= 3);

// ═══════════════ 6. Bills due ══════════════════════════════════════════════

console.log("\nBills due: a due date is what makes a row a bill");

{
  // Every Expense that predates these columns has a null dueDate. Reading null
  // as "overdue since forever" would open the screen on a hundred invented
  // emergencies. Absence of a statement is not a statement (AGENTS.md #5).
  ok("a receipt with no due date is not a bill", billStatus({ amount: 40 }, NOW) === "undated");
  ok("a paid bill is paid", billStatus({ dueDate: D("2026-08-01"), paidAt: D("2026-08-02") }, NOW) === "paid");
  ok("an unpaid bill from last month is overdue", billStatus({ dueDate: D("2026-07-01") }, NOW) === "overdue");
  ok("one due next week is just due", billStatus({ dueDate: D("2026-09-04") }, NOW) === "due");
  // Due TODAY is not overdue. A bill you are about to pay this afternoon must
  // not be shown in red at nine in the morning.
  ok("due today is not overdue", billStatus({ dueDate: D("2026-08-28T23:00:00Z") }, NOW) === "due");
  ok("a junk row is 'undated', never a crash", billStatus({ dueDate: "nonsense" }, NOW) === "undated");
  ok("null is 'undated'", billStatus(null, NOW) === "undated");
}
{
  // Today is the 28th of August 2026, so the fixture covers every case the
  // panel has to separate: still to come this month, already late, next month,
  // settled, not a bill at all, and a row whose amount is unusable.
  const s = summariseBills(
    [
      { amount: 180, dueDate: D("2026-08-30") },              // due later this month
      { amount: 220, dueDate: D("2026-07-10") },              // overdue from July
      { amount: 400, dueDate: D("2026-09-20") },              // next month
      { amount: 999, dueDate: D("2026-08-05"), paidAt: D("2026-08-06") }, // settled
      { amount: 50 },                                          // a plain receipt
      { amount: "junk", dueDate: D("2026-08-20") },            // hostile
    ],
    NOW,
  );
  ok("outstanding counts only the unpaid, dated rows", s.outstanding === 800, s);
  ok("…and counts them, the unusable amount included", s.outstandingCount === 4, s);
  ok("overdue is its own figure", s.overdue === 220 && s.overdueCount === 2, s);
  ok(
    "…and last month's unpaid bill is still money leaving THIS month",
    s.dueThisMonth === 400,
    s,
  );
  ok("an unparseable amount contributes 0 rather than NaN", Number.isFinite(s.outstanding), s);
  ok("a settled bill is out of every figure", !/999/.test(JSON.stringify(s)), s);
}
for (const input of [null, undefined, "nonsense", 7, [null, undefined]]) {
  const s = summariseBills(input, NOW);
  ok(`summariseBills(${JSON.stringify(input)}) is all zeroes, never NaN`,
    s.outstanding === 0 && s.overdue === 0 && s.dueThisMonth === 0, s);
}
{
  // The one thing bills must NOT do: move the price floor. A bill is one
  // instance of a cost; the recurring row above it is what the floor counts,
  // and charging both would double the contractor's own overhead.
  const billsRouteSrc = readFileSync("app/api/bills/route.js", "utf8");
  ok("a bill is created non-recurring", /recurring:\s*false/.test(billsRouteSrc));
  ok("…and one-time, which the burn rate converts at zero", /frequency:\s*"one_time"/.test(billsRouteSrc));
  ok("burnRate really does convert one_time at zero", /one_time:\s*0/.test(burnSrc));
  ok("the bills panel says out loud that it doesn't move the floor",
    /billsNotCounted/.test(pageSrc));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
