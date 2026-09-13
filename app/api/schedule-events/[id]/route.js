// app/api/schedule-events/[id]/route.js — edit or remove one event (schedule edit_all).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { hasLevel, loadEnforceableMember } from "@/lib/permissions/enforce";

async function gate(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_all")) {
    return { response: NextResponse.json({ error: "Only whoever runs the rota can change an event." }, { status: 403 }) };
  }
  return { member };
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await gate(request);
  if (response) return response;
  const existing = await db.scheduleEvent.findFirst({ where: { id, companyId: member.companyId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim().slice(0, 600) : null;
  const event = await db.scheduleEvent.update({ where: { id }, data, select: { id: true, date: true, title: true, description: true } });
  return NextResponse.json({ ok: true, event });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await gate(request);
  if (response) return response;
  const existing = await db.scheduleEvent.findFirst({ where: { id, companyId: member.companyId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.scheduleEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
