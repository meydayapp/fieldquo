// app/api/meta-ads/status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaAppConfigured, metaFullyConfigured } from "@/lib/meta/client";
import { tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";
import { getConnection, publicConnectionShape } from "@/lib/meta/connection";

// What the settings screen needs to render one of FOUR honest states —
// never a "Connect" button that would 400 the moment it's clicked:
//
//   1. not configured    — no META_APP_ID/META_APP_SECRET at all (this
//                           deployment, today — see docs/META-ADS-BUILD.md)
//   2. configured, not connected — a real "Connect" button would work
//   3. connected          — a live MetaAdConnection row, status "connected"
//   4. needs attention    — connected but status is needs_reauth/error
//
// Gated the same way as Payments (isBillingAdmin) — see
// lib/permissions/settingsAccess.js's "app.settings.metaAds": "billing".
//
// On the READ only, the gate carves out impersonation — same reasoning as
// app/api/stripe/connect/status/route.js: non-negotiable #3 is "view
// everything, edit nothing", "why isn't Meta reporting spend" is exactly the
// kind of question a support session opens for, and middleware already
// rejects every non-GET method under an impersonation cookie, so this can't
// become a write. connect, callback, finalize, disconnect and sync all keep
// the plain billing gate with no carve-out.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const connection = await getConnection(member.companyId);

  return NextResponse.json({
    appConfigured: metaAppConfigured(),
    encryptionConfigured: tokenCryptoConfigured(),
    fullyConfigured: metaFullyConfigured(),
    connection: publicConnectionShape(connection),
  });
}
