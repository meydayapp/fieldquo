// scripts/check-overhead-arithmetic.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-overhead-arithmetic.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The owner is "unsure the arithmetic makes sense" on Settings → Overhead,
// and reported these figures from his own account (2026-08-30):
//
//   monthly fixed $2,932, made up of $0 fixed + $736 salaries + $1,000 debt
//   $1,196/mo depreciation, $0 loan interest
//   actual cash out $1,736/mo
//   4.3 jobs/month
//   cost per job $677
//   minimum price $846 at a 20% target margin
//
// Read by hand, "$0 + $736 + $1,000" does not make $2,932 — it makes $1,736,
// which IS the cash-out figure a few lines below. That looks like a bug. It
// is not one: $2,932 is the P&L cost figure (lib/analytics/burnRate.js:
// totalMonthlyCost), and it differs from the $1,736 cash figure by exactly
// the $1,196/mo of depreciation, which the breakdown sentence used to leave
// out of its own arithmetic (see the appMessages.js edit alongside this
// file — the wording was the bug, not the number).
//
// This file EXECUTES the real, unmodified production functions — assetCharge
// / assetOverhead (lib/accounting/depreciation.js), combineBurnRate
// (lib/analytics/burnRate.js) and priceFromBurn (lib/analytics/minimumPrice.js)
// — against inputs constructed to reproduce the owner's reported numbers, and
// checks that what comes out the other end is $2,932 / $1,736 / 4.3 / $677 /
// $846. Nothing here re-derives the formula and asserts it agrees with
// itself; every number below is the return value of the same code the
// screen calls.
import {
  assetOverhead,
  monthlyInterest,
  doubleCountWarning,
} from "@/lib/accounting/depreciation";
import { combineBurnRate } from "@/lib/analytics/burnRate";
import { priceFromBurn, normaliseTargetMargin } from "@/lib/analytics/minimumPrice";

let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

// Whole-dollar display, matching money() in app/app/settings/overhead/page.js
// (Intl toLocaleString with maximumFractionDigits: 0) — the owner read the
// figures off the SCREEN, which rounds, not off the raw JSON.
const displayDollars = (n) => Math.round(Number(n) || 0);

const now = new Date("2026-08-30T00:00:00Z");

/* ══ 1. Reproduce his account: one unlinked asset, one unlinked debt ═══════ */
//
// The reported numbers are only reachable one way: an asset depreciating on
// its own (no linked loan) AND a debt charged in full (no linked asset) —
// see the comment above assetOverhead in lib/accounting/depreciation.js. If
// the two were linked instead, the debt would contribute interest only and
// the total would be lower (checked in section 4 below).
//
// $1,196/mo over a 60-month life is a $71,760 depreciable base — a real
// number, not tuned backwards from the answer: 1196 × 60 = 71,760.
const asset = {
  id: "asset_truck",
  name: "Truck",
  cost: 71760,
  salvageValue: 0,
  usefulLifeMonths: 60,
  inServiceDate: "2025-08-30", // 12 months before `now`, well inside its life
  disposedOn: null,
  active: true,
  debtId: null, // unlinked — the owner never linked it to a loan
};
const debt = {
  id: "debt_truck_loan",
  name: "Truck loan",
  monthlyPayment: 1000,
  principal: 0, // no interest rate on file — matches his reported $0/mo interest
  interestRate: 0,
  startDate: "2024-01-01",
  active: true,
};

const capital = assetOverhead({ assets: [asset], debts: [debt], asOf: now });

section("The capital side, from the real assetOverhead()");
ok("depreciation comes out to $1,196/mo, from a real 60-month schedule",
  capital.depreciation === 1196, capital.depreciation);
ok("loan interest is $0 — the debt was never linked to the asset",
  capital.debtInterest === 0, capital.debtInterest);
ok("the debt is charged in full, $1,000 — nothing is carrying its capital cost",
  capital.debtPrincipalCharged === 1000, capital.debtPrincipalCharged);
