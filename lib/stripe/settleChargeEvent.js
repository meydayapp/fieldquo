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
// A charge/dispute that doesn't match any Invoice Payment (a subscription
// invoice, a voice/AI top-up, a booking fee — none of which create a Payment
// row) is simply not ours; see recordStripeRefund.js's header for the exact
// scope.

import { db } from "@/lib/db";
import { recordStripeRefund } from "@/lib/invoices/recordStripeRefund";
import { recordStripeDispute } from "@/lib/invoices/recordStripeDispute";

const DISPUTE_EVENTS = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);

/**
 * @param event  a Stripe Event object
 * @returns {Promise<{handled: boolean, kind: string, result?: object}>}
 */
export async function settleChargeEvent(event) {
  if (event?.type === "charge.refunded") {
    const result = await recordStripeRefund(db, event.data.object);
    return { handled: true, kind: "refund", result };
  }

  if (DISPUTE_EVENTS.has(event?.type)) {
    const result = await recordStripeDispute(db, event.data.object);
    return { handled: true, kind: "dispute", result };
  }

  return { handled: false, kind: "unknown" };
}
