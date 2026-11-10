// lib/schedule/routeLegs.js
//
// Who is driving where, on one person's day — the chain the calendar's travel
// warning is measured along.
//
// ══ The bug this file exists to close ══════════════════════════════════════
//
// The calendar grouped a day's entries by assignee and handed every one of
// them to travelLegs as a stop. A CANCELLED visit is a row on the calendar
// (cancelling is a status, never a delete) but it is nobody's drive, and
// counting it did two things at once:
//
//   1. it put the warning on a visit nobody is driving to, and
//   2. it took the warning OFF the visit that actually carries the conflict,
//      because the cancelled stop became that visit's predecessor.
//
// Live, on 2026-11-09: a completed visit in Gatineau ending at 16:00, a
// CANCELLED one in Carleton Place at 17:00, and a real one at the same
// Carleton Place address at 17:00. The cancelled row read "about 1 h 35 drive
// · 60 min gap · 35 min short" and the real one read "about 0 min drive" —
// its predecessor being the cancelled stop at the same address. The one visit
// with a genuine travel conflict showed no warning at all.
//
// That is AGENTS.md's opening rule: a control that appears to work and does
// not. The number was arithmetically correct the whole time, which is why
// nobody caught it by reading.
//
// ══ Why the exclusion is by STATUS and not by what is on screen ════════════
//
// The calendar's own comment is right: computing the chain over the VISIBLE
// subset would quietly invent a drive from whatever row happened to be above
// it. A status filter is a fact about the stop, the same for every viewer and
// every filter, so the chain it produces is the same chain in every view.
//
// ══ Which statuses mean "nobody is driving to this" ════════════════════════
//
// Three vocabularies arrive here, the same three lib/schedule/jobVisits.js
// merges (Appointment · Booking · JobVisit), and the question is asked of the
// stop, not of the enum it came from:
//
//   OFF the route — cancelled (all three sources, both spellings, because
//                   JobVisit.status is a plain String and holds each —
//                   lib/jobs/visitStatus.js), and `rescheduled`, which
//                   AppointmentStatus defines as "did not happen at that time
//                   and was booked again": the new time is its own row, so
//                   this one is a fact about the day and not a stop in it.
//
//   ON the route  — everything else, and three of those on purpose:
//
//     `no_show`   the van went. Nobody was home, which is a fact about the
//                 client and not about the drive; the trip was made and the
//                 time it took was real.
//     `completed` the drive happened. A finished day still answers "could
//                 this have been made", which is the only question anybody
//                 asks about a day that ran late.
//     `pending_payment`  a booking hold that has not been paid for. It is not
//                 a statement that the trip is off — it may yet be confirmed,
//                 and treating "unsettled" as "not happening" would hide a
//                 conflict that is about to become real. AGENTS.md #5.
//
// ══ Grouped by assignee first, and unassigned is still skipped ════════════
//
// The calendar is one chronological stream across the whole company, so
// pairing neighbours blind would show a painter the drive from a plumber's
// last job — a number that is not merely useless but actively misleading,
// because it looks exactly like a real one.
//
// And nobody is not a person with a van. An unassigned row occupies time on
// the calendar but belongs to no route, and lumping them together would
// measure a drive between two jobs no single person has been given.

import { travelLegs } from "@/lib/booking/travel";

/**
 * The statuses that take a stop off the route.
 *
 * Exported so check:travel can assert the set rather than re-deriving it, and
 * so a status added to any of the three vocabularies has one place to be
 * considered.
 */
export const OFF_ROUTE_STATUSES = Object.freeze([
  // Appointment · Booking · JobVisit
  "cancelled",
  // JobVisit only — `status` is a plain String column and both spellings are
  // in the table. Resolving one and not the other would leave half the
  // cancelled visits still absorbing warnings, which is the bug with a
  // smaller blast radius rather than the bug fixed.
  "canceled",
  // Appointment only.
  "rescheduled",
]);

const OFF_ROUTE = new Set(OFF_ROUTE_STATUSES);

/**
 * Is this entry a stop somebody actually drives to? Pure.
 *
 * A missing status counts as ON the route: `JobVisit.status` is
 * `String @default("scheduled")` and an Appointment defaults to `scheduled`,
 * so absence means the default — and in any case an unknown stop must not be
 * silently dropped out of a chain. Only a status that SAYS the trip is off
 * takes it off.
 */
export function isOnRoute(entry) {
  if (!entry) return false;
  // A grey Google busy block is time the person does not have, not a place
  // they go: no coordinates, no client, no drive. It never reaches here from
  // the calendar (those rows carry `userId`, not `assignedToId`) and is named
  // anyway so a future caller that does pass them gets the right answer.
  if (entry.kind === "busy") return false;
  return !OFF_ROUTE.has(entry.status);
}

/** The name to show a drive as starting from, or null when we have none. */
function stopLabel(entry) {
  return entry?.client?.name || entry?.title || null;
}

/**
 * The drive to each entry from the one before it on the same person's day.
 *
 * @param {Array} entries  calendar entries (any of the three kinds), in any
 *                         order — they are sorted per person here.
 * @param {object} [opts]
 * @param {number} [opts.buffer]  company padding, minutes
 * @returns {Map<string, object>} entry id -> the leg travelLegs produced, plus
 *          `fromName` / `fromEndAt`: WHICH earlier visit this drive starts
 *          from, so the warning can name it. Both null when the leg has no
 *          predecessor or the predecessor has no name / no known finish.
 *          Entries that are off the route, unassigned, or first on their day
 *          get no leg at all.
 */
export function routeLegs(entries, { buffer = 0 } = {}) {
  const byPerson = new Map();
  for (const a of Array.isArray(entries) ? entries : []) {
    if (!a?.assignedToId) continue;
    if (!isOnRoute(a)) continue;
    if (!byPerson.has(a.assignedToId)) byPerson.set(a.assignedToId, []);
    byPerson.get(a.assignedToId).push(a);
  }

  const out = new Map();
  for (const list of byPerson.values()) {
    const ordered = list
      .slice()
      .sort((x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt));
    const stops = ordered.map((a) => ({
      id: a.id,
      at: a.scheduledAt,
      endAt: a.booking?.endTime || null,
      latitude: a.latitude,
      longitude: a.longitude,
    }));
    // Index-aligned with `ordered`: travelLegs maps one entry per stop, in
    // order, so legs[i] is the drive INTO ordered[i] from ordered[i - 1].
    travelLegs(stops, { buffer }).forEach((leg, i) => {
      const prev = leg.travel ? ordered[i - 1] : null;
      out.set(leg.id, {
        ...leg,
        fromName: prev ? stopLabel(prev) : null,
        // Only the finish, never the start. A drive leaves when the previous
        // visit ENDS; printing its start time beside a travel time would
        // name a moment nobody departs at. Null when the row cannot say when
        // it ended — which is exactly when there is no gap and no verdict.
        fromEndAt: prev?.booking?.endTime || null,
      });
    });
  }
  return out;
}
