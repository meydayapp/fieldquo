// app/api/sales/checkins/waiting/route.js
//
// The drafts waiting for this rep to press Send — for the Today card.
//
// One read of lib/sales/checkin/waiting.js's waitingDraftsFor(), the same
// function the sidebar badge (/api/sales/badges) and the texts list
// (/api/sales/messages) read, so the three numbers a rep sees are one number.
// GET only, behind the portal's ordinary gate; it writes nothing and it
// cannot send — the module it reads has no send path in it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { waitingDraftsFor } from "@/lib/sales/checkin/waiting";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  try {
    const waiting = await waitingDraftsFor(rep.id);
    return NextResponse.json({ ok: true, ...waiting });
  } catch (err) {
    console.error("[sales checkins waiting]", err?.message || err);
    // Absence, not zero: the card says it could not count rather than "0 waiting".
    return NextResponse.json({ error: "The drafts waiting to be sent could not be counted." }, { status: 500 });
  }
}
