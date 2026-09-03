// lib/sales/pipeline/handlers/calculateLeadScore.js
//
// CALCULATE_LEAD_SCORE — how worth calling this prospect is, and why.
//
// ══ Deterministic, local, and no conversion probability ═══════════════════
//
// Spec §18. The arithmetic is lib/sales/intel/leadScore.js, which is pure and
// carries the argument at length: there is no outcome data, so a percentage
// would be fiction. This file loads five sets of rows, hands them over, and
// files the answer.
//
// ══ Why a row and not a column ════════════════════════════════════════════
//
// `ProspectScore` is versioned history — the schema says so outright, "so
// changing the scoring model does not make last month's analytics unreadable".
// A column would make every weight change silently rewrite the past.
//
// ══ What stops the history becoming noise ═════════════════════════════════
//
// The pipeline re-scores whenever a prospect is re-analysed, and a retried
// task re-scores too. Filing an identical row each time would turn a history
// into a log of the fact that a cron ran. So a row is written only when the
// score, the version or the REASONS differ from the most recent one —
// `scoreChanged()` decides it, and comparing the reasons as well as the number
// matters: two identical numbers reached for different reasons are a real
// change, and a rep who reads the reasons would see it.
//
// That doubles as the idempotency this stage needs. A reclaimed task that
// already scored finds its own row unchanged and writes nothing, which is
// better than an idempotency key would do — the key would dedupe a retry and
// still file a duplicate for a legitimate re-run.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { computeLeadScore, scoreChanged } from "@/lib/sales/intel/leadScore";

/**
 * Everything the score reads. Five queries, no N+1, and every one of them
 * scoped to the one prospect.
 */
export async function loadScoreInputs(prisma, prospectId) {
  const [prospect, capabilities, technologies, opportunities, inferences, previous] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        phoneE164: true,
        addressLine: true,
        tradeKey: true,
        territoryId: true,
        websiteUrl: true,
        googleReviewCount: true,
        sourceUpdatedAt: true,
      },
    }),
    prisma.prospectCapability.findMany({ where: { prospectId }, select: { code: true, value: true } }),
    prisma.prospectTechnology.findMany({
      where: { prospectId },
      select: { technologyCode: true, isCompetitor: true },
    }),
    prisma.prospectOpportunity.findMany({ where: { prospectId }, select: { capabilityCode: true, rank: true } }),
    prisma.prospectInference.findMany({ where: { prospectId }, select: { kind: true, value: true } }),
    prisma.prospectScore.findFirst({
      where: { prospectId },
      orderBy: { computedAt: "desc" },
      select: { score: true, reasons: true, scoringVersion: true },
    }),
  ]);
  return { prospect, capabilities, technologies, opportunities, inferences, previous };
}

/**
 * @param payload { prospectId? } — falls back to the task's own column, the
 *        same as every other stage, so both enqueue shapes work.
 */
export async function handleCalculateLeadScore({ task, payload = {}, db: prisma, now = new Date() } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "calculate_lead_score: no prospectId on the task or its payload" };
  }

  const inputs = await loadScoreInputs(prisma, prospectId);
  if (!inputs.prospect) {
    return { done: false, retry: false, reason: "calculate_lead_score: prospect not found" };
  }

  const result = computeLeadScore({ ...inputs, now });

  let written = false;
  if (scoreChanged(inputs.previous, result)) {
    await prisma.prospectScore.create({
      data: {
        prospectId,
        score: result.score,
        reasons: result.reasons,
        scoringVersion: result.scoringVersion,
        computedAt: now,
      },
    });
    written = true;
  }

  return {
    done: true,
    note: [
      `score ${result.score}`,
      written ? null : "unchanged, no new row",
      // The line that decides how a low score reads. Without it a 35 off an
      // uncrawled prospect is indistinguishable from a 35 off one whose site
      // was read end to end and had nothing in it.
      result.observed.capabilitiesDecided === 0
        ? "website never read — capability gaps unknown"
        : `${result.observed.capabilitiesDecided} capability(ies) decided`,
      result.observed.competitor ? `competitor: ${result.observed.competitor}` : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

registerHandler(
  "CALCULATE_LEAD_SCORE",
  withChain("CALCULATE_LEAD_SCORE", async ({ task, payload, now, db: prisma }) =>
    handleCalculateLeadScore({ task, payload, now, db: prisma || db }),
  ),
);
