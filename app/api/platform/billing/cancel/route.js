// app/api/platform/billing/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { cancelSubscription } from "@/lib/platform/stripeBilling";

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
    await cancelSubscription(subscription.stripeSubscriptionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[platform/billing/cancel]", err);
    return NextResponse.json(
      { error: "Could not cancel through Stripe" },
      { status: 500 },
    );
  }
}
