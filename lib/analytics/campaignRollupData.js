// lib/analytics/campaignRollupData.js
//
// The database half of lib/analytics/campaignRollup.js — moved here, verbatim,
// out of app/api/marketing-spend/campaigns/route.js (including the
// social-leads additions: a lead's confirmed-match inferredQuoteId, its
// source, and each invoice's amountPaid for the Paid column).
//
// It lived in the route while the Spend page was its only reader. The monthly
// summary email (lib/analytics/monthlySummaryData.js) needs the same
// per-campaign leads, quotes, jobs and paid, and a second copy of these
// queries would be the copy that rots (AGENTS.md failure class 4) — the first
// one to drift would make the email and the Spend page disagree about the same
// campaign. So both call this, and campaignRollup.js still does all the
// counting. The route's JSON is proved byte-identical to the pre-move route on
// the same fixture (md5) — see the commit that moved it.

import { buildCampaignRollup } from "@/lib/analytics/campaignRollup";
import { CLIENT_MATCH_SELECT, CANDIDATE_SCAN_LIMIT } from "@/lib/contacts/matchContact";
import { verifyConversion } from "@/lib/attribution/conversionEvidence";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/conversationOutcome";
import { loadLiveRates } from "@/lib/marketing/fxLive";

/**
 * @param {object} p
 * @param {object} p.db         a Prisma client (passed, so a check can stub it)
 * @param {string} p.companyId  the tenant — every query carries it
 * @param {object|null} p.range a Prisma date filter ({ gte, lte } or
 *                              { gte, lt }) applied to spend dates and lead
 *                              createdAt, or null for all time
 * @param {Date} p.asOf         the clock the rate's age is measured against
 * @param {object[]|null} p.rates  an exchange-rate list, or null to read the
 *                              live one (lib/marketing/fxLive.js)
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
      select: {
        id: true,
        metaCampaignId: true,
        metaCampaignName: true,
        quoteId: true,
        source: true,
        // For the conversion check below — a lead with no recorded quote.
        name: true,
        email: true,
        phone: true,
        intake: true,
        createdAt: true,
      },
    }),
  ]);

  const { jobs, invoices } = await followLeadsToMoney({ db, companyId, leads });

  return buildCampaignRollup({
    spendRows,
    // The contact details were read for the conversion check only; the
    // rollup is handed what it counts and nothing it would print.
    leads: leads.map((l) => ({
      id: l.id,
      metaCampaignId: l.metaCampaignId,
      metaCampaignName: l.metaCampaignName,
      quoteId: l.quoteId,
      inferredQuoteId: l.inferredQuoteId || null,
      source: l.source,
    })),
    jobs,
    invoices,
    companyCurrency: company?.currency || "CAD",
    asOf,
    rates: live.rates,
  });
}

/**
 * Leads (already read, with name/email/phone/intake/createdAt/quoteId) → the
 * jobs and invoices their quotes became, with `inferredQuoteId` set on a lead
 * with no recorded quote whose conversion is CONFIRMED. The database half of
 * "what did these leads become", shared by the Meta campaign rollup above and
 * the Google Ads rollup (lib/analytics/googleAdsRollupData.js) — moved here
 * verbatim out of loadCampaignRollup on 2026-10-04 so the two follow a lead to
 * money by one set of queries, not two.
 *
 * Mutates `leads` (sets inferredQuoteId), exactly as the inline code did.
 */
export async function followLeadsToMoney({ db, companyId, leads }) {
  await inferLeadQuotes({ db, companyId, leads });
  return followQuotesToMoney({ db, companyId, leads });
}

/**
 * ── A lead nobody linked to its quote ────────────────────────────────────────
 *
 * A homeowner messages from the ad, the contractor quotes them from the
 * client screen, and the lead is never converted — so LeadRequest.quoteId is
 * empty and the campaign would show a lead and no sale. The same check the
 * lead drawer shows (lib/attribution/conversionEvidence.js) is run here, and
 * ONLY a confirmed conversion (exact phone or email, or a name plus an
 * agreeing address; never a name alone, never a tie) contributes its quote,
 * as `inferredQuoteId` — counted apart so the screen can say how many.
 *
 * Split out of followLeadsToMoney (2026-10-05, unchanged) so the leads board
 * can show "a quote for the same client created after the lead" by exactly
 * the rule the campaign rollup counts it by. Mutates `leads`.
 */
export async function inferLeadQuotes({ db, companyId, leads }) {
  const unlinked = leads.filter((l) => !l.quoteId);
  if (unlinked.length) {
    const DAY = 24 * 60 * 60 * 1000;
    const earliest = Math.min(...unlinked.map((l) => new Date(l.createdAt).getTime()));
    const [clients, candidateQuotes] = await Promise.all([
      db.client.findMany({ where: { companyId }, select: CLIENT_MATCH_SELECT, orderBy: { createdAt: "desc" }, take: CANDIDATE_SCAN_LIMIT }),
      db.quote.findMany({
        where: { companyId, createdAt: { gte: new Date(earliest - DAY) } },
        select: { id: true, clientId: true, status: true, createdAt: true, total: true, acceptedTotal: true, quoteNumber: true, siteAddress: true },
      }),
    ]);
    const candidateJobs = candidateQuotes.length
      ? await db.job.findMany({
          where: { companyId, quoteId: { in: candidateQuotes.map((q) => q.id) } },
          select: { id: true, quoteId: true, clientId: true, status: true, siteAddress: true },
        })
      : [];
    // A quote already linked to another lead is that lead's, not this one's.
    const taken = new Set(leads.map((l) => l.quoteId).filter(Boolean));
    for (const l of unlinked) {
      const v = verifyConversion({
        conversation: { id: l.id, source: null, startedAt: l.createdAt },
        contact: {
          name: l.name,
          email: l.email,
          phone: l.phone,
          address: typeof l.intake?.address === "string" ? l.intake.address : null,
        },
        clients,
        quotes: candidateQuotes.filter((q) => !taken.has(q.id)),
        jobs: candidateJobs,
        invoices: [],
        companyId,
        windowDays: ATTRIBUTION_WINDOW_DAYS,
      });
      if (v.countable && v.quote?.id) {
        l.inferredQuoteId = v.quote.id;
        taken.add(v.quote.id);
      }
    }
  }
  return leads;
}

/** Leads (recorded or inferred quote ids set) → the jobs and invoices. */
async function followQuotesToMoney({ db, companyId, leads }) {
  const quoteIds = [...new Set(leads.map((l) => l.quoteId || l.inferredQuoteId).filter(Boolean))];
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
        select: { id: true, parentInvoiceId: true, version: true, total: true, amountPaid: true, jobId: true, quoteId: true },
      })
    : [];

  return { jobs, invoices };
}
