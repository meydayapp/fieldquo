// lib/receipts/time.js
//
// When a receipt says it was — as an instant, in the company's own timezone.
//
// ══ Why the company's timezone, and not the phone's or the server's ═══════
//
// A till prints wall-clock time where the till is. The product has no store
// timezone, and the nearest honest stand-in is the company's own
// (Company.timezone): a contractor in Ottawa buys in Ottawa. The server runs in
// UTC on Vercel and the phone that uploads may be anywhere, so either would put
// a 7:40 AM receipt on the wrong side of a 7:55 clock-in for half the year.
//
// ══ A day without a time is not an instant ═════════════════════════════════
//
// No time printed → no instant. Noon is not substituted: an invented noon
// would sit inside most clock-in windows of that day and turn "we don't know
// when" into "Dana was clocked in", which is the padding failure AGENTS.md
// names. The scoring in lib/receipts/suggest.js treats a day-only receipt as
// its own, weaker case.
import { zonedWallClockToUtc } from "@/lib/booking/timezone";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^(\d{2}):(\d{2})$/;

/** The fallback when a company never set one — the schema's own default. */
export const DEFAULT_TIMEZONE = "America/Toronto";

function validZone(tz) {
  if (!tz || typeof tz !== "string") return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * The instant a receipt's printed date + time names, or null.
 *
 * @param dateIso  "YYYY-MM-DD", already round-trip-checked by normaliseExtraction
 * @param time     "HH:MM", already checked by normaliseTime
 */
export function purchaseInstant(dateIso, time, timezone) {
  const d = typeof dateIso === "string" ? dateIso.match(ISO_DATE) : null;
  const t = typeof time === "string" ? time.match(HHMM) : null;
  if (!d || !t) return null;
  const at = zonedWallClockToUtc(
    { year: +d[1], month: +d[2], day: +d[3], hours: +t[1], minutes: +t[2] },
    validZone(timezone),
  );
  return Number.isFinite(at?.getTime?.()) ? at : null;
}

/**
 * The UTC window a calendar day covers IN the company's timezone —
 * [start, end). 23 or 25 hours on a DST change day, which is why it is
 * computed rather than assumed to be 24.
 */
export function dayWindow(dateIso, timezone) {
  const d = typeof dateIso === "string" ? dateIso.match(ISO_DATE) : null;
  if (!d) return null;
  const tz = validZone(timezone);
  const start = zonedWallClockToUtc({ year: +d[1], month: +d[2], day: +d[3], hours: 0, minutes: 0 }, tz);
  const next = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3] + 1));
  const end = zonedWallClockToUtc(
    { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hours: 0, minutes: 0 },
    tz,
  );
  return { start, end };
}

/** Wall-clock hour (0–23) and weekday (0 = Sunday) of an instant, in `timezone`. */
export function localClock(at, timezone) {
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validZone(timezone),
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: days[p.weekday] ?? null };
}

/** The company-local calendar day of an instant, as YYYY-MM-DD. */
export function localDate(at, timezone) {
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** "08:02" in the company's timezone — for the reasons shown on screen. */
export function clockLabel(at, timezone) {
  const c = localClock(at instanceof Date ? at : new Date(at), timezone);
  if (!c) return "";
  return `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}
