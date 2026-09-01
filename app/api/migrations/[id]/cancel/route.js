// app/api/migrations/[id]/cancel/route.js
//
// The company withdrawing a request BEFORE paying — "the option to decline
// and cancel" the brief asks for, the "cancel" half. `decline` (in
// app/api/migrations/[id]/respond) is specifically "no to this price";
// `cancel` is "never mind" from any earlier point, including before a price
// exists.
//
// Deliberately cannot reach `paid`/`in_progress` — canCompanyCancel excludes
// them on purpose. Once money has moved, walking away is a support
// conversation about a refund (see /platform/migrations for the superadmin's
// wider cancel, which this codebase does not wire to an actual Stripe
// refund — see docs/MIGRATION-SERVICE.md).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { canCompanyCancel, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return bad("Support access can't cancel on the company's behalf.", 403);
  if (!isBillingAdmin(member.role)) {
    return bad("Only an owner or admin can cancel a migration request.", 403);
  }

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) return bad("Not found", 404);

  if (!canCompanyCancel(migration.status)) {
    return bad(
      migration.status === "paid" || migration.status === "in_progress"
        ? "This migration has already been paid for — contact us to cancel it."
        : `This migration is ${describeStatus(migration.status)} and can't be cancelled from there.`,
      409,
    );
  }

  const body = await request.json().catch(() => ({}));

  const updated = await db.migrationRequest.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledById: member.userId || null,
      cancelReason: String(body?.reason || "").trim().slice(0, 2000) || null,
    },
  });

  return NextResponse.json({ request: updated });
}
