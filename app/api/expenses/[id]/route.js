// app/api/expenses/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

/**
 * May this member touch this expense row?
 *
 * The collection route (GET /api/expenses) already narrows to
 * `createdById: member.userId` unless the caller holds
 * "expenses:view_record_edit_all" — but these two handlers filtered on
 * companyId alone. So a restricted member couldn't SEE a colleague's fuel
 * receipt in the list, yet could edit its amount or delete it outright with
 * the id, which job costing then reports as fact.
 *
 * Same predicate as the list's scope, expressed as a gate because a single-row
 * write has nothing to narrow.
 */
async function mayEdit(member, existing) {
  // Both sides truthy before comparing: rows predating createdById have null,
  // and a session without a userId (support impersonation) has null too —
  // `null === null` would hand every legacy expense to the one caller that is
  // supposed to write nothing at all.
  if (member.userId && existing.createdById === member.userId) return true;
  const full = await loadEnforceableMember(db, member.id);
  return hasLevel(full, "expenses", "view_record_edit_all");
}

const FORBIDDEN = {
  error: "You can only change expenses you recorded yourself.",
};

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.expense.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await mayEdit(member, existing)))
    return NextResponse.json(FORBIDDEN, { status: 403 });

  const body = await request.json();
  const {
    category,
    amount,
    date,
    notes,
    projectId,
    isOverhead,
    recurring,
    frequency,
    materialId,
  } = body;

  const updated = await db.expense.update({
    where: { id: _params.id },
    data: {
      ...(category !== undefined && { category }),
      ...(amount !== undefined && { amount }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(notes !== undefined && { notes }),
      ...(projectId !== undefined && { projectId }),
      ...(isOverhead !== undefined && { isOverhead }),
      ...(recurring !== undefined && { recurring }),
      ...(frequency !== undefined && { frequency }),
      ...(materialId !== undefined && { materialId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.expense.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await mayEdit(member, existing)))
    return NextResponse.json(FORBIDDEN, { status: 403 });

  await db.expense.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
