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
      // Auto-created tasks ("ask them for a review") are only actionable if you
      // can get to the job they came from — a title alone makes you search for
      // it. Title and status only: the row shows a link, not a job summary.
      job: { select: { id: true, title: true, status: true } },
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
    jobId,
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

  // Every linked id must belong to THIS company — otherwise a member could link
  // a task to another tenant's client/quote/invoice and GET /api/tasks would
  // read that tenant's client name back. Mirrors the guard on the jobs route.
  const ownsOrNull = async (model, id) => {
    if (!id) return true;
    const row = await db[model].findFirst({
      where: { id, companyId: member.companyId },
      select: { id: true },
    });
    return Boolean(row);
  };
  const [okClient, okQuote, okInvoice, okJob, okArea] = await Promise.all([
    ownsOrNull("client", clientId),
    ownsOrNull("quote", quoteId),
    ownsOrNull("invoice", invoiceId),
    ownsOrNull("job", jobId),
    ownsOrNull("workArea", workAreaId),
  ]);
  if (!okClient || !okQuote || !okInvoice || !okJob || !okArea) {
    return NextResponse.json(
      { error: "A linked record wasn't found for your company." },
      { status: 400 },
    );
  }
  if (assignedToId) {
    const isMember = await db.member.findFirst({
      where: { userId: assignedToId, companyId: member.companyId },
      select: { id: true },
    });
    if (!isMember)
      return NextResponse.json(
        { error: "That person isn't on your team." },
        { status: 400 },
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
      jobId: jobId || null,
      workAreaId: workAreaId || null,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      job: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
