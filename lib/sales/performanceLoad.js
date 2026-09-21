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
import { contractorWordCounts } from "./calls/contractorWordsSql";
import { listProspectLegs } from "./calls/reconcileProvider";
import { previousPeriod } from "./callQuality";
import { prospectDialsOnly } from "./testLines";

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
  // Which kind of call (prospect / internal / off_campaign — only the
  // first is counted) and what a supervisor did on it, for the hold and
  // supervised columns (lib/sales/calls/dialTable.js).
  kind: true,
  supervisionKind: true,
  supervisionSeconds: true,
  providerCostCents: true,
  disposition: true,
  callbackAt: true,
  toE164: true,
  recordingUrl: true,
  recordingSid: true,
  transcribedAt: true,
  jurisdictionCode: true,
  // What conversation.js's wasConnected() reads. Until 2026-09-20 none of
  // these three were selected, so a no-answer leg with no answeredAt was
  // "unmeasured" rather than "not connected", and every rate here was over
  // fewer calls than the floor board's — the two screens the intro promises
  // cannot disagree, disagreeing.
  providerStatus: true,
  endReason: true,
  endedAt: true,
  // The join to the carrier: the prospect leg's sid. dialTable.js counts a
  // row without it as unverified, so leaving it out of the select would
  // print every dial as unverified — which is exactly what the first run
  // of the rebuilt table did.
  providerCallSid: true,
  // The carrier's machine verdict (lib/sales/calls/amd.js): with it a
  // two-minute greeting is voicemail in the buckets, not a conversation.
  amdResult: true,
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
      // The scope goes IN the salesRepId clause. This used to spread
      // `scopedWhere` and then write `salesRepId: { not: null }` after it —
      // which replaced the `in` list, read every rep's attempts for an
      // agency and left the scoping to the in-memory filter downstream. The
      // page was right; the read was not. scripts/check-sales-agency.mjs
      // now asserts every attempt read carries the team's ids.
      where: prospectDialsOnly({ dialledAt: { gte: prev.from || from, lte: to }, salesRepId: Array.isArray(repIds) ? { in: repIds } : { not: null } }),
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

  // The contractor's word count, from the database, onto each transcribed
  // row. `transcript` itself is never selected here — a year of transcripts
  // is not what a rate needs — and without the count this page's
  // "Conversation (transcript)" column could only ever say "not yet known"
  // (lib/sales/calls/contractorWordsSql.js has the history).
  const words = await contractorWordCounts({ ids: attempts.filter((a) => a.transcribedAt).map((a) => a.id), client });
  for (const a of attempts) {
    if (words.has(a.id)) a.contractorWords = words.get(a.id);
  }

  // The carrier's own count of prospect legs in the period, for the
  // reconciliation line above the calls table. A read that fails is a
  // sentence on the page, never a silent "they agree".
  let carrierLegs = null;
  try {
    carrierLegs = await listProspectLegs({ from, to });
  } catch (err) {
    carrierLegs = { legs: [], listedAll: false, error: err?.message || String(err) };
  }

  const report = buildPerformanceReport({ reps, attributions, entries, batches, leads, companies, attempts, from, to, repIds, carrierLegs });

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
