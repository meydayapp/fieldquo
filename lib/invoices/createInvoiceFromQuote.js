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
//
// ── Why a transaction + row lock, and not a @unique on Invoice.quoteId ─────
//
// The obvious DB-level fix — `Invoice.quoteId String? @unique`, caught the
// same way Payment.stripePaymentIntentId's P2002 already is — was tried and
// rejected: it is actively wrong, not just risky over old data. Editing a
// SENT invoice creates a new VERSION row that deliberately carries the SAME
// quoteId as the original (app/api/invoices/[id]/route.js, the amend insert:
// `quoteId: existing.quoteId`) — a flat unique constraint would reject the
// very next time anyone amends an invoice raised from a quote, which is
// ordinary, frequent behaviour, not a bug to guard against. A composite
// `@@unique([quoteId, parentInvoiceId])` doesn't help either — Postgres
// treats every NULL in a unique index as distinct, so two ROOT invoices
// (parentInvoiceId: null) racing for the same quote would sail straight
// through it. What's actually needed is a unique index on quoteId scoped to
// `WHERE parentInvoiceId IS NULL` — a partial index Prisma's schema.prisma
// has no syntax for, and this repo has no migration files to hand-write raw
// SQL into (`prisma db push` reconciles the database to match schema.prisma;
// an index it doesn't know about is drift the next push could silently drop).
//
// `SELECT ... FOR UPDATE` inside a transaction gets the same guarantee this
// specific race needs without any of that: whichever of two concurrent
// accepts gets there first holds the lock on the Quote row until it commits,
// so the second can't even run its own "does an invoice already exist" check
// until the first is already done.

import { db } from "@/lib/db";
import { allocateInvoiceNumber } from "@/lib/invoices/invoiceNumber";

// The invoice number sequence is the server's to own — never client-side.
// Moved to lib/invoices/invoiceNumber.js, which also decides when an invoice
// borrows its quote's number. Re-exported so existing importers are unchanged.
export {
  getNextInvoiceNumber,
  invoiceNumberFromQuote,
} from "@/lib/invoices/invoiceNumber";

/**
 * @param {string} quoteId
 * @param {object} [opts]
 * @param {string|null} [opts.createdById] the staff member, when there is one
 *   (the public approval path has no member — pass null).
 * @returns {{ invoice: object|null, created: boolean, reason: string }}
 *   reason ∈ "created" | "exists" | "not_found" | "not_accepted"
 */
export async function ensureInvoiceForQuote(quoteId, { createdById = null, db: deps } = {}) {
  const prisma = deps || db;

  return prisma.$transaction(async (tx) => {
    // Serialises every concurrent call for THIS quote — see the file header
    // for why this replaces a @unique constraint rather than sitting beside
    // a check-then-create the way the old version did.
    await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${quoteId} FOR UPDATE`;

    const quote = await tx.quote.findUnique({
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

    const existing = await tx.invoice.findFirst({
      where: { quoteId: quote.id, parentInvoiceId: null },
    });
    if (existing) return { invoice: existing, created: false, reason: "exists" };

    // Q-2026-0008 bills as INV-2026-0008. One quote, one invoice, one number to
    // match them by — see lib/invoices/invoiceNumber.js.
    const nextNumber = await allocateInvoiceNumber(tx, {
      companyId: quote.companyId,
      quoteNumber: quote.quoteNumber,
    });

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

    const invoice = await tx.invoice.create({
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
        // Carried from the quote, not re-derived. The invoice must make the same
        // statement the client already read: a quote raised with tax switched
        // off becomes an invoice with tax switched off, and a zero on either is
        // zero for the same stated reason (lib/tax/documentTax.js).
        taxEnabled: quote.taxEnabled,
        total: useAccepted ? quote.acceptedTotal : quote.total,
        // Seed the balance owing so it's correct before any payment.
        amountDue: useAccepted ? quote.acceptedTotal : quote.total,
        // Photos come across with the job. A COPY, like lineItems above: the
        // quote can be edited afterwards, and an invoice showing pictures that
        // no longer match what was billed is worse than showing none. Already
        // sanitised on the way into the quote, so it is safe to carry as-is.
        clientPhotos: quote.clientPhotos ?? undefined,
        language: quote.language,
      },
      include: { client: true },
    });
    return { invoice, created: true, reason: "created" };
  });
}
