// lib/analytics/campaignRollup.js
//
// One row per Meta campaign: what it cost, what Meta says it did, and what
// FieldQuo can prove it became — leads, quotes, jobs, invoiced revenue.
//
// ══ What a contractor actually asks ════════════════════════════════════════
//
// Not "what is my CTR". "Which of these three ads is bringing in work, and
// what does a lead from each one cost me?" The owner connected a live ad
// account, saw three campaigns' spend on the Spend page, and asked for the
// rest. This is the rest, and it is the first place in the product where a
// dollar of spend is joined to a specific lead — which lib/analytics/kpis.js's
// NOT_TRACKED entry and the feature matrix both said, truthfully until now,
// nothing did.
//
// ══ Where the join is honest, and where it stops ═══════════════════════════
//
// MarketingSpend rows synced from Meta carry `campaignId`; LeadRequest rows
// imported from a Meta lead form carry `metaCampaignId` (lib/meta/leadsImport.js
// resolves it from the ad id with the ads_read token). Same id, same source
// of truth, so "leads for this campaign" is a count and not a guess.
//
// It counts ONLY those leads. A homeowner who saw the ad, remembered the
// name and phoned the office is a real lead this campaign produced and this
// file cannot see it — nothing ties a phone call to an ad. So the
// cost-per-lead here is an UPPER BOUND on what a lead-form lead costs, and
// the screen says so beside the figure rather than in a footnote. It is
// also why the blended cost per lead on the same page still exists: that
// one is the whole picture, this one is the part that can be attributed.
//
// From a lead onward the chain is FieldQuo's own: LeadRequest.quoteId is the
// quote the lead became (unique — one lead, at most one quote), Job.quoteId
// is the job the quote became, and an Invoice bills a job by Invoice.jobId
// or, failing that, by the quote — the same two-step resolution
// lib/invoices/jobLink.js owns and app/api/analytics/kpis/route.js mirrors
// without an N+1. Revenue is the latest version of every invoice family
// (lib/export/accountingExport.js's invoiceFamilies), draft and cancelled
// already excluded by the caller's query, summed per job.
//
// ══ Every rate is computed here, from stored counts ════════════════════════
//
// Meta would happily send `cost_per_action_type`, `ctr` and `cpc` itself,
// and lib/meta/client.js deliberately does not ask. A rate stored beside its
// own inputs drifts from them the first time a row is re-synced with one
// field changed; a rate computed from the inputs at read time cannot. The
// schema's comment on these columns says the same thing. A rate whose
// numerator is null — Meta did not report the metric — is null, and the
// screen prints "—", never 0.
//
// Pure: no db, no clock. The route fetches, this file counts, and
// scripts/check-campaign-rollup.mjs runs it against fixtures.

import { priceSpendRows } from "@/lib/analytics/spendCurrency";
import { invoiceFamilies } from "@/lib/export/accountingExport";

/**
 * Meta's objective values → a short label key the screen translates
 * (`app.marketingSpend.objective.<key>`), with the raw value as the fallback
 * when Meta ships one that is not here. Both the ODAX `OUTCOME_*` set and
 * the older objectives still on running campaigns; the map is a display
 * courtesy, never a filter, so an unknown value still gets its row.
 */
export const OBJECTIVE_LABEL_KEYS = Object.freeze({
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  OUTCOME_ENGAGEMENT: "engagement",
  POST_ENGAGEMENT: "engagement",
  MESSAGES: "messages",
  OUTCOME_TRAFFIC: "traffic",
  LINK_CLICKS: "traffic",
  OUTCOME_SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "sales",
  OUTCOME_AWARENESS: "awareness",
  BRAND_AWARENESS: "awareness",
  REACH: "awareness",
  OUTCOME_APP_PROMOTION: "appPromotion",
  APP_INSTALLS: "appPromotion",
  MOBILE_APP_INSTALLS: "appPromotion",
  VIDEO_VIEWS: "videoViews",
  PAGE_LIKES: "pageLikes",
  EVENT_RESPONSES: "eventResponses",
});

export function objectiveLabelKey(objective) {
  if (!objective) return null;
  return OBJECTIVE_LABEL_KEYS[String(objective)] || null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/** Sum of the non-null values, or null when every value was null. */
function sumOrNull(values) {
  let total = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    total = (total || 0) + n;
  }
  return total;
}

/** numerator / denominator, or null when either side cannot support it. */
function ratio(numerator, denominator, rounder = round2) {
  if (numerator === null || numerator === undefined) return null;
  if (!(denominator > 0)) return null;
  return rounder(numerator / denominator);
}

/**
 * @param {object[]} spendRows   MarketingSpend rows with a non-null
 *                               campaignId (the route filters source
 *                               "meta_api"); Decimal amounts are fine
 * @param {object[]} leads       LeadRequest rows with a non-null
 *                               metaCampaignId: { id, metaCampaignId,
 *                               metaCampaignName, quoteId }
 * @param {object[]} jobs        Job rows for those leads' quotes:
 *                               { id, quoteId }
 * @param {object[]} invoices    non-draft, non-cancelled Invoice rows that
 *                               bill those jobs or those quotes: { id,
 *                               parentInvoiceId, version, total, jobId,
 *                               quoteId }
 * @param {string}   companyCurrency
 * @param {Date|string} asOf     the clock the pinned rate's age is measured
 *                               against — required, see spendCurrency.js
 */
