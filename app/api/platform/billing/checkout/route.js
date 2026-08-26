// app/api/platform/billing/checkout/route.js
//
// Only change vs. what you already have: successUrl/cancelUrl now point at
// /app/settings/account-billing instead of /app/settings/billing, matching
// the page that actually exists now.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createBillingCheckoutSession } from "@/lib/platform/stripeBilling";
import { calculatePricing } from "@/lib/pricing";
import { getAppOrigin } from "@/lib/appUrl";

// Note: this is called by a COMPANY (upgrading their own plan), not a platform admin —
// hence getCurrentMember, not getCurrentPlatformAdmin. It lives under /platform/billing
// because it's Stripe Billing (FieldQuo charging the company), not Connect.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Had no role gate at all: any logged-in employee could post an
  // employeeCount and start a Stripe Checkout that raises their employer's
  // monthly bill. Same gate as the portal and cancel routes.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const { planId, employeeCount } = await request.json();
  if (!planId && !employeeCount)
    return NextResponse.json(
      { error: "planId or employeeCount is required" },
      { status: 400 },
    );

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  // Two ways to arrive here:
  //  - A named tier (planId) — the existing Account & Billing "Choose plan"
  //    flow. Validate it exists.
  //  - A seat count (employeeCount) — the Team page's "Add licenses" upgrade.
  //    No seeded Plan matches an arbitrary count, so find-or-create a
  //    `Custom (N employees)` Plan sized to it, exactly like signup does
  //    (app/api/companies/route.js) so repeat upgrades at the same count reuse
  //    one Plan row instead of piling up dupes.
  let plan;
  if (employeeCount) {
    const pricing = calculatePricing(employeeCount);
    if (pricing.contactSalesRequired) {
      return NextResponse.json(
        {
          error:
            "That many licenses needs a custom quote — contact sales instead of self-serve checkout.",
        },
        { status: 400 },
      );
    }
    const customPlanName = `Custom (${pricing.employeeCount} employees)`;
    plan = await db.plan.upsert({
      where: { name: customPlanName },
      update: { priceMonthly: pricing.monthlyTotal, maxUsers: pricing.employeeCount },
      create: {
        name: customPlanName,
        priceMonthly: pricing.monthlyTotal,
        maxUsers: pricing.employeeCount,
      },
    });
  } else {
    plan = await db.plan.findUnique({ where: { id: planId } });
  }

  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // During an active trial the seat upgrade must stay free until the trial
  // ends — the new per-seat price only applies afterward. Carry the remaining
  // days onto the Stripe subscription's trial, same computation as signup
  // (app/api/companies/route.js). Scoped to the employeeCount (Add licenses)
  // flow so the existing named-plan "Choose plan" checkout keeps its current
  // behaviour unchanged. Absent/expired trial → no trial days.
  let trialDays;
  if (employeeCount && company?.trialEndsAt && company.trialEndsAt.getTime() > Date.now()) {
    trialDays = Math.max(
      1,
      Math.ceil((company.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
  }

  const baseUrl = getAppOrigin(request);

  const session = await createBillingCheckoutSession({
    company,
    plan,
    trialDays,
    // session_id, not just a flag. The page reconciles with it on arrival rather
    // than waiting for the checkout.session.completed webhook to land — Checkout
    // redirects in about a second and the webhook often doesn't beat it, so the
    // company was landing on "No active plan" right after paying.
    // {CHECKOUT_SESSION_ID} is substituted by Stripe.
    successUrl: `${baseUrl}/app/settings/account-billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/app/settings/account-billing`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
