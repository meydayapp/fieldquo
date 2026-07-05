// app/api/time-entries/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.timeEntry.findFirst({
    where: { id: params.id, worker: { companyId: member.companyId } },
    include: { worker: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    where: { id: params.id },
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
    where: { id: params.id, worker: { companyId: member.companyId } },
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

  await db.timeEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
