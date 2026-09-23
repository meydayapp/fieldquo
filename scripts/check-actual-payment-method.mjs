import assert from "node:assert/strict";
import { actualPaymentMethod, readActualPaymentMethod } from "../lib/stripe/actualPaymentMethod.js";

let assertions = 0;
function equal(value, expected) { assert.equal(value, expected); assertions++; }
for (const method of ["card", "affirm", "klarna", "afterpay_clearpay", "acss_debit", "us_bank_account", "future_provider"]) {
  equal(actualPaymentMethod({
    payment_method_types: ["card", "affirm"],
    latest_charge: { payment_method_details: { type: method } },
    payment_method: { type: "not_the_charge" },
  }), method);
  equal(actualPaymentMethod({ payment_method: { type: method } }), method);
}
for (const intent of [null, {}, "pi_test", { payment_method_types: ["card"] },
  { payment_method_types: ["card", "affirm"] }, { latest_charge: "ch_test", payment_method: "pm_test" }]) {
  equal(actualPaymentMethod(intent), null);
}
let reads = 0;
const client = { paymentIntents: { retrieve: async (id, params) => {
  equal(id, "pi_test");
  assert.deepEqual(params.expand, ["latest_charge", "payment_method"]); assertions++;
  reads++;
  return { payment_method: { type: "klarna" } };
} } };
equal(await readActualPaymentMethod("pi_test", client), "klarna");
equal(reads, 1);
equal(await readActualPaymentMethod({ latest_charge: { payment_method_details: { type: "card" } } }, client), "card");
equal(reads, 1);
equal(await readActualPaymentMethod(null, client), null);
equal(await readActualPaymentMethod({ id: "pi_test", latest_charge: "ch_test", payment_method: { type: "card" } }, {
  paymentIntents: { retrieve: async () => ({ latest_charge: { payment_method_details: { type: "future_provider" } } }) },
}), "future_provider");
const originalError = console.error;
const errors = [];
try {
  console.error = (...args) => errors.push(args);
  equal(await readActualPaymentMethod("pi_test", { paymentIntents: { retrieve: async () => {
    throw Object.assign(new Error("sensitive Stripe payload must not be logged"), { code: "api_connection_error" });
  } } }), null);
} finally { console.error = originalError; }
equal(errors.length, 1);
equal(JSON.stringify(errors).includes("sensitive Stripe payload"), false);
console.log(`${assertions} actual-payment-method assertions passed.`);
