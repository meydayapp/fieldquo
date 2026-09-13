// lib/payments/paymentMethodOptions.js
//
// The offline ways a company can say it takes money — the values that may
// live in Company.paymentMethods.
//
// ── Why a fixed list rather than free text ──────────────────────────────────
//
// Whatever is stored here is printed, verbatim after a title-case pass, on
// the invoice email (lib/email/invoiceEmail.js), the client portal
// (lib/payments/offlinePaymentNote.js) and the invoice PDF
// (lib/documentSections/PaymentTermsSection.js) — surfaces a stranger reads
// with the contractor's name on them. Those renderers title-case any string
// they are handed, so an arbitrary value would be published as-is. The route
// therefore accepts only these three, which are also the schema default, and
// the settings card offers only these three. Adding a method means adding it
// here, where every reader and the one writer share the list.
//
// Values keep the underscore spelling the schema default uses; the renderers
// turn `e_transfer` into "E Transfer" / "E-Transfer" themselves.

export const PAYMENT_METHOD_OPTIONS = Object.freeze(["cash", "e_transfer", "cheque"]);

/**
 * Keep only known methods, in the canonical order, without duplicates.
 * Returns null when the input is not an array at all, so a caller can tell
 * "sent nothing usable" from "sent an empty list" — the empty list is a real
 * answer (no offline methods, so no Accepted line).
 */
export function sanitisePaymentMethods(input) {
  if (!Array.isArray(input)) return null;
  const wanted = new Set(
    input.filter((m) => typeof m === "string").map((m) => m.trim()),
  );
  return PAYMENT_METHOD_OPTIONS.filter((m) => wanted.has(m));
}
