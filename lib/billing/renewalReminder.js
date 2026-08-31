// lib/billing/renewalReminder.js
//
// When to warn a company that FieldQuo is about to charge its card again.
//
// ══ Why a window at all ═════════════════════════════════════════════════════
//
// Three things independently push toward "tell them before you charge them":
//
//   Card networks    Mastercard requires an electronic reminder 7–30 days
//                     before the next billing date for anything rebilling
//                     every six months or less — which covers a monthly
//                     subscription outright. Visa's equivalent rule (found in
//                     its trial-conversion guidance, applied here to every
//                     recurring charge rather than just the first one) is a
//                     flat 7 days.
//                       https://www.mastercard.us/content/dam/public/mastercardcom/na/global-site/documents/subscription_recurring-payments-and-negative-option-billing-merchants.pdf
//                       https://chargebacks911.com/visa-recurring-payments/
//
//   California ARL    A subscription with an initial term of a year or more
//                     must get notice of the auto-renewal 15–45 days before
//                     it happens. FieldQuo's annual plan is exactly this
//                     shape. (Amendments effective 1 Jul 2025.)
//                       https://www.termsfeed.com/blog/california-automatic-renewal-law-arl/
//                       https://www.cooley.com/news/insight/2025/2025-06-04-california-automatic-renewal-law-amendments-take-effect-on-july-1-2025
//
//   Ordinary practice SaaS renewal-email guides converge on "at least 7 days,
//                     14 is better" for a plan generally and specifically call
//                     out that an early notice — three weeks out is the
//                     example given — measurably improves renewal rates for
//                     annual/high-ticket plans, because the point is to give
//                     someone time to budget or object, not to have technically
//                     said something.
//                       https://encharge.io/saas-renewal-emails/
//
// All three agree on the same shape: MONTHLY needs a short window, ANNUAL
// needs a much longer one. This file picks the values:
//
//   month  7 days   the floor every source above agrees on for a cadence this
//                    short; going longer buys little (a week's charge is not
//                    a decision most people need three weeks to make) and 7
//                    happens to be exactly Mastercard's minimum for ≤6-month
//                    billing.
//   year   30 days   inside the CA ARL's 15–45-day window, and long enough to
//                     be worth something for a charge sized like a year's
//                     subscription — the "three weeks out" evidence above is
//                     about exactly this kind of higher-stakes renewal.
//
// KNOWN GAP, written down rather than silently ignored: Quebec's Consumer
// Protection Act requires notice for a contract with an initial term over 60
// days to go out BETWEEN THE 90TH AND 60TH DAY before renewal — a window that
// does not overlap California's 15–45 days at all. FieldQuo's annual plan
// technically has Quebec customers in its addressable market and this single
// 30-day reminder does not satisfy that provision. Fixing it properly means a
// second, earlier notice for annual subscriptions and is a product/legal call,
// not something to slip in unasked — flagged for the owner rather than guessed
// at. See the task report for the citation.
//   https://www.osler.com/en/insights/updates/automatic-renewals-in-canadian-consumer-protection-law/
//
// ══ Pure, on purpose ════════════════════════════════════════════════════════
//
// A row, a clock, no database and no Stripe call — so every branch (no period
// end, already reminded, wrong status, right at the boundary) is something a
// check script can execute directly rather than something that only shows up
// once a day in production. See scripts/check-renewal-reminders.mjs.

import { isBillingInterval, DEFAULT_INTERVAL } from "@/lib/billing/interval";

const DAY = 24 * 60 * 60 * 1000;

/** Advance-notice window, in days, by billing cadence. See the file header. */
export const RENEWAL_WINDOW_DAYS = { month: 7, year: 30 };

/** The window for a cadence, defaulting the same way lib/billing/interval.js
 *  does — an unrecognised value is treated as the no-commitment option. */
export function windowDaysFor(billingInterval) {
  const interval = isBillingInterval(billingInterval) ? billingInterval : DEFAULT_INTERVAL;
  return RENEWAL_WINDOW_DAYS[interval];
}

/**
 * Should this subscription get an advance renewal reminder right now?
 *
 * @param status                     Subscription.status
 * @param billingInterval            Subscription.billingInterval
 * @param currentPeriodEnd           Subscription.currentPeriodEnd (Date|null)
 * @param renewalRemindedPeriodEnd   Subscription.renewalRemindedPeriodEnd (Date|null)
 * @param now                        injectable clock
 *
 * @returns { send: boolean, reason: string, windowDays?, periodEnd? }
 */
export function decideRenewalReminder({
  status,
  billingInterval,
  currentPeriodEnd,
  renewalRemindedPeriodEnd,
  now = new Date(),
}) {
  // ── Only a subscription that is actually going to renew ────────────────
  //
  // "active" and "trialing" both genuinely renew — a trialing subscription's
  // currentPeriodEnd IS the date the free-trial-to-paid conversion happens
  // (Stripe's trial phase is period 1), which is exactly the moment the card
  // networks' trial-conversion notice rule is about.
  //
  // Everything else is deliberately excluded, and each exclusion is a
  // decision, not an oversight:
  //
  //   canceled    they already said no. "You'll be charged" to someone who
  //               cancelled is the exact failure named in the task: worse
  //               than silence, because it reads as a bug or a threat.
  //   past_due    the LAST charge already failed. Forecasting a future charge
  //               on the same card, with no mention that it just bounced, is
  //               a different kind of wrong statement — and that account is
  //               already inside the 7-day grace-period machinery
  //               (lib/billing/access.js), which is the honest place for
  //               "your payment didn't go through" to live, not this cron.
  //   anything else (no row, unrecognised status) — nothing to warn about.
  if (status !== "active" && status !== "trialing") {
    return { send: false, reason: `not_renewing_${status || "none"}` };
  }

  // ── No date, no claim ───────────────────────────────────────────────────
  //
  // currentPeriodEnd is null for a subscription whose webhook hasn't landed
  // yet, or an old row from before it was tracked. Absence of a date is not a
  // date — inventing one (today + N days, "soon", whatever) would put a
  // specific claim ("you'll be charged on…") in an email backed by nothing.
  if (!currentPeriodEnd) {
    return { send: false, reason: "no_period_end" };
  }

  const periodEnd = new Date(currentPeriodEnd);
  const windowDays = windowDaysFor(billingInterval);
  const daysUntil = (periodEnd.getTime() - now.getTime()) / DAY;

  // Already renewed (or about to have, within rounding) and the webhook that
  // would advance currentPeriodEnd just hasn't landed yet, or the cron missed
  // a run. Either way, a reminder dated in the past is not a reminder.
  if (daysUntil < 0) {
    return { send: false, reason: "period_already_passed" };
  }

  if (daysUntil > windowDays) {
    return { send: false, reason: "not_yet_in_window", windowDays };
  }

  // Already sent for THIS period. Comparing timestamps rather than truthiness
  // is what lets next period's reminder go out — the column advances with
  // currentPeriodEnd, same idea as rentRef() keying a charge to a period.
  if (
    renewalRemindedPeriodEnd &&
    new Date(renewalRemindedPeriodEnd).getTime() === periodEnd.getTime()
  ) {
    return { send: false, reason: "already_reminded" };
  }

  return { send: true, reason: "due", windowDays, periodEnd };
}
