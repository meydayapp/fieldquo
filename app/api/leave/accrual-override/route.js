// app/api/leave/accrual-override/route.js
//
// POST — set one person's own accrual rate under one "earned per hour worked"
//        policy, from a date (LeaveAccrualOverride).
//
// What it is for: the 6% that starts on somebody's fifth anniversary, a lead
// hand on a better sick rule. The company policy stays the rule for everyone
// else.
//
// Append-only, like the opening balance: a change is a new row, the newest
// row on or before a day decides that day's rate, and an override is ENDED by
// a row with no rate ("back to the company policy from this date") — never by
// deleting the record that it was ever there. Hours worked before the
// effective date keep the rate they were earned under
// (lib/leave/hourAccrual.js buildRateAt).
//
// Owner/admin only (lib/leave/accrualAdmin.js). The rows are returned to the
// person and to managers by GET /api/leave, beside the balances they change.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { refreshAccruals } from "@/lib/leave/balances";
import { validateOverride } from "@/lib/leave/hourAccrual";
import { companyWorker, enteredByName, leaveAdminRefusal } from "@/lib/leave/accrualAdmin";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = leaveAdminRefusal(member);
  if (refusal) return refusal;

  const body = await request.json().catch(() => ({}));
  const worker = await companyWorker(member.companyId, body?.workerId);
  if (!worker) {
    return NextResponse.json({ error: "That person isn't on this company's roster." }, { status: 404 });
  }
  const policy = await db.leavePolicy.findFirst({
    where: { id: typeof body?.policyId === "string" ? body.policyId : "", companyId: member.companyId },
    select: { id: true, name: true, accrualMethod: true },
  });
  if (!policy) {
    return NextResponse.json({ error: "Pick one of the company's leave policies." }, { status: 404 });
  }
  // An override only means something where leave is earned from hours. On a
  // fixed-days policy it would be a row nothing reads — a control that looks
  // like it worked.
  if (policy.accrualMethod !== "per_hours_worked") {
    return NextResponse.json(
      { error: "A personal rate applies only to a policy earned per hour worked." },
      { status: 400 },
    );
  }

  const { errors, value } = validateOverride({
    effectiveFrom: body?.effectiveFrom,
    hoursEarned: body?.hoursEarned,
    perHoursWorked: body?.perHoursWorked,
    note: body?.note,
    todayIso: new Date().toISOString().slice(0, 10),
  });
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  const created = await db.leaveAccrualOverride.create({
    data: {
      companyId: member.companyId,
      workerId: worker.id,
      policyId: policy.id,
      effectiveFrom: value.effectiveFrom,
      hoursEarned: value.hoursEarned,
      perHoursWorked: value.perHoursWorked,
      note: value.note,
      enteredById: member.userId,
      enteredByName: await enteredByName(member),
    },
  });

  await refreshAccruals({ companyId: member.companyId, year: new Date().getUTCFullYear(), maxAgeMs: 0 });

  const from = value.effectiveFrom.toISOString().slice(0, 10);
  await recordActivity(member, {
    action: "leave.accrual_override",
    entityType: "leave",
    entityId: created.id,
    summary:
      value.hoursEarned == null
        ? `${worker.name} back on the company rate for "${policy.name}" from ${from}`
        : `${worker.name} earns ${value.hoursEarned} h per ${value.perHoursWorked} h worked under "${policy.name}" from ${from}`,
    metadata: {
      workerId: worker.id,
      policyId: policy.id,
      effectiveFrom: from,
      hoursEarned: value.hoursEarned,
      perHoursWorked: value.perHoursWorked,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
