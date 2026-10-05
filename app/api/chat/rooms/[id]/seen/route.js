// app/api/chat/rooms/[id]/seen/route.js
//
// "Seen by": who in the room has seen one message — the list behind the
// "Seen by 3" line. Owner decision 2026-10-04: read receipts, for the room's
// members only. A read-only support session, a non-member, another
// company's room or a message not in this room all answer 404.
//
// Derived from each member's read boundary (lastSeenAt), not stored per
// message — lib/company/chat/rules.js has the reasoning.
//
// GET ?message=<id>[&cursor=] → { count, people: [{ id, name, isYou }], nextCursor }
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { seenBy } from "@/lib/company/chat/store";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const url = new URL(request.url);
  const result = await seenBy(member, id, url.searchParams.get("message") || "", {
    cursor: url.searchParams.get("cursor") || null,
  });
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(result);
}
