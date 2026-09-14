// lib/billing/trialOnce.js
//
// One free trial per company, ever.
//
// ══ The rule, in the owner's words (2026-09-14) ═════════════════════════════
//
//   "If I cancelled I shouldn't get a new free trial — I should go straight
//    to the first month, because otherwise companies can cancel and go again
//    for the first free trial."
//
// Until this file existed every checkout path granted trial days from
// `Company.trialEndsAt` alone — a date stamped at signup and still in the
// future for a company that cancelled in week two. Such a company pressed
// "Choose plan", got a second Stripe Checkout with `trial_period_days` on it,
// and started a second free month. The help article had said the free month
// "is not offered a second time" since 2026-09-12; nothing enforced it.
//
// `Company.trialUsedAt` is the record. It is stamped the first time a Stripe
// subscription with a trial is seen for the company (lib/platform/stripeSync.js
// — the webhook, the reconcile, the sync and every route that holds a Stripe
// reply all pass through there), and backfilled from Subscription.createdAt
// for every company that ever had a subscription, because every checkout this
// product has ever opened began with a trial (scripts/backfill-trial-used.mjs).
//
// ══ What is NOT a trial ═════════════════════════════════════════════════════
//
// Two other things move `trial_end` on a Stripe subscription and neither asks
// this file, on purpose:
//
//   referral months     lib/referrals/extendAccess.js — a reward for a
//                       referral that PAID, on a subscription that already
//                       exists; there is no second sign-up to farm
//   the resume credit   lib/billing/resume.js — the paid weeks left on a
//                       subscription cancelled mid-period, honoured on the
//                       new one; they paid for that time
//
// Both are extensions of an existing relationship. The trial is the free
// month that opens one, and that is the thing you get once.
//
// Pure, so scripts/check-billing-resume.mjs executes it rather than grepping
// for it.

const DAY = 24 * 60 * 60 * 1000;

/**
 * How many free days a checkout may open with, for this company, today.
 *
 * @param {object} company        { trialUsedAt, trialEndsAt }
 * @param {object} [opts]
 * @param {Date}   [opts.now]
 * @param {Date}   [opts.trialEndsAt]  the free-until date the caller wants to
 *                                honour when it differs from the row's (signup
 *                                passes the post-referral / post-promo date)
 * @returns {number} 0 when no trial may be granted; otherwise ≥ 1
 */
export function trialDaysAllowed(company, { now = new Date(), trialEndsAt } = {}) {
  if (company?.trialUsedAt) return 0;
  const end = trialEndsAt ?? company?.trialEndsAt ?? null;
  const endMs = end instanceof Date ? end.getTime() : end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(endMs) || endMs <= now.getTime()) return 0;
  return Math.max(1, Math.ceil((endMs - now.getTime()) / DAY));
}

/**
 * When did this Stripe subscription's trial begin — or null if it has none.
 *
 * `trial_start` is Stripe's own stamp; a subscription created with
 * `trial_end` alone still gets one. `trial_end` without `trial_start` is a
 * partial object (a webhook fixture, an older API shape) and the subscription's
 * `created` stands in — it is the moment the trial was granted.
 *
 * @param {object} sub  a Stripe Subscription object
 * @returns {Date|null}
 */
export function trialStartFromStripe(sub) {
  if (!sub || typeof sub !== "object") return null;
  const hasTrial = Number(sub.trial_end) > 0 || Number(sub.trial_start) > 0;
  if (!hasTrial) return null;
  const s = Number(sub.trial_start) > 0 ? Number(sub.trial_start) : Number(sub.created) > 0 ? Number(sub.created) : null;
  return s ? new Date(s * 1000) : new Date();
}
