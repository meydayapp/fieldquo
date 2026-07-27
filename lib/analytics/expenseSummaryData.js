// lib/analytics/expenseSummaryData.js
//
// Shared by app/api/expenses/summary/route.js (dashboard) and
// lib/ai/expenseSummary.js (AI summary) so both always agree on the same
// numbers — computed once, not duplicated in two places.
import { db } from "@/lib/db";
import { calculateBurnRate } from "@/lib/analytics/burnRate";

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function getExpenseSummaryData({ companyId, month, cashOnHand }) {
  const now = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    categoryBreakdown,
    jobExpenses,
    overheadExpenses,
    generalExpenses,
    burnRate,
    trend,
    recent,
  ] = await Promise.all([
    db.expense.groupBy({
      by: ["category"],
      where: { companyId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        date: { gte: periodStart, lt: periodEnd },
        projectId: { not: null },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        date: { gte: periodStart, lt: periodEnd },
        isOverhead: true,
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        date: { gte: periodStart, lt: periodEnd },
        isOverhead: false,
        projectId: null,
      },
      _sum: { amount: true },
    }),
    calculateBurnRate({ companyId, cashOnHand }),
    Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const monthsAgo = 5 - i;
        const start = new Date(
          now.getFullYear(),
          now.getMonth() - monthsAgo,
          1,
        );
        const end = new Date(
          now.getFullYear(),
          now.getMonth() - monthsAgo + 1,
          1,
        );
        const agg = await db.expense.aggregate({
          where: { companyId, date: { gte: start, lt: end } },
          _sum: { amount: true },
        });
        return {
          month: start.toLocaleString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          total: round2(Number(agg._sum.amount || 0)),
        };
      }),
    ),
    db.expense.findMany({
      where: { companyId },
      include: { material: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  const totalThisMonth = categoryBreakdown.reduce(
    (sum, c) => sum + Number(c._sum.amount || 0),
    0,
  );

  return {
    period: { start: periodStart, end: periodEnd },
    totalThisMonth: round2(totalThisMonth),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      total: round2(Number(c._sum.amount || 0)),
    })),
    associationBreakdown: {
      job: round2(Number(jobExpenses._sum.amount || 0)),
      overhead: round2(Number(overheadExpenses._sum.amount || 0)),
      general: round2(Number(generalExpenses._sum.amount || 0)),
    },
    burnRate,
    trend,
    recent,
  };
}
