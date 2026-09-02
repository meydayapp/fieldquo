// lib/sales/commission.js
//
// What a sales rep has earned, and the only place that decides it.
//
// ══ The ledger is VoiceCreditEntry's shape, deliberately ══════════════════
//
// A unique (companyId, ref) index, a balance that is SUMMED rather than stored,
// and reversals written as new negative rows instead of edits to the original.
// That is not a stylistic echo — it is the codebase's existing answer to "money
// that must survive a webhook delivered twice", and lib/voice/credits.js's
// addCredit says why the index beats a read-then-write: two concurrent callers
// can both walk through a check, and neither can walk through a constraint.
//
// The reversal rule comes from the invoice side. docs/MONEY-FIXES.md records
// that `refunded` and `disputed` were kept as distinct statuses rather than
// overloading `paid`, because "overloading paid would have made the status
// lie". An amount already earned is a fact about a moment; rewriting it makes
// the ledger lie about what happened, so an undo is its own row.
//
// ══ Why nearly all of this is pure ═════════════════════════════════════════
//
// Every qualification rule below takes already-loaded rows and returns a
// verdict. AGENTS.md is explicit that most of the real bugs in this repo were
// found by executing pure functions against hostile input rather than by
// reading them, and these are the functions that decide whether FieldQuo pays
// somebody. They are exercised in scripts/check-sales-commission.mjs against
// replayed events, out-of-order delivery, $0 invoices and annual billing.
import { db } from "@/lib/db";

export const MILESTONES = {
  ACTIVATION: "activation",
  FIRST_PAYMENT: "first_payment",
  RETENTION: "retention",
};

export const MILESTONE_ORDER = [
  MILESTONES.ACTIVATION,
  MILESTONES.FIRST_PAYMENT,
  MILESTONES.RETENTION,
];

/** Human labels. Kept beside the keys so a screen cannot invent its own. */
export const MILESTONE_LABELS = {
  [MILESTONES.ACTIVATION]: "Activated",
  [MILESTONES.FIRST_PAYMENT]: "First payment",
  [MILESTONES.RETENTION]: "Still paying",
};

/**
 * The idempotency key for an earning.
 *
 * One per company per milestone, forever. Not keyed on the Stripe event id:
 * two DIFFERENT events can legitimately describe the same milestone (a
 * subscription created, then a payment succeeding on a retry), and keying on
 * the event would pay twice for one thing. The event id is still recorded on
 * the row, for the audit trail, but it is not what makes this exactly-once.
 */
export function commissionRef(companyId, milestone) {
  return `commission:${companyId}:${milestone}`;
}

/**
 * The key for undoing one. Its own namespace so a reversal cannot collide with
 * the earning it reverses — they must both be able to exist, since the pair IS
 * the history.
 */
export function reversalRef(companyId, milestone) {
  return `commission-reversal:${companyId}:${milestone}`;
}

/** What this plan pays for this milestone. Null for an unknown milestone. */
export function amountForMilestone(plan, milestone) {
  if (!plan) return null;
  if (milestone === MILESTONES.ACTIVATION) return plan.activationCents ?? null;
  if (milestone === MILESTONES.FIRST_PAYMENT) return plan.firstPaymentCents ?? null;
  if (milestone === MILESTONES.RETENTION) return plan.retentionCents ?? null;
  return null;
}

/**
 * Milestone 1 — the company can actually take money.
 *
 * `stripeChargesEnabled` alone, decided by the product owner on 2026-09-01, and
 * their reasoning is the important part: a one-person shop has no crew to
 * invite, so gating on "completed onboarding" would punish a solo operator for
 * being solo. That was not merely stricter — lib/onboarding.js's team step is
 * `seatsUsed > 1` and `complete` requires every step, so before
 * Company.worksAloneAt existed a solo company could NEVER be complete. The
 * milestone would have paid nothing on an entire class of legitimate sale.
 *
 * What this signal is worth: Stripe has verified a government ID and attached a
 * real bank account, and screened the account before enabling charges. That is
 * the fraud control. The referral programme deliberately waits for a first
 * PAYMENT instead, because "twenty throwaway addresses would earn a couple of
 * free years" — this pays earlier on purpose, and the thing that makes the
 * trade defensible is that twenty throwaway addresses cannot produce twenty
 * verified identities. The two programmes have different fraud postures on
 * purpose; see docs/sales/PLAN.md §5. Do not harmonise them.
 */
