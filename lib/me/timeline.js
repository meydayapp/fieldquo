// lib/me/timeline.js
//
// One timeline per person, from everything FieldQuo already dispatches to
// them. The employee home's "Next up" is the earliest item (lib/me/home.js).
// The Schedule tab reads /api/shifts and draws shifts only; a range route
// for this list (/api/me/timeline) existed with no screen calling it and
// was removed on 2026-09-18 — a route nobody reaches is a door with no
// room behind it. When the Schedule tab grows visits and tasks, the range
// read belongs beside timelineFor() here, with the screen that needs it.
//
// ── The kinds, and who gets which ────────────────────────────────────────────
//
//   shift        their published shifts (Shift.workerId)              everyone
//   open         open shifts they could claim (workerId null)         everyone
//   visit        job visits assigned to them (JobVisit.assignedToId)  anyone with a login
//   appointment  Appointment rows assigned to them                    ONLY members whose
//                                                                     role can quote
//   task         tasks due, assigned to them (Task.assignedToId)      anyone with a login
//   event        company events for the day (ScheduleEvent)           everyone
//
// The owner's rule, verbatim: "Crew members don't go to appointments or
// calls." So the appointment kind is not an empty section for a crew
// member — it is not fetched, not returned, not rendered. The gate is
// `can(role, "quote:create")`, the same one lib/booking/bookableMembers.js
// uses to decide who a client may book, so the person who can be booked is
// exactly the person who sees the booking.
//
// A Worker with no login (no Member) gets shifts and open shifts only:
// visits, appointments and tasks hang off a User, and there is none.
//
// ── Shape ────────────────────────────────────────────────────────────────────
//
// { kind, id, start, end, title, subtitle, address, href, note, status,
//   label, breaks, job }. `start` is the sort key; an all-day event carries
// its date at 00:00 UTC and sorts first on its day.
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { openShiftEligible } from "@/lib/shiftRequests/eligibility";

const JOB = {
  id: true,
  title: true,
  siteAddress: true,
  siteCity: true,
  client: { select: { name: true } },
};
const BREAKS = { select: { id: true, start: true, end: true, kind: true, paid: true }, orderBy: { start: "asc" } };

/** "12 rue Principale, Laval" — the SITE, never the billing address. */
export function siteOf(job) {
  return [job?.siteAddress, job?.siteCity].filter(Boolean).join(", ") || null;
}

/** Pure: sort a list of items by start, then by kind so a shift leads its day. */
export function sortItems(items) {
  const order = { event: 0, shift: 1, open: 2, visit: 3, appointment: 4, task: 5 };
  return [...items].sort(
    (a, b) => new Date(a.start) - new Date(b.start) || (order[a.kind] ?? 9) - (order[b.kind] ?? 9),
  );
}

/** Pure: the first item that has not ended yet (or started, for a point in time). */
export function nextUp(items, now = new Date()) {
  const t = now instanceof Date ? now.getTime() : Number(now);
  return (
    sortItems(items).find((i) => {
      if (i.kind === "event") return false;
      const end = i.end ? new Date(i.end).getTime() : new Date(i.start).getTime() + 3_600_000;
      return end > t;
    }) || null
  );
}

/**
 * @param member  { id, userId, companyId, role }
 * @param from, to  the window (Dates)
 * @param opts   { worker } — the caller's Worker row when already loaded
 */
