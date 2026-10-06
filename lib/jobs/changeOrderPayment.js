// lib/jobs/changeOrderPayment.js
//
// "Pay $X now" on the change-order page (app/co/[token]), after the client
// has approved and signed. The owner, 2026-10-05: "…pending until their
// client approves, [then] the option to pay."
//
// ── Which invoice the money goes on — the rule, and why ────────────────────
//
// docs/CALLBACKS-AND-CHANGE-ORDERS.md sets the billing rule the staff button
// (POST /api/jobs/[id]/change-orders/bill) follows: approved, unbilled change
// orders go onto the job's invoice ONLY while it is a draft; a sent one is
// refused, because amending a sent invoice is PATCH /api/invoices/[id]'s
// versioning rule and a second copy of it on the money path is failure
// class #4.
//
// Neither of those can serve a client pressing Pay on their phone:
//
//   · the job's DRAFT invoice is the contractor's unfinished document — the
//     whole contract, not yet issued. Issuing it because the client tapped a
//     button on a change order would be money moved by surprise, and it is
//     not payable until issued (the portal pay route refuses drafts);
//   · a SENT invoice is the one the doc already refuses to amend.
//
// So a change order paid on approval gets its OWN invoice: one line (the
// same builder the job's invoice uses), tax at the signed quote's rate — the
// rate the client just signed against on the addendum — issued at once so the
// shared portal pay page will take it. The change order is linked to it
// (ChangeOrder.invoiceId), which is exactly "billed" by the bill route's own
// definition, so the staff button can never put the same change on the job's
// invoice as well.
//
// ── Once ───────────────────────────────────────────────────────────────────
//
// The change order's row is locked, re-read, and the invoice is created only
// while invoiceId is still null; the link is written with that same predicate
// and the transaction rolls back if it did not move exactly one row. A
// double tap, two tabs, a retried request: one invoice, and the second call
// is handed the first one's id.
//
// ── The payment itself is not here ─────────────────────────────────────────
//
// This bills; it does not charge. The client is sent to the invoice's portal
// page and pays through POST /api/portal/[token]/pay like every other
// invoice, so whatever that path does — the processing fee, bank debit, a
// client card surcharge — applies here without a second copy of it.
//
// `db` is passed in (never imported) so scripts/check-sub-change-orders.mjs
// runs it against an in-memory database.

import { Prisma } from "@prisma/client";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { changeOrderInvoiceDraft } from "@/lib/quotes/importOptions";

/**
 * "Change order" / "Approved by {name} on {date}" in the invoice's language —
 * for changeOrderInvoiceLine. Shared with the staff bill route so both
 * documents word a change order the same way (AGENTS.md #6: the line follows
 * the document's language, not the viewer's).
 */
export function changeOrderBillWording(language = "en") {
  const labels = documentLabels(language || "en");
  const { date } = documentFormatters(language || "en");
  return {
    changeOrder: labels.changeOrder,
    approvedBy: (name, when) => labels.changeOrderApprovedBy.replace("{name}", name).replace("{date}", when),
    date: (at) => date(at),
  };
}

const CO_SELECT = {
  id: true,
  jobId: true,
  seq: true,
  createdAt: true,
  description: true,
  priceDelta: true,
  status: true,
  invoiceId: true,
  decidedAt: true,
  decidedBy: { select: { name: true } },
  signature: true,
  job: {
    select: {
      id: true,
      companyId: true,
      clientId: true,
      clientPoNumber: true,
      quote: {
        select: {
          id: true,
          language: true,
          taxEnabled: true,
          taxResolution: true,
          subtotal: true,
          acceptedSubtotal: true,
          tax: true,
          acceptedTax: true,
          discount: true,
          total: true,
          acceptedTotal: true,
        },
      },
    },
  },
};

/**
 * Bill one approved change order onto its own issued invoice, once.
 *
 * @returns {{ ok: true, invoiceId: string, created: boolean } |
 *           { ok: false, reason: string }}
 */
export async function billChangeOrderForPayment(db, { changeOrderId, now = new Date() } = {}) {
  if (!changeOrderId) return { ok: false, reason: "not_found" };
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ChangeOrder" WHERE id = ${changeOrderId} FOR UPDATE`;
    const co = await tx.changeOrder.findUnique({ where: { id: changeOrderId }, select: CO_SELECT });
    if (!co || !co.job) return { ok: false, reason: "not_found" };
    // Already billed — by an earlier tap, or by the staff button. Hand back
    // what exists; never a second invoice.
    if (co.invoiceId) return { ok: true, invoiceId: co.invoiceId, created: false };

    const quote = co.job.quote;
    const language = quote?.language || "en";
    const all = await tx.changeOrder.findMany({
      where: { jobId: co.jobId },
      select: { id: true, seq: true, createdAt: true },
    });
    const draft = changeOrderInvoiceDraft({ changeOrder: co, all, quote, wording: changeOrderBillWording(language) });
    if (!draft.ok) return { ok: false, reason: draft.reason };

    // The plain sequence, never the quote's mirrored number: that one belongs
    // to the job's own invoice (lib/invoices/invoiceNumber.js), which may not
    // exist yet and must not find its number taken.
    const invoiceNumber = await allocateInvoiceNumber(tx, { companyId: co.job.companyId, preferQuoteNumber: false });
    const invoice = await tx.invoice.create({
      data: {
        companyId: co.job.companyId,
        invoiceNumber,
        // Issued: the client asked to pay it, and the portal pays only an
        // issued invoice. It is the document they are about to pay.
        status: "sent",
        sentAt: now,
        clientId: co.job.clientId,
        // NOT jobId / quoteId. lib/invoices/jobLink.js resolveJobInvoice
        // answers "the job's invoice" off those two columns, and the staff
        // bill route writes onto whatever it answers — a one-change invoice
        // must never become that. The job is reached through the change
        // order instead (resolveInvoiceJob's third rule).
        lineItems: draft.lineItems,
        subtotal: draft.subtotal,
        discount: 0,
        tax: draft.tax,
        total: draft.total,
        amountDue: draft.total,
        taxEnabled: draft.taxEnabled,
        // What the quote's tax line said, carried — the same reason the job's
        // own invoice copies it (lib/invoices/createInvoiceFromQuote.js).
        taxResolution: quote?.taxResolution ?? Prisma.DbNull,
        language,
        clientPoNumber: co.job.clientPoNumber || null,
      },
      select: { id: true, invoiceNumber: true, total: true },
    });

    const moved = await tx.changeOrder.updateMany({
      where: { id: co.id, invoiceId: null, status: "approved" },
      data: { invoiceId: invoice.id },
    });
    // The lock above makes this unreachable in Postgres; if it ever is
    // reached, roll the invoice back rather than leave one nothing links to.
    if (moved.count !== 1) throw new Error("change order moved while billing");
    return { ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total: Number(invoice.total), created: true };
  });
}
