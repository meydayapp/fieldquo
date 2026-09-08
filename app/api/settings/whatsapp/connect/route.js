// app/api/settings/whatsapp/connect/route.js
//
// Starts Meta's Embedded Signup for a contractor's own WhatsApp Business
// number — a different consent screen again from Meta Ads, Page publishing and
// lead forms, with its own configuration id, its own cookie and its own
// stored channel.
//
// ══ The refusal is the point ═══════════════════════════════════════════════
//
// `whatsapp_business_messaging` is NOT approved for this app. So on every
// production deployment today this route takes its first branch and redirects
// back to Settings saying so. The panel hides the link for the same reason —
// and both halves ship together, because hiding a control is not access
// control (AGENTS.md). This is the half that refuses a typed URL.
//
// A GET that redirects, where Meta Ads uses a POST returning a URL: the same
// trade app/api/settings/social/connect spells out. What a stray cross-site
// GET could accomplish here is minting a state cookie this app generated and
// receiving a redirect the browser will not follow. It cannot connect
// anything — that still requires the person to complete Meta's own signup and
// approve it there.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaFullyConfigured, metaWhatsAppEnabled } from "@/lib/meta/client";
import { getAppOrigin } from "@/lib/appUrl";
import { WHATSAPP_STATE_COOKIE, baseCookieOptions } from "@/lib/meta/oauthCookies";
import { buildWhatsAppSignupUrl } from "@/lib/messaging/whatsappSignup";
import { WHATSAPP_SETTINGS_PATH } from "@/lib/messaging/whatsappSettingsPath";

export async function GET(request) {
  const origin = getAppOrigin(request);
  const settings = (params) =>
    NextResponse.redirect(`${origin}${WHATSAPP_SETTINGS_PATH}?${new URLSearchParams(params)}`);

  const { member, response } = await memberOrRefusal(request);
  // A refusal here is a JSON 401/402/403 — right for a fetch, wrong for a
  // navigation, but this route is only reached BY a navigation from a screen
  // the same gate already guards. Redirecting an unauthenticated stranger into
  // /app instead would hide the refusal rather than state it.
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // The flag, checked server-side and not only in the panel that hides the
  // link. Sending someone to Embedded Signup for a permission Meta has not
  // granted shows them a dialog that errors on Meta's side.
  if (!metaWhatsAppEnabled()) {
    return settings({ whatsappError: "awaiting_review" });
  }

  if (!metaFullyConfigured()) {
    return settings({ whatsappError: "not_configured" });
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/settings/whatsapp/callback`;
  const url = buildWhatsAppSignupUrl({ redirectUri, state });
  if (!url) {
    // No META_WHATSAPP_CONFIG_ID. Its own reason, not folded into
    // "not_configured": the fix is one specific thing created once in the App
    // Dashboard, and a contractor's admin needs to be told which.
    return settings({ whatsappError: "no_signup_config" });
  }

  const cookieStore = await cookies();
  // The companyId travels with the state so the callback can refuse a session
  // that changed tenants mid-flow — same reasoning as every other Meta connect
  // route here.
  cookieStore.set(WHATSAPP_STATE_COOKIE, `${state}:${member.companyId}`, baseCookieOptions());

  return NextResponse.redirect(url);
}
