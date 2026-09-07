// lib/billing/renewalReminder.js
//
// When to warn a company that FieldQuo is about to charge its card again.
//
// ══ Why a window at all ═════════════════════════════════════════════════════
//
// Three things independently push toward "tell them before you charge them":
//
//   Card networks    Mastercard requires an electronic reminder 7–30 days
//                     before the next billing date for a subscription billed
//                     every six months OR LESS FREQUENTLY — semi-annual and
//                     annual. A monthly subscription is NOT in that rule: for
//                     monthly billing the network asks for a receipt after
//                     each charge, not a warning before it. (The first version
//                     of this header read "six months or less" as "intervals
//                     up to six months" and sent monthly reminders on the
//                     strength of it — the owner's instinct that a monthly
//                     customer does not need to be told every month matched
//                     the rule; the comment did not. Confirm with the
//                     acquirer if in doubt.) Visa's trial-conversion guidance
//                     is about the FIRST charge after a trial, which the
//                     trialing branch below still covers.
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
// The shape, decided by the owner on 2026-09-07: ANNUAL gets a reminder,
// MONTHLY gets none. A company paying month to month is charged the same
// amount on the same day every month and needs no letter about it; a
// company on a yearly plan can genuinely forget when the next charge lands,
// and that charge is twelve times the size. Nothing above requires the
// monthly one, and sending it was noise dressed as compliance.
//
//   year   30 days   inside the CA ARL's 15–45-day window, and long enough to
//                     be worth something for a charge sized like a year's
//                     subscription — the "three weeks out" evidence above is
//                     about exactly this kind of higher-stakes renewal.
//   month  never     — see the Mastercard note above.
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

/** Advance-notice window, in days, by billing cadence. See the file header:
 *  ANNUAL only. A monthly subscription gets no advance reminder at all. */
export const RENEWAL_WINDOW_DAYS = { year: 30 };

/** Notice before a TRIAL's first real charge, whatever the plan's cadence —
 *  the card networks' trial-conversion floor. See decideRenewalReminder. */
export const TRIAL_NOTICE_DAYS = 7;

/** The window for a cadence, or null when that cadence gets no reminder.
 *  Unrecognised and missing cadences are treated as monthly — the
 *  no-commitment option lib/billing/interval.js defaults to — and so get
 *  nothing: a reminder is a claim about a charge, and a cadence we cannot
 *  name is not one to make claims about. */
export function windowDaysFor(billingInterval) {
  const interval = isBillingInterval(billingInterval) ? billingInterval : DEFAULT_INTERVAL;
  return RENEWAL_WINDOW_DAYS[interval] ?? null;
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
  const daysUntil = (periodEnd.getTime() - now.getTime()) / DAY;

  // Already renewed (or about to have, within rounding) and the webhook that
  // would advance currentPeriodEnd just hasn't landed yet, or the cron missed
  // a run. Either way, a reminder dated in the past is not a reminder.
  if (daysUntil < 0) {
    return { send: false, reason: "period_already_passed" };
  }

  // ── Monthly renews every month; nobody needs a letter about it ────────
  //
  // Only an annual plan has a RENEWAL window (see the header). A monthly, or
  // an unrecognised cadence treated as monthly, is refused — a reminder for a
  // charge that recurs every thirty days is noise, and noise trains the
  // recipient to ignore the one that matters. Refused AFTER the date checks,
  // so a row with no date or a stale one is described by that fact first.
  //
  // A TRIAL is the exception, on any cadence: its currentPeriodEnd is the day
  // the first real charge lands, and telling someone before their free month
  // becomes a paid one is both the card networks' trial-conversion rule and
  // plain decency. Seven days, the networks' floor.
  const windowDays =
    status === "trialing"
      ? (windowDaysFor(billingInterval) ?? TRIAL_NOTICE_DAYS)
      : windowDaysFor(billingInterval);
  if (windowDays === null) {
    return { send: false, reason: "not_annual" };
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