export function qualifiesForActivation(company) {
  return Boolean(company?.stripeChargesEnabled);
}

/**
 * Milestone 2 — money actually collected, for the first time.
 *
 * Two conditions, and the second is not defensive padding:
 *
 *  - `billing_reason === "subscription_create"`. This is the literal filter the
 *    referral programme already uses (lib/platform/stripeBilling.js), for the
 *    same reason. The trap is `checkout.session.completed`, which fires at
 *    TRIAL START with nothing collected, creates the Subscription row and flips
 *    onboardingStatus to active. It is the event that looks right.
 *
 *  - `amount_paid > 0`. The first month is free (TRIAL_PRICE), and the referral
 *    programme grants further free months on top. Without this a $0 invoice
 *    would pay a full commission on nothing collected.
 */
export function qualifiesForFirstPayment(invoice) {
  if (!invoice) return false;
  if (invoice.billing_reason !== "subscription_create") return false;
  const paid = Number(invoice.amount_paid);
  return Number.isFinite(paid) && paid > 0;
}

/**
 * Milestone 3 — still a paying customer after the retention window.
 *
 * ── On annual billing, which the brief did not consider ────────────────────
 *
 * `billingInterval` is "month" | "year" and annual is live. An annual
 * subscriber has made no SECOND payment at day 60, so a naive "have they paid
 * again" test would deny every annual sale. The condition is deliberately
 * "still a paying customer", which an annual subscriber satisfies — they paid
 * for the year and have not cancelled. The real difference is that their refund
 * exposure is twelve times larger, and that is a commercial risk to price, not
 * a branch to write. Flagged for the owner in docs/sales/PLAN.md §11.
 *
 * ── What "no refund, no chargeback" required ───────────────────────────────
 *
 * Until this session a refund or chargeback on a contractor's own FieldQuo
 * subscription was invisible: the billing webhook receives charge.refunded and
 * all three dispute events, but the handler only recognised a refund landing on
 * an Invoice Payment, and a subscription charge has none. The Subscription
 * columns read below are that gap closed.
 *
 * An OPEN dispute is not a lost one. `disputeStatus` keeps Stripe's own string
 * precisely so this function can refuse to treat "warning_needs_response" as a
 * settled loss — it holds the milestone rather than denying it, because the
 * dispute may be won and the honest answer today is "not yet".
 *
 * @returns {{ qualifies: boolean, reason: string, holdUntilResolved?: boolean }}
 */
export const OPEN_DISPUTE_STATUSES = new Set([
  "warning_needs_response",
  "warning_under_review",
  "needs_response",
  "under_review",
]);

export const LOST_DISPUTE_STATUSES = new Set(["lost", "charge_refunded"]);

export function qualifiesForRetention({
  firstPaymentAt,
  subscription,
  retentionDays = 60,
  now = new Date(),
}) {
  if (!firstPaymentAt) {
    return { qualifies: false, reason: "no_first_payment" };
  }
  const elapsedMs = now.getTime() - new Date(firstPaymentAt).getTime();
  const requiredMs = retentionDays * 24 * 60 * 60 * 1000;
  if (elapsedMs < requiredMs) {
    return { qualifies: false, reason: "too_early" };
  }
  if (!subscription) {
    return { qualifies: false, reason: "no_subscription" };
  }
  if (subscription.canceledAt) {
    return { qualifies: false, reason: "canceled" };
  }
  // trialing and past_due are explicitly NOT "still paying": past_due is what
  // markPastDue sets when a charge fails, and paying a retention reward to
  // somebody whose card is currently declining is the opposite of what this
  // milestone measures.
  if (subscription.status !== "active") {
    return { qualifies: false, reason: `status_${subscription.status}` };
  }
  if (subscription.refundedAmountCents > 0 || subscription.refundedAt) {
    return { qualifies: false, reason: "refunded" };
  }
  const dispute = subscription.disputeStatus || null;
  if (dispute && LOST_DISPUTE_STATUSES.has(dispute)) {
    return { qualifies: false, reason: "chargeback" };
  }
  if (dispute && OPEN_DISPUTE_STATUSES.has(dispute)) {
    // Held, not denied. It may be won.
    return { qualifies: false, reason: "dispute_open", holdUntilResolved: true };
  }
  return { qualifies: true, reason: "ok" };
}

