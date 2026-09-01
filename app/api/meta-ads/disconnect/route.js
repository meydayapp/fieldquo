// app/api/meta-ads/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { disconnectConnection } from "@/lib/meta/connection";

// Severing a company's Meta connection — same weight as
// app/api/stripe/connect/disconnect/route.js, same gate (isBillingAdmin):
// this removes the encrypted token from the database entirely, not a status
// flip a crew member should be one click from.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  await disconnectConnection(member.companyId);
  return NextResponse.json({ success: true });
}
