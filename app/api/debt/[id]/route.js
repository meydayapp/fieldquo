// app/api/debts/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage debt records" },
      { status: 403 },
    );
  }

  const existing = await db.debt.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, principal, interestRate, monthlyPayment, active } = body;

  const updated = await db.debt.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(principal !== undefined && { principal }),
      ...(interestRate !== undefined && { interestRate }),
      ...(monthlyPayment !== undefined && { monthlyPayment }),
      ...(active !== undefined && { active }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage debt records" },
      { status: 403 },
    );
  }

  const existing = await db.debt.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.debt.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
