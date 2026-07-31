// lib/analytics/goal.js
//
// A yearly revenue target, and where the company stands against it.
//
// ══ Everything is derived from one number ══════════════════════════════════
//
// The owner sets an annual goal and nothing else. Monthly, weekly and daily
// targets are computed here, never stored — a stored monthly target is one more
// number that drifts from the annual one the moment somebody edits either. One
// source, many views.
//
// ══ "Expected by now" is the honest measure ════════════════════════════════
//
// "You've made $180k of a $500k goal" means nothing without the date — 36% is
// triumphant in April and a disaster in November. So the real signal is
// revenue-to-date against what a steady pace WOULD have produced by today, and
// the card leads with that: ahead or behind, in dollars, not just a bar
// crawling toward a year-end number.
//
// Pure. No database, no clock of its own — the caller passes `now`, so the same
// function runs in a test against December 31st and against a leap year.

/** Days in the year `d` falls in — 366 in a leap year, because the maths must not drift by a day. */
function daysInYear(d) {
  const y = d.getUTCFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return leap ? 366 : 365;
}

/** 1 on Jan 1, up to 365/366. UTC throughout so a timezone can't move the boundary. */
function dayOfYear(d) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((today - start) / 86400000) + 1;
}

/**
 * The steady-pace targets implied by an annual goal.
 *
 * Weekly uses 52, not 52.14 — a contractor plans in 52 weeks, and the tiny
 * remainder is noise next to how lumpy real weeks are. Monthly is the annual
 * over 12, flat: seasonality is real, but inventing a seasonal curve here would
 * be a model nobody asked for and can't check.
 *
 * @returns null when there's no usable goal, so callers render nothing rather
 *          than a target of zero.
 */
export function deriveTargets(annualGoal) {
  const annual = Number(annualGoal);
  if (!Number.isFinite(annual) || annual <= 0) return null;
  return {
    annual,
    monthly: annual / 12,
    weekly: annual / 52,
    daily: annual / 365,
  };
}

/**
 * Where the company stands, today.
 *
 * @param {number|null} annualGoal
 * @param {number}      revenueYtd   money actually recorded so far this year
 * @param {Date}        now
 * @returns null with no goal; otherwise a full picture:
 *
 *   { targets, revenueYtd, expectedByNow, aheadBy, onPace,
 *     percentOfGoal, percentOfExpected, projectedYearEnd, projectedVsGoal,
 *     fractionOfYearElapsed }
 *
 * `aheadBy` is signed — negative means behind — so the UI states a number
 * ("$22k behind pace") rather than a colour nobody can act on.
 */
export function goalProgress({ annualGoal, revenueYtd = 0, now = new Date() } = {}) {
  const targets = deriveTargets(annualGoal);
  if (!targets) return null;

  const ytd = Math.max(0, Number(revenueYtd) || 0);
  const totalDays = daysInYear(now);
  const elapsed = Math.min(totalDays, Math.max(1, dayOfYear(now)));
  const fractionOfYearElapsed = elapsed / totalDays;

  const expectedByNow = targets.annual * fractionOfYearElapsed;
  const aheadBy = ytd - expectedByNow;

  // Projection: hold the current daily rate for the rest of the year. Unstable
  // in the first days of January (a big first job projects to a wild number),
  // so it's clamped to non-negative and the UI is told how much of the year has
  // actually elapsed — a projection off 4 days of data deserves a quiet label,
  // not a headline.
  const projectedYearEnd = ytd / fractionOfYearElapsed;

  return {
    targets,
    revenueYtd: ytd,
    expectedByNow,
    aheadBy,
    // A small tolerance band so "on pace" isn't a knife-edge that flickers
    // between ahead and behind on every sale. Within 2% of expected reads as
    // on track, which is what it is.
    onPace: Math.abs(aheadBy) <= expectedByNow * 0.02,
    percentOfGoal: targets.annual > 0 ? ytd / targets.annual : 0,
    percentOfExpected: expectedByNow > 0 ? ytd / expectedByNow : 0,
    projectedYearEnd,
    projectedVsGoal: projectedYearEnd - targets.annual,
    fractionOfYearElapsed,
  };
}

/** Clamp a submitted goal to something sane. Zero/blank clears it (no goal). */
export function normaliseGoal(input) {
  if (input === null || input === "" || input === undefined) return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  // A ceiling that's absurd for a 1–20 person trade shop, so a fat-fingered
  // extra zero is caught rather than stored and quietly making every target
  // impossible.
  return Math.min(100_000_000, Math.round(n));
}
