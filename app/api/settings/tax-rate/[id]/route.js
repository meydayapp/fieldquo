// app/api/settings/tax-rates/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

async function assertOwnership(companyId, id) {
  const rate = await db.taxRate.findUnique({ where: { id } });
  if (!rate || rate.companyId !== companyId) return null;
  return rate;
}

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit tax rates" },
      { status: 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, rate, isDefault } = body;

  if (isDefault) {
    await db.taxRate.updateMany({
      where: { companyId: member.companyId },
      data: { isDefault: false },
    });
  }

  const updated = await db.taxRate.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(rate !== undefined && { rate }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can delete tax rates" },
      { status: 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.taxRate.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
