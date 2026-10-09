// lib/stripe/financingMethods.js
//
// Pay-over-time providers on invoice pay links (Affirm, Klarna) — PURE. The
// ONE place that knows, per provider, which Connect capability the platform
// requests, which Company column holds Stripe's answer, which countries and
// currencies Stripe serves, and the amounts a pay-over-time option exists
// for. lib/stripe/affirm.js and lib/stripe/klarna.js are thin, named views
// of this table; the status poll, the account.updated webhook, the portal,
// the pay route and the session creator all read it, so a third provider is
// a row here and its translations, not a fork of the gate logic.
//
// No Stripe client, no database: the settings page, the portal route and
// scripts/check-klarna.mjs import it freely.
//
// ── Why each provider is its OWN capability and status column ────────────
//
// TrueFinish (2026-10-09) is the case that settles it: Stripe answered
// affirm_payments with `inactive` (rejected.unsupported_business) while
// klarna_payments is active — Klarna shows on its hosted Checkout today. One
// "financing status" would have said either "off" (hiding Klarna, which
// works) or "on" (promising Affirm, which Stripe refused). Two answers need
// two columns, and the settings card prints both.
//
// ── Why the opt-in stays ONE toggle ──────────────────────────────────────
//
// Company.offerFinancing is "Offer pay-over-time". It is the contractor's
// decision to put financing in front of their clients at all; WHICH
// providers then appear is Stripe's decision per account (its capability
// answer) and per amount. A per-provider switch would be a setting whose
// only effect is to hide something Stripe has granted — no owner has asked
// for it, so it is not built.

// Why Stripe has not activated a provider, in words — the reason table, the
// capability summary and the paste-to-Stripe message — lives in
// lib/stripe/financingReasons.js, built on Affirm's 22-code table in
// lib/stripe/affirm.js. Not here: affirm.js imports this file at load, so
// this file importing it back would be a cycle.

// The values a provider's status column can hold. null is the fifth state —
// never requested — and stays null on purpose: the poll requests a
// capability only once the contractor has switched financing on.
export const FINANCING_STATUSES = Object.freeze(["active", "pending", "inactive", "unavailable"]);

const usdCad = Object.freeze({
  US: Object.freeze({ currency: "usd" }),
  CA: Object.freeze({ currency: "cad" }),
});

// Amounts are cents, inclusive at both ends.
export const FINANCING_PROVIDERS = Object.freeze({
  // Stripe: Affirm is available to US (USD) and Canadian (CAD) merchants;
  // a session outside its transaction bounds ($50–$30,000) is rejected
  // whole. https://docs.stripe.com/payments/affirm
  affirm: Object.freeze({
    key: "affirm",
    name: "Affirm",
    capability: "affirm_payments",
    statusColumn: "stripeAffirmStatus",
    byCountry: usdCad,
    // One range per currency: Affirm is one product (pay over time) across
    // the whole span.
    options: Object.freeze({
      cad: Object.freeze([Object.freeze({ option: "installments", minCents: 5_000, maxCents: 3_000_000 })]),
      usd: Object.freeze([Object.freeze({ option: "installments", minCents: 5_000, maxCents: 3_000_000 })]),
    }),
  }),
  // Stripe: Klarna for Canadian and US businesses — "Other countries: same
  // as business location / business location currency" in the cross-border
  // table, so a Canadian account presents CAD and a US account USD. The
  // Connect capability is `klarna_payments`, requested by the platform for
  // Express accounts ("To enable Klarna for connected accounts without full
  // access to the Stripe Dashboard, including Express and Custom accounts,
  // request the klarna_payments capability"), and Connect supports "all
  // charge types" — our destination charge with on_behalf_of included.
  // https://docs.stripe.com/payments/klarna (Connect; Payment options →
  // North America, checked 2026-10-09).
  //
  // The ranges are the PAY-OVER-TIME options only, per currency, from that
  // table. "Pay in full" (CAD 0–2,000, USD 0–4,000) and "Pay later"
  // (USD 5–1,000, a single payment in 30 days) are left out on purpose: the
  // client's button says "Pay over time", and an amount where Klarna could
  // only offer to take it all now is not that. Klarna sets these ranges and
  // "might change at their discretion" — when Stripe refuses, the pay route
  // records it and the client gets a sentence, never a raw error.
  //   CAD — Pay in 4: 1–1,500; Financing (up to 36 months): 250–17,500.
  //   USD — Pay in 4: 1–2,000; Financing (up to 36 months): 45–10,000.
  klarna: Object.freeze({
    key: "klarna",
    name: "Klarna",
    capability: "klarna_payments",
    statusColumn: "stripeKlarnaStatus",
    byCountry: usdCad,
    options: Object.freeze({
      cad: Object.freeze([
        Object.freeze({ option: "pay_in_4", minCents: 100, maxCents: 150_000 }),
        Object.freeze({ option: "financing", minCents: 25_000, maxCents: 1_750_000 }),
      ]),
      usd: Object.freeze([
        Object.freeze({ option: "pay_in_4", minCents: 100, maxCents: 200_000 }),
        Object.freeze({ option: "financing", minCents: 4_500, maxCents: 1_000_000 }),
      ]),
    }),
  }),
});

