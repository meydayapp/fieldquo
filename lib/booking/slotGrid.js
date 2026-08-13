// lib/booking/slotGrid.js
//
// The pure slot grid: weekly windows + a date range + what's already busy →
// candidate slot starts, grouped by local day. No database, no clock of its
// own, no defaults that invent a window nobody stated.
//
// ── Why this exists separately from computeAvailability.js ──────────────────
//
// computeAvailability is tenant-scoped by construction: it takes an
// eventType.userId and queries Booking, Appointment and LeaveRequest, all of
// which hang off a Company. FieldQuo's own sales calendar has none of those —
// it is DemoBooking, hosted by a PlatformAdmin, which is a different table from
// User with its own credentials. Two callers needed the same maths and nothing
// else, so the maths moved here and the I/O stayed where it belongs.
//
// computeAvailability has NOT been refactored onto this. It is live,
// tenant-facing, and carries travel-time and leave rules this primitive has no
// concept of; rewriting it to prove a point would risk a homeowner's booking
// page for no user-visible gain. If it is ever changed for its own reasons,
// this is the shape to move it toward.
//
// ── Absence of a window is absence of availability ─────────────────────────
//
// No windows means no slots. Not "the usual hours", not "9–5 as a sensible
// default". A caller that wants a fallback has to state it as data, because a
// grid this file invented would be published to a stranger as though somebody
// had promised it.
import { zonedWallClockToUtc, zonedYmd } from "@/lib/booking/timezone";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "18:30" → 1110 minutes past local midnight. null when it isn't a time. */
function minutesOfDay(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  // 24:00 is a legitimate way to say "end of day"; anything past it is not.
  if (hours > 24 || minutes > 59 || hours * 60 + minutes > 24 * 60) return null;
  return hours * 60 + minutes;
}

/**
 * A window is usable only if it says something complete and coherent. A row
 * whose end is at or before its start states nothing a slot can live in, so it
 * contributes nothing — as opposed to being "corrected" into some assumed
 * duration, which would publish hours the row never claimed.
 */
