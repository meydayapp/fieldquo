// lib/billing/graceWarning.js
//
// Should a past-due company be told, today, that its account is read-only?
//
// ══ The defect this closes ══════════════════════════════════════════════════
//
// Subscription.graceWarnedAt has carried this doc comment since before any
// code read or wrote it meaningfully: "Set when the 'you have N days left'
// email goes out, so the daily job doesn't send it again every morning." The
// daily job never existed. clearPastDue() and the reconcile route both null
// the column on recovery, which is the dedupe contract working backwards —
// there was never a forward write to undo. A card fails, lib/billing/access.js
// drops the company into 7 days of read-only, and the product says nothing.
// They find out by hitting a wall.
//
// ══ One warning, or two? ═════════════════════════════════════════════════════
//
// lib/voice/spendGate.js's rentDecision() warns MORE than once before it takes
// away a $4/month phone number: warn_soon a few days ahead, grace_start the
// day it actually lapses, then grace_remind every few days until release.
// Losing every quote, invoice and client record for up to seven days is a
// bigger stake than a phone number, so the same reasoning argues for at LEAST
// as much warning, not less — one email sent the moment the card fails and
// then silence for a week is exactly the kind of warning that gets buried
// under Monday's inbox and never seen again until the lock lands.
//
// So: two warnings, not one. A FIRST one as soon as the episode starts (the
// heads-up, while there's still most of a week to fix it), and a FINAL one
// close to the end (the last real chance to act before it's too late). Two
// timestamps, not one, because a single `graceWarnedAt` can only dedupe a
// single send — the task this file exists to satisfy needs to know WHICH
// warning already went out, not just that "a" warning did. That's the whole
// reason graceFinalWarnedAt exists as its own column rather than this file
// reusing graceWarnedAt for both and losing the ability to send the second.
//
// The final threshold — 2 days left — is not invented for this file. It's
// the exact point app/components/layout/BillingBanner.js already treats as
// "urgent" (red chrome instead of amber) for the same daysLeft number. Reusing
// it means the email and the in-app banner agree on when things get serious,
// rather than each drawing its own line.
//
// ══ Cancelled is a different situation ═══════════════════════════════════════
//
// This only ever acts on Subscription.status === "past_due", checked first
// and literally, not inferred from accessFor()'s daysLeft math. accessFor()
// falls through to the past_due branch for ANY status that isn't
// active/trialing/canceled — which is the right default for "how much access
// do they get" but the wrong one for "should we say their payment failed",
// because an unrecognised status is not evidence a payment failed. Cancelled
// gets its OWN longer window and its own meaning (lib/billing/access.js) and
// must never be told "your payment didn't go through" — they didn't try to
// pay, they chose to leave, and telling them otherwise reads as a bug or a
// threat (see denyReason's cancelled-vs-past_due split, same reasoning here).
//
// ══ Pure, on purpose ══════════════════════════════════════════════════════
//
// A status, a date, two markers, a clock — no database, no email client — so
// every branch (already warned once, already warned twice, grace already
// expired before anyone noticed, a relapse after recovery) is something
// scripts/check-grace-warning.mjs can execute directly. See rentDecision for
// the same shape and the same reasoning for why it matters.

import { accessFor } from "@/lib/billing/access";

/**
 * How close to lockout the SECOND warning fires, in days remaining.
 *
 * Matches BillingBanner's own "urgent" threshold for the same daysLeft value
 * — see the file header. Not derived from GRACE_DAYS by some fraction, because
 * the number that matters is "how many days does someone realistically need
 * to notice this and act", not a proportion of the window.
 */
export const FINAL_WARNING_AT_OR_BELOW_DAYS = 2;

/**
 * What should happen to this subscription's grace-warning email today?
 *
 * Pure: a status, a date, two markers, a clock.
 *
 * @param status               Subscription.status, checked literally
 * @param pastDueSince         Subscription.pastDueSince (Date|null)
 * @param graceWarnedAt        Subscription.graceWarnedAt (Date|null) — first warning sent?
 * @param graceFinalWarnedAt   Subscription.graceFinalWarnedAt (Date|null) — final warning sent?
 * @param now                  injectable clock
 *
 * @returns { action, reason?, daysLeft?, since? }
 *   warn_first   send the heads-up — first time this episode
 *   warn_final   send the last-chance notice — inside the final window, not yet sent
 *   wait         already said what's due to be said for where they are right now
 *   skip         not a situation this email is about at all
 */
export function graceWarningDecision({
  status,
  pastDueSince,
  graceWarnedAt,
  graceFinalWarnedAt,
  now = new Date(),
}) {
  // ── Only status === "past_due", literally ─────────────────────────────
  //
  // Not "whatever accessFor() would treat as a grace period" — see the file
  // header. A cancelled subscription must never receive this email, and
  // naming it explicitly here (rather than trusting accessFor's fallthrough)
  // means a future unrecognised status defaults to silence, not to a
  // false "your payment didn't go through".
  if (status === "canceled") {
    return { action: "skip", reason: "cancelled_different_situation" };
  }
  if (status !== "past_due") {
    return { action: "skip", reason: `not_past_due_${status || "none"}` };
  }

  // The exact same math the actual gate uses (lib/billing/access.js), so the
  // email can never disagree with what accessFor() is about to enforce on
  // the same request. A null pastDueSince starts the clock now, same as
  // there — the missing date is a bug in this codebase, not the company's.
  const access = accessFor({ status: "past_due", pastDueSince }, now);

  // ── Grace already ran out before anyone warned ─────────────────────────
  //
  // JUDGEMENT CALL: skip, not "send whatever wasn't sent yet". Once the
  // account is locked, denyReason() already tells them on every write
  // attempt that they're locked and that nothing has been deleted — that IS
  // the notice at this point, delivered the moment they next touch the
  // product, which is more timely than an email about a window that has
  // already closed. An email reading "you have 0 days left" is not a
  // warning, it's a delayed obituary for one, and sending it would be the
  // same failure class as the cancelled-subscription case: a true-sounding
  // sentence that describes something that already happened as if it were
  // still actionable.
  if (access.level === "locked") {
    return { action: "skip", reason: "grace_expired" };
  }

  const { daysLeft, since } = access;

  if (!graceWarnedAt) {
    return { action: "warn_first", daysLeft, since };
  }

  if (!graceFinalWarnedAt && daysLeft <= FINAL_WARNING_AT_OR_BELOW_DAYS) {
    return { action: "warn_final", daysLeft, since };
  }

  return {
    action: "wait",
    reason: graceFinalWarnedAt ? "both_sent" : "not_yet_final_window",
    daysLeft,
  };
}