/** Provider keys, in the order the portal and the settings card list them. */
export const FINANCING_METHODS = Object.freeze(Object.keys(FINANCING_PROVIDERS));

export function isFinancingMethod(method) {
  return Object.prototype.hasOwnProperty.call(FINANCING_PROVIDERS, String(method || ""));
}

function providerOf(provider) {
  const p = FINANCING_PROVIDERS[String(provider || "")];
  if (!p) throw new Error(`Unknown financing provider: ${provider}`);
  return p;
}

/** Whether a provider exists at all for a connected account in this country. */
export function financingServesCountry(provider, country) {
  return Boolean(providerOf(provider).byCountry[String(country || "").toUpperCase()]);
}

/**
 * The capabilities the platform should request on this account for
 * pay-over-time: every provider that serves the account's country, once the
 * company has opted in. Other countries are left alone — Stripe rejects the
 * request — and the settings card says so instead.
 */
export function financingCapabilitiesWanted({ account, company } = {}) {
  if (!company?.offerFinancing) return [];
  return FINANCING_METHODS.filter((k) => financingServesCountry(k, account?.country)).map(
    (k) => FINANCING_PROVIDERS[k].capability,
  );
}

/**
 * A provider's status column from a retrieved Stripe account:
 *   "unavailable"  the account's country is not one the provider serves;
 *   "active" | "pending" | "inactive"  Stripe's own status for the capability
 *                  (a capability object's "disabled" reads as inactive);
 *   null           not requested yet (or an account we know nothing about).
 * Pure and total — a null account is null, never a throw.
 */
export function financingStatusFor(provider, account) {
  const p = providerOf(provider);
  if (!account) return null;
  if (account.country && !financingServesCountry(provider, account.country)) return "unavailable";
  const raw = account.capabilities?.[p.capability];
  if (raw === "active" || raw === "pending" || raw === "inactive") return raw;
  if (raw === "disabled") return "inactive";
  return null;
}

/** Every provider's status column, as a `data` object for db.company.update. */
export function financingStatusColumns(account) {
  return Object.fromEntries(
    FINANCING_METHODS.map((k) => [FINANCING_PROVIDERS[k].statusColumn, financingStatusFor(k, account)]),
  );
}

/** The provider's pay-over-time ranges for a charge currency, or []. */
export function financingRanges(provider, currency) {
  return providerOf(provider).options[String(currency || "").toLowerCase()] || [];
}

/** The overall { minCents, maxCents } a provider spans in a currency, or null. */
export function financingBounds(provider, currency) {
  const ranges = financingRanges(provider, currency);
  if (!ranges.length) return null;
  return {
    minCents: Math.min(...ranges.map((r) => r.minCents)),
    maxCents: Math.max(...ranges.map((r) => r.maxCents)),
  };
}

/**
 * Whether an amount, in the CHARGE currency, has at least one pay-over-time
 * option with this provider. A currency the provider does not serve is no.
 */
