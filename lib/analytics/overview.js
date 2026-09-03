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
    invoicesPaidLastMonth,
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
      // createdAt decides whether a prior month EXISTS to compare against —
      // see the comparable-period test below. Selected here rather than in a
      // second query because this row is already being read for the goal.
      select: { revenueGoalAnnual: true, createdAt: true },
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
    // Last month's paid revenue. Deliberately the SAME measure as the current
    // month above — invoices whose status is `paid`, summed by `total` — and
    // deliberately NOT the payments-received series in lib/analytics/trend.js,
    // which answers a different question and which this codebase keeps
    // distinct on purpose. A card that compared paid invoices against payments
    // received would report a change that is only a change of definition.
    db.invoice.aggregate({
      where: {
        companyId,
        status: "paid",
        updatedAt: { gte: startOfLastMonth, lt: endOfLastMonth },
      },
      _sum: { total: true },
    }),
  ]);

  const conversionRate =
    quotesSentThisMonth > 0 ? quotesAccepted / quotesSentThisMonth : null;

  // ── Is there a prior month to compare against at all? ─────────────────────
  //
  // Three different things get called "last month was zero", and only two of
  // them are true statements:
  //
  //   1. The company traded all of last month and took nothing. Real: $0.
  //   2. The company traded all of last month and took $4,000. Real.
  //   3. The company did not exist for all of last month.
  //
  // The third is not a measurement, and lib/analytics/trend.js's compare()
  // names exactly this case — "a company's first month" — as the one where the
  // prior must be null rather than zero. A company that signed up on the 15th
  // has a HALF month behind it; comparing a full month against it manufactures
  // growth out of the calendar, and the first thing a new owner would see is a
  // number congratulating them on an increase they did not earn.
  //
  // So every prior below is gated on the company having existed for the whole
  // of last month. Case 1 still reports 0 — a real zero is a real answer, and
  // compare() renders it as "up" with no percentage rather than dividing by it.
  const hadFullPriorMonth =
    company?.createdAt != null && new Date(company.createdAt) <= startOfLastMonth;

  // null, not zero, when last month had no sent quotes — "up from 0%" off no
  // activity is a claim we haven't earned. compare() treats null as "no prior".
  const priorConversionRate =
    hadFullPriorMonth && quotesSentLastMonth > 0
      ? quotesAcceptedLastMonth / quotesSentLastMonth
      : null;
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
    // Last month's revenue, on the wire so the hero card can state a change
    // instead of a bare figure. lib/dashboard/rank.js already asks for this by
    // name; until now it resolved to undefined and the delta was omitted.
    priorRevenue: hadFullPriorMonth
      ? Number(invoicesPaidLastMonth._sum.total || 0)
      : null,
    // Last month's SENT count — the denominator behind priorConversionRate.
    // Sent as well as the rate because a rate without its sample cannot be
    // floored: rank.js applies RATE_FLOOR to the current month and, without
    // this, had to trust a prior that might have been drawn from two quotes.
    priorQuotesSent: hadFullPriorMonth ? quotesSentLastMonth : null,
    // null when no goal is set — the card renders only when there's a target
    // the owner actually chose, never an invented one.
    goal: goalProgress({
      annualGoal: company?.revenueGoalAnnual != null ? Number(company.revenueGoalAnnual) : null,
      revenueYtd: Number(revenueYtdAgg._sum.total || 0),
      now,
    }),
  };
}
