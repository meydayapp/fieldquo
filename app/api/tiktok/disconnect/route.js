// app/api/tiktok/disconnect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { decryptToken } from "@/lib/meta/tokenCrypto";
import { revokeToken } from "@/lib/tiktok/client";
import { disconnectTikTokConnection, getLiveTikTokConnection } from "@/lib/tiktok/connection";

// Disconnect TikTok: tell TikTok to revoke FieldQuo's access, THEN destroy the
// stored tokens — in that order, because the revoke call needs the token.
// Same order and the same "best effort in one direction only" as
// app/api/settings/social/disconnect: TikTok refusing the revoke must never
// stop the tokens being destroyed (which is what the person pressing the
// button asked for), but the refusal is recorded on the row and returned, so
// the card says it instead of implying TikTok confirmed.
//
// The row itself is KEPT (lib/tiktok/connection.js rule 2) — tokens nulled,
// disconnectedAt stamped. A POST because it changes stored data.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const row = await getLiveTikTokConnection(member.companyId);
  if (!row) return NextResponse.json({ success: true, disconnected: 0, revoked: null });

  let accessToken = null;
  try {
    accessToken = row.accessTokenEnc ? decryptToken(row.accessTokenEnc) : null;
  } catch {
    accessToken = null;
  }

  // developers.tiktok.com/doc/oauth-user-access-token-management — POST
  // /v2/oauth/revoke/ with the access token; an empty body is success.
  let revoked = null;
  let revokeError = null;
  if (accessToken) {
    const r = await revokeToken({ accessToken });
    revoked = r.ok;
    if (!r.ok) revokeError = `${r.code}${r.logId ? ` (log ${r.logId})` : ""}`;
  } else {
    revoked = false;
    revokeError = "no_readable_token";
  }

  const disconnected = await disconnectTikTokConnection(member.companyId, { reason: "user", revokeError });
  return NextResponse.json({ success: true, disconnected, revoked });
}
