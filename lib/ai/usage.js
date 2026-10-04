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
import { DEFAULT_TRIAL_CAP, MICROS_PER_CENT } from "./allowanceMath";

export { DEFAULT_TRIAL_CAP, MICROS_PER_CENT, tokensToCents, blendedMicrosPerMillion } from "./allowanceMath";

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
//
// `cachedInput` is the rate for the part of a prompt the vendor served from
// its prompt cache — a tenth of the input rate across the GPT-5 family. Only
// a call that REPORTS cached tokens (provider.js's onUsage `cachedTokens`) is
// priced with it; a row without them costs exactly what it always did.
const PRICING = {
  // Current lineup.
  "gpt-5.5": { input: 5.0, output: 30.0, cachedInput: 0.5 },
  "gpt-5.4": { input: 2.5, output: 15.0, cachedInput: 0.25 },

  // Superseded, but keep them: AiUsage rows written under an old model must
  // keep costing what they cost. Deleting an entry here would silently reprice
  // history through FALLBACK_PRICING.
  "gpt-5-mini": { input: 0.13, output: 1.0, cachedInput: 0.013 },
  "gpt-5": { input: 0.63, output: 5.0, cachedInput: 0.063 },
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

/**
 * Cost in millionths of a dollar. Integers — see the schema comment.
 *
 * `cachedTokens` is the cached SUBSET of promptTokens (never more than it),
 * priced at the model's cachedInput rate when it has one. Absent or 0, the
 * arithmetic is exactly what it was before caching was counted.
 */
export function estimateCostMicros({ model, promptTokens, completionTokens, cachedTokens = 0 }) {
  const p = PRICING[model] || FALLBACK_PRICING;
  const prompt = Number(promptTokens) || 0;
  const cached = Math.min(prompt, Math.max(0, Number(cachedTokens) || 0));
  const cachedRate = typeof p.cachedInput === "number" ? p.cachedInput : p.input;
  const dollars =
    ((prompt - cached) / 1_000_000) * p.input +
    (cached / 1_000_000) * cachedRate +
    ((Number(completionTokens) || 0) / 1_000_000) * p.output;
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
 * The company's monthly allowance — in DOLLARS when the plan says so, in
 * tokens otherwise.
 *
 * ══ Why dollars (owner-approved, 2026-10-03) ═══════════════════════════════
 *
 * A token is not a price. A gpt-5.5 token costs FieldQuo ~40× a gpt-5-mini
 * token and used to spend the same allowance, so a cap set to protect the
 * bill protected nothing once a feature moved to the best model. A plan can
 * now carry Plan.aiMonthlyAllowanceCents, and the allowance is then compared
 * against AiUsage.costMicros — what the calls actually cost at the PRICING
 * table above, cached input at a tenth of the input rate — rather than
 * against tokens.
 *
 * ══ Nothing changes until a plan row says so ═══════════════════════════════
 *
 * The order, first statement wins:
 *
 *   1. Company.aiMonthlyTokenCap   a per-company override set on
 *                                  /platform/ai-usage (tokens, as before).
 *   2. Plan.aiMonthlyAllowanceCents the plan's DOLLAR allowance (new; null
 *                                  on every row until set on
 *                                  /platform/billing/plans).
 *   3. Plan.aiMonthlyTokenCap      the plan's token cap, as before.
 *   4. DEFAULT_TRIAL_CAP           750,000 tokens, as before.
 *
 * So every company gets exactly what it got yesterday until a superadmin
 * types a dollar figure on a plan. Note what "null" has always meant here,
 * because the schema comment said otherwise: a plan with a NULL token cap
 * does NOT give unlimited AI — it falls through to DEFAULT_TRIAL_CAP. That is
 * what this code did before dollars existed and it still does; making null
 * mean unlimited would raise FieldQuo's spend, which is the owner's call.
 * An explicit 0 (tokens or cents) still means "no AI for this account".
 *
 * PURE — `company` is the row shape getAiCap selects, so the platform's
 * usage table resolves a cap with the very same function.
 *
 * @returns {{ cap: number|null, unit: "dollars"|"tokens", source: string }}
 *   `cap` is in MICROS (millionths of a dollar) when unit is "dollars", the
 *   same unit as AiUsage.costMicros, so the comparison is integer to integer.
 */
export function resolveAiCap(company) {
  const own = readCount(company?.aiMonthlyTokenCap);
  if (own !== null) return { cap: Math.max(0, Math.floor(own)), unit: "tokens", source: "company" };
  const plan = company?.subscription?.plan || null;
  const cents = readCount(plan?.aiMonthlyAllowanceCents);
  if (cents !== null) {
    return { cap: Math.max(0, Math.round(cents)) * MICROS_PER_CENT, unit: "dollars", source: "plan" };
  }
  const planCap = readCount(plan?.aiMonthlyTokenCap);
  if (planCap !== null) return { cap: Math.max(0, Math.floor(planCap)), unit: "tokens", source: "plan" };
  // No plan and no override — a trial, or a company created by hand. Give a
  // default rather than unlimited: an unmetered trial account is exactly the
  // shape of the abuse this is meant to contain.
  return { cap: DEFAULT_TRIAL_CAP, unit: "tokens", source: "default" };
}

// A column value as a number, or null for "not set". Only a real number or a
// numeric string counts: Number(null), Number("") and Number([]) are all 0,
// and 0 here means "no AI" — so a value that merely coerces to 0 must read
// as absent, never as a statement.
function readCount(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
}

/** The select resolveAiCap reads. One copy, used by getAiCap and the platform. */
export const AI_CAP_SELECT = {
  aiMonthlyTokenCap: true,
  subscription: { select: { plan: { select: { name: true, aiMonthlyTokenCap: true, aiMonthlyAllowanceCents: true } } } },
};

export async function getAiCap(companyId) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: AI_CAP_SELECT });
  return resolveAiCap(company);
}


