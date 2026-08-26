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
import { memberOrRefusal } from "@/lib/apiMember";
import { accessForCompany, GRACE_DAYS } from "@/lib/billing/access";
import { seesBillingState } from "@/lib/billing/billingAdmin";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const access = await accessForCompany(member.companyId);

  // ── `reason` is billing state, and not everyone gets billing state ─────
  //
  // The banner needs to know the account is HEALTHY or in trouble, and how
  // long is left. It does not need to know the company is on a free trial —
  // and "trialing" told a Manager exactly that, right after the trial badge
  // had been taken away from them everywhere else.
  //
  // A healthy account is reported as "ok" to anyone who may not see billing
  // state. The banner renders nothing for a healthy account either way, so
  // this loses no behaviour; it just stops the endpoint answering a question
  // it wasn't asked. Trouble states stay specific for everyone: someone whose
  // employer is about to lose access should know why their work is about to
  // stop, whatever their role.
  const seesDetail =
    member.impersonation || seesBillingState(member.role) || access.level !== "full";

  return NextResponse.json({
    level: access.level,
    daysLeft: access.daysLeft,
    reason: seesDetail ? access.reason : "ok",
    graceDays: GRACE_DAYS,
  });
}
