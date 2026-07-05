// app/api/analytics/overview/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { getAnalyticsOverview } from "@/lib/analytics/overview";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getAnalyticsOverview({ companyId: member.companyId });
  return NextResponse.json(result);
}
