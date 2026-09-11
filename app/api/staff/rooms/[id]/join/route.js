// app/api/staff/rooms/[id]/join/route.js
//
// POST → { ok, roomId }. Join a PUBLIC channel from "Channels you can join".
// A private channel answers 404, exactly as a room that does not exist does.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { joinRoom } from "@/lib/staff/store";

export async function POST(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const result = await joinRoom({ viewer, roomId: id });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, roomId: result.roomId });
}
