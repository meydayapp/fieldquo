// app/api/reviews/google/connect/route.js
//
// Starts the Google Business Profile connect flow for the COMPANY — an
// owner/admin's consent, the company's listing. Same OAuth client as the
// calendar connect (docs/GOOGLE-BUSINESS-PROFILE.md), one more scope.
//
// A GET that redirects, like app/api/calendar/google/connect: the panel is
// a link. Refuses server-side when the client is not configured, or when
// Google has not yet approved the Business Profile API
// (lib/reviews/googleBusiness/availability.js), so nobody is sent to a
// consent screen that errors on Google's side or to a connection that can
// read nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { googleCalendarConfigured } from "@/lib/calendar/googleClient";
import { buildBusinessAuthorizeUrl } from "@/lib/reviews/googleBusiness/client";
import { signState, GOOGLE_BUSINESS_STATE_COOKIE, stateCookieOptions } from "@/lib/reviews/googleBusiness/state";
import { REVIEWS_SETTINGS_PATH } from "@/lib/reviews/googleBusiness/connection";
import { googleBusinessAvailable } from "@/lib/reviews/googleBusiness/availability";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const settings = (params) => NextResponse.redirect(`${origin}${REVIEWS_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return settings({ google: "forbidden" });
  }

  if (!googleCalendarConfigured()) return settings({ google: "not_configured" });
  // The client exists but Google has not approved the Business Profile API:
  // consent would succeed and every read after it answer 429. The card draws
  // no button in this state; an old link or a bookmark lands here instead.
  if (!googleBusinessAvailable()) return settings({ google: "not_approved" });

  const state = signState({ memberId: member.id });
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_BUSINESS_STATE_COOKIE, state, stateCookieOptions());

  return NextResponse.redirect(
    buildBusinessAuthorizeUrl({ redirectUri: `${origin}/api/reviews/google/callback`, state }),
  );
}
