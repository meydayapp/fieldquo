// lib/stripe/settleChargeEvent.js
//
// A refund or a dispute might land on EITHER Stripe webhook endpoint, for
// the exact reason lib/stripe/settleCheckoutSession.js's header gives for
// checkout.session.completed: every client-facing charge is a destination
// charge created on the PLATFORM account, so Stripe — not a comment in this
// codebase — decides which registered endpoint receives the event. Both
// webhook routes hand these events to this dispatcher first, the same shape
// settleCheckoutSession already uses, so "which endpoint" only has to be
// answered in one place.
//
// ── Two recognitions, in order ─────────────────────────────────────────────
//
// A charge that doesn't match any Invoice Payment used to be the end of it:
// "not one of ours". That was true of a voice/AI top-up and a booking fee, and
// FALSE of the one case it was quietly swallowing — a refund or a chargeback on
// the contractor's own FieldQuo SUBSCRIPTION, which has no Payment row either.
// FieldQuo could not see that a customer had charged back.
//
// So the Connect recognition runs FIRST and unchanged, and only what it
// declines is offered to lib/billing/subscriptionChargeEvent.js. The order is
// load-bearing: the Connect path is correct, it owns every charge it claims,
// and the second recognition is additive rather than a reroute. A charge
// neither of them claims is still simply not ours — the same contract
// settleCheckoutSession.js uses for checkout sessions.

import { db } from "@/lib/db";
import { recordStripeRefund } from "@/lib/invoices/recordStripeRefund";
import { recordStripeDispute } from "@/lib/invoices/recordStripeDispute";
import { recordSubscriptionChargeEvent } from "@/lib/billing/subscriptionChargeEvent";

const DISPUTE_EVENTS = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);

/**
 * @param event  a Stripe Event object
 * @param opts   seams for scripts/check-subscription-refunds.mjs — a check that
 *               needs a database and a Stripe secret is a check that stops being
 *               run. Production callers pass nothing.
 * @returns {Promise<{handled: boolean, kind: string, result?: object}>}
 */
export async function settleChargeEvent(event, { prisma = db, deps = {} } = {}) {
  const isRefund = event?.type === "charge.refunded";
  const isDispute = DISPUTE_EVENTS.has(event?.type);
  if (!isRefund && !isDispute) return { handled: false, kind: "unknown" };

  const connect = isRefund
    ? await recordStripeRefund(prisma, event.data.object)
    : await recordStripeDispute(prisma, event.data.object);

  // `recorded` is the Connect path's own word for "this charge was mine".
  // Anything else it returns is a decline, and a decline is the only thing the
  // subscription path is ever shown.
  if (connect?.recorded) {
    return { handled: true, kind: isRefund ? "refund" : "dispute", result: connect };
  }

  const own = await recordSubscriptionChargeEvent(prisma, event, { deps });
  if (own?.recorded) {
    return {
      handled: true,
      kind: isRefund ? "subscription_refund" : "subscription_dispute",
      result: own,
    };
  }

  // Handled either way: the event reached both recognitions and neither claimed
  // it. Reporting `handled: true` keeps the webhook route answering 200 for a
  // charge that is genuinely nobody's, exactly as it did before.
  return {
    handled: true,
    kind: isRefund ? "refund" : "dispute",
    result: { ...connect, subscription: own },
  };
}
