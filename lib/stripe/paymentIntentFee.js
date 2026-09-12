// lib/stripe/paymentIntentFee.js
//
// What processing fee a SETTLED payment actually carried — read back from the
// PaymentIntent, never recomputed from the amount.
//
// The fee is decided at creation (lib/stripe.js, lib/servicePlans/stripeMandate.js
// — every creator calls processingFeeCents once and writes the answer into
// `application_fee_amount`). At settlement the honest record is what that
// intent says was taken, because that is the number Stripe deducted from the
// transfer. Recomputing here would agree today and disagree the day a rate
// changes between a link being minted and being paid.
//
// ── The one true-up: Affirm ───────────────────────────────────────────────
//
// A pay link for a company with `offerFinancing` on is the ONLY money-moving
// Checkout session with more than one payment method (card + Affirm — see
// createInvoiceCheckoutSession). Its fee cannot be known when the session is
// created, so it is created at the CARD rate, the lower of the two: a homeowner
// who pays by card is charged exactly the published card fee, never a cent
// more. When the homeowner chose Affirm instead, Stripe's Affirm fee (~6% +
// 30¢) is larger than what was collected, and the difference is recovered
// here by a partial reversal of the destination transfer — the contractor
// turned financing on and bears its cost, the same way they bear the card
// fee. The figure used is Stripe's ACTUAL fee from the charge's balance
// transaction, not a second rate table: there is nothing to keep in sync and
// nothing to be wrong about.
//
// If the reversal fails (a connected balance already paid out, a Stripe
// outage) the payment is still recorded with the fee that WAS collected and
// the shortfall is logged. A recording that waits on a reversal is a paid
// invoice that shows unpaid, which is worse than FieldQuo absorbing one
// Affirm premium.
//
// Returns null — not zero — when the intent carries no application fee (a
// charge created before the pass-through shipped, or a fee lookup that
// failed). Absence is not a statement (AGENTS.md failure class #5); the
// Payment row's fee columns stay null and the screens say nothing.

import { stripe } from "@/lib/stripe";

const AFFIRM = "affirm";

/**
 * @param intentRef  a PaymentIntent id, or a PaymentIntent object (a webhook
 *                   payload) — an object without an expanded latest_charge is
 *                   re-fetched, one retrieve.
 * @param deps       `{ stripe }` injection seam for scripts/check-processing-fee.mjs.
 * @returns {Promise<{processingFeeCents:number, netCents:number, feeRateLabel:string|null}|null>}
 */
export async function settledFeeFor(intentRef, deps = {}) {
  const client = deps.stripe || stripe;
  const id = typeof intentRef === "string" ? intentRef : intentRef?.id;
  if (!id) return null;

  let intent = typeof intentRef === "object" ? intentRef : null;
  const hasCharge =
    intent?.latest_charge && typeof intent.latest_charge === "object";
  if (!hasCharge) {
    intent = await client.paymentIntents.retrieve(id, {
      expand: ["latest_charge.balance_transaction"],
    });
  }

  const collected = intent?.application_fee_amount;
  if (collected == null || !Number.isFinite(Number(collected))) return null;

  const charge =
    intent.latest_charge && typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : null;
  const method =
    charge?.payment_method_details?.type ||
    (Array.isArray(intent.payment_method_types) && intent.payment_method_types.length === 1
      ? intent.payment_method_types[0]
      : null);
  const received = Number(intent.amount_received ?? intent.amount) || 0;

  let fee = Math.max(0, Math.trunc(Number(collected)));

  if (method === AFFIRM) {
    const actual = charge?.balance_transaction?.fee;
    const transferId =
      typeof charge?.transfer === "string" ? charge.transfer : charge?.transfer?.id;
    const shortfall = Number.isFinite(Number(actual)) ? Math.trunc(Number(actual)) - fee : 0;
    if (shortfall > 0 && transferId) {
      try {
        await client.transfers.createReversal(
          transferId,
          {
            amount: shortfall,
            description: "Affirm processing fee (pay-over-time, chosen at checkout)",
            metadata: { paymentIntentId: intent.id, reason: "affirm_fee_trueup" },
          },
          // One reversal per intent, ever. Both webhook endpoints and the
          // return leg can settle the same session; the key makes the
          // repeats return the first reversal instead of pulling the
          // difference twice.
          { idempotencyKey: `fq-affirm-fee-${intent.id}` },
        );
        fee += shortfall;
      } catch (err) {
        console.error(
          "[stripe] Affirm fee true-up failed; recording the collected fee only:",
          intent.id,
          err?.message,
        );
      }
    }
  }

  fee = Math.min(fee, received);
  return {
    processingFeeCents: fee,
    netCents: received - fee,
    feeRateLabel: method || null,
  };
}

/**
 * The same, but never throws — a fee lookup must not turn a real payment into
 * a retried webhook. Every settlement path calls this form.
 */
export async function settledFeeOrNull(intentRef, deps = {}) {
  try {
    return await settledFeeFor(intentRef, deps);
  } catch (err) {
    console.error("[stripe] processing fee lookup failed:", err?.message);
    return null;
  }
}
