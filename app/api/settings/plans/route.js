// app/api/settings/plans/route.js
//
// GET /api/platform/billing/plans exists already but is gated to platform
// admins only — a regular company member can't call it, so there was no way
// for the Account & Billing page to show "here's what you can upgrade to."
// This is the company-facing read-only equivalent.
//
// Narrowed from "any active member" to the people who can act on it. Account &
// Billing is its only caller and every button on that page is isBillingAdmin;
// a list of plans and prices someone can't buy is not information they need,
// and it was the second half of the leak fixed in ../subscription/route.js —
// withholding the current plan while still handing over the price list would
// have been a gate in name only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Support sessions see it — non-negotiable #3, same as the subscription read.
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(plans);
}
