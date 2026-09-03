// lib/sales/outreachGate.js
//
// The door for the outreach routes — the only routes under /api/sales a rep is
// allowed to write through.
//
// ══ Why this exists beside lib/sales/gate.js rather than inside it ═════════
//
// gate.js's requireSalesRep() refuses every non-GET method under /api/sales,
// and its header explains exactly why that is right for what it guards:
// commission is paid on events a rep is close to, so a rep who can write their
// own attribution or ledger is a rep who can pay themselves. Its
// REP_FORBIDDEN_WRITES list is that argument written down — attribution,
// commission entries, payout batches, subscriptions, payments, and the rep's
// own row.
//
// A rep's own outreach is not on that list, and cannot be: the whole feature is
// a rep logging a prospect and typing an email to them. SalesLead, SalesThread
// and SalesMessage are the rep's own working notes about people who are not yet
// customers. Nothing about them decides money. Writing one moves no milestone,
// mints no commission entry, and touches no company.
//
// So the split is: gate.js stays the blanket read-only rule for the portal's
// reporting surfaces, and this is the narrow, named exception in front of the
// three tables that ARE the rep's own work. It deliberately does not widen
// gate.js — a single gate with a mode parameter would be one edit away from
// granting a write anywhere under /api/sales, and the thing worth protecting
// here is that the list of writable tables is short, explicit, and impossible
// to extend by accident.
//
// The identity half is NOT re-implemented. canAuthenticate() is imported from
// lib/sales/invite.js — the same function gate.js calls — so the two gates
// cannot disagree about who is allowed in without one of them failing to
// compile. What is duplicated is the eight-line fresh read, and that
// duplication is the point: a rep deactivated at 9am must stop being able to
// email prospects at 9:01, not when their twelve-hour token expires.

import { db } from "@/lib/db";
import { getCurrentSalesRep } from "./auth";
import { canAuthenticate } from "./invite";

/**
 * The tables a rep may write through the outreach routes, and the complete
 * list of them.
 *
 * Written down for the reason gate.js writes REP_FORBIDDEN_WRITES down and
 * lib/platform/permissions.js writes SUPERADMIN_ONLY_PERMISSIONS down: the rule
 * should be discoverable from the file rather than only from the absence of
 * code. scripts/check-sales-outreach.mjs asserts that no route under
 * /api/sales writes to a Prisma model outside this list.
 */
// salesRepNote joined the list on 2026-09-02. It belongs on it for exactly the
// reason the header gives for the other three and no new one: a note is the
// rep's own account of a conversation with somebody who is not a customer, it
// moves no milestone and mints no commission entry, and the feature is
// meaningless without a write. What is NOT on the list, and must not be, is any
// path for a rep to edit somebody else's note — that guard is in the WHERE of
// the write itself, in lib/sales/notes/write.js.
export const REP_OUTREACH_WRITES = [
  "salesLead",
  "salesThread",
  "salesMessage",
  "salesRepNote",
];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireOutreachRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching gate.js and
 * lib/permissions/enforce.js's permissionErrorResponse, so this module stays
 * importable by a check script that cannot resolve "next/server" — and so the
 * route builds its own response, which check:refusal-shape requires.
 */
export async function requireOutreachRep(request) {
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
