// app/api/sales/calls/people/route.js
//
// Who a rep can ring inside FieldQuo, and whether they may ring outside
// it — the data behind the Team page's People card (app/components/sales/
// PeopleCard.js).
//
// ══ The dot is presence, the same presence the router reads ═══════════════
//
// `reachable` from lib/sales/calls/inboundDistribution.js — one opinion
// about who is at their desk, shared with the inbound ring plan and the
// transfer picker. A colleague is listed whether or not they are reachable
// (a team list with half the team missing reads as half the team gone),
// but the Call button is only live for one who is: the dial route refuses
// the rest anyway, and a button that would be refused is not drawn.
//
// ══ Nothing here is a phone number ════════════════════════════════════════
//
// A colleague is an id; the bridge turns it into a client identity. The
// off-campaign form is offered only when the rep's row says so (read
// fresh by the gate), and the states it lists come from callingRules.js so
// the rep can only name a jurisdiction the law table knows.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState, presenceFor } from "@/lib/sales/calls/store";
import { reachable, presenceOf } from "@/lib/sales/calls/inboundDistribution";
import { subdivisionOptions } from "@/lib/sales/callingRules";
import { agencyOf } from "@/lib/sales/agencyLabel";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const reps = await db.salesRep
    .findMany({
      where: { active: true, id: { not: rep.id }, kind: { in: ["rep", "agency"] } },
      select: { id: true, name: true, kind: true, engagement: true, managerId: true, manager: { select: { id: true, kind: true, name: true } } },
      orderBy: { name: "asc" },
    })
    .catch(() => []);
  const presence = callStoreState().ready ? await presenceFor(reps.map((r) => r.id), { now }).catch(() => null) : null;
  const byId = new Map((Array.isArray(presence) ? presence : []).map((p) => [p?.salesRepId, presenceOf(p)]));

  return NextResponse.json({
    canCallColleagues: rep.canCallColleagues !== false,
    canCallOffCampaign: rep.canCallOffCampaign === true,
    people: reps.map((r) => {
      const p = byId.get(r.id) || null;
      return {
        id: r.id,
        name: r.name,
        agency: r.kind === "agency" ? { id: r.id, name: r.name } : agencyOf(r),
        // "reachable" is the router's word: available, not stale, heard
        // from inside the window. `state` is what they declared, for the
        // label beside the dot; null when they never have.
        reachable: Boolean(p) && reachable(p, now),
        state: p?.state || null,
        stale: p?.stale === true,
      };
    }),
    // For the off-campaign form's "where does this phone ring" picker.
    subdivisions: rep.canCallOffCampaign === true ? subdivisionOptions() : [],
    serverNow: now.toISOString(),
  });
}
