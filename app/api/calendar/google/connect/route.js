// app/api/calendar/google/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { googleCalendarConfigured, buildGoogleAuthorizeUrl } from "@/lib/calendar/googleClient";
import { signState, GOOGLE_STATE_COOKIE, stateCookieOptions } from "@/lib/calendar/googleState";
import { MY_CALENDAR_SETTINGS_PATH } from "@/lib/calendar/googleConnection";

/**
 * Starts the Google Calendar connect flow for the signed-in MEMBER — their
 * own calendar, their own consent; no role gate, because every member has a
 * calendar and an owner cannot connect somebody else's Google account for
 * them.
 *
 * A GET that redirects, for the same reason app/api/settings/social/connect
 * is one: the panel is a link, and what a stray cross-site GET could achieve
 * here is minting a state cookie and receiving a redirect the browser will
 * not follow. The connection still requires the person on Google's own
 * consent screen.
 *
 * Refuses — server-side, not only by hiding the button — when the OAuth
 * client is not configured, so nobody is sent to a consent screen that
 * errors on Google's side.
 */
export async function GET(request) {
  const origin = getAppOrigin(request);
  const settings = (params) =>
    NextResponse.redirect(`${origin}${MY_CALENDAR_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!googleCalendarConfigured()) return settings({ google: "not_configured" });

  const state = signState({ memberId: member.id });
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, state, stateCookieOptions());

  return NextResponse.redirect(
    buildGoogleAuthorizeUrl({ redirectUri: `${origin}/api/calendar/google/callback`, state }),
  );
}
