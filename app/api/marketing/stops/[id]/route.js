// app/api/marketing/stops/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

// A stop belongs to the member's company iff its campaign does. Load both so
// we can authorize and mutate in one place.
async function loadOwnedStop(companyId, id) {
  const stop = await db.pamphletStop.findUnique({
    where: { id },
    include: { campaign: { select: { companyId: true } } },
  });
  if (!stop || stop.campaign.companyId !== companyId) return null;
  return stop;
}

const STOP_STATUSES = ["pending", "delivered", "spoke", "not_home", "skipped"];

// Field updates — the assigned employee marking what happened at the door.
// Deliberately open to any active member: distribution is fieldwork, and the
// person walking the route is often an employee without user:manage. Manager-
// only concerns (reassigning the stop to someone else) are still gated.
export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stop = await loadOwnedStop(member.companyId, _params.id);
  if (!stop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { status, spokeToOwner, notes, assignedToId } = body;

  if (status !== undefined && !STOP_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (assignedToId !== undefined && !can(member.role, "user:manage")) {
    return NextResponse.json(
      { error: "Only managers can reassign stops" },
      { status: 403 },
    );
  }

  const updated = await db.pamphletStop.update({
    where: { id: _params.id },
    data: {
      ...(status !== undefined && { status }),
      ...(spokeToOwner !== undefined && { spokeToOwner: !!spokeToOwner }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(assignedToId !== undefined && {
        assignedToId: assignedToId || null,
      }),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

// Convert a doorstep conversation into real records. Two optional steps:
//  - Always: create (or reuse) a Client from the stop's address + provided
//    name, link it, and flag the stop as spoke/spokeToOwner.
//  - If scheduledAt is provided AND the member has appointment:create: also
//    create an Appointment for that client and link it back.
// A full quote isn't built here (it needs scope/line items) — the UI instead
// deep-links to the quote builder pre-scoped to the new client.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stop = await loadOwnedStop(member.companyId, _params.id);
  if (!stop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { clientName, clientPhone, clientEmail, scheduledAt } = body;

  // Reuse an already-linked client, else create one from the doorstep info.
  let clientId = stop.clientId;
  if (!clientId) {
    const client = await db.client.create({
      data: {
        companyId: member.companyId,
        name: clientName?.trim() || stop.address,
        phone: clientPhone || null,
        email: clientEmail || null,
        address: stop.address,
      },
    });
    clientId = client.id;
  }

  let appointmentId = stop.appointmentId;
  if (scheduledAt) {
    if (!can(member.role, "appointment:create")) {
      return NextResponse.json(
        { error: "You don't have permission to schedule appointments" },
        { status: 403 },
      );
    }
    const appointment = await db.appointment.create({
      data: {
        companyId: member.companyId,
        clientId,
        scheduledAt: new Date(scheduledAt),
        location: stop.address,
        notes: `Created from pamphlet stop (${stop.address})`,
        createdById: member.userId,
      },
    });
    appointmentId = appointment.id;
  }

  const updated = await db.pamphletStop.update({
    where: { id: _params.id },
    data: {
      clientId,
      appointmentId,
      status: "spoke",
      spokeToOwner: true,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stop = await loadOwnedStop(member.companyId, _params.id);
  if (!stop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.pamphletStop.delete({ where: { id: _params.id } });
  return NextResponse.json({ ok: true });
}
