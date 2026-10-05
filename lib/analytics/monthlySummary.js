// lib/analytics/monthlySummary.js
//
// One company's month, as the monthly summary email reads it: tiles, a
// pipeline, where the leads came from, who owes money, and the handful of
// things worth doing about it.
//
// ══ Why a new file, and why it computes almost nothing ═════════════════════
//
// The digest used to be one paragraph a model wrote around a JSON blob, and
// the blob was wrong: it came from getAnalyticsOverview() called with no date
// at 08:00 on the 1st, so "Your September summary" described the first eight
// hours of October ("Revenue and expenses were both 0… created 0 quotes")
// beside a lead count that WAS September's. A summary is only as good as the
// definitions under it, so this file defines nothing it can borrow:
//
//   invoiced        invoice FAMILIES at their latest version, dated by
//                   lib/invoices/issueDate.js — the rule statements and the
//                   receivables panel use (drafts and cancelled excluded)
//   collected       Payment rows by the month the money landed —
//                   lib/analytics/receivables.js buildRevenueTrend, the
//                   dashboard's "Payments received" series, unchanged
//   quotes          lib/analytics/overview.js's sent / accepted / rate, for
//                   the month the caller asked about
//   cost per lead   lib/analytics/kpis.js buildBlendedCostPerLead over real
//                   LeadRequest rows; spend from lib/analytics/marketingRollup.js
//   campaigns       lib/analytics/campaignRollup.js, untouched
//   social          lib/attribution/monthlyConversations.js, untouched
//   money owed      lib/analytics/receivables.js buildReceivables, as of the
//                   day the email is built
//
// What IS computed here is arithmetic on those outputs — a month's slice, a
// comparison through lib/analytics/trend.js's compare(), a count of leads with
// no quote — and every one of those is executed by
// scripts/check-monthly-summary.mjs against fixtures.
//
// ══ Absence is not zero (AGENTS.md failure class 5) ════════════════════════
//
// Every figure is a `metric`: { available, value, reason, prior, change }.
// `available: false` carries a REASON the email turns into a sentence ("No
// payments recorded yet"), never a 0. The distinctions it keeps:
//
//   • a company that has never sent an invoice has no invoiced figure; one
//     that has, and sent none this month, invoiced 0 — a real zero
//   • no MarketingSpend row at all is "No ad spend recorded", not $0.00 — and
//     then cost per lead does not exist either (buildBlendedCostPerLead would
//     happily divide 0 by nine leads and call the leads free)
//   • a prior month only exists when the company traded for ALL of it —
//     overview.js's own rule — so a company's first month shows no ▲/▼
//   • a prior of 0 has no percentage (compare() returns deltaPct null); the
//     tile says "up from none" instead of inventing 100% or ∞
//
// ══ Insights are facts with placeholders, not sentences ════════════════════
//
// `insights` is a ranked list of { key, values } — "4 overdue invoices worth
// $X, oldest 41 days" as data. The email turns each into a sentence from the
// catalogue (app.monthlySummary.insight.<key>), and the AI step in
// lib/ai/monthlyDigest.js may REWORD them, but only through the same
// placeholders, so every number in the email is formatted here and in
// lib/email/monthlySummaryEmail.js and none is typed by a model.
//
// Pure: no database, no clock of its own — `asOf` is passed in.

import { invoiceFamilies, dayKey } from "@/lib/export/accountingExport";
import { invoiceIssueDate } from "@/lib/invoices/issueDate";
import { buildReceivables, buildRevenueTrend } from "@/lib/analytics/receivables";
import { buildBlendedCostPerLead, RATE_FLOOR } from "@/lib/analytics/kpis";
import { compare } from "@/lib/analytics/trend";

/** A lead older than this with no quote is "waiting". */
export const LEAD_WAIT_DAYS = 3;
/** A sent quote with no answer after this long is worth a follow-up. */
export const QUOTE_WAIT_DAYS = 7;
/** How many lead sources get their own row before the rest become "Other". */
export const SOURCE_ROWS = 5;
/** How many campaigns are listed. */
export const CAMPAIGN_ROWS = 3;
/** How many insights the email prints. */
export const INSIGHT_COUNT = 3;

