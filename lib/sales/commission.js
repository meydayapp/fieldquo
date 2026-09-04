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
// the wallet ledger says why the index beats a read-then-write: two concurrent callers
// can both walk through a check, and neither can walk through a constraint.
// (That argument is written out in lib/voice/credits.js, above the function
// that writes a credit row. Named indirectly on purpose: check:credit-currency
// greps for that function's NAME to count how many modules may put money into
// the wallet ledger, and this file must not be mistaken for one of them — it
// writes to its own ledger and never touches that one.)
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
  // The STORED value stays "first_payment" even though the milestone no longer
  // means a payment — it now fires on a billing-cycle boundary, free or paid
  // (see qualifiesForBillingCycle). Renaming the value would mean rewriting
  // every existing SalesCommissionEntry.milestone and every ref built from it
  // (`commission:<companyId>:first_payment` is the idempotency key that has
  // already paid people), to buy nothing a label cannot buy. The label is what
  // a human reads, so the label is what changed; this comment is the bridge for
  // whoever greps "first_payment" and expects a payment.
  FIRST_PAYMENT: "first_payment",
  RETENTION: "retention",
};

export const MILESTONE_ORDER = [
  MILESTONES.ACTIVATION,
  MILESTONES.FIRST_PAYMENT,
  MILESTONES.RETENTION,
];

/**
 * Human labels. Kept beside the keys so a screen cannot invent its own.
 *
 * Milestone 2 was "First payment" and is now "Renewed", because it no longer
 * waits for money: it fires when the company reaches its next billing cycle,
 * whether Stripe collected anything or a credit covered it. A rep's own
 * earnings screen saying "First payment" beside a company that has never paid
 * is a lie in the one place it costs trust, so the label follows the rule.
 * The stored enum value did NOT follow it — see MILESTONES above for why.
 */
