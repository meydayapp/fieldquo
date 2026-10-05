// app/api/chat/rooms/[id]/join/route.js
//
// Join a PUBLIC channel of your own company — Browse channels. A private
// channel, an archived one, a group, or another company's room answers 404,
// the same as a room that does not exist (lib/company/chat/rules.js
// isJoinable): the refusal confirms nothing about a conversation the caller
// is not in.
//
// POST → { ok, roomId, already? }   codes: no_room | read_only
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { joinRoom } from "@/lib/company/chat/store";

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const done = await joinRoom(member, id);
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true, roomId: done.roomId, already: Boolean(done.already) });
}
