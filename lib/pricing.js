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

// ── How long a NEW company's free trial runs, and whether it needs a card ───
//
// The owner's decision for signups from 2026-09-29: fourteen days, no card.
// Read by POST /api/companies when it stamps Company.trialEndsAt, and by every
// sentence on /signup and /welcome that names the trial — none of them types
// the number. An existing company keeps the trialEndsAt it was created with;
// nothing here reaches back to it.
//
// TRIAL_CARD_REQUIRED is false because the signup takes no card at all: the
// company starts on trialEndsAt alone and chooses a plan from the banner
// (lib/billing/access.js reads that date). A page that says "no card needed"
// reads this constant rather than asserting it.
export const TRIAL_DAYS = 14;
export const TRIAL_CARD_REQUIRED = false;

/** The Date a trial started at `from` ends on. */
export function trialEndsAtFrom(from = new Date(), days = TRIAL_DAYS) {
  return new Date(new Date(from).getTime() + days * 24 * 60 * 60 * 1000);
}
