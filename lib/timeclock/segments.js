// lib/timeclock/segments.js
//
// A time entry as the Time Log draws it: a row of segments — the activity,
// then the break that interrupted it, then the activity again — each with a
// start, an end and a duration. Pure, so the log route, the clock screen's
// live timer and scripts/check-time-activities.mjs share it.
//
// ── What a segment is NOT ──────────────────────────────────────────────────
//
// It is not a pay figure. `hours` on the entry is what payroll multiplies and
// it is computed in exactly one place (lib/timeclock/entryHours.js). The
// segments here are durations on a timeline; `paid` on each is a label for
// the log ("this stretch is not paid"), and the day's paid total is a
// display figure that agrees with `hours` to the rounding — it never feeds a
// pay run.
//
// ── Days are the company's ─────────────────────────────────────────────────
//
// The caller passes [from, to) — the company's day, from dayBoundsInZone or
// dayBoundsForDate below — and segments are CLIPPED to it. A night shift from
// 22:00 to 02:00 is two hours on each day's log rather than four on one and
// none on the other, which is what a timeline of a day has to mean.

import { effectiveActivity } from "./activities.js";
import { zonedWallClockToUtc } from "../booking/timezone.js";
import { DEFAULT_TIMEZONE } from "../time/wallClock.js";

const toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return new Date(v).getTime();
};

/**
 * The segments of one entry, clipped to [from, to).
 *
 * @param entry  { id, clockIn, clockOut, activity, jobId, job, task, paid, breaks }
 * @param opts   { from, to, now } — instants; from/to default to unbounded
 * @returns Array<{ entryId, kind, start, end, ms, paid, open, job, task }>
 *   `kind` is a work activity, or "break" / "lunch"; `open` is true on the
 *   segment still running.
 */
export function entrySegments(entry, { from = -Infinity, to = Infinity, now = Date.now() } = {}) {
  if (!entry) return [];
  const inMs = toMs(entry.clockIn);
  if (!Number.isFinite(inMs)) return [];
  const closed = entry.clockOut != null && Number.isFinite(toMs(entry.clockOut));
  const nowMs = toMs(now);
  const endMs = closed ? toMs(entry.clockOut) : nowMs;
  if (!Number.isFinite(endMs) || endMs <= inMs) return [];

  const lo = Number.isFinite(toMs(from)) ? toMs(from) : -Infinity;
  const hi = Number.isFinite(toMs(to)) ? toMs(to) : Infinity;
  const entryPaid = entry.paid !== false;
  const work = effectiveActivity(entry);
  const job = entry.job ? { id: entry.job.id, title: entry.job.title || null } : entry.jobId ? { id: entry.jobId, title: null } : null;
  const task = entry.task ? { id: entry.task.id, title: entry.task.title || null } : null;

  const raw = [];
  const push = (kind, s, e, paid) => {
    if (e > s) raw.push({ kind, s, e, paid });
  };

  const breaks = (Array.isArray(entry.breaks) ? entry.breaks : [])
    .map((b) => ({ ...b, sMs: toMs(b.start), eMs: b.end == null ? endMs : toMs(b.end) }))
    .filter((b) => Number.isFinite(b.sMs) && Number.isFinite(b.eMs))
    .sort((a, b) => a.sMs - b.sMs);

  let cursor = inMs;
  for (const b of breaks) {
    const bs = Math.max(b.sMs, inMs);
    const be = Math.min(b.eMs, endMs);
    if (be <= cursor) continue;
    push(work, cursor, Math.max(cursor, bs), entryPaid);
    push(b.kind === "lunch" ? "lunch" : "break", Math.max(cursor, bs), be, entryPaid && b.paid === true);
    cursor = Math.max(cursor, be);
  }
  push(work, cursor, endMs, entryPaid);

  const out = [];
  for (const r of raw) {
    const s = Math.max(r.s, lo);
    const e = Math.min(r.e, hi);
    if (e <= s) continue;
    out.push({
      entryId: entry.id || null,
      kind: r.kind,
      start: new Date(s).toISOString(),
      end: new Date(e).toISOString(),
      ms: e - s,
      paid: r.paid,
      // Running only if it reaches "now" on an entry nobody has closed, and
      // was not cut short by the end of the day being drawn.
      open: !closed && r.e === endMs && e === endMs,
      job: r.kind === work ? job : null,
      task: r.kind === work ? task : null,
    });
  }
  return out;
}

