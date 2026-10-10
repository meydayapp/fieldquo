// lib/payments/payOverTimeGuide.js
//
// The client's "How to pay over time" guide — WHEN it is linked, WHERE it
// lives, and the colours it is drawn in. PURE: no database, no Stripe client,
// so the portal route, the three invoice-email senders, the guide page and
// scripts/check-pay-over-time-guide.mjs all import it freely.
//
// ── One rule for the button, the link and the email ───────────────────────
//
// The portal's "Pay over time (Klarna)" button is shown for the providers
// Stripe has ACTIVATED on the company's account whose ranges cover the figure
// the page asks for (lib/stripe/financingMethods.js offeredFinancingMethods),
// on a real Stripe account that can take charges, never on a demo. The guide
// link sits under that button, and the email's guide line is the same promise
// made earlier — so all three read payOverTimeOffer() below. A second copy of
// the rule in an email sender is the copy that would rot: it would keep
// inviting clients to a plan the pay page no longer shows.
//
// ── What the guide may say ────────────────────────────────────────────────
//
// Only what Stripe's own documentation says about the providers FieldQuo
// actually puts on the pay link (Klarna, Affirm — never Afterpay, which
// financingMethods.js does not offer). Checked 2026-10-09:
//
//   Klarna — https://docs.stripe.com/payments/klarna
//     "Paying with Klarna redirects customers to Klarna's site, which
//     displays payment options … After the customer selects a payment
//     option, Klarna returns them to your site to complete the order."
//     "Klarna collects the purchase amount from your customer, who repays
//     Klarna directly."
//   Klarna — https://docs.stripe.com/payments/klarna/compliance
//     "Klarna decides if customers can use Klarna for purchases" — so the
//     provider decides approval, never the contractor and never FieldQuo.
//     "You can't use any design that's confusingly similar to Klarna's
//     trademarks" — so the guide's mock prints the provider's NAME in the
//     company's ink, never a provider logo or colour.
//   Affirm — https://docs.stripe.com/payments/affirm ("Customer experience")
//     the customer is redirected to Affirm, "selects a payment plan and
//     accepts the terms of the repayment plan"; "Affirm confirms or denies
//     a loan"; "Affirm collects repayment directly from the customer over
//     time."
//
// No interest rate, no "0%", no "interest-free", no approval odds: Stripe
// says Klarna financing "might include interest" and that approval "is
// subject to creditworthiness", and FieldQuo cannot know which plan a given
// client will be shown.

import { invoicePaymentCurrency } from "@/lib/stripe/paymentCurrency";
import {
  FINANCING_METHODS,
  FINANCING_PROVIDERS,
  financingEnabled,
  offeredFinancingMethods,
} from "@/lib/stripe/financingMethods";
import { documentTheme, fillPair, outlinePair, washPair, ruleColor } from "@/lib/documents/theme";
import { ensureContrast } from "@/lib/brand/colour";

/**
 * The Company columns payOverTimeOffer reads. Spread into each invoice-email
 * sender's select — NOT into HOW_TO_PAY_COMPANY_SELECT, which the public
 * quote route also spreads and forwards the remainder of: a new status
 * column there would reach a stranger's browser.
 */
export const PAY_OVER_TIME_COMPANY_SELECT = Object.freeze({
  currency: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  isDemo: true,
  offerFinancing: true,
  stripeAffirmStatus: true,
  stripeKlarnaStatus: true,
});

/**
 * The pay-over-time providers offered on ONE payment — the portal button's
 * rule, and the guide link's. [] for none.
 *
 *   - a currency FieldQuo charges in (no CAD default: an unknown currency
 *     offers nothing rather than guessing one);
 *   - a real Stripe account that can take charges;
 *   - not a demo company (its pay step is the demo screen, and its status
 *     columns are not Stripe's answer);
 *   - offeredFinancingMethods: opted in, Stripe's status `active`, and the
 *     amount inside that provider's range for the currency.
 *
 * @param company      needs PAY_OVER_TIME_COMPANY_SELECT's columns
 * @param amountCents  the figure THIS payment asks for, server-derived
 */
export function payOverTimeOffer({ company, amountCents } = {}) {
  if (!company || company.isDemo) return [];
  if (!(company.stripeAccountId && company.stripeChargesEnabled)) return [];
  let currency;
  try {
    currency = invoicePaymentCurrency(company.currency);
  } catch {
    return [];
  }
  return offeredFinancingMethods({ company, amountCents, currency });
}

/** Provider keys from a query value ("klarna,affirm"), known ones only, deduplicated, in display order. */
export function parseGuideProviders(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  const asked = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return FINANCING_METHODS.filter((k) => asked.has(k));
}

/**
 * The providers the guide page names. The link carries the providers the
 * server offered for that payment; the page keeps only those the company has
 * switched on and Stripe has activated NOW (the query string is a hint, never
 * a grant). With no hint, every provider that is on. A demo or an account
 * that cannot take charges names none — the page then says so instead of
 * walking a client towards a button that is not there.
 */
