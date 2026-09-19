// lib/schedule/mapDay.js
//
// The day map's two pure pieces of arithmetic, out of the route so the
// check can run them against hostile input without a session: which
// wall-clock day was asked for, and where that day starts and ends in UTC
// for the company's timezone.

import { zonedWallClockToUtc } from "@/lib/booking/timezone";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

/** How many never-tried appointments one map load may send to Google. */
export const GEOCODE_BACKFILL_CAP = 8;

/** `YYYY-MM-DD` → { year, month, day }, or null for anything else. */
export function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject the 31st of a 30-day month the way Date would not: Date.UTC rolls
  // it into the next month, and a rolled date is a different day's map.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) return null;
  return { year, month, day };
}

/** [midnight, next midnight) of that wall-clock day in `timezone`, UTC. */
export function dayBoundsFor({ year, month, day }, timezone) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const from = zonedWallClockToUtc({ year, month, day, hours: 0, minutes: 0 }, tz);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const to = zonedWallClockToUtc(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hours: 0,
      minutes: 0,
    },
    tz,
  );
  return { from, to };
}
