// lib/dailySheets/day.js
//
// A daily sheet is keyed by a calendar DAY in the company's timezone, and
// its clock stamps are the TimeEntry rows that began in that day. Both
// questions are answered here, from the same helpers the time clock uses
// (lib/timeclock/jobChoices.js dayBoundsInZone), so "today" on the sheet is
// "today" on the clock.
//
// The Date column stores UTC midnight of the calendar date ("2026-09-23" →
// 2026-09-23T00:00:00Z) and is only ever compared as a date.

import { dayBoundsInZone } from "@/lib/timeclock/jobChoices";
import { zonedYmd } from "@/lib/booking/timezone";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-23" → the Date the column stores; null for anything else. */
export function dateKeyToColumn(key) {
  if (typeof key !== "string") return null;
  const m = YMD.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  // Reject the 31st of February — Date.UTC would roll it into March.
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d;
}

/** The column's Date → "2026-09-23". */
export function columnToDateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

/** Today's key where the company is. */
export function todayKey(timezone, now = new Date()) {
  const { year, month, day } = zonedYmd(now, timezone || DEFAULT_TIMEZONE);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The instants a company-local calendar day spans. TimeEntry rows with
 * clockIn in [start, next) belong to that day's sheet.
 */
export function dayInstants(dateKey, timezone) {
  const col = dateKeyToColumn(dateKey);
  if (!col) return null;
  // Noon UTC of that date is inside the same calendar day in every zone
  // from UTC-11 to UTC+12, so dayBoundsInZone lands on the right day.
  const noon = new Date(col.getTime() + 12 * 60 * 60 * 1000);
  return dayBoundsInZone(noon, timezone || DEFAULT_TIMEZONE);
}

/** Monday of the week containing the key, as a key. */
export function weekStartKey(dateKey) {
  const col = dateKeyToColumn(dateKey);
  if (!col) return null;
  const dow = col.getUTCDay(); // 0 Sunday
  const back = (dow + 6) % 7;
  return columnToDateKey(new Date(col.getTime() - back * 86400000));
}

/** The seven keys of the week starting at a Monday key. */
export function weekKeys(mondayKey) {
  const col = dateKeyToColumn(mondayKey);
  if (!col) return [];
  return Array.from({ length: 7 }, (_, i) => columnToDateKey(new Date(col.getTime() + i * 86400000)));
}
