// app/api/cron/tiktok-token-refresh/route.js
//
// Once a day: roll forward the refresh token of every live TikTok connection
// whose refresh token is within 30 days of its 365-day expiry
// (lib/tiktok/connection.js refreshDueConnections). Access tokens (24h) are
// refreshed on use by getTikTokAccess() and are not this cron's job — this
// exists so a company that connects TikTok and then does not post for a year
// is not silently disconnected by the calendar.
//
// Cheap by construction: one indexed read of a small table, usually zero
// rows, and no TikTok call unless a row is due. Skipped outright when TikTok
// is not configured. Same CRON_SECRET gate as every other cron.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { tiktokConfigured } from "@/lib/tiktok/config";
import { refreshDueConnections } from "@/lib/tiktok/connection";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  if (!tiktokConfigured()) return NextResponse.json({ success: true, skipped: "not_configured" });
  const summary = await refreshDueConnections();
  return NextResponse.json({ success: true, ...summary });
}
