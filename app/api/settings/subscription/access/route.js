// app/api/settings/subscription/access/route.js
//
// "Is this account in good standing, and if not how long have they got?"
//
// Read-only and deliberately tiny. The banner asks on every page load, so it
// has to be one indexed query and nothing else.
//
// It lives UNDER /api/settings/subscription, which is on the billing allow-list
// in lib/billing/access.js — so a locked-out account can still fetch its own
// status. Without that the banner explaining the lock-out would itself be
// blocked by the lock-out.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { accessForCompany, GRACE_DAYS } from "@/lib/billing/access";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await accessForCompany(member.companyId);

  return NextResponse.json({
    level: access.level,
    daysLeft: access.daysLeft,
    reason: access.reason,
    graceDays: GRACE_DAYS,
  });
}
