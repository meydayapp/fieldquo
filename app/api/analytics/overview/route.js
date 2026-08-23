// app/api/analytics/overview/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── revenue, invoiced totals, conversion and the goal — the dashboard's money ──
  //
  // showPricing is what tells the app this person does not see money. The
  // price book, the job cost panel and the quote totals all honour it; these
  // aggregates did not, so the figures refused in detail were served up as
  // totals. sibling pricing-benchmark/route.js has carried this gate all
  // along, which is what makes the omission here an oversight rather than a
  // decision.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireToggle(full, "showPricing", "see this");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

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
