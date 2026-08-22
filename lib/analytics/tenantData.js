// lib/analytics/tenantData.js
//
// Pulls what lib/analytics/tenantHealth.js reasons over.
//
// Kept separate so the engine stays executable without a database — every rule
// about thin samples, draft exclusion and value attribution is tested in
// scripts/check-tenant-health.mjs against fixtures, and this file only has to
// be right about the queries.
//
// Demo companies are excluded everywhere. They are sales fixtures with
// invented invoices to "Sarah Mitchell", and they were contributing 99% of the
// old dashboard's money.

import {
  buildFunnel,
  buildTradeBreakdown,
  buildCompanyHealth,
  buildAdoption,
} from "./tenantHealth";
import { summariseComposeTimes } from "./composeTimer";

const NOT_DEMO = { isDemo: false };

/** Everything the tenant board needs, in one pass. */
export async function collectTenantAnalytics(db, { since } = {}) {
  const window = since ? { gte: since } : undefined;

  const [quotes, jobs, invoices, companies, scopeGroups] = await Promise.all([
    db.quote.findMany({
      where: { company: NOT_DEMO, ...(window && { createdAt: window }) },
      select: {
        id: true, companyId: true, status: true, total: true,
        sentAt: true, acceptedAt: true, declinedAt: true, declineReason: true,
        createdAt: true, autoEstimated: true, composeSeconds: true,
      },
    }),
    db.job.findMany({
      where: { company: NOT_DEMO, ...(window && { createdAt: window }) },
      select: { id: true, companyId: true, status: true, quoteId: true, completedAt: true },
    }),
    db.invoice.findMany({
      where: { company: NOT_DEMO, ...(window && { createdAt: window }) },
      select: { id: true, companyId: true, status: true, total: true, sentAt: true, paidDate: true },
    }),
    db.company.findMany({
      where: NOT_DEMO,
      select: {
        id: true, name: true, createdAt: true,
        serviceCategories: {
          where: { enabled: true },
          select: { category: { select: { key: true, label: true } } },
        },
      },
    }),
    // The trade breakdown. A scope group is one trade on one quote, and it
    // carries its own subtotal — which is why a $30k kitchen doesn't credit
    // $30k to flooring.
    db.quoteScopeGroup.findMany({
      where: { quote: { company: NOT_DEMO, ...(window && { createdAt: window }) } },
      select: {
        subtotal: true,
        category: { select: { key: true, label: true } },
        quote: {
          select: { id: true, companyId: true, status: true, sentAt: true, total: true },
        },
      },
    }),
  ]);

  // ── Per-company rollups, computed once ──────────────────────────────────
  const quotesByCompany = new Map();
  for (const q of quotes) {
    if (!quotesByCompany.has(q.companyId)) quotesByCompany.set(q.companyId, []);
    quotesByCompany.get(q.companyId).push(q);
  }
  const jobsByCompany = new Set(jobs.map((j) => j.companyId));
  const invoicesByCompany = new Set(invoices.map((i) => i.companyId));
  const instantByCompany = new Set(
    quotes.filter((q) => q.autoEstimated).map((q) => q.companyId),
  );

  const companyRows = companies.map((c) => {
    const own = quotesByCompany.get(c.id) || [];
    const dates = own.map((q) => new Date(q.createdAt)).sort((a, b) => a - b);
    return {
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      quoteCount: own.length,
      firstQuoteAt: dates[0] || null,
      lastQuoteAt: dates[dates.length - 1] || null,
      trades: (c.serviceCategories || []).map((s) => s.category.label),
      usesInstantQuotes: instantByCompany.has(c.id),
      usesInvoicing: invoicesByCompany.has(c.id),
      usesJobs: jobsByCompany.has(c.id),
    };
  });

  // ── Trade rows, flattened for the engine ────────────────────────────────
  const jobCountByQuote = new Map();
  const doneCountByQuote = new Map();
  for (const j of jobs) {
    if (!j.quoteId) continue;
    jobCountByQuote.set(j.quoteId, (jobCountByQuote.get(j.quoteId) || 0) + 1);
    if (j.status === "completed") {
      doneCountByQuote.set(j.quoteId, (doneCountByQuote.get(j.quoteId) || 0) + 1);
    }
  }

  const tradeRows = scopeGroups
    .filter((g) => g.category && g.quote)
    .map((g) => ({
      companyId: g.quote.companyId,
      categoryKey: g.category.key,
      categoryLabel: g.category.label,
      status: g.quote.status,
      sentAt: g.quote.sentAt,
      scopeSubtotal: Number(g.subtotal || 0),
      quoteTotal: Number(g.quote.total || 0),
      jobCount: jobCountByQuote.get(g.quote.id) || 0,
      completedJobCount: doneCountByQuote.get(g.quote.id) || 0,
    }));

  // ── Sales cycle, now that the dates exist ───────────────────────────────
  //
  // Nulls are dropped rather than counted. Every quote decided before
  // acceptedAt shipped carries no claim about how long it took.
  const decisionDays = quotes
    .filter((q) => q.sentAt && q.acceptedAt)
    .map((q) => (new Date(q.acceptedAt) - new Date(q.sentAt)) / 86400000)
    .filter((d) => d >= 0);

  const declineReasons = quotes
    .filter((q) => q.declineReason)
    .map((q) => q.declineReason);

  return {
    funnel: buildFunnel(quotes, jobs, invoices),
    trades: buildTradeBreakdown(tradeRows),
    health: buildCompanyHealth(companyRows),
    adoption: buildAdoption(companyRows, {
      totalQuotes: quotes.length,
      instantQuotes: quotes.filter((q) => q.autoEstimated).length,
    }),
    speed: {
      // How long a quote takes to BUILD — active time, not wall clock.
      compose: summariseComposeTimes(quotes.map((q) => q.composeSeconds)),
      // How long a CLIENT takes to decide. Reported only when there is
      // something to report; "0 days" from an empty set would be a claim.
      decision: decisionDays.length
        ? {
            count: decisionDays.length,
            medianDays:
              Math.round(
                [...decisionDays].sort((a, b) => a - b)[
                  Math.floor(decisionDays.length / 2)
                ] * 10,
              ) / 10,
          }
        : { count: 0, medianDays: null },
    },
    // Raw, ungrouped. Clustering these into "price / timing / went with
    // someone else" is a job for a model over real text, not a regex over
    // four samples.
    declineReasons: declineReasons.slice(0, 50),
    declineReasonCount: declineReasons.length,
  };
}
