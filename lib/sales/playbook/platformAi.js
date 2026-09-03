// lib/sales/playbook/platformAi.js
//
// FieldQuo's OWN model spend — the ceiling `checkAiQuota` cannot provide.
//
// ══ Why this is not lib/ai/usage.js ═══════════════════════════════════════
//
// `AiUsage.companyId` is NOT NULL and `recordAiUsage` returns null without
// one, so every existing meter in this product is tenant-scoped. Prospecting
// has no tenant: FieldQuo is the customer, and FieldQuo has no plan for
// `getAiCap` to read. `PlatformAiUsage` and `PlatformAiBudget` were added for
// exactly this and — checked before writing this file — nothing read or wrote
// either of them. This is their first consumer.
//
// ══ Where this file belongs, and why it is here for now ═══════════════════
//
// Nothing about it is playbook-specific; the schema comment names four areas
// ("prospect_analysis", "research_brief", "call_summary", "coaching") and the
// playbook is one. It belongs at lib/ai/platformUsage.js beside its tenant
// twin. It is here because it has one caller, and a shared module written for
// one caller is a guess about the second. Move it when the second arrives —
// the exports are already named for that destination.
//
// ══ The budget is a STOP, and it is checked from the ledger ═══════════════
//
// `PlatformAiBudget.cachedSpentMicros` is a cached read for the console and is
// deliberately NOT what a spend decision is made against — its own schema
// comment says so. Every check below sums `PlatformAiUsage` fresh, on the same
// discipline as `canWrite()` in lib/migrations/state.js: the state at the
// moment of the write is the only state that matters, and an overnight
// unattended pipeline is precisely where a stale cache spends real money.
//
// ══ An unpriced model is reported, never estimated into the total ═════════
//
// `costMicros` is written only when `hasKnownPricing(model)` — the schema's own
// comment says null is not zero and means nothing invented a figure.
// `FALLBACK_PRICING` in lib/ai/usage.js is a deliberately pessimistic guess for
// a model nobody has checked, and a guess summed into a ceiling that STOPS a
// pipeline would stop it for a reason that is not true. So unpriced calls are
// counted and surfaced as their own number, and a budget screen showing "412
// calls, 38 of them on a model with no checked price" is the honest version of
// a total that would otherwise quietly be wrong.
import { db } from "@/lib/db";
import { estimateCostMicros, hasKnownPricing } from "@/lib/ai/usage";

/** The areas this file will meter. Free-text in the column; a closed list here. */
export const PLATFORM_AI_AREAS = Object.freeze([
  "prospect_analysis",
  "research_brief",
  "call_summary",
  "coaching",
  "playbook_talking_points",
]);

/** Why a platform AI call was refused before it was made. */
export const BUDGET_REFUSALS = Object.freeze({
  over_budget: "The platform AI budget for this scope is spent.",
});

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Every active budget that applies, with what has actually been spent under it.
 *
 * @param {{campaignId?: string|null, now?: Date}} args
 * @returns {Promise<Array<{scope, scopeId, limitMicros, spentMicros, unpricedCalls, exceeded}>>}
 */
export async function platformAiBudgetState({ campaignId = null, now = new Date() } = {}) {
  const budgets = await db.platformAiBudget.findMany({
    where: {
      active: true,
      OR: [
        { scope: "global", scopeId: null },
        { scope: "daily", scopeId: null },
        ...(campaignId ? [{ scope: "campaign", scopeId: campaignId }] : []),
      ],
    },
  });

  const out = [];
  for (const b of budgets) {
    const where =
      b.scope === "daily"
        ? { createdAt: { gte: startOfUtcDay(now) } }
        : b.scope === "campaign"
          ? { campaignId: b.scopeId }
          : {};

    const [priced, unpriced] = await Promise.all([
      db.platformAiUsage.aggregate({ where, _sum: { costMicros: true } }),
      db.platformAiUsage.count({ where: { ...where, costMicros: null } }),
    ]);

    const spentMicros = priced._sum.costMicros || 0;
    out.push({
      scope: b.scope,
      scopeId: b.scopeId,
      limitMicros: b.limitMicros,
      spentMicros,
      unpricedCalls: unpriced,
      exceeded: spentMicros >= b.limitMicros,
    });
  }
  return out;
}

/**
 * Runs BEFORE the call, like checkAiQuota. Refuses rather than warns.
 *
 * No budget rows at all means no ceiling, which is the state this deployment
 * is in until somebody sets one. That is reported (`unbudgeted: true`) rather
 * than hidden, because "there is no ceiling" and "we are under the ceiling"
 * are different facts and only one of them is comfortable.
 */
export async function checkPlatformAiBudget({ campaignId = null, now = new Date() } = {}) {
  let budgets;
  try {
    budgets = await platformAiBudgetState({ campaignId, now });
  } catch (err) {
    // A budget lookup that throws must not be read as "under budget". Fail
    // closed: FieldQuo pays for this, and an unattended overnight pipeline is
    // the worst possible place to guess.
    return {
      ok: false,
      unbudgeted: false,
      reason: "budget_unreadable",
      message: `The platform AI budget could not be read: ${err?.message || "unknown error"}`,
      budgets: [],
    };
  }

  const blocking = budgets.find((b) => b.exceeded);
  if (blocking) {
    return {
      ok: false,
      unbudgeted: false,
      reason: "over_budget",
      message: BUDGET_REFUSALS.over_budget,
      blocking,
      budgets,
    };
  }

  return { ok: true, unbudgeted: budgets.length === 0, reason: null, budgets };
}

/**
 * Runs AFTER, from the provider's own token counts.
 *
 * `ref` is the idempotency key the schema asks for: a retried pipeline task
 * hands the same one and the unique index turns the second write into a
 * no-op instead of double-counting spend against a ceiling.
 */
export async function recordPlatformAiUsage({
  area,
  model,
  usage,
  prospectId = null,
  campaignId = null,
  salesRepId = null,
  ref = null,
}) {
  if (!area || !model || !usage) return null;

  const promptTokens = Number(usage.promptTokens ?? usage.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(usage.completionTokens ?? usage.completion_tokens ?? 0) || 0;
  const totalTokens =
    Number(usage.totalTokens ?? usage.total_tokens ?? 0) || promptTokens + completionTokens;

  const data = {
    area,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    costMicros: hasKnownPricing(model)
      ? estimateCostMicros({ model, promptTokens, completionTokens })
      : null,
    prospectId,
    campaignId,
    salesRepId,
    ref,
  };

  try {
    if (!ref) return await db.platformAiUsage.create({ data });
    // upsert rather than create-and-swallow: the second attempt has to be a
    // no-op, not an error that a caller might log as a failed call.
    return await db.platformAiUsage.upsert({ where: { ref }, create: data, update: {} });
  } catch (err) {
    // Metering must never take down the thing it is measuring — the same
    // decision recordAiUsage makes, for the same reason.
    console.error("[platform-ai] usage not recorded:", err?.message);
    return null;
  }
}
