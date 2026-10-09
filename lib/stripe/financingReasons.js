// lib/stripe/financingReasons.js
//
// Why Stripe has not activated a pay-over-time provider, in plain words, for
// ANY provider — PURE. Built on Affirm's table of every Stripe
// `disabled_reason` code (lib/stripe/affirm.js AFFIRM_REASON_TEXT, and its
// nine-language twin app.setPayments.affirmReason.<slug>), so Klarna's
// capability gets the same plain words, the same next step and the same
// paste-to-Stripe message instead of a tidied raw key.
//
// ── Why one table with the provider's name swapped in ─────────────────────
//
// The 22 sentences are about STRIPE's decision and the owner's next step
// ("Stripe needs more information…", "ask Stripe support to re-review…");
// the provider is only named in them. Writing a second 22 × 9 table for
// Klarna would be the copy that rots (AGENTS.md failure class #4). The ONE
// exception is a sentence that states a fact about the provider itself:
// `rejected.unsupported_business` says "Affirm restricts home-improvement
// contractors" — not true of Klarna, whose own rules exclude business-to-
// business sales and a list of categories (docs.stripe.com/payments/klarna/
// compliance). Such codes get the provider's own sentence (OWN below, and
// app.setPayments.<provider>Reason.<slug> in nine languages).
//
// Brand names are never translated, so "Affirm" appears literally in every
// locale's sentence and the swap is safe there too
// (scripts/check-klarna.mjs asserts it, per locale, per code).

import {
  AFFIRM_REASON_TEXT,
  affirmReasonSlug,
  affirmReasonText,
  affirmReasonContactsStripe,
  affirmSupportMessage,
} from "@/lib/stripe/affirm";
import { humaniseRequirement } from "@/lib/stripe/connectAccount";
import { FINANCING_PROVIDERS } from "@/lib/stripe/financingMethods";

// A provider's own sentence where Affirm's would state something false.
const OWN = Object.freeze({
  klarna: Object.freeze({
    "rejected.unsupported_business":
      "Stripe declined Klarna for your type of business, so clients can't choose Klarna. Klarna doesn't accept business-to-business sales or some business categories. If the industry Stripe has on file for you is wrong, correct it under Manage in Stripe; then ask Stripe support to re-review the Klarna capability. Stripe and Klarna decide.",
  }),
});

function nameOf(provider) {
  return FINANCING_PROVIDERS[provider]?.name || "Affirm";
}

/** Affirm's wording with the provider's name (and capability) in its place. */
export function withProvider(text, provider) {
  if (text == null || provider === "affirm" || !FINANCING_PROVIDERS[provider]) return text;
  return String(text)
    .replace(/affirm_payments/g, FINANCING_PROVIDERS[provider].capability)
    .replace(/\bAffirm\b/g, nameOf(provider));
}

/** The i18n key of a provider's OWN sentence for a code, or null (use Affirm's, renamed). */
export function financingReasonOwnKey(provider, code) {
  return OWN[provider]?.[code] ? `app.setPayments.${provider}Reason.${affirmReasonSlug(code)}` : null;
}

/** The English sentence for a code, for this provider; never the raw key. */
export function financingReasonText(provider, code) {
  if (!code) return null;
  if (OWN[provider]?.[code]) return OWN[provider][code];
  return withProvider(affirmReasonText(code), provider);
}

/**
 * A retrieved Capability object, summarised for the settings card in the
 * same shape summariseAffirmCapability gives Affirm: what Stripe still needs,
 * its reason in words, the code (so the page can say it in the owner's
 * language), and whether the next step is a message to Stripe support.
 * Total: a null capability is empty, never a throw.
 */
export function summariseProviderCapability(provider, capability) {
  const req = capability?.requirements || {};
  const outstanding = [...new Set([...(req.currently_due || []), ...(req.past_due || [])])];
  const code = typeof req.disabled_reason === "string" && req.disabled_reason ? req.disabled_reason : null;
  return {
    requirements: outstanding.map((key) => ({ key, label: humaniseRequirement(key) })),
    pendingVerification: (req.pending_verification || []).length > 0,
    disabledReasonCode: code,
    disabledReason: code ? financingReasonText(provider, code) : null,
    contactStripe: code ? affirmReasonContactsStripe(code) : false,
  };
}

/** The paste-to-Stripe message for this provider (English — it is written to Stripe). */
export function financingSupportMessageFor(provider, { accountId = null, code = null, businessName = "" } = {}) {
  return withProvider(affirmSupportMessage({ accountId, code, businessName }), provider);
}

/** Every code the table covers — for the check. */
export const FINANCING_REASON_CODES = Object.freeze(Object.keys(AFFIRM_REASON_TEXT));
