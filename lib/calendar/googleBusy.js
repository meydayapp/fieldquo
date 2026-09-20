// lib/calendar/googleBusy.js
//
// Google → FieldQuo: a member's personal calendar as opaque busy time.
//
// ── What comes back, and what deliberately does not ──────────────────────
//
// freebusy.query answers with intervals and nothing else — no titles, no
// attendees, no locations. That is the API chosen ON PURPOSE over events.list
// with calendar.readonly: the whole promise of "use my busy time" is that a
// dentist appointment blocks a slot without the dispatcher, the AI employee
// or a homeowner's booking page ever learning it was a dentist. Nothing in
// this file can carry a title because nothing it reads has one.
//
// ── Where it is honoured ─────────────────────────────────────────────────
//
// computeAvailableSlots (lib/booking/computeAvailability.js) merges these
// ranges into its busyRanges, and every booker goes through it: the public
// booking page, the client's own reschedule link, the voice receptionist,
// the AI employee's book_appointment, the office's move check
// (lib/schedule/entryNeighbours.js). The calendar page reads the same ranges
// through GET /api/calendar/google/busy and draws them grey.
//
// ── The cache ────────────────────────────────────────────────────────────
//
// Five minutes per member, process-local. A booking page polls availability
// on every day the visitor clicks; without this each click is a Google round
// trip. Five minutes is short enough that an event added on the phone blocks
// the slot before anyone could realistically book it, and long enough to
// keep the quota irrelevant. Keyed on the member; a request for a window the
// cached one does not cover refetches the union.
import { db as realDb } from "@/lib/db";
import { activeGoogle, googleCalendarConfigured } from "./googleClient";
import { getConnectionsForUser, recordSyncOutcome } from "./googleConnection";

export const BUSY_CACHE_MS = 5 * 60 * 1000;

/** memberId → { fetchedAt, from, to, busy } */
const cache = new Map();

/** For the check, and for a disconnect: nothing stale may answer for a row
 *  that no longer exists. */
export function clearBusyCache(memberId = null) {
  if (memberId) cache.delete(memberId);
  else cache.clear();
}

function fresh(hit, from, to, now) {
  return hit && now - hit.fetchedAt < BUSY_CACHE_MS && hit.from <= from && hit.to >= to;
}

/**
 * Busy intervals for one connection, cached.
 * @returns {{ ok: boolean, busy: Array<{start: Date, end: Date}> }}
 */
async function busyForConnection(connection, from, to, { google, db, now }) {
  const hit = cache.get(connection.memberId);
  if (fresh(hit, from, to, now)) return { ok: true, busy: hit.busy.filter((b) => b.end > from && b.start < to) };

  // Widen to the union of the stale window and the asked one, so a visitor
  // paging back and forth across a fortnight settles on one fetch.
  const wFrom = hit && hit.from < from ? hit.from : from;
  const wTo = hit && hit.to > to ? hit.to : to;

  let auth;
  try {
    auth = await google.accessTokenFor(connection);
  } catch (err) {
    auth = { ok: false, message: `stored token unusable: ${err?.message || "decrypt failed"}` };
  }
  if (!auth.ok) {
    await recordSyncOutcome(connection.memberId, { error: `busy read: ${auth.message}` }, db);
    return { ok: false, busy: [] };
  }
  const res = await google.freeBusy({
    accessToken: auth.accessToken,
    calendarId: connection.calendarId || "primary",
    timeMin: wFrom,
    timeMax: wTo,
  });
  if (!res.ok) {
    await recordSyncOutcome(connection.memberId, { error: `busy read: ${res.message}` }, db);
    return { ok: false, busy: [] };
  }
  cache.set(connection.memberId, { fetchedAt: now, from: wFrom, to: wTo, busy: res.busy });
  return { ok: true, busy: res.busy.filter((b) => b.end > from && b.start < to) };
}

/**
 * Every Google busy interval for a USER between two instants, across each
 * company they belong to (a person's dentist blocks them in both), from
 * connections with "use my busy time" on.
 *
 * Never throws and never hides a slot on a failure it cannot explain: a
 * Google error answers [] and is stamped on the row — a booking page that
 * went blank because Google was slow would be the worse failure. The
 * ranges carry NO title by construction (see the header).
 *
 * @returns {Array<{ start: Date, end: Date, memberId: string }>}
 */
export async function googleBusyRanges({ userId, from, to, companyId = null }, deps = {}) {
  const db = deps.db || realDb;
  const google = deps.google || activeGoogle();
  const now = deps.now ? deps.now.getTime() : Date.now();
  if (!userId || !(from instanceof Date) || !(to instanceof Date) || !(to > from)) return [];
  if (!googleCalendarConfigured() && !deps.google) return [];

  let connections;
  try {
    connections = await getConnectionsForUser(userId, db, { companyId });
  } catch (err) {
    console.error("[google-calendar] busy: connections lookup failed:", err?.message);
    return [];
  }
  const out = [];
  for (const c of connections) {
    if (c.busyReadEnabled === false) continue;
    if (c.member && c.member.active === false) continue;
    try {
      const { busy } = await busyForConnection(c, from, to, { google, db, now });
      for (const b of busy) out.push({ start: b.start, end: b.end, memberId: c.memberId });
    } catch (err) {
      console.error("[google-calendar] busy read threw:", err?.message);
    }
  }
  return out;
}
