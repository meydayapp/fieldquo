// app/api/stripe/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can connect Stripe" },
      { status: 403 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });
  if (!company)
    return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Everything below can fail for reasons outside our control — a missing
  // STRIPE_SECRET_KEY, an unconfigured site URL, Stripe declining the account
  // link. Without this catch, Next returns a 500 HTML error page, the browser
  // tries res.json() on it, and the user sees Safari's parser complaining
  // about "the expected pattern" — which names neither the cause nor the fix.
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Stripe isn't configured on this deployment yet (STRIPE_SECRET_KEY is missing). Contact FieldQuo support.",
        },
        { status: 503 },
      );
    }

    const baseUrl = getAppOrigin(request);

    const { accountId, url } = await createConnectOnboardingLink({
      companyId: company.id,
      stripeAccountId: company.stripeAccountId,
      returnUrl: `${baseUrl}/app/settings/payments?connected=true`,
      refreshUrl: `${baseUrl}/api/stripe/connect/refresh?companyId=${company.id}`,
    });

    if (!company.stripeAccountId) {
      await db.company.update({
        where: { id: company.id },
        data: { stripeAccountId: accountId },
      });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe/connect] failed:", err);
    return NextResponse.json(
      {
        error:
          err?.raw?.message ||
          err?.message ||
          "Couldn't start Stripe onboarding.",
      },
      { status: err.status || 500 },
    );
  }
}
