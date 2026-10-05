// app/api/google-ads/sync/route.js
//
// "Sync now" on Settings › Google Ads. The same lib/googleAds/sync.js the
// daily cron runs; this one takes an optional { since, until } (at most 90
// days) and answers with what it did, so the card can say "12 new, 30
// updated, 3 skipped as already logged".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { googleAdsAvailable } from "@/lib/googleAds/client";
import { getGoogleAdsConnection } from "@/lib/googleAds/connection";
import { syncGoogleAdsCompany } from "@/lib/googleAds/sync";

const HTTP_FOR_KIND = {
  no_account: 409,
  bad_range: 400,
  auth_error: 401,
  rate_limited: 429,
  decrypt: 500,
};

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  if (!googleAdsAvailable()) {
    return NextResponse.json({ error: "Google Ads isn't available on this deployment yet.", kind: "not_configured" }, { status: 400 });
  }

  const connection = await getGoogleAdsConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "No Google Ads connection for this company yet." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const result = await syncGoogleAdsCompany(connection, { since: body?.since || null, until: body?.until || null });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, kind: result.kind }, { status: HTTP_FOR_KIND[result.kind] || 502 });
  }
  return NextResponse.json(result);
}
