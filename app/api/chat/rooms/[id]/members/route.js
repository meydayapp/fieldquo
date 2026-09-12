// app/api/chat/rooms/[id]/members/route.js
//
// Who is in a room of the company's crew chat.
//
// GET → { room: { id, kind, name, jobId }, members: [{ id, name, email,
//         label, departed, isYou }] }
//
// Read-only by design, not by omission: #general is everybody, a job room
// follows the job's visits, a DM is two people. There is no POST here
// because there is nothing a person could add that the schedule would not
// undo on the next read — a control like that is the dead control AGENTS.md
// forbids. To put somebody in a job's room, book them on a visit.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { membersOf } from "@/lib/company/chat/store";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { id } = await params;
  const result = await membersOf(member, id);
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(result);
}
