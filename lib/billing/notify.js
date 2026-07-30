// lib/billing/notify.js
//
// Sends the subscription confirmation emails, once.
//
// ── Why idempotency lives here and not at the call sites ───────────────────
//
// Three things can now produce "this company's subscription changed": the Stripe
// webhook, the on-return reconcile after Checkout, and the "Check with Stripe"
// button. That is deliberate — one asynchronous webhook was the single point of
// failure that let a paying company see "No active plan". But it means the same
// change can be observed two or three times within seconds, and a company that
// gets three "you're subscribed" emails for one payment has been told the system
// is broken.
//
// So the guard is in one place, keyed on the database, and every caller can fire
// freely without knowing about the others.
//
// ── Never throws ───────────────────────────────────────────────────────────
//
// Called after a subscription write that has already committed. An email problem
// must not roll that back, and must not make Stripe retry the webhook — a retry
// would re-run the write, not fix the mailbox. Failures are logged where support
// can see them.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildBillingEmail } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { formatDateOnly } from "@/lib/format/companyDate";

/**
 * Tell a company their subscription started or changed.
 *
 * Decides WHICH message from the stored notification state, so callers don't
 * have to know whether this is a first subscription or a plan switch.
 *
 * @param companyId
 * @param request  optional, only to derive the app origin for the CTA link
 */
export async function notifySubscriptionState(companyId, request) {
  try {
    if (!companyId) return { sent: false, reason: "no company" };

    const sub = await db.subscription.findUnique({
      where: { companyId },
      select: {
        status: true,
        planId: true,
        currentPeriodEnd: true,
        welcomeEmailSentAt: true,
        notifiedPlanId: true,
        plan: { select: { id: true, name: true, maxUsers: true } },
        company: { select: { name: true, email: true } },
      },
    });
    if (!sub?.plan) return { sent: false, reason: "no plan" };

    // Only for a subscription that is actually live. A past_due or cancelled row
    // arriving here would otherwise send a welcome for something that isn't on.
    if (!["active", "trialing"].includes(sub.status)) {
      return { sent: false, reason: `status ${sub.status}` };
    }

    const firstTime = !sub.welcomeEmailSentAt;
    const planChanged = !firstTime && sub.notifiedPlanId !== sub.planId;

    if (!firstTime && !planChanged) {
      return { sent: false, reason: "already notified for this plan" };
    }

    const to = sub.company?.email || (await ownerEmailFor(companyId));
    if (!to) {
      // Worth recording: a company with no reachable address gets no billing
      // confirmations at all, and nobody would otherwise find out.
      await recordError({
        area: "billing-email",
        message: "No address to send the subscription confirmation to",
        companyId,
      });
      return { sent: false, reason: "no recipient" };
    }

    const previousPlanName = planChanged && sub.notifiedPlanId
      ? (
          await db.plan.findUnique({
            where: { id: sub.notifiedPlanId },
            select: { name: true },
          })
        )?.name || null
      : null;

    const origin = request ? getAppOrigin(request) : "https://www.fieldquo.com";
    const { subject, html } = buildBillingEmail({
      kind: firstTime ? "started" : "changed",
      companyName: sub.company?.name || "Your company",
      planName: sub.plan.name,
      previousPlanName,
      facts: [
        ["Plan", sub.plan.name],
        ...(sub.plan.maxUsers ? [["Users included", String(sub.plan.maxUsers)]] : []),
        ...(sub.status === "trialing" ? [["Status", "Free trial"]] : []),
        ...(sub.currentPeriodEnd
          ? [[sub.status === "trialing" ? "Trial ends" : "Next billing date", formatDateOnly(sub.currentPeriodEnd)]]
          : []),
      ],
      billingUrl: `${origin}/app/settings/account-billing`,
    });

    const from = await getPlatformFrom();
    const result = await sendEmail({ from, to, subject, html });

    // sendEmail never throws — it returns { skipped } with no API key and
    // { error } when Resend rejects. Checking the RESULT matters: writing the
    // sent-marker on a rejected send would permanently suppress a confirmation
    // that never arrived.
    if (result?.error) return { sent: false, reason: "resend rejected" };
    if (result?.skipped) return { sent: false, reason: "no api key" };

    // Marked AFTER a successful send. Marking first would mean a transient
    // Resend failure permanently suppressed the email.
    await db.subscription.update({
      where: { companyId },
      data: {
        ...(firstTime ? { welcomeEmailSentAt: new Date() } : {}),
        notifiedPlanId: sub.planId,
      },
    });

    return { sent: true, kind: firstTime ? "started" : "changed" };
  } catch (err) {
    await recordError({
      area: "billing-email",
      code: err?.name || null,
      message: `Subscription confirmation failed: ${err?.message}`,
      companyId,
    });
    return { sent: false, reason: err?.message };
  }
}

/**
 * Tell a company their plan was cancelled.
 *
 * Not idempotency-guarded on a column: cancelling twice is a thing a person does
 * deliberately (cancel, resubscribe, cancel again) and each one deserves its own
 * confirmation. The caller fires it once per cancellation request.
 */
export async function notifyCancellation(companyId, request, { periodEnd } = {}) {
  try {
    if (!companyId) return { sent: false };

    const sub = await db.subscription.findUnique({
      where: { companyId },
      select: {
        currentPeriodEnd: true,
        plan: { select: { name: true } },
        company: { select: { name: true, email: true } },
      },
    });

    const to = sub?.company?.email || (await ownerEmailFor(companyId));
    if (!to) return { sent: false, reason: "no recipient" };

    const end = periodEnd || sub?.currentPeriodEnd || null;
    const origin = request ? getAppOrigin(request) : "https://www.fieldquo.com";
    const { subject, html } = buildBillingEmail({
      kind: "cancelled",
      companyName: sub?.company?.name || "Your company",
      planName: sub?.plan?.name || null,
      periodEnd: end ? formatDateOnly(end) : null,
      billingUrl: `${origin}/app/settings/account-billing`,
    });

    const from = await getPlatformFrom();
    const result = await sendEmail({ from, to, subject, html });
    if (result?.error || result?.skipped) {
      return { sent: false, reason: result.error ? "resend rejected" : "no api key" };
    }

    // Clear the welcome marker so resubscribing sends a fresh confirmation
    // rather than being treated as "already notified".
    await db.subscription
      .update({
        where: { companyId },
        data: { welcomeEmailSentAt: null, notifiedPlanId: null },
      })
      .catch(() => {});

    return { sent: true };
  } catch (err) {
    await recordError({
      area: "billing-email",
      message: `Cancellation confirmation failed: ${err?.message}`,
      companyId,
    });
    return { sent: false, reason: err?.message };
  }
}
