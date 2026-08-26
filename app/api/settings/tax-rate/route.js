// app/api/settings/tax-rates/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const rates = await db.taxRate.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rates);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can create tax rates" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, rate, isDefault } = body;

  if (!name || rate === undefined || rate === null) {
    return NextResponse.json(
      { error: "name and rate are required" },
      { status: 400 },
    );
  }

  // Only one default rate per company — clear any existing default first
  // if this one is being marked as the default.
  if (isDefault) {
    await db.taxRate.updateMany({
      where: { companyId: member.companyId },
      data: { isDefault: false },
    });
  }

  const created = await db.taxRate.create({
    data: {
      companyId: member.companyId,
      name,
      rate,
      isDefault: !!isDefault,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
