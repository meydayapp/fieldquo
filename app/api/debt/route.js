// app/api/debts/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debts = await db.debt.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(debts);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage"); // owner/admin-only, financial data
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners/admins can manage debt records" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, principal, interestRate, monthlyPayment, startDate } = body;

  if (!name || !principal || !monthlyPayment) {
    return NextResponse.json(
      { error: "name, principal, and monthlyPayment are required" },
      { status: 400 },
    );
  }

  const debt = await db.debt.create({
    data: {
      companyId: member.companyId,
      name,
      principal,
      interestRate: interestRate || 0,
      monthlyPayment,
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });

  return NextResponse.json(debt, { status: 201 });
}
