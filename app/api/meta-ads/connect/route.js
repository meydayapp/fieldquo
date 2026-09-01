// app/api/meta-ads/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaFullyConfigured, buildAuthorizeUrl } from "@/lib/meta/client";
import { getAppOrigin } from "@/lib/appUrl";
import { STATE_COOKIE, baseCookieOptions } from "@/lib/meta/oauthCookies";

/**
 * Starts the OAuth flow: returns the URL to send the browser to. A POST, not
 * a GET, because clicking "Connect Meta Ads" is the action — see
 * AGENTS.md's "explicit permission required" list for connecting a
 * third-party account, and because a GET here would let a stray link
 * generate a fresh, valid state cookie with no user intent behind it.
 */
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  if (!metaFullyConfigured()) {
    // The exact "must say so plainly" case AGENTS.md calls for — no Meta app
    // credentials exist on this deployment yet (see docs/META-ADS-BUILD.md).
    // Refused here rather than rendering a button that reaches this route
    // and fails, which is what a dead control looks like from the outside.
    return NextResponse.json(
      {
        error:
          "Meta Ads isn't configured on this deployment yet — FieldQuo hasn't been approved by Meta as an advertiser-facing app. See docs/META-ADS-BUILD.md.",
      },
      { status: 400 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, `${state}:${member.companyId}`, baseCookieOptions());

  const redirectUri = `${getAppOrigin(request)}/api/meta-ads/callback`;
  const authorizeUrl = buildAuthorizeUrl({ redirectUri, state });

  return NextResponse.json({ authorizeUrl });
}
