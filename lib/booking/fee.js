// lib/booking/fee.js
//
// The one place that decides what a booking visit actually costs, so the public
// booking page (which shows the price) and the confirm route (which charges it)
// can never disagree. Server-side only — the browser never computes the fee.
//
// A fee is charged ONLY when the company can actually collect it (Stripe Connect
// charges enabled). Without that, a paid event type quietly falls back to a free
// booking rather than showing a price nobody can be charged.

export function effectiveBookingFeeCents(company, eventType) {
  const chargesEnabled = Boolean(company?.stripeChargesEnabled);
  const base = Number(eventType?.feeCents) || 0;
  if (!chargesEnabled || base <= 0) {
    return { feeCents: 0, feeStandardCents: null };
  }
  // A live promo replaces the standard price; feeStandardCents carries the
  // original for the struck-through "$79 → $20" display.
  const promo = eventType?.promoFeeCents;
  if (eventType?.promoActive && promo != null && Number(promo) >= 0) {
    return { feeCents: Math.round(Number(promo)), feeStandardCents: base };
  }
  return { feeCents: base, feeStandardCents: null };
}
