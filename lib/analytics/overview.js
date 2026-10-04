// lib/analytics/overview.js
import { db } from "@/lib/db";
import { goalProgress } from "@/lib/analytics/goal";
import { monthWindow } from "@/lib/marketing/videoAllowance";

// `now` picks WHICH month is "this month". Defaulted to the real clock for the
// dashboard route; the monthly summary (lib/analytics/monthlySummaryData.js)
// passes a date inside the month it is reporting. That cron runs at 08:00 on
// the 1st, and before this parameter existed it called this function with no
// date — so "Your September summary" reported the first eight hours of
// OCTOBER: "Revenue and expenses were both 0 this month… created 0 quotes",
// beside a lead count that WAS September's because the marketing rollup was
// given the right window. Every current-month filter below is now bounded
// above by the end of that month too; with the real clock that bound is in the
// future and changes nothing.
export async function getAnalyticsOverview({ companyId, now = new Date() }) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  // Last month's window, for an honest "up from…" comparison. A single-period
  // number handed to the AI with a prompt that asks "vs last month" is how the
  // model ends up inventing a prior figure — so the prior is computed, not left
  // to be guessed.
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = startOfMonth;

  // ── The quote counts: the company's month, and never an imported row ──────
  //
  // The quote tiles counted Quote.createdAt in the SERVER's month with no
  // history filter. A company that typed a year of past jobs into the Past
  // jobs screen this month (POST /api/jobs/import back-fills an accepted
  // quote per job) was told it had sent 18 quotes and converted 6% — "1 of
  // 18" — when it had sent two. Those rows were never sent at all (sentAt
  // stays null; see Quote.historicalImportedAt), so:
  //
  //   * SENT is counted by sentAt, the instant it actually left — the rule
  //     lib/dashboard/homeData.js's "Your focus" count already uses — not by
  //     when the row was created;
  //   * every quote count here carries historicalImportedAt: null;
  //   * the month is the COMPANY's month (Company.timezone), because these
  //     are true instants: a quote sent at 9 pm on the 30th in Vancouver was
  //     sent in that month, not the next one.
  //
  // Only the quote counts move to the company's zone. Expense.date and a
  // typed Invoice.paidDate are DAYS stored at UTC midnight; bounding them by
  // a zone's midnight would drop an expense dated the 1st into the month
  // before. They keep the month above until they carry an instant.
  const company = await db.company.findUnique({
    where: { id: companyId },
    // createdAt decides whether a prior month EXISTS to compare against —
    // see the comparable-period test below. timezone picks the quote months.
    select: { revenueGoalAnnual: true, createdAt: true, timezone: true },
  });
  const quoteMonth = monthWindow(now, company?.timezone || undefined);
  const quotePriorMonth = monthWindow(new Date(quoteMonth.start.getTime() - 1), quoteMonth.timeZone);
  const quotesThisMonthWindow = { gte: quoteMonth.start, lt: quoteMonth.end };
  const quotesLastMonthWindow = { gte: quotePriorMonth.start, lt: quotePriorMonth.end };

  const [
    quotesThisMonth,
    quotesAccepted,
    invoicesPaid,
    expensesThisMonth,
    quotesSentThisMonth,
    revenueYtdAgg,
    quotesAcceptedLastMonth,
    quotesSentLastMonth,
    invoicesPaidLastMonth,
  ] = await Promise.all([
    db.quote.count({ where: { companyId, historicalImportedAt: null, createdAt: quotesThisMonthWindow } }),
    db.quote.count({
      where: {
        companyId,
        status: "accepted",
        historicalImportedAt: null,
        acceptedAt: { gte: quotesThisMonthWindow.gte, lt: quotesThisMonthWindow.lt },
      },
    }),
    // By the date it was PAID, not `updatedAt`. Every filter in this file used
    // updatedAt as a stand-in for "when it happened", and updatedAt moves on
    // any edit: reprinting a paid invoice's PDF, fixing a typo in the client's
    // address, an amendment. A March invoice touched in May became May's
    // revenue on the home page while statements and money-flow — which read
    // Payment.date — still said March, and the three disagreed. Invoice.paidDate
    // is stamped on every paid transition (lib/invoices/family.js,
    // recordStripePayment.js, app/api/payments) and never moves after.
    // Quote.acceptedAt, likewise, is written once at acceptance.
    db.invoice.aggregate({
      where: { companyId, status: "paid", paidDate: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { total: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { companyId, date: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { amount: true },
    }),
    // Sent IN the month, whatever has happened to it since — homeData's rule.
    // sentAt is stamped only when a send actually went out.
    db.quote.count({ where: { companyId, historicalImportedAt: null, sentAt: quotesThisMonthWindow } }),
    // Year-to-date paid revenue, for the goal. The SAME "paid invoices" measure
    // as the monthly figure above, widened to the year — so the goal card and
    // the revenue card can never tell two different stories about the same money.
    db.invoice.aggregate({
      where: { companyId, status: "paid", paidDate: { gte: startOfYear, lt: startOfNextMonth } },
      _sum: { total: true },
    }),
    // Last month's accepted + sent, for the conversion comparison.
    db.quote.count({
      where: {
        companyId,
        status: "accepted",
        historicalImportedAt: null,
        acceptedAt: { gte: quotesLastMonthWindow.gte, lt: quotesLastMonthWindow.lt },
      },
    }),
    db.quote.count({ where: { companyId, historicalImportedAt: null, sentAt: quotesLastMonthWindow } }),
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
        paidDate: { gte: startOfLastMonth, lt: endOfLastMonth },
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
