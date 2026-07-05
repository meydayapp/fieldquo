// app/api/workers/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await db.worker.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: {
      timeEntries: { orderBy: { clockIn: "desc" }, take: 20 },
      payouts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!worker)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(worker);
}

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, email, hourlyRate, active } = body;

  // type is intentionally NOT editable here — flipping contractor<->employee has real
  // legal/tax implications and shouldn't be a casual field update. Treat it as
  // "deactivate this worker record, create a new one" if that's genuinely needed.
  const updated = await db.worker.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(hourlyRate !== undefined && { hourlyRate }),
      ...(active !== undefined && { active }),
    },
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
      { error: "Only owners/admins can remove workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { payouts: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.payouts.length > 0) {
    // Same principle as everywhere else in this app: don't let a payment history
    // record disappear. Deactivate instead.
    await db.worker.update({
      where: { id: params.id },
      data: { active: false },
    });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await db.worker.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true, deleted: true });
}