function normaliseWindow(w) {
  const dayOfWeek = Number(w?.dayOfWeek);
  const start = minutesOfDay(w?.startTime);
  const end = minutesOfDay(w?.endTime);
  const timezone = typeof w?.timezone === "string" ? w.timezone.trim() : "";
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
  if (start === null || end === null || end <= start) return null;
  if (!timezone) return null;
  return { dayOfWeek, start, end, timezone };
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local calendar day → its own day-of-week (0 = Sunday), read in `timezone`. */
function dayOfWeekIn({ year, month, day }, timezone) {
  // Noon local: far enough from either midnight that a DST shift can't move the
  // instant onto the neighbouring date.
  const noon = zonedWallClockToUtc({ year, month, day, hours: 12 }, timezone);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(noon);
  return WEEKDAY_INDEX[label] ?? -1;
}

/** ISO day key ("2026-08-10") for a UTC instant, read in `timezone`. */
export function dayKeyIn(date, timezone) {
  const { year, month, day } = zonedYmd(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Candidate slot starts, grouped by local day.
 *
 * @param {object}   opts
 * @param {Array}    opts.windows      [{ dayOfWeek, startTime, endTime, timezone }]
 *                                     Each window's dayOfWeek and wall-clock
 *                                     times are read in its OWN timezone, so
 *                                     hosts in different zones compose.
 * @param {Date}     opts.from         Range start, inclusive.
 * @param {Date}     opts.to           Range end, exclusive.
 * @param {number}   opts.slotMinutes  Slot length. A slot must END by the
 *                                     window's close to be offered.
 * @param {number}  [opts.stepMinutes] Gap between consecutive starts. Defaults
 *                                     to slotMinutes (back-to-back slots).
 * @param {number}  [opts.leadMs]      Nothing starting within this long of
 *                                     `now` is offered.
 * @param {Date}    [opts.now]
 * @param {Array}   [opts.busy]        [{ start, end }] — anything overlapping a
 *                                     slot removes it.
 * @param {string}   opts.timezone     The zone the returned day keys are in.
 *                                     Grouping, not generation: this is what
 *                                     the viewer sees a day as.
 * @returns {Array<{ day: string, starts: Date[] }>} ascending, empty days
 *          omitted, no duplicate instants even where two windows overlap.
 */
export function slotGrid({
  windows,
  from,
  to,
  slotMinutes,
  stepMinutes,
  leadMs = 0,
  now = new Date(),
  busy = [],
  timezone,
}) {
  const usable = (Array.isArray(windows) ? windows : [])
    .map(normaliseWindow)
    .filter(Boolean);
  if (usable.length === 0) return [];

  const slotMs = Number(slotMinutes) * 60000;
  const stepMs = Number(stepMinutes ?? slotMinutes) * 60000;
  if (!(slotMs > 0) || !(stepMs > 0)) return [];

  const fromMs = from instanceof Date ? from.getTime() : Number(from);
  const toMs = to instanceof Date ? to.getTime() : Number(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];

  // The lead time is a floor on top of the range, never a replacement for it.
  const earliest = Math.max(fromMs, now.getTime() + Number(leadMs || 0));

  const busyRanges = (Array.isArray(busy) ? busy : [])
    .map((b) => ({
      start: b?.start instanceof Date ? b.start.getTime() : Number(b?.start),
      end: b?.end instanceof Date ? b.end.getTime() : Number(b?.end),
    }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);

  const starts = new Set();

  for (const window of usable) {
    // Walk local calendar dates in the WINDOW's timezone, with a day of slack
    // either side: a host in Vancouver can have a Tuesday-evening window whose
    // instants land on a Wednesday in the grouping zone, and vice versa.
    let cursor = zonedYmd(new Date(fromMs - DAY_MS), window.timezone);
    const last = zonedYmd(new Date(toMs + DAY_MS), window.timezone);
    const lastKey = last.year * 10000 + last.month * 100 + last.day;

    for (let guard = 0; guard < 400; guard++) {
      const key = cursor.year * 10000 + cursor.month * 100 + cursor.day;
      if (key > lastKey) break;

      if (dayOfWeekIn(cursor, window.timezone) === window.dayOfWeek) {
        const dayOpen = zonedWallClockToUtc(
          { ...cursor, hours: Math.floor(window.start / 60), minutes: window.start % 60 },
          window.timezone,
        ).getTime();
        // 24:00 has no wall-clock representation on its own day, so the close
        // is expressed as an offset from the open. That also keeps a window
        // that spans a DST transition the length it claims to be: 01:00–05:00
        // on a spring-forward day is three real hours, not four.
        const dayClose = zonedWallClockToUtc(
          { ...cursor, hours: Math.floor(window.end / 60) % 24, minutes: window.end % 60 },
          window.timezone,
        ).getTime() + (window.end === 24 * 60 ? DAY_MS : 0);

        for (let t = dayOpen; t + slotMs <= dayClose; t += stepMs) {
          if (t < earliest || t >= toMs) continue;
          const slotEnd = t + slotMs;
          if (busyRanges.some((b) => t < b.end && slotEnd > b.start)) continue;
          starts.add(t);
        }
      }

      // Step a day by re-reading the local date at local noon + 24h, so a DST
      // day never skips or repeats a date.
      const noonNext = zonedWallClockToUtc({ ...cursor, hours: 12 }, window.timezone).getTime() + DAY_MS;
      cursor = zonedYmd(new Date(noonNext), window.timezone);
    }
  }

  const byDay = new Map();
  for (const t of [...starts].sort((a, b) => a - b)) {
    const date = new Date(t);
    const day = dayKeyIn(date, timezone);
    if (!byDay.has(day)) byDay.set(day, { day, starts: [] });
    byDay.get(day).starts.push(date);
  }
  return [...byDay.values()];
}

/** Flat, chronological list of the same starts. */
export function slotStarts(options) {
  return slotGrid(options).flatMap((d) => d.starts);
}
