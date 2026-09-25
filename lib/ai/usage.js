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
//
// Checked July 2026. The gpt-5 figures here were previously $1.25/$10, which
// were the LAUNCH prices — they had since been cut to $0.63/$5 and every cost
// report in the product was overstating by roughly double. If you are reading
// this more than a few months on, assume it has drifted again: re-check before
// quoting any of these numbers to a customer or using them to set a price.
const PRICING = {
  // Current lineup.
  "gpt-5.5": { input: 5.0, output: 30.0 },
  "gpt-5.4": { input: 2.5, output: 15.0 },

  // Superseded, but keep them: AiUsage rows written under an old model must
  // keep costing what they cost. Deleting an entry here would silently reprice
  // history through FALLBACK_PRICING.
  "gpt-5-mini": { input: 0.13, output: 1.0 },
  "gpt-5": { input: 0.63, output: 5.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

// Deliberately pessimistic — nearer a mid-tier model than a mini one. An
// unknown model ID means a number nobody has checked, and a cost estimate that
// reads high gets investigated while one that reads low gets believed.
const FALLBACK_PRICING = { input: 0.5, output: 2.0 };

/** True when this model's cost is a real number rather than the fallback. */
export function hasKnownPricing(model) {
  return Object.hasOwn(PRICING, model);
}

/** The per-million rates for a model, or null when it has none. Read by the
 *  employee settings screen to state a typical cost, and by the check to
 *  prove the best model has a row. Never the fallback — a screen that printed
 *  the fallback as a price would be quoting a number nobody checked. */
export function pricingFor(model) {
  return hasKnownPricing(model) ? { ...PRICING[model] } : null;
}

/**
 * What one AI-employee conversation typically costs on a model, in cents.
 *
 * AN ESTIMATE, and labelled as one wherever it is shown. The token counts are
 * stated here rather than measured per company because the screen shows this
 * BEFORE a company has had a conversation: a system prompt of roughly 2,500
 * tokens plus the company's material, resent on each of about three rounds
 * (a lookup, a booking, the answer), and a few hundred tokens of reply. The
 * result is rounded UP to the cent, the same direction AiEmployeeReply.costCents
 * rounds, so the estimate never reads lower than the bill.
 *
 * Returns null — never 0 — when the model has no known rate, so the screen
 * says "unknown" rather than "free".
 */
export const TYPICAL_CONVERSATION_TOKENS = Object.freeze({ prompt: 9_000, completion: 600 });

export function typicalConversationCostCents(model) {
  if (!hasKnownPricing(model)) return null;
  const micros = estimateCostMicros({
    model,
    promptTokens: TYPICAL_CONVERSATION_TOKENS.prompt,
    completionTokens: TYPICAL_CONVERSATION_TOKENS.completion,
  });
  return Math.ceil(micros / 10_000);
}

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

/** The first instant of the allowance month — the server's own calendar
 *  month, which on Vercel is UTC. Exported so the FieldQuo-paid copilot's
 *  fair-use ceiling (lib/ai/featurePayer.js) resets on the same instant. */
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Tokens and cost this calendar month, optionally split by feature.
 *
 * `allowanceOnly` leaves out the rows the company paid for in dollars from its
 * AI credit (AiUsage.paidFromWallet — the AI employee since 2026-09-25). The
 * cap check passes it; the usage screens do not, so they still show every
 * call the company's account made.
 */
export async function getMonthlyUsage(companyId, { byFeature = false, allowanceOnly = false } = {}) {
  const since = startOfMonth();

  const total = await db.aiUsage.aggregate({
    where: { companyId, createdAt: { gte: since }, ...(allowanceOnly ? { paidFromWallet: false } : {}) },
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
    // Wallet-paid rows are not the allowance's to count — see getMonthlyUsage.
    getMonthlyUsage(companyId, { allowanceOnly: true }),
    getAiCap(companyId),
  ]);
  return allowanceVerdict({ usage, cap, source });
}

/**
 * The allowance decision with no database in it: `usage` ({ tokens }) against
 * `cap`. Split out of checkAiQuota so the FieldQuo-paid copilot's fair-use
 * ceiling (lib/ai/featurePayer.js) refuses with exactly the same words, the
 * same 80% warning and the same reset date — a second copy of these branches
 * is the one that would rot.
 */
export function allowanceVerdict({ usage, cap, source = null, now = new Date() }) {
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
    const resets = new Date(startOfMonth(now));
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
  // Recorded on the FEATURE name rather than a column: adding a column for a
  // number that is 0 on every row but a handful is a schema change earning its
  // keep on none of them. "quote_review" and "quote_review_photos" are two
  // features as far as this table is concerned, which is exactly the
  // comparison anybody asking "what does vision cost us" wants to make.
  imageCount = 0,
  // Paid in dollars from the company's AI credit (see the schema note) — kept
  // on the row so the allowance can leave it out. False for everything else.
  paidFromWallet = false,
}) {
  if (!companyId) return null;

  try {
    return await db.aiUsage.create({
      data: {
        companyId,
        feature: imageCount > 0 ? `${feature}_photos` : feature,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costMicros: estimateCostMicros({ model, promptTokens, completionTokens }),
        userId,
        paidFromWallet: paidFromWallet === true,
      },
    });
  } catch (err) {
    console.error("[ai/usage] failed to record:", err?.message);
    return null;
  }
}
