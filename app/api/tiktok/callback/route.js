// app/api/tiktok/callback/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { TIKTOK_SETTINGS_PATH } from "@/lib/tiktok/settingsPath";
import { recordError } from "@/lib/platform/errorLog";
import { TIKTOK_CALLBACK_PATH, TIKTOK_STATE_COOKIE, tiktokConfigured } from "@/lib/tiktok/config";
import { signingRootKey, verifyOAuthState } from "@/lib/tiktok/signing";
import { exchangeCode, getUserInfo } from "@/lib/tiktok/client";
import { saveTikTokConnection } from "@/lib/tiktok/connection";

// TikTok's redirect target (registered in the portal as
// https://www.fieldquo.com/api/tiktok/callback). Everything fails toward the
// settings card with a code the card has a sentence for — the person is
// looking at a tab that just came back from tiktok.com, and the useful place
// to land them is the screen they started on.
function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}${TIKTOK_SETTINGS_PATH}?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get(TIKTOK_STATE_COOKIE)?.value || null;
  cookieStore.delete(TIKTOK_STATE_COOKIE);

  if (denied) return toSettings(origin, { tiktokError: "denied" });
  if (!code || !state || !cookieNonce) return toSettings(origin, { tiktokError: "bad_state" });

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  if (!member || !isBillingAdmin(member.role)) return toSettings(origin, { tiktokError: "session" });

  if (!tiktokConfigured()) return toSettings(origin, { tiktokError: "not_configured" });

  const verdict = verifyOAuthState(state, {
    rootKey: signingRootKey(),
    cookieNonce,
    companyId: member.companyId,
    userId: member.userId,
    nowSeconds: Date.now() / 1000,
  });
  // A state for a different member or company is the session changing
  // mid-flow — told apart from a forged/expired one because the fix differs
  // (sign back in as the person who started it vs. just try again).
  if (!verdict.ok) {
    return toSettings(origin, { tiktokError: verdict.reason === "other_member" ? "session" : "bad_state" });
  }

  const token = await exchangeCode({ code, redirectUri: `${origin}${TIKTOK_CALLBACK_PATH}` });
  if (!token.ok) {
    await recordError({
      area: "tiktok_connect",
      code: String(token.code).slice(0, 60),
      message: "TikTok refused the authorization-code exchange.",
      companyId: member.companyId,
      detail: { status: token.status, logId: token.logId, message: token.message },
    }).catch(() => {});
    // Two sentences, not one per OAuth code: "TikTok could not be reached"
    // (try again) and "TikTok refused the sign-in" (start again) are the only
    // two different things the person can do. The code itself is in the
    // platform error log for support.
    return toSettings(origin, { tiktokError: token.code === "network" ? "network" : "exchange_failed" });
  }
  const d = token.data || {};
  if (!d.access_token || !d.refresh_token || !d.open_id) {
    return toSettings(origin, { tiktokError: "exchange_failed" });
  }

  // The name and picture for the card. Best effort: a connection whose
  // user-info read failed still posts (creator_info supplies the nickname the
  // composer is required to show), so this never blocks the save.
  const info = await getUserInfo({ accessToken: d.access_token });
  const user = info.ok ? info.data?.user || {} : {};

  await saveTikTokConnection({
    companyId: member.companyId,
    openId: String(d.open_id),
    displayName: typeof user.display_name === "string" ? user.display_name : null,
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresIn: d.expires_in,
    refreshExpiresIn: d.refresh_expires_in,
    // What TikTok GRANTED, which can be less than what was asked — the card
    // compares the two and says which permission is missing.
    scopes: typeof d.scope === "string" ? d.scope : null,
    connectedByUserId: member.userId,
  });

  return toSettings(origin, { tiktokConnected: "1" });
}
