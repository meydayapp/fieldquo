// lib/stripe/clientCardSurcharge.js
//
// The CLIENT card fee — a contractor passing its card-processing cost on to
// its own client as a separate "Credit card fee 2.4%" line when, and only
// when, that client pays by CREDIT card. PURE: no Stripe client, no database,
// no React. The routes, the portal, the settings card, the refund path and
// scripts/check-client-card-surcharge.mjs all read this one file.
//
// Named "client card fee" / clientCardSurcharge* everywhere so it cannot be
// confused with CARD_SURCHARGES / publishedSurcharges in processingFee.js,
// which are STRIPE's extra charges to the platform (international card,
// currency conversion) — the opposite direction of money.
//
// ── Off by default ────────────────────────────────────────────────────────
//
// Company.clientCardSurcharge defaults to false: the company absorbs the fee,
// which is how every company worked before this existed. It is the opposite
// of Company.offlinePaymentDiscount ("3% off for e-transfer or cheque" —
// lib/payments/offlineDiscount.js), which stays as it is. Both may be on at
// once; they are separate statements.
//
// ── The rules, each with where it comes from (verified 2026-10-05) ────────
//
// 1. Canada only, never Quebec. Surcharging credit cards has been allowed in
//    Canada since 6 October 2022, when the Visa/Mastercard class-action
//    settlement took effect, in every province and territory except Quebec,
//    where the Consumer Protection Act (CQLR c. P-40.1, s. 224(c): a merchant
//    may not charge a higher price than the one advertised) forbids it — CFIB,
//    cfib-fcei.ca/surcharging: "the option to surcharge will not be available
//    to Quebec-based merchants". So: a company whose own address is in Quebec
//    cannot turn it on, AND a client whose address is in Quebec is never
//    surcharged, even by an Ontario company — the Act protects the consumer,
//    wherever the merchant sits. A job site in Quebec blocks it too (the
//    contract is performed there). Absence is not permission: a client
//    whose province cannot be read from the record is NOT surcharged, and
//    neither is one outside Canada (a US client's own state law is out of
//    scope, rule 8).
// 2. Credit cards only. Debit and prepaid cards are never surcharged — Visa's
//    rules (Canada: "Surcharges are only permitted on credit cards"), CFIB
//    ("Visa Debit … cannot be surcharged"), and Stripe's table ("Canada —
//    Credit cards only"). Stripe reports `card.funding` as credit / debit /
//    prepaid / unknown; ONLY "credit" qualifies — "unknown" is not
//    permission. Bank debit (PAD/ACH), Interac, Affirm and every non-card
//    method are never surcharged.
// 3. The cap: the lesser of the cost of acceptance and 2.4% —
//    CLIENT_CARD_SURCHARGE_MAX_BPS in processingFee.js, with its sources.
// 4. Equal across brands: nothing here reads the brand. Visa, Mastercard and
//    Amex credit cards get the same rate — asserted by the check.
// 5. Disclosure before payment and on the record: the portal shows the line
//    before the client confirms (app/portal/[token]/CardPayPanel.js), the
//    Payment row carries the fee (clientCardSurchargeCents / RateBps).
// 6. No GST/HST on the fee: CRA GST/HST Info Sheet GI-200 (March 2023) — a
//    credit card surcharge shown and charged separately is consideration for
//    an exempt financial service. It is never added to an invoice, so it can
//    never reach a taxable subtotal.
// 7. 30 days' written notice to the processor (and, for Mastercard, its
//    webform) before surcharging — Visa (stripe.com/resources/more/surcharge-
//    fees: "notify it and your acquirer of your intent to surcharge at least
//    30 days before surcharging begins"; since 15 April 2023 Visa requires
//    the notice to the acquirer only) and CFIB's guide. The contractor is
//    the merchant (on_behalf_of in lib/stripe.js), so the CONTRACTOR gives
//    it; the setting cannot be switched on without someone confirming they
//    have, recorded with who and when.
// 8. US companies: state rules differ (some ban, some cap lower). Out of
//    scope — no switch is rendered and nothing is surcharged.

import { regionFromClientRecord } from "@/lib/tax/addressRegion";
import {
  CLIENT_CARD_SURCHARGE_MAX_BPS,
  STRIPE_MAX_CHARGE_CENTS,
  clientCardSurchargeCents,
} from "@/lib/stripe/clientCardSurchargeMath";

// The arithmetic lives in clientCardSurchargeMath.js (browser-safe); it is
// re-exported here so server code reads the whole rule set from one name.
export {
  CLIENT_CARD_SURCHARGE_MAX_BPS,
  STRIPE_MAX_CHARGE_CENTS,
  clientCardSurchargeCents,
  surchargeRefundCents,
  invoicePortionOfRefundCents,
  surchargeRatePercent,
} from "@/lib/stripe/clientCardSurchargeMath";

