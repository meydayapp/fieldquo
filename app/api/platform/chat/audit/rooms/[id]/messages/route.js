// app/api/platform/chat/audit/rooms/[id]/messages/route.js
//
// One staff conversation's messages, for the owner — including a DM the
// owner is not in. Read-only, superadmin-only ("chat:audit"), and announced:
// every call writes a PlatformAuditLog row (`chat_audited`) and the first
// call of a look posts "Emilio (owner) viewed this conversation on <date>"
// into the room, where its participants see it. lib/staff/auditRules.js
// carries the reasons; this route carries none of the logic.
//
// GET ?before=<ISO>&limit=<n>
//   → { room, participants, messages: [{ id, body, at, kind, direction:
//       "in", who, meta }], hasMore, oldestAt, audited: { at, announced } }
//
// No POST, no PATCH, no DELETE. The auditor cannot say anything here and
// cannot change anything here; the absence of the handler is the guarantee,
// not a disabled button.
//
// `params` is a Promise in Next 16 — awaited, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/platform/auditGate";
import { auditRoomMessages } from "@/lib/staff/audit";

export async function GET(request, { params }) {
  const { viewer, refusal } = await requireAuditor(request, "chat:audit");
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const result = await auditRoomMessages(viewer, id, {
    before: searchParams.get("before") || null,
    limit: searchParams.get("limit") || null,
  });
  if (!result) return NextResponse.json({ error: "No such conversation.", code: "no_room" }, { status: 404 });
  return NextResponse.json(result);
}
