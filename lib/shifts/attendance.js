// lib/shifts/attendance.js
//
// Did the person turn up when the rota said? Pure — no database, no clock of
// its own — so scripts/check-shift-notify.mjs executes every rule below
// against the cases that go wrong (a punch two minutes late, a punch an hour
// before, a clock-out at 15:44 on a 16:00 shift, no punch at all before the
// grace ran out, no punch at all with the shift still hours away).
//
// The cron (app/api/cron/time-clock-watch) calls attendanceFor once per
// published shift on the current day and stores the answer as a
// ShiftAttendance row; the day board, the timesheet and the worker's page in
// Manage Team read that row. Nothing here decides pay: a late flag is a fact
// for the manager to read, not a deduction.
//
// ══ Thresholds are POLICY, not arithmetic ══════════════════════════════════
//
// Ten minutes late, an hour to call a no-show, fifteen minutes early out —
// these are the numbers Homebase and most crews use, and they are wrong for
// somebody. They live here as named constants so that the day they become a
// company setting (Settings → Time clock) there is one place to read them
// from and one function that takes them as an argument. attendanceFor already
// accepts an `thresholds` override for exactly that reason; the cron passes
// none today.

/** Minutes after the scheduled start before a first punch counts as late. */
export const LATE_AFTER_MIN = 10;
/** Minutes after the scheduled start with no punch at all before it is a no-show. */
export const NO_SHOW_AFTER_MIN = 60;
/** Minutes before the scheduled end for a clock-out to count as early. */
export const EARLY_OUT_BEFORE_MIN = 15;
/** Minutes after a published shift ended before an entry still open is "forgotten". */
export const FORGOT_CLOCK_OUT_AFTER_SHIFT_MIN = 30;
/** Hours an entry with NO shift behind it may stay open before it is "forgotten". */
export const FORGOT_CLOCK_OUT_NO_SHIFT_HOURS = 14;

export const DEFAULT_THRESHOLDS = Object.freeze({
  lateAfterMin: LATE_AFTER_MIN,
  noShowAfterMin: NO_SHOW_AFTER_MIN,
  earlyOutBeforeMin: EARLY_OUT_BEFORE_MIN,
  forgotAfterShiftMin: FORGOT_CLOCK_OUT_AFTER_SHIFT_MIN,
  forgotNoShiftHours: FORGOT_CLOCK_OUT_NO_SHIFT_HOURS,
});

/** The closed vocabulary ShiftAttendance.status holds. */
export const ATTENDANCE_STATUSES = Object.freeze(["on_time", "late", "no_show", "early_out", "pending"]);

const MIN_MS = 60_000;

function ms(v) {
  if (v == null) return NaN;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  return new Date(v).getTime();
}

/**
 * How far around a shift a punch still belongs to it. A clock-in at 6:40 for
 * an 8:00 shift is that shift's punch (early, and on time); one at 22:00 the
 * night before is somebody else's day. Six hours either side is wide enough
 * for any real early start and narrow enough not to swallow the previous
 * shift on a split day.
 */
export const PUNCH_WINDOW_MS = 6 * 3_600_000;

/**
 * The time entries that belong to one shift: any entry whose clock-in falls
 * inside the punch window around the shift, ordered by clock-in.
 */
export function entriesForShift(shift, entries) {
  const start = ms(shift?.start);
  const end = ms(shift?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => e && String(e.workerId) === String(shift.workerId))
    .filter((e) => {
      const at = ms(e.clockIn);
      return Number.isFinite(at) && at >= start - PUNCH_WINDOW_MS && at <= end + PUNCH_WINDOW_MS;
    })
    .sort((a, b) => ms(a.clockIn) - ms(b.clockIn));
}

/**
 * The attendance verdict for one published shift.
 *
 * @param {object} p
 * @param {object} p.shift     { workerId, start, end }
 * @param {Array}  p.entries   the worker's TimeEntry rows near the shift
 *                             ({ workerId, clockIn, clockOut })
 * @param {Date|number} p.now
 * @param {object} [p.thresholds]
 * @returns {{
 *   status: "on_time"|"late"|"no_show"|"early_out"|"pending",
 *   final: boolean,            no later cron run can change it
 *   firstPunchAt: Date|null,
 *   lastPunchOutAt: Date|null,
 *   lateMinutes: number,       0 unless late
 *   earlyMinutes: number,      0 unless early_out
 * }}
 *
 * "pending" is the honest answer before anything can be said: the shift has
 * not started, or it started less than the grace ago and nobody has punched
 * yet. A row is not written for it — absence of a verdict is not a verdict
 * (AGENTS.md failure class 5).
 *
 * Precedence when more than one thing is true: a no-show beats everything (no
 * punch at all); otherwise `late` beats `early_out` — the manager wants the
 * one fact that happened first, and both minutes are on the row regardless.
 */
