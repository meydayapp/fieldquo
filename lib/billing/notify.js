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
import { buildBillingEmail, billingLetterWords, formatBillingDate } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { hasBillingEmailLanguage } from "@/lib/i18n/billingEmailCopy";
import { ownerLetterLanguage } from "@/lib/billing/billingLanguage";
import { fieldquoEndRefusal } from "@/lib/billing/access";

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
    // The reader's language (lib/billing/billingLanguage.js). The facts'
    // labels and the date come from the same catalogue as the sentences, so
    // a French letter has no English table in the middle of it.
    const language = await ownerLetterLanguage(companyId, hasBillingEmailLanguage);
    const w = billingLetterWords(language);
    const { subject, html } = buildBillingEmail({
      kind: firstTime ? "started" : "changed",
      companyName: sub.company?.name || w.yourCompany,
      planName: sub.plan.name,
      previousPlanName,
      facts: [
        [w["fact.plan"], sub.plan.name],
        ...(sub.plan.maxUsers ? [[w["fact.usersIncluded"], String(sub.plan.maxUsers)]] : []),
        ...(sub.status === "trialing" ? [[w["fact.status"], w["fact.freeTrial"]]] : []),
        ...(sub.currentPeriodEnd
          ? [[sub.status === "trialing" ? w["fact.trialEnds"] : w["fact.nextBilling"], formatBillingDate(sub.currentPeriodEnd, language)]]
          : []),
      ],
      billingUrl: `${origin}/app/settings/account-billing`,
      language,
    });

    const from = await getPlatformFrom();
    // FieldQuo's own letter to a tenant, so it still carries the tenant. A
    // seeded demo has no card and no real subscription, and mailing a live
    // address about the billing of a company that does not exist is the same
    // leak in a duller wrapper.
    const result = await sendEmail({ companyId, from, to, subject, html });

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
 * Tell a company their plan was cancelled — once per cancellation.
 *
 * ── Two kinds, two rules ────────────────────────────────────────────────────
 *
 * BOOKED (atPeriodEnd): a paid plan set to end on its paid-to date. Sent by
 * the cancel route alone, once per press — cancel, Resume, cancel again is two
 * decisions and each gets its confirmation. Nothing else sends this kind.
 *
 * ENDED (atPeriodEnd false): the plan has stopped. TWO callers send it for
 * the same event: app/api/platform/billing/cancel/route.js for a trial ended
 * on the spot (the person is waiting for it), and the customer.subscription.
 * deleted webhook (lib/platform/stripeBilling.js) that Stripe fires for that
 * very cancellation seconds later — and alone for a booked end on its date, a
 * portal cancel or dunning. This comment used to say "the caller fires it once
 * per cancellation request"; for an immediate cancel there were two callers,
 * and the company got the letter twice (scripts/check-billing-lifecycle-emails.mjs
 * replays the pair against the real route and the real webhook). The guard is
 * Subscription.cancellationNotifiedFor: the Stripe subscription id whose end
 * was confirmed, claimed before the send and restored if the send fails. A
 * Stripe subscription that ended never comes back — Checkout and Resume's
 * credited / charge-now paths make a new one — so cancel → resubscribe →
 * cancel still confirms twice.
 *
 * ── Not when FieldQuo ended it ──────────────────────────────────────────────
 *
 * Every version of this letter says "press Resume". A company FieldQuo locked
 * for a terms breach (Subscription.accessLockedAt) or ended from the console
 * (Company.platformEndsAt) cannot resume — checkout and resume refuse it
 * (lib/billing/access.js fieldquoEndRefusal) — so the letter would point at a
 * shut door. Skipped, with the reason returned.
 *
 * @param {object} [opts]
 * @param {Date}   [opts.periodEnd]    the date the plan runs to
 * @param {boolean}[opts.atPeriodEnd]  true when the plan is BOOKED to end on
 *                 that date and still works until then (a paid plan,
 *                 cancel/route.js); false when it ended on the spot (a trial,
 *                 or the customer.subscription.deleted webhook). Decides the
 *                 sentence: "ends on {date}; nothing more will be charged;
 *                 resume any time before then" versus "has been cancelled".
 *                 The old single sentence said "you'll keep access until
 *                 {date}" whenever a date was known — and for an immediate
 *                 cancellation the date known was the period end of a plan
 *                 that had just stopped, so the email promised weeks the
 *                 account did not have.
 */
