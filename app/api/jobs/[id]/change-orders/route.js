// app/api/jobs/[id]/change-orders/route.js
//
// Logging a scope change agreed after the client accepted the quote — see
// prisma/schema.prisma's ChangeOrder model and docs/CALLBACKS-AND-CHANGE-ORDERS.md
// for why this is a record a person writes, deliberately never auto-created
// from a quote or invoice edit.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { CHANGE_ORDER_CREATE_STATUSES } from "@/lib/jobs/changeOrderValue";

export async function GET(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changeOrders = await db.changeOrder.findMany({
    where: { jobId: _params.id },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
      // So the panel can say WHICH invoice a change order was billed on rather
      // than a bare "billed", which is the sort of unfalsifiable status a
      // contractor cannot act on.
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  return NextResponse.json(changeOrders);
}

export async function POST(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same two gates PATCH /api/invoices/[id] uses for its own edit: the jobs
  // level to touch the job at all, and showPricing because a priceDelta is
  // money — a member who can see this job but not its prices must not be
  // able to type one in through this door instead.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "log a change order");
    requireToggle(full, "showPricing", "log a change order");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { description, priceDelta, status } = body;

  if (!description || !description.trim()) {
    return NextResponse.json({ error: "Describe what changed." }, { status: 400 });
  }
  const delta = Number(priceDelta);
  if (!Number.isFinite(delta)) {
    return NextResponse.json({ error: "priceDelta must be a number." }, { status: 400 });
  }

  // Only the two states a person can log something INTO. `rejected` is the
  // outcome of a later decision, never a thing you file on day one, and
  // accepting it here would let the form create a record of a refusal that
  // nobody is recorded as having made.
  //
  // Absent means approved, matching this model's original meaning — a change
  // order was always "already agreed by the time it is logged". The form sends
  // the field explicitly either way; this default is for API callers and for
  // the rows written before the column existed.
  const requested = status === undefined || status === null ? "approved" : status;
  if (!CHANGE_ORDER_CREATE_STATUSES.includes(requested)) {
    return NextResponse.json(
      { error: "A change order is logged as agreed or as pending." },
      { status: 400 },
    );
  }

  const changeOrder = await db.changeOrder.create({
    data: {
      jobId: _params.id,
      description: description.trim(),
      priceDelta: delta,
      status: requested,
      // Logging one as already agreed IS the decision — recorded here rather
      // than left null, so "who said yes to this money" has an answer on every
      // approved row and not only on the ones that passed through pending.
      ...(requested === "approved"
        ? { decidedAt: new Date(), decidedById: member.userId }
        : {}),
      createdById: member.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  return NextResponse.json(changeOrder, { status: 201 });
}
