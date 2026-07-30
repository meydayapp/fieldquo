// app/api/platform/billing/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { cancelSubscription } from "@/lib/platform/stripeBilling";
import { notifyCancellation } from "@/lib/billing/notify";
import { recordActivity } from "@/lib/activity/log";

// Self-serve cancellation — uses your existing cancelSubscription() helper.
// Cancels at Stripe immediately; your webhook's subscription.updated /
// deleted handling (wherever that lives) should be what actually flips
// Subscription.status in the DB, same as account.updated does for Connect.
// This route doesn't touch the DB directly to avoid the two getting out of
// sync with what Stripe actually did.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can cancel the plan" },
      { status: 403 },
    );
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

  try {
    const cancelled = await cancelSubscription(subscription.stripeSubscriptionId);

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
