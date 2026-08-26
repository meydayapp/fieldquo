// app/api/stripe/connect/refresh/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

// Stripe redirects here if an onboarding link expired mid-flow — regenerates a
// fresh one and immediately redirects back into it.
//
// This is NOT an anonymous bounce-through, whatever the shape suggests. What it
// hands back is an account-onboarding link: the screen where bank account and
// payout details are entered. Minting one from a bare `?companyId=` meant anyone
// who learned a company id — it appears in URLs and embed markup — could walk
// into another tenant's payout setup.
//
// Session auth is the right gate rather than a signed token, because Stripe's
// servers never fetch refresh_url: Stripe redirects the CONTRACTOR'S BROWSER to
// it, a top-level GET navigation that carries the Better Auth session cookie
// (SameSite=Lax). The person bouncing through here is the same logged-in owner
// who started onboarding a moment ago. Same billing-admin gate as the POST
// that minted the first link — resuming onboarding is the same act as starting
// it.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId)
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 },
    );

  // memberOrRefusal, so the gates inside getCurrentMember answer instead of
  // throwing an unserialisable error into Next and becoming a blank 500. This
  // URL is opened by a BROWSER returning from Stripe, so a 500 here is a white
  // page in the middle of payment onboarding.
  const { member, response } = await memberOrRefusal(request);
  // A browser arriving here mid-flow, not an API client — so send an expired
  // session to the login page rather than a JSON 401 it can't render. They land
  // back on the payments screen and start onboarding again, which works. Only
  // the 401 becomes a redirect: a 402 or 404 is a real refusal with a real
  // message, and bouncing it to /login would say "sign in" to someone who
  // already is.
  if (response) {
    if (response.status !== 401) return response;
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent("/app/settings/payments")}`,
        getAppOrigin(request),
      ),
    );
  }

  // Wrong tenant is not a UX case, it's the attack. Say no in place.
  if (member.companyId !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resuming onboarding is the same act as starting it, so it carries the same
  // gate — which is now isBillingAdmin on both. The comment above already said
  // "the same logged-in owner who started onboarding"; the check said
  // "user:manage", which supervisors hold.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company?.stripeAccountId) {
    return NextResponse.json(
      { error: "No connected account to refresh" },
      { status: 404 },
    );
  }

  const baseUrl = getAppOrigin(request);

  const { url } = await createConnectOnboardingLink({
    companyId,
    stripeAccountId: company.stripeAccountId,
    returnUrl: `${baseUrl}/app/settings/payments?connected=true`,
    refreshUrl: `${baseUrl}/api/stripe/connect/refresh?companyId=${companyId}`,
  });

  return NextResponse.redirect(url);
}
