// lib/invoices/refund.js
//
// Refunding a client from FieldQuo — the only way a contractor with an
// Express account CAN refund a homeowner. Their Express dashboard cannot
// refund a destination charge the platform created; until this existed the
// help centre said "refund in the Stripe dashboard" and no dashboard the
// contractor could open had the button.
//
// ── What a refund is here ─────────────────────────────────────────────────
//
// Its own Payment row: kind "refund", a NEGATIVE amount, refundOfPaymentId
// on the payment it returns money from, the reason, who did it. The
// invoice balance (lib/invoices/computeInvoiceState.js), the payment
// history and the accounting export all show it as a line. The Record
// Payment form still refuses a negative amount — a refund is not a payment
// typed with a minus sign.
//
// Two methods:
//   stripe — the original was taken through FieldQuo. stripe.refunds.create
//            with reverse_transfer (the money comes back out of the
//            contractor's transfer, not FieldQuo's balance) and
//            refund_application_fee: false — Stripe does not return its
//            processing fee on a refund, so neither does the platform; the
//            contractor bears it, as at Jobber. The row is written only
//            after Stripe confirms (money moved), carrying stripeRefundId,
//            which is how the charge.refunded webhook recognises a refund it
//            did not initiate twice (recordStripeRefund.js).
//   manual — cash, cheque or e-transfer handed back. No Stripe call; the
//            row records that the office says money went back.
//
// Never more than the payment still holds: its amount minus refunds already
// issued from here minus anything refunded in the Stripe dashboard.
//
// Idempotency: the browser mints a requestId when the dialog opens and the
// Stripe call is keyed on it, so a retried submit returns the first refund
// rather than making a second. The row's stripeRefundId is unique for the
// same reason at the database.

import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { familyMembers, familyPayments, latestInFamily } from "@/lib/invoices/family";
import { surchargeRefundCents } from "@/lib/stripe/clientCardSurchargeMath";

export const REFUND_METHODS = Object.freeze(["stripe", "manual"]);

/**
 * PURE — the client's credit-card fee that goes back with a refund of
 * `refundBaseCents` of invoice money from this payment (Payment
 * .clientCardSurchargeCents — Company.clientCardSurcharge). The whole fee on
 * a full refund, a pro-rated share on a partial one, cumulative across
 * refunds so the shares add up to exactly the fee
 * (lib/stripe/clientCardSurchargeMath.js). Zero for a payment that carried
 * no fee — every payment before the setting existed.
 */
export function refundCardFeeCents(payment, refundRows = [], refundBaseCents) {
  const fee = Math.trunc(Number(payment?.clientCardSurchargeCents)) || 0;
  if (fee <= 0) return 0;
  const base = Math.round(Number(payment?.amount || 0) * 100);
  const before = Math.max(0, base - refundableCents(payment, refundRows));
  return surchargeRefundCents({
    paymentBaseCents: base,
    surchargeCents: fee,
    alreadyRefundedBaseCents: before,
    refundBaseCents,
  });
}

/**
 * PURE — how much of a payment can still be refunded, from the rows.
 */
export function refundableCents(payment, refundRows = []) {
  const amount = Math.round(Number(payment?.amount || 0) * 100);
  const dashboard = Math.round(Number(payment?.refundedAmount || 0) * 100);
  const own = refundRows
    .filter((r) => r.kind === "refund" && r.refundOfPaymentId === payment?.id)
    .reduce((s, r) => s + Math.max(0, -Math.round(Number(r.amount || 0) * 100)), 0);
  return Math.max(0, amount - dashboard - own);
}

/**
 * PURE — validate a refund request against the payment. Returns
 * `{ ok: true, amountCents, method }` or `{ ok: false, status, error }`.
 */
export function planRefund({ payment, refundRows, amountCents, method, reason }) {
  if (!payment || payment.kind === "refund") {
    return { ok: false, status: 404, error: "That payment isn't on this invoice." };
  }
  const cents = Math.trunc(Number(amountCents));
  if (!Number.isFinite(cents) || cents <= 0) {
    return { ok: false, status: 400, error: "Enter the amount to refund." };
  }
  const limit = refundableCents(payment, refundRows);
  if (cents > limit) {
    return { ok: false, status: 400, error: "That is more than this payment can still refund.", limitCents: limit };
  }
  const m = method === "manual" ? "manual" : "stripe";
  if (m === "stripe" && !payment.stripePaymentIntentId) {
    return {
      ok: false,
      status: 400,
      error: "This payment wasn't taken through FieldQuo, so it can only be refunded by hand.",
    };
  }
  if (m === "manual" && payment.method === "stripe") {
    return {
      ok: false,
      status: 400,
      error: "A card or bank payment is refunded through Stripe, so the money goes back the way it came.",
    };
  }
  const why = String(reason || "").trim();
  if (!why) return { ok: false, status: 400, error: "Give a reason for the refund." };
  return { ok: true, amountCents: cents, method: m, reason: why.slice(0, 300) };
}

