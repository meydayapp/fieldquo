// lib/sales/pipeline/handlers/generateResearchBrief.js
//
// GENERATE_RESEARCH_BRIEF — the pre-call card, and the only stage in this
// pipeline that spends money on a model.
//
// ══ What the model is allowed to do ════════════════════════════════════════
//
// Rewrite sentences that already exist. That is all, and every part of the
// design is there to keep it that way:
//
//   - the card is COMPOSED FIRST, from rows, by lib/sales/intel/brief.js. If
//     the model is unconfigured, refused, over budget, truncated, or answers
//     with a number, the same card is returned in plainer words. Nothing is
//     conditional on a model having answered — lib/site/generateSite.js holds
//     exactly this property and its header argues it: every path falls back to
//     something factual, so AI being down produces plainer copy, never a
//     broken page.
//   - the model is shown SENTENCES, not rows. It gets no ids, no counts, no
//     evidence, no capability values — there is nothing for it to source
//     from, because sourcing is not its job.
//   - it answers into a schema with no numeric field anywhere, and any
//     sentence containing a digit is dropped after the fact as well. Two gates
//     for one property, because `strict: true` is one vendor's promise and
//     provider.js exists precisely because the vendor can change.
//   - it cannot create, delete or reorder an opportunity. The deterministic
//     `reason` from the rule that fired is ALWAYS carried on the card beside
//     any phrased line, so there is something to check the phrasing against.
//
// ══ Where the sentences go, and why not into a row of their own ═══════════
//
// There is no `ProspectBrief` table, and this work did not add one — the
// schema was held by other agents. That turned out to be the right shape
// anyway: the card is composed at read time from the rows, so it can never go
// stale against them, and the only part worth keeping is the part that cost
// money. So the phrasing is cached on the task that produced it, under
// `payload.brief`, alongside the model that wrote it and the moment it did.
//
// Being explicit, because it stretches the column's stated purpose: `payload`
// is documented as the task's INPUT. What is written here is the task's own
// output, on its own row, guarded by its own claim token. It is not a CRM
// field and nothing else reads it. When the schema is free, a `ProspectBrief`
// row keyed to the prospect with the model, the version and the sentences is
// the right home, and moving it is a read-path change rather than a rewrite —
// composeBrief() takes `phrasing` as an argument from wherever it comes.
//
// ══ Spend ═════════════════════════════════════════════════════════════════
//
// `AiUsage` requires a companyId and FieldQuo is not a company, so this stage
// meters through lib/ai/platformUsage.js instead — the same before/after shape
// lib/ai/usage.js keeps. The budget is CHECKED BEFORE the call, because
// recording after only says what was already spent. A run that hits the
// ceiling produces the plain card and says so in the task note; it does not
// fail, because a brief without a phrased opening is still a brief.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { complete } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import {
  BRIEF_VERSION,
  briefSchema,
  composeBrief,
  phrasingPrompt,
  phrasingSlots,
  PHRASING_SYSTEM,
  validatePhrasing,
} from "@/lib/sales/intel/brief";

/** The `PlatformAiUsage.area` this stage's spend is filed under. Named in that
 *  column's own schema comment, so a spike is traceable to a stage rather than
 *  to "AI". */
export const BRIEF_AI_AREA = "research_brief";

/**
 * The completion budget asked for: one opening line and three angles.
 *
 * A FLOOR rather than a ceiling, and worth knowing: provider.js raises it to
 * its own per-model budget (3,000 on a reasoning model) because reasoning
 * tokens come out of the same allowance, and an exhausted budget costs the
 * whole request while an unused one costs nothing. Asking for a small number
 * here would not save money; running out would show up as a TRUNCATED failure
 * with the fix named, and the card would fall back to plain.
 */
export const BRIEF_MAX_TOKENS = 700;

