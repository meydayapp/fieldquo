// lib/stripe.js
import Stripe from "stripe";
import { lazyClient } from "@/lib/lazyClient";
import { stripeCurrency } from "@/lib/currency";
import { processingFeeCents } from "@/lib/stripe/processingFee";

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
      // Requested explicitly rather than left to the Connect dashboard's
      // defaults: every charge now names the account as `on_behalf_of` (the
      // settlement merchant — their descriptor on the homeowner's statement,
      // settled in their country), and Stripe refuses on_behalf_of for an
      // account without card_payments. transfers is what a destination
      // charge needs to land at all. Accounts created before this shipped
      // are brought up to the same set by ensureChargeCapabilities.
      capabilities: CHARGE_CAPABILITIES,
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

// The two capabilities a destination charge with on_behalf_of needs — see
// stripe.accounts.create above.
export const CHARGE_CAPABILITIES = Object.freeze({
  card_payments: { requested: true },
  transfers: { requested: true },
});

/**
 * Bring an EXISTING Express account up to the capability set new ones are
 * created with. Express accounts opened before on_behalf_of shipped may have
 * been created with whatever the Connect dashboard's defaults were at the
 * time; if card_payments was never requested, the first charge naming that
 * account as settlement merchant fails. Called from the status poll — the
 * one path every connected company hits — so it is repaired without anyone
 * reconnecting. Idempotent: an account that already has both requested (any
 * status — active, pending, or awaiting requirements) is left alone, and
 * "requested" is all that is asked, so this never touches an account's
 * requirements beyond what Stripe itself adds for the capability.
 *
 * @returns {Promise<boolean>} whether an update was sent
 */
export async function ensureChargeCapabilities(account, deps = {}) {
  const client = deps.stripe || stripe;
  const have = account?.capabilities || {};
  const missing = Object.keys(CHARGE_CAPABILITIES).filter((k) => !have[k]);
  if (!account?.id || missing.length === 0) return false;
  await client.accounts.update(account.id, {
    capabilities: Object.fromEntries(missing.map((k) => [k, CHARGE_CAPABILITIES[k]])),
  });
  return true;
}

// ── The money route every homeowner charge shares ──────────────────────────
//
// One function so a fourth charge creator cannot forget a key. Every
// PaymentIntent FieldQuo creates for a CONTRACTOR's client carries:
//
//   transfer_data.destination  the contractor's Express account — the money
//                              lands there, never in FieldQuo's balance;
//   application_fee_amount     the published Stripe processing fee for the
//                              method, from lib/stripe/processingFee.js.
//                              Stripe debits the PLATFORM for its fees on a
//                              destination charge, so this is how the fee is
//                              passed through to the contractor rather than
//                              paid out of FieldQuo's pocket (owner's ruling,
//                              2026-09-12). FieldQuo keeps nothing on top;
//   on_behalf_of               the same account, as settlement merchant: the
//                              contractor's name and statement descriptor on
//                              the homeowner's card statement (white-label is
//                              the product), settlement in the contractor's
//                              own country and currency, and — Stripe's
//                              requirement, not a preference — a US contractor
//                              charging through a Canadian platform at all.
//
// `method` is the ONE payment method the intent will be confirmed with. A
// session that allows two methods cannot know its fee at creation; the only
// such session is the Affirm-eligible pay link, which is priced at the card
// rate here and trued up at settlement — see lib/stripe/paymentIntentFee.js.
export function destinationChargeParams({ company, amountCents, currency, method }) {
  if (!company?.stripeAccountId) {
    throw new Error("This company has no connected Stripe account to pay into");
  }
  return {
    application_fee_amount: processingFeeCents({ amountCents, currency, method }),
    transfer_data: { destination: company.stripeAccountId },
    on_behalf_of: company.stripeAccountId,
  };
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
    // Card rate. The Affirm branch below adds a second method to the same
    // session and deliberately keeps this fee: card payers are charged
    // exactly the card fee, and an Affirm payer's higher fee is trued up at
    // settlement (lib/stripe/paymentIntentFee.js) rather than card payers
    // being charged Affirm's rate for a method they did not use.
    payment_intent_data: destinationChargeParams({
      company,
      amountCents: unit_amount,
      currency,
      method: "card",
    }),
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
      payment_intent_data: destinationChargeParams({
        company,
        amountCents,
        currency: stripeCurrency(company.currency),
        method: "card",
      }),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { bookingId, companyId: company.id },
    },
    { stripeAccount: undefined },
  );
}

// ── Contractor payouts (Worker gets paid by their company) ──────────────────

/**
 * @param worker       the contractor, with their connected account id
 * @param company      the worker's company — its `currency` is the currency
 *                     the transfer is sent in, exactly as the invoice checkout
 *                     and the booking fee above use it. Required, not
 *                     optional: this was a hardcoded "cad", so a US company's
 *                     contractor was paid in Canadian dollars, and a fallback
 *                     here would be the same bug wearing a default. A null `company.currency` resolves through
 *                     stripeCurrency the way every other money path does.
 * @param amountCents  what to send
 */
export async function payoutToContractor({ worker, company, amountCents }) {
  if (!worker.stripeConnectedAccountId) {
    throw new Error("Worker has no connected Stripe account");
  }
  if (!company) {
    throw new Error("A contractor payout needs the company it is paid from");
  }
  return stripe.transfers.create({
    amount: amountCents,
    currency: stripeCurrency(company.currency),
    destination: worker.stripeConnectedAccountId,
    metadata: { workerId: worker.id, ...(company.id ? { companyId: company.id } : {}) },
  });
}