// DEFAULT_TRIAL_CAP (750,000 tokens) lives in ./allowanceMath.js with the
// other database-free arithmetic, so a client screen can read it; it is
// re-exported above under the name every caller already imports.

// Warn before blocking. Someone who hits a wall with no warning experiences a
// broken feature; someone warned at 80% experiences a limit.
export const WARN_THRESHOLD = 0.8;

/**
 * Called before a model request.
 *
 * @returns {{allowed: boolean, reason?: string, usage, cap, remaining, nearLimit}}
 */
export async function checkAiQuota(companyId) {
  const [usage, { cap, unit, source }] = await Promise.all([
    // Wallet-paid rows are not the allowance's to count — see getMonthlyUsage.
    getMonthlyUsage(companyId, { allowanceOnly: true }),
    getAiCap(companyId),
  ]);
  return allowanceVerdict({ usage, cap, unit, source });
}

/**
 * The allowance decision with no database in it: `usage` ({ tokens,
 * costMicros }) against `cap`, in `unit`. Split out of checkAiQuota so the
 * FieldQuo-paid copilot's fair-use ceiling (lib/ai/featurePayer.js) refuses
 * with exactly the same words, the same 80% warning and the same reset date —
 * a second copy of these branches is the one that would rot.
 *
 * THE one place the unit is decided: "dollars" measures usage.costMicros
 * against a cap in micros, "tokens" measures usage.tokens against a cap in
 * tokens. `used` comes back in the same unit, so a screen computing a
 * percentage divides like by like.
 */
export function allowanceVerdict({ usage, cap, unit = "tokens", source = null, now = new Date() }) {
  const dollars = unit === "dollars";
  // Number(undefined) is NaN; a missing figure counts as nothing used rather
  // than poisoning every comparison below into "allowed".
  const measured = Number(dollars ? usage?.costMicros : usage?.tokens);
  const used = Number.isFinite(measured) && measured > 0 ? measured : 0;
  const base = { usage, unit: dollars ? "dollars" : "tokens", used, source };

  // Explicit null = unlimited. Not reachable through getAiCap (null falls
  // through to the default — see resolveAiCap); kept for a caller that
  // decides the cap itself.
  if (cap === null) {
    return { ...base, allowed: true, cap: null, remaining: null, nearLimit: false };
  }

  if (cap === 0) {
    return {
      ...base,
      allowed: false,
      reason:
        "FieldQuo AI isn't enabled on this account. Contact support if you'd like it turned on.",
      cap,
      remaining: 0,
      nearLimit: true,
    };
  }

  const remaining = Math.max(0, cap - used);
  const nearLimit = used >= cap * WARN_THRESHOLD;

  if (used >= cap) {
    const resets = new Date(startOfMonth(now));
    resets.setMonth(resets.getMonth() + 1);
    return {
      ...base,
      allowed: false,
      reason: `You've used this month's FieldQuo AI allowance. It resets on ${resets.toLocaleDateString("en-CA", { day: "numeric", month: "long" })}. Get in touch if you need more.`,
      cap,
      remaining: 0,
      nearLimit: true,
    };
  }

  return { ...base, allowed: true, cap, remaining, nearLimit };
}

/**
 * What a verdict says to the company's screens, in one shape: "$X of $Y" when
 * the allowance is in dollars, and the dollars spent plus a percentage when it
 * is still in tokens (a token cap has no honest dollar ceiling to print). PURE.
 * Null when the account is uncapped — the screen then says nothing rather
 * than inventing a ceiling.
 */
export function allowanceDisplay(verdict) {
  if (!verdict || verdict.cap === null || verdict.cap === undefined) return null;
  const cap = Number(verdict.cap);
  const used = Number(verdict.used) || 0;
  const spentMicros = Number(verdict.usage?.costMicros);
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 100;
  return {
    unit: verdict.unit === "dollars" ? "dollars" : "tokens",
    used,
    cap,
    pct,
    nearLimit: Boolean(verdict.nearLimit),
    // Dollars, as cents, for "$X of $Y". capCents only for a dollar cap.
    usedCents: Number.isFinite(spentMicros) ? Math.round(Math.max(0, spentMicros) / MICROS_PER_CENT) : null,
    capCents: verdict.unit === "dollars" ? Math.round(cap / MICROS_PER_CENT) : null,
  };
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
  // The cached subset of promptTokens, when the call reported one — prices
  // that part at the cached rate. Not a column; it only changes costMicros.
  cachedTokens = 0,
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
        costMicros: estimateCostMicros({ model, promptTokens, completionTokens, cachedTokens }),
        userId,
        paidFromWallet: paidFromWallet === true,
      },
    });
  } catch (err) {
    console.error("[ai/usage] failed to record:", err?.message);
    return null;
  }
}
