// app/api/google-ads/connect/route.js
//
// Starts the Google Ads connect flow for the COMPANY — an owner/admin's
// consent to read the company's own ad account. Same OAuth client as the
// calendar and Business Profile connects, one more scope (adwords).
//
// A GET that redirects, like the other two Google connects: the card's
// button is a link. Refused server-side — not only by the card drawing no
// button — when the client or the developer token is missing, or Google has
// not yet approved the token (lib/googleAds/client.js googleAdsAvailable()):
// nobody is sent through a consent screen to a connection that can read
// nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { googleAdsAvailable, buildGoogleAdsAuthorizeUrl, googleAdsMissing } from "@/lib/googleAds/client";
import { signState, GOOGLE_ADS_STATE_COOKIE, stateCookieOptions } from "@/lib/googleAds/state";
import { GOOGLE_ADS_SETTINGS_PATH } from "@/lib/googleAds/connection";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const back = (params) => NextResponse.redirect(`${origin}${GOOGLE_ADS_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A read-only support session reads as the owner, so the role check alone
  // would pass it. Middleware already refuses this path for one
  // (lib/platform/readOnlyRequests.js); this says so here too.
  if (member.impersonation || !isBillingAdmin(member.role)) return back({ googleAds: "forbidden" });

  if (googleAdsMissing().length) return back({ googleAds: "not_configured" });
  if (!googleAdsAvailable()) return back({ googleAds: "not_approved" });

  const state = signState({ memberId: member.id });
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_ADS_STATE_COOKIE, state, stateCookieOptions());

  return NextResponse.redirect(buildGoogleAdsAuthorizeUrl({ redirectUri: `${origin}/api/google-ads/callback`, state }));
}
