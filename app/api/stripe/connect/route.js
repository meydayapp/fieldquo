// app/api/stripe/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── The message was right and the check was not ─────────────────────────
  //
  // This said "Only owners/admins can connect Stripe" while asking for
  // "user:manage", which SUPERVISORS hold — so a Dispatcher or Manager could
  // start Stripe onboarding for the company and put their own bank account on
  // the far end of every client payment. The settings sidebar hides
  // "app.settings.payments" behind the `billing` capability, so the row was
  // gone and the endpoint was live: the exact split AGENTS.md calls a dead
  // gate rather than a hidden button.
  //
  // isBillingAdmin is what login-link already uses, and what the error string
  // here has claimed all along. See lib/billing/billingAdmin.js on why
  // "may manage people" must not carry authority over the company's money.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
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
