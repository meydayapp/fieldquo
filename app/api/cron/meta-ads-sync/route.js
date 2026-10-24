// app/api/cron/meta-ads-sync/route.js
//
// Daily: every company with a Meta ad account picked gets its last 30 days of
// campaign × day spend re-read — lib/meta/syncSpend.js, the same function
// "Sync now" runs. Meta restates figures for about a month, so a fixed
// look-back is the honest window rather than "since we last looked".
//
// ══ Why this exists at all ═════════════════════════════════════════════════
//
// Until 2026-10-24 there was NO scheduled Meta sync. app/api/meta-ads/sync
// only ran when somebody pressed a button, which meant /app/marketing/spend,
// the KPIs page, the finance overview and the AI monthly digest all showed
// whatever the last person to press it had fetched. Google Ads has had
// app/api/cron/google-ads-sync for the same job all along; this is the gap
// beside it, closed in the same shape.
//
// It also matters for Meta's own paperwork. The Marketing API Standard
// access tier is granted on evidence of real, successful API usage over
// fifteen days, and FieldQuo's App Review was refused it in October 2026 for
// want of call volume — unsurprising when the only caller was a button. One
// honest call per connected company per day is the right way to earn that,
// and the wrong way is to manufacture calls: Meta scores the error rate too.
//
// A connection in needs_reauth is skipped — its grant is gone, and retrying
// it nightly would only re-stamp the same refusal and push the account's
// error rate up for nothing. It comes back when someone reconnects.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { metaFullyConfigured } from "@/lib/meta/client";
import { syncMetaAdsCompany } from "@/lib/meta/syncSpend";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // No app credentials or no token-encryption key means every token on file
  // is unreadable. Answering "skipped" is the truthful result; marching
  // through the table to write `error` on every company's connection would
  // turn a deployment gap into a row of accusations against contractors who
  // did nothing wrong.
  if (!metaFullyConfigured()) return NextResponse.json({ skipped: "not_configured" });

  // No `adAccountId: { not: null }` here, unlike the Google cron beside it:
  // on MetaAdConnection that column is required (schema.prisma), so the
  // filter would be noise that reads as though the row might not have one.
  const connections = await db.metaAdConnection.findMany({
    where: { status: { not: "needs_reauth" } },
  });

  const out = { companies: connections.length, synced: 0, failed: 0, kinds: {} };
  for (const connection of connections) {
    try {
      const result = await syncMetaAdsCompany(connection);
      if (result.ok) {
        out.synced++;
      } else {
        out.failed++;
        out.kinds[result.kind] = (out.kinds[result.kind] || 0) + 1;
      }
    } catch (err) {
      // One company's failure must not end the run. The next contractor in
      // the table has nothing to do with this one's bad row, and a loop that
      // dies on the first exception silently stops syncing everybody after
      // it in whatever order Prisma happened to return.
      out.failed++;
      out.kinds.exception = (out.kinds.exception || 0) + 1;
      console.error("[cron/meta-ads-sync]", connection.companyId, err?.message);
    }
  }
  return NextResponse.json(out);
}
