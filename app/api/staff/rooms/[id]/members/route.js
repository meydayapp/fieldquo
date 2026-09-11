// app/api/staff/rooms/[id]/members/route.js
//
// Who is in a room, and adding people to it.
//
// GET  → { room, canManage, canLeave, canAdd, members: [{ kind, id, name,
//          email, label, engagement, presence, isOwner, isYou, canRemove }] }
// POST { members: [{ kind, id }] } → { ok, added }
//        any open member may add; codes: no_room | direct_room |
//        member_unknown | nobody_named
//
// Removing is DELETE on ../members/[memberKey], and it never deletes a row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { membersOf, addMembers } from "@/lib/staff/store";

export async function GET(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const result = await membersOf(viewer, id);
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(result);
}

export async function POST(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await addMembers({ viewer, roomId: id, members: body?.members });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, added: result.added });
}
