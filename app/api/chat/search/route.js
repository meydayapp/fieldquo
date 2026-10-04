// app/api/chat/search/route.js
//
// Search the team chat.
//
// GET ?q=<words>[&room=<id>] → { q, results: [{ id, roomId, roomKind,
//     roomName, body, at, who, mine }] } — newest 50.
//
// Server-side and permission-filtered (lib/company/chat/store.js
// searchMessages): the member's company, then the rooms they hold an OPEN
// membership in — a private channel's words are never a result for somebody
// not in it — removed messages never, system lines never. With `room`, that
// one room, which must be one they can read (404 otherwise, the same answer
// a room that does not exist gets).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { searchMessages } from "@/lib/company/chat/store";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const sp = new URL(request.url).searchParams;
  const found = await searchMessages(member, { q: sp.get("q") || "", roomId: sp.get("room") || null });
  if (!found) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(found);
}
