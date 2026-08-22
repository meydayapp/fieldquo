// lib/payments/methodLabels.js
//
// What a payment method is CALLED, in the one place everything reads it from.
//
// ── The failure this closes ────────────────────────────────────────────────
//
// Three vocabularies existed for one enum:
//
//   PaymentSummarySection  a five-key map — missing `visit_credit` entirely,
//                          so a credited booking fee printed the raw enum
//                          `visit_credit` on the invoice a homeowner keeps.
//   invoices/[id]          `visit_credit` special-cased, everything else
//                          `method.replace("_", " ")` — so a payment recorded
//                          from a dropdown reading "E-Transfer" displayed
//                          underneath as "e transfer".
//   the same page's <select>  "E-Transfer"
//
// One map, covering every value the schema can produce. A new PaymentMethod
// that isn't listed here shows up in check:payment-methods rather than on a
// customer's document.

/** Every value of the PaymentMethod enum in prisma/schema.prisma. */
export const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  e_transfer: "E-Transfer",
  cheque: "Cheque",
  shop: "Shop Pay",
  stripe: "Card",
  // A booking/visit fee the client already paid, credited onto this invoice.
  // Worth naming precisely on the document: the homeowner paid it, and a line
  // saying so is the difference between "why is this here" and "that's mine".
  visit_credit: "Visit fee credit",
};

/**
 * The label, or a tidied fallback for a value added to the enum but not here.
 *
 * Falling back to the de-underscored raw value rather than "Other" keeps a
 * gap legible instead of hiding it — but the guard is what stops it reaching a
 * document at all.
 */
export function paymentMethodLabel(method) {
  if (!method) return "";
  return PAYMENT_METHOD_LABELS[method] || String(method).replace(/_/g, " ");
}
