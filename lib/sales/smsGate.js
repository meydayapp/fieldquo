// lib/sales/smsGate.js
//
// The door for the one route that texts a prospect, and nothing else.
//
// ══ Why a THIRD gate and not a widening of either existing one ═════════════
//
// lib/sales/gate.js refuses every non-GET under /api/sales, and its header
// says why: commission is paid on events a rep is close to, so a rep who can
// write is a rep who can pay themselves. lib/sales/outreachGate.js is the
// narrow, named exception in front of the three tables that are the rep's own
// working notes — SalesLead, SalesThread, SalesMessage.
//
// Texting is not on either list, and putting it on the outreach one would be
// the wrong shape. What outreachGate guards is a rep writing rows about people
// who are not customers; nothing it permits leaves the building. This route
// SPENDS MONEY at a carrier and puts a message on a stranger's phone, which is
// a different kind of permission entirely — the closest thing in this codebase
// is not another sales gate at all, it is lib/migrations/state.js's canWrite().
//
// So the split is: gate.js is the blanket read-only rule, outreachGate.js
// covers the rep's own notes, and this covers the one route that contacts
// somebody over a channel that costs. Three short, explicit lists beat one gate
// with a mode parameter, for the reason outreachGate's own header gives: a mode
// parameter is one edit away from granting a write anywhere under /api/sales.
//
// The identity half is NOT re-implemented. canAuthenticate() is imported from
// lib/sales/invite.js — the same function both other gates call — so the three
// cannot disagree about who is allowed in without one of them failing to
// compile. What is duplicated is the fresh read, and that duplication is the
// point: a rep deactivated at 9am must stop being able to text prospects at
// 9:01, not when their twelve-hour token expires.

import { db } from "@/lib/db";
import { getCurrentSalesRep } from "./auth";
import { canAuthenticate } from "./invite";

/**
 * The tables this gate permits a write to, and the complete list of them.
 *
 * Written down for the reason gate.js writes REP_FORBIDDEN_WRITES down and
 * outreachGate.js writes REP_OUTREACH_WRITES down: the rule should be
 * discoverable from the file rather than only from the absence of code.
 *
 *   salesSmsMessage  the copy of what was sent, written only after Twilio
 *                    accepted it.
 *   salesLead        the prospect's time zone, which the rep states because
 *                    they are the only person who knows it. Nothing else on
 *                    the lead is writable through this route.
 *
 * SalesSuppression is deliberately ABSENT. A rep never writes to the
 * do-not-contact list from here; a prospect's STOP arrives at the inbound
 * webhook, which is not a sales route and has no rep behind it.
 * scripts/check-sales-sms.mjs asserts that the route writes to these two
 * models and no others.
 */
export const REP_SMS_WRITES = ["salesSmsMessage", "salesLead"];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireSmsRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching both other
 * gates and lib/permissions/enforce.js's permissionErrorResponse, so this
 * module stays importable by a check script that cannot resolve "next/server"
 * — and so the route builds its own response, which check:refusal-shape
 * requires.
 *
 * `code` and `name` are selected because the message itself needs them: the
 * link is built from the code and CASL requires the message to identify the
 * sender by name. Selecting them here rather than re-reading in the route
 * means the send cannot use a code from a row read at a different moment than
 * the one that established the rep is still employed.
 */
export async function requireSmsRep(request) {
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
      code: true,
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
