// lib/invoices/recordStripeDispute.js
//
// charge.dispute.created / charge.dispute.updated / charge.dispute.closed —
// a chargeback. Distinct from a refund: Stripe holds the disputed amount
// pending the card network's decision, so nothing about
// Invoice.amountPaid/amountDue changes while it's open — only the STATUS
// does, so a contractor sees "disputed" instead of a false "paid". On
// closure it either clears (won — the money was never actually taken back)
// or, on "lost", the underlying charge is never refunded by Stripe at all:
// the money is simply gone. computeInvoiceState folds a lost dispute into
// the invoice's refunded total for exactly that reason — see its header.
//
// ── Idempotency ──────────────────────────────────────────────────────────
//
// Writing Payment.disputeStatus to whatever Stripe's dispute.status says
// right now is itself idempotent: a replayed identical event writes the
// identical string, and computeInvoiceState is a pure function of the
// payments it's handed, so re-deriving the same inputs always produces the
// same invoice state.

import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";

/**
 * @param db       the Prisma client (or an interactive transaction client)
 * @param dispute  a Stripe Dispute object — event.data.object for both
 *                 charge.dispute.created/updated/closed
 */
export async function recordStripeDispute(db, dispute) {
  const paymentIntentId =
    typeof dispute?.payment_intent === "string"
      ? dispute.payment_intent
      : dispute?.payment_intent?.id || null;
  if (!paymentIntentId) return { recorded: false, reason: "no_payment_intent" };

  const payment = await db.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      refundedAmount: true,
      disputeStatus: true,
      disputedAt: true,
    },
  });
  if (!payment) return { recorded: false, reason: "no_matching_payment" };

  const status = dispute.status || "needs_response";
  const now = new Date();

  await db.payment.update({
    where: { id: payment.id },
    data: {
      disputeStatus: status,
      // Stamped once — a status TRANSITION (needs_response → won) must not
      // move the date the dispute first opened.
      disputedAt: payment.disputedAt ? undefined : now,
    },
  });

  const invoice = await db.invoice.findUnique({
    where: { id: payment.invoiceId },
    include: { payments: true },
  });
  // See the matching note in recordStripeRefund.js: settleChargeEvent needs an
  // invoice to point a notification at, and this is the one lookup that has it.
  if (!invoice) return { recorded: true, invoiceUpdated: false, invoiceId: payment.invoiceId };

  const state = computeInvoiceState({
    total: invoice.total,
    payments: invoice.payments.map((p) =>
      p.id === payment.id ? { ...p, disputeStatus: status } : p,
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
      disputedAt: invoice.disputedAt || now,
      // A LOST dispute reads as refunded from here on (see computeInvoiceState);
      // stamp refundedAt the same way recordStripeRefund.js does so the two
      // paths agree on what "refunded" means on this invoice.
      refundedAt: status === "lost" ? invoice.refundedAt || now : invoice.refundedAt,
    },
  });

  return {
    recorded: true,
    invoiceUpdated: true,
    invoiceId: invoice.id,
    status: state.status,
    disputeStatus: status,
  };
}
