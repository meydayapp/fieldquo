// app/api/settings/social/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { disconnectPageConnection } from "@/lib/meta/pageConnection";

// Severing a company's Facebook/Instagram publishing connection — same weight
// and same gate as app/api/meta-ads/disconnect: the encrypted Page token
// leaves the database in this request, and scheduled posts that have not fired
// yet will find no connection when the cron reaches them (which they report,
// per-post, rather than failing silently — see the scheduled-publish cron).
//
// A POST even though /connect is a GET: this one changes stored data, and a
// GET that deletes a credential is the exact "irreversible action behind a
// link" shape a prefetch or a link-preview bot can trigger.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  await disconnectPageConnection(member.companyId);
  return NextResponse.json({ success: true });
}
