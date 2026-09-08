// app/api/settings/social/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import {
  metaFullyConfigured,
  metaPagesConnectEnabled,
  buildAuthorizeUrl,
  META_PAGES_SCOPE,
} from "@/lib/meta/client";
import { getAppOrigin } from "@/lib/appUrl";
import { PAGES_STATE_COOKIE, baseCookieOptions } from "@/lib/meta/oauthCookies";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";

/**
 * Starts the Facebook/Instagram PUBLISHING connect flow — a different consent
 * screen from Meta Ads (META_PAGES_SCOPE, not ads_read) with its own callback,
 * its own cookies and its own stored connection.
 *
 * ── A GET that redirects, where Meta Ads uses a POST that returns a URL ────
 *
 * app/api/meta-ads/connect answers with `{ authorizeUrl }` for the browser to
 * follow. This one 302s, because the settings panel is a link, and a link that
 * navigates is the shape a browser handles best (no fetch, no JSON, nothing to
 * go wrong between "clicked" and "at facebook.com"). What that gives up is the
 * property that a GET cannot be triggered by a stray <img> on another site —
 * and what that stray request could accomplish here is: mint a state cookie
 * this app itself generated, and receive a redirect the browser will not
 * follow. It cannot connect anything. The connection still requires the person
 * to land on Meta's own consent screen and approve it there, which is the
 * "explicit permission" boundary that matters.
 */
export async function GET(request) {
  const origin = getAppOrigin(request);
  const settings = (params) =>
    NextResponse.redirect(`${origin}${SOCIAL_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  // A refusal here is a JSON 401/402/403 — right for a fetch, wrong for a
  // navigation, but this route is only ever reached BY a navigation from a
  // screen the same gate already guards, so the alternative (silently
  // redirecting an unauthenticated stranger into /app) would be worse: it
  // would hide the refusal rather than state it.
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // The flag, checked server-side and not only in the panel that hides the
  // link: none of META_PAGES_SCOPE is approved yet, so sending someone to
  // Meta's dialog would show them a consent screen that errors on Meta's side.
  // A hidden control is not access control (AGENTS.md), and this is the half
  // that refuses.
  if (!metaPagesConnectEnabled()) {
    return settings({ socialError: "awaiting_review" });
  }

  if (!metaFullyConfigured()) {
    return settings({ socialError: "not_configured" });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  // The companyId travels with the state so the callback can refuse a session
  // that changed tenants mid-flow — same reasoning as the ads connect route.
  cookieStore.set(PAGES_STATE_COOKIE, `${state}:${member.companyId}`, baseCookieOptions());

  const redirectUri = `${origin}/api/settings/social/callback`;
  return NextResponse.redirect(
    buildAuthorizeUrl({ redirectUri, state, scope: META_PAGES_SCOPE }),
  );
}
