// app/api/sales/agency/performance/route.js
//
// The agency's own performance page: the same report the platform reads
// (lib/sales/performanceLoad.js → lib/sales/performanceReport.js), scoped
// to ITS team and nobody else's.
//
// ══ The scope is read fresh, every request ════════════════════════════════
//
// agencyTeamIds() then repViewer/visibleRepIds — the fragment the agency's
// floor route uses, for the same reason: a rep moved off the agency's line
// at 09:00 is off its report at 09:01, and nothing here trusts an id the
// browser sent. A non-agency account is refused with a sentence, never
// handed an empty report that reads as "your team sold nothing".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { agencyTeamIds, isAgency } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { loadPerformanceReport, performanceBounds } from "@/lib/sales/performanceLoad";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) {
    return NextResponse.json({ error: "Only an agency account has a team performance page.", code: "not_agency" }, { status: 403 });
  }

  const teamIds = await agencyTeamIds(rep.id);
  const repIds = visibleRepIds(repViewer(rep.id, teamIds));
  const { from, to } = performanceBounds(new URL(request.url).searchParams.get("preset") || "thisMonth");

  const report = await loadPerformanceReport({ from, to, repIds });
  return NextResponse.json(report);
}
