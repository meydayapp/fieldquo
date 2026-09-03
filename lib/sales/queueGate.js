// lib/sales/queueGate.js
//
// The door for the one route a rep claims a prospect through, and nothing else.
//
// ══ Why a FOURTH gate and not a widening of any of the three ══════════════
//
// lib/sales/gate.js refuses every non-GET under /api/sales, and its header
// gives the reason: commission is paid on events a rep is close to, so a rep
// who can write is a rep who can pay themselves. lib/sales/outreachGate.js is
// the named exception in front of the rep's own notes — SalesLead, SalesThread,
// SalesMessage, SalesRepNote. lib/sales/smsGate.js is the named exception in
// front of the one route that spends money at a carrier.
//
// A claim is none of those. It writes `Prospect` — org-wide discovered data
// that is emphatically NOT the rep's own notes (Prospect and SalesLead are two
// entities joined by a nullable FK precisely because they are two things), it
// does not leave the building, and it costs nothing. What it decides is which
// rep phones which stranger: an operational lock, not a money decision and not
// a compliance one.
//
// Putting it on the outreach list would say Prospect and SalesLead are governed
// by one rule. Putting it on gate.js would grant a write to every route under
// /api/sales. So: a fourth short list, in its own file, the shape
// smsGate.js's header argues for — "three short, explicit lists beat one gate
// with a mode parameter", and four is still short enough to read.
//
// The identity half is NOT re-implemented. canAuthenticate() is imported from
// lib/sales/invite.js — the same function the other three gates call — so no
// two of them can disagree about who is allowed in without one failing to
// compile. What is duplicated is the fresh read, and that duplication is the
// point: a rep deactivated at 9am must stop being able to claim prospects at
// 9:01, not when their twelve-hour token expires.

import { db } from "@/lib/db";
import { getCurrentSalesRep } from "./auth";
import { canAuthenticate } from "./invite";

/**
 * The tables this gate permits a write to, and the complete list of them.
 *
 * Written down for the reason gate.js writes REP_FORBIDDEN_WRITES down and the
 * other two gates write their own lists down: the rule should be discoverable
 * from the file rather than only from the absence of code.
 *
 *   prospect  assignedRepId / assignedAt / claimExpiresAt — the lease itself.
 *             Plus doNotContactAt / doNotContactReason, which a rep sets
 *             because a rep is the person who HEARS "take me off your list",
 *             and a rep who hears that and has no button is the dead control
 *             AGENTS.md forbids, inverted.
 *
 * `salesSuppression` is deliberately ABSENT, for the reason smsGate.js gives
 * for the same absence: that list is FieldQuo-wide, it binds every channel, and
 * only a superadmin lifts an entry. A rep marking one prospect do-not-contact
 * is a fact about that prospect, not an entry on the platform list.
 *
 * scripts/check-prospect-ui.mjs asserts the queue route writes to this model
 * and no other.
 */
export const REP_QUEUE_WRITES = ["prospect"];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireQueueRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching all three
 * other gates and lib/permissions/enforce.js's permissionErrorResponse, so this
 * module stays importable by a check script that cannot resolve "next/server"
 * — and so the route builds its own response, which check:refusal-shape
 * requires.
 */
export async function requireQueueRep(request) {
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
      active: true,
      endedAt: true,
      acceptedAt: true,
      // Read only so canAuthenticate can answer its own question rather than
      // being handed a boolean somebody else decided, and stripped again below
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
