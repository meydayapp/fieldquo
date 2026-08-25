// lib/scheduling/shiftFit.js
//
// Does this shift fit the person you are giving it to?
//
// Pure — takes the shift and the rows describing the worker, returns a verdict.
// No database, no clock, so it runs against a fixed instant in a check script.
//
// ── Three different questions, three different answers ──────────────────────
//
// The schema already draws the distinctions and nothing was reading them:
//
//   AvailabilitySchedule  when this person CAN work. They set it. Scheduling
//                         outside it is scheduling someone who told you they
//                         are not there — so it REFUSES, but a manager may
//                         override it, because "I'm not usually free then" is
//                         a statement about preference and emergencies are
//                         real. The override is recorded on the shift.
//
//   LeaveRequest          approved time off. Feels like the same thing and is
//                         not: it was asked for and GRANTED. A company that
//                         can OK its way past a holiday it already agreed has
//                         not agreed anything. HARD BLOCK — the way to change
//                         it is to amend the leave, which involves the person
//                         whose day off it is.
//
//   WorkingHours          their normal pattern — Monday to Friday, eight to
//                         four. Working outside it is not an error, it is
//                         Tuesday. Two extra days and a six o'clock start is
//                         the exact case a manager needs to be able to
//                         schedule. WARNS, never blocks.
//
// Getting that last one wrong would be worse than doing nothing: a rota tool
// that refuses the overtime week is a rota tool people stop using.
//
// ── Silence is not a refusal ────────────────────────────────────────────────
//
// A worker who has declared no availability at all does NOT block. We do not
// know when they can work, and inferring "never" from an empty table would
// make every new hire unschedulable on their first day. The verdict says the
// bound is missing instead, so the UI can nudge someone to set it.

