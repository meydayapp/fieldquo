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
  // Whether THIS member may set the goal, decided server-side and sent to the
  // card — there's no client-side role provider, and gating the input on a
  // guessed role would either hide it from someone allowed or show it to
  // someone the PUT will 403 anyway.
  return NextResponse.json({
    ...result,
    canEditGoal: member.role === "owner" || member.role === "admin",
  });
}
