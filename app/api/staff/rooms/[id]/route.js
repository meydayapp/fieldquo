// app/api/staff/rooms/[id]/route.js
//
// One staff conversation: read it, say something, mark it seen.
//
// `params` is a Promise in Next 16 — awaited below, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { roomFor, postStaffMessage, markRoomSeen } from "@/lib/staff/store";
import { threadMessages, roomTitle } from "@/lib/staff/rooms";
import { participantName } from "@/lib/staff/participants";

export async function GET(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const room = await roomFor(viewer, id);
  // Not-a-member and does-not-exist answer the same way on purpose. A distinct
  // 403 would confirm that a room with that id exists, which is a fact about
  // somebody else's private conversation.
  if (!room) return NextResponse.json({ error: "No such conversation." }, { status: 404 });

  // Opening it is reading it.
  await markRoomSeen({ viewer, roomId: room.id });

  return NextResponse.json({
    id: room.id,
    kind: room.kind,
    teamKey: room.teamKey || null,
    title: roomTitle(room, viewer),
    topic: room.topic || null,
    members: (room.members || []).map((m) => ({ name: participantName(m) })),
    messages: threadMessages(room.messages, viewer),
  });
}

export async function POST(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  // request.json(), not lib/jsonBody — that helper is JSON.STRINGIFY with a
  // better error, and calling it on the request produced "{}", a string whose
  // .body is undefined. Every send answered 400 for a member and a stranger
  // alike. That is the bug the owner hit live.
  const body = await request.json().catch(() => null);
  const sent = await postStaffMessage({ viewer, roomId: id, body: body?.body });
  // postStaffMessage returns null for a non-member as well as for empty text,
  // and both are the caller's fault rather than a server error.
  if (!sent) {
    return NextResponse.json(
      { error: "That could not be sent. Check you are still in this conversation." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, message: sent });
}
