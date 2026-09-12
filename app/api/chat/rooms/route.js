// app/api/chat/rooms/route.js
//
// A company's crew chat: the conversation list, and opening a direct message.
//
// Membership is the whole permission model. There is no role check on READS:
// what a member can see is the rooms they hold an open membership in, in
// THEIR company, which is a query (lib/company/chat/store.js), not a claim.
// A read-only support session (non-negotiable #2) sees every room of the
// company it is looking at and can post in none of them — refused by
// getCurrentMember's method gate AND by the store's canWrite, on purpose.
//
// GET  → { me, rooms }
//        rooms: the rooms the member is in, unread first, each row carrying
//               kind/jobId/active/title/memberCount/lastBody/lastWho/
//               lastWasMine/lastAt/unread/mentions, and for a DM `other`
// POST { with: <memberId> } → { roomId }   the direct room with that person,
//        made if needed; codes: self | member_unknown | read_only
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { ensureCompanyRooms, roomsFor, openDirect, canWrite, seesAllRooms } from "@/lib/company/chat/store";
import { roomList } from "@/lib/company/chat/rules";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Seeded on read, not by a migration, and for EVERYBODY in the company —
  // see lib/company/chat/store.js. A support session only reads.
  if (canWrite(member)) await ensureCompanyRooms(member.companyId);

  const rooms = await roomsFor(member);
  return NextResponse.json({
    me: { id: member.id, role: member.role, readOnly: seesAllRooms(member) },
    rooms: roomList(rooms, member.id),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // request.json(), not lib/jsonBody — see app/api/staff/rooms/route.js for
  // the bug that helper produced on the staff chat.
  const body = await request.json().catch(() => null);
  const other = typeof body?.with === "string" ? body.with : "";
  if (!other) return NextResponse.json({ error: "Say who to message.", code: "nobody_named" }, { status: 400 });

  const made = await openDirect(member, other);
  if (!made.ok) return NextResponse.json({ error: made.error, code: made.code }, { status: made.status });
  return NextResponse.json({ roomId: made.roomId });
}
