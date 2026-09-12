// lib/stripe/feeRateKey.js
//
// Payment.feeRateLabel holds Stripe's payment-method key verbatim ("card",
// "acss_debit", "affirm"). The screens translate it through app.feeRate.*;
// anything else Stripe might one day report collapses to "other" so an
// unknown method renders as "payment processing", never as a raw key.
const KNOWN = new Set(["card", "acss_debit", "us_bank_account", "affirm"]);

export function feeRateKey(label) {
  return KNOWN.has(label) ? label : "other";
}
