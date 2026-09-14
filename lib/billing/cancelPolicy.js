// lib/billing/cancelPolicy.js
//
// When a cancellation takes effect.
//
//   trialing   NOW. Nothing has been paid for, there is nothing to keep, and
//              the account goes read-only on the button press — as it always
//              has. Restarting later is charged on the day (one trial, ever:
//              lib/billing/trialOnce.js).
//
//   active     at the END OF THE PAID PERIOD (Stripe's cancel_at_period_end).
//              The owner, 2026-09-14, on his own cancel test: "resume current
//              (remaining balance on the month)". Someone who has paid to the
//              13th keeps the product to the 13th, nothing more is charged,
//              and Resume before then is a single Stripe update that costs
//              nothing (lib/billing/resume.js). Before this the button ended a
//              paid plan on the spot and kept the money — the help article
//              warned about it in bold, which is the tell that the behaviour
//              was wrong rather than the warning missing.
//
//   past_due   NOW. The current period is UNPAID — a period-end cancellation
//              would hand out the weeks the failed card never covered.
//
//   anything else (canceled, unknown)  NOW — the route treats "already gone"
//              as a state, not a failure, and syncs (cancel/route.js).
//
// Pure, so scripts/check-billing-resume.mjs executes it over every status.

/**
 * @param {string|null|undefined} status  our enum (lib/billing/subscriptionFields.js)
 * @returns {"immediate"|"period_end"}
 */
export function cancelModeFor(status) {
  return status === "active" ? "period_end" : "immediate";
}
