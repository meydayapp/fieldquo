// app/api/analytics/digests/route.js
//
// The company's own monthly AI digests, newest first. Read-only — digests are
// written by the monthly cron (app/api/cron/monthly-digest), never here.
//
// This route didn't exist. app/app/analytics/digest/page.js has been calling
// it since it was written, so the Monthly Digest page has always shown an
// empty list: fetch 404s, `res` is the error object, and `setDigests(res)`
// stores a non-array that renders as nothing. A build never catches this
// because the URL is just a string.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const digests = await db.aiDigest.findMany({
    where: { companyId: member.companyId },
    orderBy: { periodStart: "desc" },
    take: 24, // two years of monthly digests is more than anyone scrolls
  });

  return NextResponse.json(digests);
}
