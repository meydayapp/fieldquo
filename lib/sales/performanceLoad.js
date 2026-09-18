// lib/sales/performanceLoad.js
//
// The reads behind the performance page — one function, two doors.
//
// app/api/platform/sales/performance (superadmin, everyone) and
// app/api/sales/agency/performance (an agency, its own team) load the same
// rows with the same selects and hand them to the same pure composer,
// lib/sales/performanceReport.js. The route decides WHO is asking and what
// `repIds` that means; this file decides nothing about scope except to pass
// it through — the scope is applied once, in the pure module, to every
// input, so the two pages cannot disagree about what a team's numbers are.
//
// The volumes are FieldQuo's own (its reps, the companies it sold to, the
// calls its floor made), which is why every row is loaded and the
// arithmetic happens offline in the pure modules that the check scripts
// execute — the same argument the platform route's header made when it was
// the only caller.
import { db } from "@/lib/db";
import { presetRange, PERIOD_PRESETS } from "@/lib/analytics/periodPresets";
import { buildPerformanceReport } from "./performanceReport";
import { previousPeriod } from "./callQuality";
import { excludingTestDials } from "./testLines";

/** Inclusive YYYY-MM-DD bounds to instants, UTC — the convention presetRange builds in. */
export function performanceBounds(preset) {
  // An unknown preset falls back to this month rather than 400ing —
  // presetRange already has that default, and this reads the same fallback
  // rather than a second opinion about which key is valid.
  const known = PERIOD_PRESETS.some(([key]) => key === preset);
  const { from, to } = presetRange(known ? preset : "thisMonth");
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}

const REP_SELECT = {
  id: true,
  name: true,
  code: true,
  active: true,
  acceptedAt: true,
  endedAt: true,
  engagement: true,
  manager: { select: { id: true, kind: true, name: true } },
  // Loaded because a rep with no plan earns no ledger rows at all
  // (earnMilestone refuses to invent an amount), which makes their
  // companies invisible to the payment stages of the funnel. The funnel
  // reports that as a named caveat rather than a smaller number.
  commissionPlanId: true,
};

const ATTEMPT_SELECT = {
  id: true,
  salesRepId: true,
  direction: true,
  dialChannel: true,
  dialledAt: true,
  answeredAt: true,
  talkSeconds: true,
  holdSeconds: true,
  providerCostCents: true,
  disposition: true,
  callbackAt: true,
  toE164: true,
  recordingUrl: true,
  transcribedAt: true,
  jurisdictionCode: true,
  qa: { select: { overall: true, reviewerOverall: true, reviewedAt: true, skippedReason: true, deterministic: true, scores: true } },
};

/**
 * @param {{ from: Date, to: Date, repIds: string[]|null, client?: typeof db }} args
 * @returns the report plus `acquisitions`, the company drill-down.
 */
export async function loadPerformanceReport({ from, to, repIds = null, client = db } = {}) {
  const repWhere = Array.isArray(repIds) ? { id: { in: repIds } } : {};
  const scopedWhere = Array.isArray(repIds) ? { salesRepId: { in: repIds } } : {};
  const prev = previousPeriod(from, to);

  const [reps, attributions, entries, batches, leads, attempts] = await Promise.all([
    client.salesRep.findMany({ where: repWhere, select: REP_SELECT }),
    // No date filter on the ledger rows. "This week" and "total" are both on
    // the screen, the period bounds are applied in the pure module, and
    // filtering here would make the lifetime figures silently mean "in the
    // selected period".
    client.salesAttribution.findMany({
      where: scopedWhere,
      select: { salesRepId: true, companyId: true, capturedAt: true, source: true },
    }),
    client.salesCommissionEntry.findMany({
      where: scopedWhere,
      select: {
        salesRepId: true,
        companyId: true,
        milestone: true,
        amountCents: true,
        status: true,
        payoutBatchId: true,
        occurredAt: true,
      },
    }),
    client.salesPayoutBatch.findMany({
      where: scopedWhere,
      select: { id: true, salesRepId: true, status: true, paidAt: true, periodStart: true },
    }),
    client.salesLead.findMany({
      where: scopedWhere,
      select: {
        salesRepId: true,
        status: true,
        createdAt: true,
        convertedCompanyId: true,
        convertedAt: true,
      },
    }),
    // The calls, for this period AND the one before it (the quality trend
    // is a comparison, and a comparison needs both sides read the same
    // way). Test dials are excluded at the query and again in the pure
    // modules — the double guard lib/sales/testLines.js asks for. `qa`
    // rides along so the scorecard section reads the same rows the call
    // figures do.
    client.salesCallAttempt.findMany({
      where: excludingTestDials({ ...scopedWhere, dialledAt: { gte: prev.from || from, lte: to }, salesRepId: { not: null } }),
      select: ATTEMPT_SELECT,
    }),
  ]);

  // Only the companies a rep actually brought in. Not every tenant: this
  // page is about attributed acquisition, and loading the rest would put
  // companies on it that no rep can be credited or debited for.
  const companyIds = [...new Set(attributions.map((a) => a.companyId).filter(Boolean))];
  const companies = companyIds.length
    ? await client.company.findMany({
        where: { id: { in: companyIds } },
        select: {
          id: true,
          name: true,
          createdAt: true,
          stripeChargesEnabled: true,
          onboardingStatus: true,
          isDemo: true,
          subscription: {
            select: {
              status: true,
              createdAt: true,
              canceledAt: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
      })
    : [];

  const report = buildPerformanceReport({ reps, attributions, entries, batches, leads, companies, attempts, from, to, repIds });

  const byRep = new Map(reps.map((r) => [r.id, r]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  return {
    ...report,
    // "Which companies did a rep bring in, and what are they doing now" —
    // the question the funnel counts answer in aggregate, listed so a name
    // can be clicked through to the company itself.
    acquisitions: attributions
      .map((a) => {
        const company = companyById.get(a.companyId);
        const rep = byRep.get(a.salesRepId);
        return {
          companyId: a.companyId,
          companyName: company?.name || null,
          repId: a.salesRepId,
          repName: rep?.name || null,
          capturedAt: a.capturedAt,
          source: a.source,
          isDemo: Boolean(company?.isDemo),
          chargesEnabled: Boolean(company?.stripeChargesEnabled),
          onboardingStatus: company?.onboardingStatus || null,
          subscriptionStatus: company?.subscription?.status || null,
          planName: company?.subscription?.plan?.name || null,
          canceledAt: company?.subscription?.canceledAt || null,
        };
      })
      .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt)),
  };
}
