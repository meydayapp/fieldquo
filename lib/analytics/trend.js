// lib/analytics/trend.js
//
// Comparing this period to the last, honestly.
//
// The reason this is its own small pure module: the moment a dashboard or an AI
// digest says "up from last month", it has made a factual claim, and if the
// prior number wasn't actually computed the model will cheerfully invent one.
// So the rule here is that a comparison only exists when BOTH periods are real
// data — `prior == null` yields no trend, not a fabricated baseline.
//
// Pure. Feed it two numbers and it tells you the direction and the delta, or
// tells you it can't.

/**
 * Compare a current value to a prior one.
 *
 * @param current  this period
 * @param prior    last period — null/undefined when there IS no comparable
 *                 prior period (a company's first month), which is not the same
 *                 as a prior of zero.
 * @param {object} opts
 *   flatBand   within ±this fraction reads as "flat" rather than a jittery
 *              up/down on noise. Default 2%.
 * @returns null when no honest comparison can be made, else:
 *   { direction: "up"|"down"|"flat", deltaAbs, deltaPct|null, prior, current }
 *
 * `deltaPct` is null when prior is 0 — you can't express "up from nothing" as a
 * percentage, and "∞%" or a divide-by-zero is worse than an honest absence.
 */
export function compare(current, prior, { flatBand = 0.02 } = {}) {
  const c = Number(current);
  if (!Number.isFinite(c)) return null;
  if (prior == null) return null; // no prior period — no claim
  const p = Number(prior);
  if (!Number.isFinite(p)) return null;

  const deltaAbs = c - p;
  const deltaPct = p === 0 ? null : deltaAbs / p;

  let direction = "flat";
  if (p === 0) {
    // From zero: any positive is up, exactly zero stays flat. No percentage.
    direction = c > 0 ? "up" : "flat";
  } else if (Math.abs(deltaAbs) / Math.abs(p) > flatBand) {
    direction = deltaAbs > 0 ? "up" : "down";
  }

  return { direction, deltaAbs, deltaPct, prior: p, current: c };
}

/**
 * A short human phrase for a rate comparison, or null.
 *
 * "up from 31% last month" / "down from 48%" / "about the same as last month".
 * Returns null when there's no comparison — the caller then simply omits the
 * clause rather than writing "up from last month" with nothing behind it.
 *
 * @param currentRate / priorRate  as fractions (0.43), rendered as whole %.
 */
export function describeRateTrend(currentRate, priorRate, { period = "last month" } = {}) {
  const t = compare(currentRate, priorRate);
  if (!t) return null;
  const priorPct = Math.round(t.prior * 100);
  if (t.direction === "flat") return `about the same as ${period}`;
  const word = t.direction === "up" ? "up" : "down";
  return `${word} from ${priorPct}% ${period}`;
}
