// app/api/settings/subscription/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Feeds the AdminSidebar TrialBadge AND the Account & Billing page — current
// plan + trial countdown for the signed-in user's company. Read-only for
// everyone (any active member should be able to see "how many days are
// left"), no permission gate needed. `plan.id` was added so Account & Billing
// can tell which plan in the /api/settings/plans list is the current one.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json(subscription);
}
