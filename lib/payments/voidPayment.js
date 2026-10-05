// lib/payments/voidPayment.js
//
// Voiding a payment that was RECORDED BY HAND and never happened.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner, 2026-10-05: he could not delete his test jobs and clients. He
// had pressed Record Payment on a test invoice "because it was a test and I
// said I got paid", and from then on DELETE /api/invoices/[id] refused —
// rightly — because an invoice carrying a Payment row is a record of money,
// and told him to refund it. A refund is the wrong tool: no money moved, so
// there is nothing to give back, and a refund row is one more record of money
// that keeps the invoice undeletable.
//
// A void says "this row was a mistake". It is only possible where FieldQuo's
// own records are the whole truth — a cash, cheque, e-transfer (… Zelle,
// Venmo, a card on somebody else's terminal) payment someone TYPED IN. A
// payment the card processor took is a fact outside FieldQuo: the money is in
// the contractor's Stripe balance whatever this database says, so deleting the
// row would make the books lie. Those can only be refunded, and voidRefusal
// says so in words.
//
// ── What a void does ───────────────────────────────────────────────────────
//
// In ONE transaction, under the same per-invoice advisory lock Record Payment
// takes (app/api/payments/route.js), so a void and a payment cannot interleave:
//
//   1. removes the Payment row — and any refund rows recorded BY HAND against
//      it (a refund of money that was never received is the same mistake);
//   2. recomputes the family ledger through refreshFamilyLedger with
//      `reopen`, so an invoice whose only payment was voided goes back to
//      sent (or draft) with its balance due — never "paid" with $0 received;
//   3. writes the audit row: who, when, the amount, the method, the date it
//      was recorded for, its note, and the reason given. An ActivityLog row
//      written INSIDE the transaction rather than through recordActivity,
//      whose contract is "may miss a row under failure" — fine for "opened a
//      page", not for the only remaining trace of a money row. It has no
//      foreign key to the invoice, so it outlives the invoice being deleted.
//
// Why remove the row rather than flag it "voided": Payment rows are summed by
// the ledger, the reports, the accounting export, the statements, the portal,
// commissions and the dashboards. A flag every one of those had to learn to
// skip is a flag one of them would miss, and a voided $500 would count as
// revenue there. Removing the row is one place; the audit row keeps the fact.
//
// Who: owners and admins only (the route checks), with a reason, and never a
// read-only support session — impersonation is refused before this runs.
//
// Pure where it can be (voidRefusal, isVoidableMethod); the writer takes the
// db as a dependency so a check script can execute it against a fake. Nothing
// here imports the database client, so the invoice page imports voidRefusal
// in the browser to decide whether to draw the button.

import { familyMembers, latestInFamily, refreshFamilyLedger } from "@/lib/invoices/family";
import { paymentMethodLabel } from "@/lib/payments/methodLabels";

/**
 * Every PaymentMethod, classified. A method added to the enum must be added
 * here too — scripts/check-void-manual-payment.mjs fails until it is — so
 * nothing becomes voidable by default.
 *
 *   true   recorded by hand; FieldQuo's row is the only record of it
 *   false  moved by FieldQuo's own processor (stripe), or a card payment it
 *          took elsewhere and credits here (visit_credit — a booking fee the
 *          client paid through Stripe Connect)
 */
export const PAYMENT_METHOD_VOIDABLE = Object.freeze({
  cash: true,
  e_transfer: true,
  cheque: true,
  check: true,
  shop: true,
  card_elsewhere: true,
  zelle: true,
  venmo: true,
  cash_app: true,
  ach: true,
  paypal: true,
  stripe: false,
  visit_credit: false,
});

export const isVoidableMethod = (method) => PAYMENT_METHOD_VOIDABLE[method] === true;

export const VOID_REASON_MAX = 300;

/**
 * Did the card processor touch this row? Any one of these is evidence the
 * money moved outside FieldQuo's own records — a method label alone is not
 * trusted, because a row's method is the one thing a person typed.
 */
export function wentThroughProcessor(p) {
  return Boolean(
    p &&
      (p.method === "stripe" ||
        p.stripePaymentIntentId ||
        p.stripeRefundId ||
        p.processingFeeCents != null ||
        p.netCents != null ||
        p.stripeFeeCents != null ||
        p.disputeStatus ||
        Number(p.refundedAmount || 0) > 0),
  );
}

/**
 * PURE — why this payment cannot be voided, or null when it can.
 *
 * @param payment  the Payment row
 * @param rows     every Payment row in the invoice family (for its refunds)
 * @returns {null | { status, code, error }}
 */
