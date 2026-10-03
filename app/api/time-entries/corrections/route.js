// app/api/time-entries/corrections/route.js
//
// "Request a correction" on one's own time entry, and the list of requests.
//
// The owner, 2026-10-03: crew can fix their own hours, but only as a REQUEST
// that a manager approves. So this route writes a TimeEntryCorrection and
// nothing else — the entry is not touched until PATCH ./[id] approves it.
// The rules (what a request may say, what approving writes) are
// lib/timeclock/corrections.js.
//
// GET: a manager (timeTracking at view_record_edit_all — the same people the
// timesheet shows everyone's hours to) sees the company's requests; anyone
// else sees their own. A filter, never a 403, the way /api/time-entries is.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { canUseTimeClock, CLOCK_REFUSAL } from "@/lib/timeclock/access";
import { clockableJobWhere } from "@/lib/timeclock/jobChoices";
import { validateCorrection, overlapsOthers, CORRECTION_WORDS } from "@/lib/timeclock/corrections";
import { resolveWallClock } from "@/lib/time/wallClock";
import { recordActivity } from "@/lib/activity/log";

const CORRECTION_SELECT = {
  id: true,
  timeEntryId: true,
  workerId: true,
  requestedById: true,
  clockIn: true,
  clockOut: true,
  activity: true,
  jobId: true,
  reason: true,
  status: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  original: true,
  createdAt: true,
  timeEntry: {
    select: {
      id: true,
      clockIn: true,
      clockOut: true,
      hours: true,
      activity: true,
      jobId: true,
      status: true,
      job: { select: { id: true, title: true } },
      worker: { select: { id: true, name: true } },
    },
  },
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const seesEveryone = hasLevel(full, "timeTracking", "view_record_edit_all");
  const status = new URL(request.url).searchParams.get("status");
  const rows = await db.timeEntryCorrection.findMany({
    where: {
      companyId: member.companyId,
      ...(seesEveryone ? {} : { requestedById: member.userId }),
      ...(["pending", "approved", "rejected"].includes(status) ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: CORRECTION_SELECT,
  });
  // The requested job's title, for the reviewer — one query for the page.
  const jobIds = [...new Set(rows.map((r) => r.jobId).filter(Boolean))];
  const jobs = jobIds.length
    ? await db.job.findMany({ where: { id: { in: jobIds }, companyId: member.companyId }, select: { id: true, title: true } })
    : [];
  const titles = new Map(jobs.map((j) => [j.id, j.title]));
  return NextResponse.json({
    scope: seesEveryone ? "all" : "own",
    corrections: rows.map((r) => ({ ...r, job: r.jobId ? { id: r.jobId, title: titles.get(r.jobId) || null } : null })),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Impersonation is read-only." }, { status: 403 });
  }
  const full = await loadEnforceableMember(db, member.id);
  if (!canUseTimeClock(full)) return NextResponse.json({ error: CLOCK_REFUSAL }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  // Only the requester's OWN entry: scoped through the worker's login, so an
  // id from somebody else's log finds nothing.
  const entry =
    typeof body?.timeEntryId === "string"
      ? await db.timeEntry.findFirst({
          where: { id: body.timeEntryId, worker: { companyId: member.companyId, userId: member.userId } },
          include: { breaks: { select: { id: true, start: true, end: true, kind: true, paid: true } } },
        })
      : null;
  if (!entry) return NextResponse.json({ error: CORRECTION_WORDS.not_found }, { status: 404 });
  if (entry.billedInvoiceId) {
    return NextResponse.json(
      { error: "These hours are already on an invoice. Ask your manager — the invoice has to change first." },
      { status: 409 },
    );
  }

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { timezone: true } });
  const clockIn = resolveWallClock(body?.clockIn, company?.timezone);
  const clockOut = resolveWallClock(body?.clockOut, company?.timezone);
  const verdict = validateCorrection({
    entry,
    clockIn,
    clockOut,
    activity: body?.activity ?? null,
    // Absent means "the same job"; "" or null means "no job".
    jobId: Object.prototype.hasOwnProperty.call(body || {}, "jobId") ? body.jobId : undefined,
    reason: body?.reason,
  });
  if (verdict.error) return NextResponse.json({ error: CORRECTION_WORDS[verdict.error] || "That correction can't be sent." }, { status: 400 });

  // A job they name must be one they may book time to — the same proof the
  // clock's own punches go through.
  if (verdict.jobId && verdict.jobId !== (entry.jobId || null)) {
    const ok = await db.job.findFirst({
      where: clockableJobWhere({ companyId: member.companyId, full, jobId: verdict.jobId }),
      select: { id: true },
    });
    if (!ok) return NextResponse.json({ error: "That job isn't one you can record time against." }, { status: 400 });
  }

  const pending = await db.timeEntryCorrection.findFirst({
    where: { timeEntryId: entry.id, status: "pending" },
    select: { id: true },
  });
  if (pending) {
    return NextResponse.json({ error: "You've already asked for a correction to this entry — it's waiting for your manager." }, { status: 409 });
  }

  const others = await db.timeEntry.findMany({
    where: {
      workerId: entry.workerId,
      clockIn: { lt: verdict.clockOut },
      OR: [{ clockOut: null }, { clockOut: { gt: verdict.clockIn } }],
    },
    select: { id: true, clockIn: true, clockOut: true },
  });
  if (overlapsOthers({ entryId: entry.id, clockIn: verdict.clockIn, clockOut: verdict.clockOut, others })) {
    return NextResponse.json({ error: "Those times overlap another of your entries." }, { status: 409 });
  }

  const correction = await db.timeEntryCorrection.create({
    data: {
      companyId: member.companyId,
      timeEntryId: entry.id,
      workerId: entry.workerId,
      requestedById: member.userId,
      clockIn: verdict.clockIn,
      clockOut: verdict.clockOut,
      activity: verdict.activity,
      jobId: verdict.jobId,
      reason: verdict.reason,
      status: "pending",
    },
    select: { id: true, status: true, clockIn: true, clockOut: true, activity: true, jobId: true, reason: true, timeEntryId: true },
  });
  await recordActivity(member, {
    action: "timeEntry.correctionRequested",
    entityType: "timeEntry",
    entityId: entry.id,
    summary: "Asked for a time entry to be corrected",
    summaryKey: "app.activity.event.correctionRequested",
    metadata: { correctionId: correction.id, workerId: entry.workerId },
  });
  return NextResponse.json({ ok: true, correction }, { status: 201 });
}
