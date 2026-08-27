// lib/referrals/extendAccess.js
//
// Give somebody another month of the product, wherever they are in their
// billing.
//
// ══ Why this replaces a balance credit ═════════════════════════════════════
//
// The referrer's reward used to be a Stripe customer-balance credit worth one
// month of the REFERRED company's plan. Three things were wrong with that, and
// the owner named the first:
//
//   * A referral is "you get a free month", not "you get $129 off". Those are
//     the same thing only while both companies are on the same tier — a Scale
//     referrer who introduces a Solo company was getting $129 against a $389
//     bill, which is a third of a month.
//   * Money off an invoice is invisible until the invoice arrives. On an annual
//     plan that is up to twelve months away.
//   * It was never granted at all: grantReferrerCredit hangs off the invoice
//     path and app/api/stripe/webhook/route.js has no invoice event, so the
//     function had never run. Two ReferralCredit rows exist and both are the
//     REFEREE's.
//
// ══ Two shapes of "another month", and both are the same promise ═══════════
//
// Not yet paying — still on trial. Push `Company.trialEndsAt` out. Simple, and
// it is what the referee side already does.
//
// Already paying. There is no trial to extend, so the month is taken off the
// next bill by moving the next charge instead: Stripe's own `trial_end` on a
// live subscription defers the next invoice to that date. Setting it to the
// current period end plus a month is exactly one free month, and it works
// identically on monthly and annual — which is the whole reason for choosing it
// over a coupon, since a coupon's percentage means a different amount on each
// cadence.
//
// Never shortens anything. Every path extends from whichever is LATER, so a
// second referral adds a second month rather than overwriting the first.

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Calendar months, with Jan 31 + 1 clamped to Feb 28/29 rather than March.
 *
 * ── UTC, deliberately, and the local version was wrong ────────────────────
 *
 * The first version used getDate/setMonth/setDate, which are LOCAL. Every date
 * here comes from Stripe as a UTC epoch, so on a machine west of Greenwich the
 * clamp measured a different calendar day than the one being stored: Jan 31 +
 * 1 month returned 2027-03-01T00:00Z while printing as "Feb 28" in Toronto.
 * That is a whole extra day of access for one subscriber and a day short for
 * another, decided by the timezone of whichever server ran the job.
 *
 * A month is a calendar step, so it cannot be 30 days of milliseconds either —
 * that drifts against every month that is not 30 days long, and against DST
 * twice a year.
 */
export function addMonths(date, months) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return d;
  const day = d.getUTCDate();
  const out = new Date(d);
  out.setUTCDate(1); // step the month with no risk of rolling past the end
  out.setUTCMonth(out.getUTCMonth() + months);
  // Last day of the target month, so 31 -> 28/29/30 rather than spilling over.
  const lastDay = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0),
  ).getUTCDate();
  out.setUTCDate(Math.min(day, lastDay));
  return out;
}

/**
 * WHEN their access should now run to. Pure, so the rule can be executed
 * against the owner's own worked example instead of reasoned about.
 *
 * ══ It always extends from the LATER of the two ════════════════════════════
 *
 * That is what makes referrals stack. The owner's case: an annual subscriber
 * whose year ends 27 Aug 2027 refers somebody, and gets to 27 Sep. They refer a
 * second, and get to 27 Oct — NOT back to 27 Sep, and not a second month bolted
 * onto the original 27 Aug. Once the first extension is in place Stripe reports
 * the subscription as trialing with `current_period_end` sitting on the new
 * date, so reading the period end and adding a month does the stacking on its
 * own.
 *
 * ══ And it never bills a fresh year to do it ═══════════════════════════════
 *
 * The month is a DEFERRAL of the next invoice, not a renewal. Nothing is
 * charged while it runs, and when it ends the normal cycle resumes — the
 * subscriber is not charged for another year in order to be given a free month
 * of the one they already bought.
 *
 * @param now       the clock, injected so the assertions are not date-dependent
 * @returns {{ base: Date, until: Date, from: "period"|"trial"|"now" }}
 */
export function nextAccessEnd({ trialEndsAt, periodEnd, paying, months = 1, now = new Date() }) {
  const add = Math.max(1, Math.round(Number(months) || 1));
  const at = (v) => {
    const d = v ? new Date(v) : null;
    return d && Number.isFinite(d.getTime()) ? d : null;
  };
  const t = at(now) || new Date();

  // A paying subscriber extends from the end of what they have already bought.
  // A trialling one extends from the end of the trial. Either way, a date in
  // the past is not a starting point — it would hand back less than a month.
  const anchorDate = paying ? at(periodEnd) : at(trialEndsAt);
  const from = anchorDate && anchorDate > t ? (paying ? "period" : "trial") : "now";
  const base = from === "now" ? t : anchorDate;

  return { base, until: addMonths(base, add), from };
}

/**
 * @returns {{ ok, via: "trial"|"subscription"|null, until: Date|null, reason? }}
 */
export async function extendAccessByMonths(companyId, months = 1) {
  const add = Math.max(1, Math.round(Number(months) || 1));
  if (!companyId) return { ok: false, via: null, until: null, reason: "no_company" };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, trialEndsAt: true },
  });
  if (!company) return { ok: false, via: null, until: null, reason: "not_found" };

  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { stripeSubscriptionId: true, status: true, currentPeriodEnd: true },
  });

  const now = new Date();
  const paying =
    sub?.stripeSubscriptionId &&
    ["active", "trialing", "past_due"].includes(String(sub.status));

  // ── Still on trial, or never subscribed ──────────────────────────────────
  if (!paying) {
    const { until } = nextAccessEnd({
      trialEndsAt: company.trialEndsAt,
      paying: false,
      months: add,
      now,
    });
    await db.company.update({ where: { id: companyId }, data: { trialEndsAt: until } });
    return { ok: true, via: "trial", until };
  }

  // ── Paying: defer the next invoice ───────────────────────────────────────
  //
  // Read the period end from STRIPE rather than from our row. Our
  // `currentPeriodEnd` is written by a webhook, and this whole feature exists
  // because a webhook that never fires leaves a column stale — extending from a
  // stale date would silently shorten somebody's reward, or hand them two.
  let periodEnd = sub.currentPeriodEnd;
  try {
    const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    if (live?.current_period_end) periodEnd = new Date(live.current_period_end * 1000);
  } catch (err) {
    console.error("[referrals] could not read the subscription:", err?.message);
  }

  const { until } = nextAccessEnd({ periodEnd, paying: true, months: add, now });

  try {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      trial_end: Math.floor(until.getTime() / 1000),
      // The month is a gift, not a plan change. Without this Stripe would
      // compute a proration for the deferred period and put it on the next
      // invoice — handing back with one hand what the other just gave.
      proration_behavior: "none",
    });
  } catch (err) {
    console.error("[referrals] could not extend the subscription:", err?.message);
    return { ok: false, via: "subscription", until: null, reason: err?.message };
  }

  await db.subscription
    .update({ where: { companyId }, data: { trialEndsAt: until } })
    .catch(() => {});
  return { ok: true, via: "subscription", until };
}
