// lib/time/wallClock.js
//
// "09:00 on the 20th" → the actual instant that was, in the company's timezone.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The manual timesheet form sent its two ends through two different paths:
//
//   clockIn   "2026-08-20T09:00"                          (naive, no suffix)
//   clockOut  new Date("2026-08-20T17:00").toISOString()  (browser-local → UTC)
//
// A naive datetime string is resolved against whatever the *runtime's* local
// zone is — UTC on Vercel — while `.toISOString()` on the client resolved
// against the browser's. So one end kept its wall-clock digits and the other
// got shifted, and every manual entry came out inflated by exactly the UTC
// offset: 09:00–17:00 stored as 12 hours, not 8.
//
// That went straight into a pay run at 50% over. Approved hours are the input
// to payroll and to job costing, and nothing downstream re-checks them, so a
// wrong number here is money out the door.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// A wall-clock time typed into the app is wall-clock in the COMPANY's zone,
// resolved on the SERVER. Not the browser's zone — an owner entering a crew's
// hours from an airport lounge in Vancouver is recording Toronto hours, and
// reading the browser would silently rewrite them. Not the server's zone
// either, which is an accident of hosting.
//
// The conversion itself is not reimplemented here. zonedWallClockToUtc is the
// one place that maths is written; it handles DST by resolving against the day
// the time actually lands on, which a fixed offset cannot.

import { zonedWallClockToUtc } from "@/lib/booking/timezone";

/// Matches "2026-08-20T09:00" and "2026-08-20T09:00:00" — a date and a time
/// with NO zone designator. Anything carrying a `Z` or a `±hh:mm` is already an
/// unambiguous instant and must be left alone: that's the clock-in/clock-out
/// path, which is server-stamped and correct.
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/// The schema's own default. Company.timezone is nullable, and a company that
/// has never opened the settings screen has no stated zone — this is the same
/// value Postgres would have written, not an invented one.
export const DEFAULT_TIMEZONE = "America/Toronto";

/**
 * Turn a client-supplied datetime into a real instant.
 *
 * Naive strings are resolved in `timezone`. Strings that already carry a zone,
 * and Date objects, pass through untouched. Returns null for anything
 * unparseable rather than an Invalid Date, so a caller cannot write NaN into a
 * timestamp column and find out at payroll time.
 */
export function resolveWallClock(value, timezone) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const m = NAIVE.exec(value.trim());
  if (m) {
    const utc = zonedWallClockToUtc(
      {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
        hours: Number(m[4]),
        minutes: Number(m[5]),
      },
      timezone || DEFAULT_TIMEZONE,
    );
    // Seconds are dropped by the primitive (it takes hours/minutes only).
    // Manual entry never sends them; adding them back keeps a caller that does
    // from silently losing precision.
    if (utc && m[6]) utc.setUTCSeconds(Number(m[6]));
    return utc && !Number.isNaN(utc.getTime()) ? utc : null;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True if `value` is a wall-clock string that needs a zone to mean anything. */
export function isNaiveWallClock(value) {
  return typeof value === "string" && NAIVE.test(value.trim());
}
