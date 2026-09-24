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
// The 15-day letter goes out on the first daily run that finds 15 or fewer
// days left, the 7-day one at 7 or fewer, the 3-day one at 3 or fewer — and
// each window ends where the next begins, so a run that was down for a week
// sends the ONE letter that is true today rather than three stale ones in a
// row. Every letter prints the real count, never the window's name.
//
// Each window has its own stamp on Company (trialReminder15At / 7At / 3At),
// claimed before the send and reverted when the send fails — the same
// claim-then-revert the grace warning uses, and for the same reason: a
// column whose job is "don't send twice" must never say "sent" about a letter
// Resend refused, or the company sails through the window in silence.
//
// Pure, so scripts/check-trial-reminders.mjs executes every boundary rather
// than reading it.

const DAY = 24 * 60 * 60 * 1000;

/** The windows, largest first. Each ends where the next begins. */
export const TRIAL_REMINDER_DAYS = [15, 7, 3];

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
 * @param stamps           { trialReminder15At, trialReminder7At, trialReminder3At }
 * @param now              injectable clock
 *
 * @returns { send: true, days, field, daysLeft, trialEndsAt }
 *        | { send: false, reason }
 */
export function trialReminderDecision({
  trialEndsAt,
  hasSubscription = false,
  isDemo = false,
  stamps = {},
  now = new Date(),
} = {}) {
  if (isDemo) return { send: false, reason: "demo" };
  if (hasSubscription) return { send: false, reason: "plan_chosen" };
  const end = trialEndsAt instanceof Date ? trialEndsAt : trialEndsAt ? new Date(trialEndsAt) : null;
  if (!end || Number.isNaN(end.getTime())) return { send: false, reason: "no_trial_end" };

  const msLeft = end.getTime() - now.getTime();
  // Over. The banner and the 402 sentence say what is true now
  // (lib/billing/access.js); a letter counting down to a date that has
  // passed is not a reminder.
  if (msLeft <= 0) return { send: false, reason: "trial_over" };
  const daysLeft = Math.ceil(msLeft / DAY);

  // The smallest window that holds today: 3 or fewer days → the 3-day
  // letter, 4–7 → the 7-day one, 8–15 → the 15-day one, more → nothing yet.
  const window = [...TRIAL_REMINDER_DAYS].reverse().find((d) => daysLeft <= d);
  if (!window) return { send: false, reason: "not_yet_in_window", daysLeft };

  const field = trialReminderField(window);
  if (stamps?.[field]) return { send: false, reason: "already_sent", days: window, daysLeft };

  return { send: true, days: window, field, daysLeft, trialEndsAt: end };
}