export function voidRefusal(payment, rows = []) {
  if (!payment) return { status: 404, code: "not_found", error: "That payment isn't on this invoice." };
  if (payment.kind === "refund") {
    return {
      status: 409,
      code: "is_refund",
      error: "This line is a refund, not a payment. Void the payment it was refunded from; refunds recorded by hand against it go with it.",
    };
  }
  if (payment.method === "visit_credit") {
    return {
      status: 409,
      code: "visit_credit",
      error: "This is a booking fee the client already paid by card, credited onto this invoice. The money really moved, so it can't be voided.",
    };
  }
  if (wentThroughProcessor(payment)) {
    return {
      status: 409,
      code: "card_payment",
      error: "This payment went through the card processor, so the money really moved and it can't be voided. Refund it instead — the money goes back to the client the way it came.",
    };
  }
  if (!isVoidableMethod(payment.method)) {
    return { status: 409, code: "unknown_method", error: `A "${payment.method}" payment can't be voided.` };
  }
  const refunds = (rows || []).filter((r) => r.kind === "refund" && r.refundOfPaymentId === payment.id);
  if (refunds.some(wentThroughProcessor)) {
    return {
      status: 409,
      code: "card_payment",
      error: "Money from this payment was refunded through the card processor, so it can't be voided.",
    };
  }
  return null;
}

/** PURE — the reason, trimmed and capped, or null when there is none. */
export function cleanVoidReason(reason) {
  const why = typeof reason === "string" ? reason.trim() : "";
  return why ? why.slice(0, VOID_REASON_MAX) : null;
}

/**
 * Void one hand-recorded payment. See the header.
 *
 * @param {object} p
 * @param {string} p.companyId
 * @param {string} p.invoiceId   any version of the invoice (from the URL)
 * @param {string} p.paymentId
 * @param {string} p.reason      required
 * @param {object} p.actor       { userId, memberId, name, role }
 * @param {object} deps          { db } — the Prisma client, or a fake
 * @returns {{ ok: true, state, invoiceId, voided } | { ok: false, status, code, error }}
 */
export async function voidManualPayment({ companyId, invoiceId, paymentId, reason, actor = {} }, { db }) {
  const why = cleanVoidReason(reason);
  if (!why) return { ok: false, status: 400, code: "reason_required", error: "Say why this payment is being voided." };
  if (!paymentId || typeof paymentId !== "string") return { ok: false, status: 400, code: "payment_required", error: "paymentId is required." };

  // Tenancy first, and in the WHERE: an invoice id from another company is a
  // 404 exactly like one that does not exist.
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, invoiceNumber: true },
  });
  if (!invoice) return { ok: false, status: 404, code: "not_found", error: "Invoice not found" };

  return db.$transaction(async (tx) => {
    const latest = await latestInFamily(tx, invoice.id, { select: { id: true, invoiceNumber: true } });
    if (!latest) return { ok: false, status: 404, code: "not_found", error: "Invoice not found" };
    // The key Record Payment locks on (the family's latest version), so the
    // two serialise against each other.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${latest.id}))`;

    const familyIds = (await familyMembers(tx, invoice.id)).map((m) => m.id);
    const rows = await tx.payment.findMany({ where: { invoiceId: { in: familyIds } } });
    const payment = rows.find((r) => r.id === paymentId) || null;
    const refusal = voidRefusal(payment, rows);
    if (refusal) return { ok: false, ...refusal };

    const refunds = rows.filter((r) => r.kind === "refund" && r.refundOfPaymentId === payment.id);
    const ids = [payment.id, ...refunds.map((r) => r.id)];
    const removed = await tx.payment.deleteMany({ where: { id: { in: ids }, invoiceId: { in: familyIds } } });
    if (removed.count !== ids.length) throw new Error("void: the payment changed while it was being voided");

    const ledger = await refreshFamilyLedger(tx, invoice.id, { reopen: true });

    const amount = Number(payment.amount);
    const voided = {
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: latest.invoiceNumber || invoice.invoiceNumber || null,
      amount,
      method: payment.method,
      date: payment.date ? new Date(payment.date).toISOString() : null,
      recordedAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
      notes: payment.notes || null,
      refundsVoided: refunds.map((r) => ({ id: r.id, amount: Number(r.amount), reason: r.refundReason || null })),
    };
    await tx.activityLog.create({
      data: {
        companyId,
        actorUserId: actor.userId || null,
        actorMemberId: actor.memberId || null,
        actorName: actor.name || null,
        actorRole: actor.role || null,
        viaImpersonation: false,
        action: "payment.voided",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `Voided a ${paymentMethodLabel(payment.method)} payment of ${amount.toFixed(2)} on invoice ${voided.invoiceNumber || invoice.id} — ${why}`,
        metadata: {
          ...voided,
          reason: why,
          invoiceStatusAfter: ledger?.state?.status ?? null,
          amountDueAfter: ledger?.state?.amountDue ?? null,
          i18n: {
            key: "app.activity.event.paymentVoided",
            params: { method: paymentMethodLabel(payment.method), amount: amount.toFixed(2), invoice: voided.invoiceNumber || "", reason: why },
          },
        },
      },
    });

    return { ok: true, state: ledger?.state || null, invoiceId: ledger?.latest?.id || latest.id, voided };
  });
}
