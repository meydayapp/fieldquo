// lib/sales/calls/gate.js
//
// The door for the routes that place a call, log its outcome, and say what a
// rep is doing — and nothing else.
//
// ══ Why a FIFTH gate ══════════════════════════════════════════════════════
//
// lib/sales/queueGate.js's header argues the case for the fourth and sets the
// standard this follows: "three short, explicit lists beat one gate with a
// mode parameter". The same reasoning puts calling on its own list rather than
// widening one that exists.
//
//   gate.js         refuses every non-GET under /api/sales. A rep who can
//                   write is a rep who can pay themselves.
//   outreachGate.js the rep's own notes — SalesLead, SalesThread, SalesMessage,
//                   SalesRepNote.
//   smsGate.js      the one route that spends money at a carrier.
//   queueGate.js    the claim. Prospect ownership: an operational lock.
//   this one        a call. It writes SalesCallAttempt and SalesRepActivity,
//                   it touches the claim through a disposition, and — the part
//                   that made it its own list — it can write SalesSuppression.
//
// ══ Why SalesSuppression is on THIS list and not the queue's ══════════════
//
// queueGate.js deliberately excludes it, and its reason is right for what it
// governs: "a rep marking one prospect do-not-contact is a fact about that
// prospect, not an entry on the platform list."
//
// A call is where that stops being true. The rep on the phone is the person
// who HEARS "take me off your list", and docs/sales-intel/AUDIT-compliance.md
// §5 establishes what that request is: it binds FieldQuo across every channel
// and every rep, not one rep's copy of a row. The schema already anticipates
// this — SalesSuppression.source has a `"call"` value and
// `createdBySalesRepId` exists precisely so a rep can be the author of one.
//
// A rep who hears "stop calling me" and has no button is the dead control
// AGENTS.md opens with, inverted: the harm is not a button that does nothing,
// it is the absence of one where the law expects an action. So the write is
// allowed, ADDING only — `unsuppress` stays superadmin-only with a written
// reason, exactly as lib/sales/suppression.js already enforces, and nothing
// here can reach it.
//
// ══ The identity half is NOT re-implemented ═══════════════════════════════
//
// canAuthenticate() comes from lib/sales/invite.js, the same function the
// other four gates call, so no two of them can disagree about who is allowed
// in without one failing to compile. What is duplicated is the fresh read, and
// that duplication is the point: a rep deactivated at 9am must not be able to
// dial a stranger at 9:01.

import { db } from "@/lib/db";
import { getCurrentSalesRep, sessionSuperseded } from "../auth";
import { canAuthenticate } from "../invite";

/**
 * The tables this gate permits a write to, and the complete list of them.
 *
 *   salesCallAttempt   the dial and its outcome.
 *   salesCallTransfer  handing a live caller to another rep. Added with the
 *                      transfer feature and on THIS list rather than a sixth
 *                      gate of its own, because it is not a new kind of act: a
 *                      transfer is something that happens to a call, by the
 *                      rep who is already on it, and every row it writes names
 *                      that rep and that attempt. It moves no claim, contacts
 *                      nobody new and decides no money.
 *   salesRepActivity   available / on a call / writing up / paused.
 *   prospect           the claim transition a disposition implies, plus
 *                      doNotContactAt. Same columns queueGate already permits.
 *   salesLead          the rep's own lead status — "contacted", "lost".
 *   salesSuppression   see the header. Adding only.
 *   salesContactNumber the second number, as the person on the phone gave it.
 *                      On THIS list for the same reason salesSuppression is:
 *                      the rep on the call is the person who hears "call him
 *                      on his cell", exactly as they are the person who hears
 *                      "take me off your list". It is additive — nothing on
 *                      that table can overwrite Prospect.phoneE164 or
 *                      SalesLead.phone, which are identity rather than
 *                      contact details — and every number it stores is put
 *                      through the same suppression, do-not-contact, calling
 *                      window and 24-hour cap as the listed one, in the
 *                      request that dials. See app/api/sales/calls/numbers.
 *
 * `salesAttribution`, `salesCommissionEntry`, `salesPayoutBatch` and
 * `salesRep` are absent here for the same reason gate.js lists them as
 * forbidden: they decide who gets paid.
 *
 * scripts/check-sales-call-handling.mjs asserts the call routes write to these
 * models and no others.
 */
export const REP_CALL_WRITES = [
  "salesCallAttempt",
  "salesCallTransfer",
  "salesRepActivity",
  "prospect",
  "salesLead",
  "salesSuppression",
  "salesContactNumber",
];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireCallingRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching all four
 * other gates, so this module stays importable by a check script that cannot
 * resolve "next/server" — and so the route builds its own response, which
 * check:refusal-shape requires.
 */
export async function requireCallingRep(request) {
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
      kind: true,
      // A test account (SalesRep.testAccount): the calling window is not
      // applied to this rep's dials and every one is recorded as a test. Read
      // here, fresh per request, because the routes behind this gate pass it
      // into salesCallReadiness — a flag a screen remembered is not a flag.
      testAccount: true,
      // Read only so canAuthenticate can answer its own question rather than
      // being handed a boolean somebody else decided, and stripped again below
      // before the row can be spread into a response.
      passwordHash: true,
      // The session boundary sessionSuperseded() compares the token against.
      sessionIssuedAt: true,
      sessionEndedBy: true,
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
  // One active session: a token from a sign-in a newer one (or a
  // supervisor) ended is refused with the code the portal's banner keys on
  // — lib/sales/auth.js sessionSuperseded.
  const superseded = sessionSuperseded(row, claims);
  if (superseded) return { rep: null, refusal: superseded };

  const { passwordHash: _passwordHash, sessionIssuedAt: _sessionIssuedAt, sessionEndedBy: _sessionEndedBy, ...rep } = row;
  return { rep, refusal: null };
}
