// lib/demo/demoPayment.js
//
// "Paid" on a demo invoice, with no card, no Stripe and no money.
//
// ══ Why it records anything at all ═════════════════════════════════════════
//
// The owner: "we want to showcase what the client gets." A prospect playing
// the homeowner presses Pay on a demo invoice they were really emailed; a
// screen that said "demo" and then went nowhere would show them nothing, and
// the rep's own screen would still read "owing". So the payment is written the
// way a card payment is (lib/invoices/recordStripePayment.js — the same
// ledger recompute, chase-task close and owner notice), and both sides of the
// demo move: the portal says "Payment received", /app shows the invoice paid.
//
// ══ What makes it unmistakable ════════════════════════════════════════════
//
// The reference is `demo_pi_…`, never Stripe's `pi_…` — the same convention
// lib/email/demoMail.js uses for message ids — and the Payment's note says no
// card was charged. lib/invoices/refund.js reads the prefix so a rep pressing
// Refund on it is answered without calling Stripe about an intent that never
// existed. Only the portal pay route calls this, and only for a company whose
// row says isDemo, re-read here as well: a real tenant's invoice can never be
// marked paid by a button.
import { db } from "@/lib/db";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";

export const DEMO_PAYMENT_PREFIX = "demo_pi_";
export const DEMO_PAYMENT_NOTE = "Demo payment — no card was charged and no money moved.";

/** True for a reference only this module writes. */
export function isDemoPaymentRef(ref) {
  return typeof ref === "string" && ref.startsWith(DEMO_PAYMENT_PREFIX);
}

/**
 * @param invoice      the family's CURRENT invoice row (as the pay route resolved it)
 * @param amountCents  the figure the pay route derived server-side
 * @param stageId      the payment-schedule stage it is for, or null
 */
export async function recordDemoPayment({ invoice, amountCents, stageId = null }) {
  if (!(await isDemoCompany(invoice?.companyId))) {
    const err = new Error("Not a demo account.");
    err.status = 403;
    throw err;
  }
  // Deterministic per (invoice, stage, what was paid before), so a double
  // press records once — recordStripePayment is idempotent on this key.
  const paidBefore = Math.round(Number(invoice.amountPaid || 0) * 100);
  const ref = `${DEMO_PAYMENT_PREFIX}${invoice.id}_${stageId || "balance"}_${paidBefore}`;
  const result = await recordStripePayment(db, { invoiceId: invoice.id, paymentIntentId: ref, amountCents });
  await db.payment
    .updateMany({ where: { stripePaymentIntentId: ref }, data: { notes: DEMO_PAYMENT_NOTE } })
    .catch((err) => console.error("[demo payment] note not written:", err?.message));
  return { ...result, ref };
}
