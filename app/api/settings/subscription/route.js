// app/api/settings/subscription/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";

// Feeds the AdminSidebar TrialBadge AND the Account & Billing page.
//
// ── Two payloads, because two callers need different things ────────────────
//
// This used to return the plan name, its monthly price and its seat count to
// every active member, on the reasoning that "how many days are left" is
// harmless. The trial countdown is; what the company pays FieldQuo is not, and
// it was reaching an employee's browser on every page load whether or not they
// ever opened Account & Billing.
//
// Gating the whole endpoint would have been the obvious fix and the wrong one:
// TrialBadge renders in the sidebar of every screen, so a 403 there would kill
// the trial countdown for the crew. It reads `status` and `trialEndsAt` and
// nothing else (see TrialBadge.js), so those two stay open and the commercial
// fields are withheld — the badge keeps working, the price stops travelling.
//
// `plan.id` is in the full payload so Account & Billing can tell which plan in
// the /api/settings/plans list is the current one.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Impersonation sees the full record: "view everything, edit nothing"
  // (non-negotiable #3), and a support session looking at a billing question
  // seeing less than the customer does is the failure that rule exists to stop.
  const seesPlan = member.impersonation || isBillingAdmin(member.role);

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
    select: {
      status: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      plan: {
        select: { id: true, name: true, priceMonthly: true, maxUsers: true },
      },
    },
  });

  if (!subscription) {
    return NextResponse.json({ status: null, trialEndsAt: null, plan: null });
  }

  if (seesPlan) return NextResponse.json(subscription);

  // Exactly what the badge reads. `plan: null` rather than an omitted key, so a
  // caller that checks for the property still gets a definite answer.
  return NextResponse.json({
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    plan: null,
  });
}
