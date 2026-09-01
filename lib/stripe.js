// lib/stripe.js
import Stripe from "stripe";
import { lazyClient } from "@/lib/lazyClient";
import { stripeCurrency } from "@/lib/currency";

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

// Outstanding balance on an invoice, in cents.
//
// Charging `invoice.total` was wrong: deposits are the norm in this trade, so
// a client who paid 50% up front and then clicked the pay link was asked for
// the full amount a second time. `amountPaid` is maintained by
// app/api/payments (it recomputes from the Payment rows on every insert), so
// total − amountPaid is the real balance whether the deposit came through
// Stripe, cash or an e-transfer someone logged by hand.
export function invoiceBalanceCents(invoice) {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amountPaid || 0);
  return Math.round(Math.max(0, total - paid) * 100);
}

export async function createInvoiceCheckoutSession({
  invoice,
  company,
  successUrl,
  cancelUrl,
  // Lets a caller charge a specific figure — a deposit request, say — instead
  // of the whole balance. Omitted means "whatever is still owed".
  //
  // Capped at the real balance below: this is what
  // lib/paymentSchedule/run.js drives with a variable, server-computed
  // figure (one payment-schedule stage's share of the total) — the first
  // caller to actually pass something other than the full balance or
  // nothing. Before that, no caller ever exercised a figure a person hadn't
  // typed into Settings first, so an over-large amountCents had never been
  // reachable. It is now: a stage recomputed against a job whose dates moved
  // twice, or a stage fired a second time by a retried cron, could otherwise
  // ask Stripe to collect more than the invoice is actually owed.
  amountCents,
}) {
  const balance = invoiceBalanceCents(invoice);
  const unit_amount =
    amountCents == null ? balance : Math.max(0, Math.min(amountCents, balance));

  if (unit_amount <= 0) {
    // Stripe rejects a zero-amount session with an opaque error. Fail here
    // with something a person can act on.
    const err = new Error("This invoice is already paid in full.");
    err.status = 400;
    throw err;
  }

  const paid = Number(invoice.amountPaid || 0);
  const label =
    paid > 0
      ? `Invoice ${invoice.invoiceNumber} — balance`
      : `Invoice ${invoice.invoiceNumber}`;

  const currency = stripeCurrency(company.currency);
  const baseParams = {
    mode: "payment",
    // Pinned to card so financing stays strictly opt-in: an omitted list lets
    // Checkout surface whatever the connected account enabled in its Stripe
    // dashboard, which could show Affirm even when offerFinancing is false. The
    // Affirm branch below overrides this with ["card","affirm"] when eligible.
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          // The company's billing currency, not a hardcoded CAD. A US
          // contractor charging a US homeowner must see USD at the card form.
          currency,
          product_data: { name: label },
          unit_amount,
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
  };

  // charge created on platform, transferred to company — NOT a direct charge
  const opts = { stripeAccount: undefined };

  // ── Pay-over-time financing (Affirm) ─────────────────────────────────────
  //
  // Offered on top of card ONLY when the company opted in AND the invoice
  // qualifies: Affirm settles in USD/CAD and only for a bounded amount
  // (~$50–$30,000). Outside that, Stripe rejects the whole session, so we gate
  // on it here. And because Affirm has to be ACTIVATED on the connected account
  // (a Stripe dashboard step we can't verify from code), a session that names it
  // can still fail — so we try with Affirm and fall back to a card-only session
  // rather than hand the homeowner a broken pay link.
  const AFFIRM_MIN = 5_000; // $50 in cents
  const AFFIRM_MAX = 3_000_000; // $30,000 in cents
  const affirmEligible =
    company.offerFinancing &&
    ["usd", "cad"].includes(currency) &&
    unit_amount >= AFFIRM_MIN &&
    unit_amount <= AFFIRM_MAX;

  if (affirmEligible) {
    try {
      return await stripe.checkout.sessions.create(
        { ...baseParams, payment_method_types: ["card", "affirm"] },
        opts,
      );
    } catch (err) {
      console.warn(
        "[stripe] Affirm unavailable for this checkout, falling back to card:",
        err.message,
      );
    }
  }

  return stripe.checkout.sessions.create(baseParams, opts);
}

// A checkout session for a booking VISIT FEE (paid on-site / estimate visit).
// Same Connect destination-charge shape as the invoice one: the money lands in
// the company's connected account, never FieldQuo's. The booking is held as
// pending_payment until Stripe reports this session completed (see the webhook,
// keyed on metadata.bookingId).
export async function createBookingFeeCheckoutSession({
  bookingId,
  company,
  label,
  amountCents,
  successUrl,
  cancelUrl,
}) {
  if (!(amountCents > 0)) {
    const err = new Error("This booking has no fee to charge.");
    err.status = 400;
    throw err;
  }
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      // Card only — a booking fee is a small, immediate charge; financing makes
      // no sense here.
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency(company.currency),
            product_data: { name: label || "Visit fee" },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: company.stripeAccountId },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { bookingId, companyId: company.id },
    },
    { stripeAccount: undefined },
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
