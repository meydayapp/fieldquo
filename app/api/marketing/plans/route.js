// app/api/marketing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — the signup page needs to show plans without a session. This is
// deliberately separate from /api/platform/billing/plans (which is platform-admin-
// only and includes internal fields like stripePriceId).
export async function GET() {
  const plans = await db.plan.findMany({
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true,
      name: true,
      priceMonthly: true,
      maxUsers: true,
      maxQuotesPerMonth: true,
      aiCopilotEnabled: true,
    },
  });
  return NextResponse.json(plans);
}
