// app/api/appointments/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appt = await db.appointment.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { client: true, assignedTo: { select: { id: true, name: true } } },
  });

  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(appt);
}

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.appointment.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Changing who it's assigned to requires appointment:assign, unless someone is unassigning themselves
  if (
    "assignedToId" in body &&
    body.assignedToId !== existing.assignedToId &&
    body.assignedToId !== member.userId &&
    !can(member.role, "appointment:assign")
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can reassign this appointment" },
      { status: 403 },
    );
  }

  if (
    existing.requiresSupervisor &&
    "assignedToId" in body &&
    body.assignedToId
  ) {
    const assignee = await db.member.findUnique({
      where: {
        userId_companyId: {
          userId: body.assignedToId,
          companyId: member.companyId,
        },
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

  const updated = await db.appointment.update({
    where: { id: params.id },
    data: {
      ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.status && { status: body.status }),
      ...("assignedToId" in body && {
        assignedToId: body.assignedToId || null,
        status:
          body.assignedToId && existing.status === "needs_supervisor"
            ? "scheduled"
            : existing.status,
      }),
    },
    include: { client: true, assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.appointment.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.appointment.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
