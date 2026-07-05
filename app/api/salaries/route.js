// app/api/salaries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const salaries = await db.salary.findMany({
    where: { companyId: member.companyId },
    include: { worker: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(salaries);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage salary records" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { workerId, name, amount, frequency, startDate } = body;

  if (!name || !amount) {
    return NextResponse.json(
      { error: "name and amount are required" },
      { status: 400 },
    );
  }

  const salary = await db.salary.create({
    data: {
      companyId: member.companyId,
      workerId: workerId || null,
      name,
      amount,
      frequency: frequency || "monthly",
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });

  return NextResponse.json(salary, { status: 201 });
}
