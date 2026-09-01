// lib/analytics/marketingRollup.js
import { db } from "@/lib/db";

// Per-channel spend/leads/CPL aggregation — feeds the marketing spend screen
// (app/app/marketing/spend/page.js) and the forecast curve's
// leadsPer1000/leadToSale inputs.
//
// ── currency mismatch is excluded, not converted ────────────────────────────
//
// A MarketingSpend row carries a non-null `currency` only when it was synced
// from a Meta ad account whose OWN reporting currency differs from
// Company.currency (see the field's comment in schema.prisma) — manual
// entries and same-currency syncs are null, meaning "the company's own
// currency". Sums here never silently combine two currencies: a mismatched
// row is pulled out into `excludedCurrencyMismatch` instead, on the same
// "show it, don't blend it" reasoning docs/META-ADS-INTEGRATION.md Part 0
// uses for every figure this file returns.
export async function getMarketingRollup({ companyId, from, to }) {
  const [company, spends] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.marketingSpend.findMany({
      where: {
        companyId,
        ...(from && to && { date: { gte: from, lte: to } }),
      },
    }),
  ]);
  const companyCurrency = company?.currency || "CAD";

  const inCurrency = [];
  const mismatched = [];
  for (const entry of spends) {
    if (entry.currency && entry.currency !== companyCurrency) mismatched.push(entry);
    else inCurrency.push(entry);
  }

  const byChannel = {};

  for (const entry of inCurrency) {
    const key = entry.platform;
    if (!byChannel[key]) {
      byChannel[key] = {
        platform: key,
        spend: 0,
        leads: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
      };
    }
    byChannel[key].spend += Number(entry.amount);
    byChannel[key].leads += entry.leads || 0;
    byChannel[key].conversions += entry.conversions || 0;
    byChannel[key].clicks += entry.clicks || 0;
    byChannel[key].impressions += entry.impressions || 0;
  }

  const channels = Object.values(byChannel).map((c) => ({
    ...c,
    spend: round2(c.spend),
    // Self-reported, per row, by whoever typed the entry — NOT a figure
    // FieldQuo derived by linking two tables that don't talk to each other.
    // Shown labelled "as entered" by the caller; see the file header on why
    // this is a different (and lesser) claim than a computed attribution.
    costPerLead: c.leads > 0 ? round2(c.spend / c.leads) : null,
    costPerConversion:
      c.conversions > 0 ? round2(c.spend / c.conversions) : null,
    clickThroughRate:
      c.impressions > 0 ? round4(c.clicks / c.impressions) : null,
    leadConversionRate: c.leads > 0 ? round4(c.conversions / c.leads) : null,
  }));

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalLeads = channels.reduce((s, c) => s + c.leads, 0);

  const mismatchByCurrency = {};
  for (const entry of mismatched) {
    const cur = entry.currency;
    mismatchByCurrency[cur] = (mismatchByCurrency[cur] || 0) + Number(entry.amount);
  }

  return {
    companyCurrency,
    channels: channels.sort((a, b) => b.spend - a.spend),
    totals: {
      spend: round2(totalSpend),
      leads: totalLeads,
      // Hand-typed leads, summed across every channel and divided into
      // spend — the SAME shape of figure lib/analytics/kpis.js's
      // costPerLead already refuses per channel, just added up first. Kept
      // for callers that already read it, but NOT what a new caller should
      // reach for: lib/analytics/kpis.js's buildBlendedCostPerLead (fed by
      // getLeadCountsBySource below) uses real LeadRequest counts instead —
      // see docs/META-ADS-INTEGRATION.md Part 2 on why the two are
      // different claims.
      handTypedBlendedCostPerLead:
        totalLeads > 0 ? round2(totalSpend / totalLeads) : null,
    },
    excludedCurrencyMismatch: {
      count: mismatched.length,
      byCurrency: Object.fromEntries(
        Object.entries(mismatchByCurrency).map(([cur, amt]) => [cur, round2(amt)]),
      ),
    },
  };
}

/**
 * Real leads, grouped by LeadRequest.source, for the period — the
 * denominator lib/analytics/kpis.js's buildBlendedCostPerLead needs. A
 * plain groupBy; the exclusion of manual/imported sources happens in
 * buildBlendedCostPerLead itself, not here, so this function always
 * reflects the true count for anyone who wants it unfiltered.
 */
export async function getLeadCountsBySource({ companyId, from, to }) {
  const rows = await db.leadRequest.groupBy({
    by: ["source"],
    where: {
      companyId,
      ...(from && to && { createdAt: { gte: from, lte: to } }),
    },
    _count: { _all: true },
  });
  const counts = {};
  for (const row of rows) {
    counts[row.source || "unknown"] = row._count._all;
  }
  return counts;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
