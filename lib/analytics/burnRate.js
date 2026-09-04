// lib/analytics/burnRate.js
//
// What the business costs to run for a month, from the three places a fixed
// cost can be recorded:
//
//   1. recurring overhead Expenses  — rent, insurance, the phone bill
//   2. Salary rows with no worker   — the owner's draw, an office wage
//   3. Debt rows                    — the truck loan, the finance agreement
//   4. Asset rows                   — the truck itself, wearing out
//
// Everything downstream depends on this one number: the runway KPI on
// Settings → Expense Tracking, and — through lib/analytics/minimumPrice.js —
// the cost-per-job the quote builder charges against every estimate. A wrong
// answer here is a wrong price, so the arithmetic is deliberately defensive.
//
// ── Why there are now TWO totals ───────────────────────────────────────────
//
// This file answered two different questions with one number, and the truck is
// exactly where they part company.
//
//   totalMonthlyBurn — CASH. What leaves the bank in a month. Runway is this
//                      divided into cash on hand, so the loan's whole payment
//                      belongs in it and depreciation — which moves no money —
//                      does not. Unchanged in meaning and in value; every
//                      existing caller keeps the number it already had.
//
//   totalMonthlyCost — P&L. What a month of trading actually costs, and
//                      therefore what a job has to cover. Depreciation is in
//                      it; the capital half of a loan payment is not, because
//                      repaying a liability is not an expense.
//
// Collapsing those two is what let a contractor drop the truck from their
// overhead the month the loan ended while the truck kept wearing out. See
// lib/accounting/depreciation.js for the full argument and for the rule that
// decides which loans are charged at interest and which in full.
import { db } from "@/lib/db";
import { assetOverhead, doubleCountWarning } from "@/lib/accounting/depreciation";

// ── Why this is a function and not the object literal it used to be ─────────
//
// It was `FREQUENCY_TO_MONTHLY[e.frequency]`, a bare lookup on a four-key map.
// Any frequency outside the map returned undefined, `amount * undefined` is
// NaN, and NaN propagates through every sum: one unrecognised row turned the
// whole monthly burn into NaN, then cost-per-job into NaN, then the minimum
// price into `null` on the wire — a price floor that silently disappeared with
// nothing anywhere saying why. Adding a fifth enum value (`hourly`) would have
// done exactly that.
//
// Unknown now contributes 0. Zero is the honest answer for "we can't convert
// this to a month", and it can't poison the other rows.
const FREQUENCY_TO_MONTHLY = {
  one_time: 0,
  weekly: 4.33,
  monthly: 1,
  yearly: 1 / 12,
  // hourly has no factor: it needs hours-per-week, which only Salary carries.
  // See monthlyFromSalary below.
  hourly: 0,
};

const WEEKS_PER_MONTH = 4.33;

function monthlyFactor(frequency) {
  const factor = FREQUENCY_TO_MONTHLY[frequency];
  return Number.isFinite(factor) ? factor : 0;
}

// Decimal columns arrive as Prisma Decimal or null. Number(null) is 0, but
// Number(undefined) is NaN, and a NaN here is the bug described above.
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * One salary row's contribution to a month.
 *
 * Hourly is the case worth reading: `amount` is a RATE, not a sum, so it only
 * becomes a monthly cost once multiplied by hours. A row that says "hourly"
 * with no hours recorded contributes nothing — we genuinely don't know what it
 * costs, and guessing full-time would inflate a price floor by whatever the
 * guess was wrong by.
 */
export function monthlyFromSalary(salary) {
  const amount = num(salary?.amount);
  if (salary?.frequency === "hourly") {
    const hours = num(salary?.hoursPerWeek);
    if (hours <= 0) return 0;
    return amount * hours * WEEKS_PER_MONTH;
  }
  return amount * monthlyFactor(salary?.frequency);
}

export function monthlyFromExpense(expense) {
  return num(expense?.amount) * monthlyFactor(expense?.frequency);
}

