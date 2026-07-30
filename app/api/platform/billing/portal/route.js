// app/api/platform/billing/portal/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { createBillingPortalSession } from "@/lib/platform/stripeBilling";

// Company-facing (getCurrentMember, same pattern as the checkout route) —
// opens Stripe's hosted billing portal so they can update their card, see
// invoices, and change/cancel their subscription without any of that UI
// living in FieldQuo.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage billing" },
      { status: 403 },
    );
  }

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing history yet — start a plan first" },
      { status: 400 },
    );
  }

  const url = await createBillingPortalSession({
    stripeCustomerId: subscription.stripeCustomerId,
    // ?reconcile=1 makes the billing page pull the live state from Stripe the
    // moment they come back, rather than waiting for a webhook.
    //
    // That matters most for the case this whole feature exists for: someone
    // locked out updates their card in the portal, returns, and has to see the
    // app come back NOW. If the billing webhook is delayed — or, as today, not
    // registered at all — waiting for it means they pay and stay locked, which
    // is the single worst outcome of the grace period.
    returnUrl: `${baseUrl}/app/settings/account-billing?reconcile=1`,
  });

  return NextResponse.json({ url });
}
