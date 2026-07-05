// app/api/tasks/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can, requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");

  const tasks = await db.task.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      workArea: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "task:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const {
    title,
    description,
    dueDate,
    priority,
    assignedToId,
    clientId,
    quoteId,
    invoiceId,
    workAreaId,
  } = body;

  if (!title)
    return NextResponse.json({ error: "title is required" }, { status: 400 });

  if (
    assignedToId &&
    assignedToId !== member.userId &&
    !can(member.role, "task:assign")
  ) {
    return NextResponse.json(
      {
        error:
          "You can create tasks but only a supervisor or admin can assign them to someone else",
      },
      { status: 403 },
    );
  }

  const task = await db.task.create({
    data: {
      companyId: member.companyId,
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "normal",
      createdById: member.userId,
      assignedToId: assignedToId || null,
      clientId: clientId || null,
      quoteId: quoteId || null,
      invoiceId: invoiceId || null,
      workAreaId: workAreaId || null,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(task, { status: 201 });
}
