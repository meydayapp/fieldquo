// lib/analytics/googleAdsRollupData.js
//
// The database half of lib/analytics/googleAdsRollup.js — read by the Spend
// page's Google campaigns (app/api/marketing-spend/campaigns/route.js), the
// KPI page (app/api/analytics/finance-overview/route.js) and the monthly
// summary email (lib/analytics/monthlySummaryData.js), so the three cannot
// disagree about what a Google lead cost.
//
// Leads → quotes → jobs → invoices is followLeadsToMoney from
// lib/analytics/campaignRollupData.js — the same queries, including the
// confirmed-match conversion check, the Meta campaign rollup runs.

import { buildGoogleAdsRollup, GOOGLE_CLICK_NETWORK } from "@/lib/analytics/googleAdsRollup";
import { followLeadsToMoney } from "@/lib/analytics/campaignRollupData";
import { GOOGLE_PLATFORM } from "@/lib/googleAds/spendPlan";
import { loadLiveRates } from "@/lib/marketing/fxLive";

/**
 * @param {object} p
 * @param {object} p.db         a Prisma client (passed, so a check can stub it)
 * @param {string} p.companyId  every query carries it
 * @param {object|null} p.range a Prisma date filter for spend dates and lead
 *                              createdAt, or null for all time
 * @param {Date} p.asOf
 * @param {object[]|null} p.rates
 */
export async function loadGoogleAdsRollup({ db, companyId, range = null, asOf = new Date(), rates = null }) {
  const live = rates ? { rates } : await loadLiveRates({ prisma: db, asOf });
  const [company, spendRows, leads] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.marketingSpend.findMany({
      where: { companyId, platform: GOOGLE_PLATFORM, ...(range && { date: range }) },
      select: {
        campaignId: true,
        campaignName: true,
        objective: true,
        amount: true,
        currency: true,
        date: true,
        impressions: true,
        clicks: true,
        conversions: true,
        conversionsExact: true,
        source: true,
      },
    }),
    // FieldQuo's own Google leads: the landing carried a Google click id.
    db.leadRequest.findMany({
      where: {
        companyId,
        attribution: { path: ["clickNetwork"], equals: GOOGLE_CLICK_NETWORK },
        ...(range && { createdAt: range }),
      },
      select: {
        id: true,
        attribution: true,
        quoteId: true,
        source: true,
        name: true,
        email: true,
        phone: true,
        intake: true,
        createdAt: true,
      },
    }),
  ]);

  const { jobs, invoices } = await followLeadsToMoney({ db, companyId, leads });

  return buildGoogleAdsRollup({
    spendRows,
    // What the rollup counts, nothing it would print.
    leads: leads.map((l) => ({ id: l.id, attribution: l.attribution, quoteId: l.quoteId, inferredQuoteId: l.inferredQuoteId || null })),
    jobs,
    invoices,
    companyCurrency: company?.currency || "CAD",
    asOf,
    rates: live.rates,
  });
}
