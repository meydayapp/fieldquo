// app/api/staff/rooms/[id]/leave/route.js
//
// POST → { ok }. Closes the viewer's own membership row; never deletes it.
// The default room refuses (code default_room) — everybody is in it, that is
// what it is for — and so does a direct message (direct_room).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { leaveRoom } from "@/lib/staff/store";

export async function POST(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const result = await leaveRoom({ viewer, roomId: id });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
