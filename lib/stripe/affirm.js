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

// Stripe's published Affirm transaction bounds, in cents. Outside them
// Stripe does not show Affirm (other methods are unaffected). Re-read against
// docs.stripe.com/payments/affirm on 2026-10-09: CAD is Pay in 4 at
// CAD 50–500 and monthly instalments at CAD 100–30,000, so $50 and
// $30,000 are the CAD floor and ceiling. (USD now starts at $35 with "Pay
// in 30"; $50 is kept as the one floor — conservative, so the page never
// offers what Stripe would not show.)
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
  const code = typeof req.disabled_reason === "string" && req.disabled_reason ? req.disabled_reason : null;
  return {
    requirements: outstanding.map((key) => ({ key, label: humaniseRequirement(key) })),
    pendingVerification: (req.pending_verification || []).length > 0,
    // The code travels too, so the settings page can say it in the owner's
    // language (app.setPayments.affirmReason.<affirmReasonSlug>) with this
    // English sentence as the fallback.
    disabledReasonCode: code,
    disabledReason: code ? affirmReasonText(code) : null,
    // Whether the next step is a message to Stripe support — the page then
    // offers one, ready to copy, with the account id in it.
    contactStripe: code ? affirmReasonContactsStripe(code) : false,
  };
}

// ── Why Stripe has not activated Affirm, in words, with what to do ────────
//
// 2026-10-09: TrueFinish's settings card read "Affirm: not enabled by Stripe
// on your account" and then the raw line "Rejected unsupported business" —
// humaniseDisabledReason's tidied fallback for `rejected.unsupported_
// business`, a key the ACCOUNT table never had, because it is a CAPABILITY
// reason. The owner could not tell that it meant "Stripe declined Affirm for
// your kind of business", or that there was anything to do about it.
//
// So the Affirm card has its own table: every value Stripe documents for a
// Capability's requirements.disabled_reason, plus the account-level ones a
// capability inherits when the whole account is held (every rejected.*,
// requirements.*, platform_paused and listed). Each sentence says what it
// means for the CLIENT — they can't choose AFFIRM; it never says "no
// financing", because invoice checkout uses Stripe's dynamic payment methods
// and other methods (Klarna, cards, wallets) still show without Affirm — and
// then the next step. Stripe's own docs are the source: Affirm lists
// "home improvement services, including contractors and special trade
// contractors" among the businesses it prohibits or subjects to additional
// requirements, and says to contact Stripe support to appeal a capability
// restriction — so that is what the unsupported_business sentence says,
// without promising the appeal works (the answer is Stripe's and Affirm's).
//
// English here is the fallback and the source for the nine locales in
// app/i18n/appMessages.js (app.setPayments.affirmReason.*). An unknown code
// falls back to the account table, then to a tidied key — never hidden.
export const AFFIRM_REASON_TEXT = Object.freeze({
  // ── Capability reasons (Stripe's Capability object) ──
  "rejected.unsupported_business":
    "Stripe declined Affirm for your type of business, so clients can't choose Affirm. Affirm restricts home-improvement contractors and special trades. If the industry Stripe has on file for you is wrong, correct it under Manage in Stripe; then ask Stripe support to re-review the Affirm capability. Stripe and Affirm decide.",
  "rejected.other":
    "Stripe declined Affirm on your account and didn't give a specific reason, so clients can't choose Affirm. Ask Stripe support why, and whether it can be re-reviewed.",
  "rejected.inactivity":
    "Stripe declined Affirm because the account has been inactive, so clients can't choose Affirm. Ask Stripe support to re-review the Affirm capability.",
  "requirements.fields_needed":
    "Stripe needs more information before it can turn Affirm on, so clients can't choose Affirm yet. Open Manage in Stripe and complete what it asks for.",
  "pending.onboarding":
    "Stripe is waiting for your account setup to finish before it turns Affirm on. Finish setting up your Stripe account; clients can't choose Affirm until then.",
  "pending.review":
    "Stripe is reviewing your account for Affirm. There is nothing to do yet; clients can't choose Affirm until Stripe approves it.",
  "paused.inactivity":
    "Stripe paused Affirm because the account has been inactive, so clients can't choose Affirm. Ask Stripe support to turn it back on.",
  platform_disabled:
    "FieldQuo has turned Affirm off for your account, so clients can't choose Affirm. Contact FieldQuo support.",
  platform_paused:
    "FieldQuo has paused your Stripe account, so clients can't choose Affirm. Contact FieldQuo support.",
  other:
    "Stripe has held Affirm on your account without saying why, so clients can't choose Affirm. Ask Stripe support what is needed.",
  // ── Account reasons a capability can carry when the account is held ──
  "requirements.past_due":
    "Stripe is waiting on information that is now overdue, so Affirm is off and clients can't choose Affirm. Open Manage in Stripe and complete what it asks for.",
  "requirements.pending_verification":
    "Stripe is still checking what you sent. There is nothing to do; clients can't choose Affirm until it finishes.",
  "action_required.requested_capabilities":
    "Stripe needs you to confirm the payment methods requested for your account. Open Manage in Stripe and complete what it asks for; clients can't choose Affirm until then.",
  under_review:
    "Stripe is reviewing your account, so Affirm is off and clients can't choose Affirm. Stripe will contact you if it needs anything.",
  listed:
    "Stripe is reviewing a possible sanctions-list match on your account, so Affirm is off. Watch for Stripe's email, or ask Stripe support.",
  "rejected.listed":
    "Stripe closed the account after a sanctions-list match, so no online payments, including Affirm, are possible. Contact Stripe support.",
  "rejected.fraud":
    "Stripe closed the account for suspected fraud, so no online payments, including Affirm, are possible. Contact Stripe support.",
  "rejected.terms_of_service":
    "Stripe closed the account for a terms of service violation, so no online payments, including Affirm, are possible. Contact Stripe support.",
  "rejected.incomplete_verification":
    "Stripe closed the account because verification wasn't completed in time, so no online payments, including Affirm, are possible. Contact Stripe support.",
  "rejected.platform_fraud":
    "The account was closed for suspected fraud, so no online payments, including Affirm, are possible. Contact FieldQuo support.",
  "rejected.platform_terms_of_service":
    "The account was closed for a terms of service violation, so no online payments, including Affirm, are possible. Contact FieldQuo support.",
  "rejected.platform_other":
    "The account was closed, so no online payments, including Affirm, are possible. Contact FieldQuo support.",
});

