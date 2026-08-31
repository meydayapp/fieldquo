// lib/pricing.js
//
// ── The per-licence model that used to live here is gone ──────────────────
//
// This file used to export calculatePricing() — a $45-per-employee ladder
// (1–9 employees at $45/licence, a blend down to $35/licence by 20, no
// self-serve price above 40) — plus NAMED_TIERS, the three promoted cards
// built on it. The owner's ruling, 2026-08-31: "we have 4 models starting at
// $99", meaning the seat ladder in lib/pricing/ladder.js (Solo $99, Crew
// $169, Shop $269, Scale $369) is THE pricing, and the per-licence model was
// a leftover from before that change that never got removed when the price
// change shipped. See docs/PRICING-CLEANUP.md for the removal.
//
// TRIAL_PRICE and trialLabel below are a separate concern — the free first
// month — and are unaffected; they're used far more widely than the pricing
// that was removed.

// ── The first month is free ────────────────────────────────────────────────
//
// Was $1. A token charge is the worst of both worlds: it doesn't pay for
// anything, and it still puts a card form and a "why am I being charged?"
// between a contractor and the thing they came to try. Free removes the
// question entirely.
//
// Zero is load-bearing downstream, not just a number — see
// lib/platform/stripeBilling.js, which now omits the one-time line item
// altogether rather than sending Stripe a $0 charge (Stripe rejects a zero
// unit_amount on a one-time line, so a naive change here would break checkout).
export const TRIAL_PRICE = 0;

/**
 * How to WRITE the first-month price.
 *
 * "$0 first month" is technically correct and reads like a bug. Free is the
 * offer, so it has to say Free. One helper because three screens print this and
 * they were already drifting — two of them hardcoded `1` and would have gone on
 * charging a dollar on screen after the real price changed here.
 */
export function trialLabel(amount = TRIAL_PRICE) {
  return amount > 0 ? `$${amount} first month` : "Free first month";
}
