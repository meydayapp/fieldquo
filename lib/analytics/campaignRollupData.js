// lib/analytics/campaignRollupData.js
//
// The database half of lib/analytics/campaignRollup.js — moved here, verbatim,
// out of app/api/marketing-spend/campaigns/route.js.
//
// It lived in the route while the Spend page was its only reader. The monthly
// summary email (lib/analytics/monthlySummaryData.js) needs the same per-campaign
// leads, quotes and jobs, and a second copy of these four queries would be
// the copy that rots (AGENTS.md failure class 4) — the first one to drift
// would make the email and the Spend page disagree about the same campaign.
// So both call this, and campaignRollup.js still does all the counting.

import { buildCampaignRollup } from "@/lib/analytics/campaignRollup";
import { loadLiveRates } from "@/lib/marketing/fxLive";

/**
 * @param {object} p
 * @param {object} p.db         a Prisma client (passed, so a check can stub it)
 * @param {string} p.companyId  the tenant — every query carries it
 * @param {object|null} p.range a Prisma date filter ({ gte, lte } or
 *                              { gte, lt }) applied to spend dates and lead
 *                              createdAt, or null for all time
 * @param {Date} p.asOf         the clock the pinned rate's age is measured against
 */
export async function loadCampaignRollup({ db, companyId, range = null, asOf = new Date(), rates = null }) {
  // The daily fetched exchange rate, falling back to the checked-in one
  // (lib/marketing/fxLive.js) — unless the caller already holds a list.
  const live = rates ? { rates } : await loadLiveRates({ prisma: db, asOf });
  const [company, spendRows, leads] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.marketingSpend.findMany({
      where: {
        companyId,
        source: "meta_api",
        campaignId: { not: null },
        ...(range && { date: range }),
      },
      select: {
        campaignId: true,
        campaignName: true,
        objective: true,
        amount: true,
        currency: true,
        date: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        conversions: true,
        messagingConversations: true,
        videoViews: true,
        postEngagements: true,
      },
    }),
    // Leads that arrived in the period, from a Meta lead form, with the
    // campaign resolved. What became of them is followed below without a
    // date bound: the lead is in the period, the invoice may be later.
    db.leadRequest.findMany({
      where: {
        companyId,
        metaCampaignId: { not: null },
        ...(range && { createdAt: range }),
      },
      select: { id: true, metaCampaignId: true, metaCampaignName: true, quoteId: true },
    }),
  ]);

  const quoteIds = [...new Set(leads.map((l) => l.quoteId).filter(Boolean))];
  const jobs = quoteIds.length
    ? await db.job.findMany({
        where: { companyId, quoteId: { in: quoteIds } },
        select: { id: true, quoteId: true, createdAt: true },
        // Oldest first, so campaignRollup's "first job on a quote" is the one
        // acceptance created — the same order lib/invoices/jobLink.js uses.
        orderBy: { createdAt: "asc" },
      })
    : [];
  const jobIds = jobs.map((j) => j.id);
  // Every issued invoice billing those jobs — by the explicit Job link, or
  // (when none) by the quote. The same two-branch resolution
  // app/api/analytics/kpis/route.js runs for job revenue.
  //
  // `notIn: ["draft"]` only. InvoiceStatus has no `cancelled` member
  // (schema.prisma: draft · sent · paid · overdue · refunded ·
  // partially_refunded · disputed), and Prisma refuses a filter naming one —
  // "Invalid value for argument `notIn`. Expected InvoiceStatus." — before
  // the query reaches Postgres. Executed against the generated client while
  // writing this route; the KPI route's copy of this filter carries the
  // phantom value and is fixed in its own commit.
  const invoices = jobIds.length
    ? await db.invoice.findMany({
        where: {
          companyId,
          status: { notIn: ["draft"] },
          OR: [{ jobId: { in: jobIds } }, { jobId: null, quoteId: { in: quoteIds } }],
        },
        select: { id: true, parentInvoiceId: true, version: true, total: true, jobId: true, quoteId: true },
      })
    : [];

  return buildCampaignRollup({
    spendRows,
    leads,
    jobs,
    invoices,
    companyCurrency: company?.currency || "CAD",
    asOf,
    rates: live.rates,
  });
}
