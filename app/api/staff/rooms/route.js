// app/api/staff/rooms/route.js
//
// FieldQuo's own staff chat: the conversation list, and opening a new direct.
//
// ONE route for both portals. A rep in /sales and a platform admin in
// /platform are in the same rooms talking to each other, so a pair of parallel
// APIs would be two implementations of one feature — see lib/staff/viewer.js
// for how one credential or the other is resolved.
//
// Membership is the whole permission model. There is no role check anywhere in
// here: what a viewer can see is the rooms they are a member of, which is a
// query, not a claim. That is deliberately different from /api/platform/*,
// where a role decides — a chat where an admin can read a DM they are not in
// is not a chat people will use honestly.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveStaffViewer } from "@/lib/staff/viewer";
import { ensureStaffRooms, roomsFor, staffDirectory, openDirect } from "@/lib/staff/store";
import { staffRoomList } from "@/lib/staff/rooms";
import { jsonBody } from "@/lib/jsonBody";

export async function GET(request) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Seeded on read, not by a migration: a rep hired next month would otherwise
  // sign in to an empty screen with no way to fix it. Idempotent — see the
  // store.
  await ensureStaffRooms(viewer);

  const [rooms, people] = await Promise.all([roomsFor(viewer), staffDirectory()]);
  return NextResponse.json({
    me: viewer,
    rooms: staffRoomList(rooms, viewer),
    // Everyone at FieldQuo, both kinds, minus the viewer — the point of the
    // feature is that a rep can reach support without knowing which system
    // support signs in to.
    people: people.filter((p) => !(p.kind === viewer.kind && p.id === viewer.id)),
  });
}

export async function POST(request) {
  const { viewer, refusal } = await resolveStaffViewer(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await jsonBody(request);
  const kind = body?.with?.kind;
  const id = body?.with?.id;
  if (kind !== "user" && kind !== "rep") {
    return NextResponse.json({ error: "Say who to message." }, { status: 400 });
  }

  // Checked against the live directory rather than trusted: an id the browser
  // sent could name a deactivated rep, or nobody at all, and a room with a
  // participant who cannot reply is worse than a refusal.
  const people = await staffDirectory();
  const other = people.find((p) => p.kind === kind && p.id === String(id || ""));
  if (!other) {
    return NextResponse.json({ error: "That person is not at FieldQuo any more." }, { status: 404 });
  }

  const roomId = await openDirect(viewer, other);
  if (!roomId) {
    return NextResponse.json({ error: "You cannot start a conversation with yourself." }, { status: 400 });
  }
  return NextResponse.json({ roomId });
}