const DAY = 86400000;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;
const monthKeyOf = (value) => {
  const k = dayKey(value);
  return k ? k.slice(0, 7) : null;
};

/**
 * A figure with its comparison, or the reason there is no figure.
 *
 * `prior` null means "no comparable month" and produces no change at all. A
 * change is { direction, pct } with pct null when the prior was 0.
 */
export function metric(value, { prior = null, reason = null, approximate = false, partial = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return { available: false, value: null, reason: reason || "unavailable", prior: null, change: null, approximate: false, partial: false };
  }
  const v = Number(value);
  const p = prior === null || prior === undefined || !Number.isFinite(Number(prior)) ? null : Number(prior);
  const t = p === null ? null : compare(v, p);
  return {
    available: true,
    value: v,
    reason: null,
    prior: p,
    change: t
      ? {
          direction: t.direction,
          // Whole percent, absolute — the arrow carries the sign.
          pct: t.deltaPct === null ? null : Math.round(Math.abs(t.deltaPct) * 100),
          fromNone: t.prior === 0 && t.direction === "up",
        }
      : null,
    approximate: Boolean(approximate),
    partial: Boolean(partial),
  };
}

const unavailable = (reason) => metric(null, { reason });

/** Sum of invoice families issued in a month, or null when nothing was ever issued. */
function invoicedIn(families, monthKey) {
  let total = 0;
  let count = 0;
  for (const f of families) {
    const source = f.root || f.members[0];
    const key = monthKeyOf(invoiceIssueDate(source).date);
    if (key !== monthKey) continue;
    total += num(f.latest?.total);
    count += 1;
  }
  return { total: round2(total), count };
}

/** Has the rollup any spend rows at all — converted, native or refused? */
function hasSpend(rollup) {
  if (!rollup) return false;
  return (rollup.channels?.length || 0) > 0 || (rollup.totals?.excluded?.length || 0) > 0;
}

/**
 * @param {object} p
 * @param {{start: Date, end: Date, key: string}} p.period   UTC month, end exclusive
 * @param {{start: Date, end: Date, key: string}} p.prior    the month before
 * @param {Date}    p.asOf               when the email is built — ages and money owed
 * @param {boolean} p.hadFullPriorMonth  overview.js's rule: the company existed all of last month
 * @param {object[]} p.invoices          every Invoice row, every version
 * @param {object[]} p.payments          every Payment row { invoiceId, amount, date }
 * @param {object}  p.overview           getAnalyticsOverview({ now: inside the period })
 * @param {object[]} p.leads             this month's LeadRequests { id, source, status, quoteId, createdAt, quoteStatus }
 * @param {object|null} p.priorLeadCountsBySource  last month's { source: count }, or null
 * @param {object[]} p.jobsCompleted     this month's completed Jobs { id, quoteId, completedAt }
 * @param {number|null} p.priorJobsCompleted
 * @param {object}  p.marketing          getMarketingRollup for the month
 * @param {object|null} p.priorMarketing getMarketingRollup for the month before
 * @param {object|null} p.campaigns      loadCampaignRollup for the month, or null if it failed
 * @param {object|null} p.googleAds      loadGoogleAdsRollup for the month, or null if it failed
 * @param {object|null} p.conversations  monthlyConversations rollup, or null if it failed
 * @param {object[]} p.waitingQuotes     sent, unanswered quotes { id, total, sentAt }
 */
