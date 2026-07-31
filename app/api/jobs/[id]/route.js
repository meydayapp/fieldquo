// app/api/jobs/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: id, companyId: member.companyId },
    include: {
      client: true,
      quote: { select: { id: true, quoteNumber: true } },
      visits: {
        orderBy: { scheduledAt: "asc" },
        include: { assignedTo: { select: { id: true, name: true } } },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "edit jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.job.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, status, recurring, recurrenceRule } = body;

  // Stamp when the work actually finished.
  //
  // Set on the FIRST flip to completed and never moved afterwards. The
  // follow-up cron used to key off `updatedAt`, which meant renaming a job
  // three weeks later re-armed every "how did we do?" email attached to it.
  // Cleared if the job comes back out of completed, because a job that isn't
  // finished has no finish time.
  const completing = status === "completed" && existing.status !== "completed";
  const reopening = status !== undefined && status !== "completed" && existing.completedAt;

  const updated = await db.job.update({
    where: { id: id },
    data: {
      ...(title !== undefined && { title }),
      ...(status !== undefined && { status }),
      ...(completing && { completedAt: new Date() }),
      ...(reopening && { completedAt: null }),
      ...(recurring !== undefined && { recurring }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
    },
    include: { client: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit_delete", "delete jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.job.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.job.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
