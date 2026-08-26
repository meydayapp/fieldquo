// app/api/appointments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can, requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  hasLevel,
  redactClient,
} from "@/lib/permissions/enforce";
import { ownScheduleFilter } from "@/lib/schedule/teamScope";
import {
  VISIT_INCLUDE,
  toCalendarEntry,
  bookingToCalendarEntry,
} from "@/lib/schedule/jobVisits";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Schedule scoping. "View their own schedule" means the calendar shows
  // only their jobs — a filter, not a 403. Unassigned appointments stay
  // visible to everyone: an unclaimed job nobody can see is a job nobody
  // does.
  //
  // The fragment is built by ownScheduleFilter() rather than written out here
  // three times (appointments, visits, bookings). Three hand-copied copies of
  // the same rule is how one of them ends up disagreeing with the other two,
  // and the one that disagrees is the one nobody reads.
  const full = await loadEnforceableMember(db, member.id);
  const ownFilter = (field) => ownScheduleFilter(full, member.userId, { field });

  const appointments = await db.appointment.findMany({
    where: {
      companyId: member.companyId,
      ...ownFilter("assignedToId"),
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true } },
      // For the real finish time. An Appointment has no duration of its own,
      // so one created from a booking is the only kind we can say anything
      // definite about — and the travel check stays silent rather than
      // assuming an hour for the rest. See lib/booking/travel.js travelLegs.
      booking: { select: { endTime: true } },
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
  const visits = await db.jobVisit.findMany({
    where: {
      // Archived jobs are filed away, so their visits leave the calendar and
      // the dashboard count with them. Otherwise "archive" would only tidy the
      // Jobs list while the work kept showing up everywhere else.
      job: { companyId: member.companyId, archivedAt: null },
      ...ownFilter("assignedToId"),
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
      eventType: {
        companyId: member.companyId,
        // Same rule, same builder — but the assignee column is `userId` here,
        // because a booking is owned through the EventType whose page took it.
        // A company-wide type has no owner, which is the unassigned case and
        // stays visible for the same reason an unclaimed appointment does.
        ...ownFilter("userId"),
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
  return NextResponse.json([
    ...appointments.map((a) => ({
      ...a,
      kind: "appointment",
      client: redactClient(full, a.client),
    })),
    ...visits.map(toCalendarEntry).filter(Boolean),
    ...bookings.map(bookingToCalendarEntry).filter(Boolean),
  ].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "appointment:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // Hoisted: the create-a-client branch below needs the grid, and so does the
  // response, which carries the whole Client row back. Loading it twice would
  // be two round trips to learn one thing.
  const full = await loadEnforceableMember(db, member.id);

  const body = await request.json();
  const {
    clientId,
    clientName,
    clientPhone,
    scheduledAt,
    location,
    requiresSupervisor,
    assignedToId,
  } = body;

  // Either identifies a client. `clientId` is the precise form and is now
  // accepted — it was not, which meant a caller holding an id had no way to
  // say so and had to hope a name matched.
  if ((!clientId && !clientName) || !scheduledAt) {
    return NextResponse.json(
      { error: "Give a client (clientId or clientName) and a time." },
      { status: 400 },
    );
  }

  // Reassigning to someone else requires appointment:assign — creating your own unassigned appt doesn't
  if (
    assignedToId &&
    assignedToId !== member.userId &&
    !can(member.role, "appointment:assign")
  ) {
    return NextResponse.json(
      {
        error:
          "You can create appointments but only a supervisor or admin can assign them to someone else",
      },
      { status: 403 },
    );
  }

  if (requiresSupervisor && assignedToId) {
    const assignee = await db.member.findUnique({
      where: {
        userId_companyId: { userId: assignedToId, companyId: member.companyId },
      },
    });
    if (
      !assignee ||
      !["owner", "admin", "supervisor"].includes(assignee.role)
    ) {
      return NextResponse.json(
        {
          error:
            "This appointment requires a supervisor or admin to be assigned",
        },
        { status: 400 },
      );
    }
  }

  // ── Find the client before deciding to invent one ────────────────────────
  //
  // This used to look up by PHONE ONLY. Book "Emilio Boves" with no phone
  // number and it created a second Emilio Boves, every time — a duplicate
  // factory that nobody noticed because the create was silent.
  //
  // Adding the permission check in front of that create turned a silent bug
  // into a loud one: QA booked against a client who was plainly on file and
  // got "That client isn't on file yet", which was both a refusal and a lie.
  //
  // So resolution comes first and tries everything the caller gave us, most
  // precise first. Only a genuine miss reaches the create path.
  let client = null;

  if (clientId) {
    // Scoped to the company: an id from another tenant must miss, not throw.
    client = await db.client.findFirst({
      where: { id: clientId, companyId: member.companyId },
    });
    if (!client) {
      return NextResponse.json(
        { error: "That client isn't on this account." },
        { status: 404 },
      );
    }
  }

  if (!client && clientPhone) {
    client = await db.client.findFirst({
      where: { companyId: member.companyId, phone: clientPhone },
    });
  }

  if (!client && clientName) {
    // Case-insensitive exact match. Deliberately not `contains`: booking
    // "Emilio" against a client called "Emilio Boves Construction" would be a
    // guess, and guessing which customer an appointment belongs to is worse
    // than asking.
    client = await db.client.findFirst({
      where: {
        companyId: member.companyId,
        name: { equals: String(clientName).trim(), mode: "insensitive" },
      },
    });
  }

  if (!client) {
    // ── A side effect is still a create ──────────────────────────────────
    //
    // POST /api/clients requires clientsProperties:full_edit. This endpoint
    // used to create a client with no check at all, which meant the 403 on
    // the clients route was decorative: QA posted an appointment as an
    // employee restricted to name_address_only, got a 201, and a client
    // record appeared. Worse, the same employee then could not delete it —
    // deletion IS gated — so the bypass was one-way.
    //
    // The same level is required here as on the front door. Booking an
    // appointment for an EXISTING client is untouched; only conjuring a new
    // client record needs the permission that creating one needs.
    if (!hasLevel(full, "clientsProperties", "full_edit")) {
      return NextResponse.json(
        {
          error:
            `No client named "${String(clientName || "").trim()}" is on file, ` +
            "and your access level doesn't allow you to add one. Ask someone " +
            "who can, then book against them.",
        },
        { status: 403 },
      );
    }

    client = await db.client.create({
      data: {
        companyId: member.companyId,
        name: clientName,
        phone: clientPhone || null,
      },
    });
  }

  const appointment = await db.appointment.create({
    data: {
      companyId: member.companyId,
      clientId: client.id,
      scheduledAt: new Date(scheduledAt),
      location: location || null,
      requiresSupervisor: !!requiresSupervisor,
      status:
        requiresSupervisor && !assignedToId ? "needs_supervisor" : "scheduled",
      createdById: member.userId,
      assignedToId: assignedToId || null,
    },
    include: { client: true, assignedTo: { select: { id: true, name: true } } },
  });

  // Redacted like the list and like /api/appointments/[id]. Booking an
  // appointment against an existing client is allowed at name_address_only —
  // reading that client's phone number back out of the 201 is not, and "you
  // created it so you may see it" is not true here: the client already existed.
  return NextResponse.json(
    { ...appointment, client: redactClient(full, appointment.client) },
    { status: 201 },
  );
}
