// lib/stripe.js
import Stripe from "stripe";
import { lazyClient } from "@/lib/lazyClient";

// Platform-level Stripe client. Used for BOTH Connect (companies getting paid by their
// clients) and Billing (FieldQuo charging companies) — same API key, different object
// graphs. Never mix a Connect account ID into a Billing call or vice versa.
//
// Lazy — see lib/lazyClient.js. `new Stripe(undefined)` throws, and at module
// scope that fires during `next build` when Next imports every route to
// collect page data, turning a missing runtime secret into a build failure.
export const stripe = lazyClient(
  () =>
    new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-01-27.acacia",
    }),
);

// ── Connect (contractor gets paid by their client) ──────────────────────────

export async function createConnectOnboardingLink({
  companyId,
  stripeAccountId,
  returnUrl,
  refreshUrl,
}) {
  let accountId = stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { companyId },
    });
    accountId = account.id;
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return { accountId, url: link.url };
}

// A fresh, single-use link into a connected account's own Stripe Express
// dashboard — payout schedule, bank details, tax info. Stripe expires these
// quickly and they can't be reused, so always mint one on demand rather than
// storing it.
//
// Only valid for Express accounts (which is what createConnectOnboardingLink
// creates above). Calling it with a Standard account id throws.
export async function createExpressLoginLink(stripeAccountId) {
  const link = await stripe.accounts.createLoginLink(stripeAccountId);
  return link.url;
}

export async function createInvoiceCheckoutSession({
  invoice,
  company,
  successUrl,
  cancelUrl,
}) {
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: { name: `Invoice ${invoice.invoiceNumber}` },
            unit_amount: Math.round(Number(invoice.total) * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 0, // set a platform fee here if/when you charge one
        transfer_data: { destination: company.stripeAccountId },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { invoiceId: invoice.id, companyId: company.id },
    },
    { stripeAccount: undefined }, // charge created on platform, transferred to company — NOT a direct charge
  );
}

// ── Contractor payouts (Worker gets paid by their company) ──────────────────

export async function payoutToContractor({ worker, amountCents }) {
  if (!worker.stripeConnectedAccountId) {
    throw new Error("Worker has no connected Stripe account");
  }
  return stripe.transfers.create({
    amount: amountCents,
    currency: "cad",
    destination: worker.stripeConnectedAccountId,
    metadata: { workerId: worker.id },
  });
}
