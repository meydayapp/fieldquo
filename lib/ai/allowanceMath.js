// lib/ai/allowanceMath.js
//
// The arithmetic of the AI allowance with no database in it, so a "use client"
// screen (/platform/billing/plans converts a plan's token cap to dollars) can
// import it without pulling lib/db into the browser bundle. lib/ai/usage.js
// re-exports every name here; the gate itself lives there.

// ~350 questions a month. Generous for genuine use — a contractor asking
// several questions a day won't come close — and a low ceiling on abuse.
export const DEFAULT_TRIAL_CAP = 750_000;

/** AiUsage.costMicros is millionths of a dollar; a cent is 10,000 of them. */
export const MICROS_PER_CENT = 10_000;

/**
 * Tokens → US cents at a blended rate, for the platform's conversion column
 * ("250,000 tokens ≈ US$0.05"). PURE. `microsPerMillion` is what one million
 * tokens actually cost across a period's AiUsage rows (sum of costMicros ÷ sum
 * of tokens × 1e6) — measured, so the figure moves with the real model mix
 * instead of a guess. Null when either input is unusable — never a $0.00 that
 * would read as "free".
 */
export function tokensToCents(tokens, microsPerMillion) {
  if (tokens === null || tokens === undefined || microsPerMillion === null || microsPerMillion === undefined) return null;
  const t = Number(tokens);
  const rate = Number(microsPerMillion);
  if (!Number.isFinite(t) || t < 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(((t / 1_000_000) * rate) / MICROS_PER_CENT);
}

/** The measured blended rate, micros per million tokens, or null with no data. */
export function blendedMicrosPerMillion({ tokens, costMicros } = {}) {
  if (tokens === null || tokens === undefined || costMicros === null || costMicros === undefined) return null;
  const t = Number(tokens);
  const c = Number(costMicros);
  if (!Number.isFinite(t) || !Number.isFinite(c) || t <= 0 || c < 0) return null;
  return Math.round((c / t) * 1_000_000);
}
