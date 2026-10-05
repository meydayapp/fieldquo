// lib/analytics/adFunnelData.js
//
// The database half of lib/analytics/adFunnel.js — shared by the Spend page
// (GET /api/marketing-spend/ad-funnel) and the KPI page, so the two cannot
// disagree about what an ad bought.
//
// Every query carries companyId. Nothing is written: a thread whose tier was
// never stored is classified here, in memory, by the same free rules the
// capture runs (lib/leads/qualifyThreads.js — a stored model verdict and a
// person's tier are respected); the model is never called from a report.

import { buildAdFunnel } from "@/lib/analytics/adFunnel";
import { buildOutcomeIndex } from "@/lib/analytics/campaignRollup";
import { followLeadsToMoney } from "@/lib/analytics/campaignRollupData";
import { priceSpendRows } from "@/lib/analytics/spendCurrency";
import { loadLiveRates } from "@/lib/marketing/fxLive";
import { qualifyCompanyThreads, QUALIFY_PLATFORMS } from "@/lib/leads/qualifyThreads";
import { effectiveTier } from "@/lib/leads/qualification";

/**
 * @param p.range  a Prisma date filter for thread createdAt and spend dates,
 *                 or null for all time
 */
export async function loadAdFunnel({ db, companyId, range = null, asOf = new Date(), rates = null, deps = {} }) {
  const { classify = qualifyCompanyThreads } = deps;
  const live = rates ? { rates } : await loadLiveRates({ prisma: db, asOf });
  const [company, threads, spendRows] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.messageThread.findMany({
      where: { companyId, channel: { platform: { in: [...QUALIFY_PLATFORMS] } }, ...(range && { createdAt: range }) },
      select: { id: true, leadId: true, leadCapture: true, channel: { select: { platform: true } } },
    }),
    db.marketingSpend.findMany({
      where: { companyId, source: "meta_api", ...(range && { date: range }) },
      select: { amount: true, currency: true, date: true, messagingConversations: true, conversions: true },
    }),
  ]);

  // Stored tiers first; the threads with none are classified in memory.
  const stored = new Map();
  const missing = [];
  for (const t of threads) {
    const q = t.leadCapture?.qualification;
    if (q && effectiveTier(q)) stored.set(t.id, { tier: effectiveTier(q), origin: q.origin === "ad" ? "ad" : "organic" });
    else missing.push(t.id);
  }
  if (missing.length) {
    const run = await classify(db, { companyId, threadIds: missing, write: false, now: asOf }).catch(() => null);
    for (const [id, v] of run?.verdicts || []) stored.set(id, { tier: v.tier, origin: v.stored?.origin === "ad" ? "ad" : "organic" });
  }

  const funnelThreads = threads.map((t) => ({
    id: t.id,
    platform: t.channel?.platform || null,
    leadId: t.leadId || null,
    tier: stored.get(t.id)?.tier || null,
    origin: stored.get(t.id)?.origin || "organic",
  }));

  const leadIds = [...new Set(funnelThreads.map((t) => t.leadId).filter(Boolean))];
  const leads = leadIds.length
    ? await db.leadRequest.findMany({
        where: { companyId, id: { in: leadIds } },
        select: { id: true, quoteId: true, name: true, email: true, phone: true, intake: true, createdAt: true },
      })
    : [];
  const { jobs, invoices } = leads.length ? await followLeadsToMoney({ db, companyId, leads }) : { jobs: [], invoices: [] };

  // Meta's spend and counts, in the company's currency.
  const companyCurrency = company?.currency || "CAD";
  const priced = priceSpendRows({ rows: spendRows, companyCurrency, asOf, rates: live.rates });
  let amount = null;
  for (const p of priced.priced) {
    if (p.amountInCompanyCurrency === null) continue;
    amount = (amount || 0) + p.amountInCompanyCurrency;
  }
  const sumOrNull = (key) => {
    let s = null;
    for (const r of spendRows) if (r[key] !== null && r[key] !== undefined) s = (s || 0) + Number(r[key]);
    return s;
  };

  const funnel = buildAdFunnel({
    threads: funnelThreads,
    leads: leads.map((l) => ({ id: l.id, quoteId: l.quoteId, inferredQuoteId: l.inferredQuoteId || null })),
    outcomeIndex: buildOutcomeIndex({ jobs, invoices }),
    spend: spendRows.length ? { amount, metaConversations: sumOrNull("messagingConversations"), metaLeads: sumOrNull("conversions"), currency: companyCurrency } : null,
  });
  return { ...funnel, currency: companyCurrency, spendExcluded: priced.excluded || [], classifiedNow: missing.length };
}
