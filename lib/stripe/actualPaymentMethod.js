// Allowed payment methods describe choices, not what a customer selected.
// Keep Stripe's raw method name: new providers must not require a deploy.
export function actualPaymentMethod(intent) {
  const charge = intent?.latest_charge;
  if (charge && typeof charge === "object" &&
      typeof charge.payment_method_details?.type === "string" && charge.payment_method_details.type) {
    return charge.payment_method_details.type;
  }
  const method = intent?.payment_method;
  return method && typeof method === "object" && typeof method.type === "string"
    ? method.type || null
    : null;
}

/** Read-only. A missing Charge or a transient lookup failure is not a card payment. */
export async function readActualPaymentMethod(intentRef, client) {
  const known = actualPaymentMethod(intentRef);
  if (known && typeof intentRef?.latest_charge !== "string") return known;
  const id = typeof intentRef === "string" ? intentRef : intentRef?.id;
  if (!id) return known;
  try {
    const intent = await client.paymentIntents.retrieve(id, {
      expand: ["latest_charge", "payment_method"],
    });
    return actualPaymentMethod(intent);
  } catch (err) {
    // Do not log Stripe payloads, customer data, or request headers.
    console.error("[stripe] Actual payment method lookup pending", {
      paymentIntentId: id,
      code: err?.code || "lookup_failed",
    });
    return null;
  }
}
