// app/api/stripe/connect/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

// Deliberately a LOCAL unlink only — clears FieldQuo's reference to the
// Stripe Express account so invoices stop offering online payment, but does
// NOT call stripe.accounts.del(). Actually deleting the Express account is
// destructive and irreversible (loses payout history, submitted verification
// docs, etc.), and it's the kind of consequential account action that should
// require going through Stripe directly if that's really what they want —
// not a single button in our own settings page.
//
// After this, company.stripeAccountId is null, so the next "Connect with
// Stripe" click in the UI creates a brand-new Express account from scratch
// (see createConnectOnboardingLink in lib/stripe.js).
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Severing the company's payment processing is not a crew-running decision.
  // This asked for "user:manage" — held by supervisors — while telling the
  // refused caller "Only owners/admins can disconnect Stripe", so a Manager
  // could stop every invoice in the company from being payable online with one
  // POST. Same gate as connecting, because they are the same authority.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  await db.company.update({
    where: { id: member.companyId },
    data: {
      stripeAccountId: null,
      stripeOnboarded: false,
      stripeChargesEnabled: false,
    },
  });

  return NextResponse.json({ ok: true });
}
