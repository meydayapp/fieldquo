// lib/analytics/googleAdsRollup.js
//
// Google Ads spend beside FieldQuo's OWN leads from Google: one row per Google
// campaign — what it cost, what Google says it did, and what FieldQuo can
// prove it became (leads, quotes, won jobs, invoiced, paid) — plus the channel
// totals the Spend page, the KPI page and the monthly summary print: cost per
// lead and cost per won job for Google.
//
// ══ Whose leads ════════════════════════════════════════════════════════════
//
// A lead is Google's when it ARRIVED from a Google ad click: the landing
// carried a gclid / gbraid / wbraid, lib/tracking/attribution.js stored
// `clickNetwork: "google_ads"` on the visit, and the lead copied that into
// LeadRequest.attribution. That is FieldQuo's own record of a person who
// clicked and then asked for work. Google's "Conversions" — its tag firing,
// possibly modelled, possibly fractional — is shown beside it as GOOGLE'S
// number (`googleConversions`) and never divided into spend here. The two
// will disagree, and the screen says why.
//
// ══ Which campaign ═════════════════════════════════════════════════════════
//
// Auto-tagging's gclid alone does not name the campaign. The tracking template
// Settings › Google Ads shows puts `{campaignid}` in utm_campaign, and
// lib/tracking/adParams.js reads an all-digit utm_campaign as the campaign's
// id — the same id Google's API rows carry. A lead is matched by that id, else
// by a utm_campaign NAME against the spend rows' names, else it lands on the
// one row that says so: `campaignKey: NOT_TIED` ("not tied to a campaign"),
// which also holds any Google spend typed in by hand without a campaign. It
// still counts in the channel totals — a Google lead is a Google lead.
//
// ══ Money ══════════════════════════════════════════════════════════════════
//
// Spend rows are every MarketingSpend row on platform "google", whatever their
// source (a report upload, the API sync, or typed in by hand — the importers
// already refuse to double-count a day). Currency is converted at READ time
// through lib/analytics/spendCurrency.js, "≈" when any row was converted, and
// a refused currency drops out of the money with the reason kept — exactly the
// Meta rollup's rule. Leads → quotes → jobs → invoiced / paid is
// lib/analytics/campaignRollup.js's outcomesForLeads, shared, not copied.
//
// Pure: no db, no clock. lib/analytics/googleAdsRollupData.js fetches;
// scripts/check-google-ads.mjs runs this against fixtures.

import { priceSpendRows } from "@/lib/analytics/spendCurrency";
import { buildOutcomeIndex, outcomesForLeads } from "@/lib/analytics/campaignRollup";
import { adIdentityOf } from "@/lib/tracking/attribution";
import { campaignNameKey } from "@/lib/googleAds/reportParse";

export const GOOGLE_CLICK_NETWORK = "google_ads";
export const NOT_TIED = "__not_tied";

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
function sumOrNull(values) {
  let total = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) total = (total || 0) + n;
  }
  return total;
}
function ratio(numerator, denominator, rounder = round2) {
  if (numerator === null || numerator === undefined) return null;
  if (!(denominator > 0)) return null;
  return rounder(numerator / denominator);
}

/** Was this lead's landing a Google ad click? Reads the stored attribution only. */
export function isGoogleAdLead(lead) {
  const a = lead?.attribution;
  return Boolean(a && typeof a === "object" && !Array.isArray(a) && a.clickNetwork === GOOGLE_CLICK_NETWORK);
}

/**
 * The spend rows' campaign identities → the key a row or a lead groups under.
 * A row's own Google id wins; a row known only by name adopts the id another
 * row with the same name carries (a report uploaded without the Campaign ID
 * column, beside the API's rows for the same campaign).
 */
