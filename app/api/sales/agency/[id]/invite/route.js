// app/api/sales/agency/[id]/invite/route.js
//
// An agency re-sending one of its reps' invitations. The refusals are the
// platform route's (app/api/platform/sales/reps/[id]/invite): an accepted
// rep already has a way in, a deactivated one is reactivated first. The rep
// must be on the agency's own team — lib/sales/agency.js reinviteAgencyRep
// reads the row scoped on id AND manager.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { isAgency, reinviteAgencyRep } from "@/lib/sales/agency";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json({ error: "Only an agency account has a team.", code: "not_agency" }, { status: 403 });

  const result = await reinviteAgencyRep({ agency: rep, salesRepId: id, request });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ sent: true });
}