export function buildMonthlySummary({
  period,
  prior,
  asOf,
  hadFullPriorMonth = false,
  invoices = [],
  payments = [],
  overview = null,
  leads = [],
  priorLeadCountsBySource = null,
  jobsCompleted = [],
  priorJobsCompleted = null,
  marketing = null,
  priorMarketing = null,
  campaigns = null,
  googleAds = null,
  conversations = null,
  waitingQuotes = [],
} = {}) {
  if (!period?.key || !prior?.key) throw new Error("buildMonthlySummary: period and prior months are required");
  if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) throw new Error("buildMonthlySummary: asOf is required");
  const asOfMs = asOf.getTime();

  // ── Revenue: invoiced and collected ──────────────────────────────────────
  const families = invoiceFamilies(invoices || []).filter(
    (f) => f.latest && f.latest.status !== "draft" && f.latest.status !== "cancelled",
  );
  let invoiced;
  if (!families.length) {
    invoiced = unavailable("no_invoices_yet");
  } else {
    const cur = invoicedIn(families, period.key);
    const pri = hadFullPriorMonth ? invoicedIn(families, prior.key) : null;
    invoiced = { ...metric(cur.total, { prior: pri ? pri.total : null }), count: cur.count };
  }

  // asOf for the trend is the END of the period, so the period is the newest
  // COMPLETE month in the series — buildRevenueTrend's own "partial" rule
  // would otherwise flag it.
  const trend = buildRevenueTrend({
    payments: payments || [],
    months: 3,
    everRecorded: (payments || []).length > 0,
    asOf: period.end,
  });
  let collected;
  if (!trend.available) {
    collected = unavailable("no_payments_yet");
  } else {
    const cur = trend.series.find((s) => s.month === period.key);
    const pri = trend.series.find((s) => s.month === prior.key);
    collected = {
      ...metric(cur ? cur.amount : 0, { prior: hadFullPriorMonth && pri ? pri.amount : null }),
      count: cur ? cur.count : 0,
    };
  }

  // ── Leads ────────────────────────────────────────────────────────────────
  const leadRows = (leads || []).filter(Boolean);
  const leadCountsBySource = {};
  for (const l of leadRows) {
    const s = l.source || "unknown";
    leadCountsBySource[s] = (leadCountsBySource[s] || 0) + 1;
  }
  const priorLeadCount =
    hadFullPriorMonth && priorLeadCountsBySource
      ? Object.values(priorLeadCountsBySource).reduce((s, n) => s + num(n), 0)
      : null;
  const leadsMetric = metric(leadRows.length, { prior: priorLeadCount });

  // ── Quotes — overview.js's definitions, for this month ──────────────────
  let quotesSent;
  let quotesAccepted;
  let acceptance;
  if (!overview) {
    quotesSent = unavailable("not_loaded");
    quotesAccepted = unavailable("not_loaded");
    acceptance = unavailable("not_loaded");
  } else {
    quotesSent = metric(overview.quotesSent, { prior: overview.priorQuotesSent ?? null });
    quotesAccepted = metric(overview.quotesAccepted);
    // The rate's comparison only when BOTH months clear the rate floor
    // lib/analytics/kpis.js argues for — below ten, one quote moves it ten
    // points, and a ▼ off that is noise wearing an arrow.
    const rateComparable =
      overview.priorConversionRate != null &&
      num(overview.priorQuotesSent) >= RATE_FLOOR &&
      num(overview.quotesSent) >= RATE_FLOOR;
    acceptance =
      overview.conversionRate === null || overview.conversionRate === undefined
        ? unavailable("no_quotes_sent")
        : metric(overview.conversionRate, { prior: rateComparable ? overview.priorConversionRate : null });
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────
  const completed = (jobsCompleted || []).filter(Boolean);
  const jobsMetric = metric(completed.length, { prior: hadFullPriorMonth ? priorJobsCompleted : null });

  // ── Marketing spend and cost per lead ───────────────────────────────────
  let spend;
  let costPerLead;
  if (!hasSpend(marketing)) {
    spend = unavailable("no_spend_recorded");
    costPerLead = unavailable("needs_spend");
  } else {
    const priorSpend = hadFullPriorMonth && hasSpend(priorMarketing) ? priorMarketing.totals.spend : null;
    spend = metric(marketing.totals.spend, {
      prior: priorSpend,
      approximate: marketing.totals.approximate,
      // A currency the pinned rate refused is OUT of the total. Said, never
      // silently short.
      partial: (marketing.totals.excluded?.length || 0) > 0,
    });
    const cpl = buildBlendedCostPerLead({ totalSpend: marketing.totals.spend, leadCountsBySource });
    let priorCpl = null;
    if (priorSpend !== null && priorLeadCountsBySource) {
      const p = buildBlendedCostPerLead({ totalSpend: priorSpend, leadCountsBySource: priorLeadCountsBySource });
      priorCpl = p.value;
    }
    costPerLead =
      cpl.value === null
        ? unavailable("no_leads")
        : {
            ...metric(cpl.value, { prior: priorCpl, approximate: marketing.totals.approximate, partial: spend.partial }),
            leadsCounted: cpl.sampleSize,
            leadsExcluded: cpl.excludedCount,
          };
  }

  // ── The pipeline: what happened at each stage this month ────────────────
  const funnel = [
    { key: "leads", count: leadRows.length },
    { key: "quotes", count: quotesSent.available ? quotesSent.value : null },
    { key: "accepted", count: quotesAccepted.available ? quotesAccepted.value : null },
    { key: "jobs", count: completed.length },
    { key: "paid", count: overview ? num(overview.revenueInvoiceCount) : null },
  ].filter((s) => s.count !== null);

  // ── Where the leads came from ───────────────────────────────────────────
  const bySource = new Map();
  for (const l of leadRows) {
    const s = l.source || null;
    const k = s === null ? "" : s;
    if (!bySource.has(k)) bySource.set(k, { source: s, leads: 0, quoted: 0, won: 0 });
    const row = bySource.get(k);
    row.leads += 1;
    // LeadRequest.quoteId is the quote this lead became — the same join
    // campaignRollup.js makes. Won is that quote accepted.
    if (l.quoteId) row.quoted += 1;
    if (l.quoteId && l.quoteStatus === "accepted") row.won += 1;
  }
  const sourceRows = [...bySource.values()].sort((a, b) => b.leads - a.leads || b.won - a.won);
  const leadSources = sourceRows.slice(0, SOURCE_ROWS);
  const rest = sourceRows.slice(SOURCE_ROWS);
  const otherSources = rest.length
    ? rest.reduce((acc, r) => ({ leads: acc.leads + r.leads, quoted: acc.quoted + r.quoted, won: acc.won + r.won, sources: acc.sources + 1 }), { leads: 0, quoted: 0, won: 0, sources: 0 })
    : null;

  const campaignRows = campaigns
    ? campaigns.campaigns
        .filter((c) => c.leads > 0 || (c.spend !== null && c.spend > 0))
        .sort((a, b) => b.leads - a.leads || (b.spend || 0) - (a.spend || 0))
        .slice(0, CAMPAIGN_ROWS)
        .map((c) => ({
          name: c.campaignName || null,
          leads: c.leads,
          spend: c.spend,
          approximate: c.approximate,
          costPerLead: c.costPerLead,
          quotes: c.quotes,
          jobs: c.jobs,
          // From the social-leads rollup: leads that came in as a message
          // (not a lead form), quotes found by a confirmed phone/email match
          // (already inside `quotes`, counted apart), and money actually
          // received — null when nothing was invoiced, never 0.
          conversationLeads: c.conversationLeads || 0,
          inferredQuotes: c.inferredQuotes || 0,
          paid: c.paid === undefined ? null : c.paid,
        }))
    : [];

  // ── Google Ads: one line, on FieldQuo's own leads from Google ad clicks ──
  // Cost per lead and per won job divide Google spend by LeadRequests that
  // arrived with a Google click id (lib/analytics/googleAdsRollup.js), never
  // by Google's own conversions — which are carried only to be labelled as
  // Google's. Null (no section) when the month had neither Google spend nor
  // a Google lead.
  const googleTotals = googleAds?.totals || null;
  const googleAdsLine =
    googleTotals && (googleTotals.spend !== null || googleTotals.leads > 0)
      ? {
          spend: googleTotals.spend,
          approximate: Boolean(googleTotals.approximate),
          partial: (googleTotals.excluded?.length || 0) > 0,
          leads: googleTotals.leads,
          wonJobs: googleTotals.wonJobs,
          costPerLead: googleTotals.costPerLead,
          costPerWonJob: googleTotals.costPerWonJob,
          googleConversions: googleTotals.googleConversions,
          paid: googleTotals.paid,
        }
      : null;

  const conversationRows =
    conversations && conversations.ok !== false && conversations.bySource
      ? Object.entries(conversations.bySource)
          .filter(([, v]) => v.conversations > 0)
          .map(([source, v]) => ({ source, conversations: v.conversations, won: v.counts?.won ?? 0 }))
          .sort((a, b) => b.conversations - a.conversations)
      : [];

  // ── Money owed, as of today ─────────────────────────────────────────────
  const recv = buildReceivables({ invoices: invoices || [], payments: payments || [], asOf });
  const overdueRows = recv.invoices.filter((r) => r.dueState === "overdue");
  const owed = {
    noInvoices: recv.noInvoices,
    nothingOutstanding: recv.nothingOutstanding,
    total: recv.total,
    count: recv.count,
    overdueTotal: recv.overdueTotal,
    overdueCount: recv.overdueCount,
    oldestDays: overdueRows.length ? Math.max(...overdueRows.map((r) => r.daysPastDue || 0)) : null,
  };

  // ── Things worth doing ──────────────────────────────────────────────────
  // Completed jobs with no issued invoice — by Job link, or by the quote when
  // the invoice carries no job (lib/invoices/jobLink.js's two-step rule).
  const billedJobIds = new Set();
  const billedQuoteIds = new Set();
  for (const f of families) {
    for (const m of f.members) {
      if (m.jobId) billedJobIds.add(m.jobId);
      else if (m.quoteId) billedQuoteIds.add(m.quoteId);
    }
  }
  const uninvoiced = completed.filter((j) => !billedJobIds.has(j.id) && !(j.quoteId && billedQuoteIds.has(j.quoteId)));

  const unquoted = leadRows.filter((l) => !l.quoteId && (l.status === "new" || l.status === "contacted"));
  const unquotedStale = unquoted.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return Number.isFinite(t) && asOfMs - t > LEAD_WAIT_DAYS * DAY;
  });

  const waiting = (waitingQuotes || []).filter((q) => {
    const t = new Date(q?.sentAt).getTime();
    return Number.isFinite(t) && asOfMs - t > QUOTE_WAIT_DAYS * DAY;
  });

  const unanswered = conversations && conversations.reply ? num(conversations.reply.unanswered) : 0;

  const candidates = [];
  const push = (priority, key, values, link) => candidates.push({ priority, key, values, link });
  const month = { kind: "month", date: period.start };

  if (uninvoiced.length) {
    push(100, "uninvoicedJobs", { uninvoicedJobs: { kind: "count", n: uninvoiced.length, noun: "jobs" }, month }, "jobs");
  }
  if (owed.overdueCount > 0) {
    push(90, "overdue", {
      overdueAmount: { kind: "money", amount: owed.overdueTotal },
      overdueInvoices: { kind: "count", n: owed.overdueCount, noun: "invoices" },
      overdueDays: { kind: "count", n: owed.oldestDays, noun: "days" },
    }, "invoices");
  }
  if (unquoted.length) {
    push(
      80,
      unquotedStale.length ? "unquotedLeadsStale" : "unquotedLeads",
      {
        unquotedLeads: { kind: "count", n: unquoted.length, noun: "leads" },
        month,
        // The wait is a value too, not a "3" typed into the sentence: the AI
        // fence rejects any digit a model writes, so a reworded sentence can
        // still say how long through the placeholder.
        ...(unquotedStale.length
          ? { unquotedStale: { kind: "number", n: unquotedStale.length }, waitDays: { kind: "count", n: LEAD_WAIT_DAYS, noun: "days" } }
          : {}),
      },
      "leads",
    );
  }
  if (waiting.length) {
    push(70, "waitingQuotes", {
      waitingQuotes: { kind: "count", n: waiting.length, noun: "quotes" },
      waitingAmount: { kind: "money", amount: round2(waiting.reduce((s, q) => s + num(q.total), 0)) },
    }, "quotes");
  }
  if (unanswered > 0) {
    push(60, "unanswered", { unansweredConversations: { kind: "count", n: unanswered, noun: "conversations" } }, "messages");
  }
  if (leadRows.length === 0) push(50, "noLeads", { month }, null);
  if (acceptance.available && acceptance.change && acceptance.change.direction !== "flat") {
    push(acceptance.change.direction === "down" ? 45 : 25, acceptance.change.direction === "down" ? "acceptanceDown" : "acceptanceUp", {
      rate: { kind: "pct", ratio: acceptance.value },
      priorRate: { kind: "pct", ratio: acceptance.prior },
    }, "quotes");
  }
  if (costPerLead.available && costPerLead.change && costPerLead.change.direction !== "flat" && costPerLead.prior > 0) {
    push(costPerLead.change.direction === "up" ? 40 : 20, costPerLead.change.direction === "up" ? "cplUp" : "cplDown", {
      cpl: { kind: "money", amount: costPerLead.value, approximate: costPerLead.approximate },
      priorCpl: { kind: "money", amount: costPerLead.prior, approximate: costPerLead.approximate },
    }, "spend");
  }
  const best = sourceRows.filter((r) => r.won > 0).sort((a, b) => b.won - a.won || b.leads - a.leads)[0];
  if (best && sourceRows.length > 1) {
    push(30, "bestSource", {
      bestSource: { kind: "source", source: best.source },
      bestWon: { kind: "number", n: best.won },
      bestLeads: { kind: "count", n: best.leads, noun: "leads" },
    }, "leads");
  }
  candidates.sort((a, b) => b.priority - a.priority);

  // ── The one-line headline ───────────────────────────────────────────────
  let headline;
  const priorMonth = { kind: "month", date: prior.start };
  if (collected.available && collected.value > 0) {
    const ch = collected.change;
    if (ch && ch.pct !== null && ch.direction !== "flat") {
      headline = {
        key: ch.direction === "up" ? "collectedUp" : "collectedDown",
        values: { collected: { kind: "money", amount: collected.value }, pct: { kind: "pct", ratio: ch.pct / 100 }, priorMonth },
      };
    } else {
      headline = { key: "collected", values: { collected: { kind: "money", amount: collected.value }, month } };
    }
  } else if (invoiced.available && invoiced.value > 0) {
    headline = { key: "invoiced", values: { invoiced: { kind: "money", amount: invoiced.value }, month } };
  } else if (leadRows.length > 0) {
    headline = { key: "leads", values: { newLeads: { kind: "count", n: leadRows.length, noun: "leads" }, month } };
  } else {
    headline = { key: "quiet", values: { month } };
  }

  return {
    period: { key: period.key, start: period.start, end: period.end },
    prior: { key: prior.key, start: prior.start, end: prior.end, comparable: Boolean(hadFullPriorMonth) },
    asOf,
    headline,
    tiles: {
      invoiced,
      collected,
      leads: leadsMetric,
      quotesSent,
      quotesAccepted,
      acceptance,
      jobs: jobsMetric,
      spend,
      costPerLead,
    },
    funnel,
    sources: {
      leads: leadSources,
      other: otherSources,
      campaigns: campaignRows,
      googleAds: googleAdsLine,
      conversations: conversationRows,
    },
    owed,
    insights: candidates.slice(0, INSIGHT_COUNT),
    // Every candidate, ranked — the AI step may choose among more than the
    // three the fallback prints, but only from these.
    candidates,
  };
}
