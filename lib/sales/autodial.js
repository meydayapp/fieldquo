// lib/sales/autodial.js
//
// The one decision the autodialler makes: what happens next.
//
// ══ Progressive, not predictive — and why that is a compliance decision ═══
//
// A predictive dialler places calls BEFORE a rep is free, betting on how many
// will be answered, and the calls that connect while every rep is busy are
// abandoned — a homeowner or a contractor picks up to silence and a click.
// The TCPA's abandoned-call rule (47 CFR 64.1200(a)(7): no more than 3% of
// answered calls abandoned, measured per campaign per 30 days, with a
// recorded message on every abandon) and the CRTC's Telemarketing Rules (Part
// III, the 5% abandonment ceiling and the requirement to keep the records
// that prove it) make a predictive dialler a regulated apparatus with a
// reporting obligation attached. FieldQuo's sales team is a handful of reps
// working a hundred rows a day; the abandonment machinery would cost more than
// the dialling time it saves, and a miscount is a private right of action.
//
// So this is a PROGRESSIVE dialler, and the discipline is structural rather
// than a setting: it dials one prospect, for the rep who is free, only after
// that rep has finished the previous call AND written it up, and only after a
// visible countdown the rep can cancel. It never dials ahead of the rep,
// never dials two at once, never dials while a call is up, and never starts on
// its own after a pause — coming back from Break is a press of Available.
// Every one of those sentences is a branch below, and
// scripts/check-sales-autodial.mjs executes each of them.
//
// ══ It decides; it does not dial ══════════════════════════════════════════
//
// Pure. Takes what the screen knows and answers with one of three shapes. The
// dial itself happens through the same `place("browser")` the manual Call
// button calls in app/components/sales/CallPanel.js — there is no second
// Twilio call site, and the check asserts that — so the server-side gate
// (window, suppression list, do-not-contact, 24-hour cap, our own numbers)
// runs on an autodialled call exactly as it does on a pressed one. What this
// module reads as `readiness` is the screen's own copy of that decision for
// the prospect about to ring, and a refusal here is a courtesy: the server
// would have refused too, and the screen would have printed the same reason
// after a round trip.

import { STATE_AVAILABLE } from "./calls/agentState";

/**
 * How long the rep has to read the name and press Skip.
 *
 * Five seconds: long enough to read a business name and decide, short enough
 * that a hundred rows do not add eight minutes of waiting to the day. The
 * screen imports this rather than typing a number, so the countdown it draws
 * and the countdown the check asserts are one constant.
 */
export const AUTODIAL_COUNTDOWN_SECONDS = 5;

/** Why the dialler stopped, or skipped a row. Closed list; the screen keys copy off it. */
export const AUTODIAL_REASONS = Object.freeze({
  switch_off: "switch_off",
  call_up: "call_up",
  inbound_ringing: "inbound_ringing",
  not_available: "not_available",
  exhausted: "exhausted",
  no_browser_calling: "no_browser_calling",
  readiness_unknown: "readiness_unknown",
  not_ready: "not_ready",
});

/**
 * What to do next.
 *
 * @param order          the day's dial order, as `{ id, dialled }` rows (or
 *                       bare ids, read as undialled). `dialled` is "has a call
 *                       attempt", so a row the rep rang and got no answer on
 *                       is not rung again by the machine — a retry is the
 *                       rep's decision.
 * @param cursor         the id the countdown is on, or null to start from the
 *                       top. A cursor that is not in the order (a row released
 *                       under it) is read as "resume after the top".
 * @param readiness      `{ decision: "allowed" | anything else, reason }` for
 *                       the CANDIDATE row — the screen's dialSpace() and
 *                       salesCallReadiness() answers, at this moment. Null
 *                       when the screen has not computed it yet.
 * @param state          the rep's presence state.
 * @param switchOn       the rep's persisted autodial switch.
 * @param callUp         a call — outbound or answered inbound — is connected.
 * @param inboundRinging a contractor is ringing this rep right now.
 * @param browserReady   the in-browser call path is usable. The handset path
 *                       leaves the page through a `tel:` link and needs a tap,
 *                       so it cannot be autodialled and the dialler says so
 *                       rather than pretending.
 * @param skipped        ids the rep skipped this session; not offered again.
 *
 * @returns {{ dial: string } | { skip: string, reason: string } | { stop: true, reason: string, state?: string }}
 */
export function nextDial({
  order = [],
  cursor = null,
  readiness = null,
  state = null,
  switchOn = false,
  callUp = false,
  inboundRinging = false,
  browserReady = true,
  skipped = [],
} = {}) {
  const stop = (reason, extra = {}) => ({ stop: true, reason, ...extra });

  // The gates that stop everything come first, in the order a rep would want
  // to hear them: their own switch, then a call that is up, then a call that
  // is arriving, then their own status.
  if (!switchOn) return stop(AUTODIAL_REASONS.switch_off);
  if (callUp) return stop(AUTODIAL_REASONS.call_up);
  if (inboundRinging) return stop(AUTODIAL_REASONS.inbound_ringing);
  // Break, Dinner, Meeting, Training, Off, on a call, writing it up: none of
  // them is available, and the dialler does not argue with a status. Coming
  // back is the rep pressing Available, never the countdown starting itself.
  if (state !== STATE_AVAILABLE) return stop(AUTODIAL_REASONS.not_available, { state: state || null });
  if (!browserReady) return stop(AUTODIAL_REASONS.no_browser_calling);

  const rows = (Array.isArray(order) ? order : [])
    .map((r) => (typeof r === "string" ? { id: r, dialled: false } : r))
    .filter((r) => r && typeof r.id === "string" && r.id);
  const skip = new Set(Array.isArray(skipped) ? skipped : []);
  const candidates = rows.filter((r) => !r.dialled && !skip.has(r.id));

  // The candidate: the cursor itself when it is still undialled, otherwise the
  // first undialled row after the cursor's place — never before it. Dialling
  // backwards would ring a row the rep deliberately skipped past.
  let candidate = null;
  const at = cursor ? rows.findIndex((r) => r.id === cursor) : -1;
  if (at !== -1 && !rows[at].dialled && !skip.has(cursor)) {
    candidate = rows[at];
  } else {
    candidate = candidates.find((r) => rows.indexOf(r) > at) || null;
  }
  if (!candidate) return stop(AUTODIAL_REASONS.exhausted);

  // The candidate is known; may it ring? Only an explicit "allowed" dials.
  // Absence of a decision is not permission — that is AGENTS.md's fifth
  // failure class with a phone attached.
  if (!readiness || typeof readiness !== "object") {
    return { skip: candidate.id, reason: AUTODIAL_REASONS.readiness_unknown };
  }
  if (readiness.decision !== "allowed") {
    return {
      skip: candidate.id,
      reason:
        typeof readiness.reason === "string" && readiness.reason
          ? readiness.reason
          : AUTODIAL_REASONS.not_ready,
    };
  }
  return { dial: candidate.id };
}

/**
 * The next row the countdown should sit on, without deciding whether it may
 * ring. The screen uses this to SELECT the prospect (so its readiness can be
 * computed) before the countdown ends and nextDial() is asked for real.
 */
export function nextCandidate({ order = [], cursor = null, skipped = [] } = {}) {
  const d = nextDial({
    order,
    cursor,
    skipped,
    readiness: { decision: "allowed" },
    state: STATE_AVAILABLE,
    switchOn: true,
    callUp: false,
    inboundRinging: false,
    browserReady: true,
  });
  return d.dial || null;
}
