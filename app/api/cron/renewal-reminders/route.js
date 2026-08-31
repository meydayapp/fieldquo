// app/api/cron/renewal-reminders/route.js
//
// Daily: warn a company before FieldQuo charges its card for the next period.
//
// ══ Why this needs to exist at all ══════════════════════════════════════════
//
// See lib/billing/renewalReminder.js for the citations behind the two
// windows (7 days monthly, 30 days annual) and the ONE thing this repo cannot
// verify from inside itself: Stripe can send its OWN "upcoming renewal" email
// — a fixed, uncustomisable 7-days-before notice, toggled on or off for every
// customer at once in Settings → Billing → Subscriptions and emails. If that
// toggle is on, a monthly company gets Stripe's notice AND this one on the
// same day. See docs/VERCEL.md for exactly what to check.
//
// This is NOT a duplicate of that toggle even where the timing lines up:
// Stripe's version isn't branded, doesn't know about the annual window at
// all (it always fires at 7 days, which is outside California's 15–45-day
// requirement for a one-year term), and doesn't say the card's last four.
// The fix for the overlap is turning Stripe's OFF, not building a worse
// version of this cron.
//
// ══ Daily, not hourly ═══════════════════════════════════════════════════════
//
// review-requests and appointment-reminders run hourly because their windows
// are measured in hours. This one's windows are 7 and 30 DAYS — a company
// that's due is still due an hour from now, and daily is what every SaaS
// renewal-email guide describes besides.
//
// ══ Claim, send, and — unlike review-requests — REVERT on failure ═════════
//
// review-requests claims before sending and accepts that a failed send never
// gets retried, because asking a happy customer for a review twice is worse
// than not asking once. That trade is wrong here: this email exists to
// satisfy a notice REQUIREMENT with a multi-day window behind it, so a
// Resend hiccup on day 7 of a 30-day window must not permanently suppress
// the one email whose whole point is "you were told in advance". So the claim
// is provisional — set before the send to stop a concurrent run colliding —
// and rolled back to whatever it was before if the send didn't actually
// happen, so tomorrow's run (or the day after) tries again for the same
// period, right up until the window closes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildBillingEmail } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { cardLastFourForSubscription } from "@/lib/platform/stripeBilling";
import { chargeFor } from "@/lib/billing/interval";
import { formatMoney } from "@/lib/currency";
import { formatDateOnly } from "@/lib/format/companyDate";
import { getAppOrigin } from "@/lib/appUrl";
import { decideRenewalReminder, RENEWAL_WINDOW_DAYS } from "@/lib/billing/renewalReminder";

// Generous — the work per row is one Stripe read and at most one email, the
// same shape as voice-rent's BATCH. A company list longer than this doesn't
// exist yet; leftovers are picked up by tomorrow's run, not dropped, because
// the query is driven by state (status + date), not a cursor.
const BATCH = 500;

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const origin = getAppOrigin(request);
  // The widest window in play (annual). Narrowing the query to "renews within
  // the next 30 days" is purely so the cron reads active/trialing subscriptions
  // due soon instead of every subscription in the database; the exact
  // per-cadence decision still happens in decideRenewalReminder below.
  const widestWindowDays = Math.max(...Object.values(RENEWAL_WINDOW_DAYS));
  const horizon = new Date(now.getTime() + widestWindowDays * 24 * 60 * 60 * 1000);

  const subscriptions = await db.subscription.findMany({
    where: {
      status: { in: ["active", "trialing"] },
      currentPeriodEnd: { not: null, lte: horizon },
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      billingInterval: true,
      currentPeriodEnd: true,
      renewalRemindedPeriodEnd: true,
      renewalReminderSentAt: true,
      stripeSubscriptionId: true,
      plan: { select: { name: true, priceMonthly: true, priceAnnual: true } },
      company: { select: { id: true, name: true, email: true, currency: true } },
    },
    take: BATCH,
  });

  let sent = 0;
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const sub of subscriptions) {
    const decision = decideRenewalReminder({
      status: sub.status,
      billingInterval: sub.billingInterval,
      currentPeriodEnd: sub.currentPeriodEnd,
      renewalRemindedPeriodEnd: sub.renewalRemindedPeriodEnd,
      now,
    });
    if (!decision.send) { note(decision.reason); continue; }

    // The amount comes from the PLAN, on the cadence the row is actually
    // billed on — the same authority lib/platform/stripeBilling.js's
    // checkout builders use, per the "browser never sends money amounts"
    // rule extended to its logical conclusion: neither does a guess. A plan
    // that cannot be charged on its own recorded interval (a data problem,
    // not a normal state — recurringLine() refuses to create one) gets
    // logged and skipped rather than emailing an invented figure.
    const charge = chargeFor(sub.plan, sub.billingInterval);
    if (!charge) {
      await recordError({
        area: "billing-email",
        code: "renewal_reminder_no_price",
        message: `Subscription ${sub.id} is billed "${sub.billingInterval}" but plan "${sub.plan?.name}" has no price for that interval`,
        companyId: sub.companyId,
      });
      note("plan_missing_price_for_interval");
      continue;
    }

    // ── Claim (provisional) ───────────────────────────────────────────────
    const previous = {
      renewalRemindedPeriodEnd: sub.renewalRemindedPeriodEnd,
      renewalReminderSentAt: sub.renewalReminderSentAt,
    };
    const claim = await db.subscription.updateMany({
      where: {
        id: sub.id,
        OR: [
          { renewalRemindedPeriodEnd: null },
          { renewalRemindedPeriodEnd: { not: decision.periodEnd } },
        ],
      },
      data: { renewalRemindedPeriodEnd: decision.periodEnd, renewalReminderSentAt: now },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }

    const to = sub.company?.email || (await ownerEmailFor(sub.companyId));
    if (!to) {
      await db.subscription.update({ where: { id: sub.id }, data: previous });
      note("no_recipient");
      continue;
    }

    const last4 = await cardLastFourForSubscription(sub.stripeSubscriptionId);
    const { subject, html } = buildBillingEmail({
      kind: "renewal",
      companyName: sub.company?.name || "Your company",
      planName: sub.plan.name,
      periodEnd: formatDateOnly(decision.periodEnd),
      renewalAmount: formatMoney(charge.amount, sub.company?.currency),
      last4,
      billingUrl: `${origin}/app/settings/account-billing`,
    });

    const from = await getPlatformFrom();
    // sendEmail never throws — { id } | { error } | { skipped } — so the
    // three outcomes need checking, not a try/catch (AGENTS.md recurring
    // failure class #2).
    const result = await sendEmail({ from, to, subject, html });

    if (result?.error || result?.skipped) {
      // ── Revert the claim ──────────────────────────────────────────────
      //
      // This is the divergence from review-requests described at the top of
      // the file: a send that didn't happen must not look like one that did,
      // or tomorrow's run (still inside the window) would skip it forever.
      await db.subscription.update({ where: { id: sub.id }, data: previous });
      note(result.error ? "resend_rejected" : "no_api_key");
      continue;
    }

    sent++;
  }

  return NextResponse.json({ success: true, considered: subscriptions.length, sent, ...skipped });
}
