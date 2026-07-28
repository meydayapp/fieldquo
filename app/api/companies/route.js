// app/api/companies/route.js
//
// The only change vs. what you already have: planId was being destructured
// from the request body and then never used anywhere. That's the root cause
// of "Account & Billing shows no active plan" — createTrialCheckoutSession
// never got told which plan to attach, so the checkout.session.completed
// webhook couldn't create a valid Subscription row afterward (planId is
// required on that model). Everything else in this file — company/member/
// org creation, service category setup — is unchanged.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createTrialCheckoutSession } from "@/lib/platform/stripeBilling";
import { calculatePricing } from "@/lib/pricing";
import { seedStandardAddOns } from "@/lib/products/seedStandardAddOns";
import { seedDefaultTemplates } from "@/lib/email/seedDefaultTemplates";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    name,
    phone,
    address,
    city,
    province,
    industries,
    planId,
    employeeCount,
    serviceCategoryIds,
  } = await request.json();

  if (!name) {
    return NextResponse.json(
      { error: "Company name is required" },
      { status: 400 },
    );
  }

  if (!employeeCount) {
    return NextResponse.json(
      { error: "employeeCount is required" },
      { status: 400 },
    );
  }

  const pricingResult = calculatePricing(employeeCount);

  if (pricingResult.contactSalesRequired) {
    return NextResponse.json(
      {
        error:
          "This employee count requires custom pricing — contact sales instead",
      },
      { status: 400 },
    );
  }

  const pricing = { ...pricingResult, employeeCount };

  // Resolve a real Plan row before we ever create a Stripe checkout session,
  // since Subscription.planId is required and the webhook can't invent one
  // after the fact. Two cases:
  //  - A named tier was selected (planId provided) — validate it exists.
  //  - "Custom" employee count (planId is null from the signup form) — no
  //    seeded Plan matches an arbitrary count, so find-or-create one sized
  //    to this exact pricing, keyed by employee count so repeat signups at
  //    the same count reuse the same Plan row instead of piling up dupes.
  let resolvedPlanId = planId;

  if (resolvedPlanId) {
    const existingPlan = await db.plan.findUnique({
      where: { id: resolvedPlanId },
    });
    if (!existingPlan) {
      return NextResponse.json(
        { error: "Selected plan not found" },
        { status: 400 },
      );
    }
  } else {
    const customPlanName = `Custom (${employeeCount} employees)`;
    const customPlan = await db.plan.upsert({
      where: { name: customPlanName },
      update: {},
      create: {
        name: customPlanName,
        priceMonthly: pricing.monthlyTotal,
        maxUsers: employeeCount,
      },
    });
    resolvedPlanId = customPlan.id;
  }

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .concat(`-${Math.random().toString(36).slice(2, 6)}`);

  const company = await db.company.create({
    data: {
      name,
      slug,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      industries: Array.isArray(industries) ? industries : [],
      onboardingStatus: "pending",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await db.member.create({
    data: { userId: session.user.id, companyId: company.id, role: "owner" },
  });

  // Better Auth generates its OWN id for the organization — it is NOT the same
  // as company.id, even though we pass company.id in as the slug. We capture
  // org.id here and store it on Company.authOrgId so getCurrentMember() can
  // translate session.activeOrganizationId -> the right Company row.
  const org = await auth.api.createOrganization({
    body: { name, slug: company.id },
    headers: request.headers,
  });

  await db.company.update({
    where: { id: company.id },
    data: { authOrgId: org.id },
  });

  // Without this, activeOrganizationId stays null on the session, and every
  // company-scoped API route 401s regardless of how correct everything else is.
  await auth.api.setActiveOrganization({
    body: { organizationId: org.id },
    headers: request.headers,
  });

  if (Array.isArray(serviceCategoryIds) && serviceCategoryIds.length > 0) {
    await db.companyServiceCategory.createMany({
      data: serviceCategoryIds.map((categoryId) => ({
        companyId: company.id,
        categoryId,
        enabled: true,
      })),
    });

    // Seed standard add-on products for any selected category that has a
    // starter set (e.g. cabinet refinishing → New Handles, Soft-Close Hinges,
    // Two-Tone, Glass Inserts). Best-effort: a seeding hiccup must never block
    // signup/checkout, so failures are logged, not thrown.
    try {
      const selected = await db.serviceCategory.findMany({
        where: { id: { in: serviceCategoryIds } },
        select: { id: true, key: true },
      });
      for (const cat of selected) {
        await seedStandardAddOns({
          companyId: company.id,
          categoryId: cat.id,
          categoryKey: cat.key,
        });
      }
    } catch (err) {
      console.error("[companies POST] standard add-on seeding failed", err);
    }
  }

  // Every company gets one Active starter template per automated email type
  // (quote/instructions/receipt/follow-up) — not tied to which service
  // categories were picked, so this runs unconditionally. Same best-effort
  // rule as above: never block signup over a seeding hiccup.
  try {
    await seedDefaultTemplates(company.id);
  } catch (err) {
    console.error("[companies POST] default template seeding failed", err);
  }

  const baseUrl = getAppOrigin(request);

  const checkoutSession = await createTrialCheckoutSession({
    company,
    pricing,
    planId: resolvedPlanId,
    // {CHECKOUT_SESSION_ID} is a literal Stripe template placeholder — Stripe
    // substitutes it with the real session id before redirecting the
    // browser. /app reads it and calls /api/platform/billing/reconcile-session
    // so the Subscription row exists immediately even if the
    // checkout.session.completed webhook is delayed or never arrives.
    successUrl: `${baseUrl}/app?welcome=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/signup`,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
