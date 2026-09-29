// app/api/tiktok/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { baseCookieOptions } from "@/lib/meta/oauthCookies";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";
import {
  TIKTOK_AUTHORIZE_URL,
  TIKTOK_CALLBACK_PATH,
  TIKTOK_SCOPES,
  TIKTOK_STATE_COOKIE,
  tiktokClientKey,
  tiktokConfigured,
} from "@/lib/tiktok/config";
import { makeOAuthState, newOAuthNonce, signingRootKey } from "@/lib/tiktok/signing";

/**
 * Starts "Connect TikTok" — a GET that 302s to TikTok's consent screen, the
 * same shape as app/api/settings/social/connect and for the same reason (the
 * settings card is a link, and a navigation is what a browser does best with a
 * redirect). A stray GET from another site can mint a state cookie and receive
 * a redirect it will not follow; it cannot connect anything, because the
 * connection still needs the person to approve on tiktok.com.
 *
 * The state is SIGNED and names this member and this company
 * (lib/tiktok/signing.js). The callback refuses it unless the same person, in
 * the same company, in the same browser (the cookie nonce) finishes the flow.
 *
 * Billing-admin only, like every other connection on Settings › Meta Ads: a
 * connected TikTok account posts publicly under the company's name.
 */
export async function GET(request) {
  const origin = getAppOrigin(request);
  const settings = (params) =>
    NextResponse.redirect(`${origin}${SOCIAL_SETTINGS_PATH}?${new URLSearchParams(params)}#tiktok`);

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // Server-side half of the card's "coming soon": with no credentials there
  // is no consent screen to send anyone to.
  if (!tiktokConfigured()) return settings({ tiktokError: "not_configured" });
  const rootKey = signingRootKey();
  if (!rootKey) return settings({ tiktokError: "not_configured" });

  const nonce = newOAuthNonce();
  const state = makeOAuthState({
    rootKey,
    companyId: member.companyId,
    userId: member.userId,
    nonce,
    nowSeconds: Date.now() / 1000,
  });
  const cookieStore = await cookies();
  cookieStore.set(TIKTOK_STATE_COOKIE, nonce, baseCookieOptions());

  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", tiktokClientKey());
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  // Must match the portal registration EXACTLY — https, no query, no fragment
  // (developers.tiktok.com/doc/login-kit-web).
  url.searchParams.set("redirect_uri", `${origin}${TIKTOK_CALLBACK_PATH}`);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}
