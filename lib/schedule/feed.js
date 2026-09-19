// lib/schedule/feed.js
//
// The calendar feed: three tables, one scoped and redacted list.
//
// ── Why this left the route ────────────────────────────────────────────────
//
// GET /api/appointments was the only reader of the three-source union, and
// its scoping — ownScheduleFilter per source, assignedJobWhere on unassigned
// visits, redactClient on every appointment's client — is the rule the crew
// check (scripts/check-crew-calendar.mjs) executes against a scripted
// database. The day map needs exactly the same rows for exactly the same
// caller, on one day rather than all time. Writing the union a second time
// in a map route would have been a second definition of who sees whose
// schedule, and the second definition is the one that drifts — the calendar
// and the map would then disagree about which stops exist for a crew
// member, which is a leak in one of the two directions.
//
// So the queries moved here, byte for byte, with one addition: an optional
// `within` range on the date column of each source. The route passes none
// and gets what it always got; the map passes the day.
//
// ── What is NOT decided here ───────────────────────────────────────────────
//
// Authentication (memberOrRefusal) and the grid load (loadEnforceableMember)
// stay in the route: `full` arrives already loaded so a caller cannot hand
// this a session-shaped member with no `permissions` and have every scope
// fall open.

import { redactClient, assignedJobWhere } from "@/lib/permissions/enforce";
import { ownScheduleFilter } from "@/lib/schedule/teamScope";
import {
  VISIT_INCLUDE,
  toCalendarEntry,
  bookingToCalendarEntry,
} from "@/lib/schedule/jobVisits";

/**
 * Every calendar entry this member may see, soonest first.
 *
 * @param db      Prisma client.
 * @param member  the session member ({ id, userId, companyId, role }).
 * @param full    loadEnforceableMember(db, member.id) — the grid.
 * @param opts.from / opts.to  optional UTC bounds, [from, to). Both or none.
 */
