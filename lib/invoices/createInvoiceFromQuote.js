// lib/invoices/createInvoiceFromQuote.js
//
// Build a DRAFT invoice from an accepted quote. Shared by BOTH paths so they
// can never diverge (AGENTS.md failure class #4):
//   • the automatic path — a client approving a quote from the public link, and
//   • the manual "Convert to invoice" button (the override, for when the office
//     agrees to proceed off a phone call rather than the client link).
//
// Idempotent: one invoice per quote (the primary invoice, parentInvoiceId null).
// A second approval webhook, or a manual click after the auto-path already ran,
// returns the existing invoice instead of creating a duplicate the client would
// dispute.

import { db } from "@/lib/db";

// The invoice number sequence is the server's to own — never client-side.
export function getNextInvoiceNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `INV-${year}-0001`;
  const match = String(lastNumber).match(/(\d+)$/);
  const nextSeq = match ? String(Number(match[1]) + 1).padStart(4, "0") : "0001";
  return `INV-${year}-${nextSeq}`;
}

/**
 * @param {string} quoteId
 * @param {object} [opts]
 * @param {string|null} [opts.createdById] the staff member, when there is one
 *   (the public approval path has no member — pass null).
 * @returns {{ invoice: object|null, created: boolean, reason: string }}
 *   reason ∈ "created" | "exists" | "not_found" | "not_accepted"
 */
export async function ensureInvoiceForQuote(quoteId, { createdById = null } = {}) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      scopeGroups: { orderBy: { sortOrder: "asc" } },
      // Only the extras the client actually ticked — a declined add-on must
      // never reach the invoice.
      addOns: { where: { selected: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) return { invoice: null, created: false, reason: "not_found" };
  if (quote.status !== "accepted")
    return { invoice: null, created: false, reason: "not_accepted" };

  const existing = await db.invoice.findFirst({
    where: { quoteId: quote.id, parentInvoiceId: null },
  });
  if (existing) return { invoice: existing, created: false, reason: "exists" };

  const lastInvoice = await db.invoice.findFirst({
    where: { companyId: quote.companyId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });
  const nextNumber = getNextInvoiceNumber(lastInvoice?.invoiceNumber);

  // Flatten from scope groups (the group label prefixes each item) — NOT from
  // quote.lineItems, which is null for every quote built with the scope-group
  // builder. Plus the ticked add-ons.
  const scopeItems = quote.scopeGroups.flatMap((g) => {
    const items = Array.isArray(g.lineItems) ? g.lineItems : [];
    return items.map((li) => ({
      ...li,
      description: g.label ? `${g.label}: ${li.description}` : li.description,
    }));
  });
  const addOnItems = quote.addOns.map((a) => ({
    description: a.description,
    quantity: 1,
    amount: Number(a.amount),
  }));
  const lineItems = [
    ...(scopeItems.length ? scopeItems : Array.isArray(quote.lineItems) ? quote.lineItems : []),
    ...addOnItems,
  ];

  // acceptedTotal is exactly what the client agreed to (extras included), set
  // when they approved — preferring it makes the invoice match the number on the
  // page they clicked. Fall back to the quote's own total for quotes accepted
  // before this existed or marked accepted by hand.
  const useAccepted = quote.acceptedTotal !== null;

  const invoice = await db.invoice.create({
    data: {
      companyId: quote.companyId,
      invoiceNumber: nextNumber,
      clientId: quote.clientId,
      quoteId: quote.id,
      createdById,
      lineItems,
      subtotal: useAccepted ? quote.acceptedSubtotal : quote.subtotal,
      discount: quote.discount,
      tax: useAccepted ? quote.acceptedTax : quote.tax,
      total: useAccepted ? quote.acceptedTotal : quote.total,
      // Seed the balance owing so it's correct before any payment.
      amountDue: useAccepted ? quote.acceptedTotal : quote.total,
      language: quote.language,
    },
    include: { client: true },
  });
  return { invoice, created: true, reason: "created" };
}