export async function calculateBurnRate({ companyId, cashOnHand, asOf }) {
  // Pinned once. Two reads of `new Date()` a few milliseconds apart can land
  // either side of a month boundary, and an asset that is fully depreciated in
  // one half of this function and not in the other produces a total that does
  // not equal its own breakdown.
  const now = asOf instanceof Date ? asOf : new Date();

  const [overheadExpenses, salaries, debts, assets] = await Promise.all([
    db.expense.findMany({
      where: { companyId, isOverhead: true, recurring: true },
      select: { amount: true, frequency: true },
    }),
    db.salary.findMany({
      where: { companyId, active: true },
      // hoursPerWeek was missing here, so an hourly overhead wage would have
      // been read as an unconvertible row and dropped.
      select: { amount: true, frequency: true, hoursPerWeek: true },
    }),
    db.debt.findMany({
      where: { companyId, active: true },
      // principal, rate and startDate are what the interest is amortised from
      // — the balance is not stored anywhere, because a stored one is wrong
      // the month after it is written.
      select: {
        id: true,
        monthlyPayment: true,
        principal: true,
        interestRate: true,
        startDate: true,
        active: true,
      },
    }),
    // Disposed and inactive rows are fetched too rather than filtered in SQL:
    // assetCharge() decides what a row contributes and says WHY, and a screen
    // that shows "sold in March — no longer charged" is the difference between
    // a $0 that reads as correct and a $0 that reads as broken.
    db.asset.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        cost: true,
        salvageValue: true,
        inServiceDate: true,
        usefulLifeMonths: true,
        disposedOn: true,
        active: true,
        debtId: true,
      },
    }),
  ]);

  const monthlyOverhead = overheadExpenses.reduce(
    (sum, e) => sum + monthlyFromExpense(e),
    0,
  );
  const monthlySalaries = salaries.reduce(
    (sum, s) => sum + monthlyFromSalary(s),
    0,
  );
  const monthlyDebt = debts.reduce((sum, d) => sum + num(d.monthlyPayment), 0);

  // The capital side, with the double count already removed. Everything about
  // which loans are charged at interest and which in full is decided in
  // lib/accounting/depreciation.js and asserted by
  // scripts/check-depreciation.mjs; nothing about that rule is restated here,
  // because a second copy of a rule is the copy that rots (AGENTS.md #4).
  const capital = assetOverhead({ assets, debts, asOf: now });

  return {
    ...combineBurnRate({
      monthlyOverhead,
      monthlySalaries,
      monthlyDebt,
      capital,
      debts,
      cashOnHand,
    }),
    // How many rows any of these totals were built from, across all four
    // tables. A company that has never opened Settings → Overhead sums to
    // exactly $0 — and "$0 a month in fixed costs" is a claim about a
    // business, where the truth is that nobody has told us anything yet.
    // combineBurnRate stays pure and unchanged (check-overhead-arithmetic
    // calls it directly with the owner's own figures); this is a fact about
    // the QUERY, which only this function ever runs.
    sourcesRecorded:
      overheadExpenses.length + salaries.length + debts.length + assets.length,
  };
}

/**
 * The arithmetic half of calculateBurnRate, split out so it can be executed
 * without a database. Every number it needs — the four monthly totals and
 * the capital summary from assetOverhead() — is already real production
 * output by the time it reaches here; this function only combines them, the
 * same combination calculateBurnRate above always did inline.
 *
 * scripts/check-overhead-arithmetic.mjs calls this directly with the owner's
 * own reported figures (2026-08-30: $0 fixed, $736 salaries, $1,000 debt,
 * $1,196/mo depreciation, $0 interest) so the numbers Settings → Overhead
 * shows are proven against the real function, not re-derived by hand in a
 * test and asserted to agree with itself.
 */
export function combineBurnRate({
  monthlyOverhead,
  monthlySalaries,
  monthlyDebt,
  capital,
  debts = [],
  cashOnHand,
}) {
  // CASH. Unchanged: every payment in full, no depreciation. Runway divides
  // into this.
  const totalMonthlyBurn = monthlyOverhead + monthlySalaries + monthlyDebt;

  // P&L. What a job has to cover. `capital.monthlyCost` already contains the
  // depreciation, the interest on the asset-backed loans and the full payment
  // on the loans nothing is carrying — so monthlyDebt is deliberately NOT
  // added here. Adding it would be the double count this whole change exists
  // to remove.
  const totalMonthlyCost = monthlyOverhead + monthlySalaries + capital.monthlyCost;

  const runwayMonths =
    cashOnHand && totalMonthlyBurn > 0
      ? Number(cashOnHand) / totalMonthlyBurn
      : null;

  return {
    breakdown: {
      overhead: round2(monthlyOverhead),
      salaries: round2(monthlySalaries),
      // The cash figure, kept under its original name so the burn-rate bars on
      // Settings → Expense Tracking still sum to the total printed beside them.
      debt: round2(monthlyDebt),
      // The P&L split of that same debt: what is charged as interest because
      // an asset is carrying the capital, and what is still charged in full
      // because nothing is.
      debtInterest: capital.debtInterest,
      debtChargedInFull: capital.debtPrincipalCharged,
      depreciation: capital.depreciation,
    },
    totalMonthlyBurn: round2(totalMonthlyBurn),
    totalMonthlyCost: round2(totalMonthlyCost),
    // Per-asset detail so a screen can show why a charge is what it is — a $0
    // asset carries the reason it is $0 rather than looking broken.
    assets: capital.assets,
    interestOnlyDebtIds: capital.interestOnlyDebtIds,
    // Non-null only when an unlinked asset and an unlinked loan both exist, so
    // the screen can ask rather than the server guessing a pairing.
    doubleCountRisk: doubleCountWarning(capital, debts),
    runwayMonths:
      runwayMonths !== null && Number.isFinite(runwayMonths)
        ? Math.round(runwayMonths * 10) / 10
        : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
