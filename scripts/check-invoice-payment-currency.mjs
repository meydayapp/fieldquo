import assert from "node:assert/strict";
import { invoicePaymentCurrency } from "../lib/stripe/paymentCurrency.js";
import { processingFeeCents } from "../lib/stripe/processingFee.js";

let assertions = 0;
for (const currency of ["CAD", "USD", "GBP", "EUR", "AUD"]) {
  assert.equal(invoicePaymentCurrency(currency), currency.toLowerCase()); assertions++;
  assert.equal(invoicePaymentCurrency(` ${currency.toLowerCase()} `), currency.toLowerCase()); assertions++;
}
for (const currency of [undefined, null, "", " ", "XXX", "JPY", "NZD", {}, 124]) {
  assert.throws(() => invoicePaymentCurrency(currency), { code: "INVALID_INVOICE_PAYMENT_CURRENCY" }); assertions++;
}
// Validating the currency must not invent its commercial processing rate.
for (const currency of ["gbp", "eur", "aud"]) {
  assert.throws(() => processingFeeCents({ currency, method: "card", amountCents: 100_000 }), /No published processing rate/); assertions++;
}
for (const currency of ["cad", "usd"]) {
  assert.equal(processingFeeCents({ currency, method: "card", amountCents: 100_000 }), 3030); assertions++;
}
console.log(`${assertions} invoice-payment-currency assertions passed.`);
