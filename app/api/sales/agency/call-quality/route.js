// app/api/sales/agency/call-quality/route.js
//
// The agency's review queue: its employees' recorded calls, lowest-scored
// and unreviewed first. Same reader as the platform's
// (lib/sales/calls/qaQueue.js), scoped by a team list read fresh in this
// request — see the performance route beside this one for why fresh.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { agencyTeamIds, isAgency } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { callQaQueue } from "@/lib/sales/calls/qaQueue";

function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) {
    return NextResponse.json({ error: "Only an agency account reviews its team's calls.", code: "not_agency" }, { status: 403 });
  }
  const teamIds = await agencyTeamIds(rep.id);
  const repIds = visibleRepIds(repViewer(rep.id, teamIds));
  const q = new URL(request.url).searchParams;
  const rows = await callQaQueue({
    repIds,
    from: dateOrNull(q.get("from")),
    to: dateOrNull(q.get("to")),
    repId: q.get("repId") || null,
    state: q.get("state") || null,
    limit: q.get("limit") || undefined,
  });
  return NextResponse.json({ rows, scope: { agencyId: rep.id, repIds }, serverNow: new Date().toISOString() });
}
