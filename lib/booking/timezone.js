// lib/booking/timezone.js
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

const pad = (n) => String(n).padStart(2, "0");

// The UTC instant of a wall-clock time on a specific calendar day IN `timezone`.
//
// The primitive every availability grid is built on, and the only place the
// wall-clock→UTC conversion is written. "6pm Eastern" is a different instant in
// July than in January, so a schedule stored as "18:00" has to be resolved
// against the day it lands on, not offset by a constant.
//
// date-fns-tz's fromZonedTime does the DST work. It replaced a hand-rolled
// two-pass Intl offset correction in lib/demo/slots.js; the two were checked
// against each other across 288 half-hourly cases spanning both 2026 and 2027
// Toronto transitions and agreed on every one, so the copy went.
export function zonedWallClockToUtc({ year, month, day, hours, minutes = 0 }, timezone) {
  return fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`,
    timezone,
  );
}

/**
 * What a person MEANT when they typed a time into the office screens.
 *
 * ── The bug this is the fix for ────────────────────────────────────────────
 *
 * `<input type="datetime-local">` yields a naive string — "2026-10-21T18:00",
 * no zone. POST /api/appointments did `new Date(scheduledAt)` on it, and the
 * ECMAScript rule for a date-TIME form with no offset is "parse as local
 * time"… of whatever is running it. In a browser that is the estimator's own
 * timezone and the answer is right. On Vercel the server runs in UTC, so
 * 18:00 became 18:00Z and the calendar drew it back in Toronto as 2:00 PM.
 *
 * The owner booked a visit for 6pm, it saved as 2pm, and he rescheduled it by
 * hand — for the second time, which is how a four-hour constant gets noticed.
 * It was wrong by exactly the company's UTC offset, for every company not on
 * UTC, on every appointment created from the calendar screen.
 *
 * ── Why the server and not only the caller ─────────────────────────────────
 *
 * The obvious fix is `.toISOString()` in the page that sends it, and the
 * sibling screens (SiteVisitPanel, the job's visit form, the calendar's Move
 * dialog) already do exactly that — which is why rescheduling CORRECTED the
 * time that creating it got wrong. But a rule enforced only in five callers
 * is a rule that the sixth breaks, and two of the six were already broken. A
 * naive wall-clock time is ambiguous data arriving at the server, so the
 * server is where it has to be resolved, against the company whose calendar
 * it lands on.
 *
 * An instant that already carries a zone — "…Z", "…+02:00" — is NOT
 * reinterpreted. Those callers have already answered the question.
 *
 * @param value     an ISO instant, or a naive "YYYY-MM-DDTHH:MM[:SS]".
 * @param timezone  the company's IANA zone. Falsy → the string is parsed as
 *                  given, which is the old behaviour and the honest fallback
 *                  for a company that has never set one.
 * @returns Date — possibly Invalid, which the caller still has to check.
 */
export function instantFromWallClock(value, timezone) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(NaN);
  const naive = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!naive || !timezone) return new Date(value);
  const [, year, month, day, hours, minutes, seconds] = naive;
  const at = zonedWallClockToUtc(
    { year: +year, month: +month, day: +day, hours: +hours, minutes: +minutes },
    timezone,
  );
  // Seconds added to the instant rather than passed into the conversion:
  // zonedWallClockToUtc resolves a wall clock to the minute (it is the
  // availability grid's primitive), and seconds never interact with a DST
  // change — a minute is a minute on both sides of one.
  return seconds ? new Date(at.getTime() + Number(seconds) * 1000) : at;
}

// The calendar day a UTC instant falls on IN `timezone`. Month is 1-based, to
// match zonedWallClockToUtc above rather than JS's 0-based Date.
export function zonedYmd(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day };
}

// A schedule's startTime/endTime ("08:00") is a wall-clock time in the WORKER's timezone.
// This turns that into a real UTC Date for a specific calendar day, so it can be compared
// against Booking/Appointment times (which Postgres stores in UTC).
//
// The calendar day is read off `dateOnly` in UTC — that's how computeAvailability
// walks its cursor, and changing it would move every tenant's slots.
export function scheduleTimeToUtc(dateOnly, timeString, timezone) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return zonedWallClockToUtc(
    {
      year: dateOnly.getUTCFullYear(),
      month: dateOnly.getUTCMonth() + 1,
      day: dateOnly.getUTCDate(),
      hours,
      minutes,
    },
    timezone,
  );
}

// Convert a UTC slot (what's stored/returned by the API) into the worker's local wall-clock
// time — useful for admin-side availability screens.
export function utcToWorkerLocal(utcDate, timezone) {
  return toZonedTime(utcDate, timezone);
}

// Format a UTC slot for display in an arbitrary viewer's timezone (the visitor booking,
// not the worker). This is what the public booking page uses.
export function formatSlotForViewer(utcIsoString, viewerTimezone) {
  return formatInTimeZone(
    new Date(utcIsoString),
    viewerTimezone,
    "EEE, MMM d 'at' h:mm a",
  );
}

// Client-side only — detects the browser's timezone so the public booking page can show
// slots in the visitor's own time rather than the company's.
export function getViewerTimezone() {
  if (typeof window === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Groups a flat list of UTC slot strings by calendar date IN THE VIEWER'S timezone —
// otherwise a 9pm slot in Montreal could get bucketed under the wrong day for a visitor
// browsing from Vancouver.
export function groupSlotsByViewerDate(slots, viewerTimezone) {
  const grouped = {};
  for (const isoString of slots) {
    const dateKey = formatInTimeZone(
      new Date(isoString),
      viewerTimezone,
      "yyyy-MM-dd",
    );
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(isoString);
  }
  return grouped;
}