export function buildCampaignRollup({ spendRows, leads, jobs, invoices, companyCurrency, asOf }) {
  const rows = (Array.isArray(spendRows) ? spendRows : []).filter((r) => r && r.campaignId);
  const pricing = priceSpendRows({ rows, companyCurrency, asOf });
  const excludedByCurrency = new Map(pricing.excluded.map((x) => [x.currency, x]));

  // ── Money and Meta's counts, per campaign ────────────────────────────────
  const byCampaign = new Map();
  for (const { row, amountInCompanyCurrency, converted } of pricing.priced) {
    const id = String(row.campaignId);
    if (!byCampaign.has(id)) {
      byCampaign.set(id, {
        campaignId: id,
        names: [], // [date, name] pairs — the newest non-null name wins
        objectives: [],
        spend: 0,
        spendRows: 0,
        approximate: false,
        conversions_: {},
        excluded: null,
        impressions: [],
        reach: [],
        clicks: [],
        linkClicks: [],
        metaLeadActions: [],
        messagingConversations: [],
        videoViews: [],
        postEngagements: [],
        dates: [],
      });
    }
    const c = byCampaign.get(id);
    if (row.campaignName) c.names.push([row.date ? new Date(row.date).getTime() : 0, row.campaignName]);
    if (row.objective) c.objectives.push([row.date ? new Date(row.date).getTime() : 0, row.objective]);
    if (row.date) c.dates.push(new Date(row.date).getTime());
    c.impressions.push(row.impressions);
    c.reach.push(row.reach);
    c.clicks.push(row.clicks);
    c.linkClicks.push(row.linkClicks);
    c.metaLeadActions.push(row.conversions);
    c.messagingConversations.push(row.messagingConversations);
    c.videoViews.push(row.videoViews);
    c.postEngagements.push(row.postEngagements);

    if (amountInCompanyCurrency === null) {
      // The pinned rate refused this row's currency. The campaign keeps its
      // counts, loses its money, and says why — a campaign missing from the
      // list because its currency went stale is the $0.00 card again.
      c.excluded = excludedByCurrency.get(row.currency) || null;
      continue;
    }
    c.spend += amountInCompanyCurrency;
    c.spendRows += 1;
    if (converted) {
      c.approximate = true;
      const cur = row.currency;
      const rec = c.conversions_[cur] || { currency: cur, amount: 0, convertedAmount: 0 };
      rec.amount += Number(row.amount) || 0;
      rec.convertedAmount += amountInCompanyCurrency;
      c.conversions_[cur] = rec;
    }
  }

  // ── Leads → quotes → jobs → invoiced revenue ─────────────────────────────
  const leadRows = (Array.isArray(leads) ? leads : []).filter((l) => l && l.metaCampaignId);
  const leadsByCampaign = new Map();
  for (const l of leadRows) {
    const id = String(l.metaCampaignId);
    if (!leadsByCampaign.has(id)) leadsByCampaign.set(id, []);
    leadsByCampaign.get(id).push(l);
  }

  const jobRows = Array.isArray(jobs) ? jobs.filter((j) => j && j.id) : [];
  const jobsByQuote = new Map();
  const quoteIdToJobId = new Map();
  for (const j of jobRows) {
    if (!j.quoteId) continue;
    if (!jobsByQuote.has(j.quoteId)) jobsByQuote.set(j.quoteId, []);
    jobsByQuote.get(j.quoteId).push(j);
    // The OLDEST job on a quote is the one acceptance created — the same
    // choice lib/invoices/jobLink.js makes (orderBy createdAt asc).
    if (!quoteIdToJobId.has(j.quoteId)) quoteIdToJobId.set(j.quoteId, j.id);
  }

  const revenueByJob = new Map();
  for (const family of invoiceFamilies(Array.isArray(invoices) ? invoices : [])) {
    const latest = family.latest;
    const jobId = latest.jobId || quoteIdToJobId.get(latest.quoteId) || null;
    if (!jobId) continue;
    revenueByJob.set(jobId, (revenueByJob.get(jobId) || 0) + (Number(latest.total) || 0));
  }

  // A campaign can have leads and no spend rows in the period (the ad ran
  // last month; the form submission arrived this week). It gets a row with
  // null money rather than vanishing, because the lead is real.
  for (const id of leadsByCampaign.keys()) {
    if (!byCampaign.has(id)) {
      const sample = leadsByCampaign.get(id)[0];
      byCampaign.set(id, {
        campaignId: id,
        names: sample.metaCampaignName ? [[0, sample.metaCampaignName]] : [],
        objectives: [],
        spend: 0,
        spendRows: 0,
        approximate: false,
        conversions_: {},
        excluded: null,
        impressions: [],
        reach: [],
        clicks: [],
        linkClicks: [],
        metaLeadActions: [],
        messagingConversations: [],
        videoViews: [],
        postEngagements: [],
        dates: [],
      });
    }
  }

  const campaigns = [...byCampaign.values()].map((c) => {
    const newest = (pairs) => (pairs.length ? pairs.slice().sort((a, b) => b[0] - a[0])[0][1] : null);
    const campaignLeads = leadsByCampaign.get(c.campaignId) || [];
    const quoteIds = [...new Set(campaignLeads.map((l) => l.quoteId).filter(Boolean))];
    const jobIds = [...new Set(quoteIds.flatMap((q) => (jobsByQuote.get(q) || []).map((j) => j.id)))];
    let revenue = null;
    for (const jobId of jobIds) {
      if (revenueByJob.has(jobId)) revenue = (revenue || 0) + revenueByJob.get(jobId);
    }

    const hasSpend = c.spendRows > 0;
    const spend = hasSpend ? round2(c.spend) : null;
    const impressions = sumOrNull(c.impressions);
    const reach = sumOrNull(c.reach);
    const clicks = sumOrNull(c.clicks);
    const linkClicks = sumOrNull(c.linkClicks);
    const metaLeadActions = sumOrNull(c.metaLeadActions);
    const messagingConversations = sumOrNull(c.messagingConversations);
    const videoViews = sumOrNull(c.videoViews);
    const postEngagements = sumOrNull(c.postEngagements);
    const objective = newest(c.objectives);
    const leadCount = campaignLeads.length;

    return {
      campaignId: c.campaignId,
      campaignName: newest(c.names),
      objective,
      objectiveLabelKey: objectiveLabelKey(objective),
      days: c.dates.length,
      firstDate: c.dates.length ? new Date(Math.min(...c.dates)).toISOString().slice(0, 10) : null,
      lastDate: c.dates.length ? new Date(Math.max(...c.dates)).toISOString().slice(0, 10) : null,
      spend,
      approximate: c.approximate,
      convertedFrom: Object.values(c.conversions_).map((x) => ({
        currency: x.currency,
        amount: round2(x.amount),
        convertedAmount: round2(x.convertedAmount),
      })),
      // Set when the rate refused this campaign's currency: spend is null
      // and this says what is missing and why (reasonCode, amount).
      spendExcluded: c.excluded,
      impressions,
      // Reach is a count of Meta Accounts and does not sum across days —
      // the same person reached on Monday and Tuesday is one person, two
      // daily rows. Meta reports it per row because the sync asks for daily
      // rows (time_increment=1). Summed anyway rather than dropped, and
      // FLAGGED, so the screen labels it "daily reach, summed" and never
      // "people reached". The exact figure needs a second insights call per
      // campaign without time_increment, which is a sync change with its
      // own row shape and not this one.
      reach,
      reachIsDailySum: reach !== null,
      clicks,
      linkClicks,
      ctr: ratio(clicks, impressions, round4),
      cpc: hasSpend ? ratio(spend, clicks) : null,
      linkCtr: ratio(linkClicks, impressions, round4),
      costPerLinkClick: hasSpend ? ratio(spend, linkClicks) : null,
      messagingConversations,
      costPerConversation: hasSpend ? ratio(spend, messagingConversations) : null,
      videoViews,
      postEngagements,
      // Meta's own lead-shaped action count — what the ad platform says
      // happened. Kept apart from `leads`, which is what FieldQuo RECEIVED.
      metaLeadActions,
      leads: leadCount,
      // Spend over lead-form leads FieldQuo received for this campaign. An
      // upper bound on the true cost per lead — see the file header.
      costPerLead: hasSpend && leadCount > 0 ? round2(spend / leadCount) : null,
      quotes: quoteIds.length,
      jobs: jobIds.length,
      // null when no invoice was ever raised for a job from this campaign;
      // a real 0 cannot happen (a family with a 0 total is still a number,
      // and is summed as one), so null means "nothing invoiced yet".
      revenue: revenue === null ? null : round2(revenue),
    };
  });

  // Most money first; campaigns with no spend in the period (leads only, or
  // refused currency) sort after every priced one, newest lead first is
  // not knowable here so they keep input order.
  campaigns.sort((a, b) => (b.spend || 0) - (a.spend || 0));

  return {
    companyCurrency,
    campaigns,
    totals: {
      spend: round2(campaigns.reduce((s, c) => s + (c.spend || 0), 0)),
      approximate: pricing.approximate,
      convertedFrom: pricing.convertedFrom,
      currencyConversions: pricing.conversions,
      excluded: pricing.excluded,
      leads: campaigns.reduce((s, c) => s + c.leads, 0),
      quotes: campaigns.reduce((s, c) => s + c.quotes, 0),
      jobs: campaigns.reduce((s, c) => s + c.jobs, 0),
      revenue: campaigns.some((c) => c.revenue !== null)
        ? round2(campaigns.reduce((s, c) => s + (c.revenue || 0), 0))
        : null,
    },
  };
}
