// lib/stripe/disputeRecovery.js
//
// Who pays for a chargeback on a contractor's invoice — and how the money is
// actually moved so that it is the contractor, not FieldQuo.
//
// ── The problem ───────────────────────────────────────────────────────────
//
// Every homeowner payment is a destination charge created on the PLATFORM
// account (lib/stripe.js). When the cardholder disputes it, Stripe debits the
// platform's balance for the disputed amount AND the dispute fee — US$15 /
// C$15 per dispute (stripe.com/pricing, "Disputes") — and the contractor,
// who already received the transfer, notices nothing. Stripe's own guidance
// for destination charges is to "attempt to recover funds from the connected
// account by reversing the transfer", which is what this file does, in two
// reversals so the two amounts stay separately reconcilable on the Payment
// row ("$X held, $15 fee"):
//
//   1. dispute_hold  — the disputed amount, reversed out of the contractor's
//                      balance for as long as the dispute is open;
//   2. dispute_fee   — the $15, reversed out of the same transfer.
//
// ── What the API allows, and the one thing it does not ──────────────────
//
// A transfer can be reversed partially, and more than once, up to its own
// amount. It cannot be reversed for MORE than was transferred. The transfer
// on a $2,260 charge was $2,191.90 (gross minus the processing fee), so a
// full-amount dispute plus the fee ($2,275) exceeds it by the processing fee
// plus $15. The alternative Stripe offers — an "account debit", a transfer
// from the connected account to the platform — is only available when both
// sit in the same region, which a US contractor on a Canadian platform does
// not. So the recovery is capped at what the transfer can still give back;
// the hold is taken first, the fee from whatever remains, and any shortfall
// is logged as such rather than silently absorbed. In practice a dispute is
// usually smaller than the transfer, and the shortfall is at most the fee.
//
// ── When the contractor wins ──────────────────────────────────────────────
//
// Stripe releases the disputed amount back to the platform; this file
// transfers the held amount back to the contractor. The dispute fee is not
// returned by Stripe and stays with the contractor — the invoice says so in
// as many words. Both legs are idempotent on the dispute id: Stripe may
// deliver charge.dispute.closed twice, and a second transfer would pay the
// contractor twice.
//
// Every write to the Payment row happens AFTER Stripe confirms the movement,
// for the same reason feeRefundedAt is written only after a refund succeeds:
// the row states that money moved, not that somebody asked it to.

import { stripe } from "@/lib/stripe";
import { DISPUTE_FEE_CENTS } from "@/lib/stripe/processingFee";

export { DISPUTE_FEE_CENTS };

/**
 * PURE — how much of a dispute (and its fee) a transfer can still give back.
 * Executed in scripts/check-processing-fee.mjs at the cap boundary.
 */
export function disputeRecoveryPlan({ disputedCents, transferCents, alreadyReversedCents = 0 }) {
  const disputed = Math.max(0, Math.trunc(Number(disputedCents)) || 0);
  const remaining = Math.max(
    0,
    (Math.trunc(Number(transferCents)) || 0) - (Math.trunc(Number(alreadyReversedCents)) || 0),
  );
  const hold = Math.min(disputed, remaining);
  const fee = Math.min(DISPUTE_FEE_CENTS, remaining - hold);
  return {
    holdCents: hold,
    feeCents: fee,
    shortfallCents: disputed + DISPUTE_FEE_CENTS - hold - fee,
  };
}

async function chargeWithTransfer(client, dispute) {
  const chargeId = typeof dispute?.charge === "string" ? dispute.charge : dispute?.charge?.id;
  if (!chargeId) return null;
  const charge = await client.charges.retrieve(chargeId, { expand: ["transfer"] });
  const transfer = charge?.transfer && typeof charge.transfer === "object" ? charge.transfer : null;
  return { charge, transfer };
}

/**
 * charge.dispute.created — pull the disputed amount and the fee back out of
 * the contractor's balance.
 *
 * @param payment  the Payment row (id, disputeHeldCents, disputeFeeCents)
 * @param dispute  Stripe's Dispute object
 * @returns {{ recovered: boolean, reason?, holdCents?, feeCents?, shortfallCents? }}
 */
export async function recoverDispute({ payment, dispute }, deps = {}) {
  const client = deps.stripe || stripe;
  const prisma = deps.db;
  if (!payment?.id || !dispute?.id) return { recovered: false, reason: "missing_reference" };
  // Already done — a redelivered created event, or updated arriving first.
  if (payment.disputeHeldCents != null) return { recovered: false, reason: "already_recovered" };

  const found = await chargeWithTransfer(client, dispute);
  if (!found?.transfer?.id) return { recovered: false, reason: "no_transfer" };
  const { transfer } = found;

  const plan = disputeRecoveryPlan({
    disputedCents: dispute.amount,
    transferCents: transfer.amount,
    alreadyReversedCents: transfer.amount_reversed,
  });

  const reverse = async (amount, reason) => {
    if (amount <= 0) return 0;
    const r = await client.transfers.createReversal(
      transfer.id,
      {
        amount,
        description: reason === "dispute_fee" ? "Dispute fee" : "Disputed payment, held",
        metadata: { disputeId: dispute.id, paymentId: payment.id, reason },
      },
      { idempotencyKey: `fq-${reason}-${dispute.id}` },
    );
    return Number(r?.amount) || amount;
  };

  const holdCents = await reverse(plan.holdCents, "dispute_hold");
  const feeCents = await reverse(plan.feeCents, "dispute_fee");
  if (plan.shortfallCents > 0) {
    console.error(
      "[stripe] dispute recovery short by",
      plan.shortfallCents,
      "cents — transfer",
      transfer.id,
      "could not give back the full disputed amount plus fee; recover by hand.",
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { disputeHeldCents: holdCents, disputeFeeCents: feeCents },
  });

  return { recovered: true, holdCents, feeCents, shortfallCents: plan.shortfallCents };
}

/**
 * charge.dispute.closed with status "won" — send the held amount back.
 * The fee stays with the contractor: Stripe does not return it.
 */
export async function returnWonDispute({ payment, dispute }, deps = {}) {
  const client = deps.stripe || stripe;
  const prisma = deps.db;
  if (!payment?.id || !dispute?.id) return { returned: false, reason: "missing_reference" };
  if (dispute.status !== "won") return { returned: false, reason: "not_won" };
  if (payment.disputeReturnedCents != null) return { returned: false, reason: "already_returned" };
  const held = Math.max(0, Math.trunc(Number(payment.disputeHeldCents)) || 0);
  if (held <= 0) return { returned: false, reason: "nothing_held" };

  const found = await chargeWithTransfer(client, dispute);
  const destination = found?.transfer?.destination;
  const destinationId = typeof destination === "string" ? destination : destination?.id;
  if (!destinationId) return { returned: false, reason: "no_destination" };

  const transfer = await client.transfers.create(
    {
      amount: held,
      currency: String(found.charge.currency || dispute.currency || "").toLowerCase(),
      destination: destinationId,
      description: "Disputed payment returned — dispute won",
      metadata: { disputeId: dispute.id, paymentId: payment.id, reason: "dispute_won" },
    },
    { idempotencyKey: `fq-dispute-won-${dispute.id}` },
  );

  await prisma.payment.update({
    where: { id: payment.id },
    data: { disputeReturnedCents: Number(transfer?.amount) || held },
  });

  return { returned: true, returnedCents: Number(transfer?.amount) || held };
}
