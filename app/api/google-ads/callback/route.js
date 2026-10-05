// app/api/google-ads/callback/route.js
//
// Google's redirect target for the Google Ads connect. Everything fails
// toward the Spend page's Google Ads card with one word saying what
// happened — the person is looking at a tab that just came back from
// accounts.google.com.
//
// On success the refresh token is encrypted and stored, and the card asks
// which ad account to import from (one Google user can reach several, some
// only through a manager account). No spend is read until that pick.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { googleAdsAvailable, exchangeGoogleCode, decodeIdTokenEmail, ADWORDS_SCOPE } from "@/lib/googleAds/client";
import { verifyState, GOOGLE_ADS_STATE_COOKIE } from "@/lib/googleAds/state";
import { saveGoogleAdsConnection, GOOGLE_ADS_SETTINGS_PATH } from "@/lib/googleAds/connection";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";

function back(origin, params) {
  return NextResponse.redirect(`${origin}${GOOGLE_ADS_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GOOGLE_ADS_STATE_COOKIE)?.value || null;
  cookieStore.delete(GOOGLE_ADS_STATE_COOKIE);

  if (denied) return back(origin, { googleAds: "denied" });
  if (!code || !state || !cookieValue) return back(origin, { googleAds: "bad_state" });
  const verified = verifyState(state, { cookieValue });
  if (!verified) return back(origin, { googleAds: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  if (!member || member.id !== verified.memberId || !isBillingAdmin(member.role)) return back(origin, { googleAds: "session" });
  if (!googleAdsAvailable()) return back(origin, { googleAds: "not_configured" });

  const exchanged = await exchangeGoogleCode({ code, redirectUri: `${origin}/api/google-ads/callback` });
  if (!exchanged.ok) {
    await recordError({
      area: "google_ads",
      code: "code_exchange",
      message: `Google Ads connect: code exchange failed (${exchanged.message}).`,
      companyId: member.companyId,
      detail: { memberId: member.id, status: exchanged.status },
    });
    return back(origin, { googleAds: "exchange_failed" });
  }
  const refreshToken = exchanged.data?.refresh_token;
  if (!refreshToken) return back(origin, { googleAds: "no_refresh_token" });
  // The scopes Google GRANTED — the consent screen lets a person untick one.
  if (!String(exchanged.data?.scope || "").includes(ADWORDS_SCOPE)) return back(origin, { googleAds: "scope_missing" });

  await saveGoogleAdsConnection({
    companyId: member.companyId,
    refreshToken,
    email: decodeIdTokenEmail(exchanged.data?.id_token),
    memberId: member.id,
  });
  await recordActivity(member, {
    action: "marketing_spend.google_ads_connected",
    entityType: "company",
    entityId: member.companyId,
    summary: "Connected Google Ads",
  });
  return back(origin, { googleAds: "connected" });
}
