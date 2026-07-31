// app/api/appointments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can, requirePermission } from "@/lib/permissions";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Schedule scoping. "View their own schedule" means the calendar shows
  // only their jobs — a filter, not a 403. Unassigned appointments stay
  // visible to everyone: an unclaimed job nobody can see is a job nobody
  // does.
  const full = await loadEnforceableMember(db, member.id);
  const seesEveryone = hasLevel(full, "schedule", "edit_all");

  const appointments = await db.appointment.findMany({
    where: {
      companyId: member.companyId,
      ...(seesEveryone
        ? {}
        : {
            OR: [{ assignedToId: member.userId }, { assignedToId: null }],
          }),
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

  return NextResponse.json(appointments);
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

  const body = await request.json();
  const {
    clientName,
    clientPhone,
    scheduledAt,
    location,
    requiresSupervisor,
    assignedToId,
  } = body;

  if (!clientName || !scheduledAt) {
    return NextResponse.json(
      { error: "clientName and scheduledAt are required" },
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

  // Find or quick-create the client
  let client = clientPhone
    ? await db.client.findFirst({
        where: { companyId: member.companyId, phone: clientPhone },
      })
    : null;

  if (!client) {
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

  return NextResponse.json(appointment, { status: 201 });
}
