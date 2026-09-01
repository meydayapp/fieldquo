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
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { notifyInvoicePayment } from "@/lib/notifications/invoicePaymentNotice";

/**
 * @param db                 the Prisma client
 * @param invoiceId
 * @param paymentIntentId    Stripe's PaymentIntent id — the idempotency key
 * @param amountCents        what Stripe actually took, in cents
 * @param method             Payment.method; "stripe" for every Stripe route
 * @param deps               injection seam, `{ notify }` only — production
 *   callers pass nothing and get the real notifyInvoicePayment. Exists so
 *   scripts/check-money-flow.mjs can await and assert on the fire-and-forget
 *   notification call below without waiting on real timing, the same reason
 *   settleBookingFee.js and buildCallInsights take their own dependencies.
 * @returns { recorded, alreadyRecorded, isPaid, amountPaid, amountDue } or
 *          { recorded: false, reason } when there is nothing to write against.
 */
export async function recordStripePayment(
  db,
  { invoiceId, paymentIntentId, amountCents, method = "stripe" },
  deps = {},
) {
  const notify = deps.notify || notifyInvoicePayment;
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
  // computeInvoiceState also nets out any refund/dispute already recorded
  // against those same payments, so a new payment arriving after a partial
  // refund can't silently undo the refund's effect on the balance.
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!inv) return { recorded: false, reason: "invoice_missing" };

  const state = computeInvoiceState({
    total: inv.total,
    payments: inv.payments,
    priorStatus: inv.status,
  });

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: state.amountPaid,
      amountDue: state.amountDue,
      amountRefunded: state.amountRefunded,
      status: state.status,
      paidDate: state.isPaid ? new Date() : inv.paidDate,
      stripePaymentIntentId: paymentIntentId,
      paidVia: "stripe",
    },
  });

  // Paid in full → close the chase task the send route raised. Only on isPaid,
  // because a Stripe deposit leaves the rest of the balance to chase.
  if (state.isPaid) await resolveInvoiceChaseTask(invoiceId);

  // A Stripe payment settles with nobody from the company in the loop — unlike
  // a manual payment (cash, e-transfer, cheque), which a staff member is
  // literally looking at while typing it in. Fire-and-forget: the payment has
  // already been recorded above, and a notification problem must not turn a
  // real payment into a retried webhook. Only on a genuinely NEW payment this
  // call inserted — `already` truthy means a replayed delivery, which already
  // sent this notice the first time.
  if (!already) {
    // Forwards the SAME `db` this function was called with — not the module's
    // own default — so a caller testing recordStripePayment against a fake db
    // (scripts/check-money-flow.mjs) is also exercising notifyInvoicePayment
    // against that same fake, not silently falling through to a real database
    // connection no test fixture controls.
    notify(
      { invoiceId, amount: (Number(amountCents) || 0) / 100 },
      { db },
    ).catch((err) => console.error("[invoices] payment notice failed:", err?.message));
  }

  return {
    recorded: !already,
    alreadyRecorded: Boolean(already),
    isPaid: state.isPaid,
    amountPaid: state.amountPaid,
    amountDue: state.amountDue,
  };
}
