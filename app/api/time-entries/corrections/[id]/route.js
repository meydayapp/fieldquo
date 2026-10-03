// app/api/time-entries/corrections/[id]/route.js
//
// A manager approves or rejects a crew member's correction request.
//
// Who: the people who approve timesheets — an owner, admin or supervisor
// seat (the same set PATCH /api/time-entries/[id] lets approve, and
// lib/payroll/timesheetEdit.js lets touch an approved entry) — AND the Time
// Tracking dial at "everyone's", since this changes somebody else's hours.
// Nobody decides their own request, except an owner or admin, who has
// nobody above them to ask.
//
// Approving updates the SAME entry (never deletes or replaces it) through
// lib/timeclock/corrections.js applyCorrection — hours by the one shared
// arithmetic — and stamps the correction with what the entry said before,
// in one transaction. The entry keeps its status: approving the correction
// is the reviewing, the same as a manager amending an entry by hand.
// Rejecting changes nothing but the request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { applyCorrection, overlapsOthers } from "@/lib/timeclock/corrections";
import { resolveTimeActivities } from "@/lib/timeclock/activities";
import { recordActivity } from "@/lib/activity/log";

const APPROVER_ROLES = ["owner", "admin", "supervisor"];

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Impersonation is read-only." }, { status: 403 });
  }
  const full = await loadEnforceableMember(db, member.id);
  if (!APPROVER_ROLES.includes(member.role) || !hasLevel(full, "timeTracking", "view_record_edit_all")) {
    return NextResponse.json({ error: "Only a supervisor or admin who reviews timesheets can decide a correction." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'." }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const correction = await db.timeEntryCorrection.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!correction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (correction.status !== "pending") {
    return NextResponse.json({ error: "That request has already been decided." }, { status: 409 });
  }
  if (correction.requestedById === member.userId && !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Somebody else has to decide your own correction." }, { status: 403 });
  }

  const decided = { decidedById: member.userId, decidedAt: new Date(), decisionNote: note };

  if (decision === "reject") {
    const row = await db.timeEntryCorrection.update({
      where: { id: correction.id },
      data: { status: "rejected", ...decided },
    });
    await recordActivity(member, {
      action: "timeEntry.correctionRejected",
      entityType: "timeEntry",
      entityId: correction.timeEntryId,
      summary: "Rejected a time entry correction",
      summaryKey: "app.activity.event.correctionRejected",
      metadata: { correctionId: correction.id, note },
    });
    return NextResponse.json({ ok: true, correction: row });
  }

  const entry = correction.timeEntryId
    ? await db.timeEntry.findFirst({
        where: { id: correction.timeEntryId, worker: { companyId: member.companyId } },
        include: { breaks: { select: { id: true, start: true, end: true, kind: true, paid: true } } },
      })
    : null;
  if (!entry) return NextResponse.json({ error: "That time entry no longer exists." }, { status: 409 });
  if (entry.billedInvoiceId) {
    return NextResponse.json({ error: "These hours are already on an invoice — change the invoice first." }, { status: 409 });
  }
  // The job, proved again now: a request sits for days, and a job can be
  // moved to another company's id only by a forged request — never trusted.
  if (correction.jobId && correction.jobId !== entry.jobId) {
    const job = await db.job.findFirst({ where: { id: correction.jobId, companyId: member.companyId }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "The job in that request no longer exists." }, { status: 409 });
  }
  const others = await db.timeEntry.findMany({
    where: {
      workerId: entry.workerId,
      clockIn: { lt: correction.clockOut },
      OR: [{ clockOut: null }, { clockOut: { gt: correction.clockIn } }],
    },
    select: { id: true, clockIn: true, clockOut: true },
  });
  if (overlapsOthers({ entryId: entry.id, clockIn: correction.clockIn, clockOut: correction.clockOut, others })) {
    return NextResponse.json({ error: "Those times now overlap another entry of theirs. Fix that one first, or reject this." }, { status: 409 });
  }

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { timeActivities: true } });
  const { data, original, openBreakIds } = applyCorrection(entry, correction, resolveTimeActivities(company?.timeActivities));

  const ops = openBreakIds.map((breakId) =>
    db.timeEntryBreak.update({ where: { id: breakId }, data: { end: data.clockOut } }),
  );
  ops.push(
    db.timeEntry.update({ where: { id: entry.id }, data }),
    db.timeEntryCorrection.update({
      where: { id: correction.id },
      data: { status: "approved", original, ...decided },
    }),
  );
  const results = await db.$transaction(ops);
  await recordActivity(member, {
    action: "timeEntry.correctionApproved",
    entityType: "timeEntry",
    entityId: entry.id,
    summary: `Approved a time entry correction — ${original.hours ?? "?"}h → ${data.hours ?? "?"}h`,
    summaryKey: "app.activity.event.correctionApproved",
    metadata: { correctionId: correction.id, original, applied: { ...data, clockIn: data.clockIn.toISOString(), clockOut: data.clockOut.toISOString() } },
  });
  return NextResponse.json({ ok: true, correction: results.at(-1), entry: results.at(-2) });
}