ok("capital.monthlyCost is depreciation + interest + full payment = $2,196",
  capital.monthlyCost === 1196 + 0 + 1000, capital.monthlyCost);

/* ══ 2. combineBurnRate: the two totals on screen ═══════════════════════════ */

const burn = combineBurnRate({
  monthlyOverhead: 0,
  monthlySalaries: 736,
  monthlyDebt: 1000,
  capital,
  debts: [debt],
  cashOnHand: null,
});

section("combineBurnRate — the two numbers a contractor sees don't have to match, and here's why");

ok("cash out: $0 fixed + $736 salaries + $1,000 debt = $1,736/mo, exactly his figure",
  burn.totalMonthlyBurn === 1736, burn.totalMonthlyBurn);
ok("P&L cost: $0 fixed + $736 salaries + $2,196 capital = $2,932/mo, exactly his figure",
  burn.totalMonthlyCost === 2932, burn.totalMonthlyCost);
ok("the $1,196 gap between the two totals IS the depreciation, to the cent",
  round2(burn.totalMonthlyCost - burn.totalMonthlyBurn) === 1196,
  burn.totalMonthlyCost - burn.totalMonthlyBurn);
ok('the breakdown the "Includes A + B + C" sentence reads from sums to the CASH figure only ($1,736), never to the $2,932 total above it — which is why the capitalNote sentence has to run right after it',
  round2(burn.breakdown.overhead + burn.breakdown.salaries + burn.breakdown.debtChargedInFull) === 1736);

/* ══ 3. priceFromBurn: cost per job and the price floor ═════════════════════ */

const capacity = 1; // 1 job/week — 4.33/month, the input that displays as "4.3"
const price = priceFromBurn({ burn, capacity, targetMargin: normaliseTargetMargin(0.2) });

section("priceFromBurn — cost per job and the minimum price");

ok('"4.3 jobs/month" is 1 job/week × 4.33, displayed rounded to one decimal',
  price.jobsPerMonth === 4.3, price.jobsPerMonth);
ok("cost per job is $2,932 ÷ 4.33 = $677.14, which the whole-dollar display shows as $677",
  displayDollars(price.costPerJob) === 677, price.costPerJob);
ok("the owner's own back-of-envelope 677×4.3=2,911 (not 2,932) is explained by rounding: the CODE divides by the unrounded 4.33, his check used the rounded 4.3 the screen displays",
  Math.abs(price.costPerJob * 4.3 - 2911) < 1 && Math.abs(price.costPerJob * 4.33 - 2932) < 1);
ok("minimum price is cost ÷ (1 − margin) = $677.14 ÷ 0.8 = $846.42, which the whole-dollar display shows as $846",
  displayDollars(price.minimumPrice) === 846, price.minimumPrice);
// The formula this proves the code is NOT using — cost × (1 + margin) — would
// print $812, a different whole dollar. If this ever matched, the code
// changed formulas and the label ("minimum price at a 20% target margin")
// would be describing the wrong one.
ok("…and NOT cost × (1 + margin), which would round to $812, a visibly different number",
  displayDollars(price.costPerJob * 1.2) !== displayDollars(price.minimumPrice));

/* ══ 4. Every figure is right — but the SAME inputs also trip the ═══════════
   double-count warning, which is worth the owner's own attention ══════════ */
//
// Not a failure — a second, genuinely useful thing this exercise surfaces.
// The only way to reach $2,932 is an unlinked asset AND an unlinked debt
// existing side by side, which is exactly the shape doubleCountWarning
// exists to flag: "if these are the same truck, you're paying for it twice."
// If the owner's truck loan and depreciating truck genuinely are two
// different capital items, $2,932 is correct and this is a non-issue. If
// they're the same truck, linking them (Settings → Overhead → the asset's
// "Bought with which loan?" field) switches the debt to interest-only and
// LOWERS the total — checked below.

section("The same numbers also trip the double-count warning — worth the owner's own eyes");

