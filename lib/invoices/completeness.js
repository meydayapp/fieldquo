// lib/invoices/completeness.js
//
// What is missing from an invoice, worked out WITHOUT a model and without a
// database — lib/quotes/completeness.js's twin, for the document that bills.
//
// ── Why a second file and not the quote's checks ────────────────────────────
//
// Half of a quote's checks are about persuading: an expiry date, a "what
// happens next", one line inviting haggling. An invoice is a statement of
// what was done and what is owed, and what goes wrong with one is different:
// no due date for the reminders to key off, tax switched on with nothing
// charged (the send route refuses that), a line at $0.00 nobody meant, a
// total that drifted from the quote the client accepted. The vague-line rule
// is the one thing both share, and it is imported rather than copied.
//
// PURE. No clock, no I/O. Give it an invoice-shaped object and it returns
// what is missing — which is why the builder could run it on an unsaved
// draft and the review route runs it on a stored row and gets one answer.

import { countMediaKinds } from "@/lib/media/validate";
import { VAGUE_PATTERNS } from "@/lib/quotes/completeness";

const num = (v) => Number(v ?? 0);

/**
 * @param invoice  { client, dueDate, subtotal, discount, tax, taxEnabled,
 *                   total, clientPhotos, quote? } — a saved row OR a draft.
 *                   `quote` is the source quote when raised from one:
 *                   { total, acceptedTotal, quoteNumber }.
 * @param items    the lines — [{ description, detail?, amount, kind? }]
 * @returns [{ id, severity: "high"|"medium"|"low", title, detail }]
 */
export function invoiceCompletenessChecks(invoice, items = []) {
  const checks = [];
  const add = (id, severity, title, detail) => checks.push({ id, severity, title, detail });
  const lines = (Array.isArray(items) ? items : []).filter((li) => li && typeof li === "object");
  // A text block is prose, not a priced line — never "vague" and never "$0".
  const priced = lines.filter((li) => li.kind !== "text");

  if (!invoice?.client?.email) {
    add(
      "no_client_email",
      "high",
      "Client has no email address",
      "Without one there's nowhere to send the invoice or the payment link, and no record of when they opened it.",
    );
  }

  const described = priced.filter((li) => String(li.description || "").trim());
  if (described.length === 0) {
    add("no_items", "high", "No line items", "There's nothing here to bill. Add the work before sending.");
  }

  const vague = described.filter(
    (li) => VAGUE_PATTERNS.test(String(li.description || "").trim()) || String(li.description || "").trim().length < 12,
  );
  if (vague.length) {
    add(
      "vague_items",
      "medium",
      `${vague.length} line${vague.length > 1 ? "s" : ""} the client won't recognise`,
      `${vague.map((v) => `"${v.description}"`).join(", ")} — a client paying a bill wants to see the work they agreed to, in the words they agreed to it in.`,
    );
  }

  const free = described.filter((li) => num(li.amount) === 0);
  if (free.length) {
    add(
      "zero_lines",
      "medium",
      `${free.length} line${free.length > 1 ? "s" : ""} at $0.00`,
      `${free.slice(0, 3).map((v) => `"${v.description}"`).join(", ")}${free.length > 3 ? ` and ${free.length - 3} more` : ""} — a line the client is not charged for reads as a mistake or a gift. Price it, or say it is included in the description.`,
    );
  }

  if (!invoice?.dueDate) {
    add(
      "no_due_date",
      "medium",
      "No due date",
      "The overdue reminders, the chase task and the \"overdue\" banner all key off the due date. Without one this invoice never becomes late.",
    );
  }

  // Tax switched on with nothing charged is not a settled zero — the send
  // route refuses to post one (lib/tax/documentTax.js). Said here first.
  const base = num(invoice?.subtotal) - num(invoice?.discount);
  if (invoice?.taxEnabled !== false && base > 0 && num(invoice?.tax) === 0) {
    add(
      "tax_unresolved",
      "high",
      "Tax is on and nothing is charged",
      "Either set the rate, or switch tax off for this invoice — the send refuses an invoice that claims tax applies at $0.00.",
    );
  }

  if (num(invoice?.discount) > num(invoice?.subtotal) * 0.2) {
    add(
      "deep_discount",
      "medium",
      "Discount is over 20%",
      "A discount that large on a bill reads as a dispute settled quietly. Say why in the notes so the record explains itself.",
    );
  }

  // Raised from a quote: the figure the client accepted is the figure they
  // expect to see. A different one is not wrong — extras happen — but it
  // needs a sentence, or the first thing they do is call.
  const agreed = invoice?.quote ? num(invoice.quote.acceptedTotal ?? invoice.quote.total) : 0;
  if (invoice?.quote && agreed > 0 && Math.abs(num(invoice.total) - agreed) > 0.5) {
    add(
      "total_differs",
      "medium",
      "The total differs from the accepted quote",
      `The client accepted ${invoice.quote.quoteNumber || "the quote"} at a different figure. If work was added or dropped, say so in the notes so the difference is explained before they ask.`,
    );
  }

  const { visual: siteMediaCount } = countMediaKinds(invoice?.clientPhotos);
  if (siteMediaCount === 0) {
    add(
      "no_photos",
      "low",
      "No photos",
      "A finished-work photo on the invoice shows what was paid for. Optional, but it settles most \"what did I get for this\" calls before they happen.",
    );
  }

  return checks;
}

/** The same weighting the quote review leads with — a count of what is missing, not a probability. */
export function invoiceReadinessScore(checks = []) {
  const weights = { high: 22, medium: 10, low: 4 };
  const lost = (Array.isArray(checks) ? checks : []).reduce((sum, c) => sum + (weights[c?.severity] || 0), 0);
  return Math.max(0, 100 - lost);
}
