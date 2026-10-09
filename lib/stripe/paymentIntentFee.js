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
// ── The true-up, on every charge ──────────────────────────────────────────
//
// The estimate at creation is the flat published rate (3% + 30¢ on a card).
// Stripe's REAL cost for that charge is only known once it settles, and it
// is higher whenever the card was issued abroad (+0.8% on a Canadian
// platform) or the charge needed currency conversion (+2%). A client who
// chose pay over time on the hosted page (Klarna, Affirm, Afterpay) is
// priced by its own rule instead: the fee ends at max(6.5% + 30¢, Stripe's
// actual) — processingFee.js financingSettlementFee (owner, 2026-10-09).
// For everything else, the owner's rule (2026-09-12):
// every fee passes through. So at settlement this reads the charge's
// balance transaction `fee` (Stripe's actual cost, surcharges included) and,
// when it exceeds the Stripe share of what was collected, reverses the
// difference out of the destination transfer — a partial
// transfers.createReversal, idempotent per intent. The contractor bears
// Stripe's real cost plus FieldQuo's 0.1%, never less; when Stripe's real
// cost is BELOW the estimate (a domestic card on the flat rate) nothing
// moves, because the published rate is the promise. The Payment row keeps
// the estimate and Stripe's actual fee beside the trued-up figure so
// "expected vs actual" can be reported; the contractor sees one number.
//
// The application fee on a charge may also carry Connect account-fee
// recovery (lib/stripe/connectFeeLedger.js). The two parts are split by the
// intent's own metadata, written at creation — fq_fee_estimate_cents and
// fq_recovery_cents — never by arithmetic on the total, and the recovery
// part is marked recovered in the ledger here, at settlement, on the same
// intent id.
//
// If the reversal fails (a connected balance already paid out, a Stripe
// outage) the payment is still recorded with the fee that WAS collected and
// the shortfall is logged. A recording that waits on a reversal is a paid
// invoice that shows unpaid, which is worse than FieldQuo absorbing one
// surcharge.
//
// Returns null — not zero — when the intent carries no application fee (a
// charge created before the pass-through shipped, or a fee lookup that
// failed). Absence is not a statement (AGENTS.md failure class #5); the
// Payment row's fee columns stay null and the screens say nothing.

import { stripe } from "@/lib/stripe";
import {
  platformShareCents,
  trueUpCents,
  FINANCING_RATE,
  FINANCING_SETTLEMENT_METHODS,
  financingSettlementFee,
  isFinancingSettlementMethod,
} from "@/lib/stripe/processingFee";
import { applyRecovery } from "@/lib/stripe/connectFeeLedger";
import { actualPaymentMethod } from "@/lib/stripe/actualPaymentMethod";

// The method the estimate was priced for — for everything that is NOT a
// pay-over-time method (those settle by financingSettlementFee). Kept for
// a method outside that table that rides on a card-priced session.
function estimateMethodFor(method) {
  return method === "affirm" ? "card" : method;
}

/**
 * What the true-up reversal says on the contractor's Stripe transfer — the
 * line they read in their Express dashboard. Every pay-over-time provider
 * gets its own name: a Klarna payment on the hosted page was labelled "Card
 * processing surcharge (international card / currency conversion)" until
 * 2026-10-09, which is a true amount under a false reason (executed in
 * scripts/check-klarna.mjs). Anything else Stripe settles keeps the card
 * wording, which is what the reversal is for on a card.
 */
