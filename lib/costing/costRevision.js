// lib/costing/costRevision.js
//
// "This job cost 22% more than you quoted. Update your costing from what it
// really cost?" — and the one rule for when that question is asked.
//
// Pure. No I/O, no React. The owner's refinement (2026-09-08) was that the
// per-line calibration should not be on every close-out: "maybe you spent
// 20% or 15% over the costed price — THEN it can ask the company if they
// want to update their costing based on real expenses, so there's less
// surprises. A small comparison of quoted vs real with a button to update,
// or leave as is."
//
// ══ Over only ═══════════════════════════════════════════════════════════════
//
// A job that came in UNDER its estimate is not asked about, however far
// under. The surprise the owner named is the one that eats the margin — a
// quote that was too cheap. A job that ran cheap is good news, and asking a
// contractor to lower their rates because one kitchen went well is how the
// next kitchen loses money. The comparison is still shown; the question is
// not.
//
// ══ Once ════════════════════════════════════════════════════════════════════
//
// A job records its answer (Job.costRevisionDecision) and is never asked
// again, whichever way it answered. "Leave as is" has to be as final as
// "Update" or the prompt becomes nagging, and nagging gets muted.

export const REVISION_DECISIONS = Object.freeze({
  UPDATED: "updated",
  LEFT_AS_IS: "left_as_is",
});

/** The default the schema ships with, repeated here so the check can pin it. */
export const DEFAULT_REVISION_THRESHOLD_PCT = 15;

/**
 * A decision as the browser sent it → one of the two values, or null.
 *
 * Null for anything else, INCLUDING an empty string: the review route treats
 * "no decision" as "this request did not decide", never as "left as is". The
 * only place completing without choosing counts as leaving it is the modal,
 * which says so on the button and sends the value explicitly.
 */
export function normaliseRevisionDecision(value) {
  return value === REVISION_DECISIONS.UPDATED || value === REVISION_DECISIONS.LEFT_AS_IS
    ? value
    : null;
}

/**
 * A threshold as typed → a whole percent 0–100, or null when it is not one.
 *
 * Refused (null), never clamped: "150" typed into the box is a mistake to
 * report, and rounding it to 100 would store a number the person did not
 * choose and then behave as if they had. Decimals are refused for the same
 * reason — the field says whole number, and 14.5 silently becoming 15 is a
 * control that appears to work and doesn't.
 */
export function normaliseThresholdPct(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
}

/**
 * Should the close-out ask "update your costing?" on this job?
 *
 * @param {object} p
 * @param {number|null} p.variancePct  actual vs estimate, as compareJobCost
 *                                     reports it: positive is OVER
 * @param {number|null} p.thresholdPct the company's setting
 * @param {string|null} p.decision     Job.costRevisionDecision
 * @returns {boolean}
 *
 *   * null variance (no estimate, or nothing recorded) → no. A job with no
 *     budget has not gone over it.
 *   * already decided, either way → no. Asked once.
 *   * exactly AT the threshold → yes. "More than 15% over" in the owner's
 *     sentence and "15% over" in a contractor's head are the same job, and
 *     the setting is a whole percent, so >= is the reading that never makes
 *     a 15.0% overrun fall through the gap between 15 and 16.
 *   * under the estimate → no, however far under. See the file comment.
 */
export function shouldAskRevision({ variancePct, thresholdPct, decision } = {}) {
  if (normaliseRevisionDecision(decision)) return false;
  const v = Number(variancePct);
  if (variancePct === null || variancePct === undefined || !Number.isFinite(v)) return false;
  const threshold = normaliseThresholdPct(thresholdPct);
  if (threshold === null) return false;
  if (v <= 0) return false;
  return v >= threshold;
}
