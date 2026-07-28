// app/api/stripe/connect/refresh/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

// Stripe redirects here if an onboarding link expired mid-flow — regenerates a fresh
// one and immediately redirects back into it. No auth check needed beyond the
// companyId param since this is just a bounce-through, not a data endpoint — Stripe
// itself controls what's shown next.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId)
    return NextResponse.json(
      { error: "companyId is required" },
      { status: 400 },
    );

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
