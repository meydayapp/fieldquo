// lib/analytics/monthlySummaryData.js
//
// The database half of the monthly summary — reads, and nothing else.
//
// Every number is computed in lib/analytics/monthlySummary.js (pure, executed
// by scripts/check-monthly-summary.mjs). This file fetches rows and calls the
// existing loaders with the RIGHT MONTH, which is the bug it exists to fix:
// the digest used to ask getAnalyticsOverview() about "now" at 08:00 on the
// 1st, i.e. about the month that had just begun.
//
// ══ Read-only, on purpose ═════════════════════════════════════════════════
//
// No create, update, upsert or recordError in this file. The preview script
// (scripts/preview-monthly-summary.mjs) runs it against a real company with a
// production DATABASE_URL, and that is only safe because nothing here writes.
// scripts/check-monthly-summary.mjs asserts the absence.
//
// ══ Month boundaries are UTC ═══════════════════════════════════════════════
//
// lib/messaging/monthlyReview.js's monthRange() — the one month definition the
// conversation attribution, the receivables trend (dayKey) and the period
// presets already share. getAnalyticsOverview() still builds its money months
// from the server clock, which on Vercel is UTC, so the two agree in
// production; its QUOTE counts use the company's own month (quotes carry
// true instants — see that file). It is handed a date in the MIDDLE of the
// month so neither a developer's clock nor any company zone can move it into
// the wrong one.

import { monthRange } from "@/lib/messaging/monthlyReview";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import { getMarketingRollup, getLeadCountsBySource } from "@/lib/analytics/marketingRollup";
import { loadCampaignRollup } from "@/lib/analytics/campaignRollupData";
import { loadMonthlyConversations } from "@/lib/attribution/loadMonthlyConversations";
import { buildMonthlySummary } from "@/lib/analytics/monthlySummary";

/** The UTC month containing `date`, and the month before it. */
export function summaryMonths(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const period = monthRange(y, m);
  const prior = monthRange(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  return { period, prior };
}

/**
 * Everything one company's summary needs, read from the database.
 *
 * @param {object} p
 * @param {object} p.db          a Prisma client
 * @param {string} p.companyId
 * @param {Date}   p.periodStart any instant inside the month being reported
 * @param {Date}   [p.asOf]      when the email is built (default now) — the
 *                               clock for "waiting 3 days" and money owed
 * @returns {{ company, summary, failures: string[] }}
 *   `failures` names the optional sections that could not be read (campaigns,
 *   conversations). Their sections are then absent from the email — never
 *   printed as zero — and the caller logs the names.
 */
export async function loadMonthlySummary({ db, companyId, periodStart, asOf = new Date() }) {
  if (!companyId) throw new Error("loadMonthlySummary: companyId is required");
  const { period, prior } = summaryMonths(periodStart);
  const mid = new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth(), 15, 12));
  const inPeriod = { gte: period.start, lt: period.end };
  const inPrior = { gte: prior.start, lt: prior.end };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      currency: true,
      dateFormat: true,
      defaultLanguage: true,
      createdAt: true,
    },
  });
  if (!company) throw new Error(`loadMonthlySummary: no company ${companyId}`);

  // overview.js's own comparable-period rule, restated as a date test rather
  // than re-derived: the company existed for the whole of the prior month.
  const hadFullPriorMonth = company.createdAt != null && new Date(company.createdAt) <= prior.start;

  const [
    overview,
    invoices,
    payments,
    leads,
    priorLeadCountsBySource,
    jobsCompleted,
    priorJobsCompleted,
    marketing,
    priorMarketing,
    waitingQuotes,
  ] = await Promise.all([
    getAnalyticsOverview({ companyId, now: mid }),
    // The receivables ledger, the same select lib/dashboard/homeData.js reads
    // for the money panel (buildReceivables needs every version).
    db.invoice.findMany({
      where: { companyId },
      select: {
        id: true, companyId: true, parentInvoiceId: true, version: true, invoiceNumber: true, status: true, total: true,
        dueDate: true, sentAt: true, createdAt: true, historicalImportedAt: true, endDate: true, paidDate: true,
        clientId: true, jobId: true, quoteId: true, lastChasedAt: true, chaseCount: true,
      },
    }),
    db.payment.findMany({
      where: { invoice: { companyId } },
      select: { invoiceId: true, amount: true, date: true },
    }),
    db.leadRequest.findMany({
      where: { companyId, createdAt: inPeriod },
      select: { id: true, source: true, status: true, quoteId: true, createdAt: true, quote: { select: { status: true } } },
    }),
    getLeadCountsBySource({ companyId, from: prior.start, to: new Date(prior.end.getTime() - 1) }),
    db.job.findMany({
      where: { companyId, status: "completed", completedAt: inPeriod },
      select: { id: true, quoteId: true, completedAt: true },
    }),
    db.job.count({ where: { companyId, status: "completed", completedAt: inPrior } }),
    getMarketingRollup({ companyId, from: period.start, to: new Date(period.end.getTime() - 1), asOf }),
    getMarketingRollup({ companyId, from: prior.start, to: new Date(prior.end.getTime() - 1), asOf }),
    // Sent this month and still unanswered. Only this month's: a quote that
    // has waited since spring is a different conversation, not a follow-up.
    db.quote.findMany({
      where: { companyId, status: "sent", archivedAt: null, sentAt: { gte: period.start, lte: asOf } },
      select: { id: true, total: true, sentAt: true },
    }),
  ]);

  // Optional sections. Each is read on its own and a failure removes the
  // section, it does not sink the email — the tiles above are the summary,
  // these are colour.
  const failures = [];
  let campaigns = null;
  try {
    campaigns = await loadCampaignRollup({ db, companyId, range: inPeriod, asOf });
  } catch (err) {
    failures.push(`campaigns: ${err?.message || err}`);
  }
  let conversations = null;
  try {
    const y = period.start.getUTCFullYear();
    const m = period.start.getUTCMonth() + 1;
    const loaded = await loadMonthlyConversations({ db, companyId, year: y, month: m });
    conversations = loaded?.ok ? loaded.rollup : null;
  } catch (err) {
    failures.push(`conversations: ${err?.message || err}`);
  }

  const summary = buildMonthlySummary({
    period,
    prior,
    asOf,
    hadFullPriorMonth,
    invoices,
    payments,
    overview,
    leads: leads.map((l) => ({ ...l, quoteStatus: l.quote?.status ?? null })),
    priorLeadCountsBySource,
    jobsCompleted,
    priorJobsCompleted,
    marketing,
    priorMarketing,
    campaigns,
    conversations,
    waitingQuotes,
  });

  return { company, summary, failures };
}
