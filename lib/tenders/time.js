// lib/tenders/time.js
//
// A tender's dates are what the solicitation printed — "closes 4 November
// 2026 at 14:00 Eastern" — so they are stored as wall-clock strings plus one
// IANA zone, and every instant is computed here. Pure: no database, so
// scripts/check-tenders.mjs executes it across DST boundaries.
//
// ══ "One day before" is a calendar day, not 24 hours ═══════════════════════
//
// A closing at 14:00 on the Monday after the clocks go back is reminded at
// 14:00 on the Sunday in the tender's zone — 25 hours earlier, not 24. The
// person reading "closes tomorrow at 2" at 1 p.m. would otherwise be told an
// hour late, every November and every March. The three-hour mark IS an
// interval (three hours before the instant), because that is what three
// hours before means.
//
// ══ A date with no time is not a midnight ═══════════════════════════════════
//
// A Q&A deadline printed as a date alone stays a date (AGENTS.md failure
// class #5). For deciding whether it has PASSED, the end of that day in the
// tender's zone is used; for deciding when to remind, 09:00 local two days
// before — a time to ping the office, not a claim about the deadline.
import { zonedWallClockToUtc } from "@/lib/booking/timezone";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOUR_MS = 60 * 60 * 1000;

/** When a date-only deadline is reminded, local. */
export const DATE_ONLY_REMINDER_TIME = "09:00";

/** The fallback zone — the schema's own Company.timezone default. */
export const DEFAULT_TENDER_TIME_ZONE = "America/Toronto";

