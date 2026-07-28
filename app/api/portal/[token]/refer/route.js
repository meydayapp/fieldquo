// app/api/portal/[token]/refer/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";

function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
    include: { referralLinks: true },
  });
  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  let referral = client.referralLinks[0];

  if (!referral) {
    referral = await db.referralLink.create({
      data: { clientId: client.id, code: generateReferralCode() },
    });
  }

  const baseUrl = getAppOrigin(request);

  return NextResponse.json({
    code: referral.code,
    shareUrl: `${baseUrl}/refer/${referral.code}`,
    referredCount: referral.referredCount,
  });
}
