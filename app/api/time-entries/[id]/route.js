// app/api/time-entries/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { resolveWallClock } from "@/lib/time/wallClock";
import { recordActivity } from "@/lib/activity/log";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.timeEntry.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
    include: { worker: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Company scope was the only check here, so anyone could clock a colleague
  // out — retroactively, at whatever time they chose, on the hours that feed
  // payroll. Mirrors the list endpoint's own-vs-everyone split; the separate
  // status gate below still applies on top.
  const full = await loadEnforceableMember(db, member.id);
  if (
    !hasLevel(full, "timeTracking", "view_record_edit_all") &&
    existing.worker?.userId !== member.userId
  ) {
    return NextResponse.json(
      { error: "You can only change your own time entries." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { clockOut, status } = body;

  // Approving/rejecting requires a manager — editing your own open entry (clocking
  // out) doesn't
  if (
    status &&
    status !== "pending" &&
    !["owner", "admin", "supervisor"].includes(member.role)
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can approve time entries" },
      { status: 403 },
    );
  }

  let hours = existing.hours;
  // Same wall-clock rule as the POST route — the manual form's end time is a
  // bare "2026-08-20T17:00" and only means something once resolved in the
  // company's zone. `hours` is computed from this, and `hours` is what payroll
  // pays, so getting it wrong here is money.
  const company = await db.company.findUnique({
    where: { id: member.companyId }, // the query above already scoped to it
    select: { timezone: true },
  });
  const resolvedClockOut = clockOut
    ? resolveWallClock(clockOut, company?.timezone)
    : existing.clockOut;

  if (clockOut && !resolvedClockOut) {
    return NextResponse.json(
      { error: "That end time isn't a valid date and time." },
      { status: 400 },
    );
  }

  if (resolvedClockOut) {
    const clockInMs = existing.clockIn.getTime();
    const clockOutMs = resolvedClockOut.getTime();
    if (clockOutMs <= clockInMs) {
      return NextResponse.json(
        { error: "clockOut must be after clockIn" },
        { status: 400 },
      );
    }
    hours = Math.round(((clockOutMs - clockInMs) / 3600000) * 100) / 100;
  }

  const selfApproved =
    status === "approved" && existing.worker?.userId === member.userId;

  const updated = await db.timeEntry.update({
    where: { id: _params.id },
    data: {
      ...(clockOut !== undefined && { clockOut: resolvedClockOut, hours }),
      ...(status !== undefined && {
        status,
        approvedById:
          status === "approved" ? member.userId : existing.approvedById,
      }),
    },
    include: { worker: { select: { id: true, name: true } } },
  });

  // ── The trail the Activity Log page promises and didn't keep ────────────
  //
  // Approved hours are what a pay run multiplies by an hourly rate. QA created
  // entries for two colleagues, approved all three including their own, and
  // pushed them into a $332.77 pay run — with no record of any of it, while
  // the page told the owner it keeps "a record of important actions".
  //
  // Self-approval is recorded distinctly rather than refused. A sole trader
  // who is the only worker has nobody else to approve their hours, and
  // blocking it would break the smallest companies to police the larger ones.
  // Naming it in the trail is what makes it reviewable.
  if (status !== undefined) {
    await recordActivity(member, {
      action: selfApproved ? "timeEntry.selfApproved" : `timeEntry.${status}`,
      entityType: "timeEntry",
      entityId: updated.id,
      summary: selfApproved
        ? `Approved their own hours — ${updated.hours ?? "?"}h`
        : `${status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated"} ${updated.worker?.name || "a worker"}'s hours — ${updated.hours ?? "?"}h`,
      metadata: { hours: updated.hours ?? null, status, selfApproved },
    });
  } else if (clockOut !== undefined) {
    await recordActivity(member, {
      action: "timeEntry.clockedOut",
      entityType: "timeEntry",
      entityId: updated.id,
      summary: `Clocked out ${updated.worker?.name || "a worker"} — ${updated.hours ?? "?"}h`,
      metadata: { hours: updated.hours ?? null },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can delete time entries" },
      { status: 403 },
    );
  }

  const existing = await db.timeEntry.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status === "approved") {
    return NextResponse.json(
      {
        error:
          "Can't delete an approved time entry — it may already be reflected in a payout",
      },
      { status: 400 },
    );
  }

  await db.timeEntry.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
