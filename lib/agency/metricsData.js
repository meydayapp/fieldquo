// lib/agency/metricsData.js
//
// The database half of lib/agency/metrics.js — the ONE loader behind the
// agency API's /metrics and /funnel AND FieldQuo's own Marketing results page
// (app/api/marketing/results). The owner checks the agency's numbers against
// this; a second loader would be the copy that drifts (AGENTS.md failure
// class 4).
//
// It reuses, never re-derives:
//   * the lead chain           lib/agency/leadFacts.js
//   * Meta's conversations     lib/analytics/adFunnelData.js loadAdFunnel —
//                              "messages from ads" is the Spend page's count
//   * spend in one currency    lib/analytics/spendCurrency.js priceSpendRows
//   * the exchange rate        lib/marketing/fxLive.js loadLiveRates

import { loadLeadFacts } from "@/lib/agency/leadFacts";
import { computeMetrics, compareMetrics, buildFunnel, splitByChannel, splitByCampaign } from "@/lib/agency/metrics";
import { SOURCE_FILTERS, META_CHANNELS, GOOGLE_CHANNELS, campaignKeyOf } from "@/lib/agency/channels";
import { previousPeriod } from "@/lib/agency/periods";
import { loadAdFunnel } from "@/lib/analytics/adFunnelData";
import { priceSpendRows } from "@/lib/analytics/spendCurrency";
import { loadLiveRates } from "@/lib/marketing/fxLive";

const AD_PLATFORMS = ["facebook", "google"];
const PLATFORM_OF = { facebook: "meta", google: "google" };
/** An agency channel → lib/analytics/adFunnel.js's row for it. */
const FUNNEL_ROW = { facebook_ad: "facebook_ads", instagram_ad: "instagram_ads", whatsapp_ad: "whatsapp_ads" };

/**
 * A `source` / `campaign` filter as the API takes it, validated.
 * @returns {{ ok: true, channels: string[]|null, campaign: string|null } | { ok: false, error }}
 */
export function parseFilters({ source = null, campaign = null } = {}) {
  let channels = null;
  if (source) {
    if (!Object.prototype.hasOwnProperty.call(SOURCE_FILTERS, source)) {
      return { ok: false, error: `Unknown source "${source}". Use one of: ${Object.keys(SOURCE_FILTERS).join(", ")}.` };
    }
    channels = SOURCE_FILTERS[source];
  }
  const c = typeof campaign === "string" ? campaign.trim().slice(0, 200) : "";
  return { ok: true, source: source || null, channels, campaign: c || null };
}

/** Does a fact's campaign match the filter (an id, or a name, case-folded)? */
function matchesCampaign(attr, campaign) {
  if (!campaign) return true;
  const want = campaign.toLowerCase();
  return [attr?.campaignId, attr?.campaignName, attr?.utmCampaign].some((v) => v && String(v).toLowerCase() === want);
}

function spendRowMatches(row, { channels, campaign }) {
  if (channels) {
    const platform = PLATFORM_OF[row.platform];
    const meta = channels.some((c) => META_CHANNELS.includes(c));
    const google = channels.some((c) => GOOGLE_CHANNELS.includes(c));
    if (!((platform === "meta" && meta) || (platform === "google" && google))) return false;
  }
  if (campaign) {
    const want = campaign.toLowerCase();
    if (![row.campaignId, row.campaignName].some((v) => v && String(v).toLowerCase() === want)) return false;
  }
  return true;
}

/**
 * Spend for a range, filtered, priced into the company's currency.
 * @returns {{ amount: number|null, connected, approximate, byCampaign: Map }}
 */
function priceSpend({ rows, range, filters, companyCurrency, asOf, rates, connected }) {
  const inRange = rows.filter((r) => {
    const d = new Date(r.date).getTime();
    return d >= range.from.getTime() && d <= range.to.getTime() && spendRowMatches(r, filters);
  });
  // A filter that selects no paid channel has no spend to speak of: null, so
  // cost per lead for "organic" is never computed against Meta's money.
  const noPaidChannel = filters.channels && !filters.channels.some((c) => META_CHANNELS.includes(c) || GOOGLE_CHANNELS.includes(c));
  if (noPaidChannel) return { amount: null, connected, approximate: false, byCampaign: new Map(), notApplicable: true };
  const priced = priceSpendRows({ rows: inRange, companyCurrency, asOf, rates });
  let amount = 0;
  const byCampaign = new Map();
  for (const p of priced.priced) {
    if (p.amountInCompanyCurrency === null) continue;
    amount += p.amountInCompanyCurrency;
    const key = campaignKeyOf({ campaignId: p.row.campaignId, campaignName: p.row.campaignName });
    if (key) {
      const prev = byCampaign.get(key) || { campaignId: p.row.campaignId || null, name: p.row.campaignName || null, platform: PLATFORM_OF[p.row.platform] || null, amount: 0 };
      prev.amount += p.amountInCompanyCurrency;
      if (!prev.name && p.row.campaignName) prev.name = p.row.campaignName;
      byCampaign.set(key, prev);
    }
  }
  // Nothing connected and nothing entered: "not connected", never $0.
  const any = inRange.length > 0 || connected;
  return { amount: any ? Math.round(amount * 100) / 100 : null, connected, approximate: priced.approximate, excluded: priced.excluded, byCampaign };
}

