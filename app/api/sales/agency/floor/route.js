// app/api/sales/agency/floor/route.js
//
// The agency's own floor: who on ITS team is signed in, on a call, paused,
// and what their day's calls came to — and nobody else's.
//
// ══ The scope is lib/sales/team.js's, finally with rows to narrow ═════════
//
// repViewer(agency.id, teamIds) → visibleRepIds() is the fragment that file
// was written for on 2026-09-03 and that had no caller until an agency became
// the first thing to fill `managerId` in. The team ids are read fresh in
// this request (agencyTeamIds); a rep moved off the agency's line at 09:00
// is off its board at 09:01. The board itself is the platform's own
// function, lib/sales/calls/floorBoard.js, so the two cannot disagree about
// a rep's state. What the platform's route adds and this one does not:
// FieldQuo's inbound line, its number pool, and the inbound-call list —
// TEAM_LEAD_CANNOT_SEE says why those stay a superadmin's.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { agencyTeamIds, isAgency } from "@/lib/sales/agency";
import { floorBoard } from "@/lib/sales/calls/floorBoard";
import { repViewer, visibleRepIds } from "@/lib/sales/team";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json({ error: "Only an agency account has a team floor.", code: "not_agency" }, { status: 403 });

  const teamIds = await agencyTeamIds(rep.id);
  const viewer = repViewer(rep.id, teamIds);
  const board = await floorBoard({ repIds: visibleRepIds(viewer), now: new Date() });

  return NextResponse.json({
    store: board.store,
    period: board.period,
    reps: board.reps,
    states: board.states,
    pauseReasons: board.pauseReasons,
    campaigns: board.campaigns,
    notTracked: board.notTracked,
    serverNow: board.serverNow,
    scope: { agencyId: rep.id, repIds: visibleRepIds(viewer) },
  });
}
