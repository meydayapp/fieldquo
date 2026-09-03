// lib/invoices/statusPresentation.js
//
// How each InvoiceStatus is shown: a tone and a label key, for all seven of
// them.
//
// ── Why this exists at all ─────────────────────────────────────────────────
//
// The invoices list and the invoice detail page each carried their own
// STATUS_STYLES object with four keys — draft, sent, paid, overdue — copied
// from the quotes list, where four is CORRECT because QuoteStatus has exactly
// four values. InvoiceStatus has seven. It grew refunded, partially_refunded
// and disputed when refunds and chargebacks landed, and neither copy grew with
// it.
//
// The failure was silent and it was on the money screen. `STATUS_STYLES[status]`
// returns undefined for a status nobody added, and an undefined dropped into a
// template literal renders the literal word: class="… rounded-full undefined".
// No background, no border, no colour. The list then printed the raw column
// value beside it, so a contractor whose client had just filed a chargeback saw
// the word `partially_refunded` in plain grey text — snake_case, untranslated,
// in a French or Punjabi office as readily as an English one.
//
// So the badge that mattered most was the one that looked like nothing.
//
// ── Why a shared module and not a fix in each page ─────────────────────────
//
// Two copies rotted the same way for the same reason; a third copy would have
// been the fix that rots next. One exhaustive map, and check-invoice-status.mjs
// drives it against the enum in prisma/schema.prisma directly — so the next
// status added to the schema fails the build here rather than shipping as the
// word "undefined" nine months later.
//
// ── No words in this file ─────────────────────────────────────────────────
//
// Same reason lifecycle.js gives, and the same split: this returns a label KEY,
// never a label. English in lib/ is English in every office. The keys are
// written out in full rather than built from the status value, because
// `app.status.${status}` is invisible to check:translations — it cannot see a
// key that only exists at runtime, which is how a missing translation reaches
// a customer.
//
// ── The tones ──────────────────────────────────────────────────────────────
//
// Red is reserved for money the contractor should act on today: overdue (the
// client is late) and disputed (a chargeback is open, the bank is deciding, and
// the window to submit evidence closes). Amber is a settled reversal — the
// money went back out, nothing to chase. Deliberately not red: a refund the
// contractor issued themselves is not an emergency, and colouring it like one
// teaches people to ignore red on the screen where red has to keep working.

// Keyed by every value of `enum InvoiceStatus`. Adding a value to the schema
// without adding it here is what check:invoice-status exists to catch.
export const INVOICE_STATUS_PRESENTATION = {
  draft: { tone: "neutral", labelKey: "app.status.draft" },
  sent: { tone: "info", labelKey: "app.status.sent" },
  paid: { tone: "positive", labelKey: "app.status.paid" },
  overdue: { tone: "urgent", labelKey: "app.status.overdue" },
  refunded: { tone: "reversed", labelKey: "app.status.refunded" },
  partially_refunded: {
    tone: "reversed",
    labelKey: "app.status.partiallyRefunded",
  },
  disputed: { tone: "urgent", labelKey: "app.status.disputed" },
};

// The class strings the four original statuses already shipped with, unchanged,
// plus one new pairing. Kept here so the two pages cannot drift again.
export const INVOICE_TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  positive: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  urgent: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  reversed:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
};

// A status this file has never heard of still has to render as something a
// human can read. It gets the neutral chip and — through labelKey being null —
// the caller's fallback, rather than the word "undefined" in the class list.
// This is the belt to check:invoice-status's braces: the check fails the build,
// this keeps a live page honest if one ever slips past.
const UNKNOWN = { tone: "neutral", labelKey: null };

export function invoiceStatusPresentation(status) {
  return INVOICE_STATUS_PRESENTATION[status] || UNKNOWN;
}

// The one call a page makes. Returns the chip classes; never returns undefined,
// never returns a partially-built string.
export function invoiceStatusClasses(status) {
  const { tone } = invoiceStatusPresentation(status);
  return INVOICE_TONE_CLASSES[tone] || INVOICE_TONE_CLASSES.neutral;
}
