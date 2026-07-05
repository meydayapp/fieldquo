// app/api/jobs/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const jobs = await db.job.findMany({
    where: { companyId: member.companyId, ...(status && { status }) },
    include: {
      client: { select: { id: true, name: true } },
      visits: { orderBy: { scheduledAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "job:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const { clientId, quoteId, title, recurring, recurrenceRule } = body;

  if (!clientId || !title) {
    return NextResponse.json(
      { error: "clientId and title are required" },
      { status: 400 },
    );
  }

  const job = await db.job.create({
    data: {
      companyId: member.companyId,
      clientId,
      quoteId: quoteId || null,
      title,
      recurring: !!recurring,
      recurrenceRule: recurrenceRule || null,
    },
    include: { client: true },
  });

  return NextResponse.json(job, { status: 201 });
}
