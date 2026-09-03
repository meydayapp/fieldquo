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
import { notifyChargeEvent } from "@/lib/notifications/chargeNotice";

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
    // ── The one thing that used to happen here: nothing ──────────────────
    //
    // A refund or a chargeback on a contractor's own invoice was recorded and
    // announced to no one — no email, no SMS, no activity row, no error log.
    // Money left and the contractor found out by opening Stripe. This is the
    // event the notification feed exists for; see lib/notifications/chargeNotice.js.
    //
    // Fire-and-forget, after the settlement above has committed, exactly like
    // recordStripePayment.js:41's payment notice. A notification failure must
    // never make Stripe retry a charge event, so this is deliberately not
    // awaited and the helper never throws.
    //
    // The SUBSCRIPTION path below is deliberately NOT notified: that is
    // FieldQuo's own billing, a different tenant's problem, and audit §10.9
    // puts platform events on /platform's own surfaces rather than in a
    // contractor's feed.
    notifyChargeEvent({
      invoiceId: connect.invoiceId,
      kind: isRefund ? "refund" : "dispute",
    }).catch((err) => console.error("[stripe] charge notice failed:", err?.message));

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
