// app/api/platform/chat/audit/rooms/route.js
//
// Every staff conversation, for the owner. Read-only, superadmin-only.
//
// This is NOT /api/staff/rooms. That route answers "which rooms am I in",
// by membership, and a superadmin gets the same answer as anybody else
// (lib/staff/store.js). This one answers "which rooms exist", and only for
// "chat:audit" — a permission no role below superadmin holds
// (SUPERADMIN_ONLY_PERMISSIONS). The two are separate routes on purpose:
// the audit must never be reachable by adding a query parameter to the
// chat's own door.
//
// GET → { rooms: [{ id, kind: "direct"|"team"|"group", title, slug,
//          teamKey, private, participants: [{ kind, id, name, email }],
//          memberCount, lastMessageAt, messageCount }] }
//
// No POST. Nothing on the audit path writes to a room except the system
// line the thread route posts to say the owner looked (lib/staff/audit.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/platform/auditGate";
import { auditRooms } from "@/lib/staff/audit";

export async function GET(request) {
  const { viewer, refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const rooms = await auditRooms(viewer);
  return NextResponse.json({ rooms });
}
