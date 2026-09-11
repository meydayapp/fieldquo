// lib/sales/calls/stateLedger.js
//
// One rep's day, from the state ledger: how long on calls, how long writing
// them up, how long paused and for which reasons.
//
// ══ The ledger is SalesRepActivity, and there is deliberately no second one ═
//
// This was asked for as a new append-only `SalesAgentStateEvent` table —
// `{ salesRepId, state, reason, at, endedAt }` — written on every transition
// including the automatic ones. That table already exists under another name.
// `SalesRepActivity` (prisma/schema.prisma) is exactly that shape —
// `state`, `pauseReason`, `startedAt`, `endedAt`, `callAttemptId` — and
// lib/sales/calls/store.js's setRepState() is the ONE writer: it closes the
// open row and opens the next in a single transaction, for every transition
// the rep declares (the picker) and every one the call lifecycle makes
// (dial → on_call, hangup → after_call, disposition → available). A second
// table fed by the same function would be two ledgers answering one question,
// and AGENTS.md's fourth failure class — the copy nobody reads is the one that
// rots — applies to tables as much as to code. So this module reads the rows
// that exist.
//
// ══ What summariseDay is, and is not ══════════════════════════════════════
//
// A composition over agentState's activityTotals() and pauseBreakdown(), not
// a reimplementation: those two already clamp every period into the day,
// count the open row up to `now`, and keep an unreadable row out of every
// bucket. What this adds is one shape a screen or a check can consume in one
// call, and tolerance for the event shape the request used (`at` / `reason`),
// so a fixture written that way and a row read from the database summarise
// identically.
//
// `onCallMs` is time between pressing dial and the call ending (or, on the
// handset path, the outcome being logged). It is NOT talk time — see
// agentState's header — and the key says so. The carrier's talk seconds live on
// SalesCallAttempt and lib/sales/calls/reporting.js reports them; the two are
// not merged here because they measure different things.
import {
  STATE_AFTER_CALL,
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
  activityTotals,
  pauseBreakdown,
  isRepState,
} from "./agentState";

/**
 * A ledger row (or a request-shaped event) as activityTotals reads it.
 *
 * `startedAt` wins over `at`, `pauseReason` over `reason`, so a real row is
 * passed through untouched and only a fixture is translated. Anything that is
 * not an object becomes a row with no start, which activityTotals counts as
 * unmeasurable rather than as zero seconds of something.
 */
export function normaliseEvent(event) {
  if (!event || typeof event !== "object") return { state: null, startedAt: null };
  return {
    state: event.state,
    pauseReason: event.pauseReason ?? event.reason ?? null,
    startedAt: event.startedAt ?? event.at ?? null,
    endedAt: event.endedAt ?? null,
    callAttemptId: event.callAttemptId ?? null,
  };
}

/**
 * The day's totals for one rep.
 *
 * @param events  SalesRepActivity rows, or events shaped `{ state, reason, at,
 *                endedAt }`. Order does not matter.
 * @param from    start of the day (null = unbounded).
 * @param to      end of the day, and the instant an unclosed row is measured
 *                up to. Defaults to now.
 *
 * @returns null for input that is not an array. Otherwise every figure in ms:
 *   onCallMs, wrapMs, availableMs, pausedMs, offlineMs, workingMs —
 *   pauseByReason { break: ms, dinner: ms, … } for the whole closed list,
 *   pauseUnattributedMs for paused rows whose reason was unreadable,
 *   unknownMs for periods in a state that is not one, `open` (whether a row
 *   was still open at `to`), `counted` and `ignored` row counts.
 */
export function summariseDay(events, { from = null, to = new Date() } = {}) {
  if (!Array.isArray(events)) return null;
  const rows = events.map(normaliseEvent);

  const totals = activityTotals(rows, { from, to });
  const pauses = pauseBreakdown(rows, { from, to });

  const pauseByReason = {};
  for (const [code, r] of Object.entries(pauses.byReason)) pauseByReason[code] = r.ms;

  const counted = rows.filter((r) => isRepState(r.state) && r.startedAt).length;
  const open = rows.some((r) => r.startedAt && !r.endedAt);

  return {
    from: totals.from,
    to: totals.to,
    onCallMs: totals.totals[STATE_ON_CALL],
    wrapMs: totals.totals[STATE_AFTER_CALL],
    availableMs: totals.totals[STATE_AVAILABLE],
    pausedMs: totals.totals[STATE_PAUSED],
    offlineMs: totals.totals[STATE_OFFLINE],
    workingMs: totals.workingMs,
    pauseByReason,
    pauseUnattributedMs: pauses.unattributedMs,
    unknownMs: totals.unknownMs,
    open,
    counted,
    ignored: rows.length - counted,
  };
}
