// app/api/meta-ads/callback/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/currentMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import {
  metaFullyConfigured,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listAdAccounts,
} from "@/lib/meta/client";
import { saveConnection } from "@/lib/meta/connection";
import { getAppOrigin } from "@/lib/appUrl";
import { STATE_COOKIE, PENDING_TOKEN_COOKIE, baseCookieOptions } from "@/lib/meta/oauthCookies";

// Meta's own redirect target. Everything here fails toward the settings
// SCREEN, never toward a bare error page — the person mid-connect is staring
// at a browser tab that just came back from facebook.com, and "something
// went wrong, try again" on the actual settings screen is the only useful
// place to land them.
function toSettings(origin, params) {
  return NextResponse.redirect(`${origin}/app/settings/meta-ads?${new URLSearchParams(params)}`);
}

export async function GET(request) {
  const origin = getAppOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deniedByUser = url.searchParams.get("error"); // Meta sets this if consent was declined

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (deniedByUser) {
    return toSettings(origin, { metaError: "denied" });
  }
  if (!code || !state || !stateCookie) {
    return toSettings(origin, { metaError: "bad_state" });
  }
  const [cookieState, cookieCompanyId] = stateCookie.split(":");
  // Constant-time comparison isn't needed here the way it is for a webhook
  // signature — this is a value FieldQuo generated and the browser echoed
  // back on the SAME device within the cookie's own 10-minute window, not an
  // attacker-supplied signature being checked against a secret.
  if (cookieState !== state) {
    return toSettings(origin, { metaError: "bad_state" });
  }

  let member = null;
  try {
    member = await getCurrentMember(request);
  } catch {
    member = null;
  }
  // The state cookie also carries the companyId the flow STARTED under —
  // checked so a session that switched companies mid-flow (a second tab, an
  // impersonation hop) can't finish a connect against the wrong tenant.
  if (!member || !isBillingAdmin(member.role) || member.companyId !== cookieCompanyId) {
    return toSettings(origin, { metaError: "session" });
  }

  if (!metaFullyConfigured()) {
    return toSettings(origin, { metaError: "not_configured" });
  }

  const redirectUri = `${origin}/api/meta-ads/callback`;

  const shortLived = await exchangeCodeForToken({ code, redirectUri });
  if (!shortLived.ok) return toSettings(origin, { metaError: shortLived.kind });
  const shortToken = shortLived.data?.access_token;
  if (!shortToken) return toSettings(origin, { metaError: "unknown_error" });

  const longLived = await exchangeForLongLivedToken({ shortLivedToken: shortToken });
  if (!longLived.ok) return toSettings(origin, { metaError: longLived.kind });
  const longToken = longLived.data?.access_token;
  if (!longToken) return toSettings(origin, { metaError: "unknown_error" });
  const expiresIn = Number(longLived.data?.expires_in);
  const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

  const accountsRes = await listAdAccounts({ accessToken: longToken });
  if (!accountsRes.ok) return toSettings(origin, { metaError: accountsRes.kind });
  const accounts = Array.isArray(accountsRes.data?.data) ? accountsRes.data.data : [];

  if (accounts.length === 0) {
    return toSettings(origin, { metaError: "no_ad_accounts" });
  }

  if (accounts.length === 1) {
    const acct = accounts[0];
    await saveConnection({
      companyId: member.companyId,
      adAccountId: acct.id,
      adAccountName: acct.name || null,
      adAccountCurrency: acct.currency || null,
      accessToken: longToken,
      tokenExpiresAt,
      connectedByUserId: member.userId,
    });
    return toSettings(origin, { metaConnected: "1" });
  }

  // More than one ad account: the token is held server-side, in an httpOnly
  // cookie, NEVER in the redirect URL — the settings page renders a picker
  // from the (id, name, currency) list below and POSTs the chosen id to
  // /api/meta-ads/finalize, which is the only place the token is read back
  // out and actually saved.
  const pendingPayload = JSON.stringify({
    token: longToken,
    tokenExpiresAt: tokenExpiresAt ? tokenExpiresAt.toISOString() : null,
  });
  cookieStore.set(PENDING_TOKEN_COOKIE, pendingPayload, baseCookieOptions());

  const pickList = accounts.map((a) => ({ id: a.id, name: a.name || a.id, currency: a.currency || null }));
  return toSettings(origin, { metaPickAccount: JSON.stringify(pickList) });
}