/** The segment running right now on an open entry, or null. */
export function currentSegment(openEntry, now = Date.now()) {
  if (!openEntry || openEntry.clockOut != null) return null;
  const list = entrySegments(openEntry, { now });
  return list.length ? list[list.length - 1] : null;
}

/** Totals for a list of segments: everything on the clock, and the paid part. */
export function segmentTotals(segments) {
  let trackedMs = 0;
  let paidMs = 0;
  for (const s of Array.isArray(segments) ? segments : []) {
    if (!s || !Number.isFinite(s.ms)) continue;
    trackedMs += s.ms;
    if (s.paid) paidMs += s.ms;
  }
  return { trackedMs, paidMs };
}

/**
 * Pure: entries + names → the people on the log, in reading order (me first,
 * then by name). Used by GET /api/time-clock/log; executed by
 * scripts/check-time-activities.mjs.
 */
export function buildDayLog({ entries = [], workers = [], meWorkerId = null, bounds, now }) {
  const names = new Map(workers.map((w) => [w.id, w.name || ""]));
  const byWorker = new Map();
  for (const e of entries) {
    const segments = entrySegments(e, { from: bounds.start, to: bounds.next, now });
    if (!segments.length) continue;
    if (!byWorker.has(e.workerId)) byWorker.set(e.workerId, []);
    byWorker.get(e.workerId).push(...segments);
  }
  const people = [...byWorker.entries()].map(([workerId, segments]) => {
    segments.sort((a, b) => new Date(a.start) - new Date(b.start));
    const { trackedMs, paidMs } = segmentTotals(segments);
    return {
      worker: { id: workerId, name: names.get(workerId) || "" },
      me: workerId === meWorkerId,
      segments,
      trackedMs,
      paidMs,
      open: segments.some((s) => s.open),
    };
  });
  people.sort((a, b) => (a.me === b.me ? a.worker.name.localeCompare(b.worker.name) : a.me ? -1 : 1));
  return people;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * [start, next) of a calendar date in the company's zone. Null for anything
 * that is not a real YYYY-MM-DD — "2026-02-30" included, which Date would
 * quietly roll into March.
 */
export function dayBoundsForDate(isoDay, timezone) {
  const m = ISO_DAY.exec(String(isoDay || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const tz = timezone || DEFAULT_TIMEZONE;
  const start = zonedWallClockToUtc({ year, month, day, hours: 0, minutes: 0 }, tz);
  const n = new Date(Date.UTC(year, month - 1, day + 1));
  const next = zonedWallClockToUtc(
    { year: n.getUTCFullYear(), month: n.getUTCMonth() + 1, day: n.getUTCDate(), hours: 0, minutes: 0 },
    tz,
  );
  if (!start || !next) return null;
  return { start, next };
}

/** YYYY-MM-DD of an instant in a zone. */
export function isoDayInZone(instant, timezone) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The day before / after a YYYY-MM-DD, as a YYYY-MM-DD. Calendar arithmetic, no zone needed. */
export function shiftIsoDay(isoDay, delta) {
  const m = ISO_DAY.exec(String(isoDay || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  return d.toISOString().slice(0, 10);
}

/**
 * The start of the company's week containing `now`, as an instant: local
 * midnight of the most recent `weekStartsOn` day (0 = Sunday). Built from the
 * calendar date rather than "today minus n × 24 h", so a DST change inside
 * the week does not move the boundary an hour.
 */
export function weekStartInZone(now, timezone, weekStartsOn = 0) {
  const today = isoDayInZone(now, timezone);
  if (!today) return null;
  const [y, mo, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const ws = Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6 ? weekStartsOn : 0;
  const back = (dow - ws + 7) % 7;
  return dayBoundsForDate(shiftIsoDay(today, -back), timezone)?.start || null;
}