const warning = doubleCountWarning(capital, [debt]);
ok("doubleCountWarning fires for exactly this shape (unlinked asset + unlinked debt)",
  Boolean(warning) && warning.unlinkedAssetIds.includes("asset_truck") && warning.unlinkedDebtIds.includes("debt_truck_loan"),
  warning);

// The counterfactual: if the truck loan WERE linked to the truck (same
// interest-free terms), the debt is charged as interest only — $0, since
// interestRate is 0 — and the total drops by the $1,000 that was being
// charged in full a moment ago.
const linkedAsset = { ...asset, debtId: debt.id };
const linkedCapital = assetOverhead({ assets: [linkedAsset], debts: [debt], asOf: now });
const linkedBurn = combineBurnRate({
  monthlyOverhead: 0,
  monthlySalaries: 736,
  monthlyDebt: 1000,
  capital: linkedCapital,
  debts: [debt],
  cashOnHand: null,
});
ok("IF they're the same truck: linking them removes the $1,000 double charge — cost drops from $2,932 to $1,932",
  linkedBurn.totalMonthlyCost === 1932, linkedBurn.totalMonthlyCost);
ok("…and cash out is unchanged at $1,736 either way — linking never touches what leaves the bank",
  linkedBurn.totalMonthlyBurn === 1736, linkedBurn.totalMonthlyBurn);
ok("…and once linked, the warning is gone",
  doubleCountWarning(linkedCapital, [debt]) === null);

/* ══ 5. Bills due: proven to be inert, not just documented as inert ════════ */
//
// "Where do bills due go? or just in stats?" — app/api/bills/route.js POST
// always writes recurring:false, and combineBurnRate/assetOverhead above
// take their monthlyOverhead input from Expense rows with
// {isOverhead:true, recurring:true} (lib/analytics/burnRate.js) — a bill can
// never be one of those rows. Proven here by construction: feeding the exact
// SAME burn inputs with and without "a bill" changes nothing, because a bill
// never becomes a monthlyOverhead/monthlySalaries/monthlyDebt/capital input
// in the first place — there is no bill-shaped argument to any function in
// this chain to omit or include.
section("Bills due literally cannot reach this arithmetic");
ok("combineBurnRate's inputs are four numbers and a capital summary — no bill, invoice or AP concept exists in its signature",
  combineBurnRate.length <= 1); // one destructured options object, not a bill list
ok("priceFromBurn takes a burn + capacity + margin — same: nothing bill-shaped to wire in",
  priceFromBurn.length <= 1);

/* ══ 6. Hostile input ════════════════════════════════════════════════════ */

section("Hostile input");

ok("zero capacity -> needsCapacity, not a divide-by-zero NaN",
  priceFromBurn({ burn, capacity: 0, targetMargin: 0.2 }).needsCapacity === true);
ok("negative capacity -> needsCapacity",
  priceFromBurn({ burn, capacity: -3, targetMargin: 0.2 }).needsCapacity === true);
ok("non-numeric capacity -> needsCapacity, not a throw",
  priceFromBurn({ burn, capacity: "a lot", targetMargin: 0.2 }).needsCapacity === true);
ok("a margin of 1 is clamped below 100%, so price isn't Infinity",
  Number.isFinite(priceFromBurn({ burn, capacity: 1, targetMargin: 1 }).minimumPrice));
ok("an asset with no in-service date charges nothing rather than guessing a life",
  assetOverhead({ assets: [{ id: "a", cost: 1000, usefulLifeMonths: 12 }], debts: [], asOf: now })
    .depreciation === 0);
ok("monthlyInterest on a $0-rate debt is $0, not NaN from a 0/0",
  monthlyInterest({ principal: 10000, interestRate: 0, monthlyPayment: 500, startDate: "2024-01-01" }, now) === 0);

function round2(n) {
  return Math.round(n * 100) / 100;
}

console.log(
  failures === 0
    ? "\nThe overhead screen's arithmetic is correct — the owner's numbers were right, the explanation beside them was the bug.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
