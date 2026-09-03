// lib/sales/pipeline/handlers/detectOpportunities.js
//
// DETECT_OPPORTUNITIES — what FieldQuo can sell this business, and what was
// actually observed that makes it true.
//
// ══ This stage calls no model, and that is the point ═══════════════════════
//
// The spec's §58 draws the boundary: deterministic software decides what
// software can determine. Whether an opportunity EXISTS is a comparison
// between rows we observed and a list of things we sell — lib/sales/intel/
// opportunity.js does it, it is pure, and it is executed against hostile input
// by scripts/check-sales-opportunity.mjs. A model asked the same question
// would be confidently wrong on a sales call with nothing to point at
// afterwards.
//
// `PROVIDER_BY_KIND` mapped this stage to `openai`, which was wrong in the
// expensive direction: it charged every analysis against the tightest budget
// in the pipeline — the lane whose arithmetic makes a 1,000-prospect campaign
// take two days — to protect a vendor this stage never talks to. It is `local`
// now, and kinds.js carries the reason. This is the same correction
// ANALYZE_CAPABILITIES already needed; two stages made the same mistake
// because "AI-ish" and "calls a model" are easy to confuse from a distance.
//
// ══ Thin, deliberately ═════════════════════════════════════════════════════
//
// Every decision is in opportunity.js and every query is in intel/db.js.
// `regenerateOpportunities` had no caller anywhere in the product until this
// file — it was written, checked, and unreachable. Calling it rather than
// re-implementing its transaction is what stops the second copy being the one
// that rots (AGENTS.md failure class 4).
//
// ══ Zero opportunities is a SUCCESS ════════════════════════════════════════
//
// A business with nothing to sell them is a real answer and the stage is done.
// What it must not do is look the same as a business nobody looked at, so the
// note carries `reason` from the analysis — `nothing_observed` and
// `nothing_matched` are different sentences and a rep needs to tell them
// apart. The lead score and the research brief downstream read the same
// distinction off the capability rows themselves.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { regenerateOpportunities } from "@/lib/sales/intel/db";

/**
 * @param payload { prospectId? } — falls back to the task's own column, the
 *        same as every other stage, so both enqueue shapes work.
 */
export async function handleDetectOpportunities({ task, payload = {}, db: prisma } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "detect_opportunities: no prospectId on the task or its payload" };
  }

  // Existence is checked here rather than left to the write, because
  // regenerateOpportunities finishes with a `prospect.update` that would throw
  // P2025 for a deleted prospect — a throw the runner reads as unlucky and
  // retries five times over six hours. A deleted prospect is not unlucky.
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { id: true },
  });
  if (!prospect) {
    return { done: false, retry: false, reason: "detect_opportunities: prospect not found" };
  }

  const result = await regenerateOpportunities(prospectId, { deps: { db: prisma } });

  return {
    done: true,
    note: [
      `${result.opportunities.length} opportunity(ies)`,
      result.reason ? `none: ${result.reason}` : null,
      // The honest short-measure flag, the one lib/analytics/kpis.js uses. A
      // rep reading a two-item list off a business whose site timed out should
      // see that, not a confident two.
      result.incomplete ? `incomplete — ${result.unchecked.length} capability(ies) never decided` : null,
      result.skipped.length ? `${result.skipped.length} rule(s) refused` : null,
    ]
      .filter(Boolean)
      .join("; "),
  };
}

registerHandler(
  "DETECT_OPPORTUNITIES",
  withChain("DETECT_OPPORTUNITIES", async ({ task, payload, db: prisma }) =>
    handleDetectOpportunities({ task, payload, db: prisma || db }),
  ),
);
