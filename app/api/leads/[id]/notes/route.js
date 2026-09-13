// app/api/leads/[id]/notes/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";

// A lead's call-back log. Kept separate from the lead's own `message` (the
// homeowner's words) so "left a voicemail, trying Tue" can't be confused with
// what the client actually asked for.
export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A lead's notes are the lead: "spoke to the owner, budget is soft" is the
  // same record one field over.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;

  // ...and the notes dial is the second gate on the same read. The floor of
  // that ladder, "View notes on jobs and visits only", is exactly what this
  // log is not — see the Notes section of lib/permissions/enforce.js.
  try {
    requireLevel(full, "notes", "view_all", "see notes on requests");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Writing on a lead is the same level PATCH /api/leads/[id] requires.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "change a request",
  );
  if (denied) return denied;

  // The notes dial's WRITE rung. An Estimator sits at notes:view_all and may
  // change the request itself; the call-back log is a separate grant.
  try {
    requireLevel(full, "notes", "view_edit_all", "add notes to requests");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

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