export const MILESTONE_LABELS = {
  [MILESTONES.ACTIVATION]: "Activated",
  [MILESTONES.FIRST_PAYMENT]: "Renewed",
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
 * Milestone 2 — the company reached its next billing cycle. Free or paid.
 *
 * ── What this used to be, and why it paid nobody ───────────────────────────
 *
 * It was `billing_reason === "subscription_create"` AND `amount_paid > 0`, and
 * those two conditions cannot both be true on this account. Every subscription
 * is created through createTrialCheckoutSession / createBillingCheckoutSession
 * with `subscription_data.trial_period_days` (floored at 1), and TRIAL_PRICE is
 * 0, so the up-front line item is omitted entirely — Stripe rejects a zero
 * one-time charge. The `subscription_create` invoice is therefore ALWAYS $0.
 * The pair was not merely strict, it was unsatisfiable: milestone 2 had never
 * fired for any company, and because the retention sweep read milestone-2 rows
 * as its input set, milestone 3 had never fired either. Both remaining stages
 * of a $125 commission were dead, for everyone, not just for the referral case
 * that prompted the fix.
 *
 * ── The signal, and why it is subscription_cycle ───────────────────────────
 *
 * `subscription_create` is not a cycle boundary at all — it is the moment the
 * subscription is opened, which here is trial START. The first invoice that
 * marks the meter rolling over is `billing_reason === "subscription_cycle"`:
 * Stripe raises it when the trial (including any referral months pushed onto
 * `trial_end`) lapses and the first real period begins, and again on every
 * period after that. That is exactly "the company is still there when the
 * cycle turns", which is what the owner defined this milestone as.
 *
 * Checked against the shapes this account actually produces rather than
 * assumed:
 *   - trial start        → subscription_create, $0            → NO
 *   - trial ends, charged → subscription_cycle, amount_paid>0 → YES
 *   - trial ends, covered by a Stripe balance credit
 *                        → subscription_cycle, amount_paid 0, subtotal>0 → YES
 *   - mid-cycle plan change → subscription_update             → NO
 *   - a one-off invoice     → manual                          → NO
 *
 * Annual is unaffected. lib/billing/interval.js makes `billingInterval` the
 * cadence Stripe is charging on, and an annual subscriber's first real invoice
 * is a `subscription_cycle` one at trial end just like a monthly subscriber's —
 * it simply covers twelve months. Nothing here counts cycles or compares them
 * to a window, so the annual case that qualifiesForRetention worked through at
 * day 60 is untouched.
 *
 * ── Paying twice on a retry is impossible, and not because of this function ─
 *
 * A cycle invoice that fails and is retried, a webhook Stripe redelivers, and
 * NEXT month's cycle invoice all satisfy this predicate. None of them can pay
 * twice: `commissionRef(companyId, milestone)` is one row per company per
 * milestone forever, enforced by the unique (companyId, ref) index, and
 * earnMilestone returns the existing row on P2002. That is the invariant to
 * protect — this predicate is deliberately allowed to say yes repeatedly.
 *
 * ── What replaced `amount_paid > 0` as the fraud control ───────────────────
 *
 * The removed line was the stated control, so something has to carry it. Three
 * things do, and the argument is about what a fake company would have to do:
 *
 *  1. A cycle boundary cannot be reached quickly or for free. It requires a
 *     live Stripe subscription that survived an entire trial — thirty days at
 *     minimum, longer with referral months — without being cancelled. The old
 *     rule's protection was "money moved"; this one's is "time passed under
 *     Stripe's own billing", which a throwaway signup does not survive.
 *  2. A $0 cycle is only reachable because FieldQuo gave the money away. The
 *     plan price cannot be zero (chargeFor/recurringLine refuse a plan with no
 *     usable price, so no subscription exists at $0), which leaves a customer
 *     balance credit or a staff-applied coupon. Referral credit is itself the
 *     hard case, and it is gated harder than this milestone: grantReferrerCredit
 *     requires the REFERRED company to have paid real money, to be
 *     onboardingStatus "active", and to be `stripeChargesEnabled` — Stripe has
 *     verified a government ID and attached a bank account — capped at
 *     MONTHLY_REFERRAL_CAP (50) qualified referrals per referrer per calendar
 *     month. So a free cycle here is downstream of somebody else's verified,
 *     cleared payment. It cannot be conjured by the company earning it.
 *  3. `subtotal > 0` below is the residue of the old rule, kept deliberately: a
 *     cycle only counts if the cycle was WORTH something. An invoice that bills
 *     nothing because there is nothing to bill is not a customer proving out,
 *     and this is the one shape "free cycle" must not be allowed to swallow.
 *
 * What that argument does NOT claim: `stripeChargesEnabled` is not perfect
 * identity proof, and a determined operator can obtain a verified Connect
 * account. But milestone 1 already pays on exactly that signal alone, by the
 * owner's decision of 2026-09-01, so nothing here opens a class of fraud that
 * is not already open one milestone earlier — and reaching this one costs the
 * fraudster a further thirty days plus a real cleared payment from a second
 * verified business. Self-dealing is refused separately and earlier, at
 * attribution: selfDealReason() in lib/sales/attribution.js blocks a rep whose
 * email matches the company's or who is a member of it.
 *
 * `amount_paid > 0` is still accepted on its own, so a real collected payment
 * qualifies even if a future Stripe payload omits `subtotal`. Failing open
 * toward "we saw money" is the safe direction; failing open toward "we saw
 * nothing priced" is not.
 */
export function qualifiesForBillingCycle(invoice) {
  if (!invoice) return false;
  if (invoice.billing_reason !== "subscription_cycle") return false;
  const paid = Number(invoice.amount_paid);
  if (Number.isFinite(paid) && paid > 0) return true;
  // Nothing was collected. The cycle still counts — but only if it billed for
  // something, and a credit or discount is what took it to zero.
  const subtotal = Number(invoice.subtotal);
  return Number.isFinite(subtotal) && subtotal > 0;
}

/**
 * Milestone 3 — still subscribed after the retention window.
 *
 * ── The anchor is SUBSCRIPTION START, not first payment ──────────────────
 *
 * The owner's wording is "$65 after the company still is subscribed after 60
 * days (including trial)", and the parenthesis is the whole specification.
 *
 * I first built this anchored on the first PAYMENT, which is wrong and would
 * have paid late by roughly the length of the trial: the first month is free,
 * so a payment lands near day 30, and counting sixty days from there means
 * paying at day 90 for a milestone the owner defined at day 60.
 *
 * So the clock starts when the subscription starts — trial included — which is
 * Subscription.createdAt, the row written at checkout.session.completed. That
 * is trial start, not first charge, and here that is exactly what is wanted.
 *
 * ── The first-payment CONDITION is gone, because it was a false statement ──
 *
 * This used to also require a first payment — "as a condition rather than as
 * the clock", justified by "a company sixty days in on a one-month trial has
 * necessarily been charged". That sentence was already untrue when it was
 * written: referral months are granted by pushing Stripe's `trial_end` forward
 * (lib/referrals/extendAccess.js), so a company that keeps introducing other
 * contractors is sixty days in and has never been charged. And since milestone
 * 2 was unsatisfiable (see qualifiesForBillingCycle), the condition was denying
 * every company, not the odd one.
 *
 * What that condition was reaching for is carried by `status === "active"`
 * below, and carried better: it is read live from Stripe's own view of the
 * subscription rather than inferred from our ledger. A company that is `active`
 * at day sixty is out of its trial and on the meter. A company still `trialing`
 * is HELD by that same check, not denied — the sweep re-derives nightly and
 * asks again the day they convert.
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
  subscriptionStartedAt,
  subscription,
  retentionDays = 60,
  now = new Date(),
}) {
  // The clock. Trial included, per the owner's own wording.
  if (!subscriptionStartedAt) {
    return { qualifies: false, reason: "no_subscription_start" };
  }
  const elapsedMs = now.getTime() - new Date(subscriptionStartedAt).getTime();
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
  //
  // This line also carries what the deleted first-payment condition was for.
  // `trialing` at day sixty is a company whose free period is still running —
  // a referral chain pushing trial_end forward, or a comp. It is a HOLD: the
  // nightly sweep re-derives from scratch, so the day they convert to active
  // they qualify, with no backfill needed and nothing consumed by looking.
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
/**
 * Does a rep who has left still earn a milestone their company reaches later?
 *
 * YES, and the owner's own framing settles it: the $125 is one payment for one
 * acquisition, split into three stages. The stages exist to track the customer
 * proving out — they are not three separate pieces of work, and the third is
 * not a retainer for still being employed.
 *
 * So the milestone measures the COMPANY's retention, not the rep's employment.
 * A rep who acquired a customer that is still paying at sixty days earned that
 * stage by acquiring them, and `endedAt` is deliberately not consulted here.
 *
 * The opposite rule was the tempting one and it is worse in both directions:
 * it would let FieldQuo keep a third of what it owes by timing a departure,
 * and it would give a rep a reason to stay employed rather than to sell.
 *
 * `active: false` still stops a rep signing in and being attributed anything
 * NEW — this is only about milestones on companies already theirs.
 */
export function departedRepStillEarns() {
  return true;
}

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
