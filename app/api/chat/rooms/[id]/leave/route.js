// app/api/chat/rooms/[id]/leave/route.js
//
// Leave a channel or a group. The membership row is CLOSED, never deleted —
// what you said stays yours and in the room. #general, job rooms and DMs
// cannot be left (they are kept by FieldQuo from the roster, the schedule,
// and the pair), and neither can an auto-join channel like #announcements —
// mute it instead (lib/company/chat/rules.js canLeave).
//
// POST → { ok }   codes: no_room | read_only | fixed_room | auto_join
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { leaveRoom } from "@/lib/company/chat/store";

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const done = await leaveRoom(member, id);
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true });
}
