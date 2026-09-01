// app/api/meta-ads/finalize/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { getAdAccount } from "@/lib/meta/client";
import { saveConnection } from "@/lib/meta/connection";
import { PENDING_TOKEN_COOKIE } from "@/lib/meta/oauthCookies";

// The second half of a multi-ad-account connect: app/api/meta-ads/callback
// left the long-lived token in an httpOnly cookie and sent the browser to
// the settings screen with a list of accounts to choose from. This is where
// a choice actually becomes a saved MetaAdConnection — the token never
// appears in a URL or in the settings page's own state at any point.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const { adAccountId } = await request.json();
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(PENDING_TOKEN_COOKIE)?.value;
  cookieStore.delete(PENDING_TOKEN_COOKIE);
  if (!pendingRaw) {
    return NextResponse.json(
      { error: "That connection attempt expired — start over from \"Connect Meta Ads\"." },
      { status: 409 },
    );
  }

  let pending;
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return NextResponse.json({ error: "That connection attempt is corrupted — start over." }, { status: 409 });
  }
  if (!pending?.token) {
    return NextResponse.json({ error: "That connection attempt expired — start over." }, { status: 409 });
  }

  const acctRes = await getAdAccount({ accessToken: pending.token, adAccountId });
  if (!acctRes.ok) {
    return NextResponse.json({ error: `Could not confirm that ad account with Meta (${acctRes.kind}).` }, { status: 502 });
  }

  await saveConnection({
    companyId: member.companyId,
    adAccountId: acctRes.data.id,
    adAccountName: acctRes.data.name || null,
    adAccountCurrency: acctRes.data.currency || null,
    accessToken: pending.token,
    tokenExpiresAt: pending.tokenExpiresAt ? new Date(pending.tokenExpiresAt) : null,
    connectedByUserId: member.userId,
  });

  return NextResponse.json({ success: true });
}