export function trueUpDescription(method) {
  if (isFinancingSettlementMethod(method)) {
    return `${FINANCING_SETTLEMENT_METHODS[method]} processing fee (pay-over-time, chosen at checkout)`;
  }
  return "Card processing surcharge (international card / currency conversion)";
}

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
      expand: ["latest_charge.balance_transaction", "payment_method"],
    });
  }

  const collected = intent?.application_fee_amount;
  if (collected == null || !Number.isFinite(Number(collected))) return null;

  const charge =
    intent.latest_charge && typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : null;
  const method = actualPaymentMethod(intent);
  const received = Number(intent.amount_received ?? intent.amount) || 0;
  const currency = String(intent.currency || charge?.currency || "").toLowerCase();
  const meta = intent.metadata || {};

  // Split the collected application fee into the processing-fee estimate and
  // the account-fee recovery it carried. Older intents have no metadata: the
  // whole fee is the estimate.
  const total = Math.max(0, Math.trunc(Number(collected)));
  const recoveryCents = Math.min(total, Math.max(0, Math.trunc(Number(meta.fq_recovery_cents)) || 0));
  const estimate = meta.fq_fee_estimate_cents != null
    ? Math.min(total - recoveryCents, Math.max(0, Math.trunc(Number(meta.fq_fee_estimate_cents)) || 0))
    : total - recoveryCents;

  const actual = charge?.balance_transaction?.fee;
  const stripeFeeCents = Number.isFinite(Number(actual)) ? Math.trunc(Number(actual)) : null;
  let wanted = 0;
  if (isFinancingSettlementMethod(method) && FINANCING_RATE.currencies.includes(currency)) {
    // Pay over time (owner, 2026-10-09): the application fee ends at
    // max(6.5% + 30¢, Stripe's actual fee) — financingSettlementFee, the one
    // share rule. The session was estimated at the card rate (the method was
    // the client's choice on the hosted page), so this always moves up; a
    // fee Stripe has not reported yet settles at the flat 6.5% + 30¢.
    const { totalCents } = financingSettlementFee({ amountCents: received, currency, actualStripeFeeCents: stripeFeeCents });
    wanted = Math.max(0, totalCents - estimate);
  } else {
    let share = 0;
    try {
      share = platformShareCents({ amountCents: received, currency, method: estimateMethodFor(method) });
    } catch {
      share = 0;
    }
    wanted = stripeFeeCents == null
      ? 0
      : trueUpCents({ estimatedFeeCents: estimate, platformShareCents: share, actualStripeFeeCents: stripeFeeCents });
  }

  let fee = estimate;
  const transferId =
    typeof charge?.transfer === "string" ? charge.transfer : charge?.transfer?.id;
  if (wanted > 0 && transferId) {
    try {
      await client.transfers.createReversal(
        transferId,
        {
          amount: wanted,
          description: trueUpDescription(method),
          metadata: { paymentIntentId: intent.id, reason: "fee_trueup", method: method || "" },
        },
        // One reversal per intent, ever. Both webhook endpoints and the
        // return leg can settle the same session; the key makes the
        // repeats return the first reversal instead of pulling the
        // difference twice.
        { idempotencyKey: `fq-fee-trueup-${intent.id}` },
      );
      fee += wanted;
    } catch (err) {
      console.error(
        "[stripe] fee true-up failed; recording the collected fee only:",
        intent.id,
        err?.message,
      );
    }
  } else if (wanted > 0) {
    console.error("[stripe] fee true-up impossible — no transfer on the charge:", intent.id, wanted);
  }

  // The account-fee recovery this charge carried, marked recovered in the
  // ledger on this intent id (idempotent there). Best-effort: a ledger write
  // failing must not stop the payment being recorded; the cron's next pass
  // still sees the row outstanding and the next charge carries it again —
  // over-recovery is prevented by the intent id stamp.
  let accountFee = { appliedCents: 0, period: null };
  if (recoveryCents > 0 && meta.companyId) {
    try {
      accountFee = await applyRecovery(
        { companyId: meta.companyId, currency, cents: recoveryCents, paymentIntentId: intent.id },
        deps.db ? { db: deps.db } : {},
      );
      if (accountFee.alreadyApplied) accountFee.appliedCents = recoveryCents;
    } catch (err) {
      console.error("[connect-fees] recovery apply failed:", intent.id, err?.message);
      accountFee = { appliedCents: recoveryCents, period: null };
    }
  }

  fee = Math.min(fee, received);
  const accountFeeRecoveredCents = recoveryCents > 0 ? Math.min(recoveryCents, received - fee) : 0;
  return {
    processingFeeCents: fee,
    netCents: received - fee - accountFeeRecoveredCents,
    feeRateLabel: method || null,
    estimatedFeeCents: estimate,
    stripeFeeCents,
    accountFeeRecoveredCents: accountFeeRecoveredCents || null,
    accountFeePeriod: accountFeeRecoveredCents ? accountFee.period || null : null,
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
