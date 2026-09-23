// Server-only selection for normal invoice Checkout.
//
// Payment Method Configuration IDs are platform secrets/configuration, never
// browser input. A missing or malformed ID must stop Checkout before Stripe is
// called; silently using Stripe's default would defeat Company.offerFinancing.

const CONFIGURATION_ENV = Object.freeze({
  enabled: "STRIPE_INVOICE_PMC_FINANCING_ALLOWED",
  disabled: "STRIPE_INVOICE_PMC_FINANCING_OFF",
});

function configurationError(envName, reason) {
  const error = new Error(
    `Invoice Checkout Payment Method Configuration ${envName} is ${reason}. Configure the server environment variable before creating invoice Checkout.`,
  );
  error.code = "INVOICE_PAYMENT_CONFIGURATION_MISSING";
  error.status = 503;
  return error;
}

/**
 * Return the parent Payment Method Configuration for a normal invoice.
 * @param {{ offerFinancing?: boolean }} company
 */
export function invoicePaymentConfigurationFor(company) {
  const envName = company?.offerFinancing
    ? CONFIGURATION_ENV.enabled
    : CONFIGURATION_ENV.disabled;
  const value = process.env[envName]?.trim();
  if (!value) {
    console.error(`[stripe] Missing ${envName} for invoice Checkout`);
    throw configurationError(envName, "missing");
  }
  if (!/^pmc_[A-Za-z0-9]+$/.test(value)) {
    console.error(`[stripe] Invalid ${envName} format for invoice Checkout`);
    throw configurationError(envName, "invalid");
  }
  return value;
}

export { CONFIGURATION_ENV };