/** Everything the card is built from. Six queries, no N+1. */
export async function loadBriefInputs(prisma, prospectId) {
  const [prospect, capabilities, technologies, inferences, opportunities, score] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        city: true,
        province: true,
        phoneE164: true,
        websiteUrl: true,
        tradeKey: true,
        campaignId: true,
        assignedRepId: true,
        sourceProvider: true,
        sourceRelease: true,
        sourceUpdatedAt: true,
      },
    }),
    prisma.prospectCapability.findMany({
      where: { prospectId },
      select: { code: true, value: true, evidenceIds: true },
    }),
    prisma.prospectTechnology.findMany({
      where: { prospectId },
      select: { technologyCode: true, isCompetitor: true, evidenceIds: true },
    }),
    prisma.prospectInference.findMany({
      where: { prospectId },
      select: { kind: true, value: true, evidenceIds: true, source: true },
    }),
    prisma.prospectOpportunity.findMany({
      where: { prospectId },
      orderBy: { rank: "asc" },
      select: { capabilityCode: true, rank: true, reason: true, evidenceIds: true, ruleCode: true },
    }),
    prisma.prospectScore.findFirst({
      where: { prospectId },
      orderBy: { computedAt: "desc" },
      select: { score: true, reasons: true, scoringVersion: true },
    }),
  ]);
  return { prospect, capabilities, technologies, inferences, opportunities, score };
}

/**
 * @param payload { prospectId?, phrase? }
 *        `phrase: false` composes the card and calls no model. Not a feature
 *        flag for an unbuilt feature — it is how a re-render after a
 *        capability correction avoids paying for sentences it already has.
 */
export async function handleGenerateResearchBrief({
  task,
  payload = {},
  idempotencyKey = null,
  db: prisma,
  now = new Date(),
  deps = {},
} = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "research_brief: no prospectId on the task or its payload" };
  }

  const inputs = await loadBriefInputs(prisma, prospectId);
  if (!inputs.prospect) {
    return { done: false, retry: false, reason: "research_brief: prospect not found" };
  }

  // The card, with no model involved. Everything after this point can fail
  // without costing the rep anything except adjectives.
  const plain = composeBrief(inputs);
  const slots = phrasingSlots(plain);

  const askModel = deps.complete || complete;
  const checkBudget = deps.checkBudget || checkPlatformAiBudget;
  const recordUsage = deps.recordUsage || recordPlatformAiUsage;

  const notes = [];
  let phrasing = null;

  if (payload.phrase === false) {
    notes.push("phrasing skipped by the task");
  } else {
    const budget = await checkBudget(prisma, { campaignId: inputs.prospect.campaignId, now });
    if (!budget.allowed) {
      // Stop, not warn. The pipeline is unattended overnight by design and a
      // budget that only warns is a budget that gets exceeded.
      notes.push(`no phrasing: ${budget.reason}`);
    } else {
      if (!budget.capped) {
        // Absence of a ceiling reported as absence, never as a ceiling of
        // zero and never silently. Nothing creates a PlatformAiBudget row yet.
        notes.push("no platform AI budget configured — spend recorded, not capped");
      }
      const outcome = await phraseBrief({
        askModel,
        recordUsage,
        prisma,
        prospect: inputs.prospect,
        brief: plain,
        slots,
        idempotencyKey: idempotencyKey || task?.idempotencyKey || null,
      });
      phrasing = outcome.phrasing;
      notes.push(...outcome.notes);
    }
  }

  const brief = phrasing ? composeBrief({ ...inputs, phrasing }) : plain;

  await cacheBrief({ prisma, task, brief, phrasing, model: phrasing?.model ?? null, now });

  return {
    done: true,
    // Returned as well as cached, so a route regenerating a card on demand
    // gets it back rather than having to re-read the row it just wrote.
    brief,
    note: [
      `${brief.known.length} known, ${brief.unknown.length} unknown`,
      `${brief.talkingPoints.length} talking point(s)`,
      brief.phrased ? "phrased" : "plain",
      ...notes,
    ].join("; "),
  };
}