export function guideProviders(company, hinted = []) {
  if (!company || company.isDemo) return [];
  if (!(company.stripeAccountId && company.stripeChargesEnabled)) return [];
  const on = FINANCING_METHODS.filter((k) => financingEnabled(k, company));
  const wanted = parseGuideProviders(hinted);
  return wanted.length ? on.filter((k) => wanted.includes(k)) : on;
}

/** Provider display names (brand names — never translated). */
export function providerNames(keys) {
  return (Array.isArray(keys) ? keys : []).filter((k) => FINANCING_PROVIDERS[k]).map((k) => FINANCING_PROVIDERS[k].name);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const cleanId = (v) => (typeof v === "string" && ID_RE.test(v) ? v : null);

/**
 * The guide's path inside the client's portal. `providers` is what the
 * server offered for this payment; `invoiceId` (+ `stageId` / `requestId`)
 * only builds the page's "Back to your invoice" link — no figure ever rides
 * in the URL (non-negotiable #5).
 */
export function payOverTimeGuidePath(token, { providers = [], invoiceId = null, stageId = null, requestId = null } = {}) {
  const params = new URLSearchParams();
  const keys = parseGuideProviders(providers);
  if (keys.length) params.set("p", keys.join(","));
  if (cleanId(invoiceId)) params.set("invoice", invoiceId);
  if (cleanId(invoiceId) && cleanId(stageId)) params.set("stage", stageId);
  if (cleanId(invoiceId) && cleanId(requestId)) params.set("request", requestId);
  const qs = params.toString();
  return `/portal/${encodeURIComponent(String(token || ""))}/pay-over-time${qs ? `?${qs}` : ""}`;
}

/**
 * The guide's ABSOLUTE link for an email — or null when this payment offers
 * no pay-over-time (payOverTimeOffer, the portal button's rule), in which
 * case the email says nothing about it.
 *
 * @param origin  getAppOrigin(request) — the same origin the email's pay link uses
 */
export function payOverTimeGuideUrl({ origin, token, company, amountCents, invoiceId = null, stageId = null, requestId = null } = {}) {
  if (!origin || !token) return null;
  const providers = payOverTimeOffer({ company, amountCents });
  if (!providers.length) return null;
  return `${String(origin).replace(/\/+$/, "")}${payOverTimeGuidePath(token, { providers, invoiceId, stageId, requestId })}`;
}

/** Where the guide's back link goes: the invoice it was opened from, else the portal home. */
export function guideBackPath(token, { invoiceId = null, stageId = null, requestId = null } = {}) {
  const base = `/portal/${encodeURIComponent(String(token || ""))}`;
  const inv = cleanId(invoiceId);
  if (!inv) return base;
  const q = cleanId(stageId) ? `?stage=${stageId}` : cleanId(requestId) ? `?request=${requestId}` : "";
  return `${base}/invoices/${inv}${q}`;
}

// The warm page the portal sits on (app/portal/[token]/… `bg-[#f5f2ec]`).
export const GUIDE_PAGE_BG = "#f5f2ec";

/**
 * Every colour the guide draws, from the company's ONE brand hex
 * (lib/documents/theme.js), each text colour measured against the surface it
 * is actually drawn on. Executed for yellow, white, black, mid-grey, lime,
 * pale grey and red in scripts/check-pay-over-time-guide.mjs.
 *
 *   paper / ink / muted   the card and its text (theme ink, inkMuted)
 *   bubble                the step numbers: fillPair — a near-white brand
 *                         becomes ink, a mid-tone is stepped, never guessed
 *   rule                  the brand stripe; ink when the brand would vanish
 *   wash                  the illustration's panel: washPair, its ink/muted
 *                         measured on the wash itself
 *   mockFill              the mock "Pay" button on the wash (fillPair)
 *   mockOutline           the mock "Pay over time" button: outlinePair on the
 *                         mock's white invoice card
 *   selected              the chosen row's ring on the mock payment page —
 *                         non-text, held to 3:1 against the white card
 *   link                  the back link, on the warm page background
 */
export function guidePalette(company = {}) {
  const t = documentTheme(company);
  const bubble = fillPair(t);
  const wash = washPair(t);
  const card = "#ffffff";
  const outline = outlinePair(t, card);
  return {
    pageBg: GUIDE_PAGE_BG,
    paper: t.paper,
    ink: t.ink,
    muted: t.inkMuted,
    rule: ruleColor(t),
    bubble,
    wash: { bg: wash.bg, ink: wash.ink, muted: wash.muted },
    mockCard: card,
    mockInk: t.ink,
    mockMuted: ensureContrast(t.inkMuted, card, 4.5),
    mockFill: bubble,
    mockOutline: outline,
    selected: ensureContrast(t.accentText, card, 3),
    placeholder: "#e4e2dd",
    link: ensureContrast(t.ink, GUIDE_PAGE_BG, 4.5),
    linkMuted: ensureContrast(t.inkMuted, GUIDE_PAGE_BG, 4.5),
  };
}
