// app/api/platform/billing/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { cancelSubscription } from "@/lib/platform/stripeBilling";
import { notifyCancellation } from "@/lib/billing/notify";
import { recordActivity } from "@/lib/activity/log";
import { isValidReason } from "@/lib/billing/retention";

// Self-serve cancellation — uses your existing cancelSubscription() helper.
// Cancels at Stripe immediately; your webhook's subscription.updated /
// deleted handling (wherever that lives) should be what actually flips
// Subscription.status in the DB, same as account.updated does for Connect.
// This route doesn't touch the DB directly to avoid the two getting out of
// sync with what Stripe actually did.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Owner/admin, not "user:manage" — that permission is held by supervisors,
  // whose job is scheduling people, not ending the company's subscription.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
  });

  if (!subscription?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No active subscription to cancel" },
      { status: 400 },
    );
  }

  // Why they're leaving, if the save flow collected it. The single most
  // valuable field in the billing tables and the one nobody remembers to
  // collect — by the time you want it, they're gone and you can't ask.
  const body = await request.json().catch(() => ({}));
  const reason = isValidReason(body?.reason) ? body.reason : null;
  const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : null;

  try {
    const cancelled = await cancelSubscription(subscription.stripeSubscriptionId);

    if (reason || note) {
      await db.subscription.update({
        where: { companyId: member.companyId },
        data: {
          cancelReason: [reason, note].filter(Boolean).join(" — "),
          // canceledAt is NOT set here. It starts the 30-day read-only window,
          // and the cancellation may not have taken effect yet — Stripe often
          // cancels at period end, and they keep full access until then because
          // they paid for it. customer.subscription.deleted stamps it when it
          // actually happens.
        },
      }).catch(() => {
        // Never fail a cancellation over analytics. They asked to leave; the
        // one thing that must work is leaving.
      });
    }

    // Stripe's customer.subscription.deleted webhook is the authority and also
    // sends this, but a company whose webhook isn't configured would otherwise
    // cancel and hear nothing at all. notifyCancellation is cheap and this is
    // the moment the person is actually waiting for confirmation.
    //
    // The status write stays with the webhook (see the note above) — this only
    // sends the email.
    await notifyCancellation(member.companyId, request, {
      periodEnd: cancelled?.current_period_end
        ? new Date(cancelled.current_period_end * 1000)
        : null,
    });

    await recordActivity(member, {
      action: "billing.cancelled",
      entityType: "settings",
      summary: "Cancelled the FieldQuo subscription",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[platform/billing/cancel]", err);
    return NextResponse.json(
      { error: "Could not cancel through Stripe" },
      { status: 500 },
    );
  }
}
