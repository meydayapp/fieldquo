// app/api/calendar/google/callback/route.js
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { getAppOrigin } from "@/lib/appUrl";
import { googleCalendarConfigured, exchangeGoogleCode, decodeIdTokenEmail } from "@/lib/calendar/googleClient";
import { verifyState, GOOGLE_STATE_COOKIE } from "@/lib/calendar/googleState";
import { saveConnection, getConnectionForMember, MY_CALENDAR_SETTINGS_PATH } from "@/lib/calendar/googleConnection";
import { reconcileMember } from "@/lib/calendar/googleSync";
import { clearBusyCache } from "@/lib/calendar/googleBusy";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";

// Google's redirect target. Everything fails toward the settings screen,
// never a bare error page — the person is staring at a tab that just came
// back from accounts.google.com, and the only useful place to land them is
// the screen they started on, with one word saying what happened.
function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}${MY_CALENDAR_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error"); // Google sets this when consent was declined

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GOOGLE_STATE_COOKIE)?.value || null;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (denied) return toSettings(origin, { google: "denied" });
  if (!code || !state || !cookieValue) return toSettings(origin, { google: "bad_state" });

  const verified = verifyState(state, { cookieValue });
  if (!verified) return toSettings(origin, { google: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  // The state names the member who STARTED the flow. A session that changed
  // between the two legs — somebody signed out and in as a colleague on the
  // same browser — must not attach the first person's Google account to the
  // second person's row.
  if (!member || member.id !== verified.memberId) return toSettings(origin, { google: "session" });

  if (!googleCalendarConfigured()) return toSettings(origin, { google: "not_configured" });

  const exchanged = await exchangeGoogleCode({ code, redirectUri: `${origin}/api/calendar/google/callback` });
  if (!exchanged.ok) {
    await recordError({
      area: "google_calendar",
      code: "code_exchange",
      message: `Google Calendar connect: code exchange failed (${exchanged.message}).`,
      companyId: member.companyId,
      detail: { memberId: member.id, status: exchanged.status },
    });
    return toSettings(origin, { google: "exchange_failed" });
  }
  const refreshToken = exchanged.data?.refresh_token;
  if (!refreshToken) {
    // access_type=offline + prompt=consent should make this impossible; when
    // it happens anyway (a Workspace policy), say so rather than storing a
    // connection that dies in an hour.
    await recordError({
      area: "google_calendar",
      code: "no_refresh_token",
      message: "Google Calendar connect: Google returned no refresh token.",
      companyId: member.companyId,
      detail: { memberId: member.id, scope: exchanged.data?.scope || null },
    });
    return toSettings(origin, { google: "no_refresh_token" });
  }

  // The scopes Google GRANTED, not the ones asked for: a person can un-tick
  // calendar on the consent screen and still come back with a code.
  const granted = String(exchanged.data?.scope || "");
  if (!granted.includes("auth/calendar.events") || !granted.includes("auth/calendar.readonly")) {
    return toSettings(origin, { google: "scope_missing" });
  }

  const email = decodeIdTokenEmail(exchanged.data?.id_token);
  await saveConnection({ memberId: member.id, refreshToken, email });
  clearBusyCache(member.id);

  // No token, no email beyond what the member themselves will see on the
  // panel; the activity trail records that a connection happened.
  await recordActivity(member, {
    action: "calendar.google_connected",
    entityType: "settings",
    entityId: member.id,
    summary: "Connected their Google Calendar",
    summaryKey: "app.calendar.google.activity.connected",
  });

  // Everything already on their schedule goes onto the calendar now, behind
  // the redirect, so the panel says "connected" and the phone fills in over
  // the next few seconds rather than at the next hourly run.
  after(async () => {
    try {
      const connection = await getConnectionForMember(member.id);
      if (connection) await reconcileMember(connection);
    } catch (err) {
      console.error("[google-calendar] first sync after connect failed:", err?.message);
    }
  });

  return toSettings(origin, { google: "connected" });
}
