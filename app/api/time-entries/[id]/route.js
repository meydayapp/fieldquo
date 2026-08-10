// app/api/time-entries/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const resolvedClockOut = clockOut ? new Date(clockOut) : existing.clockOut;

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

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
