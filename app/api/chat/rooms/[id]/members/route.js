// app/api/chat/rooms/[id]/members/route.js
//
// The people in one conversation — a PAGE at a time (a group has no maximum
// size, and #general is the whole roster) — and, for a channel or group,
// adding people to it.
//
// #general and job rooms are derived from the roster and the schedule and a
// DM is two people, so for those the list is read-only and the screen
// explains why. For a channel the office manages it (lib/company/chat/
// rules.js canAddMembers); for a group anybody in it may add.
//
// GET [?q=&cursor=] → { room, members, total, nextCursor, can }
//        members: [{ id, name, email, label, title, departed, isYou,
//                    manager, addedBy }]
// POST { members: [ids] } → { ok, added }
//        codes: no_room | read_only | fixed_room | archived | not_allowed |
//               nobody_named | member_unknown
//
// `params` is a Promise in Next 16 — awaited below, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { membersOf, addMembers } from "@/lib/company/chat/store";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const url = new URL(request.url);
  const result = await membersOf(member, id, {
    q: url.searchParams.get("q") || "",
    cursor: url.searchParams.get("cursor") || null,
  });
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(result);
}

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const done = await addMembers(member, id, body?.members);
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true, added: done.added });
}