/** Meta's conversations for a range, as the Spend page counts them — or null when the filter cannot use them. */
async function adMessagesFor({ db, companyId, range, filters, asOf, rates, deps }) {
  if (filters.campaign) return null; // a conversation carries its ad, not its campaign, until it becomes a lead
  if (filters.channels && !filters.channels.some((c) => META_CHANNELS.includes(c))) return null;
  const load = deps.loadAdFunnel || loadAdFunnel;
  const funnel = await load({ db, companyId, range: { gte: range.from, lte: range.to }, asOf, rates }).catch(() => null);
  if (!funnel) return null;
  if (!filters.channels) return { threads: funnel.allAds?.threads ?? 0, realConversations: funnel.allAds?.realConversations ?? 0 };
  const rows = new Map((funnel.sources || []).map((r) => [r.source, r]));
  const picked = filters.channels.filter((c) => META_CHANNELS.includes(c)).map((c) => rows.get(FUNNEL_ROW[c])).filter(Boolean);
  return {
    threads: picked.reduce((a, r) => a + (r.threads || 0), 0),
    realConversations: picked.reduce((a, r) => a + (r.realConversations || 0), 0),
  };
}

/**
 * Everything the metrics endpoint, the funnel endpoint and the internal page
 * show, for one period and the previous equal one.
 *
 * @param p.range         lib/agency/periods.js resolvePeriod() result
 * @param p.filters       parseFilters() result
 * @param p.includeMoney  false when the company does not share job values
 *                        with its agency (the internal page always passes true)
 */
export async function loadMarketingResults({ db, companyId, range, filters = { channels: null, campaign: null }, includeMoney = true, compareWith = "previous", now = new Date(), deps = {} }) {
  const prev = compareWith === "previous" ? previousPeriod(range) : null;
  const span = { gte: prev ? prev.from : range.from, lte: range.to };
  const live = deps.rates ? { rates: deps.rates } : await loadLiveRates({ prisma: db, asOf: now });

  const [{ facts, truncated, currency }, spendRows, metaConn, googleConn] = await Promise.all([
    loadLeadFacts({ db, companyId, where: { createdAt: span }, now }),
    db.marketingSpend.findMany({
      where: { companyId, platform: { in: AD_PLATFORMS }, date: span },
      select: { amount: true, currency: true, date: true, platform: true, campaignId: true, campaignName: true, source: true },
    }),
    db.metaAdConnection.findUnique({ where: { companyId }, select: { id: true } }).catch(() => null),
    db.googleAdsConnection.findUnique({ where: { companyId }, select: { id: true } }).catch(() => null),
  ]);
  const companyCurrency = currency || "CAD";
  const connected = Boolean(metaConn || googleConn);

  const inRange = (f, r) => f.createdAt.getTime() >= r.from.getTime() && f.createdAt.getTime() <= r.to.getTime();
  const selected = (f) => (!filters.channels || filters.channels.includes(f.channel)) && matchesCampaign(f.attribution, filters.campaign);
  const curFacts = facts.filter((f) => inRange(f, range) && selected(f));
  const prevFacts = prev ? facts.filter((f) => inRange(f, prev) && selected(f)) : [];

  const curSpend = priceSpend({ rows: spendRows, range, filters, companyCurrency, asOf: now, rates: live.rates, connected });
  const prevSpend = prev ? priceSpend({ rows: spendRows, range: prev, filters, companyCurrency, asOf: now, rates: live.rates, connected }) : null;
  const [curMessages, prevMessages] = await Promise.all([
    adMessagesFor({ db, companyId, range, filters, asOf: now, rates: live.rates, deps }),
    prev ? adMessagesFor({ db, companyId, range: prev, filters, asOf: now, rates: live.rates, deps }) : null,
  ]);

  const current = computeMetrics({ facts: curFacts, spend: curSpend, adMessages: curMessages, includeMoney, now });
  const previous = prev ? computeMetrics({ facts: prevFacts, spend: prevSpend, adMessages: prevMessages, includeMoney, now }) : null;

  return {
    period: { key: range.key, from: range.fromDay, to: range.toDay, days: range.days },
    previousPeriod: prev ? { from: prev.fromDay, to: prev.toDay, days: prev.days } : null,
    filters: { source: filters.source || null, channels: filters.channels, campaign: filters.campaign },
    currency: includeMoney ? companyCurrency : null,
    spend: {
      connected,
      approximate: curSpend.approximate || false,
      notApplicable: Boolean(curSpend.notApplicable),
    },
    metrics: compareMetrics(current, previous),
    counts: current.counts,
    funnel: buildFunnel({ facts: curFacts, adMessages: curMessages }),
    bySource: splitByChannel(curFacts).map((r) => (includeMoney ? r : { ...r, revenue: null })),
    byCampaign: splitByCampaign(curFacts, curSpend.byCampaign, { includeMoney }),
    truncated,
  };
}
