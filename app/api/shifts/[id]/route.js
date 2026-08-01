// app/api/shifts/[id]/route.js — edit or delete one shift (manager only).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

async function ownShift(member, id) {
  return db.shift.findFirst({ where: { id, companyId: member.companyId } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(member.role, "user:manage")) {
    return NextResponse.json({ error: "Only an admin or owner can edit shifts." }, { status: 403 });
  }
  const existing = await ownShift(member, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.start !== undefined) data.start = new Date(body.start);
  if (body.end !== undefined) data.end = new Date(body.end);
  if (body.note !== undefined) data.note = body.note ? String(body.note).slice(0, 300) : null;
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.jobId !== undefined) data.jobId = body.jobId || null;

  const start = data.start ?? existing.start;
  const end = data.end ?? existing.end;
  if (end <= start) {
    return NextResponse.json({ error: "The shift's end must be after its start." }, { status: 400 });
  }

  const shift = await db.shift.update({
    where: { id },
    data,
    select: { id: true, workerId: true, start: true, end: true, note: true, published: true },
  });
  return NextResponse.json({ ok: true, shift });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(member.role, "user:manage")) {
    return NextResponse.json({ error: "Only an admin or owner can delete shifts." }, { status: 403 });
  }
  const existing = await ownShift(member, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
