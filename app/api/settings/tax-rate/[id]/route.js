// app/api/settings/tax-rates/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

async function assertOwnership(companyId, id) {
  const rate = await db.taxRate.findUnique({ where: { id } });
  if (!rate || rate.companyId !== companyId) return null;
  return rate;
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit tax rates" },
      { status: 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, _params.id);
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
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(rate !== undefined && { rate }),
      ...(isDefault !== undefined && { isDefault }),
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
      { error: "Only owners/admins can delete tax rates" },
      { status: 403 },
    );
  }

  const existing = await assertOwnership(member.companyId, _params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.taxRate.delete({ where: { id: _params.id } });

  return NextResponse.json({ ok: true });
}
