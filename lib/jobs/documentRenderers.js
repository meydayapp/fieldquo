// lib/jobs/documentRenderers.js
//
// The PDFs lib/jobs/documentAutofile.js files, rendered by the SAME engine,
// sections, template and language rules as Download PDF and the emailed
// attachment — so the document on the job is the document the client has.
//
// ── Why this is its own file ────────────────────────────────────────────────
//
// documentAutofile.js is imported by lib/quotes/quoteLifecycle.js, which every
// acceptance route imports at module top. @react-pdf/renderer is a heavy
// engine and must not load on a stranger's GET of a quote page; keeping the
// renderer here and importing it lazily (documentAutofile's defaultRender)
// keeps that true. It also keeps the check script honest: it executes the
// filing logic with a fake renderer and never needs a PDF engine.
//
// ── Not a fourth copy of the render block ───────────────────────────────────
//
// app/api/quotes/[id]/pdf, app/api/quotes/[id]/send and the public acceptance
// route each carry their own render block already (AGENTS.md failure class
// #4, and a known one). This file does not fix that; it is the block those
// three would share if they were unified, written once here so the fifth
// copy at least is not inline in a lifecycle hook.

import { db as realDb } from "@/lib/db";
import { usableSections } from "@/lib/documents/templateKind";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { loadDocumentCustomFields } from "@/lib/customFields/values";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { familyPayments, refreshFamilyLedger } from "@/lib/invoices/family";

async function engine() {
  const [{ renderDocumentPdfBuffer }, { getDefaultSections }] = await Promise.all([
    import("@/app/admin/lib/pdf/renderDocumentPdf"),
    import("@/app/admin/lib/pdf/defaultSections"),
  ]);
  return { renderDocumentPdfBuffer, getDefaultSections };
}

/**
 * The quote as a PDF.
 *
 * `variant`:
 *   "as_sent" — the unsigned document with the quote's own totals: what the
 *               client was offered. No signature block filled.
 *   "signed"  — the accepted totals (add-ons the client ticked are in them —
 *               acceptedSubtotal/Tax/Total, written by the public route at
 *               the moment of approval) and the signature record, so the
 *               filed contract shows the figure they agreed to and the mark
 *               they made. A by-hand acceptance has no signature record and
 *               renders the blank signature lines, which is the truth.
 *
 * Reloads the full row rather than trusting the caller's select: the PDF
 * sections read whichever columns they read (notes, deposit, terms, the
 * kitchen plan) and a narrower row would silently render a thinner document.
 */
export async function renderQuoteDocumentPdf({ db = realDb, quote: given, variant = "as_sent" }) {
  const quote = await db.quote.findUnique({
    where: { id: given.id },
    include: {
      client: true,
      scopeGroups: { include: { category: true }, orderBy: { sortOrder: "asc" } },
      addOns: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) throw new Error("quote not found");

  const [{ renderDocumentPdfBuffer, getDefaultSections }, company, template] = await Promise.all([
    engine(),
    db.company.findUnique({ where: { id: quote.companyId } }),
    db.documentTemplate.findFirst({ where: { companyId: quote.companyId, type: "quote_pdf", isDefault: true } }),
  ]);
  const sections = usableSections("quote_pdf", template?.sections || getDefaultSections("quote_pdf")).sections;
  const scopeGroups = await attachServiceSettings(db, quote.companyId, quote.scopeGroups);
  const language = resolveClientLanguage({ document: quote, client: quote.client, company });
  const customFields = await loadDocumentCustomFields(db, quote.companyId, "quote", quote.id, { language });

  const signed = variant === "signed";
  const data = {
    ...quote,
    client: quote.client,
    scopeGroups,
    customFields,
    ...(signed
      ? {
          subtotal: quote.acceptedSubtotal ?? quote.subtotal,
          tax: quote.acceptedTax ?? quote.tax,
          total: quote.acceptedTotal ?? quote.total,
          signature: quote.signature || null,
        }
      : { signature: null }),
  };

  const buffer = await renderDocumentPdfBuffer({ sections, language, data, company });
  return buffer?.length ? buffer : null;
}

/**
 * The invoice as a PDF — the block app/api/invoices/[id]/pdf renders, with
 * the family ledger folded in so "payments received" and "balance due" on
 * the filed copy agree with what the portal showed at the send.
 */
export async function renderInvoiceDocumentPdf({ db = realDb, invoice: given }) {
  const invoice = await db.invoice.findUnique({
    where: { id: given.id },
    include: { client: true },
  });
  if (!invoice) throw new Error("invoice not found");

  invoice.payments = await familyPayments(db, invoice.id, { orderBy: { date: "desc" } });
  const ledger = await refreshFamilyLedger(db, invoice.id);
  if (ledger) {
    invoice.amountPaid = ledger.state.amountPaid;
    invoice.amountDue = ledger.state.amountDue;
    invoice.amountRefunded = ledger.state.amountRefunded;
    invoice.status = ledger.state.status;
  }

  const [{ renderDocumentPdfBuffer, getDefaultSections }, company, template] = await Promise.all([
    engine(),
    db.company.findUnique({ where: { id: invoice.companyId } }),
    db.documentTemplate.findFirst({ where: { companyId: invoice.companyId, type: "invoice_pdf", isDefault: true } }),
  ]);
  const sections = usableSections("invoice_pdf", template?.sections || getDefaultSections("invoice_pdf")).sections;
  const language = resolveClientLanguage({ document: invoice, client: invoice.client, company });
  const customFields = await loadDocumentCustomFields(db, invoice.companyId, "invoice", invoice.id, { language });

  const buffer = await renderDocumentPdfBuffer({
    sections,
    language,
    data: {
      ...invoice,
      customFields,
      client: invoice.client,
      // One flat list under one heading — the same shape the download route
      // gives ScopeGroupsSection, for the same reason it gives it.
      scopeGroups:
        Array.isArray(invoice.lineItems) && invoice.lineItems.length
          ? [{ label: "Work completed", lineItems: invoice.lineItems, subtotal: invoice.subtotal }]
          : [],
    },
    company,
  });
  return buffer?.length ? buffer : null;
}
