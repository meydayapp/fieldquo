// app/api/reviews/google/disconnect/route.js
//
// Disconnect: revoke at Google (best effort), delete the row, and delete
// every cached review — Google's content leaves with the authority to hold it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";
import { decryptToken } from "@/lib/meta/tokenCrypto";
import { revokeGoogleToken } from "@/lib/reviews/googleBusiness/client";
import { deleteBusinessConnection } from "@/lib/reviews/googleBusiness/connection";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const existing = await deleteBusinessConnection(member.companyId);
  if (!existing) return NextResponse.json({ ok: true, wasConnected: false });

  try {
    await revokeGoogleToken(decryptToken(existing.refreshTokenEnc));
  } catch {
    // A refusal from Google must never stop the row being gone. It is.
  }

  await recordActivity(member, {
    action: "reviews.google_disconnected",
    entityType: "company",
    entityId: member.companyId,
    summary: "Disconnected the Google Business Profile",
  });
  return NextResponse.json({ ok: true, wasConnected: true });
}
