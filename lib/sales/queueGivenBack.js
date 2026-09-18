// lib/sales/queueGivenBack.js
//
// What went back to the pool without the rep pressing anything — said on
// the queue, so nothing looks like it vanished.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// 2026-09-17, from the floor: "from time to time her leads disappear". They
// had not. The claim log had the answer for every one — 287 of the 341 rows
// released over three days went back with reason `day_end`, at the rep's
// local midnight, while the rep was still dialling (lib/sales/queueBatch.js
// releaseDayEnded's header says what was wrong with "midnight" and what
// replaced it). But the log is a table nobody on the floor can read, and a
// list that is shorter than it was a minute ago, with no sentence beside
// it, is a list that "disappeared".
//
// So the queue carries the day's automatic give-backs: one line per sweep,
// with the names. Only the reasons NOBODY chose are shown — day_end, closed,
// lapsed, admin, reassigned. "rep" and "rest" are the rep's own presses and
// the screen already says what they did.
//
// Pure grouping here, executed by scripts/check-queue-cache.mjs; the one
// read that feeds it sits below and is the only thing that touches a db.

import { repClock, zoneShortName } from "./queueWindows";
import { startOfLocalDay, usableTimeZone } from "./queueBatch";

/** The release reasons that were not the rep's own press. */
export const GIVEN_BACK_REASONS = Object.freeze(["day_end", "closed", "lapsed", "admin", "reassigned"]);

/** Catalogue key for the reason sentence, per reason. */
export const GIVEN_BACK_WHY_KEYS = Object.freeze({
  day_end: "app.salesQueue.givenBack.why.dayEnd",
  closed: "app.salesQueue.givenBack.why.closed",
  lapsed: "app.salesQueue.givenBack.why.lapsed",
  admin: "app.salesQueue.givenBack.why.admin",
  reassigned: "app.salesQueue.givenBack.why.reassigned",
});

/** Rows read for the strip, at most. A sweep is 25–100 rows; a day, a few sweeps. */
export const GIVEN_BACK_MAX_ROWS = 400;

const MINUTE = 60 * 1000;

/**
 * Group release rows into the events the strip draws — pure.
 *
 * One event per (reason, minute): a sweep writes every row with one
 * `releasedAt`, so the minute is the sweep. Newest first. Names are the
 * businesses, A→Z, de-duplicated, so a rep can find the one they were about
 * to ring.
 *
 * @param rows `[{ releasedAt, releaseReason, prospect: { businessName } }]`
 * @returns `[{ at, atLocal, zone, reason, whyKey, count, names }]`
 */
export function groupGivenBack(rows = [], { repZone = null, language = "en", now = new Date() } = {}) {
  const events = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const reason = row?.releaseReason;
    if (!GIVEN_BACK_REASONS.includes(reason)) continue;
    const at = row.releasedAt instanceof Date ? row.releasedAt.getTime() : Date.parse(row?.releasedAt);
    if (!Number.isFinite(at)) continue;
    const minute = Math.floor(at / MINUTE) * MINUTE;
    const key = `${reason}:${minute}`;
    if (!events.has(key)) {
      const when = new Date(minute);
      events.set(key, {
        at: when.toISOString(),
        atLocal: repClock(when, { repZone, language, now }),
        zone: repZone ? zoneShortName(repZone, { language, at: when }) : null,
        reason,
        whyKey: GIVEN_BACK_WHY_KEYS[reason],
        count: 0,
        names: [],
      });
    }
    const e = events.get(key);
    e.count += 1;
    e.latest = Math.max(e.latest || 0, at);
    const name = String(row?.prospect?.businessName || "").trim();
    if (name && !e.names.includes(name)) e.names.push(name);
  }
  const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  // Newest first; two events in the same minute (a sweep closes lapsed rows
  // and releases untouched ones in one pass) by their latest row, so the
  // order is the log's and not the Map's.
  return [...events.values()]
    .sort((a, b) => b.latest - a.latest || Date.parse(b.at) - Date.parse(a.at))
    .map(({ latest: _latest, ...e }) => ({ ...e, names: [...e.names].sort(byName) }));
}

/**
 * Where "today" starts for the strip: the rep's local midnight in the zone
 * the browser sent, or the last 24 hours when there is no usable zone —
 * the same fallback claimsTakenToday makes. Pure.
 */
export function givenBackSince({ repZone = null, now = new Date() } = {}) {
  const zone = usableTimeZone(repZone, now);
  return (zone && startOfLocalDay(zone, now)) || new Date(now.getTime() - 24 * 60 * MINUTE);
}

/**
 * The day's automatic give-backs for one rep, read and grouped.
 *
 * A read failure is an empty list with `readError` set rather than a throw:
 * the queue must still load when its footnote cannot, and the screen can say
 * it could not look rather than say "nothing went back".
 */
export async function loadGivenBack({ db, rep, repZone = null, language = "en", now = new Date() } = {}) {
  const since = givenBackSince({ repZone, now });
  if (!rep?.id || typeof db?.salesQueueClaim?.findMany !== "function") {
    return { since: since.toISOString(), events: [], readError: null };
  }
  try {
    const rows = await db.salesQueueClaim.findMany({
      where: {
        salesRepId: rep.id,
        releasedAt: { gte: since, lte: now },
        releaseReason: { in: [...GIVEN_BACK_REASONS] },
      },
      orderBy: { releasedAt: "desc" },
      take: GIVEN_BACK_MAX_ROWS,
      select: { releasedAt: true, releaseReason: true, prospect: { select: { businessName: true } } },
    });
    return { since: since.toISOString(), events: groupGivenBack(rows, { repZone, language, now }), readError: null };
  } catch (err) {
    return { since: since.toISOString(), events: [], readError: err?.message || "unreadable" };
  }
}
