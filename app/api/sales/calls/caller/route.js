// app/api/sales/calls/caller/route.js
//
// "Who is ringing?" — the sentence the incoming-call drawer prints beside the
// number while the phone is still ringing.
//
// GET ?from=+1613… → { outcome, businessName, holder }
//   outcome       lib/sales/calls/inboundMatch.js's answer — prospect, lead,
//                 ambiguous, none, unknown. The SAME matcher the inbound
//                 webhook runs, on the same two reads, so the drawer never
//                 names a business the routing would not have.
//   businessName  the matched business, or null. Null is printed as the bare
//                 number; nothing is guessed from an area code.
//   holder        { repId, name, mine } for the rep whose claim or lead this
//                 is, or null when nobody holds it. `mine` is decided here
//                 against the session's rep, never by the browser.
//
// Read-only. The answer is a label; whether the call is offered to this rep
// was decided by ringPlan() before this browser rang, and nothing here can
// change that — see IncomingCallDock.js's "registered is not the same as
// being rung".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { matchInboundCaller, MATCH_LEAD, MATCH_PROSPECT } from "@/lib/sales/calls/inboundMatch";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const caller = normalisePhone(url.searchParams.get("from") || "");

  const [prospects, leads] = await Promise.all([
    caller
      ? db.prospect
          .findMany({
            where: { phoneE164: caller },
            select: { id: true, businessName: true, assignedRepId: true, province: true },
            take: 5,
          })
          .catch(() => [])
      : Promise.resolve([]),
    caller
      ? db.salesLead
          .findMany({
            where: { phone: caller },
            select: { id: true, businessName: true, salesRepId: true, prospectId: true },
            take: 5,
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const match = matchInboundCaller({ fromE164: caller, prospects, leads });
  let businessName = null;
  if (match.outcome === MATCH_PROSPECT) businessName = prospects.find((p) => p.id === match.prospectId)?.businessName || null;
  if (match.outcome === MATCH_LEAD) businessName = leads.find((l) => l.id === match.salesLeadId)?.businessName || null;

  let holder = null;
  if (match.salesRepId) {
    const row =
      match.salesRepId === rep.id
        ? { id: rep.id, name: rep.name }
        : await db.salesRep.findUnique({ where: { id: match.salesRepId }, select: { id: true, name: true } }).catch(() => null);
    if (row) holder = { repId: row.id, name: row.name || null, mine: row.id === rep.id };
  }

  return NextResponse.json({ outcome: match.outcome, businessName, holder });
}