function campaignIndex(rows) {
  const idByName = new Map();
  for (const r of rows) {
    const n = campaignNameKey(r.campaignName);
    if (r.campaignId && n && !idByName.has(n)) idByName.set(n, String(r.campaignId));
  }
  const keyOfRow = (r) => {
    if (r.campaignId) return String(r.campaignId);
    const n = campaignNameKey(r.campaignName);
    if (!n) return NOT_TIED;
    return idByName.get(n) || `name:${n}`;
  };
  return { idByName, keyOfRow };
}

/** A Google lead → the campaign key it belongs to, or NOT_TIED. Pure. */
export function googleCampaignKeyOfLead(lead, { idByName, knownKeys }) {
  const ad = adIdentityOf(lead?.attribution || {});
  if (ad.campaignId) return String(ad.campaignId);
  const n = campaignNameKey(ad.campaignName);
  if (n) {
    if (idByName.has(n)) return idByName.get(n);
    if (knownKeys.has(`name:${n}`)) return `name:${n}`;
    // A name nothing in the spend carries: its own row, so the lead is seen
    // under the name the person's link gave it.
    return `name:${n}`;
  }
  return NOT_TIED;
}

/**
 * @param {object[]} spendRows  MarketingSpend rows on platform "google":
 *                              { campaignId, campaignName, objective, amount,
 *                              currency, date, impressions, clicks,
 *                              conversions, conversionsExact, source }
 * @param {object[]} leads      LeadRequest rows that arrived from a Google ad
 *                              click (the caller filters; non-Google leads are
 *                              ignored here too): { id, attribution, quoteId,
 *                              inferredQuoteId? }
 * @param {object[]} jobs       { id, quoteId, createdAt }
 * @param {object[]} invoices   non-draft invoices billing those jobs/quotes
 * @param {string}   companyCurrency
 * @param {Date|string} asOf    the clock the rate's age is measured against
 */
