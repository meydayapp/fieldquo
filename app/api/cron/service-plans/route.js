// app/api/cron/service-plans/route.js
//
// Bills every active service plan that has an occurrence due, and settles the
// ones whose money is still in flight. Same CRON_SECRET pattern as the other
// crons.
//
// ── The query is the first of two cancellation guards ───────────────────────
//
// `status: "active"` here, and planBlockedReason again inside runServicePlan.
// Deliberately twice, for the same reason lib/currentMember.js re-checks
// impersonation after middleware.js already did: a filter is a filter, and the
// thing it is protecting is somebody's bank account. Either one alone stops a
// cancelled plan; having both means a future refactor has to break two things.
//
// ── At most one occurrence per plan per run ────────────────────────────────
//
// See MAX_OCCURRENCES_PER_RUN. A daily cron catches a missed week up over a
// week; a mistyped start date costs one invoice, not three hundred.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { runServicePlan, settlePendingCharges } from "@/lib/servicePlans/run";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // Settle first. A pre-authorized debit that cleared overnight should mark its
  // invoice paid BEFORE anything else runs, so the contractor's screen is right
  // even if the billing half of this run goes wrong.
  let settled = { checked: 0, settled: 0 };
  try {
    settled = await settlePendingCharges();
  } catch (err) {
    console.error("[service-plans] settle pass failed:", err.message);
  }

  const plans = await db.servicePlan.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  const results = [];
  let billed = 0;
  for (const plan of plans) {
    try {
      const result = await runServicePlan(plan.id);
      billed += result.billed || 0;
      results.push(result);
    } catch (err) {
      // One malformed plan must not stop the run for all the others — the same
      // rule the recurring-jobs cron follows. Money makes it more important,
      // not less: a plan that throws must not cost every other client their
      // invoice.
      console.error(`[service-plans] ${plan.id}:`, err.message);
      results.push({ planId: plan.id, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    plansChecked: plans.length,
    occurrencesBilled: billed,
    settled,
    results,
  });
}
