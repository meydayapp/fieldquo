// app/api/staff/rooms/[id]/route.js
//
// One staff conversation: read it, say something, mark it seen, change it.
//
// GET   → { id, lastSeenAt, kind, teamKey, isDefault, private, title, slug,
//           topic, memberCount, canManage, canLeave,
//           members: [{ kind, id, name, email, presence }],
//           messages: [{ id, body, at, kind, direction, who, whoKey,
//                        mentionsMe, meta }] }
// POST  { body } → { ok, message }   mentions parsed on write
// PATCH { name?, topic? } → { ok }   owner or superadmin; a team room keeps
//                                    its name; codes: not_owner | team_room |
//                                    name_* | name_taken | direct_room
//
// `params` is a Promise in Next 16 — awaited below, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { roomFor, postStaffMessage, markRoomSeen, updateRoom, staffDirectory } from "@/lib/staff/store";
import { threadMessages, roomTitle } from "@/lib/staff/rooms";
import { participantName, participantOf, sameParticipant } from "@/lib/staff/participants";
import { canManage, canLeave } from "@/lib/staff/channels";

export async function GET(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const room = await roomFor(viewer, id);
  // Not-a-member and does-not-exist answer the same way on purpose. A distinct
  // 403 would confirm that a room with that id exists, which is a fact about
  // somebody else's private conversation.
  if (!room) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });

  const members = (room.members || []).filter((m) => m.open !== false);
  // Where the viewer had read up to BEFORE this open — the thread draws its
  // red "unread messages" line from it. Captured first, because the next
  // line moves it to now.
  const mine = members.find((m) => sameParticipant(participantOf(m), viewer)) || null;
  const lastSeenAt = mine?.lastSeenAt || null;

  // Opening it is reading it.
  await markRoomSeen({ viewer, roomId: room.id });

  // Presence for the header's dot and the @ list, from the same directory
  // read the picker uses.
  const people = await staffDirectory();
  const presenceOf = (p) => people.find((d) => d.kind === p.kind && d.id === p.id)?.presence || null;

  return NextResponse.json({
    id: room.id,
    lastSeenAt,
    kind: room.kind,
    teamKey: room.teamKey || null,
    isDefault: Boolean(room.isDefault),
    private: Boolean(room.private),
    slug: room.slug || null,
    title: roomTitle(room, viewer),
    topic: room.topic || null,
    memberCount: members.length,
    canManage: canManage(room, viewer),
    canLeave: canLeave(room).ok,
    members: members
      .map((m) => participantOf(m) && { ...participantOf(m), name: participantName(m), email: m.platformAdmin?.email || m.salesRep?.email || null })
      .filter(Boolean)
      .map((m) => ({ ...m, presence: presenceOf(m) })),
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
      { error: "That could not be sent. Check you are still in this conversation.", code: "not_sent" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, message: sent });
}

export async function PATCH(request, { params }) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateRoom({ viewer, roomId: id, name: body?.name, topic: body?.topic });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
