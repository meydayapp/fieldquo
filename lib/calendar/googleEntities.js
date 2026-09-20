// lib/calendar/googleEntities.js
//
// The three things that can be on a member's Google Calendar — an
// appointment, a job visit, a booking that never became an appointment —
// loaded ONE at a time by id for the sync, and ALL at once per member for
// the reconcile.
//
// Both go through the same normalisers the schedule feed uses
// (lib/schedule/jobVisits.js), and the per-member list IS the feed
// (lib/schedule/feed.js) filtered to the member's own assignments. The feed
// is the one definition of "what is on this person's calendar"; a second
// union written here would be the copy that drifts (AGENTS.md failure
// class 4), and the drift would be a visit on the phone that the calendar
// page does not show, or the reverse.
import { db as realDb } from "@/lib/db";
import { VISIT_INCLUDE, toCalendarEntry, bookingToCalendarEntry } from "@/lib/schedule/jobVisits";
import { loadScheduleFeed } from "@/lib/schedule/feed";
import { loadEnforceableMember } from "@/lib/permissions/enforce";

export const ENTITY_KINDS = Object.freeze(["appointment", "visit", "booking"]);

/**
 * @returns {object|null} a feed-shaped entry with `companyId` and
 *   `assignedToId` (a USER id) set, or null when the row is gone. A row that
 *   exists but should not be on a calendar (cancelled, archived job) is
 *   returned with its status so the sync can DELETE the mirror — null means
 *   "no such row", which deletes too, but for a different reason the log
 *   should be able to tell apart.
 */
export async function loadEntity(kind, id, db = realDb) {
  if (!ENTITY_KINDS.includes(kind) || !id) return null;

  if (kind === "appointment") {
    const a = await db.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, address: true } },
        booking: { select: { id: true, endTime: true, mode: true, status: true } },
      },
    });
    if (!a) return null;
    return { ...a, kind: "appointment", client: a.client || null, booking: a.booking || null };
  }

  if (kind === "visit") {
    const v = await db.jobVisit.findUnique({
      where: { id },
      include: {
        ...VISIT_INCLUDE,
        job: { select: { ...VISIT_INCLUDE.job.select, companyId: true, archivedAt: true } },
      },
    });
    if (!v) return null;
    const entry = toCalendarEntry(v);
    if (!entry) return null;
    return {
      ...entry,
      companyId: v.job?.companyId || null,
      // An archived job leaves the calendar (feed.js), so it leaves Google.
      status: v.job?.archivedAt ? "cancelled" : entry.status,
    };
  }

  const b = await db.booking.findUnique({
    where: { id },
    include: {
      eventType: { select: { name: true, userId: true, companyId: true, user: { select: { id: true, name: true } } } },
    },
  });
  if (!b) return null;
  // A booking that became an appointment is on the calendar AS that
  // appointment (feed.js excludes it here), so its own mirror must go.
  if (b.appointmentId) return null;
  const entry = bookingToCalendarEntry(b);
  if (!entry) return null;
  return { ...entry, companyId: b.eventType?.companyId || null, meetUrl: b.meetUrl || null };
}

/**
 * Everything assigned to this member between two instants — the feed, seen
 * as this member, minus the unassigned rows the feed keeps visible to
 * everyone (nobody's Google calendar should hold an unclaimed appointment)
 * and minus other people's rows for a member who can see the whole team.
 *
 * @param member  { id, userId, companyId, role }
 */
export async function listMemberEntries(member, { from, to }, db = realDb) {
  const full = await loadEnforceableMember(db, member.id);
  if (!full) return [];
  const session = { id: member.id, userId: member.userId, companyId: member.companyId, role: member.role || full.role };
  const entries = await loadScheduleFeed(db, session, full, { from, to });
  return entries.filter((e) => e && e.assignedToId && e.assignedToId === member.userId);
}
