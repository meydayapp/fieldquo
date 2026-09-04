// app/api/platform/sales/plans/[id]/route.js
//
// Editing a commission plan, and taking one out of service.
//
// ══ Editing a plan CANNOT change what was already earned ══════════════════
//
// This is the property worth stating, because "edit the plan and last month's
// payouts change" is the kind of bug that only surfaces on a payout run.
//
// It holds because of where the amount lives, not because of care taken here:
// SalesCommissionEntry.amountCents is written at EARN time by earnMilestone(),
// and every figure downstream is a SUM OF ROWS (balanceCents, splitPayable,
// lib/sales/performance.js) rather than a lookup against the plan. So a plan is
// only ever consulted for the NEXT milestone. Nothing in this file touches
// salesCommissionEntry, and scripts/check-sales-commission.mjs asserts both
// halves — that the row keeps its own amount when the plan changes underneath
// it, and that this route contains no write to the ledger.
//
// The schema says the same thing in its own words above SalesCommissionPlan:
// "an entry records the amount it was written with, never a lookup at payout".
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no DELETE handler, and that is the decision rather than an
// omission. A plan a rep was ever on is part of why their ledger reads as it
// does, and SalesRep.commissionPlanId is a foreign key — deleting a plan with
// reps on it either fails or orphans them into earning nothing, silently,
// which is the exact defect this whole screen exists to end.
//
// Deactivating removes it from the picker on a rep's row and leaves every
// existing assignment intact: a rep already on a deactivated plan keeps
// earning it, because what they were promised does not change when FieldQuo
// stops offering it to new hires. The screen says so, and names them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shapePlanInput } from "@/lib/sales/commissionPlanAdmin";
import { planPayload, superadminOrRefusal } from "@/lib/sales/commissionPlanServer";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;

  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const existing = await db.salesCommissionPlan.findUnique({
    where: { id: _params.id },
    include: { _count: { select: { reps: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const shaped = shapePlanInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  if (shaped.value.name && shaped.value.name !== existing.name) {
    const clash = await db.salesCommissionPlan.findFirst({
      where: { name: shaped.value.name, id: { not: existing.id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `A commission plan called "${shaped.value.name}" already exists.` },
        { status: 409 },
      );
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const plan = await tx.salesCommissionPlan.update({
      where: { id: existing.id },
      data: shaped.value,
      include: { _count: { select: { reps: true } } },
    });

    // Both sides of every field that moved. "Edited" as an audit action tells
    // whoever reads it later that something happened and nothing about what —
    // and on a table that decides payouts, what is the only question.
    const changed = {};
    for (const key of Object.keys(shaped.value)) {
      if (existing[key] !== plan[key]) changed[key] = { from: existing[key], to: plan[key] };
    }

    // Hoisted rather than tested inline in the `action:` position, and that is
    // not style: scripts/check-platform-truth.mjs reads the literals that
    // follow `action:` to prove every action the product writes has wording on
    // /platform/audit-log, and a condition sitting there made it report the
    // string "active" as an action of its own — and swallow one of the three
    // real ones past its 247-character window.
    const activeMoved =
      "active" in shaped.value && shaped.value.active !== existing.active;

    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: activeMoved
          ? shaped.value.active
            ? "sales_commission_plan_reactivated"
            : "sales_commission_plan_deactivated"
          : "sales_commission_plan_updated",
        details: {
          planId: plan.id,
          name: plan.name,
          changed,
          // Recorded because it bounds the blast radius of the edit: these are
          // the people whose NEXT milestone pays the new figure. What they have
          // already earned is untouched — the ledger row carries its own amount.
          repCount: plan._count.reps,
        },
      },
    });

    return plan;
  });

  return NextResponse.json({ plan: planPayload(updated) });
}
