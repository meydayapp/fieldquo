// lib/calendar/vtimezone.js
//
// A VTIMEZONE component for one IANA zone over one window, generated from
// the runtime's own tz database rather than shipped as a table.
//
// ── Why the feed carries local times at all ────────────────────────────────
//
// The one-off shift download (lib/calendar/ics.js) writes every DTSTART in
// UTC with a trailing Z, and that is fine for a file someone opens once: the
// phone converts. A SUBSCRIBED calendar is different. Google, Apple and
// Outlook all show a floating "9:00" more faithfully when the event says
// "9:00 in America/Toronto" than when it says "14:00Z" — a UTC time on a
// subscribed feed is displayed correctly but EDITED, dragged and reminded in
// the phone's zone, and a crew member who flies to a job in Vancouver wants
// the appointment to stay at the company's 9:00, not slide to 6:00.
//
// RFC 5545 says a TZID on a date requires a VTIMEZONE in the same file, and
// clients differ in how strictly they enforce it: Apple silently treats an
// unknown TZID as floating, Outlook refuses the file. So one is generated.
//
// ── Why generated, not a shipped table ─────────────────────────────────────
//
// A table of the world's zones is the thing that rots — Mexico dropped DST
// in 2022, Egypt brought it back in 2023 — and the runtime already carries
// the current answer in Intl. The cost is that a generated VTIMEZONE cannot
// carry RRULEs (a rule would have to be inferred), so each observance is
// written out explicitly for the window. A feed covers thirteen months; that
// is two or three observances, and a client only needs the ones that cover
// the events it is handed.
//
// ── Method ─────────────────────────────────────────────────────────────────
//
// The UTC offset is read from Intl at the scan start, then day by day; where
// two consecutive days disagree the transition is binary-searched to the
// minute. Every civil transition on record happens on a whole minute, and
// most on a whole hour, so the minute is enough. One STANDARD or DAYLIGHT
// observance is emitted per segment.
//
// Everything here is pure and hostile-input safe: an unknown or malformed
// zone falls back to DEFAULT_TIMEZONE, because a feed with a wrong-but-real
// zone is a calendar, and a feed that throws is a phone showing nothing.

import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const formatters = new Map();

/** One Intl formatter per zone; constructing them is the expensive part. */
function offsetFormatter(timeZone) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    // "longOffset" renders GMT-05:00 / GMT+05:30 / GMT (for zero). It is the
    // only timeZoneName style whose output is a number rather than a name
    // that depends on the display locale.
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Is this a zone Intl knows? A falsy, non-string or misspelled one is not. */
export function isKnownTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    offsetFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The zone to use: the one given, or the default when it is not real. */
export function resolveTimeZone(timeZone) {
  return isKnownTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
}

/**
 * The zone's UTC offset at `date`, in minutes east of UTC (Toronto in
 * January is -300). `timeZone` must already be resolved.
 */
