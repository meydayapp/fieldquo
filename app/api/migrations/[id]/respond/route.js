// app/api/migrations/[id]/respond/route.js
//
// The company's answer to a migration quote: accept or decline. Only legal
// from `quoted` — see lib/migrations/state.js. This is the "accepting IS the
// company's recorded consent" moment the brief asked for: the write path
// stays closed until payment regardless (canWrite() checks `paid`/
// `in_progress`, not `accepted`), but this is the row that proves the company
// said yes to a specific, dated price before any money moved.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { canRespond, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return bad("Support access can't respond on the company's behalf.", 403);
  if (!isBillingAdmin(member.role)) {
    return bad("Only an owner or admin can respond to a migration quote.", 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "decline" ? "decline" : body?.action === "accept" ? "accept" : null;
  if (!action) return bad('action must be "accept" or "decline".');

  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) return bad("Not found", 404);

  // Handles BOTH hostile-input cases the brief names for this route: accepting
  // twice (second call finds status already `accepted`, not `quoted`) and
  // declining after paying (status is `paid`/`in_progress`/…, not `quoted`).
  if (!canRespond(migration.status)) {
    return bad(
      `This migration is ${describeStatus(migration.status)} — there's no quote waiting for a response.`,
      409,
    );
  }

  const updated = await db.migrationRequest.update({
    where: { id },
    data:
      action === "accept"
        ? { status: "accepted", respondedAt: new Date(), respondedById: member.userId || null }
        : {
            status: "declined",
            respondedAt: new Date(),
            respondedById: member.userId || null,
            declineReason: String(body?.reason || "").trim().slice(0, 2000) || null,
          },
  });

  return NextResponse.json({ request: updated });
}
