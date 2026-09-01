// lib/invoices/recordStripeRefund.js
//
// charge.refunded: money that was collected has (partly or fully) gone back
// out. Neither Stripe webhook handled this before — a refund issued straight
// from the contractor's own Stripe Express dashboard (or any refund not
// raised through FieldQuo's own visit-cancel-refund flow, which already
// tracks its own booking fee separately via Booking.feeRefundedAt) left
// Invoice.status reading "paid" forever, after the money had already left.
//
// ── Idempotency ──────────────────────────────────────────────────────────
//
// The natural key here is different from recordStripePayment.js's. Stripe
// delivers charge.refunded again for EVERY additional partial refund on the
// same charge, not just as a retry — and the Charge object's own
// `amount_refunded` is already the CUMULATIVE total refunded on that charge.
// Writing it as an absolute value (never an increment) is what makes a
// duplicate delivery a genuine no-op instead of double-deducting: replaying
// the identical event writes the identical number twice.
//
// ── Scope ────────────────────────────────────────────────────────────────
//
// Only refunds that land on an Invoice Payment are handled here. A booking
// visit fee has no Payment row at all (settleBookingFee.js records it
// straight onto Booking.feeStripePaymentIntentId/feePaidCents) — those are
// out of scope for this pass; see docs/MONEY-FIXES.md for why. A charge with
// no matching Payment (a subscription invoice, an AI/voice top-up) is simply
// not ours, the same "not one of ours" contract settleCheckoutSession.js
// uses for checkout sessions.

import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";

/**
 * @param db      the Prisma client (or an interactive transaction client)
 * @param charge  a Stripe Charge object — event.data.object for charge.refunded
 */
export async function recordStripeRefund(db, charge) {
  const paymentIntentId =
    typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : charge?.payment_intent?.id || null;
  if (!paymentIntentId) return { recorded: false, reason: "no_payment_intent" };

  const payment = await db.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, invoiceId: true, amount: true, refundedAmount: true, disputeStatus: true },
  });
  if (!payment) return { recorded: false, reason: "no_matching_payment" };

  const refundedAmount = Math.max(0, Number(charge.amount_refunded || 0) / 100);
  const now = new Date();

  await db.payment.update({
    where: { id: payment.id },
    data: { refundedAmount, refundedAt: now },
  });

  const invoice = await db.invoice.findUnique({
    where: { id: payment.invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { recorded: true, invoiceUpdated: false };

  const state = computeInvoiceState({
    total: invoice.total,
    payments: invoice.payments.map((p) =>
      p.id === payment.id ? { ...p, refundedAmount, refundedAt: now } : p,
    ),
    priorStatus: invoice.status,
  });

  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: state.amountPaid,
      amountDue: state.amountDue,
      amountRefunded: state.amountRefunded,
      status: state.status,
      // Stamped once, the same convention Booking.feeRefundedAt already uses
      // ("written only after Stripe confirms the refund... a record that
      // money moved, not that somebody asked for it to"). A replayed delivery
      // that changes nothing about the refunded total leaves this untouched.
      refundedAt: state.amountRefunded > 0 ? invoice.refundedAt || now : invoice.refundedAt,
    },
  });

  return { recorded: true, invoiceUpdated: true, status: state.status, amountRefunded: state.amountRefunded };
}
