// app/api/jobs/[id]/visits/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visits = await db.jobVisit.findMany({
    where: { jobId: params.id },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(visits);
}

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { scheduledAt, assignedToId, checklistItems, notes } = body;

  if (!scheduledAt) {
    return NextResponse.json(
      { error: "scheduledAt is required" },
      { status: 400 },
    );
  }

  if (assignedToId && assignedToId !== member.userId) {
    try {
      requirePermission(member.role, "job:assign");
    } catch (err) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status || 403 },
      );
    }
  }

  const visit = await db.jobVisit.create({
    data: {
      jobId: params.id,
      scheduledAt: new Date(scheduledAt),
      assignedToId: assignedToId || null,
      checklistItems: checklistItems || null,
      notes: notes || null,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(visit, { status: 201 });
}
