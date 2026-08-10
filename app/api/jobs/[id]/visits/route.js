// app/api/jobs/[id]/visits/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visits = await db.jobVisit.findMany({
    where: { jobId: _params.id },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(visits);
}

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId },
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

  // Normalised, not stored as posted. The browser sends whatever the picker
  // assembled — bare strings from an older client, `{label}` from a template —
  // and the job page reads `item.label`, so an unnormalised array rendered as
  // a column of "Untitled item". Null (not []) when there's nothing, so "no
  // checklist" stays distinguishable from "a checklist with no steps left".
  const items = normalizeChecklistItems(checklistItems);

  const visit = await db.jobVisit.create({
    data: {
      jobId: _params.id,
      scheduledAt: new Date(scheduledAt),
      assignedToId: assignedToId || null,
      checklistItems: items.length ? items : null,
      notes: notes || null,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  // Scheduling a visit IS scheduling the job — flip it off "needs a date"
  // automatically. Only from `unscheduled` so a completed/in-progress/cancelled
  // job that gains a follow-up visit isn't dragged backwards to "scheduled".
  if (job.status === "unscheduled") {
    await db.job.update({
      where: { id: _params.id },
      data: { status: "scheduled" },
    });
  }

  return NextResponse.json(visit, { status: 201 });
}
