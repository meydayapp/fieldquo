// lib/ai/digestAudience.js
//
// Which companies get the monthly summary (app/api/cron/monthly-digest), and
// whether a trial company's month had anything in it.
//
// ══ The bug this replaces ═══════════════════════════════════════════════════
//
// The cron selected `onboardingStatus: "active"`, and the only writer of
// "active" is Stripe Checkout (lib/platform/stripeBilling.js, the
// checkout.session.completed upsert). Since 2026-09-29 a new company starts a
// 14-day trial with no card and no Checkout at all, so every card-free trial
// was silently left off the list — the companies with the most to learn from
// their first month never got the email that summarises it.
//
// ══ The rule, from lib/billing/access.js — not from a status column ════════
//
//   SEND   a Subscription that is `active` or `trialing` (a chosen plan, in
//          its free first month or paid);
//          a Subscription that is `past_due` and still inside the GRACE_DAYS
//          read-only window — the card failed, the company has not left, and
//          the summary shows the money its clients owe it while it sorts the
//          card out (the old rule sent it too: past_due companies kept
//          onboardingStatus "active");
//          no Subscription and a trial still running (trialAccessFor →
//          "trial_no_plan");
//          no Subscription, no trial date, and onboardingStatus "active" — a
//          company made by hand, which the old rule reached and this one
//          keeps reaching.
//   SKIP   a demo (isDemo);
//          anything FieldQuo ended or locked (Company.platformEndsAt in any
//          mode, Subscription.accessLockedAt) — the company did not choose to
//          stop hearing from us, but a business report to an account FieldQuo
//          closed reads as the closure not having happened;
//          a cancelled plan, an expired grace window, an ended trial;
//          a company that did not exist yet when the month ended.
//
// ══ A trial month with nothing in it: no email ══════════════════════════════
//
// A trial company that recorded no lead, sent no quote, completed no job,
// invoiced nothing, was paid nothing and logged no marketing spend gets NO
// summary for that month. The alternative was a short "nothing yet" letter;
// it was rejected because the email's whole layout is figures, and a page of
// "no invoices yet / no payments yet / 0 leads" in the house style IS the
// page of zeros dressed as a report — and a nudge to start using the product
// is the onboarding sequence's job (another agent's, 2026-10-11), not the
// monthly report's. A paying company still gets its quiet-month letter
// ("A quiet October: no payments, invoices or new leads were recorded"): for
// a business that has been running, a quiet month is itself the news. Nothing
// is created for a skipped month — no AiDigest row, no model call, no charge.
//
// Pure, so scripts/check-lifecycle-emails.mjs executes every branch.

import { accessFor, trialAccessFor, fieldquoEndAccessFor, FIELDQUO_END_SELECT } from "@/lib/billing/access";

/** The Company columns digestAudience reads. One list, so the cron cannot forget one. */
export const DIGEST_AUDIENCE_SELECT = Object.freeze({
  id: true,
  isDemo: true,
  onboardingStatus: true,
  trialEndsAt: true,
  createdAt: true,
  ...FIELDQUO_END_SELECT,
  subscription: {
    select: {
      status: true,
      pastDueSince: true,
      canceledAt: true,
      cancelAtPeriodEnd: true,
      cancelAt: true,
      currentPeriodEnd: true,
      accessLockedAt: true,
    },
  },
});

/**
 * The query's own narrowing — every company that COULD be in the audience,
 * so the per-row rule below is not run over every abandoned signup ever made.
 * Wider than the rule on purpose (a past_due row past its grace is dropped
 * per row); never narrower.
 */
export function digestAudienceWhere(now = new Date()) {
  return {
    isDemo: false,
    platformEndsAt: null,
    OR: [
      { subscription: { is: { status: { in: ["active", "trialing", "past_due"] }, accessLockedAt: null } } },
      { subscription: { is: null }, trialEndsAt: { gt: now } },
      { subscription: { is: null }, trialEndsAt: null, onboardingStatus: "active" },
    ],
  };
}

/**
 * Is this company in the monthly summary's audience right now?
 *
 * @param company     a row selected with DIGEST_AUDIENCE_SELECT
 * @param periodEnd   the last instant of the month being reported
 * @param now         injectable clock
 * @returns {{ send: true, trial: boolean, reason } | { send: false, reason }}
 *          `trial` decides whether an empty month is skipped (see header).
 */
export function digestAudience(company, { periodEnd = null, now = new Date() } = {}) {
  if (!company) return { send: false, reason: "no_company" };
  if (company.isDemo) return { send: false, reason: "demo" };
  if (fieldquoEndAccessFor(company, now)) return { send: false, reason: "ended_by_fieldquo" };

  // Signed up after the month closed: the month is not theirs to report.
  const created = company.createdAt ? new Date(company.createdAt) : null;
  if (periodEnd && created && !Number.isNaN(created.getTime()) && created.getTime() > new Date(periodEnd).getTime()) {
    return { send: false, reason: "joined_after_period" };
  }

  const sub = company.subscription || null;
  if (sub) {
    const access = accessFor(sub, now);
    if (access.reason === "terms") return { send: false, reason: "locked_by_fieldquo" };
    if (sub.status === "active" || sub.status === "trialing") {
      return { send: true, trial: sub.status === "trialing", reason: sub.status };
    }
    if (access.reason === "past_due" && access.level === "readonly") {
      return { send: true, trial: false, reason: "past_due_grace" };
    }
    return { send: false, reason: access.reason || `status_${sub.status}` };
  }

  const trial = trialAccessFor(company, now);
  if (trial) {
    return trial.reason === "trial_no_plan" && trial.level === "full"
      ? { send: true, trial: true, reason: "trial_no_plan" }
      : { send: false, reason: trial.reason };
  }
  return company.onboardingStatus === "active"
    ? { send: true, trial: false, reason: "no_subscription_active" }
    : { send: false, reason: "no_plan_no_trial" };
}

/**
 * Did anything happen in the reported month?
 *
 * Read off the summary lib/analytics/monthlySummary.js already built — the
 * same figures the email prints, so "nothing to report" and "the email would
 * print nothing" cannot disagree. Anything at all counts: one lead, one quote
 * sent, one job completed, one invoice, one payment, one dollar of spend.
 */
export function monthHasActivity(summary) {
  if (!summary) return false;
  const t = summary.tiles || {};
  const n = (m) => (m && m.available ? Number(m.value) || 0 : 0);
  const count = (m) => (m && m.available ? Number(m.count) || 0 : 0);
  if (n(t.invoiced) > 0 || count(t.invoiced) > 0) return true;
  if (n(t.collected) > 0 || count(t.collected) > 0) return true;
  if (n(t.leads) > 0 || n(t.quotesSent) > 0 || n(t.quotesAccepted) > 0 || n(t.jobs) > 0) return true;
  if (n(t.spend) > 0) return true;
  if ((summary.funnel || []).some((s) => Number(s?.count) > 0)) return true;
  return false;
}
