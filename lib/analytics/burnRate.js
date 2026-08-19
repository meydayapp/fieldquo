// lib/analytics/burnRate.js
//
// What the business costs to run for a month, from the three places a fixed
// cost can be recorded:
//
//   1. recurring overhead Expenses  — rent, insurance, the phone bill
//   2. Salary rows with no worker   — the owner's draw, an office wage
//   3. Debt rows                    — the truck loan, the finance agreement
//
// Everything downstream depends on this one number: the runway KPI on
// Settings → Expense Tracking, and — through lib/analytics/minimumPrice.js —
// the cost-per-job the quote builder charges against every estimate. A wrong
// answer here is a wrong price, so the arithmetic is deliberately defensive.
import { db } from "@/lib/db";

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

export async function calculateBurnRate({ companyId, cashOnHand }) {
  const [overheadExpenses, salaries, debts] = await Promise.all([
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
      select: { monthlyPayment: true },
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

  const totalMonthlyBurn = monthlyOverhead + monthlySalaries + monthlyDebt;

  const runwayMonths =
    cashOnHand && totalMonthlyBurn > 0
      ? Number(cashOnHand) / totalMonthlyBurn
      : null;

  return {
    breakdown: {
      overhead: round2(monthlyOverhead),
      salaries: round2(monthlySalaries),
      debt: round2(monthlyDebt),
    },
    totalMonthlyBurn: round2(totalMonthlyBurn),
    runwayMonths:
      runwayMonths !== null && Number.isFinite(runwayMonths)
        ? Math.round(runwayMonths * 10) / 10
        : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
