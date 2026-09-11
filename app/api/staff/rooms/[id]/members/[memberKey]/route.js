// app/api/staff/rooms/[id]/members/[memberKey]/route.js
//
// Take one person out of a room. `memberKey` is "rep:<id>" or "user:<id>" —
// the same spelling a mention is stored as.
//
// DELETE → { ok }
//   The membership row is CLOSED (open=false, removedAt), never deleted: the
//   messages they wrote stay attributed to somebody, and "was in this channel
//   until March" stays a fact. Owner or superadmin; removing yourself is
//   leaving and follows leaving's rules. Codes: no_room | default_room |
//   direct_room | not_owner | not_member.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { removeMember } from "@/lib/staff/store";
import { parseParticipantKey } from "@/lib/staff/mentions";

export async function DELETE(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id, memberKey } = await params;
  const target = parseParticipantKey(decodeURIComponent(memberKey || ""));
  if (!target) return NextResponse.json({ error: "Say who to remove.", code: "nobody_named" }, { status: 400 });

  const result = await removeMember({ viewer, roomId: id, target });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
