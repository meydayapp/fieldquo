// app/api/settings/meta-conversions/pixels/route.js
//
// GET — the Meta pixels (datasets) the company's connected ad account owns,
// for the "pick one" list on Send lead results to Meta. Read with the ad
// connection's ads_read token; a company with no ad connection gets an empty
// list and a reason, and types its dataset id instead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { getConnection, getDecryptedToken } from "@/lib/meta/connection";
import { listAdAccountPixels } from "@/lib/meta/client";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  const connection = await getConnection(member.companyId);
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ pixels: [], reason: "no_ad_account" });
  }
  let token;
  try {
    token = getDecryptedToken(connection);
  } catch {
    return NextResponse.json({ pixels: [], reason: "auth_error" });
  }
  const res = await listAdAccountPixels({ accessToken: token, adAccountId: connection.adAccountId }).catch(() => ({ ok: false, kind: "network" }));
  if (!res.ok) return NextResponse.json({ pixels: [], reason: res.kind || "unknown_error" });
  const pixels = (Array.isArray(res.data?.data) ? res.data.data : [])
    .filter((p) => p && /^\d{15,16}$/.test(String(p.id)))
    .map((p) => ({ id: String(p.id), name: typeof p.name === "string" ? p.name.slice(0, 120) : null }));
  return NextResponse.json({ pixels, reason: pixels.length ? null : "none" });
}
