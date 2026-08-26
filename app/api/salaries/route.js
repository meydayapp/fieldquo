// app/api/salaries/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { validateSalary } from "@/lib/overhead/salaryInput";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireCostBasisRead,
  requireCostBasisWrite,
} from "@/lib/permissions/costBasis";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Salaries are pay. GET had NO check at all — any signed-in member could
  // read every wage in the company including the owner's draw, while POST and
  // PATCH on the same file require user:manage. Mutations gated, reads open is
  // the shape most of these gaps take.
  //
  // The read was then closed on payroll:view_all and the WRITES were left on
  // user:manage, which is a wider set — so a Dispatcher refused this list
  // could still POST a row into it and DELETE it again. Both halves are one
  // rule now (lib/permissions/costBasis.js), and the write is the stricter of
  // the two, never the looser.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "salaries");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const salaries = await db.salary.findMany({
    where: { companyId: member.companyId },
    include: { worker: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(salaries);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "salaries");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json();
  const { workerId, name, amount, frequency, hoursPerWeek, startDate } = body;

  const validation = validateSalary({ name, amount, frequency, hoursPerWeek });
  if (validation.error)
    return NextResponse.json({ error: validation.error }, { status: 400 });

  // GET above returns `include: { worker: { name } }`. Without this, a salary
  // row created against another tenant's workerId read their employee's name
  // back out of this company's payroll screen.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { workerId });
  if (notOurs) return notOurs;

  const salary = await db.salary.create({
    data: {
      companyId: member.companyId,
      workerId: workerId || null,
      name: validation.name,
      amount: validation.amount,
      frequency: validation.frequency,
      hoursPerWeek: validation.hoursPerWeek,
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });

  return NextResponse.json(salary, { status: 201 });
}
