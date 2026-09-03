// lib/ai/platformUsage.js
//
// What FieldQuo's OWN AI spending costs, and the ceiling that stops it.
//
// ══ Why lib/ai/usage.js cannot hold this ═══════════════════════════════════
//
// `AiUsage.companyId` is NOT NULL with an FK to Company, and `recordAiUsage`
// returns null without one — silently. `checkAiQuota` reads a company's plan
// to find a cap. FieldQuo's sales team is not a company and deliberately never
// becomes one (lib/platform/salesCall.js refused to create a Company row for
// exactly this reason, and `PlatformVoiceCall` exists because of it).
//
// So the prospecting pipeline had two choices: spend unmetered, as the
// anonymous Jennifer path already does, or get its own pair of functions in
// the same before/after shape. Unmetered is defensible for one anonymous chat
// turn and indefensible for a loop that runs unattended overnight across a
// thousand businesses — by a wide margin the largest untracked model spend the
// product would have.
//
// The two halves mirror lib/ai/usage.js exactly, on purpose:
//
//   checkPlatformAiBudget()  — BEFORE the call. Refuses when a ceiling is hit.
//   recordPlatformAiUsage()  — AFTER, from the vendor's own token counts.
//
// Its header's sentence is the one that matters and it is just as true here:
// recording after only tells you what you already spent; the check is what
// stops it.
//
// ══ The budget is summed, never read off a cached column ══════════════════
//
// `PlatformAiBudget.cachedSpentMicros` exists for a console to render without
// a scan, and its own schema comment says it is never the thing a spend
// decision is made against. This file honours that: every decision sums
// `PlatformAiUsage`, so the ledger and the ceiling cannot disagree. Keeping
// them in one place is the difference between a budget and a number on a page.
//
// ══ No second pricing table ════════════════════════════════════════════════
//
// `estimateCostMicros` is imported from lib/ai/usage.js rather than re-typed.
// A second copy is the one that rots (AGENTS.md failure class 4), and it would
// rot in the direction that matters: the existing table's own comment records
// that it overstated gpt-5 by roughly double for months.
import { estimateCostMicros } from "./usage";

/** Budget scopes, in the order they are checked. Narrowest first, so the
 *  refusal names the tightest ceiling rather than the loudest one. */
export const BUDGET_SCOPES = Object.freeze(["campaign", "daily", "global"]);

/** Why a call was refused. A closed vocabulary — the shape kpis.js's REASONS
 *  uses — because a note in a task row gets compared, and English does not. */
export const BUDGET_REFUSALS = Object.freeze({
  campaign_budget: "This campaign has spent its AI budget.",
  daily_budget: "FieldQuo's daily AI budget for prospecting is spent.",
  global_budget: "FieldQuo's overall prospecting AI budget is spent.",
});

/** UTC midnight. The same day discipline periodPresets.js keeps and for the
 *  same reason: a "daily" budget built from a server's local clock resets at a
 *  different moment depending on where the lambda ran. */
export function startOfUtcDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * What has been spent against one budget row.
 *
 * A `daily` budget sums today only; `campaign` sums that campaign's whole
 * life; `global` sums everything. Nulls do not count as zero — `costMicros` is
 * nullable precisely because the vendor sometimes gives no figure, and adding
 * it as 0 would report a spend we know we cannot see as a spend of nothing.
 * They are counted separately and reported.
 */
export async function spentAgainst(db, budget, { now = new Date() } = {}) {
  const where =
    budget.scope === "campaign"
      ? { campaignId: budget.scopeId }
      : budget.scope === "daily"
        ? { createdAt: { gte: startOfUtcDay(now) } }
        : {};

  const [sum, unpriced] = await Promise.all([
    db.platformAiUsage.aggregate({ where, _sum: { costMicros: true } }),
    db.platformAiUsage.count({ where: { ...where, costMicros: null } }),
  ]);

  return { micros: Number(sum?._sum?.costMicros) || 0, unpriced: Number(unpriced) || 0 };
}

/**
 * May this pipeline spend on a model right now?
 *
 * @returns { allowed, reason, reasonText, capped, checked: [{scope, limitMicros, spentMicros}] }
 *
 * ── When no budget exists at all ──────────────────────────────────────────
 *
 * Allowed, and `capped: false` says so out loud. Failing closed reads well and
 * is wrong here: there is no screen that creates a `PlatformAiBudget` row yet,
 * so a closed default would mean the pipeline silently never phrases anything
 * and every research brief would be plainer than it should be with nothing
 * saying why. An absent ceiling is reported as an absent ceiling — the caller
 * puts it in the task note — rather than being read as a ceiling of zero.
 * That is the same distinction `getAiCap`'s explicit-null-means-unlimited
 * makes, and the opposite of inventing a limit nobody set.
 */
export async function checkPlatformAiBudget(db, { campaignId = null, now = new Date() } = {}) {
  const budgets = await db.platformAiBudget.findMany({
    where: {
      active: true,
      OR: [
        { scope: "global" },
        { scope: "daily" },
        ...(campaignId ? [{ scope: "campaign", scopeId: campaignId }] : []),
      ],
    },
  });

  const checked = [];
  for (const scope of BUDGET_SCOPES) {
    const budget = budgets.find((b) => b.scope === scope);
    if (!budget) continue;

    const limit = Number(budget.limitMicros);
    if (!Number.isFinite(limit)) continue;

    const spent = await spentAgainst(db, budget, { now });
    checked.push({ scope, limitMicros: limit, spentMicros: spent.micros, unpricedCalls: spent.unpriced });

    if (spent.micros >= limit) {
      const reason = `${scope}_budget`;
      return {
        allowed: false,
        reason,
        reasonText: BUDGET_REFUSALS[reason] || reason,
        capped: true,
        checked,
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    reasonText: null,
    capped: checked.length > 0,
    checked,
  };
}

/**
 * Record what one call actually cost.
 *
 * Never throws, for the same reason `recordAiUsage` never throws: a metering
 * failure must not turn a working answer into an error. The worst case is an
 * under-counted day, which is FieldQuo's problem and not the pipeline's.
 *
 * `ref` is the task's idempotency key and the column is `@unique`, so a
 * reclaimed task that already paid for its call cannot pay for it twice in the
 * ledger. A duplicate returns the existing row rather than throwing — the same
 * treatment enqueuePipelineTask gives a P2002, and for the same reason: a
 * successful dedupe is not a failure.
 */
export async function recordPlatformAiUsage(
  db,
  { area, model, promptTokens = 0, completionTokens = 0, prospectId = null, campaignId = null, salesRepId = null, ref = null } = {},
) {
  if (!area || !model) return null;

  const data = {
    area,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costMicros: estimateCostMicros({ model, promptTokens, completionTokens }),
    prospectId,
    campaignId,
    // Null for background pipeline work, which is what this always is today.
    // The column exists so a rep-triggered regeneration can be told apart from
    // an overnight run when a screen offers one.
    salesRepId,
    ...(ref ? { ref } : {}),
  };

  try {
    return await db.platformAiUsage.create({ data });
  } catch (err) {
    if (err?.code === "P2002" && ref) {
      try {
        return await db.platformAiUsage.findUnique({ where: { ref } });
      } catch {
        return null;
      }
    }
    console.error("[ai/platformUsage] failed to record:", err?.message);
    return null;
  }
}
