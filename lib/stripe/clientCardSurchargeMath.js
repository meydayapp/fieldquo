// lib/stripe/clientCardSurchargeMath.js
//
// The arithmetic of the client credit-card fee — the rate, the cents, the
// refund shares. PURE and dependency-light on purpose: the portal's card form
// and the invoice page's refund dialog run in the BROWSER, and the rules
// module (lib/stripe/clientCardSurcharge.js) pulls in the address parser and
// its US tax tables, which a browser has no use for. That module re-exports
// everything here, so server code imports one name from one place.

import { CLIENT_CARD_SURCHARGE_MAX_BPS, processingFeeCents } from "@/lib/stripe/processingFee";

export { CLIENT_CARD_SURCHARGE_MAX_BPS };

// Stripe's largest single charge, in the smallest currency unit
// (docs.stripe.com/currencies — "Maximum charge amount": 99,999,999 for
// CAD/USD). A fee that would carry the total past it is not applied; Stripe
// would refuse the whole charge, and the client could not pay at all.
export const STRIPE_MAX_CHARGE_CENTS = 99_999_999;

/**
 * The fee on `amountCents` of credit-card payment: 2.4%, rounded DOWN, never
 * above the contractor's own cost of accepting that payment, never negative.
 * Integer cents in, integer cents out.
 */
export function clientCardSurchargeCents(amountCents, { currency = "cad" } = {}) {
  const amount = Number(amountCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
  const capped = Math.floor((amount * CLIENT_CARD_SURCHARGE_MAX_BPS) / 10000);
  let cost;
  try {
    cost = processingFeeCents({ amountCents: amount, currency, method: "card" });
  } catch {
    // A currency the card rate does not cover has no known cost of
    // acceptance, and an unknown cost is not a licence to charge 2.4%.
    return 0;
  }
  const fee = Math.max(0, Math.min(capped, cost));
  if (amount + fee > STRIPE_MAX_CHARGE_CENTS) return 0;
  return fee;
}

// ── Refunds ────────────────────────────────────────────────────────────────
//
// Card-network rules and Stripe's surcharging docs
// (docs.stripe.com/payments/cards/surcharge, "Refunds"): a full refund
// returns the whole surcharge; a partial refund returns a pro-rated share
// ("refund 60.90 USD (60.00 USD, plus 60/100 of the 1.50 USD surcharge)").
// Computed CUMULATIVELY — the share owed after this refund minus the share
// already returned — so a run of partial refunds that adds up to the whole
// payment returns exactly the whole fee, never a cent more or less.

function shareOf(fee, base, refundedBase) {
  if (refundedBase >= base) return fee;
  return Math.round((fee * refundedBase) / base);
}

/**
 * @param paymentBaseCents         what the payment put against the invoice
 * @param surchargeCents           the card fee charged on top of it
 * @param alreadyRefundedBaseCents invoice money already returned from it
 * @param refundBaseCents          invoice money this refund returns
 * @returns the card fee to return alongside it, in cents
 */
export function surchargeRefundCents({
  paymentBaseCents,
  surchargeCents,
  alreadyRefundedBaseCents = 0,
  refundBaseCents,
}) {
  const base = Math.max(0, Math.trunc(Number(paymentBaseCents)) || 0);
  const fee = Math.max(0, Math.trunc(Number(surchargeCents)) || 0);
  const before = Math.min(base, Math.max(0, Math.trunc(Number(alreadyRefundedBaseCents)) || 0));
  const now = Math.max(0, Math.trunc(Number(refundBaseCents)) || 0);
  if (base <= 0 || fee <= 0 || now <= 0) return 0;
  const after = Math.min(base, before + now);
  return Math.max(0, shareOf(fee, base, after) - shareOf(fee, base, before));
}

/**
 * The INVOICE part of a refund total Stripe reports for the charge (a refund
 * made outside FieldQuo carries the fee and the invoice money mixed).
 * Pro-rata on the charge; the whole base once the whole charge is back.
 */
export function invoicePortionOfRefundCents({ paymentBaseCents, surchargeCents, refundedCents }) {
  const base = Math.max(0, Math.trunc(Number(paymentBaseCents)) || 0);
  const fee = Math.max(0, Math.trunc(Number(surchargeCents)) || 0);
  const back = Math.max(0, Math.trunc(Number(refundedCents)) || 0);
  if (fee <= 0) return Math.min(base, back);
  if (back >= base + fee) return base;
  return Math.min(base, Math.round((back * base) / (base + fee)));
}

/** "2.4" for the label — the rate in percent, no trailing zero. */
export function surchargeRatePercent(rateBps = CLIENT_CARD_SURCHARGE_MAX_BPS) {
  const n = Math.max(0, Math.trunc(Number(rateBps)) || 0);
  return String(n / 100);
}
