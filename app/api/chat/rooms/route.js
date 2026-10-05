// app/api/chat/rooms/route.js
//
// A company's crew chat: the conversation list, and starting a conversation —
// a direct message, a group, or (the office only) a channel.
//
// Membership is the whole permission model for READS: what a member can see
// is the rooms they hold an open membership in, in THEIR company, which is a
// query (lib/company/chat/store.js), not a claim. A read-only support session
// (non-negotiable #2) sees every room of the company it is looking at and can
// post in none of them — refused by getCurrentMember's method gate AND by the
// store's canWrite, on purpose. WRITES are role-checked in the store
// (lib/company/chat/rules.js has the matrix): only the office makes a
// channel; anybody makes a group.
//
// GET [?sync=1] → { me, rooms, joinable }
//        rooms: the rooms the member is in, unread first, each row carrying
//               kind/jobId/active/title/titleExtra/memberCount/lastBody/
//               lastWho/lastWasMine/lastAt/unread/mentions, the channel's
//               topic/private/postingPolicy/archived, and the viewer's own
//               notify/muted/starred; for a DM `other`
//        joinable: public channels they are not in (Browse channels)
//        sync=1 seeds #general, the job rooms and the auto-join channels
//        first (ensureCompanyRooms). The screen asks for it on open and on
//        coming back to the tab, not on every 15-second poll: seeding reads
//        every membership of every derived room, and doing that four times
//        a minute per open screen is the read that does not survive a big
//        company. Job rooms are also synced on every job and visit write.
// POST { with: <memberId> } → { roomId }   the direct room with that person
// POST { kind: "group", members: [ids], name? } → { roomId, kind }
//        one person picked → their DM (kind "dm"); two or more → a group
// POST { kind: "channel", name, topic?, private?, postingPolicy?, autoJoin?,
//        members?: [ids] } → { roomId, kind }   office only
//   codes: self | member_unknown | nobody_named | read_only | not_allowed |
//          name_missing | name_too_long | name_reserved | name_taken
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  ensureCompanyRooms,
  roomsFor,
  joinableRoomsFor,
  openDirect,
  createGroup,
  createChannel,
  canWrite,
  seesAllRooms,
} from "@/lib/company/chat/store";
import { roomList, canCreateChannel, isOfficeRole } from "@/lib/company/chat/rules";

const refused = (r) => NextResponse.json({ error: r.error, code: r.code }, { status: r.status });

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Seeded on read, not by a migration, and for EVERYBODY in the company —
  // see lib/company/chat/store.js. A support session only reads.
  const sync = new URL(request.url).searchParams.get("sync") === "1";
  if (sync && canWrite(member)) await ensureCompanyRooms(member.companyId);

  const [rooms, joinable] = await Promise.all([roomsFor(member), joinableRoomsFor(member)]);
  return NextResponse.json({
    me: {
      id: member.id,
      role: member.role,
      readOnly: seesAllRooms(member),
      office: isOfficeRole(member.role),
      canCreateChannel: canCreateChannel(member),
    },
    rooms: roomList(rooms, member.id),
    joinable,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // request.json(), not lib/jsonBody — see app/api/staff/rooms/route.js for
  // the bug that helper produced on the staff chat.
  const body = await request.json().catch(() => null);

  if (body?.kind === "channel") {
    const made = await createChannel(member, {
      name: body.name,
      topic: body.topic,
      isPrivate: body.private === true,
      postingPolicy: body.postingPolicy,
      autoJoin: body.autoJoin === true,
      memberIds: body.members,
    });
    if (!made.ok) return refused(made);
    return NextResponse.json({ roomId: made.roomId, kind: made.kind });
  }

  if (body?.kind === "group") {
    const made = await createGroup(member, { memberIds: body.members, name: body.name });
    if (!made.ok) return refused(made);
    return NextResponse.json({ roomId: made.roomId, kind: made.kind });
  }

  const other = typeof body?.with === "string" ? body.with : "";
  if (!other) return NextResponse.json({ error: "Say who to message.", code: "nobody_named" }, { status: 400 });

  const made = await openDirect(member, other);
  if (!made.ok) return refused(made);
  return NextResponse.json({ roomId: made.roomId });
}
