// app/api/cron/google-ads-sync/route.js
//
// Daily: every company with a Google Ads account picked gets its last 30 days
// of campaign × day spend re-read (Google restates conversions for about a
// month) — lib/googleAds/sync.js, the same function "Sync now" runs. One
// company at a time: the developer token's daily operation quota is shared
// across every tenant, and one searchStream per company is one operation.
//
// A connection marked needs_reauth is skipped — its grant is gone, and
// retrying it nightly would only re-stamp the same refusal. It comes back
// when someone reconnects.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { googleAdsAvailable } from "@/lib/googleAds/client";
import { syncGoogleAdsCompany } from "@/lib/googleAds/sync";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  if (!googleAdsAvailable()) return NextResponse.json({ skipped: "not_configured" });

  const connections = await db.googleAdsConnection.findMany({
    where: { customerId: { not: null }, status: { not: "needs_reauth" } },
  });
  const out = { companies: connections.length, synced: 0, failed: 0, kinds: {} };
  for (const connection of connections) {
    try {
      const result = await syncGoogleAdsCompany(connection);
      if (result.ok) out.synced++;
      else {
        out.failed++;
        out.kinds[result.kind] = (out.kinds[result.kind] || 0) + 1;
      }
    } catch (err) {
      out.failed++;
      out.kinds.exception = (out.kinds.exception || 0) + 1;
      console.error("[cron/google-ads-sync]", connection.companyId, err?.message);
    }
  }
  return NextResponse.json(out);
}
