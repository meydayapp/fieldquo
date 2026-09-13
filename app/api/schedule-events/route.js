// app/api/schedule-events/route.js
//
// Company events on the week board's Events row — "Safety meeting 7:30",
// "Yard closed" — and on every worker's Home and Schedule for that day.
// GET ?from&to lists them (anyone on the roster: an event is for everyone);
// POST creates one (schedule edit_all, the same level as writing a shift).
// A calendar DATE, midnight UTC, like LeaveRequest.startDate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { hasLevel, loadEnforceableMember } from "@/lib/permissions/enforce";

const SELECT = { id: true, date: true, title: true, description: true, createdAt: true, createdBy: { select: { name: true } } };

function dateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const from = new Date(searchParams.get("from") || "");
  const to = new Date(searchParams.get("to") || "");
  if (isNaN(from) || isNaN(to) || to < from) return NextResponse.json({ error: "from and to are required." }, { status: 400 });
  const events = await db.scheduleEvent.findMany({
    where: { companyId: member.companyId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    select: SELECT,
  });
  return NextResponse.json({ events });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_all")) {
    return NextResponse.json({ error: "Only whoever runs the rota can add an event." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const date = dateOnly(body.date);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!date || !title) return NextResponse.json({ error: "A date and a title are required." }, { status: 400 });
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 600) : null;
  const event = await db.scheduleEvent.create({
    data: { companyId: member.companyId, date, title, description, createdById: member.userId || null },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, event });
}
