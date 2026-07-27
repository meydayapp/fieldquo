// app/api/stripe/connect/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can disconnect Stripe" },
      { status: 403 },
    );
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
