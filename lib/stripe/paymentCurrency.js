// Money movement must not use the display formatter's CAD fallback.
// These currencies all use two decimal places, matching Invoice/Payment today.
// Adding a currency requires an approved fee policy and a minor-unit audit.
const INVOICE_CURRENCIES = new Set(["cad", "usd", "gbp", "eur", "aud"]);

export function invoicePaymentCurrency(value) {
  const currency = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!INVOICE_CURRENCIES.has(currency)) {
    const error = new Error("Invoice payment currency must be CAD, USD, GBP, EUR or AUD. No default currency is used.");
    error.code = "INVALID_INVOICE_PAYMENT_CURRENCY";
    error.status = 400;
    throw error;
  }
  return currency;
}
