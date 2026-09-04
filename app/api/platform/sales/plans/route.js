// app/api/platform/sales/plans/route.js
//
// Commission plans: the list, and creating one.
//
// ══ Why this route had to exist before a closer could be hired ════════════
//
// `salesCommissionPlan.create` appeared NOWHERE in this repository — no route,
// no screen, no seed — while lib/sales/commission.js refuses to write a ledger
// row for a rep whose plan is missing. Every milestone therefore earned $0,
// silently, for every rep, and /platform/sales/performance told a superadmin to
// "assign a plan" with nothing anywhere to assign it from. Correctness had been
// proven at length (101 assertions); reachability never had.
//
// ══ No DELETE, deliberately ═══════════════════════════════════════════════
//
// A plan a rep has ever been on is part of why their ledger says what it says.
// Deactivating (`active: false`) takes it out of the picker and leaves the
// record standing — the same rule SalesRep.endedAt states in the schema, and
// the same one app/api/platform/sales/reps/[id] follows for reps.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MILESTONE_LABELS } from "@/lib/sales/commission";
import { PLAN_MONEY_FIELDS, STANDARD_PLAN, shapePlanInput } from "@/lib/sales/commissionPlanAdmin";
import { planPayload, superadminOrRefusal } from "@/lib/sales/commissionPlanServer";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const plans = await db.salesCommissionPlan.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { reps: true } } },
  });

  // Who is on each plan, by name, so deactivating one is a visible consequence
  // rather than a surprise: a plan with reps on it is not deleted and not
  // silently emptied — the screen names whose next milestone would stop paying.
  const reps = await db.salesRep.findMany({
    where: { commissionPlanId: { not: null } },
    select: { id: true, name: true, active: true, commissionPlanId: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const byPlan = new Map();
  for (const rep of reps) {
    if (!byPlan.has(rep.commissionPlanId)) byPlan.set(rep.commissionPlanId, []);
    byPlan.get(rep.commissionPlanId).push({ id: rep.id, name: rep.name, active: rep.active });
  }

  return NextResponse.json({
    plans: plans.map((p) => ({ ...planPayload(p), reps: byPlan.get(p.id) || [] })),
    // The form's own field labels beside the milestone's human name, which
    // comes from MILESTONE_LABELS and nowhere else — milestone 2 reads
    // "Renewed" because it fires on a billing cycle, free or paid, and a screen
    // saying "First payment" beside a company that has never paid is a lie in
    // the one place it costs trust.
    fields: PLAN_MONEY_FIELDS.map((f) => ({
      dollarKey: f.dollarKey,
      label: f.label,
      milestone: f.milestone,
      milestoneLabel: MILESTONE_LABELS[f.milestone] || f.milestone,
    })),
    // The owner's stated terms, offered as a prefill so nobody has to remember
    // three numbers.
    standard: STANDARD_PLAN,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));

  // The ONE conversion from what somebody typed into what the Int columns
  // hold. Dollars in, whole cents out, and the refusals come back in the same
  // words the screen turned the field red with.
  const shaped = shapePlanInput(body, { partial: false });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const name = shaped.value.name;
  const clash = await db.salesCommissionPlan.findFirst({
    where: { name },
    select: { id: true },
  });
  if (clash) {
    // Not a database constraint — `name` is not @unique, and making it so would
    // be a schema change for a convenience. This is about the picker on a rep's
    // row: two plans called "Standard" there is a choice nobody can make.
    return NextResponse.json(
      { error: `A commission plan called "${name}" already exists.` },
      { status: 409 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const plan = await tx.salesCommissionPlan.create({
      data: { ...shaped.value, active: shaped.value.active ?? true },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_commission_plan_created",
        details: {
          planId: plan.id,
          name: plan.name,
          activationCents: plan.activationCents,
          firstPaymentCents: plan.firstPaymentCents,
          retentionCents: plan.retentionCents,
          retentionDays: plan.retentionDays,
        },
      },
    });
    return plan;
  });

  return NextResponse.json(
    { plan: { ...planPayload({ ...created, _count: { reps: 0 } }), reps: [] } },
    { status: 201 },
  );
}
