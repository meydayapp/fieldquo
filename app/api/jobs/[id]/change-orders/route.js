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
    include: { createdBy: { select: { id: true, name: true } } },
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
  const { description, priceDelta } = body;

  if (!description || !description.trim()) {
    return NextResponse.json({ error: "Describe what changed." }, { status: 400 });
  }
  const delta = Number(priceDelta);
  if (!Number.isFinite(delta)) {
    return NextResponse.json({ error: "priceDelta must be a number." }, { status: 400 });
  }

  const changeOrder = await db.changeOrder.create({
    data: {
      jobId: _params.id,
      description: description.trim(),
      priceDelta: delta,
      createdById: member.userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(changeOrder, { status: 201 });
}