export async function timelineFor(member, from, to, opts = {}) {
  if (!member?.companyId || !(from instanceof Date) || !(to instanceof Date) || isNaN(from) || isNaN(to)) return [];
  const worker =
    opts.worker !== undefined
      ? opts.worker
      : member.userId
        ? await db.worker.findFirst({
            where: { companyId: member.companyId, userId: member.userId },
            select: { id: true, name: true, title: true, userId: true, active: true },
          })
        : null;
  const quoter = can(member.role, "quote:create");
  const range = { start: { lte: to }, end: { gte: from } };

  const [shifts, openShifts, visits, appointments, tasks, events] = await Promise.all([
    worker
      ? db.shift.findMany({
          where: { companyId: member.companyId, workerId: worker.id, published: true, ...range },
          orderBy: { start: "asc" },
          select: {
            id: true, start: true, end: true, note: true, label: true,
            availabilityOverrideAt: true,
            job: { select: JOB },
            breaks: BREAKS,
            requests: { where: { status: { in: ["pending_peer", "pending_manager"] } }, select: { id: true, kind: true, status: true } },
          },
        })
      : [],
    worker
      ? db.shift.findMany({
          where: { companyId: member.companyId, workerId: null, published: true, ...range },
          orderBy: { start: "asc" },
          select: {
            id: true, start: true, end: true, note: true, label: true, workerId: true,
            job: { select: JOB },
            breaks: BREAKS,
            requests: { where: { status: { in: ["pending_peer", "pending_manager"] } }, select: { id: true, toWorkerId: true } },
          },
        })
      : [],
    member.userId
      ? db.jobVisit.findMany({
          where: {
            job: { companyId: member.companyId },
            assignedToId: member.userId,
            scheduledAt: { gte: from, lte: to },
            status: { notIn: ["cancelled", "canceled"] },
          },
          orderBy: { scheduledAt: "asc" },
          select: { id: true, jobId: true, scheduledAt: true, status: true, notes: true, job: { select: JOB } },
        })
      : [],
    member.userId && quoter
      ? db.appointment.findMany({
          where: {
            companyId: member.companyId,
            assignedToId: member.userId,
            scheduledAt: { gte: from, lte: to },
            status: { not: "cancelled" },
          },
          orderBy: { scheduledAt: "asc" },
          select: { id: true, scheduledAt: true, location: true, status: true, notes: true, client: { select: { name: true } }, quoteId: true },
        })
      : [],
    member.userId
      ? db.task.findMany({
          where: {
            companyId: member.companyId,
            assignedToId: member.userId,
            status: { in: ["open", "in_progress"] },
            dueDate: { gte: from, lte: to },
          },
          orderBy: { dueDate: "asc" },
          select: { id: true, title: true, dueDate: true, status: true, priority: true, job: { select: { id: true, title: true } } },
        })
      : [],
    db.scheduleEvent.findMany({
      where: { companyId: member.companyId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, title: true, description: true },
    }),
  ]);

  const items = [];
  for (const s of shifts) {
    items.push({
      kind: "shift",
      id: s.id,
      start: s.start,
      end: s.end,
      title: s.job?.client?.name || s.job?.title || null,
      subtitle: s.job?.title && s.job?.client?.name ? s.job.title : null,
      address: siteOf(s.job),
      href: "/app/me/schedule",
      note: s.note,
      label: s.label,
      breaks: s.breaks,
      job: s.job,
      overridden: Boolean(s.availabilityOverrideAt),
      pendingRequest: s.requests?.[0] || null,
    });
  }
  for (const s of openShifts) {
    if (!openShiftEligible(s, worker)) continue;
    items.push({
      kind: "open",
      id: s.id,
      start: s.start,
      end: s.end,
      title: s.job?.client?.name || s.job?.title || null,
      subtitle: s.label,
      address: siteOf(s.job),
      href: "/app/me/requests",
      note: s.note,
      label: s.label,
      breaks: s.breaks,
      job: s.job,
      myRequestId: s.requests.find((q) => q.toWorkerId === worker?.id)?.id || null,
    });
  }
  for (const v of visits) {
    items.push({
      kind: "visit",
      id: v.id,
      start: v.scheduledAt,
      end: null,
      title: v.job?.client?.name || v.job?.title || null,
      subtitle: v.job?.title || null,
      address: siteOf(v.job),
      href: v.jobId ? `/app/jobs/${v.jobId}` : null,
      note: v.notes,
      status: v.status || "scheduled",
      jobId: v.jobId,
      job: v.job,
    });
  }
  for (const a of appointments) {
    items.push({
      kind: "appointment",
      id: a.id,
      start: a.scheduledAt,
      end: null,
      title: a.client?.name || null,
      subtitle: null,
      address: a.location || null,
      href: "/app/appointments",
      note: a.notes,
      status: a.status,
      quoteId: a.quoteId || null,
    });
  }
  for (const t of tasks) {
    items.push({
      kind: "task",
      id: t.id,
      start: t.dueDate,
      end: null,
      title: t.title,
      subtitle: t.job?.title || null,
      address: null,
      href: "/app/tasks",
      note: null,
      status: t.status,
      priority: t.priority,
    });
  }
  for (const e of events) {
    items.push({
      kind: "event",
      id: e.id,
      start: e.date,
      end: null,
      title: e.title,
      subtitle: null,
      address: null,
      href: null,
      note: e.description,
      allDay: true,
    });
  }
  return sortItems(items);
}
