// app/api/staff/rooms/route.js
//
// FieldQuo's own staff chat: the conversation list, and making a new room.
//
// ONE route for both portals. A rep in /sales and a platform admin in
// /platform are in the same rooms talking to each other, so a pair of parallel
// APIs would be two implementations of one feature — see lib/staff/viewer.js
// for how one credential or the other is resolved.
//
// Membership is the whole permission model. There is no role check on READS
// anywhere in here: what a viewer can see is the rooms they are a member of,
// which is a query, not a claim. That is deliberately different from
// /api/platform/*, where a role decides — a chat where an admin can read a DM
// they are not in is not a chat people will use honestly. (A superadmin may
// MANAGE a room — rename, remove — see lib/staff/channels.js; they still
// cannot read one they are not in.)
//
// GET  → { me, rooms, joinable }
//        rooms:    the rooms the viewer is in, unread first, each row carrying
//                  kind/teamKey/isDefault/private/title/topic/memberCount/
//                  lastBody/lastWho/lastWasMine/lastAt/unread/mentions/isOwner,
//                  and for a direct room `other` + their `presence`
//        joinable: public channels they are NOT in — title, topic, member
//                  count, no preview
// POST { with: { kind, id } }
//        → { roomId }  the direct room with that person, made if needed
// POST { kind: "channel", name, topic?, private?, members: [{ kind, id }] }
//        → { roomId }  a new group; refusals carry a `code`:
//                      name_missing | name_too_long | name_reserved |
//                      name_taken | member_unknown
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import {
  ensureStaffRooms,
  roomsFor,
  joinableRoomsFor,
  resolvePeople,
  openDirect,
  createChannel,
  staffDirectory,
} from "@/lib/staff/store";
import { staffRoomList, joinableRow } from "@/lib/staff/rooms";

export async function GET(request) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Seeded on read, not by a migration, and for EVERYBODY, not the viewer —
  // see lib/staff/teams.js for the launch-day state that made that rule.
  await ensureStaffRooms(viewer);

  const [rooms, joinable, people] = await Promise.all([
    roomsFor(viewer),
    joinableRoomsFor(viewer),
    staffDirectory(),
  ]);
  const presenceOf = (p) =>
    p ? people.find((d) => d.kind === p.kind && d.id === p.id)?.presence || null : null;
  return NextResponse.json({
    me: viewer,
    // A direct room carries the other side's presence, from the same
    // directory read the picker uses, so the dot in the list and the dot in
    // the picker cannot disagree.
    rooms: staffRoomList(rooms, viewer).map((r) => ({ ...r, presence: presenceOf(r.other) })),
    joinable: joinable.map(joinableRow),
  });
}

export async function POST(request) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // request.json(), not lib/jsonBody — that helper is JSON.STRINGIFY with a
  // better error, and calling it on the request produced "{}", a string whose
  // .body is undefined. Every send answered 400 for a member and a stranger
  // alike. That is the bug the owner hit live.
  const body = await request.json().catch(() => null);

  // ── A group ───────────────────────────────────────────────────────────
  if (body?.kind === "channel") {
    const made = await createChannel({
      viewer,
      name: body.name,
      topic: body.topic,
      isPrivate: body.private,
      members: body.members,
    });
    if (!made.ok) return NextResponse.json({ error: made.error, code: made.code }, { status: made.status });
    return NextResponse.json({ roomId: made.roomId });
  }

  // ── A direct message ──────────────────────────────────────────────────
  const kind = body?.with?.kind;
  const id = body?.with?.id;
  if (kind !== "user" && kind !== "rep") {
    return NextResponse.json({ error: "Say who to message.", code: "nobody_named" }, { status: 400 });
  }

  // Checked against the live directory rather than trusted: an id the browser
  // sent could name a deactivated rep, or nobody at all, and a room with a
  // participant who cannot reply is worse than a refusal.
  const { people } = await resolvePeople([{ kind, id }]);
  const other = people[0] || null;
  if (!other) {
    return NextResponse.json(
      { error: "That person is not at FieldQuo any more.", code: "member_unknown" },
      { status: 404 },
    );
  }

  const roomId = await openDirect(viewer, other);
  if (!roomId) {
    return NextResponse.json(
      { error: "You cannot start a conversation with yourself.", code: "self" },
      { status: 400 },
    );
  }
  return NextResponse.json({ roomId });
}
