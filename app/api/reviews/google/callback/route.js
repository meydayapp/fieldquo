// app/api/reviews/google/callback/route.js
//
// Google's redirect target for the Business Profile connect. Everything
// fails toward the reviews settings screen with one word saying what
// happened — the person is staring at a tab that just came back from
// accounts.google.com and the only useful place to land them is where
// they started.
//
// After a successful exchange the first refresh runs behind the redirect
// so the screen can say what Google answered — including, on a project
// whose quota is still 0, the honest sentence — before the person has
// finished reading "connected".
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { getAppOrigin } from "@/lib/appUrl";
import { googleCalendarConfigured } from "@/lib/calendar/googleClient";
import { exchangeGoogleCode, decodeIdTokenEmail, BUSINESS_SCOPE } from "@/lib/reviews/googleBusiness/client";
import { verifyState, GOOGLE_BUSINESS_STATE_COOKIE } from "@/lib/reviews/googleBusiness/state";
import { saveBusinessConnection, getBusinessConnection, REVIEWS_SETTINGS_PATH } from "@/lib/reviews/googleBusiness/connection";
import { refreshCompanyReviews } from "@/lib/reviews/googleBusiness/sync";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";

function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}${REVIEWS_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GOOGLE_BUSINESS_STATE_COOKIE)?.value || null;
  cookieStore.delete(GOOGLE_BUSINESS_STATE_COOKIE);

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
  if (!member || member.id !== verified.memberId) return toSettings(origin, { google: "session" });
  if (!googleCalendarConfigured()) return toSettings(origin, { google: "not_configured" });

  const exchanged = await exchangeGoogleCode({ code, redirectUri: `${origin}/api/reviews/google/callback` });
  if (!exchanged.ok) {
    await recordError({
      area: "google_business",
      code: "code_exchange",
      message: `Google Business Profile connect: code exchange failed (${exchanged.message}).`,
      companyId: member.companyId,
      detail: { memberId: member.id, status: exchanged.status },
    });
    return toSettings(origin, { google: "exchange_failed" });
  }
  const refreshToken = exchanged.data?.refresh_token;
  if (!refreshToken) {
    await recordError({
      area: "google_business",
      code: "no_refresh_token",
      message: "Google Business Profile connect: Google returned no refresh token.",
      companyId: member.companyId,
      detail: { memberId: member.id, scope: exchanged.data?.scope || null },
    });
    return toSettings(origin, { google: "no_refresh_token" });
  }

  // The scopes Google GRANTED, not the ones asked for.
  const granted = String(exchanged.data?.scope || "");
  if (!granted.includes(BUSINESS_SCOPE)) return toSettings(origin, { google: "scope_missing" });

  const email = decodeIdTokenEmail(exchanged.data?.id_token);
  await saveBusinessConnection({ companyId: member.companyId, refreshToken, email, memberId: member.id });

  await recordActivity(member, {
    action: "reviews.google_connected",
    entityType: "company",
    entityId: member.companyId,
    summary: "Connected the Google Business Profile",
  });

  after(async () => {
    try {
      const connection = await getBusinessConnection(member.companyId);
      if (connection?.locationName) await refreshCompanyReviews(connection);
    } catch (err) {
      console.error("[google-business] first refresh after connect failed:", err?.message);
    }
  });

  return toSettings(origin, { google: "connected" });
}
