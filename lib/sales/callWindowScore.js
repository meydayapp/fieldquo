// lib/sales/callWindowScore.js
//
// How good THIS minute is for ringing THIS prospect — a number the queue
// sorts by, in the prospect's own zone.
//
// ══ Where the numbers come from ═══════════════════════════════════════════
//
// Belkins' published cold-calling benchmark, 175,000 dials (the owner's
// source, 2026-09-13): 9.9 % of dials connect, compounding to 24.5 % of
// prospects reached across roughly three attempts. The connect rate is not
// flat across the day or the week —
//
//   by hour, local to the person rung:  3–4 pm is the best hour of the day;
//                                       10–11 am is the second; every other
//                                       open hour is well below both.
//   by weekday:                         Wednesday is the best day; Tuesday
//                                       and Thursday next; Monday behind
//                                       them; Friday the worst working day.
//
// The owner's own funnel agrees with the shape, so the queue orders by it:
// among the rows a rep may ring right now, the one whose local clock is in
// a better hour goes first, and on a better day before a worse one.
//
// ══ What the score is, and is not ═════════════════════════════════════════
//
// A score is computed ONLY for an instant inside the calling window — the
// Canadian B2B default, or the jurisdiction's own when the caller hands one
// in — and is null otherwise. The queue never lets a score promote a row
// the window rule refuses: the rows are filtered by lib/sales/callingRules.js
// salesCallReadiness (window, jurisdiction cap, registration, the platform's
// override — lib/sales/windowPolicy.js) BEFORE they are scored, and this
// file's own window check is the belt to that braces. A jurisdiction's
// 24-hour cap is not a property of the minute and is not scored here; a row
// held by its cap is not callable now and never reaches the sort.
//
// The score is ordinal, not a probability. HOUR × 10 + DAY, with the hour
// tier 3 / 2 / 1 and the day tier 4 / 3 / 2 / 1 / 0, so the hour always
// outranks the day: at one instant the rows a rep is choosing between are
// on the same calendar day in every zone that is open (a day boundary
// inside the window would need a zone twelve hours off), so the day tier
// only ever separates rows when the hour tier already has — and Belkins'
// hour effect is the larger of the two. The chip on the queue row ("Best
// time now") is drawn for the top hour tier only, so it means one thing.
//
// ══ Where it is used ══════════════════════════════════════════════════════
//
//   lib/sales/queueWindows.js   the rep's held list — "Callable now" is
//                               sorted by this before the shuts-soonest key,
//                               after due retries (retryPool.js says why a
//                               due retry stays first).
//   lib/sales/queueBatch.js     selectBatch, the top-up from the pool: the
//                               same key in the same place.
//
// Pure. Executed by scripts/check-call-window-score.mjs: Wednesday 15:30 in
// Toronto outranks Friday 11:00 in Vancouver; a shut window is null; the
// tiers are monotone across a whole week in every zone the table knows.

import { FIELDQUO_COURTESY_WINDOW, jurisdictionFor } from "./callingRules";
import { SALES_CALL_WINDOW, localTimeIn } from "./callingWindow";
import { windowOpenAt } from "./retryRules";

/** The hour tiers, in minutes from local midnight. Half-open: [start, end). */
export const BEST_HOURS = Object.freeze([
  Object.freeze({ startMinute: 15 * 60, endMinute: 16 * 60, tier: 3, label: "3–4 pm" }),
  Object.freeze({ startMinute: 10 * 60, endMinute: 11 * 60, tier: 2, label: "10–11 am" }),
]);
/** Any other open minute. */
export const HOUR_TIER_REST = 1;

/** Sunday = 0 … Saturday = 6. The weekend is the floor, not a working day. */
export const DAY_TIERS = Object.freeze({ 3: 4, 2: 3, 4: 3, 1: 2, 5: 1, 0: 0, 6: 0 });

/** The score at or above which the queue draws "Best time now": the top hour tier on any day. */
export const WINDOW_SCORE_TOP = 3 * 10;

/** The hour tier for a local minute-of-day (0–1439). */
export function hourTierOf(minute) {
  const m = Number(minute);
  if (!Number.isFinite(m)) return null;
  for (const h of BEST_HOURS) {
    if (m >= h.startMinute && m < h.endMinute) return h.tier;
  }
  return HOUR_TIER_REST;
}

/** The day tier for a local weekday (0 = Sunday). */
export function dayTierOf(weekday) {
  return Object.hasOwn(DAY_TIERS, weekday) ? DAY_TIERS[weekday] : null;
}

function zonesOf(timeZone) {
  const list = Array.isArray(timeZone) ? timeZone : [timeZone];
  return list.filter((z) => typeof z === "string" && z.trim());
}

/**
 * The calling window a prospect's row is judged in: the jurisdiction's own
 * when the row has one (a verified-but-unrestricted state gets FieldQuo's
 * courtesy window, the substitution the dial gate makes); the Canadian B2B
 * window for a row with no jurisdiction at all. Never null — shared with
 * lib/sales/retryPool.js so a retry is rolled into the window it is scored in.
 */
export function callingWindowFor(prospect = {}) {
  const j = jurisdictionFor(prospect);
  if (!j) return SALES_CALL_WINDOW;
  return j.window || FIELDQUO_COURTESY_WINDOW;
}

/**
 * The score for ringing at `now` a prospect whose clock is `timeZone`.
 *
 * @param now       the instant.
 * @param timeZone  the PROSPECT's IANA zone (lib/sales/leadTimeZone.js
 *                  resolveLeadTimeZone's answer) — or its candidate zones,
 *                  as an array, for a split subdivision nobody has resolved.
 * @param window    the calling window to honour; the Canadian default, or
 *                  the jurisdiction's own (callingWindowFor).
 * @returns a whole number, higher is better — or null when the window is
 *          shut at this instant, the zone is unusable, or the candidates
 *          disagree. With several candidates the LOWEST score wins: a split
 *          province is ranked by the half it is worse in, never the half it
 *          happens to be best in.
 */
export function windowScore({ now = new Date(), timeZone = null, window = SALES_CALL_WINDOW } = {}) {
  const at = now instanceof Date && !Number.isNaN(now.getTime()) ? now : null;
  if (!at) return null;
  const zones = zonesOf(timeZone);
  if (zones.length === 0) return null;
  if (windowOpenAt(at, zones, window) !== true) return null;
  let best = null;
  for (const zone of zones) {
    const local = localTimeIn(zone, at);
    if (!local) return null;
    const hour = hourTierOf(local.minute);
    const day = dayTierOf(local.weekday);
    if (hour === null || day === null) return null;
    const score = hour * 10 + day;
    if (best === null || score < best) best = score;
  }
  return best;
}

/** Is this score the top hour tier — the one the queue chips as "Best time now"? */
export function isBestTimeNow(score) {
  return Number.isFinite(score) && score >= WINDOW_SCORE_TOP;
}

/**
 * A sort comparator fragment: higher score first, null (shut, unknown)
 * last. Zero when equal, so the caller's next key decides.
 */
export function compareWindowScore(a, b) {
  const sa = Number.isFinite(a) ? a : -1;
  const sb = Number.isFinite(b) ? b : -1;
  return sb - sa;
}
