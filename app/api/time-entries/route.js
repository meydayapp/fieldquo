// app/api/time-entries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveWallClock } from "@/lib/time/wallClock";
import { recordActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, redactPayList } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { PUNCH_WINDOW_MS } from "@/lib/shifts/attendance";

// ── The rota's verdict beside the punch ─────────────────────────────────────
//
// ShiftAttendance is per SHIFT (the plan); a timesheet row is per ENTRY (what
// happened). They are joined here by worker and by the punch window
// lib/shifts/attendance.js uses to decide which punches belong to a shift,
// so the chip on the row says the same thing the day board's block says.
// An entry with no published shift around it has no verdict and no chip.
async function attachAttendance(entries) {
  if (!entries.length) return entries;
  const workerIds = [...new Set(entries.map((e) => e.workerId))];
  const times = entries.map((e) => new Date(e.clockIn).getTime());
  const lo = new Date(Math.min(...times) - PUNCH_WINDOW_MS);
  const hi = new Date(Math.max(...times) + PUNCH_WINDOW_MS);
  const rows = await db.shiftAttendance.findMany({
    where: { workerId: { in: workerIds }, shift: { start: { lte: hi }, end: { gte: lo } } },
    select: {
      workerId: true,
      status: true,
      final: true,
      lateMinutes: true,
      earlyMinutes: true,
      shift: { select: { start: true, end: true } },
    },
  });
  return entries.map((e) => {
    const at = new Date(e.clockIn).getTime();
    const hit = rows.find(
      (r) =>
        r.workerId === e.workerId &&
        at >= new Date(r.shift.start).getTime() - PUNCH_WINDOW_MS &&
        at <= new Date(r.shift.end).getTime() + PUNCH_WINDOW_MS,
    );
    return hit
      ? { ...e, attendance: { status: hit.status, final: hit.final, lateMinutes: hit.lateMinutes, earlyMinutes: hit.earlyMinutes } }
      : e;
  });
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
      // hourlyRate stays selected — the payroll builder needs it — and is
      // stripped below for callers who may not see other people's pay.
      worker: { select: { id: true, name: true, hourlyRate: true, userId: true } },
      job: { select: { id: true, title: true } },
      // The lunch and breaks punched on the clock — why `hours` is less than
      // clock-in to clock-out, shown as minutes on the timesheet row.
      breaks: {
        orderBy: { start: "asc" },
        select: { id: true, start: true, end: true, kind: true, paid: true },
      },
      // Where the phone was at clock-in and clock-out, when it answered. The
      // stored distance, not the raw point: the timesheet needs "2.1 km from
      // the site", and never needs to draw the crew on a map. See
      // LocationStamp and lib/geo/distance.js for what "unknown" covers.
      locationStamps: {
        orderBy: { at: "asc" },
        select: { id: true, kind: true, distanceToSiteM: true, accuracyM: true, at: true },
      },
    },
    orderBy: { clockIn: "desc" },
  });

  // Each entry embeds the worker's rate, which made this a third door onto
  // payroll for anyone who could read timesheets. Own entries keep it.
  return NextResponse.json(
    redactPayList(full, await attachAttendance(entries), { ownUserId: member.userId }),
  );
}

// Clock in — clockOut is set later via PATCH on the [id] route
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  // The worker above was proved to be ours; the job was not. A time entry
  // booked against another tenant's jobId lands in THEIR job costing — hours
  // and labour cost against a job they can see and we cannot — which is a
  // cross-tenant WRITE rather than a read, and silent on both sides.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobId });
  if (notOurs) return notOurs;

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
