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

import { humaniseDisabledReason, humaniseRequirement } from "@/lib/stripe/connectAccount";

export const AFFIRM_CAPABILITY = "affirm_payments";

// Stripe: Affirm is available to merchants in the US (USD) and Canada (CAD),
// and the settlement merchant on every pay link is the connected account.
export const AFFIRM_BY_COUNTRY = Object.freeze({
  US: Object.freeze({ currency: "usd" }),
  CA: Object.freeze({ currency: "cad" }),
});

// Stripe's published Affirm transaction bounds, in cents. Outside them a
// session naming Affirm is rejected outright, so the link is card-only.
export const AFFIRM_MIN_CENTS = 5_000; // $50
export const AFFIRM_MAX_CENTS = 3_000_000; // $30,000

// The four values Company.stripeAffirmStatus can hold. null is the fifth
// state — never requested — and stays null on purpose: the poll requests
// the capability only once the contractor has switched financing on.
export const AFFIRM_STATUSES = Object.freeze(["active", "pending", "inactive", "unavailable"]);

/** Whether Affirm exists at all for a connected account in this country. */
export function affirmServesCountry(country) {
  return Boolean(AFFIRM_BY_COUNTRY[String(country || "").toUpperCase()]);
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
 * Company.stripeAffirmStatus from a retrieved Stripe account:
 *   "unavailable"  the account's country is not one Affirm serves;
 *   "active" | "pending" | "inactive"  Stripe's own status for the capability
 *                  (a capability object's "disabled" reads as inactive);
 *   null           not requested yet (or an account we know nothing about).
 * Pure and total — a null account is null, never a throw.
 */
export function affirmStatusFor(account) {
  if (!account) return null;
  if (account.country && !affirmServesCountry(account.country)) return "unavailable";
  const raw = account.capabilities?.[AFFIRM_CAPABILITY];
  if (raw === "active" || raw === "pending" || raw === "inactive") return raw;
  if (raw === "disabled") return "inactive";
  return null;
}

/**
 * Whether an amount qualifies for Affirm: USD or CAD, within Stripe's
 * bounds. The currency rule is on the CHARGE currency, which is the
 * company's billing currency; a Canadian account billing in USD gets a
 * card-only link from Stripe's side, and lib/stripe.js records that refusal
 * rather than hiding it.
 */
export function affirmAmountEligible({ amountCents, currency } = {}) {
  const cents = Math.trunc(Number(amountCents));
  if (!Number.isFinite(cents)) return false;
  const cur = String(currency || "").toLowerCase();
  const served = Object.values(AFFIRM_BY_COUNTRY).some((e) => e.currency === cur);
  return served && cents >= AFFIRM_MIN_CENTS && cents <= AFFIRM_MAX_CENTS;
}

/**
 * The ONE rule for naming Affirm on a Checkout Session: the contractor opted
 * in, Stripe has ACTIVATED the capability on their account (our column, from
 * Stripe's answer), and the amount qualifies. "pending" and "inactive" are
 * no — a session naming a method the account cannot take is rejected whole.
 */
export function affirmOffered({ company, amountCents, currency } = {}) {
  return (
    Boolean(company?.offerFinancing) &&
    company?.stripeAffirmStatus === "active" &&
    affirmAmountEligible({ amountCents, currency })
  );
}

/**
 * What a retrieved Capability object (stripe.accounts.retrieveCapability)
 * says is standing between the account and an active Affirm: the fields
 * Stripe still needs, in words, and its own reason for holding it. Same
 * wording tables as the account-level requirements on the settings page,
 * so a contractor reads one vocabulary. Total: a null capability is empty,
 * never a throw.
 */
export function summariseAffirmCapability(capability) {
  const req = capability?.requirements || {};
  const outstanding = [...new Set([...(req.currently_due || []), ...(req.past_due || [])])];
  return {
    requirements: outstanding.map((key) => ({ key, label: humaniseRequirement(key) })),
    pendingVerification: (req.pending_verification || []).length > 0,
    disabledReason: req.disabled_reason ? humaniseDisabledReason(req.disabled_reason) : null,
  };
}
