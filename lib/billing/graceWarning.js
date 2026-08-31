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
// ══ Two notices, same shape as the number-release path ══════════════════════
//
// Product decision (owner, after review): TWO notices, not one — and built to
// the exact pattern lib/voice/spendGate.js's rentDecision() already uses for
// releasing an unpaid phone number: `grace_start` the moment the grace period
// opens, `grace_remind` once as it's about to run out, and `grace_wait` for
// the silence in between so nobody gets a daily nag. This file uses the same
// three action names on purpose — a reader who already knows rentDecision's
// vocabulary should recognise this immediately as the same pattern applied to
// a bigger stake (every quote and invoice, not one phone number), not a
// fourth, subtly different scheme to learn.
//
// Unlike rentDecision's `grace_remind`, this one does NOT repeat every few
// days — it fires once, close to the end. Two notices for a seven-day window
// is the whole shape; a daily reminder would be exactly the nag `grace_wait`
// exists to prevent.
//
// The dedupe has to carry WHICH notice went out, not just that "a" notice
// did — a single timestamp cannot distinguish "warned at the start" from
// "warned again near the end", and guessing from a date comparison against
// one column is exactly the kind of fake dedupe that looks right until a
// relapse or an odd cron gap proves it isn't. So there are two columns on
// Subscription: `graceWarnedAt` for grace_start, and `graceFinalWarnedAt` for
// grace_remind. Both are nulled by clearPastDue() on recovery, so a relapse
// gets both notices again rather than inheriting "already warned" from a
// payment problem that was fixed.
//
// The `grace_remind` threshold — 2 days left — is not invented for this
// file. It's the exact point app/components/layout/BillingBanner.js already
// treats as "urgent" (red chrome instead of amber) for the same daysLeft
// number. Reusing it means the email and the in-app banner agree on when
// things get serious, rather than each drawing its own line.
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
// ══ Tone lives at the email layer, not here ═════════════════════════════════
//
// This file only decides WHETHER and WHEN. The register — empathetic, no
// urgency language, no capitals, reads like a competent adult who is about to
// fix this in ninety seconds rather than someone being chased for money — is
// lib/email/billingEmail.js's "grace" kind. See that file for why.
//
// ══ Pure, on purpose ══════════════════════════════════════════════════════
//
// A status, a date, two markers, a clock — no database, no email client — so
// every branch (already warned once, already warned twice, grace already
// expired before anyone noticed, a relapse after recovery) is something
// scripts/check-grace-warning.mjs can execute directly. See rentDecision for
// the same shape and the same reasoning for why it matters.

import { accessFor, GRACE_DAYS } from "@/lib/billing/access";

const DAY = 24 * 60 * 60 * 1000;

/**
 * How close to lockout the SECOND notice (grace_remind) fires, in days
 * remaining.
 *
 * Matches BillingBanner's own "urgent" threshold for the same daysLeft value
 * — see the file header. Not derived from GRACE_DAYS by some fraction, because
 * the number that matters is "how many days does someone realistically need
 * to notice this and act", not a proportion of the window.
 */
export const REMIND_AT_OR_BELOW_DAYS = 2;

/**
 * What should happen to this subscription's grace-warning email today?
 *
 * Pure: a status, a date, two markers, a clock.
 *
 * @param status               Subscription.status, checked literally
 * @param pastDueSince         Subscription.pastDueSince (Date|null)
 * @param graceWarnedAt        Subscription.graceWarnedAt (Date|null) — grace_start already sent?
 * @param graceFinalWarnedAt   Subscription.graceFinalWarnedAt (Date|null) — grace_remind already sent?
 * @param now                  injectable clock
 *
 * @returns { action, reason?, daysLeft?, since?, lockAt? }
 *   grace_start   send the heads-up — grace just opened, first time this episode
 *   grace_remind  send the one reminder — inside the final window, not yet sent
 *   grace_wait    already said what's due to be said for where they are right now
 *   skip          not a situation this email is about at all
 *
 * `lockAt` (on grace_start/grace_remind/grace_wait) is when the account
 * actually locks — `since + GRACE_DAYS` — so the email layer can state a real
 * date ("your account locks on the 14th") rather than only a relative count.
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
  const lockAt = new Date(since.getTime() + GRACE_DAYS * DAY);

  if (!graceWarnedAt) {
    return { action: "grace_start", daysLeft, since, lockAt };
  }

  if (!graceFinalWarnedAt && daysLeft <= REMIND_AT_OR_BELOW_DAYS) {
    return { action: "grace_remind", daysLeft, since, lockAt };
  }

  return {
    action: "grace_wait",
    reason: graceFinalWarnedAt ? "both_sent" : "not_yet_final_window",
    daysLeft,
    since,
    lockAt,
  };
}
