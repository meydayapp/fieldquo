// app/api/stripe/connect/login-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { createExpressLoginLink } from "@/lib/stripe";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

// "Manage in Stripe" — a fresh, single-use link into the company's own
// Stripe Express dashboard: payout schedule, BANK ACCOUNT, tax info — all
// editable once you are in it.
//
// This used to require nothing but a session, justified as "the same bar as
// viewing the Payments settings page". That premise expired: the Payments row
// moved behind `billing` (owner/admin) in lib/permissions/settingsAccess.js
// precisely because of the Disconnect button on it, and the comment here was
// never updated. So a Worker could POST this and land in the company's
// banking.
//
// Same gate as connect/disconnect/refresh now — all four doors into the same
// Stripe account should not have three different locks.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });

  if (!company?.stripeAccountId) {
    return NextResponse.json(
      { error: "Stripe isn't connected yet" },
      { status: 400 },
    );
  }

  try {
    const url = await createExpressLoginLink(company.stripeAccountId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe/connect/login-link]", err);
    return NextResponse.json(
      { error: "Could not create a Stripe dashboard link" },
      { status: 500 },
    );
  }
}
