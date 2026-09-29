// lib/billing/trialReminder.js
//
// "Your free trial ends in N days — choose a plan."
//
// ══ Who this is for ═════════════════════════════════════════════════════════
//
// A company that signed up WITHOUT choosing a plan. Since 2026-09-24 signup
// ends before the plan step (the owner: "move the credit card and plan
// selection out of the sign up… with email reminders 15 days left and 7 days
// left and 3 days left explaining that if they don't they will only have read
// only access for 7 days"). Such a company has no Subscription row, so
// nothing Stripe-shaped will ever write to it: lib/billing/renewalReminder.js
// warns a trial that DID choose a plan about its first charge, and this file
// warns the one that has not chosen yet about the read-only week.
//
// ══ Three windows, one letter each ══════════════════════════════════════════
//
// 7, 3 and 1 days left since 2026-09-29. It was 15/7/3 while the trial was 30
// days; the trial became 14 (TRIAL_DAYS, lib/pricing.js) and a 15-day letter
// cannot happen inside 14 days, so the owner moved the schedule to 7/3/1.
// The schedule applies to EVERY trial from the day it shipped, including a
// company still on the older 30-day trial: that company's 15-day letter (if
// it went out) stays stamped in trialReminder15At, which nothing reads any
// more, and it then gets the 7, 3 and 1-day letters like everyone else.
//
// The 7-day letter goes out on the first daily run that finds 7 or fewer
// days left, the 3-day one at 3 or fewer, the 1-day one at 1 — and each
// window ends where the next begins, so a run that was down for a week sends
// the ONE letter that is true today rather than three stale ones in a row.
// Every letter prints the real count, never the window's name.
//
// Each window has its own stamp on Company (trialReminder7At / 3At / 1At),
// claimed before the send and reverted when the send fails — the same
// claim-then-revert the grace warning uses, and for the same reason: a
// column whose job is "don't send twice" must never say "sent" about a letter
// Resend refused, or the company sails through the window in silence.
//
// Pure, so scripts/check-trial-reminders.mjs executes every boundary rather
// than reading it.

const DAY = 24 * 60 * 60 * 1000;

/** The windows, largest first. Each ends where the next begins. */
export const TRIAL_REMINDER_DAYS = [7, 3, 1];

/** The Company column that records a window's send. */
export function trialReminderField(days) {
  return `trialReminder${days}At`;
}

/**
 * Which letter, if any, is due for this company today.
 *
 * @param trialEndsAt      Company.trialEndsAt (Date|string|null)
 * @param hasSubscription  a Subscription row exists — then the plan is chosen
 * @param isDemo           Company.isDemo — a fixture has nobody to write to
 * @param endedByFieldQuo  Company.platformEndsAt is set — FieldQuo ended the
 *                         company from the console; "choose a plan" is a
 *                         door the checkout route now refuses, so no letter
 *                         says it
 * @param stamps           { trialReminder7At, trialReminder3At, trialReminder1At }
 * @param now              injectable clock
 *
 * @returns { send: true, days, field, daysLeft, trialEndsAt }
 *        | { send: false, reason }
 */
export function trialReminderDecision({
  trialEndsAt,
  hasSubscription = false,
  isDemo = false,
  endedByFieldQuo = false,
  stamps = {},
  now = new Date(),
} = {}) {
  if (isDemo) return { send: false, reason: "demo" };
  if (endedByFieldQuo) return { send: false, reason: "ended_by_fieldquo" };
  if (hasSubscription) return { send: false, reason: "plan_chosen" };
  const end = trialEndsAt instanceof Date ? trialEndsAt : trialEndsAt ? new Date(trialEndsAt) : null;
  if (!end || Number.isNaN(end.getTime())) return { send: false, reason: "no_trial_end" };

  const msLeft = end.getTime() - now.getTime();
  // Over. The banner and the 402 sentence say what is true now
  // (lib/billing/access.js); a letter counting down to a date that has
  // passed is not a reminder.
  if (msLeft <= 0) return { send: false, reason: "trial_over" };
  const daysLeft = Math.ceil(msLeft / DAY);

  // The smallest window that holds today: 1 day → the 1-day letter, 2–3 →
  // the 3-day one, 4–7 → the 7-day one, more → nothing yet.
  const window = [...TRIAL_REMINDER_DAYS].reverse().find((d) => daysLeft <= d);
  if (!window) return { send: false, reason: "not_yet_in_window", daysLeft };

  const field = trialReminderField(window);
  if (stamps?.[field]) return { send: false, reason: "already_sent", days: window, daysLeft };

  return { send: true, days: window, field, daysLeft, trialEndsAt: end };
}
