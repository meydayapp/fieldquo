// app/api/expenses/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

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

  await db.expense.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
