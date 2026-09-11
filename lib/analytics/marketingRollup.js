// lib/analytics/marketingRollup.js
import { db } from "@/lib/db";
import { priceSpendRows } from "@/lib/analytics/spendCurrency";

// Per-channel spend/leads/CPL aggregation — feeds the marketing spend screen
// (app/app/marketing/spend/page.js), the KPI page's business-costs card
// (app/api/analytics/finance-overview/route.js) and the monthly digest.
//
// ── currency mismatch is converted at read time, and says so ────────────────
//
// A MarketingSpend row carries a non-null `currency` only when it was synced
// from a Meta ad account whose OWN reporting currency differs from
// Company.currency (see the field's comment in schema.prisma) — manual
// entries and same-currency syncs are null, meaning "the company's own
// currency".
//
// This file used to EXCLUDE those rows from every total. The first real ad
// account connected to the product reports in USD for a CAD company, and the
// exclusion turned 43 rows of the only genuine ad spend in the system into a
// "$0.00" on the two screens that matter. So the rows are now INCLUDED at
// the pinned rate in lib/marketing/fx.js, and every figure they touch is
// marked `approximate: true` with the original amount, the rate's date and
// its age carried alongside — see lib/analytics/spendCurrency.js for the
// whole argument, including why the conversion never reaches the database.
// When fx.js refuses (the rate is past its 45-day window, or the pair is not
// one it holds) the rows are excluded as before AND `excluded` names the
// currency, the amount and the reason. Absence is never silent.
//
// The same-currency path is unchanged: a company whose rows all carry null
// gets the numbers it always got, with `approximate: false` beside them.
//
// `asOf` is the clock the rate's age is measured against. Defaulted to now
// for the routes; passed explicitly by scripts/check-spend-currency.mjs so a
// check does not go stale on the calendar.
export async function getMarketingRollup({ companyId, from, to, asOf = new Date() }) {
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
  return rollupSpendRows({ rows: spends, companyCurrency, asOf });
}

/**
 * The pure half of getMarketingRollup — every number on the marketing
 * screens comes out of here, from rows already fetched, so it can be run
 * against fixtures (scripts/check-spend-currency.mjs) without a database.
 */
export function rollupSpendRows({ rows, companyCurrency, asOf }) {
  const pricing = priceSpendRows({ rows, companyCurrency, asOf });

  const byChannel = {};

  for (const { row: entry, amountInCompanyCurrency, converted } of pricing.priced) {
    // Refused by the rate — excluded from every figure below, and reported
    // in `excluded` rather than dropped.
    if (amountInCompanyCurrency === null) continue;
    const key = entry.platform;
    if (!byChannel[key]) {
      byChannel[key] = {
        platform: key,
        spend: 0,
        leads: 0,
        conversions: 0,
        clicks: 0,
        impressions: 0,
        // Per channel, what was converted INTO this spend figure, by original
        // currency — so the by-channel table can say "≈" and "includes
        // US$821.50" on the one row it applies to, not on all of them.
        approximate: false,
        conversions_: {},
      };
    }
    byChannel[key].spend += amountInCompanyCurrency;
    byChannel[key].leads += entry.leads || 0;
    byChannel[key].conversions += entry.conversions || 0;
    byChannel[key].clicks += entry.clicks || 0;
    byChannel[key].impressions += entry.impressions || 0;
    if (converted) {
      byChannel[key].approximate = true;
      const cur = entry.currency;
      const c = byChannel[key].conversions_[cur] || { currency: cur, amount: 0, convertedAmount: 0 };
      c.amount += Number(entry.amount) || 0;
      c.convertedAmount += amountInCompanyCurrency;
      byChannel[key].conversions_[cur] = c;
    }
  }

  const channels = Object.values(byChannel).map(({ conversions_, ...c }) => ({
    ...c,
    spend: round2(c.spend),
    convertedFrom: Object.values(conversions_).map((x) => ({
      currency: x.currency,
      amount: round2(x.amount),
      convertedAmount: round2(x.convertedAmount),
    })),
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
  for (const x of pricing.excluded) {
    mismatchByCurrency[x.currency] = (mismatchByCurrency[x.currency] || 0) + x.amount;
  }

  return {
    companyCurrency,
    channels: channels.sort((a, b) => b.spend - a.spend),
    totals: {
      spend: round2(totalSpend),
      leads: totalLeads,
      // ── The total is approximate the moment one converted row is in it ──
      //
      // `approximate` is what a card prints "≈" off. `convertedFrom` and
      // `currencyConversions` are what its note is built from (named so —
      // `conversions` on a channel is Meta's outcome count): the original amount in
      // the original currency, the rate, its date and its age in days, so the
      // sentence under the figure can be "includes US$821.50 converted at the
      // pinned rate (14 days old)" and a reader can check the arithmetic.
      approximate: pricing.approximate,
      convertedFrom: pricing.convertedFrom,
      currencyConversions: pricing.conversions,
      // Rows fx.js refused to convert — stale rate, unknown pair — with the
      // amount and the reason, so the card can say what is missing from the
      // figure above it rather than print a total that is quietly short.
      excluded: pricing.excluded,
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
    // Kept for the callers that read it, and now ONLY the rows that were
    // refused — a converted row is in the totals, not here.
    excludedCurrencyMismatch: {
      count: pricing.excluded.reduce((n, x) => n + x.count, 0),
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