export function financingAmountEligible(provider, { amountCents, currency } = {}) {
  const cents = Math.trunc(Number(amountCents));
  if (!Number.isFinite(cents) || cents <= 0) return false;
  return financingRanges(provider, currency).some((r) => cents >= r.minCents && cents <= r.maxCents);
}

/**
 * The ONE rule for offering a provider on a payment: the contractor opted
 * in, Stripe has ACTIVATED that provider's capability on their account (our
 * column, from Stripe's answer), and the amount qualifies. "pending",
 * "inactive", "unavailable" and null are all no — a session naming a method
 * the account cannot take is rejected whole.
 */
export function financingOffered(provider, { company, amountCents, currency } = {}) {
  const p = providerOf(provider);
  return (
    Boolean(company?.offerFinancing) &&
    company?.[p.statusColumn] === "active" &&
    financingAmountEligible(provider, { amountCents, currency })
  );
}

/** The providers offered for this payment, in display order — [] for none. */
export function offeredFinancingMethods({ company, amountCents, currency } = {}) {
  return FINANCING_METHODS.filter((k) => financingOffered(k, { company, amountCents, currency }));
}

/**
 * Whether a provider is on for the company at all, ignoring the amount — the
 * "How to pay" line in an invoice email, which is written before any amount
 * is chosen.
 */
export function financingEnabled(provider, company) {
  return Boolean(company?.offerFinancing) && company?.[providerOf(provider).statusColumn] === "active";
}

// ── The company's own financing note (Settings › Instant quotes) ────────────
//
// Company.financing.note is the contractor's text, printed on their quotes.
// If it promises a provider FieldQuo cannot currently put on the pay link —
// "Pay with Klarna" while Stripe has Klarna pending, or Afterpay, which
// FieldQuo does not integrate — the homeowner is promised something the pay
// page will not show. We never edit their words; the settings card warns
// the owner instead. Matched on whole words, case-insensitively, in the
// note. A note whose hand-off link goes to that provider's own site
// (affirm.com, klarna.com, afterpay.com) is the contractor's own merchant
// arrangement — the quote's button sends the homeowner there, so the promise
// is kept without us and nothing is flagged.
const NAMED_PROVIDERS = Object.freeze([
  Object.freeze({ key: "affirm", name: "Affirm", pattern: /\baffirm\b/i }),
  Object.freeze({ key: "klarna", name: "Klarna", pattern: /\bklarna\b/i }),
  Object.freeze({ key: "afterpay", name: "Afterpay", pattern: /\b(afterpay|clearpay)\b/i }),
]);

/**
 * Providers the company's financing note names that its pay link cannot
 * offer right now: Affirm / Klarna when financing is off or Stripe's answer
 * is not `active`; Afterpay always (FieldQuo does not integrate it). A
 * provider whose own site is the note's hand-off link is never flagged.
 * [] when financing is off on the quote, or the note names nothing.
 *
 * @returns {{ key: string, name: string }[]}
 */
export function financingNoteProviderWarnings({ financing, company } = {}) {
  return unofferedNamedProviders(financingNoteNamedProviders(financing), company);
}

/**
 * The providers a financing note names, minus any whose own site is the
 * note's hand-off link — before asking whether we can offer them. The status
 * poll sends this to the settings card, which applies
 * unofferedNamedProviders with the switch's CURRENT position, so flipping
 * "Offer pay-over-time" updates the warning without another poll.
 */
export function financingNoteNamedProviders(financing) {
  if (!financing || typeof financing !== "object" || !financing.enabled) return [];
  const note = typeof financing.note === "string" ? financing.note : "";
  let host = "";
  try {
    host = financing.url ? new URL(String(financing.url)).hostname.replace(/\./g, " ") : "";
  } catch {
    host = "";
  }
  return NAMED_PROVIDERS.filter((p) => p.pattern.test(note) && !p.pattern.test(host)).map((p) => ({
    key: p.key,
    name: p.name,
  }));
}

/** Of those named, the ones the pay link cannot offer for this company now. */
export function unofferedNamedProviders(named, company) {
  return (Array.isArray(named) ? named : []).filter(
    (p) => !isFinancingMethod(p.key) || !financingEnabled(p.key, company),
  );
}
