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
// TRIAL_PRICE, TRIAL_DAYS and trialLabel below are a separate concern — the
// free trial — and are unaffected; they're used far more widely than the
// pricing that was removed.

// ── The trial is free ──────────────────────────────────────────────────────
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
// ── How long the trial lasts ───────────────────────────────────────────────
//
// Owner decision 2026-09-29: a NEW company gets 14 days free, no card. It was
// a calendar-ish 30 days ("first month free") stamped as now + 30d at signup.
// Fourteen is long enough to send real quotes to real clients and short
// enough that the decision happens while the account is still warm.
//
// This is the ONE place the length lives. app/api/companies/route.js stamps
// Company.trialEndsAt = now + TRIAL_DAYS at signup; Stripe's
// trial_period_days is DERIVED from that date (lib/billing/trialOnce.js), not
// from this number directly, so a referral month on top still reaches Stripe.
// Existing rows are never rewritten: a company that signed up on the 30-day
// trial keeps the trialEndsAt it was given. Every screen, email and help page
// that says how long the trial is reads this or says "14 days".
export const TRIAL_DAYS = 14;

// No card at signup (owner decisions 2026-09-24, re-confirmed 2026-09-29).
// The trial runs on trialEndsAt alone; the plan and card are chosen from
// Account & Billing. When it ends without a plan, lib/billing/access.js puts
// the company read-only for GRACE_DAYS, then locks it — nothing is deleted.
export const TRIAL_CARD_REQUIRED = false;

/**
 * How to WRITE the trial offer.
 *
 * "$0 for 14 days" is technically correct and reads like a bug. Free is the
 * offer, so it has to say Free. One helper because three screens print this and
 * they were already drifting — two of them hardcoded `1` and would have gone on
 * charging a dollar on screen after the real price changed here.
 */
export function trialLabel(amount = TRIAL_PRICE, days = TRIAL_DAYS) {
  return amount > 0 ? `$${amount} for your first ${days} days` : `${days} days free`;
}