export function attendanceFor({ shift, entries, now, thresholds } = {}) {
  const th = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const start = ms(shift?.start);
  const end = ms(shift?.end);
  const at = ms(now);
  const none = {
    status: "pending",
    final: false,
    firstPunchAt: null,
    lastPunchOutAt: null,
    lateMinutes: 0,
    earlyMinutes: 0,
  };
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(at) || end <= start) return none;

  const mine = entriesForShift(shift, entries);
  const first = mine[0] || null;

  if (!first) {
    // Nobody punched. Before the grace runs out that is "not yet"; after it,
    // a no-show — and a no-show is FINAL only once the shift has ended,
    // because a punch at 9:30 for an 8:00 shift turns it into "late", not a
    // no-show that happened to end.
    if (at < start + th.noShowAfterMin * MIN_MS) return none;
    return { ...none, status: "no_show", final: at >= end };
  }

  const firstIn = ms(first.clockIn);
  const lateMinutes = Math.max(0, Math.round((firstIn - start) / MIN_MS));
  const late = lateMinutes > th.lateAfterMin;

  // The clock-out that closed the day: the latest closed entry's clockOut.
  // An entry still open means the person is (as far as the clock knows) on
  // site, so early-out cannot be judged yet.
  const closed = mine.filter((e) => e.clockOut != null);
  const stillOpen = mine.some((e) => e.clockOut == null);
  const lastOut = closed.length ? Math.max(...closed.map((e) => ms(e.clockOut))) : null;
  const earlyMinutes =
    !stillOpen && lastOut != null ? Math.max(0, Math.round((end - lastOut) / MIN_MS)) : 0;
  const earlyOut = !stillOpen && lastOut != null && earlyMinutes > th.earlyOutBeforeMin;

  // Final once the shift is over and the person is off the clock — nothing
  // that happens afterwards belongs to this shift. While an entry is open
  // past the end, the verdict can still move (they may clock out at 16:02 and
  // make an on-time day), so it stays provisional.
  const final = at >= end && !stillOpen;

  const status = late ? "late" : earlyOut ? "early_out" : "on_time";
  return {
    status,
    final,
    firstPunchAt: new Date(firstIn),
    lastPunchOutAt: lastOut != null ? new Date(lastOut) : null,
    lateMinutes: late ? lateMinutes : 0,
    earlyMinutes: earlyOut ? earlyMinutes : 0,
  };
}

/**
 * Has this open time entry outlived its shift (or its plausible day)?
 *
 * @param {object} p
 * @param {object} p.entry   { clockIn, clockOut: null }
 * @param {object} [p.shift] the worker's published shift the entry belongs
 *                           to, when there is one ({ start, end })
 * @param {Date|number} p.now
 * @returns {{ forgotten: boolean, reason: "after_shift"|"no_shift"|null }}
 *
 * Never closes anything. Whether the person really left at 16:00 or worked
 * until 19:00 is a pay question, and a cron that answers it by writing a
 * clock-out invents hours or removes them. It only decides whether to ask.
 */
export function forgottenClockOut({ entry, shift, now, thresholds } = {}) {
  const th = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const at = ms(now);
  const inAt = ms(entry?.clockIn);
  if (!entry || entry.clockOut != null || !Number.isFinite(at) || !Number.isFinite(inAt)) {
    return { forgotten: false, reason: null };
  }
  const end = ms(shift?.end);
  if (Number.isFinite(end)) {
    return at >= end + th.forgotAfterShiftMin * MIN_MS
      ? { forgotten: true, reason: "after_shift" }
      : { forgotten: false, reason: null };
  }
  return at - inAt >= th.forgotNoShiftHours * 3_600_000
    ? { forgotten: true, reason: "no_shift" }
    : { forgotten: false, reason: null };
}

/**
 * The published shift an open entry belongs to, if any: among this worker's
 * shifts whose punch window contains the clock-in, the one the clock-in is
 * INSIDE (distance 0), else the nearest — so a 22:10 punch on a day with a
 * 12–20 shift and a 22–04 shift belongs to the evening one, not to the
 * afternoon one whose window happens to reach it.
 */
export function shiftForEntry(entry, shifts) {
  const inAt = ms(entry?.clockIn);
  if (!Number.isFinite(inAt)) return null;
  const distance = (s) => {
    const start = ms(s.start);
    const end = ms(s.end);
    if (inAt >= start && inAt <= end) return 0;
    return inAt < start ? start - inAt : inAt - end;
  };
  const candidates = (Array.isArray(shifts) ? shifts : [])
    .filter((s) => s && String(s.workerId) === String(entry.workerId))
    .filter((s) => {
      const start = ms(s.start);
      const end = ms(s.end);
      return Number.isFinite(start) && Number.isFinite(end) && inAt >= start - PUNCH_WINDOW_MS && inAt <= end + PUNCH_WINDOW_MS;
    })
    .sort((a, b) => distance(a) - distance(b) || ms(a.end) - ms(b.end));
  return candidates[0] || null;
}

/**
 * A 30-day summary for one person: how many of each verdict. Only FINAL rows
 * count — a provisional "late" at 8:12 that becomes the day's verdict at
 * 16:00 is the same fact, and counting it twice or early would overstate.
 */
export function summariseAttendance(rows) {
  const out = { total: 0, on_time: 0, late: 0, no_show: 0, early_out: 0 };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || r.final !== true) continue;
    if (!(r.status in out)) continue;
    out.total += 1;
    out[r.status] += 1;
  }
  return out;
}
