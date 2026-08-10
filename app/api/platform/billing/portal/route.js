// app/api/platform/billing/portal/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createBillingPortalSession } from "@/lib/platform/stripeBilling";
import { getAppOrigin } from "@/lib/appUrl";

// Company-facing (getCurrentMember, same pattern as the checkout route) —
// opens Stripe's hosted billing portal so they can update their card, see
// invoices, and change/cancel their subscription without any of that UI
// living in FieldQuo.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The portal shows invoices and the card on file and lets you cancel. That is
  // owner/admin territory — "user:manage" reaches supervisors, who have no
  // business reading the company's payment history.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
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

  // Origin from the request (falls back to NEXT_PUBLIC_APP_URL) — never an
  // undefined `baseUrl`, which Stripe rejects and surfaces three layers away as
  // "the string did not match the expected pattern".
  const baseUrl = getAppOrigin(request);

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
