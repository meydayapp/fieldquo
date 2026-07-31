// lib/analytics/overview.js
import { db } from "@/lib/db";
import { goalProgress } from "@/lib/analytics/goal";

export async function getAnalyticsOverview({ companyId }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  // Last month's window, for an honest "up from…" comparison. A single-period
  // number handed to the AI with a prompt that asks "vs last month" is how the
  // model ends up inventing a prior figure — so the prior is computed, not left
  // to be guessed.
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = startOfMonth;

  const [
    quotesThisMonth,
    quotesAccepted,
    invoicesPaid,
    expensesThisMonth,
    quotesSentThisMonth,
    revenueYtdAgg,
    company,
    quotesAcceptedLastMonth,
    quotesSentLastMonth,
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
    // Last month's accepted + sent, for the conversion comparison.
    db.quote.count({
      where: {
        companyId,
        status: "accepted",
        updatedAt: { gte: startOfLastMonth, lt: endOfLastMonth },
      },
    }),
    db.quote.count({
      where: {
        companyId,
        status: { in: ["sent", "accepted", "declined"] },
        createdAt: { gte: startOfLastMonth, lt: endOfLastMonth },
      },
    }),
  ]);

  const conversionRate =
    quotesSentThisMonth > 0 ? quotesAccepted / quotesSentThisMonth : null;
  // null, not zero, when last month had no sent quotes — "up from 0%" off no
  // activity is a claim we haven't earned. compare() treats null as "no prior".
  const priorConversionRate =
    quotesSentLastMonth > 0 ? quotesAcceptedLastMonth / quotesSentLastMonth : null;
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
    priorConversionRate,
    // null when no goal is set — the card renders only when there's a target
    // the owner actually chose, never an invented one.
    goal: goalProgress({
      annualGoal: company?.revenueGoalAnnual != null ? Number(company.revenueGoalAnnual) : null,
      revenueYtd: Number(revenueYtdAgg._sum.total || 0),
      now,
    }),
  };
}