export function offsetMinutesAt(date, timeZone) {
  const parts = offsetFormatter(timeZone).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = /^(?:GMT|UTC)(?:([+-])(\d{1,2})(?::?(\d{2}))?)?$/.exec(name);
  if (!m || !m[1]) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

/** -300 → "-0500"; 330 → "+0530". The TZOFFSETFROM/TO spelling. */
export function formatOffset(minutes) {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}${mm}`;
}

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * A UTC instant as the DATE-TIME spelling of its wall clock at `offsetMin`,
 * with no Z — the "local time" form RFC 5545 wants after a TZID. Computed by
 * shifting the instant and reading UTC fields, which is exact for a fixed
 * offset and avoids a second Intl call per event.
 */
export function wallClockAtOffset(date, offsetMin) {
  const d = new Date(date.getTime() + offsetMin * MINUTE_MS);
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
  );
}

/** A UTC instant as the zone's local DATE-TIME spelling (no Z). */
export function localWallClock(date, timeZone) {
  const tz = resolveTimeZone(timeZone);
  return wallClockAtOffset(date, offsetMinutesAt(date, tz));
}

/** The zone's calendar day for an instant, as YYYY-MM-DD. */
export function localDayKey(date, timeZone) {
  return localWallClock(date, timeZone).slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
}

/**
 * The exact minute between `before` (offset A) and `after` (offset B) at
 * which the offset changes. Both are Dates at most a day apart.
 */
function bisectTransition(before, after, timeZone) {
  let lo = before.getTime();
  let hi = after.getTime();
  const from = offsetMinutesAt(before, timeZone);
  while (hi - lo > MINUTE_MS) {
    const mid = lo + Math.floor((hi - lo) / 2 / MINUTE_MS) * MINUTE_MS;
    if (offsetMinutesAt(new Date(mid), timeZone) === from) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/**
 * Every offset change in [from, to], soonest first, plus the offset that was
 * in force at `from`.
 *
 * @returns {{ initial: number, transitions: Array<{ at: Date, from: number, to: number }> }}
 */
export function scanTransitions(from, to, timeZone) {
  const tz = resolveTimeZone(timeZone);
  // Floored to a whole minute so the bisection's probes are whole minutes and
  // a transition at 02:00:00 is reported as 02:00:00, not 02:00:37.
  const start = new Date(Math.floor(new Date(from).getTime() / MINUTE_MS) * MINUTE_MS);
  const end = new Date(to);
  const initial = offsetMinutesAt(start, tz);
  const transitions = [];
  let prev = start;
  let prevOffset = initial;
  for (let t = start.getTime() + DAY_MS; t <= end.getTime() + DAY_MS; t += DAY_MS) {
    const cur = new Date(Math.min(t, end.getTime()));
    const curOffset = offsetMinutesAt(cur, tz);
    if (curOffset !== prevOffset) {
      transitions.push({ at: bisectTransition(prev, cur, tz), from: prevOffset, to: curOffset });
      prevOffset = curOffset;
    }
    prev = cur;
    if (cur.getTime() >= end.getTime()) break;
  }
  return { initial, transitions };
}

/**
 * The VTIMEZONE lines for `timeZone` covering [from, to].
 *
 * The scan starts a year before `from` so the observance in force at the
 * window's start has a real DTSTART and a real TZOFFSETFROM — a Toronto feed
 * generated in January must say the -0500 it is in began at last November's
 * transition from -0400, not on the arbitrary day the feed was built. A zone
 * with no change in that year (Phoenix) yields one STANDARD observance whose
 * TZOFFSETFROM equals its TZOFFSETTO, which is the RFC's own spelling for
 * "this zone does not move".
 *
 * DTSTART on an observance is the local wall clock in the OLD offset — the
 * time a clock read the instant before it was changed, which is how RFC 5545
 * §3.6.5 gives its examples (19671029T020000 with TZOFFSETFROM:-0400 for the
 * fall-back to -0500).
 *
 * @returns {{ tzid: string, lines: string[] }}
 */
export function buildVtimezone({ timeZone, from, to }) {
  const tzid = resolveTimeZone(timeZone);
  const windowFrom = from instanceof Date && !Number.isNaN(from) ? from : new Date();
  const windowTo = to instanceof Date && !Number.isNaN(to) && to > windowFrom
    ? to
    : new Date(windowFrom.getTime() + 365 * DAY_MS);
  // A whole UTC day, so a zone that never moves gets a DTSTART on a round
  // midnight rather than on the second the feed happened to be built.
  const scanFrom = new Date(Math.floor((windowFrom.getTime() - 366 * DAY_MS) / DAY_MS) * DAY_MS);
  const { initial, transitions } = scanTransitions(scanFrom, windowTo, tzid);

  // The observance in force at `windowFrom` is the last transition before it,
  // or the scan's opening state when the zone never moved.
  const before = transitions.filter((t) => t.at <= windowFrom);
  const within = transitions.filter((t) => t.at > windowFrom);
  const observances = [];
  if (before.length) {
    observances.push(before[before.length - 1]);
  } else {
    observances.push({ at: scanFrom, from: initial, to: initial });
  }
  observances.push(...within);

  const lines = ["BEGIN:VTIMEZONE", `TZID:${tzid}`];
  for (const o of observances) {
    // Spring forward (offset grows) is DAYLIGHT; everything else — the
    // fall-back, and a zone that never moves — is STANDARD.
    const kind = o.to > o.from ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${wallClockAtOffset(o.at, o.from)}`,
      `TZOFFSETFROM:${formatOffset(o.from)}`,
      `TZOFFSETTO:${formatOffset(o.to)}`,
      `END:${kind}`,
    );
  }
  lines.push("END:VTIMEZONE");
  return { tzid, lines };
}
