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
// ══ It walks the grouped order, and waits at a window rather than crossing it
//
// The order the screen hands in is lib/sales/queueWindows.js's: callable-now
// rows first (shuts soonest first), then one group per opening instant, then
// what cannot be rung today. A row in an "opens at" group carries that
// instant as `opensAt`, and the dialler treats it as a wall, not a row: when
// every callable row is done it does NOT count down five seconds and dial
// into the eleven o'clock group at ten — it answers `wait`, naming the
// instant and how many rows open then, and the screen shows a countdown to
// THAT. When the instant arrives the screen asks again, through the same
// gates, and only a rep who is still Available with the switch still on gets
// a countdown; a rep who paused in the meantime gets nothing until they
// press Available, which is the rule below for every other resumption.
//
// ══ The cursor: after it first, then from the top — never "exhausted" while a
//    row is left ════════════════════════════════════════════════════════════
//
// Until 2026-09-11 the dialler never looked at a row before the cursor: a
// list in fixed claim order made "before the cursor" mean "the rep went past
// it", and dialling backwards would have rung a row they had chosen to leave.
// The list is now regrouped by the clock on every reload — a row moves from
// "opens at 11:00" into "callable now" at eleven, and the row the rep just
// finished can land behind it — so a position no longer records a choice.
// The rep's choices are the two things that DO survive a regroup: a Skip
// (the `skipped` list) and a dial (the `dialled` flag). So the walk still
// prefers rows after the cursor, and when none of those can be rung or
// waited for it continues from the top, rather than declaring a day with
// callable rows in it finished.
//
// ══ It decides; it does not dial ══════════════════════════════════════════
//
// Pure. Takes what the screen knows and answers with one of four shapes. The
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

/** Why the dialler stopped, skipped a row, or is waiting. Closed list; the screen keys copy off it. */
export const AUTODIAL_REASONS = Object.freeze({
  switch_off: "switch_off",
  call_up: "call_up",
  inbound_ringing: "inbound_ringing",
  not_available: "not_available",
  exhausted: "exhausted",
  no_browser_calling: "no_browser_calling",
  readiness_unknown: "readiness_unknown",
  not_ready: "not_ready",
  window_not_open: "window_not_open",
});

/** A row's opening instant as ms, or null when it has none (callable now, or never). */
function opensAtMs(row) {
  const v = row?.opensAt;
  if (v == null || v === false) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const parsed = Date.parse(v);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * What to do next.
 *
 * @param order          the day's dial order, as `{ id, dialled, opensAt }`
 *                       rows (or bare ids, read as undialled and callable).
 *                       `dialled` is "has a call attempt", so a row the rep
 *                       rang and got no answer on is not rung again by the
 *                       machine — a retry is the rep's decision. `opensAt`
 *                       is the instant the row's window opens (ms, ISO or
 *                       Date) for a row that is not callable yet, null for
 *                       one that is; the screen copies it from the queue
 *                       route's per-row window.
 * @param cursor         the id the countdown is on, or null to start from the
 *                       top. A cursor that is not in the order (a row released
 *                       under it) is read as "resume after the top".
 * @param now            the clock the windows are judged against — the
 *                       screen's server-corrected one, never the laptop's
 *                       alone.
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
 * @returns {{ dial: string } | { skip: string, reason: string } | { stop: true, reason: string, state?: string }
 *           | { wait: string, reason: string, opensAt: number, count: number }}
 *          `wait` names the first row of the group that opens next, the
 *          instant it opens, and how many undialled rows open with it.
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
  now = Date.now(),
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
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const clock = Number.isFinite(nowMs) ? nowMs : Date.now();

  // The candidate: the cursor itself when it is still undialled, otherwise the
  // first undialled, unskipped row after the cursor's place — and, when
  // nothing after it is left, the first such row before it (the header says
  // why the walk wraps). The walk stops at the first row it meets that is
  // either callable now or has an opening instant still ahead: a row that
  // opens later is a wall, not something to step over on the way to a row
  // that can never be rung.
  const at = cursor ? rows.findIndex((r) => r.id === cursor) : -1;
  const after = rows.slice(at + 1);
  const before = at > 0 ? rows.slice(0, at) : [];
  const cursorRow = at !== -1 && !rows[at].dialled && !skip.has(cursor) ? [rows[at]] : [];
  const walk = [...cursorRow, ...after, ...before].filter((r) => !r.dialled && !skip.has(r.id));
  const candidate = walk[0] || null;
  if (!candidate) return stop(AUTODIAL_REASONS.exhausted);

  const opens = opensAtMs(candidate);
  if (opens !== null && opens > clock) {
    // Nothing callable before this row, and it is not open yet: wait for it,
    // with everything that opens at the same instant counted alongside.
    const count = walk.filter((r) => opensAtMs(r) === opens).length;
    return { wait: candidate.id, reason: AUTODIAL_REASONS.window_not_open, opensAt: opens, count };
  }

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
export function nextCandidate({ order = [], cursor = null, skipped = [], now = Date.now() } = {}) {
  const d = nextDial({
    order,
    cursor,
    skipped,
    now,
    readiness: { decision: "allowed" },
    state: STATE_AVAILABLE,
    switchOn: true,
    callUp: false,
    inboundRinging: false,
    browserReady: true,
  });
  return d.dial || null;
}
