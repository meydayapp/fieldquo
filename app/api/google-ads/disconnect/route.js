// app/api/google-ads/disconnect/route.js
//
// Disconnect: the connection row is deleted (the only copy of the token) and
// the grant is revoked at Google, best effort. The spend rows already
// imported STAY — they are the company's history; a disconnect is not a
// request to rewrite it. Same gate as the Meta Ads disconnect.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { decryptToken } from "@/lib/meta/tokenCrypto";
import { revokeGoogleToken } from "@/lib/googleAds/client";
import { deleteGoogleAdsConnection } from "@/lib/googleAds/connection";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });

  const existing = await deleteGoogleAdsConnection(member.companyId);
  if (!existing) return NextResponse.json({ ok: true, wasConnected: false });

  try {
    await revokeGoogleToken(decryptToken(existing.refreshTokenEnc));
  } catch {
    // Google refusing, or a row that will not decrypt, must never keep the
    // connection alive. It is gone.
  }
  await recordActivity(member, {
    action: "marketing_spend.google_ads_disconnected",
    entityType: "company",
    entityId: member.companyId,
    summary: "Disconnected Google Ads",
  });
  return NextResponse.json({ ok: true, wasConnected: true });
}
