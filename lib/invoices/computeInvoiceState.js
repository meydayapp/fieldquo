// lib/invoices/computeInvoiceState.js
//
// One invoice's money state, derived fresh from its Payment rows every time
// something about them changes — a new payment, a refund, a dispute
// resolving. Two callers computing "is this invoice paid" independently is
// how one of them drifts (AGENTS.md failure class #4); this is the one place
// lib/invoices/recordStripePayment.js, lib/invoices/recordStripeRefund.js and
// lib/invoices/recordStripeDispute.js are all willing to trust.
//
// A refund or a chargeback does not erase that a payment was once received —
// Payment rows are never deleted or backdated (this codebase's hard rule:
// never mutate history). What changes is how much of that payment survives.
// Each Payment carries its own refundedAmount/disputeStatus; this function
// nets them out to answer "does the contractor's own money say this is
// settled".
//
// ── The "lost" dispute special case ─────────────────────────────────────
//
// Stripe does NOT fire charge.refunded when a dispute is lost — the disputed
// amount is simply deducted from the platform balance and never returned to
// the charge itself (`charge.refunded` stays false, `amount_refunded` stays
// 0 forever). Waiting for an event that will never arrive would leave the
// invoice reading "disputed" long after the money is gone for good. So a
// lost dispute is folded into amountRefunded here, once, the moment
// Payment.disputeStatus reads "lost" — this is the ONLY place that
// conversion happens, so a dashboard refund and a lost dispute can never be
// double-counted against each other.

const PAID_EPSILON = 0.005; // matches lib/invoices/lifecycle.js's PAID_EPSILON

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Stripe dispute states that mean the money is still in limbo — the bank
// hasn't ruled yet. Deliberately excludes "won" (nothing happened to the
// money; read as an ordinary payment) and "lost" (handled above, as a
// refund) — this set exists only to answer "should the invoice say
// disputed right now".
const DISPUTE_OPEN_STATUSES = new Set([
  "warning_needs_response",
  "warning_under_review",
  "needs_response",
  "under_review",
]);

/**
 * @param total        Invoice.total (Decimal | number)
 * @param payments     every Payment row for this invoice, each with
 *                     { amount, refundedAmount, disputeStatus }
 * @param priorStatus  the invoice's CURRENT status — carried through
 *                     unchanged when nothing below has anything to say,
 *                     the same convention recordStripePayment.js always used
 *                     (`inv.status`). This function only ever ADDS
 *                     information; it never invents a downgrade from e.g.
 *                     "sent" to "draft".
 * @returns {{ amountPaid: number, amountDue: number, amountRefunded: number,
 *             status: string, isPaid: boolean }}
 */
export function computeInvoiceState({ total, payments, priorStatus }) {
  const rows = Array.isArray(payments) ? payments : [];

  const grossPaid = rows.reduce((s, p) => s + num(p.amount), 0);

  // A lost dispute's money is gone exactly as thoroughly as a refund's — see
  // the header — so it is added to the refunded total here, once, rather
  // than tracked as a second kind of "money that left".
  const amountRefunded = rows.reduce((s, p) => {
    const refunded = num(p.refundedAmount);
    const lostExtra =
      p.disputeStatus === "lost" ? Math.max(0, num(p.amount) - refunded) : 0;
    return s + refunded + lostExtra;
  }, 0);

  const netPaid = Math.max(0, grossPaid - amountRefunded);
  const amountDue = Math.max(0, num(total) - netPaid);
  const isPaid = amountDue <= PAID_EPSILON && netPaid > PAID_EPSILON;

  const hasOpenDispute = rows.some((p) => DISPUTE_OPEN_STATUSES.has(p.disputeStatus));

  let status = priorStatus;
  if (hasOpenDispute) {
    // Outranks "refunded" and "paid" alike — a client's card issuer is mid-
    // decision, which is a different fact from either of those, and the one
    // most worth surfacing to whoever looks at this invoice next.
    status = "disputed";
  } else if (amountRefunded > PAID_EPSILON) {
    status = netPaid <= PAID_EPSILON ? "refunded" : "partially_refunded";
  } else if (isPaid) {
    status = "paid";
  }
  // Nothing settled and nothing refunded/disputed: status is left exactly as
  // the caller had it (draft/sent/overdue).

  return {
    amountPaid: netPaid,
    amountDue,
    amountRefunded,
    status,
    isPaid,
  };
}