export async function loadScheduleFeed(db, member, full, { from = null, to = null } = {}) {
  const within = from && to ? { gte: from, lt: to } : null;
  // Schedule scoping. "View their own schedule" means the calendar shows
  // only their jobs — a filter, not a 403. Unassigned appointments stay
  // visible to everyone: an unclaimed job nobody can see is a job nobody
  // does.
  //
  // The fragment is built by ownScheduleFilter() rather than written out here
  // three times (appointments, visits, bookings). Three hand-copied copies of
  // the same rule is how one of them ends up disagreeing with the other two,
  // and the one that disagrees is the one nobody reads.
  //
  // `includeUnassigned` is now decided per source rather than taken as the
  // default everywhere. It defaults to true because of what an unassigned
  // APPOINTMENT is; the other two sources are different rows carrying
  // different data, and each says below why it answers differently.
  const ownFilter = (field, opts) =>
    ownScheduleFilter(full, member.userId, { field, ...opts });

  const appointments = await db.appointment.findMany({
    where: {
      companyId: member.companyId,
      ...ownFilter("assignedToId"),
      ...(within && { scheduledAt: within }),
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true } },
      // The quote an on-site measure was scheduled from (lib/quotes/siteVisit.js),
      // so the row can link back to it the way a visit links to its job. Null
      // on every other appointment; the number is what the link is labelled.
      quote: { select: { id: true, quoteNumber: true } },
      // What a hand-booked appointment is about, when the office said
      // (lib/schedule/appointmentAbout.js). Same one-line select as the
      // quote: the card prints the number or the title and links to it.
      job: { select: { id: true, title: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      // For the real finish time. An Appointment has no duration of its own,
      // so one created from a booking is the only kind we can say anything
      // definite about — and the travel check stays silent rather than
      // assuming an hour for the rest. See lib/booking/travel.js travelLegs.
      // `source` rides along with the end time: the calendar badges a booking
      // the AI receptionist took, and somebody driving to a job is entitled to
      // know a robot arranged it. Selected here rather than derived from
      // VoiceCall.bookingId, which would be a third query per row.
      booking: {
        select: {
          endTime: true,
          source: true,
          // ── Which KIND of appointment this is ──────────────────────────
          //
          // A callback and a site visit look identical on the calendar: a name
          // and a time. One means ring this person, the other means drive to
          // their house — and a callback has no address, so the row for one is
          // a name and a time and nothing else. Somebody reading their day has
          // to be able to tell which it is without opening anything.
          mode: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // ── Visits belong on the calendar too ──────────────────────────────────
  //
  // Scheduling a visit on a job advanced the job to "scheduled" and put
  // nothing here, because visits live in JobVisit and this reads Appointment.
  // A manager booked crew work for Tuesday, opened the Calendar, and saw an
  // empty week — while the dashboard's "Upcoming visits" tile read 0 against a
  // job that plainly had one.
  //
  // Merged at read time rather than mirrored into an Appointment row; see
  // lib/schedule/jobVisits.js for why. Entries carry `kind` so the UI links a
  // visit to its job instead of offering an appointment editor that would not
  // work on it.
  //
  // ── "Unassigned" does not mean the same thing on a visit ────────────────
  //
  // Unassigned APPOINTMENTS stay visible to everyone, and that is right: the
  // row is a time and a client the caller can already read at their level.
  //
  // A visit is not that row. toCalendarEntry carries the JOB's title, the
  // client's name and the site address — precisely what a Crew member is
  // confined away from — so an unassigned visit on a job they are not on put
  // that job's title and the homeowner's address on their calendar while
  // GET /api/jobs/[id] answered 404 for the very same job. The calendar was
  // the widest door onto the client list again, one table over.
  //
  // So an unassigned visit is theirs to pick up only on a job that is already
  // theirs. "Their job" is assignedJobWhere — the same fragment every job read
  // in the product uses — rather than a second definition written out here:
  // two definitions of one rule is how the calendar and the job board come to
  // disagree about which jobs exist, and the copy is the one that rots.
  //
  // Nobody who could see the whole calendar loses anything. ownFilter returns
  // {} for a member holding schedule edit_all, so visitScope is {} and the
  // spread is a no-op; and assignedJobWhere returns {} for anyone who sees the
  // whole job board (an Estimator sits at jobs:view_only and keeps every job),
  // so for them an unassigned visit stays visible — its address is on a job
  // they can already open.
  const ownVisits = ownFilter("assignedToId", { includeUnassigned: false });
  const myJobs = assignedJobWhere(full);
  const visitScope = Object.keys(ownVisits).length
    ? {
        OR: [
          ownVisits,
          // Spread, not `job: myJobs`: myJobs is {} for an unscoped member and
          // an empty relation filter is a claim about the relation rather than
          // the absence of one.
          { assignedToId: null, ...(Object.keys(myJobs).length ? { job: myJobs } : {}) },
        ],
      }
    : {};

  const visits = await db.jobVisit.findMany({
    where: {
      // Archived jobs are filed away, so their visits leave the calendar and
      // the dashboard count with them. Otherwise "archive" would only tidy the
      // Jobs list while the work kept showing up everywhere else.
      job: { companyId: member.companyId, archivedAt: null },
      ...visitScope,
      ...(within && { scheduledAt: within }),
    },
    include: VISIT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });

  // ── And bookings, when they never became an appointment ────────────────
  //
  // A confirmed booking is meant to turn into an Appointment and reach this
  // list as one. `Booking.appointmentId` is nullable, though — rows predating
  // the link have none — and a booking that did not convert is a client who
  // has been sent a confirmation for a visit nobody in the company can see.
  //
  // `appointmentId: null` is what keeps this from double-counting: a booking
  // that DID convert is already in `appointments` above, and is skipped here.
  // So this is a floor under the conversion, not a second copy of it, and it
  // stays correct whichever way that mechanism behaves.
  //
  // pending_payment is deliberately excluded. It is a slot held while someone
  // pays, not a booked visit, and putting unpaid holds on the calendar would
  // send a crew to a house that never confirmed.
  const bookings = await db.booking.findMany({
    where: {
      appointmentId: null,
      status: { in: ["confirmed", "cancelled", "completed"] },
      ...(within && { startTime: within }),
      eventType: {
        companyId: member.companyId,
        // Same rule, same builder — but the assignee column is `userId` here,
        // because a booking is owned through the EventType whose page took it.
        //
        // `includeUnassigned` is off, and this is the one source where the
        // default was plainly wrong. EventType.userId is null for a
        // COMPANY-WIDE booking type — the public /book page anyone in the city
        // can fill in — so "unassigned" here does not mean "spare work waiting
        // to be claimed", it means "every booking the company has ever taken
        // through its own front door". Each one carried a stranger's name and
        // street address onto the calendar of every member scoped to their own
        // schedule, and there is nothing for them to claim: a booking is not
        // assignable at all (bookingToCalendarEntry has no editor behind it,
        // and its id would 404 against /api/appointments/[id]).
        ...ownFilter("userId", { includeUnassigned: false }),
      },
    },
    include: {
      eventType: { select: { name: true, userId: true, user: { select: { id: true, name: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  // ── The calendar is the widest door onto the client list ────────────────
  //
  // `include: { client: true }` above is the whole Client row, and this feed is
  // the one endpoint every employee's app hits on load. So an employee confined
  // to clientsProperties "name_address_only" received every customer's email,
  // phone, private notes and portalToken here — the same exposure that was
  // closed on GET /api/clients and then again on the client DETAIL route, still
  // standing open on the busiest route of the three.
  //
  // /api/appointments/[id] has redacted since that sweep. This is its sibling,
  // and the sibling is always the one that gets missed.
  //
  // The visit and booking entries need nothing: VISIT_INCLUDE already narrows
  // to { id, name, address } (which is exactly what name_address_only allows),
  // and a booking's client is synthesised from the booking's own columns.
  return [
    ...appointments.map((a) => ({
      ...a,
      kind: "appointment",
      client: redactClient(full, a.client),
    })),
    ...visits.map(toCalendarEntry).filter(Boolean),
    ...bookings.map(bookingToCalendarEntry).filter(Boolean),
  ].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

