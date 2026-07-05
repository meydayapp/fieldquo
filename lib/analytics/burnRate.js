// lib/analytics/burnRate.js
import { db } from "@/lib/db";

const FREQUENCY_TO_MONTHLY = {
  one_time: 0,
  weekly: 4.33,
  monthly: 1,
  yearly: 1 / 12,
};

export async function calculateBurnRate({ companyId, cashOnHand }) {
  const [overheadExpenses, salaries, debts] = await Promise.all([
    db.expense.findMany({
      where: { companyId, isOverhead: true, recurring: true },
      select: { amount: true, frequency: true },
    }),
    db.salary.findMany({
      where: { companyId, active: true },
      select: { amount: true, frequency: true },
    }),
    db.debt.findMany({
      where: { companyId, active: true },
      select: { monthlyPayment: true },
    }),
  ]);

  const monthlyOverhead = overheadExpenses.reduce(
    (sum, e) => sum + Number(e.amount) * FREQUENCY_TO_MONTHLY[e.frequency],
    0,
  );
  const monthlySalaries = salaries.reduce(
    (sum, s) => sum + Number(s.amount) * FREQUENCY_TO_MONTHLY[s.frequency],
    0,
  );
  const monthlyDebt = debts.reduce(
    (sum, d) => sum + Number(d.monthlyPayment),
    0,
  );

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
      runwayMonths !== null ? Math.round(runwayMonths * 10) / 10 : null,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
