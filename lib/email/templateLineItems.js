// lib/email/templateLineItems.js
//
// What the email template editor's "Itemized list" block is given to draw:
// one document's stored lines, grouped the way that document groups them,
// with the language and currency the document is written in.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The block used to read `name` / `unitPrice` / `total` — a line shape no
// stored document has. Quote and invoice lines are
// `{ description, detail?, quantity, unit, rate, amount }` (see
// lib/quotes/builderPayload.js lineItemsFromStored); production held zero
// non-demo lines of the old shape when this was written (2026-09-25, a
// read-only count over every Invoice.lineItems, Quote.lineItems and
// QuoteScopeGroup.lineItems). Only the editor's preview and the test send fed
// it the old shape, so the preview showed a table the real email could not.
//
// Worse, the follow-up cron handed it Quote.lineItems — a column the quote
// builder does not write. A quote's lines live on its scope groups, so a
// "quote not answered" chase carrying this block rendered no table at all for
// every quote built in the builder (all eleven real quotes in production).
//
// ── The one shape, built from the document's own helpers ────────────────────
//
//   { language, currency, groups: [{ label, subtotal, items }], totals }
//
// Quotes group through toGroups (lib/quotes/scopeGroupDisplay.js) — the same
// function the quote email, the PDF and the approval page group with, so the
// email template shows the lines the document shows, minus the same
// duplicated blended-import line. Invoices group through
// groupInvoiceLineItems (lib/invoices/documentGroups.js) — the same bridge
// the invoice document route uses to give a flat invoice its quote's trades
// back. No third grouping rule is written here.
//
// `language` is the DOCUMENT's (Quote.language / Invoice.language), never the
// company's or the reader's: non-negotiable 6 — the covering email's labels
// match the document they describe. `currency` is the company's, because
// language changes formatting and never the money (documentFormatters).
//
// Pure: no I/O. The editor imports the sample below, so nothing here may pull
// a server-only module or a large catalogue into a client bundle.

import { toGroups } from "@/lib/quotes/scopeGroupDisplay";
import { groupInvoiceLineItems } from "@/lib/invoices/documentGroups";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function totalsOf(doc = {}) {
  return {
    subtotal: n(doc.subtotal),
    discount: n(doc.discount),
    tax: n(doc.tax),
    total: n(doc.total),
  };
}

/**
 * A quote's lines for the block.
 *
 * @param quote        the Quote row (language, lineItems, subtotal, discount, tax, total)
 * @param scopeGroups  its QuoteScopeGroup rows with `category { key, label }`,
 *                     ordered by sortOrder. Omitted/empty falls back to the
 *                     quote's flat lineItems — the same fallback the quote
 *                     email makes for a quote with no groups.
 * @param company      for `currency`
 */
export function quoteTemplateLines({ quote, scopeGroups = [], company = {} } = {}) {
  // A labelled group with no visible items is kept: that is the blended
  // subcontractor import whose one line repeats its head, and the head IS the
  // figure — dropping the group would drop the money. Only a group with
  // neither a name nor a line is noise.
  const groups = toGroups({ scopeGroups, lineItems: quote?.lineItems })
    .map((g) => ({ label: g.label || "", subtotal: n(g.subtotal), items: g.items }))
    .filter((g) => g.label || g.items.length > 0);
  return {
    language: quote?.language || "en",
    currency: company?.currency || null,
    groups,
    totals: totalsOf(quote),
  };
}

/**
 * An invoice's lines for the block.
 *
 * @param invoice      the Invoice row (language, lineItems, subtotal, discount, tax, total)
 * @param scopeGroups  the ORIGINATING quote's groups ({ id, label, sortOrder,
 *                     category { key, label } }), or [] for an invoice raised
 *                     by hand — which then draws as one ungrouped list, the
 *                     same document the invoice PDF renders.
 * @param company      for `currency`
 */
export function invoiceTemplateLines({ invoice, scopeGroups = [], company = {} } = {}) {
  const billed = groupInvoiceLineItems(
    invoice?.lineItems,
    (Array.isArray(scopeGroups) ? scopeGroups : []).map((g) => ({
      id: g.id,
      label: g.label || g.category?.label || null,
      categoryKey: g.category?.key || null,
      sortOrder: g.sortOrder,
    })),
  );
  return {
    language: invoice?.language || "en",
    currency: company?.currency || null,
    groups: billed.map((g) => ({
      label: g.label || "",
      subtotal: n(g.subtotal),
      items: g.lineItems,
    })),
    totals: totalsOf(invoice),
  };
}

// ── The sample the editor preview and the test send draw ────────────────────
//
// Stored-shape lines on stored-shape groups, run through quoteTemplateLines
// exactly as a real quote is. A preview fed a different shape from the send is
// a picture of a different email — which is how the old fixture shipped a
// table no real send could produce. The figures add up: 3,750 + 150 = 3,900
// subtotal, less 150, plus 500 tax, is the 4,250 the sample {{quoteTotal}}
// token prints.
export const SAMPLE_SCOPE_GROUPS = Object.freeze([
  {
    label: "Cabinet refinishing",
    subtotal: 3750,
    lineItems: [
      {
        description: "Cabinet doors & drawer fronts — spray refinish",
        detail: "Degrease, scuff-sand, prime and two coats of catalysed lacquer.",
        quantity: 24,
        unit: "each",
        rate: 125,
        amount: 3000,
      },
      { description: "Cabinet boxes — on-site refinish", quantity: 1, unit: "flat", rate: 750, amount: 750 },
    ],
  },
  {
    label: "Hardware",
    subtotal: 150,
    lineItems: [
      { description: "Premium hardware replacement", quantity: 24, unit: "each", rate: 6.25, amount: 150 },
    ],
  },
]);

/** The sample's lines as one flat list — the shape of a quote with no groups. */
export const SAMPLE_LINE_ITEMS = Object.freeze(SAMPLE_SCOPE_GROUPS.flatMap((g) => g.lineItems));

export const SAMPLE_TOTALS = Object.freeze({ subtotal: 3900, discount: 150, tax: 500, total: 4250 });

/**
 * The block's input for a preview or a test send.
 *
 * @param language  the language to label it in — the caller's best stand-in
 *                  for "the document's", since a template has no document
 * @param currency  the company's currency
 */
export function sampleTemplateLines({ language = "en", currency = null } = {}) {
  return quoteTemplateLines({
    quote: { language, ...SAMPLE_TOTALS },
    scopeGroups: SAMPLE_SCOPE_GROUPS,
    company: { currency },
  });
}
