// lib/notifications/chargeNotice.js
//
// The chargeback nobody was told about.
//
// This is the event the whole feed was built for. Before it, a homeowner
// disputing a charge went through app/api/stripe/webhook → settleChargeEvent →
// recordStripeDispute, moved the invoice's status to "disputed", and told
// NOBODY: no email, no SMS, no recordActivity, no recordError. Stripe holds the
// money and starts an evidence clock; the contractor finds out whenever they
// next happen to open the Stripe dashboard. Audit §2.1 calls it "the highest-
// value silent event found", and it is the one event that on its own justifies
// the build.
//
// ══ Why it lives here rather than in the webhook route ═════════════════════
//
// settleChargeEvent is the ONE place that already answers "was this charge
// ours?", for both webhook endpoints, and its header explains why that question
// must only be answered once. Notifying from the route instead would mean
// re-deriving that answer, which is the copy that rots.
//
// ══ Refunds and chargebacks are one type, with a `kind` param ══════════════
//
// They are the same fact to the person being told — money that was theirs is
// not any more — and they land on the same screen. What differs is whether it
// is disputable, which is a sentence in the feed row, not a separate event
// type. Keeping them apart would double the catalog for a distinction the
// reader makes by reading.
import { db as defaultDb } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";

/**
 * @param {object} p
 * @param {string} p.invoiceId  from recordStripeRefund/recordStripeDispute
 * @param {"refund"|"dispute"} p.kind
 * @param {object} [deps]       { db, notify } — the check script's seam
 *
 * Never throws. The caller is inside a Stripe webhook whose retry would replay
 * a charge event; a notification failure must not cost that.
 */
export async function notifyChargeEvent({ invoiceId, kind }, deps = {}) {
  const prisma = deps.db || defaultDb;
  const notify = deps.notify || notifyEvent;

  try {
    if (!invoiceId) return { notified: false, reason: "no_invoice" };

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        amountRefunded: true,
        client: { select: { name: true } },
      },
    });
    if (!invoice) return { notified: false, reason: "invoice_missing" };

    return await notify(
      {
        companyId: invoice.companyId,
        type: "payment.disputed",
        entityId: invoice.id,
        // `kind` is a token the browser translates, never a sentence — the row
        // is composed from the reader's own catalogue. See the comment on
        // NotificationEvent in prisma/schema.prisma.
        params: {
          invoiceNumber: invoice.invoiceNumber || "",
          clientName: invoice.client?.name || "",
          kind,
        },
        // Structural, not in the string. A member without showPricing never
        // receives this type at all (the catalog flags it `money`), and even if
        // the grid changes later, lib/notifications/render.js re-asks before
        // handing the figure over.
        amount: invoice.amountRefunded ?? null,
        // No actor: Stripe told us. Null is a real answer here, not a gap.
        actorUserId: null,
        actorName: null,
      },
      { db: prisma },
    );
  } catch (err) {
    console.error("[notifications] charge notice failed:", err?.message);
    return { notified: false, reason: "error" };
  }
}
