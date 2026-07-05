// app/api/jobs/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, companyId: member.companyId },
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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.job.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, status, recurring, recurrenceRule } = body;

  const updated = await db.job.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(status !== undefined && { status }),
      ...(recurring !== undefined && { recurring }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
    },
    include: { client: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.job.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.job.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
