// app/api/clients/[id]/auto-messages/route.js
//
// GET — the automatic messages held back for this client because "No
// automatic emails or texts" is on, or because the client is marked Do not
// contact (model AutoMessageSkip, `cause` says which; written only by
// lib/clients/autoMessages.js recordAutoMessageSkip). Listed on the client
// page under the switch so the office can see what did not go and send it by
// hand if it should.
//
// The switch itself is written through PATCH /api/clients/[id]
// (autoMessagesOff, autoMessagesOffReason), with the rest of the client's
// communication settings.
//
// The same level as the client record itself: what was held back (a receipt
// for INV-0009, a reminder text) names documents, not contact details, so the
// rows ride with the record's read rather than the full-view rung — but a
// crew member reaching only their own households is scoped the same way
// GET /api/clients/[id] scopes them (assignedClientWhere).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, assignedClientWhere } from "@/lib/permissions/enforce";
import { loadAutoMessageSkips, autoMessagesOff, autoMessageHold } from "@/lib/clients/autoMessages";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId, ...assignedClientWhere(full) },
    select: { id: true, autoMessagesOffAt: true, autoMessagesOffReason: true, doNotContactAt: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const skips = await loadAutoMessageSkips(db, { companyId: member.companyId, clientId: client.id });
  return NextResponse.json({
    off: autoMessagesOff(client),
    since: client.autoMessagesOffAt,
    reason: client.autoMessagesOffReason || null,
    // Which of the two the gate answers with right now — "do_not_contact"
    // wins over the switch (lib/clients/autoMessages.js autoMessageHold) — or
    // null when automatic messages go. Each skip row carries its own `cause`.
    heldBy: autoMessageHold(client)?.reason || null,
    skips,
  });
}
