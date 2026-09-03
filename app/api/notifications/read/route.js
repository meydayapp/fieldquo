// app/api/notifications/read/route.js
//
// Mark this member's own notifications read.
//
// ══ updateMany, not update ═════════════════════════════════════════════════
//
// scripts/tenantScopeScan.mjs treats `update` as a SINGLE_RECORD operation and
// requires its `where` to be company-scoped — and Prisma's `update` only accepts
// a unique selector, so `where: { id, companyId, memberId }` will not compile.
// `updateMany` takes the full predicate, which is what makes the scope
// enforceable rather than assumed: `id` alone would let anybody mark anybody's
// row read by guessing a cuid, across tenants.
//
// The predicate carries THREE terms and all three are load-bearing:
//
//   companyId — the tenant boundary the scan enumerates off the schema
//   memberId  — the caller's own Member row, from the session, never the body
//   readAt: null — so a re-tap does not move a timestamp that already exists
//
// ══ Refused under impersonation ════════════════════════════════════════════
//
// Non-negotiable #2: impersonation is read-only, with no exception. Marking a
// customer's notification read from a support session is a write to customer
// data, and it destroys the one thing the customer would use to notice the
// chargeback. middleware.js already refuses non-GET under impersonation; this
// refuses again on its own, deliberately, for the same reason lib/currentMember.js
// does — hiding a button is not access control, and neither is trusting one
// gate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (member.impersonation) {
    return NextResponse.json(
      { error: "Support sessions are read-only." },
      { status: 403 },
    );
  }
  if (!member.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // `ids` are DELIVERY ids — this member's own rows. There is deliberately no
  // way to name a recipient: `{ all: true }` means "mine", `{ ids }` means
  // "these of mine", and a delivery id belonging to somebody else simply
  // matches nothing rather than being refused, because the where clause never
  // widens past this member.
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id) => typeof id === "string" && id).slice(0, 200)
    : null;
  const all = body?.all === true;

  if (!all && (!ids || ids.length === 0)) {
    return NextResponse.json(
      { error: "Send { all: true } or { ids: [...] }." },
      { status: 400 },
    );
  }

  const result = await db.notificationDelivery.updateMany({
    where: {
      companyId: member.companyId,
      memberId: member.id,
      readAt: null,
      ...(all ? {} : { id: { in: ids } }),
    },
    data: { readAt: new Date() },
  });

  const unread = await db.notificationDelivery.count({
    where: { companyId: member.companyId, memberId: member.id, readAt: null },
  });

  return NextResponse.json({ marked: result.count, unread });
}