// The API version Stripe's surcharging fields live on. Public preview as of
// 2026-10-05: docs.stripe.com/payments/cards/surcharge says "Your integration
// must be on API version 2026-03-25.preview". Sent PER REQUEST, only on the
// PaymentIntent calls of a surcharged card payment
// (lib/stripe/clientCardCharge.js) — the account's pinned version is
// untouched everywhere else.
export const STRIPE_SURCHARGE_API_VERSION = "2026-03-25.preview";

// The reasons a payment is not surcharged. Strings, not prose: the settings
// card and the check read them; nothing client-facing prints one.
export const SURCHARGE_REASONS = Object.freeze({
  OFF: "off",
  NOTICE: "notice_not_confirmed",
  COMPANY_NOT_CANADA: "company_not_canada",
  COMPANY_REGION_UNKNOWN: "company_region_unknown",
  COMPANY_QUEBEC: "company_quebec",
  CLIENT_REGION_UNKNOWN: "client_region_unknown",
  CLIENT_OUTSIDE_CANADA: "client_outside_canada",
  CLIENT_QUEBEC: "client_quebec",
  SITE_QUEBEC: "site_quebec",
  NOT_CARD: "not_card",
  NOT_CREDIT: "not_credit",
  AMOUNT: "amount",
  ROUNDS_TO_ZERO: "rounds_to_zero",
});

// ── Where the company stands ───────────────────────────────────────────────

/**
 * The company's own jurisdiction, read from what its record STATES (the
 * country and province columns, else the formatted address) — never a guess.
 * @returns {{ country: string|null, region: string|null }}
 */
export function companyJurisdiction(company) {
  if (!company || typeof company !== "object") return { country: null, region: null };
  const r = regionFromClientRecord(
    {
      country: company.country,
      province: company.province,
      address: company.address,
      postalCode: company.postalCode,
    },
    { companyCountry: company.country || null },
  );
  return { country: r.country || null, region: r.region || null };
}

/**
 * Whether the settings card renders at all: a Canadian company. A US (or any
 * other) company gets no switch — rule 8, and no dead control.
 */
export function clientCardSurchargeShown(company) {
  return companyJurisdiction(company).country === "CA";
}

/**
 * Whether THIS company may have the setting on: a Canadian company whose
 * province is known and is not Quebec. `reason` is null when it may.
 */
export function companySurchargeStanding(company) {
  const { country, region } = companyJurisdiction(company);
  if (country !== "CA") return { allowed: false, reason: SURCHARGE_REASONS.COMPANY_NOT_CANADA };
  if (!region) return { allowed: false, reason: SURCHARGE_REASONS.COMPANY_REGION_UNKNOWN };
  if (region === "QC") return { allowed: false, reason: SURCHARGE_REASONS.COMPANY_QUEBEC };
  return { allowed: true, reason: null, region };
}

/**
 * The setting as SAVED: switched on, with the processor notice confirmed by
 * a named person at a recorded time. A row with the flag but no confirmation
 * (written by hand, or half a migration) is OFF — the confirmation is the
 * thing the law asks for, not the flag.
 */
export function clientCardSurchargeSettingOn(company) {
  if (company?.clientCardSurcharge !== true) return false;
  const at = company?.clientCardSurchargeNoticeConfirmedAt;
  const by = company?.clientCardSurchargeNoticeConfirmedById;
  if (!at || !by) return false;
  const t = at instanceof Date ? at.getTime() : Date.parse(at);
  return Number.isFinite(t);
}

// ── Where the client stands ────────────────────────────────────────────────

/**
 * The client's province, from the client record (columns first, then the
 * address line — lib/tax/addressRegion.js), and the job site's when there
 * is one. Only a client KNOWN to be in Canada and outside Quebec, at a site
 * not in Quebec, may be surcharged.
 */
export function clientSurchargeStanding({ client, siteAddress = null, companyCountry = "CA" }) {
  const r = regionFromClientRecord(client || {}, { companyCountry });
  if (!r.country || (r.country === "CA" && !r.region)) {
    return { allowed: false, reason: SURCHARGE_REASONS.CLIENT_REGION_UNKNOWN };
  }
  if (r.country !== "CA") return { allowed: false, reason: SURCHARGE_REASONS.CLIENT_OUTSIDE_CANADA };
  if (r.region === "QC") return { allowed: false, reason: SURCHARGE_REASONS.CLIENT_QUEBEC };
  if (siteAddress) {
    const site = regionFromClientRecord({ address: siteAddress }, { companyCountry });
    // A site that names Quebec blocks it. A site that names nothing is not a
    // second opinion — the client's own address already answered.
    if (site.country === "CA" && site.region === "QC") {
      return { allowed: false, reason: SURCHARGE_REASONS.SITE_QUEBEC };
    }
  }
  return { allowed: true, reason: null, region: r.region };
}