// The codes whose next step is a message to Stripe support (not a form in
// Manage in Stripe, not FieldQuo, not "wait").
const CONTACT_STRIPE = new Set([
  "rejected.unsupported_business",
  "rejected.other",
  "rejected.inactivity",
  "paused.inactivity",
  "other",
  "listed",
  "rejected.listed",
  "rejected.fraud",
  "rejected.terms_of_service",
  "rejected.incomplete_verification",
]);

/** The i18n key segment for a code: "rejected.unsupported_business" → "rejected_unsupported_business". */
export function affirmReasonSlug(code) {
  return String(code || "").replace(/[^A-Za-z0-9]+/g, "_");
}

/** The English sentence for a code; never the raw key. */
export function affirmReasonText(code) {
  if (!code) return null;
  return AFFIRM_REASON_TEXT[code] || humaniseDisabledReason(code);
}

/** Whether the next step for this code is writing to Stripe support. */
export function affirmReasonContactsStripe(code) {
  return CONTACT_STRIPE.has(code);
}

/**
 * The message to paste into Stripe support, with the account id in it.
 * English on purpose: it is written TO Stripe, whose support reads it, not
 * to the owner (the page around it is in the owner's language). Without an
 * id (a member who may not see it — lib/stripe/connectAccount.js) it says
 * where the id is rather than inventing a placeholder that gets sent.
 */
export function affirmSupportMessage({ accountId = null, code = null, businessName = "" } = {}) {
  const who = businessName ? `${businessName} ` : "";
  const acct = accountId ? `(Stripe account ${accountId})` : "(my Stripe account ID is in my dashboard settings)";
  const reason = code ? ` The capability shows disabled_reason "${code}".` : "";
  const trade =
    code === "rejected.unsupported_business"
      ? " We are a contractor whose clients are homeowners in our own country. Please confirm the industry (MCC) on our account and tell us what additional information Affirm needs for a restricted category."
      : "";
  return (
    `Hello — ${who}${acct} would like Affirm (the affirm_payments capability) re-reviewed. ` +
    `It is requested on our connected account through our platform, but it is not active.${reason}${trade} ` +
    `Could you tell us why, and what we need to provide for it to be activated? Thank you.`
  );
}
