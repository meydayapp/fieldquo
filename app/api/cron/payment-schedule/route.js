// app/api/cron/payment-schedule/route.js
//
// Daily pass over every job with a stage still waiting to fire. Same
// CRON_SECRET pattern as the other crons, and the same reasoning as
// app/api/cron/service-plans/route.js for running once a day rather than
// on every request: a job's dates move at most a few times, never a few
// times an hour.
//
// ── Why this recomputes rather than trusting a stored dueDate ──────────────
//
// lib/paymentSchedule/run.js's recomputeAndFirePendingStages re-derives each
// PENDING stage's dueDate from the job's CURRENT startDate/endDate on every
// run, not from whatever was last written. That is what makes "the job
// slipped a week" actually move the pending money with it — the owner's own
// answer to that question — without a separate "job dates changed" hook to
// keep in sync. A stage that has already fired (`requested`) is left alone:
// its dueDate froze the moment the client was asked for it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { runPaymentSchedule } from "@/lib/paymentSchedule/run";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const result = await runPaymentSchedule();

  return NextResponse.json({ success: true, ...result });
}
