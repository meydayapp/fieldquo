// lib/stripe/affirm.js
//
// Affirm (pay-over-time) on invoice pay links — PURE. Which connected
// accounts can have it, whether Stripe has granted it, what the settings
// card should say, and when a Checkout Session may name it. No Stripe
// client, no database, so the settings page, the webhook and
// scripts/check-processing-fee.mjs can import it freely. The companion to
// lib/stripe/bankDebit.js, and the same shape on purpose.
//
// ── Why this is a CAPABILITY and not "a Stripe dashboard step" ──────────
//
// Every pay link is a destination charge created on FieldQuo's platform
// account with the contractor's Express account as `on_behalf_of` (see
// lib/stripe.js, createInvoiceCheckoutSession). An Express account has no
// payment-method settings page of its own — the owner went looking for the
// "activate Affirm" switch the settings card told him about and there is no
// such switch. What decides whether Affirm can appear on that account's
// charges is the `affirm_payments` capability on the connected account,
// which the PLATFORM requests (Stripe grants it from the Connect
// payment-method defaults, which are on by default) — exactly the mechanism
// bankDebit.js uses for acss_debit_payments / us_bank_account_ach_payments.
// So the request happens here, on the status poll, and the card prints
// Stripe's answer instead of sending the contractor to find a page that does
// not exist.
//
// ── Why a status and not a boolean ────────────────────────────────────────
//
// stripeBankDebitEnabled is a boolean because the bank button either renders
// or it does not, and nothing on the settings page promises it. The Affirm
// toggle IS a promise — "offer pay-over-time" — and before this file a
// contractor could switch it on and every pay link would quietly show card
// only: Stripe refused the session that named Affirm and lib/stripe.js fell
// back with a console.warn nobody reads. The card has to say which of these
// it is: granted, under Stripe's review, turned off by Stripe, or simply not
// a thing for this country. Four sentences need four states.
//
// ── Since Klarna (2026-10-09): a named view of lib/stripe/financingMethods.js
//
// The gate logic — country, capability status, amount range, "offered" —
// lives ONCE in financingMethods.js, keyed by provider, so Klarna reads the
// same rules rather than a copy of this file that would rot (AGENTS.md
// failure class #4). Every export below keeps its name and its behaviour —
// scripts/check-processing-fee.mjs executes each one — and delegates.

import {
  FINANCING_PROVIDERS,
  FINANCING_STATUSES,
  financingServesCountry,
  financingStatusFor,
  financingAmountEligible,
  financingOffered,
  summariseFinancingCapability,
} from "@/lib/stripe/financingMethods";

const AFFIRM = FINANCING_PROVIDERS.affirm;

export const AFFIRM_CAPABILITY = AFFIRM.capability;

// Stripe: Affirm is available to merchants in the US (USD) and Canada (CAD),
// and the settlement merchant on every pay link is the connected account.
export const AFFIRM_BY_COUNTRY = AFFIRM.byCountry;

// Stripe's published Affirm transaction bounds, in cents (the same in CAD
// and USD). Outside them Affirm cannot take the payment.
export const AFFIRM_MIN_CENTS = AFFIRM.options.cad[0].minCents; // $50
export const AFFIRM_MAX_CENTS = AFFIRM.options.cad[0].maxCents; // $30,000

// The four values Company.stripeAffirmStatus can hold. null is the fifth
// state — never requested — and stays null on purpose: the poll requests
// the capability only once the contractor has switched financing on.
export const AFFIRM_STATUSES = FINANCING_STATUSES;

/** Whether Affirm exists at all for a connected account in this country. */
export function affirmServesCountry(country) {
  return financingServesCountry("affirm", country);
}

/**
 * Whether the platform should request `affirm_payments` on this account:
 * the account is in a country Affirm serves AND the company has opted in.
 * Other countries are left alone — Stripe rejects the request — and the
 * settings card says so instead.
 */
export function affirmCapabilityWanted({ account, company } = {}) {
  return Boolean(company?.offerFinancing) && affirmServesCountry(account?.country);
}

/**
 * Company.stripeAffirmStatus from a retrieved Stripe account — see
 * financingStatusFor: "unavailable" | "active" | "pending" | "inactive" |
 * null. Pure and total — a null account is null, never a throw.
 */
export function affirmStatusFor(account) {
  return financingStatusFor("affirm", account);
}

/** Whether an amount qualifies for Affirm: USD or CAD, within Stripe's bounds. */
export function affirmAmountEligible({ amountCents, currency } = {}) {
  return financingAmountEligible("affirm", { amountCents, currency });
}

/**
 * The ONE rule for offering Affirm: the contractor opted in, Stripe has
 * ACTIVATED the capability on their account (our column, from Stripe's
 * answer), and the amount qualifies. "pending" and "inactive" are no.
 */
export function affirmOffered({ company, amountCents, currency } = {}) {
  return financingOffered("affirm", { company, amountCents, currency });
}

/**
 * What a retrieved Capability object (stripe.accounts.retrieveCapability)
 * says is standing between the account and an active Affirm: the fields
 * Stripe still needs, in words, and its own reason for holding it. Total: a
 * null capability is empty, never a throw.
 */
export function summariseAffirmCapability(capability) {
  const { requirements, pendingVerification, disabledReason } = summariseFinancingCapability(capability);
  return { requirements, pendingVerification, disabledReason };
}
