// app/api/platform/billing/portal/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createBillingPortalSession } from "@/lib/platform/stripeBilling";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

// Company-facing (getCurrentMember, same pattern as the checkout route) —
// opens Stripe's hosted billing portal so they can update their card, see
// invoices, and change/cancel their subscription without any of that UI
// living in FieldQuo.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  // ── Stripe's own failures have to reach the person who can act on them ──
  //
  // This call had no catch at all, so a throw became an unhandled 500, Next
  // returned an HTML error page, the client's res.json() failed, and the banner
  // fell back to "Could not open billing portal" — which names no cause and
  // suggests no action. The two causes below are both ordinary, both
  // recoverable, and neither is guessable from that sentence:
  //
  //   * The customer portal has never been SAVED in the current Stripe mode.
  //     Test and live hold separate portal configurations, so switching a
  //     deployment to test keys breaks this button while everything else keeps
  //     working — which reads as "it used to work and now it doesn't".
  //   * The customer belongs to the OTHER mode. A cus_… created with live keys
  //     does not exist to a test key, and vice versa.
  //
  // Both are configuration, not code, so the message has to say which one it is
  // or nobody can fix it.
  let url;
  try {
    url = await createBillingPortalSession({
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
  } catch (err) {
    const raw = String(err?.message || "");
    const noConfig = /configuration/i.test(raw) && /portal|default/i.test(raw);
    const noCustomer = err?.code === "resource_missing" || /No such customer/i.test(raw);

    await recordError({
      area: "billing",
      code: noConfig
        ? "portal_not_configured"
        : noCustomer
          ? "portal_customer_wrong_mode"
          : "portal_failed",
      companyId: member.companyId,
      message: `Billing portal refused for ${subscription.stripeCustomerId}: ${raw}`,
      detail: errorDetail(err, { customerId: subscription.stripeCustomerId }),
    });

    // 502, not 500: the failure is at Stripe, and the distinction is what tells
    // whoever reads the log whether to look at our code or at the dashboard.
    return NextResponse.json(
      {
        error: noConfig
          ? "Stripe hasn't got a customer portal set up for this mode yet. Save the portal settings in the Stripe dashboard — test and live keep separate configurations — and this will work straight away."
          : noCustomer
            ? "This company's Stripe customer doesn't exist under the keys this deployment is using. That usually means the customer was created in live mode and the app is running on test keys, or the other way round."
            : "Stripe wouldn't open the billing portal just now. Nothing has changed on your plan.",
        reason: noConfig ? "not_configured" : noCustomer ? "wrong_mode" : "stripe_error",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ url });
}
