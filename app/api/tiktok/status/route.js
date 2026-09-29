// app/api/tiktok/status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { tiktokAudited, tiktokConfigured } from "@/lib/tiktok/config";
import {
  getLatestTikTokConnection,
  getLiveTikTokConnection,
  publicTikTokShape,
} from "@/lib/tiktok/connection";

// What the TikTok card on Settings › Meta Ads needs to render ONE honest
// state:
//
//   1. not configured  — "TikTok posting — coming soon", no button
//   2. not connected   — a real Connect (and, if an account WAS connected,
//                        why it no longer is)
//   3. connected       — nickname, avatar, missing permissions, Disconnect
//
// Gated like app/api/settings/social/status: billing admins, plus the
// impersonation READ carve-out (middleware refuses every write under it).
// No token is in this response — publicTikTokShape() has no token field.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const configured = tiktokConfigured();
  const live = configured ? await getLiveTikTokConnection(member.companyId) : null;
  const latest = configured && !live ? await getLatestTikTokConnection(member.companyId) : null;

  return NextResponse.json({
    configured,
    audited: tiktokAudited(),
    connection: publicTikTokShape(live),
    // The last connection that ended, so "TikTok removed FieldQuo's access"
    // or "the connection expired" is said rather than a bare Connect button.
    lastDisconnected: latest?.disconnectedAt ? publicTikTokShape(latest) : null,
  });
}
