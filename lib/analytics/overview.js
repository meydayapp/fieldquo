// lib/analytics/overview.js
import { db } from "@/lib/db";

export async function getAnalyticsOverview({ companyId }) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    quotesThisMonth,
    quotesAccepted,
    invoicesPaid,
    expensesThisMonth,
    quotesSentThisMonth,
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
  };
}
