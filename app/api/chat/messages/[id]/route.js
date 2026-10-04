// app/api/chat/messages/[id]/route.js
//
// Where a chat message lives — the bell's "Ana mentioned you in
// #estimating" row opens /app/chat?message=<id>, and the page asks this
// route which room to open. Answers only for a member who can read that room
// NOW (lib/company/chat/store.js locateMessage): a room they have since left,
// a private channel they were never in, or another company's message is 404.
//
// GET → { roomId, messageId }
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { locateMessage } from "@/lib/company/chat/store";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const found = await locateMessage(member, id);
  if (!found) return NextResponse.json({ error: "No such message.", code: "no_room" }, { status: 404 });
  return NextResponse.json(found);
}
