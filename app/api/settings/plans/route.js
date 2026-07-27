// app/api/settings/plans/route.js
//
// GET /api/platform/billing/plans exists already but is gated to platform
// admins only — a regular company member can't call it, so there was no way
// for the Account & Billing page to show "here's what you can upgrade to."
// This is the company-facing read-only equivalent: any active member can
// list plans, no admin check, no write access.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(plans);
}
