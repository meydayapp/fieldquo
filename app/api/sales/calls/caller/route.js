// app/api/sales/calls/caller/route.js
//
// "Who is ringing?" — the sentence the incoming-call dialog prints beside the
// number while the phone is still ringing, and where it may send the rep.
//
// GET ?from=+1613… → { outcome, businessName, city, province, holder, open, notes, save }
//   outcome       lib/sales/calls/inboundMatch.js's answer — prospect, lead,
//                 ambiguous, none, unknown. The SAME matcher the inbound
//                 webhook runs, on the same two reads, so the drawer never
//                 names a business the routing would not have.
//   businessName  the matched business, or null. Null is printed as the bare
//                 number; nothing is guessed from an area code.
//   holder        { repId, name, mine } for the rep whose claim or lead this
//                 is, or null when nobody holds it. `mine` is decided here
//                 against the session's rep, never by the browser.
//   city/province the matched prospect's, or the lead's province; null when
//                 the row has none. Printed, never inferred from the number.
//   open / notes  { kind, href } / { href } — the console card (the rep
//                 holds a live claim) or the lead page (their own lead), or
//                 null when this rep may not open it: held by somebody else,
//                 lapsed, merged, ambiguous. lib/sales/calls/callerLinks.js
//                 decides; the pages re-check scope on their own reads.
//   save          { href } — the new-lead form with the number filled in,
//                 only when the number matched nobody (`none`, not `unknown`).
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
import { callerLinks } from "@/lib/sales/calls/callerLinks";

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
            // The claim's three terms (queueWhere) and the place, for the links.
            select: { id: true, businessName: true, assignedRepId: true, mergedIntoId: true, claimExpiresAt: true, city: true, province: true },
            take: 5,
          })
          .catch(() => [])
      : Promise.resolve([]),
    caller
      ? db.salesLead
          .findMany({
            where: { phone: caller },
            select: { id: true, businessName: true, salesRepId: true, prospectId: true, province: true },
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

  const { open, notes, save, city, province } = callerLinks({ match, prospects, leads, repId: rep.id, now: new Date() });

  // ── "They'd rather text" ──────────────────────────────────────────────
  //
  // The dock's Text them control (app/components/sales/TextThem.js) hands
  // these to /api/sales/messages/start, which re-reads them against the
  // rep. The rep's OWN lead on this number, else the prospect their claim
  // is on (start makes the lead from it); nothing for a number somebody
  // else holds — start refuses that with the holder's name, and the dock
  // prints it — and nothing for a stranger's number, which start opens on
  // a lead made from the number alone.
  const myLead = leads.find((l) => l.salesRepId === rep.id) || null;
  const text = holder?.mine
    ? { leadId: myLead?.id || (match.outcome === MATCH_LEAD ? match.salesLeadId : null) || null, prospectId: match.outcome === MATCH_PROSPECT ? match.prospectId : null }
    : holder
      ? null
      : { leadId: myLead?.id || null, prospectId: null };
  return NextResponse.json({ outcome: match.outcome, businessName, city, province, holder, open, notes, save, text });
}
