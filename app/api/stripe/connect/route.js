// app/api/stripe/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
    // ── A refusal about FieldQuo, not about this company ───────────────
    //
    // Live mode asks the PLATFORM to finish its Connect platform profile
    // (business model + who carries connected-account losses) before the
    // first Express account can be created. The owner met it mid-demo, as
    // Stripe's raw sentence on a contractor's screen: "Please review the
    // responsibilities of managing losses for connected accounts at
    // https://dashboard.stripe.com/settings/connect/platform-profile."
    // That is FieldQuo's homework and the contractor cannot act on it — so
    // the contractor gets a white-label sentence that says nothing else is
    // blocked, and the link goes where the person who CAN act will see it:
    // the platform errors queue.
    const raw = String(err?.raw?.message || err?.message || "");
    if (/platform-profile|managing losses|connected accounts/i.test(raw)) {
      await recordError({
        area: "stripe",
        code: "connect_platform_profile_incomplete",
        message:
          "Stripe refused to create a connected account because FieldQuo's Connect platform profile is incomplete. " +
          "Complete it at https://dashboard.stripe.com/settings/connect/platform-profile (live mode), then the company presses Connect again.",
        companyId: company?.id || null,
        detail: { stripeMessage: raw, url: "https://dashboard.stripe.com/settings/connect/platform-profile" },
      }).catch(() => {});
      return NextResponse.json({ error: "platform_setup", platformSetup: true }, { status: 503 });
    }
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