/**
 * Before the card is entered: whether a credit-card fee MAY apply to this
 * client at all, so the pay screen can say so up front ("A 2.4% fee applies
 * to credit cards; debit cards have none"). The funding type is unknown
 * here; the final answer is clientCardSurchargeDecision's.
 * @returns {{ applies: boolean, reason: string|null, rateBps: number }}
 */
export function clientCardSurchargeOffer({ company, client, siteAddress = null }) {
  if (!clientCardSurchargeSettingOn(company)) {
    const reason = company?.clientCardSurcharge === true ? SURCHARGE_REASONS.NOTICE : SURCHARGE_REASONS.OFF;
    return { applies: false, reason, rateBps: 0 };
  }
  const companyStanding = companySurchargeStanding(company);
  if (!companyStanding.allowed) return { applies: false, reason: companyStanding.reason, rateBps: 0 };
  const clientStanding = clientSurchargeStanding({ client, siteAddress, companyCountry: "CA" });
  if (!clientStanding.allowed) return { applies: false, reason: clientStanding.reason, rateBps: 0 };
  return { applies: true, reason: null, rateBps: CLIENT_CARD_SURCHARGE_MAX_BPS };
}

/**
 * THE decision — every card charge creator that could surcharge asks this,
 * with the card's funding read from Stripe and the amount from its own rows.
 *
 * @param method   the payment method the charge will be confirmed with
 *                 ("card" is the only one that can qualify)
 * @param funding  Stripe's card.funding — "credit" | "debit" | "prepaid" |
 *                 "unknown" | null
 * @returns {{ applies: boolean, reason: string|null, surchargeCents: number,
 *            rateBps: number, totalCents: number }}
 */
export function clientCardSurchargeDecision({
  company,
  client,
  siteAddress = null,
  method,
  funding,
  amountCents,
  currency = "cad",
}) {
  const amount = Number(amountCents);
  const base = Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
  const none = (reason) => ({ applies: false, reason, surchargeCents: 0, rateBps: 0, totalCents: base });
  if (base <= 0) return none(SURCHARGE_REASONS.AMOUNT);

  const offer = clientCardSurchargeOffer({ company, client, siteAddress });
  if (!offer.applies) return none(offer.reason);
  if (String(method || "") !== "card") return none(SURCHARGE_REASONS.NOT_CARD);
  if (String(funding || "").toLowerCase() !== "credit") return none(SURCHARGE_REASONS.NOT_CREDIT);

  const fee = clientCardSurchargeCents(base, { currency });
  if (fee <= 0) return none(base + Math.floor((base * CLIENT_CARD_SURCHARGE_MAX_BPS) / 10000) > STRIPE_MAX_CHARGE_CENTS
    ? SURCHARGE_REASONS.AMOUNT
    : SURCHARGE_REASONS.ROUNDS_TO_ZERO);
  return {
    applies: true,
    reason: null,
    surchargeCents: fee,
    rateBps: CLIENT_CARD_SURCHARGE_MAX_BPS,
    totalCents: base + fee,
  };
}

// ── The flows, named for the settings card ─────────────────────────────────
//
// Which ways a client can pay by card, and whether the fee can apply to each.
// The settings card prints this list so a contractor knows exactly where the
// fee shows up and where it cannot — a hosted Stripe page decides the card
// AFTER we have fixed the amount, so no fee can be disclosed or charged
// there. scripts/check-client-card-surcharge.mjs asserts every card charge
// creator in the code appears here.
export const CLIENT_CARD_FLOWS = Object.freeze([
  Object.freeze({ key: "portalInvoice", surcharged: true }),
  Object.freeze({ key: "paymentStage", surcharged: true }),
  Object.freeze({ key: "officeCheckoutLink", surcharged: false }),
  Object.freeze({ key: "affirm", surcharged: false }),
  // Klarna on the hosted page: no fee — none can be shown there, and
  // Klarna's own rules forbid one ("You can't impose fees or higher prices
  // for Klarna purchases" — docs.stripe.com/payments/klarna/compliance).
  Object.freeze({ key: "klarna", surcharged: false }),
  Object.freeze({ key: "bankDebit", surcharged: false }),
  Object.freeze({ key: "bookingFee", surcharged: false }),
  Object.freeze({ key: "servicePlan", surcharged: false }),
]);
