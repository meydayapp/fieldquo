// app/api/platform/billing/checkout/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember"; // company-side session — the company owner initiates this
import { createBillingCheckoutSession } from "@/lib/platform/stripeBilling";

// Note: this is called by a COMPANY (upgrading their own plan), not a platform admin —
// hence getCurrentMember, not getCurrentPlatformAdmin. It lives under /platform/billing
// because it's Stripe Billing (FieldQuo charging the company), not Connect.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await request.json();
  if (!planId)
    return NextResponse.json({ error: "planId is required" }, { status: 400 });

  const [company, plan] = await Promise.all([
    db.company.findUnique({ where: { id: member.companyId } }),
    db.plan.findUnique({ where: { id: planId } }),
  ]);

  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await createBillingCheckoutSession({
    company,
    plan,
    successUrl: `${baseUrl}/app/settings/billing?upgraded=true`,
    cancelUrl: `${baseUrl}/app/settings/billing`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