/**
 * One model call, metered, validated, and safe to fail.
 *
 * Returns `{ phrasing, notes }`. `phrasing` is null on every unhappy path and
 * the caller composes the plain card — which is the same card, in the same
 * order, with the same facts.
 */
async function phraseBrief({ askModel, recordUsage, prisma, prospect, brief, slots, idempotencyKey }) {
  const notes = [];
  let usedModel = null;

  const result = await askModel({
    system: PHRASING_SYSTEM,
    prompt: phrasingPrompt(brief, slots),
    maxTokens: BRIEF_MAX_TOKENS,
    schema: briefSchema(slots),
    schemaName: BRIEF_AI_AREA,
    // Metered on the reply the vendor GENERATED, whatever became of it —
    // provider.js calls onUsage before it decides anything about the content,
    // and a refused or mismatched answer cost real money. Recording only the
    // happy path is how a stage that keeps failing shows zero spend.
    onUsage: async ({ model, promptTokens, completionTokens }) => {
      usedModel = model;
      await recordUsage(prisma, {
        area: BRIEF_AI_AREA,
        model,
        promptTokens,
        completionTokens,
        prospectId: prospect.id,
        campaignId: prospect.campaignId ?? null,
        // Null for background pipeline work. A prospect nobody is assigned to
        // still gets a brief — research is org-wide and assignment is a claim
        // made before a call, not a precondition for knowing anything.
        salesRepId: prospect.assignedRepId ?? null,
        ref: idempotencyKey,
      });
    },
  });

  if (!result?.ok) {
    // Every one of these is a real, distinct outcome and the note says which:
    // unconfigured, vendor_error, refused, empty, truncated, unparseable,
    // schema_mismatch, bad_schema. Before provider.js grew them, all eight
    // looked like "the model had nothing to say".
    notes.push(`no phrasing: ${result?.reason || "unknown"}`);
    return { phrasing: null, notes };
  }

  const checked = validatePhrasing(result.data, slots);
  if (checked.problems.length) {
    // Named rather than swallowed. A card that is quietly plainer than it
    // should be is the failure this whole file is arranged against, and the
    // commonest cause — a model writing a number — is a fact about the prompt
    // that somebody should see.
    notes.push(`phrasing rejected: ${checked.problems.join("; ")}`);
  }
  if (!checked.ok) return { phrasing: null, notes };

  return { phrasing: { ...checked.phrasing, model: usedModel }, notes };
}

/**
 * Keep the sentences, on the row that paid for them.
 *
 * Guarded on OUR claim token, exactly as runner.js's `settle` is: a run whose
 * claim went stale while it waited on the vendor has been reclaimed by
 * somebody else, and writing over their payload would erase a task that is
 * currently in flight.
 *
 * Only the phrasing is stored. The card itself is composed from rows every
 * time it is read, so it cannot disagree with them.
 */
async function cacheBrief({ prisma, task, brief, phrasing, model, now }) {
  if (!task?.id) return false;

  const written = await prisma.salesPipelineTask.updateMany({
    where: { id: task.id, claimToken: task.claimToken ?? null },
    data: {
      payload: {
        ...(task.payload && typeof task.payload === "object" ? task.payload : {}),
        brief: {
          version: BRIEF_VERSION,
          generatedAt: now.toISOString(),
          model: model ?? null,
          phrased: brief.phrased,
          // Sentences and nothing else. No facts, no ids, no numbers — those
          // live in the rows and are re-read on every render.
          phrasing: phrasing ? { opening: phrasing.opening, angles: phrasing.angles } : null,
        },
      },
    },
  });

  return written.count === 1;
}

registerHandler(
  "GENERATE_RESEARCH_BRIEF",
  withChain("GENERATE_RESEARCH_BRIEF", async ({ task, payload, idempotencyKey, now, db: prisma }) =>
    handleGenerateResearchBrief({ task, payload, idempotencyKey, now, db: prisma || db }),
  ),
);
