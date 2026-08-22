// app/api/time-entries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveWallClock } from "@/lib/time/wallClock";
import { recordActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

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

  // "View and record their own" is a filter, not a gate — the list endpoint
  // should return their rows, not 403. TimeEntry links to a Worker rather
  // than a User, so the scope goes on the nested relation.
  const full = await loadEnforceableMember(db, member.id);
  const seesEveryone = hasLevel(full, "timeTracking", "view_record_edit_all");

  const entries = await db.timeEntry.findMany({
    where: {
      worker: {
        companyId: member.companyId,
        ...(seesEveryone ? {} : { userId: member.userId }),
      },
      // A restricted member asking for someone else's workerId gets an empty
      // list rather than an error — the nested scope above wins.
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

  // The same own-vs-everyone split the GET above applies, as a gate rather
  // than a filter — you can't narrow a single insert. Company scope alone let
  // any member open a shift on any colleague's timesheet, and hours are what
  // payroll pays out and what a job gets costed at.
  const full = await loadEnforceableMember(db, member.id);
  if (
    !hasLevel(full, "timeTracking", "view_record_edit_all") &&
    worker.userId !== member.userId
  ) {
    return NextResponse.json(
      { error: "You can only record time against your own timesheet." },
      { status: 403 },
    );
  }

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

  // A wall-clock time typed into the manual form ("2026-08-20T09:00") means
  // 09:00 where the COMPANY is, not where this server happens to run. Passing
  // it to `new Date()` resolved it against the runtime zone — UTC on Vercel —
  // while the form's other end was converted in the browser, so the two ends
  // disagreed by the UTC offset and every manual entry came out long. See
  // lib/time/wallClock.js. Server-stamped clock-ins carry a zone and are
  // returned unchanged.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { timezone: true },
  });
  const clockInAt = clockIn ? resolveWallClock(clockIn, company?.timezone) : new Date();
  if (!clockInAt) {
    return NextResponse.json(
      { error: "That start time isn't a valid date and time." },
      { status: 400 },
    );
  }

  const entry = await db.timeEntry.create({
    data: {
      workerId,
      jobId: jobId || null,
      clockIn: clockInAt,
    },
    include: { worker: { select: { id: true, name: true } } },
  });

  // Creating a time entry for SOMEONE ELSE is a pay input, and it was
  // untracked. Own clock-ins are the ordinary case and stay quiet — logging
  // every clock-in would bury the entries worth reviewing.
  if (worker.userId !== member.userId) {
    await recordActivity(member, {
      action: "timeEntry.createdForOther",
      entityType: "timeEntry",
      entityId: entry.id,
      summary: `Added a time entry for ${worker.name || "a worker"}`,
      metadata: { workerId: worker.id, clockIn: clockInAt.toISOString() },
    });
  }

  return NextResponse.json(entry, { status: 201 });
}