export function buildGoogleAdsRollup({ spendRows, leads, jobs, invoices, companyCurrency, asOf, rates = undefined }) {
  const rows = (Array.isArray(spendRows) ? spendRows : []).filter(Boolean);
  const pricing = priceSpendRows({ rows, companyCurrency, asOf, rates });
  const excludedByCurrency = new Map(pricing.excluded.map((x) => [x.currency, x]));
  const { idByName, keyOfRow } = campaignIndex(rows);

  const blank = (key) => ({
    campaignKey: key,
    names: [],
    channelTypes: [],
    sources: new Set(),
    spend: 0,
    spendRows: 0,
    approximate: false,
    excluded: null,
    impressions: [],
    clicks: [],
    googleConversions: [],
    dates: [],
    leads: [],
  });
  const groups = new Map();
  const group = (key) => {
    if (!groups.has(key)) groups.set(key, blank(key));
    return groups.get(key);
  };

  for (const { row, amountInCompanyCurrency, converted } of pricing.priced) {
    const g = group(keyOfRow(row));
    const t = row.date ? new Date(row.date).getTime() : 0;
    if (row.campaignName) g.names.push([t, row.campaignName]);
    if (row.objective) g.channelTypes.push([t, row.objective]);
    if (row.source) g.sources.add(row.source);
    if (row.date) g.dates.push(t);
    g.impressions.push(row.impressions);
    g.clicks.push(row.clicks);
    // Google's own count, exact where the importer kept it (Decimal), else the
    // rounded Int. A hand-typed row's "conversions" is whatever was typed.
    g.googleConversions.push(row.conversionsExact ?? row.conversions);
    if (amountInCompanyCurrency === null) {
      g.excluded = excludedByCurrency.get(row.currency) || null;
      continue;
    }
    g.spend += amountInCompanyCurrency;
    g.spendRows += 1;
    if (converted) g.approximate = true;
  }

  const knownKeys = new Set(groups.keys());
  const googleLeads = (Array.isArray(leads) ? leads : []).filter(isGoogleAdLead);
  for (const l of googleLeads) {
    group(googleCampaignKeyOfLead(l, { idByName, knownKeys })).leads.push(l);
  }

  const index = buildOutcomeIndex({ jobs, invoices });
  const newest = (pairs) => (pairs.length ? pairs.slice().sort((a, b) => b[0] - a[0])[0][1] : null);

  const campaigns = [...groups.values()].map((g) => {
    const out = outcomesForLeads(g.leads, index);
    const hasSpend = g.spendRows > 0;
    const spend = hasSpend ? round2(g.spend) : null;
    const impressions = sumOrNull(g.impressions);
    const clicks = sumOrNull(g.clicks);
    const googleConversions = sumOrNull(g.googleConversions);
    const leadCount = g.leads.length;
    const wonJobs = out.jobIds.length;
    return {
      campaignKey: g.campaignKey,
      campaignId: /^\d+$/.test(g.campaignKey) ? g.campaignKey : null,
      campaignName: newest(g.names) || (g.campaignKey.startsWith("name:") ? g.campaignKey.slice(5) : null),
      notTied: g.campaignKey === NOT_TIED,
      channelType: newest(g.channelTypes),
      sources: [...g.sources].sort(),
      days: g.dates.length,
      firstDate: g.dates.length ? new Date(Math.min(...g.dates)).toISOString().slice(0, 10) : null,
      lastDate: g.dates.length ? new Date(Math.max(...g.dates)).toISOString().slice(0, 10) : null,
      spend,
      approximate: g.approximate,
      spendExcluded: g.excluded,
      impressions,
      clicks,
      ctr: ratio(clicks, impressions, round4),
      cpc: hasSpend ? ratio(spend, clicks) : null,
      // GOOGLE's count. Never a denominator here.
      googleConversions: googleConversions === null ? null : round2(googleConversions),
      leads: leadCount,
      costPerLead: hasSpend && leadCount > 0 ? round2(spend / leadCount) : null,
      quotes: out.quoteIds.length,
      inferredQuotes: out.inferredQuotes,
      wonJobs,
      costPerWonJob: hasSpend && wonJobs > 0 ? round2(spend / wonJobs) : null,
      revenue: out.revenue === null ? null : round2(out.revenue),
      paid: out.paid === null ? null : round2(out.paid),
    };
  });

  // Most money first; the not-tied row last whatever it holds, so a contractor
  // reads campaigns, then "and these we couldn't tie to one".
  campaigns.sort((a, b) => Number(a.notTied) - Number(b.notTied) || (b.spend || 0) - (a.spend || 0) || b.leads - a.leads);

  const allOutcomes = outcomesForLeads(googleLeads, index);
  const spendTotal = round2(campaigns.reduce((s, c) => s + (c.spend || 0), 0));
  const anySpend = campaigns.some((c) => c.spend !== null);
  const leadsTotal = googleLeads.length;
  const wonTotal = allOutcomes.jobIds.length;
  const conv = sumOrNull(campaigns.map((c) => c.googleConversions));

  return {
    companyCurrency,
    campaigns,
    totals: {
      spend: anySpend ? spendTotal : null,
      approximate: pricing.approximate,
      convertedFrom: pricing.convertedFrom,
      currencyConversions: pricing.conversions,
      excluded: pricing.excluded,
      impressions: sumOrNull(campaigns.map((c) => c.impressions)),
      clicks: sumOrNull(campaigns.map((c) => c.clicks)),
      googleConversions: conv === null ? null : round2(conv),
      leads: leadsTotal,
      leadsNotTied: campaigns.filter((c) => c.notTied).reduce((s, c) => s + c.leads, 0),
      quotes: allOutcomes.quoteIds.length,
      inferredQuotes: allOutcomes.inferredQuotes,
      wonJobs: wonTotal,
      costPerLead: anySpend && leadsTotal > 0 ? round2(spendTotal / leadsTotal) : null,
      costPerWonJob: anySpend && wonTotal > 0 ? round2(spendTotal / wonTotal) : null,
      revenue: allOutcomes.revenue === null ? null : round2(allOutcomes.revenue),
      paid: allOutcomes.paid === null ? null : round2(allOutcomes.paid),
    },
  };
}
