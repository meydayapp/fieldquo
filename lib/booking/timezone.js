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
