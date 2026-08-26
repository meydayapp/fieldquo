// app/api/service-plans/[id]/route.js
//
// One plan. Read it, or rename it.
//
// PATCH deliberately accepts ONLY the name. The money terms — amount, discount,
// cadence, length — are frozen at creation, because the client's authorisation
// names them. Editing an amount under a live mandate is not an edit, it is a
// charge the client never agreed to; the honest route is to cancel this plan
// and sell a new one, which is what the UI says.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { summarisePlan } from "@/lib/servicePlans/summary";

const INCLUDE = {
  client: { select: { id: true, name: true, email: true, language: true } },
  authorisation: true,
  occurrences: { orderBy: { seq: "asc" } },
};

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try: the response is shaped with the same member the
  // gate used — summarisePlan redacts the client and the money from it.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_only", "see service plans");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const plan = await db.servicePlan.findFirst({
    where: { id, companyId: member.companyId },
    include: INCLUDE,
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(summarisePlan(plan, { member: full }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try: the response is shaped with the same member the
  // gate used — summarisePlan redacts the client and the money from it.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "edit a service plan");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.servicePlan.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Give this plan a name." }, { status: 400 });

  // Anything else in the payload is refused OUT LOUD rather than dropped
  // silently. A caller that sent a new amount and got a 200 back would
  // reasonably believe it took.
  const frozen = [
    "amountPerOccurrence",
    "discountPct",
    "taxRatePct",
    "frequency",
    "startDate",
    "endMode",
    "occurrenceCount",
    "endDate",
    "collectionMode",
  ].filter((k) => body?.[k] !== undefined);
  if (frozen.length) {
    return NextResponse.json(
      {
        error:
          "A plan's payment terms can't be changed once it exists — the client authorised these exact figures. Cancel this plan and create a new one instead.",
        frozen,
      },
      { status: 400 },
    );
  }

  const plan = await db.servicePlan.update({
    where: { id: existing.id },
    data: { name },
    include: INCLUDE,
  });

  return NextResponse.json(summarisePlan(plan, { member: full }));
}
