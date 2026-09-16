// app/api/sales/agency/[id]/route.js
//
// An agency deactivating or reactivating one of its own reps.
//
// Same gate, same hand-off and same refusals as the platform's button —
// lib/sales/repActivation.js, reached through lib/sales/agency.js's
// setAgencyRepActive, which adds the one narrowing that is the agency's:
// the rep must be on ITS team (read fresh, scoped on id AND manager), and
// held work may only move to another rep on that team. Nothing else on the
// row is writable from here: not the plan, not the engagement, not the
// manager, not the code. A body that names them is ignored.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { isAgency, setAgencyRepActive } from "@/lib/sales/agency";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json({ error: "Only an agency account has a team.", code: "not_agency" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Send active: true or false." }, { status: 400 });
  }

  const result = await setAgencyRepActive({
    agency: rep,
    salesRepId: id,
    active: body.active,
    handoff: body.handoff ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.code ? { code: result.code, cannot: result.cannot } : {}),
        ...(result.counts ? { counts: result.counts } : {}),
      },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json({ ok: true, rep: result.rep, unchanged: Boolean(result.unchanged), handoff: result.handoff || null });
}
