// lib/sales/calendar/gate.js
//
// The write door for a rep's own calendar — the sixth narrow exception to the
// rule that the sales portal is read-only.
//
// ══ Why its own gate, and not a widening of an existing one ═════════════════
//
// The sales portal has one read gate (lib/sales/gate.js, requireSalesRep) that
// refuses every write, and a short, deliberately-grown list of write gates that
// each name — in one place, in their own file — the exact tables they permit:
// outreach (SalesLead/SalesThread/SalesMessage/SalesRepNote), sms (SalesSmsMessage),
// queue (Prospect), calling (SalesCallAttempt/SalesRepActivity/SalesSuppression).
// check:sales-auth asserts that every /api/sales route resolves its rep through
// one of those named gates, so a new write capability CANNOT be a mode
// parameter bolted onto an existing gate — it has to be a visible edit here and
// a matching entry in SALES_GATES, which is the whole point.
//
// A calendar entry is none of the things the other gates guard: it moves no
// milestone, mints no commission, sends nothing to a stranger, and claims no
// prospect out of another rep's queue. It is the rep's own note-to-self that
// they will phone Dave on Tuesday. So it gets the smallest possible list.
//
// ══ What it permits ════════════════════════════════════════════════════════
//
// SalesEvent, and nothing else. The per-row boundary — that a rep only ever
// writes their OWN events — is not here; it is in the WHERE of every write in
// the route (salesRepId: rep.id), exactly as leadWhere(rep.id) carries it for
// the outreach routes. This gate answers only "is this a signed-in, still-
// employed rep", through the SAME canAuthenticate the other five use, so a rep
// deactivated mid-session stops being able to write the moment the row says so.

import { db } from "@/lib/db";
import { getCurrentSalesRep } from "../auth";
import { canAuthenticate } from "../invite";

/**
 * The tables a rep may write through the calendar routes, and the complete
 * list of them. Written down for the reason outreachGate.js writes
 * REP_OUTREACH_WRITES down: the rule should be discoverable from the file, and
 * scripts/check-sales-auth.mjs holds the route to it.
 */
export const REP_CALENDAR_WRITES = ["salesEvent"];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireCalendarRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching gate.js, so
 * this module stays importable by the check script (which cannot resolve
 * next/server) and the route builds its own response — check:refusal-shape's
 * rule.
 */
export async function requireCalendarRep(request) {
  const claims = await getCurrentSalesRep(request);
  if (!claims) {
    return {
      rep: null,
      refusal: { status: 401, body: { error: "Sign in to the sales portal." } },
    };
  }

  const row = await db.salesRep.findUnique({
    where: { id: claims.salesRepId },
    select: {
      id: true,
      email: true,
      name: true,
      workEmail: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
      // Read only so canAuthenticate answers its own question; stripped below
      // before the row can be spread into a response.
      passwordHash: true,
    },
  });

  if (!canAuthenticate(row)) {
    return {
      rep: null,
      refusal: {
        status: 401,
        body: { error: "This sales account is no longer active." },
      },
    };
  }

  const { passwordHash: _passwordHash, ...rep } = row;
  return { rep, refusal: null };
}
