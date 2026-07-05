// lib/booking/timezone.js
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

// A schedule's startTime/endTime ("08:00") is a wall-clock time in the WORKER's timezone.
// This turns that into a real UTC Date for a specific calendar day, so it can be compared
// against Booking/Appointment times (which Postgres stores in UTC).
export function scheduleTimeToUtc(dateOnly, timeString, timezone) {
  const [hours, minutes] = timeString.split(":").map(Number);
  const dateStr = dateOnly.toISOString().split("T")[0]; // "2026-07-05"
  const localWallClock = `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return fromZonedTime(localWallClock, timezone);
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
