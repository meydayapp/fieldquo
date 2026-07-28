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
