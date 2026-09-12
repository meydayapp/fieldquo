// lib/stripe/connectFeeLedger.js
//
// The company-side half of Connect fee recovery: what a company still owes
// for Stripe's Express account fees, how much of it a given charge can carry,
// and marking rows recovered once a charge has actually settled with the
// recovery on it. The Stripe-side half — reading the fees Stripe billed the
// platform — is lib/stripe/connectFees.js (a cron), kept apart so this file
// never imports the Stripe client and lib/stripe.js can import this without
// a cycle.
//
// ── How a fee gets recovered ──────────────────────────────────────────────
//
// Stripe bills the PLATFORM for a connected Express account (a monthly
// active-account fee, a per-payout fee). Account debits — pulling money from
// a connected account — are region-locked and not available for a US
// contractor on a Canadian platform, so the only universal door is the
// company's next destination charge: the outstanding amount is ADDED to that
// charge's application fee, capped so the whole fee never exceeds the charge
// (Stripe rejects that), and whatever did not fit carries forward. The row
// is marked recovered only at SETTLEMENT, from the PaymentIntent's own
// metadata (fq_recovery_cents), never at creation: a pay link is minted far
// more often than it is paid, and a row marked recovered on a link nobody
// clicked is money the platform never sees.
//
// Only rows in the charge's own currency ride on it. A fee Stripe billed the
// Canadian platform in CAD cannot be honestly added to a USD charge without
// a conversion rate nobody has; it stays outstanding and shows on the
// platform card as such.
//
// A company that never pays again keeps its outstanding balance for ever —
// never collected, never written off silently. The platform card reports it
// as a platform cost.

import { db } from "@/lib/db";

export const RECOVERY_KINDS = Object.freeze(["active_account", "payout", "other"]);

/**
 * PURE — how much recovery a charge can carry, and what carries forward.
 * `outstandingCents` is what the company owes in the charge's currency;
 * `processingFeeCents` the fee the charge already carries; `amountCents`
 * the charge itself. Executed in scripts/check-processing-fee.mjs.
 */
export function recoveryOnCharge({ outstandingCents, processingFeeCents, amountCents }) {
  const owed = Math.max(0, Math.trunc(Number(outstandingCents)) || 0);
  const fee = Math.max(0, Math.trunc(Number(processingFeeCents)) || 0);
  const amount = Math.max(0, Math.trunc(Number(amountCents)) || 0);
  const room = Math.max(0, amount - fee);
  const recover = Math.min(owed, room);
  return { recoverCents: recover, carryForwardCents: owed - recover };
}

/**
 * PURE — allocate a recovered amount across outstanding rows, oldest first,
 * returning the per-row updates. Never allocates more than a row still owes.
 */
export function allocateRecovery(rows, cents) {
  let left = Math.max(0, Math.trunc(Number(cents)) || 0);
  const updates = [];
  for (const r of rows) {
    if (left <= 0) break;
    const owed = Math.max(0, (Number(r.feeCents) || 0) - (Number(r.recoveredCents) || 0));
    if (owed <= 0) continue;
    const take = Math.min(owed, left);
    updates.push({ id: r.id, addCents: take, period: r.period });
    left -= take;
  }
  return { updates, unallocatedCents: left };
}

const WHERE_OUTSTANDING = (companyId, currency) => ({
  companyId,
  currency: String(currency || "").toLowerCase(),
});

/**
 * What the company still owes, in one currency, in cents.
 */
export async function outstandingRecoveryCents({ companyId, currency }, deps = {}) {
  const prisma = deps.db || db;
  if (!companyId || !currency) return 0;
  const rows = await prisma.connectFeeRecovery.findMany({
    where: WHERE_OUTSTANDING(companyId, currency),
    select: { feeCents: true, recoveredCents: true },
  });
  return rows.reduce(
    (sum, r) => sum + Math.max(0, (Number(r.feeCents) || 0) - (Number(r.recoveredCents) || 0)),
    0,
  );
}

/**
 * The same, but never throws — a ledger read must not stop a pay link from
 * being minted; the fee simply waits for the next charge.
 */
export async function outstandingRecoveryOrZero(args, deps = {}) {
  try {
    return await outstandingRecoveryCents(args, deps);
  } catch (err) {
    console.error("[connect-fees] outstanding read failed:", err?.message);
    return 0;
  }
}

/**
 * A charge settled carrying `cents` of recovery: mark the oldest outstanding
 * rows recovered, stamped with the PaymentIntent. Idempotent per intent —
 * a redelivered settlement finds rows already stamped with this intent and
 * allocates nothing more.
 *
 * @returns {{ appliedCents: number, period: string|null }}
 */
export async function applyRecovery({ companyId, currency, cents, paymentIntentId }, deps = {}) {
  const prisma = deps.db || db;
  const want = Math.max(0, Math.trunc(Number(cents)) || 0);
  if (!companyId || !currency || want <= 0 || !paymentIntentId) {
    return { appliedCents: 0, period: null };
  }

  const already = await prisma.connectFeeRecovery.findMany({
    where: { companyId, recoveredOnPaymentIntent: paymentIntentId },
    select: { id: true, period: true },
  });
  if (already.length) {
    return { appliedCents: 0, alreadyApplied: true, period: already.map((r) => r.period).sort()[0] };
  }

  const rows = await prisma.connectFeeRecovery.findMany({
    where: WHERE_OUTSTANDING(companyId, currency),
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
    select: { id: true, feeCents: true, recoveredCents: true, period: true },
  });
  const { updates } = allocateRecovery(rows, want);
  const now = new Date();
  for (const u of updates) {
    await prisma.connectFeeRecovery.update({
      where: { id: u.id },
      data: {
        recoveredCents: { increment: u.addCents },
        recoveredOnPaymentIntent: paymentIntentId,
        recoveredAt: now,
      },
    });
  }
  const applied = updates.reduce((s, u) => s + u.addCents, 0);
  return { appliedCents: applied, period: updates[0]?.period || null };
}

/**
 * Platform totals for the rates card: recovered this month, outstanding
 * across every company, per currency.
 */
export async function connectFeeTotals({ month }, deps = {}) {
  const prisma = deps.db || db;
  const rows = await prisma.connectFeeRecovery.findMany({
    select: { currency: true, feeCents: true, recoveredCents: true, recoveredAt: true, period: true },
  });
  const totals = {};
  for (const r of rows) {
    const cur = r.currency;
    totals[cur] ||= { recoveredThisMonthCents: 0, outstandingCents: 0, billedThisMonthCents: 0 };
    const owed = Math.max(0, (Number(r.feeCents) || 0) - (Number(r.recoveredCents) || 0));
    totals[cur].outstandingCents += owed;
    if (r.period === month) totals[cur].billedThisMonthCents += Number(r.feeCents) || 0;
    if (r.recoveredAt && r.recoveredAt.toISOString().slice(0, 7) === month) {
      totals[cur].recoveredThisMonthCents += Number(r.recoveredCents) || 0;
    }
  }
  return totals;
}