/**
 * Issue the refund and record it.
 *
 * @param deps  `{ db, stripe }` — production callers pass the real client and
 *              db; scripts/check-processing-fee.mjs passes scripted ones.
 * @returns {{ ok: true, row, state } | { ok: false, status, error }}
 */
export async function issueRefund(
  { companyId, invoiceId, paymentId, amountCents, method, reason, requestId, memberUserId },
  deps,
) {
  const { db, stripe } = deps;

  // The payment must sit on THIS invoice's family, and the family on THIS
  // company — a paymentId is guessable.
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, companyId: true },
  });
  if (!invoice) return { ok: false, status: 404, error: "Invoice not found" };
  const members = await familyMembers(db, invoice.id);
  const familyIds = members.map((m) => m.id);
  const payment = await db.payment.findFirst({
    where: { id: paymentId, invoiceId: { in: familyIds } },
  });
  if (!payment) return { ok: false, status: 404, error: "That payment isn't on this invoice." };

  const rows = await db.payment.findMany({ where: { refundOfPaymentId: payment.id } });
  const plan = planRefund({ payment, refundRows: rows, amountCents, method, reason });
  if (!plan.ok) return plan;

  // The client's credit-card fee goes back with the invoice money — the
  // whole fee on a full refund, a pro-rated share on a partial one (card
  // network rules; docs.stripe.com/payments/cards/surcharge, "Refunds").
  // `plan.amountCents` stays the INVOICE money, which is what the balance
  // and the refund row's `amount` count; Stripe returns both.
  const cardFeeBack = plan.method === "stripe" ? refundCardFeeCents(payment, rows, plan.amountCents) : 0;

  let stripeRefundId = null;
  // A demo's "card" payment (lib/demo/demoPayment.js — `demo_pi_…`) never
  // touched Stripe, so neither does its refund: the row is written as a
  // refund of nothing, with a reference that says so. Matched on the prefix
  // only that module writes; inlined rather than imported because this file
  // is also imported by the invoice page in the browser.
  const demoPayment = String(payment.stripePaymentIntentId || "").startsWith("demo_pi_");
  if (plan.method === "stripe" && demoPayment) {
    stripeRefundId = `demo_re_${requestId}`;
  } else if (plan.method === "stripe") {
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount: plan.amountCents + cardFeeBack,
        // Destination charge: the money comes back out of the contractor's
        // transfer, not FieldQuo's balance.
        reverse_transfer: true,
        // Stripe keeps its processing fee on a refund; so does the platform.
        // The contractor bears the fee — the confirm dialog says so.
        refund_application_fee: false,
        metadata: { fq_paymentId: payment.id, fq_invoiceId: invoice.id, companyId, reason: plan.reason },
      },
      { idempotencyKey: `fq-refund-${requestId}` },
    );
    if (refund.status === "failed" || refund.status === "canceled") {
      return { ok: false, status: 502, error: `Stripe refused the refund (${refund.status}).` };
    }
    stripeRefundId = refund.id;
  }

  // The row states that money moved — written after Stripe confirms. A
  // retried request with the same requestId gets the same stripeRefundId
  // back from Stripe and the unique index refuses a second row.
  let row;
  try {
    row = await db.payment.create({
      data: {
        invoiceId: payment.invoiceId,
        amount: -plan.amountCents / 100,
        method: payment.method,
        kind: "refund",
        refundOfPaymentId: payment.id,
        stripeRefundId,
        refundReason: plan.reason,
        refundedById: memberUserId || null,
        notes: plan.reason,
        // Negative like `amount`: the fee that went back to the card.
        ...(cardFeeBack > 0
          ? {
              clientCardSurchargeCents: -cardFeeBack,
              clientCardSurchargeRateBps: payment.clientCardSurchargeRateBps ?? null,
            }
          : {}),
      },
    });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    row = await db.payment.findFirst({ where: { stripeRefundId } });
  }

  // Recompute the family's latest version from every row, refunds included.
  const latest = await latestInFamily(db, invoice.id);
  const state = computeInvoiceState({
    total: latest.total,
    payments: await familyPayments(db, latest.id),
    priorStatus: latest.status,
  });
  await db.invoice.update({
    where: { id: latest.id },
    data: {
      amountPaid: state.amountPaid,
      amountDue: state.amountDue,
      amountRefunded: state.amountRefunded,
      status: state.status,
      refundedAt: latest.refundedAt || new Date(),
    },
  });

  // The commission earned on this money comes back too — but that sync is
  // called by the ROUTE (app/api/invoices/[id]/refund/route.js), not here:
  // this module is also imported by the invoice page in the browser for
  // planRefund, and the sync's imports (the database client) must never be
  // pulled into a client bundle.
  return { ok: true, row, state, stripeRefundId, invoiceId: latest.id };
}
