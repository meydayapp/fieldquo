// app/api/leave/opening/route.js
//
// POST — record a person's hours worked and leave taken between 1 January and
//        the day their company started using FieldQuo (LeaveOpeningBalance).
//
// The owner (2026-10-03): "an ability to register already worked hours since
// January 1, so that someone registering now can enter previous hours to
// better reflect employees accumulated paid leave.. and unpaid leave if
// applicable."
//
// ── Append-only ─────────────────────────────────────────────────────────────
//
// Every save is a NEW row; the newest row for (worker, year) is the one in
// force and the rest are the audit trail the Time off screen prints ("entered
// by Sam on 3 Oct, changed by Dana on 5 Oct"). There is no PATCH and no
// DELETE: clearing an opening balance is saving zeros, by somebody, on a day.
//
// ── Never a time entry ─────────────────────────────────────────────────────
//
// These hours were paid by whatever the company used before. They are not
// written to TimeEntry and nothing in payroll reads them — they feed one
// thing, per_hours_worked accrual, and the leave already taken comes off the
// paid balances (LeaveBalance.openingUsedDays). Both through refreshAccruals,
// forced, so the balance on screen moves the moment this is saved.
//
// Reads are not here: GET /api/leave returns the rows to the person they are
// about and, with ?scope=team, to managers — the same audiences as the
// balances they explain.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { refreshAccruals } from "@/lib/leave/balances";
import { validateOpening } from "@/lib/leave/hourAccrual";
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

  // Any policy the company has ever had, retired ones included: leave taken in
  // March under a policy retired in June was still taken.
  const policies = await db.leavePolicy.findMany({
    where: { companyId: member.companyId },
    select: { id: true, name: true },
  });

  const { errors, value } = validateOpening({
    year: body?.year,
    hoursWorked: body?.hoursWorked,
    throughDate: body?.throughDate,
    taken: body?.taken,
    note: body?.note,
    hiredOn: worker.hiredOn,
    policyIds: policies.map((p) => p.id),
    todayIso: new Date().toISOString().slice(0, 10),
  });
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  const previous = await db.leaveOpeningBalance.findFirst({
    where: { workerId: worker.id, year: value.year },
    orderBy: { createdAt: "desc" },
    select: { id: true, hoursWorked: true, throughDate: true, taken: true },
  });

  const created = await db.leaveOpeningBalance.create({
    data: {
      companyId: member.companyId,
      workerId: worker.id,
      year: value.year,
      hoursWorked: value.hoursWorked,
      throughDate: value.throughDate,
      taken: value.taken,
      note: value.note,
      enteredById: member.userId,
      enteredByName: await enteredByName(member),
    },
  });

  // Only the current year's balances are kept live (GET /api/leave refreshes
  // the current year); a past year's opening balance is recorded and shown,
  // and is picked up if that year is ever recomputed.
  if (value.year === new Date().getUTCFullYear()) {
    await refreshAccruals({ companyId: member.companyId, year: value.year, maxAgeMs: 0 });
  }

  const nameOf = Object.fromEntries(policies.map((p) => [p.id, p.name]));
  await recordActivity(member, {
    action: previous ? "leave.opening_changed" : "leave.opening_entered",
    entityType: "leave",
    entityId: created.id,
    summary: `${previous ? "Changed" : "Entered"} ${worker.name}'s hours before FieldQuo for ${value.year}: ${value.hoursWorked} h to ${value.throughDate.toISOString().slice(0, 10)}`,
    metadata: {
      workerId: worker.id,
      year: value.year,
      hoursWorked: value.hoursWorked,
      throughDate: value.throughDate.toISOString().slice(0, 10),
      taken: value.taken.map((t) => ({ ...t, policy: nameOf[t.policyId] || null })),
      previous: previous
        ? {
            id: previous.id,
            hoursWorked: Number(previous.hoursWorked),
            throughDate: previous.throughDate.toISOString().slice(0, 10),
            taken: previous.taken,
          }
        : null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