/** A real calendar date "YYYY-MM-DD" (2026-02-30 is refused). */
export function isIsoDate(value) {
  if (typeof value !== "string") return false;
  const m = value.match(ISO_DATE);
  if (!m) return false;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "HH:MM", 00:00–23:59. */
export function isHhmm(value) {
  return typeof value === "string" && HHMM.test(value);
}

/** Is this an IANA zone the runtime knows? */
export function isTimeZone(value) {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The company's zone when it is a real one, else the schema default. */
export function companyTimeZone(value) {
  return isTimeZone(value) ? value : DEFAULT_TENDER_TIME_ZONE;
}

/** "YYYY-MM-DD" shifted by whole calendar days. */
export function shiftDate(dateIso, days) {
  const m = dateIso.match(ISO_DATE);
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return dt.toISOString().slice(0, 10);
}

/** The instant a wall-clock date + time names in `timeZone`, or null. */
export function instantOf(dateIso, time, timeZone) {
  if (!isIsoDate(dateIso) || !isHhmm(time) || !isTimeZone(timeZone)) return null;
  const d = dateIso.match(ISO_DATE);
  const t = time.match(HHMM);
  const at = zonedWallClockToUtc({ year: +d[1], month: +d[2], day: +d[3], hours: +t[1], minutes: +t[2] }, timeZone);
  return at instanceof Date && Number.isFinite(at.getTime()) ? at : null;
}

/** The first instant AFTER a local calendar day — its end, for "has it passed". */
export function endOfLocalDay(dateIso, timeZone) {
  return instantOf(shiftDate(dateIso, 1), "00:00", timeZone);
}

/**
 * The three computed instants, from the stored wall-clock fields.
 *
 * @returns {{ closingAt, questionsDeadlineAt, siteVisitAt }} each a Date or null
 */
export function tenderInstants(t) {
  const tz = t?.timeZone;
  return {
    closingAt: instantOf(t?.closingDate, t?.closingTime, tz),
    questionsDeadlineAt: t?.questionsDeadlineDate && t?.questionsDeadlineTime
      ? instantOf(t.questionsDeadlineDate, t.questionsDeadlineTime, tz)
      : null,
    siteVisitAt: t?.siteVisitDate && t?.siteVisitTime ? instantOf(t.siteVisitDate, t.siteVisitTime, tz) : null,
  };
}

/** When an event is over: its instant, or the end of its day when it has no time. */
function eventEnd(dateIso, time, timeZone) {
  if (!isIsoDate(dateIso)) return null;
  return time ? instantOf(dateIso, time, timeZone) : endOfLocalDay(dateIso, timeZone);
}

/**
 * Every reminder mark a tender has, whether or not it is due.
 *
 *   questions_2d   two calendar days before the Q&A deadline, at its time
 *                  (09:00 local when it has none)
 *   site_visit_1d  the calendar day before the site visit, same rule
 *   closing_3d     three calendar days before closing, at the closing time
 *   closing_1d     one calendar day before, at the closing time
 *   closing_3h     three hours before the closing instant
 *
 * @returns {Array<{ kind, event, dueAt: Date, eventAt: Date }>}
 */
export function reminderMarks(t) {
  const tz = t?.timeZone;
  if (!isTimeZone(tz)) return [];
  const marks = [];

  if (isIsoDate(t.questionsDeadlineDate)) {
    const time = isHhmm(t.questionsDeadlineTime) ? t.questionsDeadlineTime : null;
    const dueAt = instantOf(shiftDate(t.questionsDeadlineDate, -2), time || DATE_ONLY_REMINDER_TIME, tz);
    const eventAt = eventEnd(t.questionsDeadlineDate, time, tz);
    if (dueAt && eventAt) marks.push({ kind: "questions_2d", event: "questions", dueAt, eventAt });
  }

  if (isIsoDate(t.siteVisitDate)) {
    const time = isHhmm(t.siteVisitTime) ? t.siteVisitTime : null;
    const dueAt = instantOf(shiftDate(t.siteVisitDate, -1), time || DATE_ONLY_REMINDER_TIME, tz);
    const eventAt = eventEnd(t.siteVisitDate, time, tz);
    if (dueAt && eventAt) marks.push({ kind: "site_visit_1d", event: "siteVisit", dueAt, eventAt });
  }

  const closingAt = instantOf(t.closingDate, t.closingTime, tz);
  if (closingAt) {
    const d3 = instantOf(shiftDate(t.closingDate, -3), t.closingTime, tz);
    const d1 = instantOf(shiftDate(t.closingDate, -1), t.closingTime, tz);
    if (d3) marks.push({ kind: "closing_3d", event: "closing", dueAt: d3, eventAt: closingAt });
    if (d1) marks.push({ kind: "closing_1d", event: "closing", dueAt: d1, eventAt: closingAt });
    marks.push({ kind: "closing_3h", event: "closing", dueAt: new Date(closingAt.getTime() - 3 * HOUR_MS), eventAt: closingAt });
  }
  return marks;
}

/**
 * The reminders that should go out NOW — at most one per event.
 *
 * Per event, the LATEST mark whose time has come wins and the earlier ones
 * are superseded: a cron that was down across the three-day mark sends
 * "closes tomorrow", not both. Never after the event itself. Never a mark
 * that fell before the tender was entered — typing in a tender two days
 * before closing should not ring the bell with "three days left" at once.
 *
 * Idempotency is NOT decided here: the cron claims (tenderId, kind, dueAt)
 * in TenderReminder before notifying, and a duplicate claim stops it.
 *
 * @param {object} t        the tender's stored fields (+ status, createdAt)
 * @param {Date}   now
 * @param {string[]} openStatuses  statuses that still get reminded
 */
export function remindersDue(t, now, openStatuses) {
  if (!t || !(now instanceof Date) || !Array.isArray(openStatuses)) return [];
  if (!openStatuses.includes(t.status)) return [];
  const created = t.createdAt ? new Date(t.createdAt).getTime() : -Infinity;
  const at = now.getTime();
  const byEvent = new Map();
  for (const mark of reminderMarks(t)) {
    const due = mark.dueAt.getTime();
    if (due > at) continue;
    if (at >= mark.eventAt.getTime()) continue;
    if (due < created) continue;
    const prev = byEvent.get(mark.event);
    if (!prev || prev.dueAt.getTime() < due) byEvent.set(mark.event, mark);
  }
  return [...byEvent.values()];
}

/**
 * "Wed, Nov 4, 2:00 p.m. EST" — an instant in the tender's zone, in a
 * reader's language, with the zone named so nobody reads Eastern as Pacific.
 */
export function formatInZone(instant, timeZone, language = "en") {
  const at = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(at.getTime()) || !isTimeZone(timeZone)) return "";
  try {
    return new Intl.DateTimeFormat(language || "en", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(at);
  } catch {
    return at.toISOString();
  }
}

/**
 * Where a closing stands relative to now, for the list's countdown and
 * highlight. `today` is the tender zone's calendar day, not the browser's.
 *
 * @returns {{ state: "closed"|"today"|"soon"|"later", msLeft: number }}
 */
export function closingState(t, now, { soonDays = 7 } = {}) {
  const closingAt = t?.closingAt ? new Date(t.closingAt) : instantOf(t?.closingDate, t?.closingTime, t?.timeZone);
  if (!closingAt || !Number.isFinite(closingAt.getTime())) return { state: "later", msLeft: Infinity };
  const msLeft = closingAt.getTime() - now.getTime();
  if (msLeft <= 0) return { state: "closed", msLeft };
  const todayLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: companyTimeZone(t.timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (todayLocal === t.closingDate) return { state: "today", msLeft };
  if (msLeft <= soonDays * 24 * HOUR_MS) return { state: "soon", msLeft };
  return { state: "later", msLeft };
}

/** { days, hours, minutes } left, floored — the countdown's parts. */
export function countdownParts(msLeft) {
  const ms = Math.max(0, Math.floor(Number(msLeft) || 0));
  const minutesTotal = Math.floor(ms / 60000);
  return {
    days: Math.floor(minutesTotal / 1440),
    hours: Math.floor((minutesTotal % 1440) / 60),
    minutes: minutesTotal % 60,
  };
}
