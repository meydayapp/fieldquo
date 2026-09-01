// app/api/migrations/[id]/route.js
//
// One migration request, from the company's side. Read-only here — every
// state change has its own route (schedule / respond / checkout) so each one
// carries its own state-machine guard rather than a single PATCH trying to
// infer which transition a partial body means.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can view a data migration." },
      { status: 403 },
    );
  }

  // Next 16: params is a Promise.
  const { id } = await params;

  const row = await db.migrationRequest.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      // "the company can see what was brought in" — the entityType and a
      // frozen snapshot only, never platformAdminId: which superadmin did
      // the work is a FieldQuo-internal fact, not one the company needs.
      writes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, entityType: true, entityId: true, snapshot: true, createdAt: true },
      },
    },
  });

  if (!row || row.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ request: row });
}
