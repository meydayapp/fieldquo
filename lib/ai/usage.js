// lib/ai/usage.js
//
// Metering and quota for every model call.
//
// The problem this solves: FieldQuo pays OpenAI, the company doesn't. Without
// metering there's no way to know whether AI costs $4 a month or $400, no way
// to attribute a spike, and no ceiling on what a scripted loop against
// /api/ai/copilot could run up on FieldQuo's card.
//
// Two halves:
//
//   checkAiQuota()  — runs BEFORE the call. Refuses if the company is over.
//   recordAiUsage() — runs AFTER, from the provider's own token counts.
//
// Checking before matters more than it looks. Recording after only tells you
// what you already spent; the check is what stops it.

import { db } from "@/lib/db";

// Price per million tokens, in dollars. Kept here rather than fetched because
// a pricing lookup on every call is absurd — but that means this WILL drift
// when OpenAI changes prices, so the cost figures are a good estimate rather
// than an invoice. Token counts are exact; only the dollar conversion ages.
const PRICING = {
  "gpt-5-mini": { input: 0.13, output: 1.0 },
  "gpt-5": { input: 1.25, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

const FALLBACK_PRICING = { input: 0.5, output: 2.0 };

/** Cost in millionths of a dollar. Integers — see the schema comment. */
export function estimateCostMicros({ model, promptTokens, completionTokens }) {
  const p = PRICING[model] || FALLBACK_PRICING;
  const dollars =
    (promptTokens / 1_000_000) * p.input +
    (completionTokens / 1_000_000) * p.output;
  return Math.round(dollars * 1_000_000);
}

export function formatCost(micros) {
  const dollars = (micros || 0) / 1_000_000;
  if (dollars < 0.01) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Tokens and cost this calendar month, optionally split by feature. */
export async function getMonthlyUsage(companyId, { byFeature = false } = {}) {
  const since = startOfMonth();

  const total = await db.aiUsage.aggregate({
    where: { companyId, createdAt: { gte: since } },
    _sum: { totalTokens: true, costMicros: true },
    _count: true,
  });

  const result = {
    tokens: total._sum.totalTokens || 0,
    costMicros: total._sum.costMicros || 0,
    calls: total._count || 0,
    periodStart: since,
  };

  if (!byFeature) return result;

  const grouped = await db.aiUsage.groupBy({
    by: ["feature"],
    where: { companyId, createdAt: { gte: since } },
    _sum: { totalTokens: true, costMicros: true },
    _count: true,
  });

  result.byFeature = grouped
    .map((g) => ({
      feature: g.feature,
      tokens: g._sum.totalTokens || 0,
      costMicros: g._sum.costMicros || 0,
      calls: g._count,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  return result;
}

/**
 * The company's monthly allowance.
 *
 * Company override wins over plan default. Null anywhere means unlimited, but
 * note the ordering: an explicit 0 on the company is NOT null, so "no AI for
 * this tenant" is expressible and survives a plan change.
 */
export async function getAiCap(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      aiMonthlyTokenCap: true,
      subscription: { select: { plan: { select: { aiMonthlyTokenCap: true } } } },
    },
  });

  if (company?.aiMonthlyTokenCap !== null && company?.aiMonthlyTokenCap !== undefined) {
    return { cap: company.aiMonthlyTokenCap, source: "company" };
  }

  const planCap = company?.subscription?.plan?.aiMonthlyTokenCap;
  if (planCap !== null && planCap !== undefined) {
    return { cap: planCap, source: "plan" };
  }

  // No plan and no override — a trial, or a company created by hand. Give a
  // default rather than unlimited: an unmetered trial account is exactly the
  // shape of the abuse this is meant to contain.
  return { cap: DEFAULT_TRIAL_CAP, source: "default" };
}

// ~350 questions a month. Generous for genuine use — a contractor asking
// several questions a day won't come close — and a low ceiling on abuse.
export const DEFAULT_TRIAL_CAP = 750_000;

// Warn before blocking. Someone who hits a wall with no warning experiences a
// broken feature; someone warned at 80% experiences a limit.
export const WARN_THRESHOLD = 0.8;

/**
 * Called before a model request.
 *
 * @returns {{allowed: boolean, reason?: string, usage, cap, remaining, nearLimit}}
 */
export async function checkAiQuota(companyId) {
  const [usage, { cap, source }] = await Promise.all([
    getMonthlyUsage(companyId),
    getAiCap(companyId),
  ]);

  // Explicit null = unlimited. Only reachable by someone deliberately setting
  // it in the platform console.
  if (cap === null) {
    return { allowed: true, usage, cap: null, remaining: null, nearLimit: false };
  }

  if (cap === 0) {
    return {
      allowed: false,
      reason:
        "FieldQuo AI isn't enabled on this account. Contact support if you'd like it turned on.",
      usage,
      cap,
      remaining: 0,
      nearLimit: true,
    };
  }

  const remaining = Math.max(0, cap - usage.tokens);
  const nearLimit = usage.tokens >= cap * WARN_THRESHOLD;

  if (usage.tokens >= cap) {
    const resets = new Date(startOfMonth());
    resets.setMonth(resets.getMonth() + 1);
    return {
      allowed: false,
      reason: `You've used this month's FieldQuo AI allowance. It resets on ${resets.toLocaleDateString("en-CA", { day: "numeric", month: "long" })}. Get in touch if you need more.`,
      usage,
      cap,
      remaining: 0,
      nearLimit: true,
      source,
    };
  }

  return { allowed: true, usage, cap, remaining, nearLimit, source };
}

/**
 * Records what a call actually cost.
 *
 * Never throws. A metering failure must not turn a working answer into an
 * error the user sees — the worst case is an under-counted month, which is a
 * problem for FieldQuo, not for the person who just asked a question.
 */
export async function recordAiUsage({
  companyId,
  feature,
  model,
  promptTokens = 0,
  completionTokens = 0,
  userId = null,
}) {
  if (!companyId) return null;

  try {
    return await db.aiUsage.create({
      data: {
        companyId,
        feature,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costMicros: estimateCostMicros({ model, promptTokens, completionTokens }),
        userId,
      },
    });
  } catch (err) {
    console.error("[ai/usage] failed to record:", err?.message);
    return null;
  }
}
