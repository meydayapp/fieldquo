// app/api/chat/rooms/[id]/route.js
//
// One conversation in the company's crew chat: read it, say something.
//
// GET  → { id, lastSeenAt, kind, jobId, active, title, memberCount, readOnly,
//          members: [{ id, name, email, label, isYou }],
//          messages: [{ id, body, at, kind, direction, who, whoKey,
//                       mentionsMe, meta }] }
// POST { body } → { ok, message }   mentions parsed on write; codes:
//                                   no_room | empty | read_only
//
// Not-a-member and does-not-exist both answer 404: a distinct 403 would
// confirm a room with that id exists, which is a fact about somebody else's
// conversation — and, across companies, about somebody else's tenant.
//
// `params` is a Promise in Next 16 — awaited below, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { roomFor, postMessage, markRoomSeen, seesAllRooms } from "@/lib/company/chat/store";
import { roomTitle, threadMessages, isActiveJob, memberName } from "@/lib/company/chat/rules";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const room = await roomFor(member, id);
  if (!room) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });

  const members = (room.members || []).filter((m) => m.open !== false);
  // Where the member had read up to BEFORE this open — the thread draws its
  // red "unread messages" line from it. Captured first, because the next
  // line moves it to now.
  const mine = members.find((m) => m.memberId === member.id) || null;
  const lastSeenAt = mine?.lastSeenAt || null;

  // Opening it is reading it. A support session holds no row and stamps
  // nothing — it must leave no trace on the customer's data.
  await markRoomSeen(member, room.id);

  const title = roomTitle(room, member.id);
  return NextResponse.json({
    id: room.id,
    lastSeenAt,
    kind: room.kind,
    jobId: room.jobId || null,
    active: room.kind === "job" ? isActiveJob(room.job) : true,
    title: title.name,
    titleMissing: title.missing,
    memberCount: members.length,
    readOnly: seesAllRooms(member),
    members: members.map((m) => ({
      id: m.memberId,
      name: memberName(m),
      email: m.member?.user?.email || null,
      label: m.member?.role || "employee",
      isYou: m.memberId === member.id,
    })),
    messages: threadMessages(room.messages, member.id),
  });
}

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sent = await postMessage({ member, roomId: id, body: body?.body });
  if (!sent.ok) return NextResponse.json({ error: sent.error, code: sent.code }, { status: sent.status });
  return NextResponse.json({ ok: true, message: sent.message });
}
