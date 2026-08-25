// lib/invoices/recordStripePayment.js
//
// Record ONE Stripe payment against an invoice and recompute the balance from
// every payment that exists.
//
// Lifted out of app/api/stripe/webhook/route.js when service plans gained a
// second way to be paid by Stripe — an off-session PaymentIntent confirmed by
// the cron, with no Checkout Session anywhere in the story. A second copy of
// this logic is the copy that rots (AGENTS.md failure class #4), and the thing
// it would rot into is an invoice showing the wrong balance.
//
// The idempotency story is unchanged and load-bearing, so it is restated here:
// the read-then-create below is a FAST PATH, not the guarantee. Two concurrent
// callers both pass the read and both insert; the real guard is the unique index
// on Payment.stripePaymentIntentId, and the P2002 catch is us losing that race
// gracefully. Don't remove one believing the other covers it.

import { resolveInvoiceChaseTask } from "@/lib/tasks/autoCreate";

/**
 * @param db                 the Prisma client
 * @param invoiceId
 * @param paymentIntentId    Stripe's PaymentIntent id — the idempotency key
 * @param amountCents        what Stripe actually took, in cents
 * @param method             Payment.method; "stripe" for every Stripe route
 * @returns { recorded, alreadyRecorded, isPaid, amountPaid, amountDue } or
 *          { recorded: false, reason } when there is nothing to write against.
 */
export async function recordStripePayment(
  db,
  { invoiceId, paymentIntentId, amountCents, method = "stripe" },
) {
  if (!invoiceId || !paymentIntentId) {
    return { recorded: false, reason: "missing_reference" };
  }

  const already = await db.payment.findFirst({
    where: { invoiceId, stripePaymentIntentId: paymentIntentId },
    select: { id: true },
  });

  if (!already) {
    try {
      await db.payment.create({
        data: {
          invoiceId,
          amount: (Number(amountCents) || 0) / 100,
          method,
          stripePaymentIntentId: paymentIntentId,
        },
      });
    } catch (err) {
      // P2002 = unique violation: the concurrent delivery won. It is recording
      // the same payment and will recompute the same balance, so returning is
      // correct — retrying would only re-run identical work. Anything else is a
      // real failure and must propagate so the caller retries the delivery.
      if (err?.code !== "P2002") throw err;
      return { recorded: false, alreadyRecorded: true };
    }
  }

  // Recompute from ALL payments — never assume this one charge paid in full. A
  // client can pay a deposit through Stripe; the balance is the source of truth.
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!inv) return { recorded: false, reason: "invoice_missing" };

  const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const amountDue = Math.max(0, Number(inv.total) - totalPaid);
  const isPaid = amountDue <= 0.005;

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status: isPaid ? "paid" : inv.status,
      paidDate: isPaid ? new Date() : inv.paidDate,
      stripePaymentIntentId: paymentIntentId,
      paidVia: "stripe",
    },
  });

  // Paid in full → close the chase task the send route raised. Only on isPaid,
  // because a Stripe deposit leaves the rest of the balance to chase.
  if (isPaid) await resolveInvoiceChaseTask(invoiceId);

  return {
    recorded: !already,
    alreadyRecorded: Boolean(already),
    isPaid,
    amountPaid: totalPaid,
    amountDue,
  };
}