/**
 * A rep's balance, summed from rows.
 *
 * Summed and never stored, for the reason balanceFor() gives in
 * lib/voice/credits.js: a stored total is a second opinion that can disagree
 * with the rows, and the one nobody looks at is the one that rots. A reversal
 * is a negative row, so it falls out of the same sum with no special case.
 */
export function balanceCents(entries) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (sum, e) => sum + (Number(e?.amountCents) || 0),
    0,
  );
}

/**
 * Group a rep's entries into what is payable now versus already batched.
 * Pure, so the payout screen and the batch closer cannot disagree.
 */
export function splitPayable(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  const unbatched = rows.filter((e) => !e.payoutBatchId);
  const batched = rows.filter((e) => e.payoutBatchId);
  return {
    unbatched,
    batched,
    payableCents: balanceCents(unbatched),
    batchedCents: balanceCents(batched),
  };
}

/**
 * Record an earned milestone. Exactly once, enforced by the database.
 *
 * Returns the existing row on a duplicate rather than throwing: a webhook
 * delivered twice is normal traffic, not an error, and the caller's correct
 * response to both deliveries is identical.
 *
 * `occurredAt` should come from STRIPE's own event timestamp wherever there is
 * one, never `new Date()` — the discipline canceledAt already follows in
 * lib/platform/stripeBilling.js, so that a replay months later cannot move when
 * something happened.
 */
export async function earnMilestone({
  companyId,
  milestone,
  stripeEventId = null,
  occurredAt = null,
  prisma = db,
}) {
  if (!companyId || !milestone) return null;

  const attribution = await prisma.salesAttribution.findUnique({
    where: { companyId },
    select: { salesRepId: true },
  });
  // No rep brought this company in. That is the normal case for every company
  // that existed before the sales portal, and it is a permanent, correct state
  // — not a gap to fill.
  if (!attribution) return null;

  const rep = await prisma.salesRep.findUnique({
    where: { id: attribution.salesRepId },
    select: { id: true, commissionPlan: true },
  });
  if (!rep) return null;

  const amountCents = amountForMilestone(rep.commissionPlan, milestone);
  // A rep with no plan earns nothing rather than a guessed default. Paying an
  // invented figure is worse than paying late; the console shows the missing
  // plan and a superadmin sets it.
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const ref = commissionRef(companyId, milestone);
  try {
    return await prisma.salesCommissionEntry.create({
      data: {
        companyId,
        salesRepId: rep.id,
        milestone,
        amountCents,
        ref,
        status: "earned",
        stripeEventId,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
  } catch (err) {
    // P2002 is the unique (companyId, ref) index doing its job.
    if (err?.code === "P2002") {
      return prisma.salesCommissionEntry.findFirst({ where: { companyId, ref } });
    }
    throw err;
  }
}

/**
 * Undo one. A NEW row carrying the negative, never an edit to the original.
 *
 * The original keeps its `earned` status and its amount, because it remains
 * true that it was earned — what changed is that something later took it back,
 * and a ledger that erases the first fact to record the second cannot be
 * audited. The pair is the history.
 */
export async function reverseMilestone({
  companyId,
  milestone,
  reason,
  stripeEventId = null,
  occurredAt = null,
  prisma = db,
}) {
  if (!companyId || !milestone) return null;

  const original = await prisma.salesCommissionEntry.findFirst({
    where: { companyId, ref: commissionRef(companyId, milestone) },
  });
  if (!original) return null;

  const ref = reversalRef(companyId, milestone);
  try {
    return await prisma.salesCommissionEntry.create({
      data: {
        companyId,
        salesRepId: original.salesRepId,
        milestone,
        amountCents: -Math.abs(original.amountCents),
        ref,
        status: "reversed",
        stripeEventId,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return prisma.salesCommissionEntry.findFirst({ where: { companyId, ref } });
    }
    throw err;
  }
}
