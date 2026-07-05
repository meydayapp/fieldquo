// app/api/time-entries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get("workerId");
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const entries = await db.timeEntry.findMany({
    where: {
      worker: { companyId: member.companyId },
      ...(workerId && { workerId }),
      ...(jobId && { jobId }),
      ...(status && { status }),
      ...(from &&
        to && { clockIn: { gte: new Date(from), lte: new Date(to) } }),
    },
    include: {
      worker: { select: { id: true, name: true, hourlyRate: true } },
      job: { select: { id: true, title: true } },
    },
    orderBy: { clockIn: "desc" },
  });

  return NextResponse.json(entries);
}

// Clock in — clockOut is set later via PATCH on the [id] route
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workerId, jobId, clockIn } = await request.json();

  if (!workerId) {
    return NextResponse.json(
      { error: "workerId is required" },
      { status: 400 },
    );
  }

  const worker = await db.worker.findFirst({
    where: { id: workerId, companyId: member.companyId },
  });
  if (!worker)
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  // Prevent double clock-in — a worker can't have two open entries at once
  const openEntry = await db.timeEntry.findFirst({
    where: { workerId, clockOut: null },
  });
  if (openEntry) {
    return NextResponse.json(
      { error: "This worker already has an open time entry — clock out first" },
      { status: 409 },
    );
  }

  const entry = await db.timeEntry.create({
    data: {
      workerId,
      jobId: jobId || null,
      clockIn: clockIn ? new Date(clockIn) : new Date(),
    },
    include: { worker: { select: { id: true, name: true } } },
  });

  return NextResponse.json(entry, { status: 201 });
}
