// app/api/debts/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireCostBasisRead,
  requireCostBasisWrite,
} from "@/lib/permissions/costBasis";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Company debt — the POST on this same file is commented "owner/admin-only,
  // financial data" and the GET had nothing. Mutations gated, reads open is
  // the shape most of these gaps take.
  //
  // `user:manage` closed the read to an employee and left it open to a
  // Dispatcher, who read principal 25000 / monthlyPayment 1000 with
  // jobCosting:false. The debt payment is a third of the cost-per-job figure
  // above it, so it is cost basis; both halves share one rule now.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "debt");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const debts = await db.debt.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(debts);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same rule as the GET, deliberately: creating a debt row raises the
  // company's price floor, and QA created and deleted one from an account that
  // is now refused the list.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "debt");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
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
