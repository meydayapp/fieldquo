// app/api/tasks/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.task.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Creating was gated and editing was not ─────────────────────────────
  //
  // POST /api/tasks requires "task:create", which a Worker does not hold. This
  // route required only a session, so a Worker who could not add a to-do could
  // rename or complete ANY of the company's — including ones assigned to
  // somebody else, or to nobody.
  //
  // Your OWN task stays editable with no permission at all: ticking off the
  // job you were given is the entire point of a to-do list, and gating that on
  // task:create would make the list read-only for the people who work from it.
  //
  // An unassigned task is claimable the same way an unassigned appointment is
  // — assigning it to YOURSELF is allowed, anything else about it is not.
  const mine =
    !!member.userId &&
    (existing.assignedToId === member.userId ||
      existing.createdById === member.userId);
  const claimable = existing.assignedToId === null;
  if (!mine && !claimable && !can(member.role, "task:create")) {
    return NextResponse.json(
      {
        error:
          "You can only change to-dos assigned to you. Ask an owner or admin " +
          "to change this one.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();

  if (
    "assignedToId" in body &&
    body.assignedToId !== existing.assignedToId &&
    body.assignedToId !== member.userId &&
    !can(member.role, "task:assign")
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can reassign this task" },
      { status: 403 },
    );
  }

  const updated = await db.task.update({
    where: { id: _params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }),
      ...("assignedToId" in body && {
        assignedToId: body.assignedToId || null,
      }),
      ...(body.workAreaId !== undefined && { workAreaId: body.workAreaId }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.task.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.task.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
