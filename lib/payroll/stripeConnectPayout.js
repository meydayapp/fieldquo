// lib/payroll/stripeConnectPayout.js
// Contractor payouts only. Pulls approved, unpaid TimeEntry hours for a period,
// computes the amount from the Worker's hourlyRate, and transfers via Stripe Connect.
// This does NOT withhold or file any taxes — that's the contractor's own responsibility
// (1099-style), which is exactly why this path is restricted to worker.type === "contractor".

import { db } from "@/lib/db";
import { payoutToContractor } from "@/lib/stripe";

export async function runContractorPayout({
  workerId,
  periodStart,
  periodEnd,
}) {
  const worker = await db.worker.findUnique({ where: { id: workerId } });

  if (!worker) throw new Error("Worker not found");
  if (worker.type !== "contractor") {
    throw new Error(
      "This function only handles contractor payouts — employees must use the embedded payroll provider",
    );
  }
  if (!worker.stripeConnectedAccountId) {
    throw new Error("Worker has not connected a Stripe account yet");
  }
  if (!worker.hourlyRate) {
    throw new Error("Worker has no hourlyRate set");
  }

  // GUARD AGAINST DOUBLE-PAY. Nothing marks TimeEntry rows as paid, so a re-run
  // or a double-click would transfer the same hours again — real money, no undo.
  // Refuse if a non-failed payout already covers an overlapping period for this
  // worker. A previously FAILED payout is allowed through so a genuine retry
  // still works.
  const overlappingPayout = await db.payout.findFirst({
    where: {
      workerId,
      status: { not: "failed" },
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
    select: { id: true, periodStart: true, periodEnd: true, status: true },
  });
  if (overlappingPayout) {
    throw new Error(
      "A payout already covers this period for this contractor — refusing to pay the same hours twice.",
    );
  }

  const approvedEntries = await db.timeEntry.findMany({
    where: {
      workerId,
      status: "approved",
      clockIn: { gte: periodStart, lte: periodEnd },
      clockOut: { not: null },
    },
  });

  if (approvedEntries.length === 0) {
    throw new Error("No approved time entries for this period");
  }

  const totalHours = approvedEntries.reduce(
    (sum, e) => sum + Number(e.hours || 0),
    0,
  );
  const amount = totalHours * Number(worker.hourlyRate);
  const amountCents = Math.round(amount * 100);

  // Create the Payout record as "processing" BEFORE calling Stripe, so a crash between
  // the transfer succeeding and the DB write doesn't leave you with an untracked payment.
  const payout = await db.payout.create({
    data: {
      workerId,
      amount,
      periodStart,
      periodEnd,
      method: "stripe_transfer",
      status: "processing",
    },
  });

  try {
    const transfer = await payoutToContractor({ worker, amountCents });

    await db.payout.update({
      where: { id: payout.id },
      data: { status: "paid" },
    });

    return { payout, transferId: transfer.id, totalHours, amount };
  } catch (err) {
    await db.payout.update({
      where: { id: payout.id },
      data: { status: "failed" },
    });
    throw err;
  }
}

export async function runContractorPayoutsForCompany({
  companyId,
  periodStart,
  periodEnd,
}) {
  const contractors = await db.worker.findMany({
    where: {
      companyId,
      type: "contractor",
      active: true,
      stripeConnectedAccountId: { not: null },
    },
  });

  const results = [];
  for (const worker of contractors) {
    try {
      const result = await runContractorPayout({
        workerId: worker.id,
        periodStart,
        periodEnd,
      });
      results.push({ workerId: worker.id, success: true, ...result });
    } catch (err) {
      results.push({ workerId: worker.id, success: false, error: err.message });
    }
  }
  return results;
}
