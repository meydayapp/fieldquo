// app/api/receipts/[id]/expenses/[expenseId]/route.js
//
// PATCH — the office moves one booked part of a receipt: to another job, to
// overhead, or to general, with a category. The amount and tax do not move;
// only where they are booked. Office only (expenses: everyone's) — "crew
// can't reassign", in the owner's words — re-checked here from a freshly
// loaded member.
//
// Body: { kind: "job"|"overhead"|"general", jobId?, category? }
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { seesAllReceipts } from "@/lib/receipts/access";
import { normaliseTarget } from "@/lib/receipts/allocate";
import { recordActivity } from "@/lib/activity/log";

export async function PATCH(request, { params }) {
  const { id, expenseId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  if (!seesAllReceipts(full)) {
    return NextResponse.json({ error: "Only the office can move a booked receipt." }, { status: 403 });
  }

  const expense = await db.expense.findFirst({
    where: { id: expenseId, receiptId: id, companyId: member.companyId },
    select: { id: true, projectId: true, isOverhead: true, category: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const target = normaliseTarget(body);
  if (target.kind === "job") {
    if (!target.jobId) return NextResponse.json({ error: "Choose a job." }, { status: 400 });
    const job = await db.job.findFirst({
      where: { id: target.jobId, companyId: member.companyId, status: { not: "cancelled" } },
      select: { id: true },
    });
    if (!job) return NextResponse.json({ error: "That job isn't available." }, { status: 404 });
  }

  const updated = await db.expense.update({
    where: { id: expense.id },
    data: {
      projectId: target.kind === "job" ? target.jobId : null,
      isOverhead: target.kind === "overhead",
      ...(target.category ? { category: target.category } : {}),
    },
    select: { id: true, projectId: true, isOverhead: true, category: true },
  });

  await recordActivity(member, {
    action: "receipt.relinked",
    entityType: "expense",
    entityId: expense.id,
    summary: "Moved part of a booked receipt",
    metadata: {
      receiptId: id,
      from: { projectId: expense.projectId, isOverhead: expense.isOverhead, category: expense.category },
      to: { projectId: updated.projectId, isOverhead: updated.isOverhead, category: updated.category },
    },
  });

  return NextResponse.json({ ok: true, expense: updated });
}