import { scheduleTimeToUtc, zonedYmd } from "@/lib/booking/timezone";
import { coversDay } from "@/lib/org/availability";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const asDate = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const VALID_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The local calendar days a shift touches, so an overnight shift is checked on both. */
function localDaysTouched(start, end, timezone) {
  const days = [];
  const seen = new Set();
  // Step by hour rather than by day: a shift shorter than a day can still
  // straddle midnight, and a DST transition makes "add 24 hours" the wrong
  // number twice a year.
  for (let t = start.getTime(); t <= end.getTime(); t += 3600000) {
    const d = new Date(t);
    const { year, month, day } = zonedYmd(d, timezone);
    const key = `${year}-${month}-${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    days.push(new Date(Date.UTC(year, month - 1, day)));
  }
  const { year, month, day } = zonedYmd(end, timezone);
  const key = `${year}-${month}-${day}`;
  if (!seen.has(key)) days.push(new Date(Date.UTC(year, month - 1, day)));
  return days;
}

/** The UTC windows a set of weekly rows opens on one local calendar day. */
function windowsOn(rows, dayUtc, timezone) {
  const dow = dayUtc.getUTCDay();
  const out = [];
  for (const r of rows) {
    if (!r || Number(r.dayOfWeek) !== dow) continue;
    if (
      !VALID_TIME.test(String(r.startTime)) ||
      !VALID_TIME.test(String(r.endTime))
    )
      continue;
    const tz = r.timezone || timezone;
    const from = scheduleTimeToUtc(dayUtc, r.startTime, tz);
    let to = scheduleTimeToUtc(dayUtc, r.endTime, tz);
    // "22:00"–"06:00" is an overnight window, not a negative one.
    if (to <= from) to = new Date(to.getTime() + 86400000);
    out.push({ from, to, label: `${r.startTime}–${r.endTime}` });
  }
  return out;
}

/** Is [start,end] fully inside any one window? Split shifts are separate rows. */
function coveredBy(windows, start, end) {
  return windows.some((w) => start >= w.from && end <= w.to);
}

/**
 * @param {object} input
 * @param {Date|string} input.start
 * @param {Date|string} input.end
 * @param {Array} [input.availability]  AvailabilitySchedule rows for this worker
 * @param {Array} [input.workingHours]  WorkingHours rows for this worker
 * @param {Array} [input.leave]         APPROVED LeaveRequest rows only
 * @param {string} [input.timezone]
 * @returns {{ok:boolean, blocks:string[], overridable:string[],
 *            canOverride:boolean, warnings:string[], notes:string[]}}
 *          `ok` false means refuse. `canOverride` true means a manager may go
 *          ahead anyway and the shift will carry the record of it. Warnings
 *          never make `ok` false.
 */
export function shiftFit({
  start,
  end,
  availability = [],
  workingHours = [],
  leave = [],
  timezone = "America/Toronto",
} = {}) {
  const s = asDate(start);
  const e = asDate(end);
  const blocks = [];
  // Refusals a manager may knowingly go past. Kept in their OWN list, not
  // flagged inside `blocks`, so a caller offering an override cannot let an
  // approved holiday through the same door by mistake.
  const overridable = [];
  const warnings = [];
  const notes = [];
  const verdict = () => ({
    ok: blocks.length === 0 && overridable.length === 0,
    blocks,
    overridable,
    canOverride: blocks.length === 0 && overridable.length > 0,
    warnings,
    notes,
  });

  if (!s || !e) {
    blocks.push("A shift needs a start and an end.");
    return verdict();
  }
  if (e <= s) {
    blocks.push("The shift's end must be after its start.");
    return verdict();
  }

  const avail = Array.isArray(availability) ? availability.filter(Boolean) : [];
  const hours = Array.isArray(workingHours) ? workingHours.filter(Boolean) : [];
  const leaves = Array.isArray(leave) ? leave.filter(Boolean) : [];

  const days = localDaysTouched(s, e, timezone);

  // ── Approved leave. Asked for, granted, and now being scheduled over. ────
  for (const day of days) {
    const off = leaves.find((l) => coversDay(l, day));
    if (off) {
      blocks.push(
        `They have approved time off on ${DAY_NAMES[day.getUTCDay()]} ${day.toISOString().slice(0, 10)}.`,
      );
      break;
    }
  }

  // ── Declared availability, the outer bound. ──────────────────────────────
  if (avail.length === 0) {
    notes.push(
      "They haven't said when they're available, so nothing here is checked against it.",
    );
  } else {
    const windows = days.flatMap((d) => windowsOn(avail, d, timezone));
    if (windows.length === 0) {
      overridable.push(
        `They aren't available on ${days.map((d) => DAY_NAMES[d.getUTCDay()]).join(" or ")}.`,
      );
    } else if (!coveredBy(windows, s, e)) {
      overridable.push(
        `That's outside the hours they said they're available (${windows.map((w) => w.label).join(", ")}).`,
      );
    }
  }

  // ── Their normal pattern. A difference is information, not an error. ─────
  if (hours.length > 0) {
    const windows = days.flatMap((d) => windowsOn(hours, d, timezone));
    if (windows.length === 0) {
      warnings.push(
        `${DAY_NAMES[days[0].getUTCDay()]} isn't one of their usual days.`,
      );
    } else if (!coveredBy(windows, s, e)) {
      warnings.push(
        `Outside their usual ${windows.map((w) => w.label).join(", ")}.`,
      );
    }
  } else {
    notes.push(
      "They have no working hours set, so there's no usual pattern to compare against.",
    );
  }

  return verdict();
}

/** Workers with no WorkingHours rows — what the reminder banner counts. */
export function workersMissingHours(workers = [], hoursByUserId = {}) {
  const list = Array.isArray(workers) ? workers.filter(Boolean) : [];
  return list.filter((w) => {
    // A worker with no linked user account cannot HAVE working hours, so they
    // are not missing them — counting them would make the banner permanent and
    // therefore invisible.
    if (!w.userId) return false;
    const rows = hoursByUserId[w.userId];
    return !Array.isArray(rows) || rows.length === 0;
  });
}
