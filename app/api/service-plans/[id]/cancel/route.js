// app/api/service-plans/[id]/cancel/route.js
//
// Stop a plan. This is the control the whole feature is judged on: a Cancel
// button that leaves something able to charge is the exact failure AGENTS.md
// says never to ship.
//
// Three independent things happen, in an order chosen so no single failure can
// leave the plan billable:
//
//   1. The plan's status becomes `cancelled` and cancelledAt is stamped. The
//      run engine filters on status in its query AND asks planBlockedReason
//      again per plan, so this alone stops every future occurrence.
//   2. Any authorisation is revoked in the database.
//   3. The saved payment method is detached at Stripe. Best-effort, and last,
//      because the first two already guarantee the outcome — this makes it
//      structurally impossible rather than merely refused by our code.
//
// What there ISN'T is a Stripe Subscription to cancel, because none was ever
// created (see the ServicePlan model). That is the property that makes this
// provable: nothing at Stripe bills on a schedule of its own, so there is no
// object that can survive this route and keep charging.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { revokeAuthorisation } from "@/lib/servicePlans/authorisation";
import { summarisePlan } from "@/lib/servicePlans/summary";

export async function POST(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try: the response is shaped with the same member the
  // gate used — summarisePlan redacts the client and the money from it.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "cancel a service plan");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.servicePlan.findFirst({
    where: { id, companyId: member.companyId },
    include: { authorisation: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status === "cancelled") {
    // Idempotent: a double click, or a retry after a dropped response, must not
    // report a failure for work that is already done.
    const plan = await db.servicePlan.findUnique({
      where: { id: existing.id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        authorisation: true,
        occurrences: { orderBy: { seq: "asc" } },
      },
    });
    return NextResponse.json({ ...summarisePlan(plan, { member: full }), alreadyCancelled: true });
  }

  await db.servicePlan.update({
    where: { id: existing.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledById: member.userId || null,
    },
  });

  const revocation = await revokeAuthorisation(existing.id, "plan_cancelled");

  const plan = await db.servicePlan.findUnique({
    where: { id: existing.id },
    include: {
      client: { select: { id: true, name: true, email: true } },
      authorisation: true,
      occurrences: { orderBy: { seq: "asc" } },
    },
  });

  return NextResponse.json({
    ...summarisePlan(plan, { member: full }),
    // Reported rather than swallowed. If Stripe refused the detach the plan is
    // still stopped — but somebody should be able to see that the card is still
    // sitting on the customer record.
    paymentMethodRemoved: revocation.detached ?? false,
    paymentMethodRemovalReason: revocation.detachReason || null,
  });
}