export async function notifyCancellation(companyId, request, { periodEnd, atPeriodEnd = false } = {}) {
  let claimed = null;
  try {
    if (!companyId) return { sent: false };

    const sub = await db.subscription.findUnique({
      where: { companyId },
      select: {
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
        cancellationNotifiedFor: true,
        accessLockedAt: true,
        plan: { select: { name: true } },
        company: { select: { name: true, email: true, platformEndsAt: true, platformEndMode: true } },
      },
    });

    if (fieldquoEndRefusal(sub?.company, sub)) return { sent: false, reason: "ended_by_fieldquo" };

    const to = sub?.company?.email || (await ownerEmailFor(companyId));
    if (!to) return { sent: false, reason: "no recipient" };

    // ── One "ended" letter per Stripe subscription ──────────────────────────
    // Claimed on the row before the send, so the route and the webhook racing
    // each other cannot both pass. A row with no Stripe id has nothing to key
    // on and is not guarded (the route never calls this without one).
    const key = !atPeriodEnd ? sub?.stripeSubscriptionId || null : null;
    if (key) {
      const claim = await db.subscription.updateMany({
        where: {
          companyId,
          OR: [{ cancellationNotifiedFor: null }, { cancellationNotifiedFor: { not: key } }],
        },
        data: { cancellationNotifiedFor: key },
      });
      if (claim.count === 0) return { sent: false, reason: "already_notified" };
      claimed = { key, previous: sub.cancellationNotifiedFor ?? null };
    }

    // Only a booked end has a date worth stating: an immediate cancellation
    // has no "until".
    const end = atPeriodEnd ? periodEnd || sub?.currentPeriodEnd || null : null;
    const origin = request ? getAppOrigin(request) : "https://www.fieldquo.com";
    const language = await ownerLetterLanguage(companyId, hasBillingEmailLanguage);
    const w = billingLetterWords(language);
    const { subject, html } = buildBillingEmail({
      kind: "cancelled",
      companyName: sub?.company?.name || w.yourCompany,
      planName: sub?.plan?.name || null,
      periodEnd: end ? formatBillingDate(end, language) : null,
      atPeriodEnd: Boolean(atPeriodEnd && end),
      billingUrl: `${origin}/app/settings/account-billing`,
      language,
    });

    const from = await getPlatformFrom();
    // FieldQuo's own letter to a tenant, so it still carries the tenant. A
    // seeded demo has no card and no real subscription, and mailing a live
    // address about the billing of a company that does not exist is the same
    // leak in a duller wrapper.
    const result = await sendEmail({ companyId, from, to, subject, html });
    if (result?.error || result?.skipped) {
      await releaseCancellationClaim(companyId, claimed);
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
    await releaseCancellationClaim(companyId, claimed);
    await recordError({
      area: "billing-email",
      message: `Cancellation confirmation failed: ${err?.message}`,
      companyId,
    });
    return { sent: false, reason: err?.message };
  }
}

/**
 * Put the guard back the way it was when a claimed letter did not go — only
 * while the row still holds THIS claim, so a newer cancellation's claim made
 * in the meantime is never undone. Never throws.
 */
async function releaseCancellationClaim(companyId, claimed) {
  if (!claimed) return;
  await db.subscription
    .updateMany({
      where: { companyId, cancellationNotifiedFor: claimed.key },
      data: { cancellationNotifiedFor: claimed.previous },
    })
    .catch(() => {});
}
