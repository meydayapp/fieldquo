// app/api/google-ads/status/route.js
//
// What Settings › Google Ads (app/app/settings/google-ads/page.js) needs to
// draw one of its honest states — never a Connect button that would fail
// once clicked:
//
//   not configured       env vars missing — listed by NAME, never value
//   waiting on Google    everything set, but GOOGLE_ADS_API_APPROVED is not
//                        "1": FieldQuo's developer token has no Basic access
//                        yet, so every real ad account would refuse us
//   not connected        a Connect button that works
//   pick an account      connected, no ad account chosen yet
//   connected            the account, last sync, Sync now, Disconnect
//   needs attention      status needs_reauth / error, with Google's sentence
//
// Gated like app/api/meta-ads/status (isBillingAdmin — "app.settings.googleAds":
// "billing" in lib/permissions/settingsAccess.js), with the same read-only
// carve-out for a support session: "why isn't Google spend coming in" is
// exactly what a support session opens for, and middleware refuses every
// non-GET under impersonation, so this cannot become a write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { googleAdsAvailable, googleAdsMissing, googleAdsApiApproved } from "@/lib/googleAds/client";
import { getGoogleAdsConnection, publicGoogleAdsShape } from "@/lib/googleAds/connection";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const connection = await getGoogleAdsConnection(member.companyId);
  const missing = googleAdsMissing();
  return NextResponse.json({
    available: googleAdsAvailable(),
    missing,
    // Only meaningful once nothing is missing: then the one thing left is Google's decision.
    waitingOnApproval: missing.length === 0 && !googleAdsApiApproved(),
    connection: publicGoogleAdsShape(connection),
  });
}
