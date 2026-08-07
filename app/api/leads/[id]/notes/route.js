// app/api/leads/[id]/notes/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// A lead's call-back log. Kept separate from the lead's own `message` (the
// homeowner's words) so "left a voicemail, trying Tue" can't be confused with
// what the client actually asked for.
export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!lead)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await db.leadNote.findMany({
    where: { leadId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!lead)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { body: text } = await request.json();
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed)
    return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });

  const note = await db.leadNote.create({
    data: { leadId: id, authorId: member.userId, body: trimmed.slice(0, 4000) },
    include: { author: { select: { id: true, name: true } } },
  });
  // A note is a touch — nudge the lead's updatedAt so "stale, nobody's touched
  // it" sorting stays honest.
  await db.leadRequest.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json(note, { status: 201 });
}
