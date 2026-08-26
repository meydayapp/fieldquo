// app/api/salaries/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { validateSalary } from "@/lib/overhead/salaryInput";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireCostBasisWrite } from "@/lib/permissions/costBasis";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "salaries");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.salary.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, amount, frequency, hoursPerWeek, active } = body;

  // Name, amount, frequency and hours are validated together against the row
  // as it will END UP, not as it arrived: switching an existing monthly salary
  // to hourly without sending hours has to be rejected, and a bare
  // `...(frequency !== undefined && { frequency })` would have written it.
  const wantsFinancialChange =
    name !== undefined ||
    amount !== undefined ||
    frequency !== undefined ||
    hoursPerWeek !== undefined;

  let financial = null;
  if (wantsFinancialChange) {
    const merged = validateSalary({
      name: name === undefined ? existing.name : name,
      amount: amount === undefined ? existing.amount : amount,
      frequency: frequency === undefined ? existing.frequency : frequency,
      hoursPerWeek:
        hoursPerWeek === undefined ? existing.hoursPerWeek : hoursPerWeek,
    });
    if (merged.error)
      return NextResponse.json({ error: merged.error }, { status: 400 });
    financial = merged;
  }

  const updated = await db.salary.update({
    where: { id: _params.id },
    data: {
      ...(financial && {
        name: financial.name,
        amount: financial.amount,
        frequency: financial.frequency,
        hoursPerWeek: financial.hoursPerWeek,
      }),
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

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "salaries");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.salary.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.salary.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
