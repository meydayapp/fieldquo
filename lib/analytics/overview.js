// lib/analytics/overview.js
import { db } from "@/lib/db";
import { goalProgress } from "@/lib/analytics/goal";

export async function getAnalyticsOverview({ companyId }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    quotesThisMonth,
    quotesAccepted,
    invoicesPaid,
    expensesThisMonth,
    quotesSentThisMonth,
    revenueYtdAgg,
    company,
  ] = await Promise.all([
    db.quote.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
    db.quote.count({
      where: {
        companyId,
        status: "accepted",
        updatedAt: { gte: startOfMonth },
      },
    }),
    db.invoice.aggregate({
      where: { companyId, status: "paid", updatedAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { companyId, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    db.quote.count({
      where: {
        companyId,
        status: { in: ["sent", "accepted", "declined"] },
        createdAt: { gte: startOfMonth },
      },
    }),
    // Year-to-date paid revenue, for the goal. The SAME "paid invoices" measure
    // as the monthly figure above, widened to the year — so the goal card and
    // the revenue card can never tell two different stories about the same money.
    db.invoice.aggregate({
      where: { companyId, status: "paid", updatedAt: { gte: startOfYear } },
      _sum: { total: true },
    }),
    db.company.findUnique({
      where: { id: companyId },
      select: { revenueGoalAnnual: true },
    }),
  ]);

  const conversionRate =
    quotesSentThisMonth > 0 ? quotesAccepted / quotesSentThisMonth : null;
  const revenue = Number(invoicesPaid._sum.total || 0);
  const expenses = Number(expensesThisMonth._sum.amount || 0);

  return {
    period: startOfMonth,
    revenue,
    revenueInvoiceCount: invoicesPaid._count,
    expenses,
    margin: revenue > 0 ? (revenue - expenses) / revenue : null,
    quotesCreated: quotesThisMonth,
    quotesSent: quotesSentThisMonth,
    quotesAccepted,
    conversionRate,
    // null when no goal is set — the card renders only when there's a target
    // the owner actually chose, never an invented one.
    goal: goalProgress({
      annualGoal: company?.revenueGoalAnnual != null ? Number(company.revenueGoalAnnual) : null,
      revenueYtd: Number(revenueYtdAgg._sum.total || 0),
      now,
    }),
  };
}
