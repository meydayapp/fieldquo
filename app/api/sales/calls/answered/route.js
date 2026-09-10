// app/api/sales/calls/answered/route.js
//
// A rep pressed Pick up. This is the only moment anything can know which of
// them did.
//
// ══ What was wrong ════════════════════════════════════════════════════════
//
// An inbound SalesCallAttempt's `salesRepId` is written by
// app/api/rep-dial/inbound before the phone has rung once, from whoever last
// rang that contractor — falling back to the claim holder, falling back to
// null. ringPlan then offers the call to up to three browsers at the same
// time. So the rep who actually answered a callback was never recorded as
// having answered it, and the floor board, that rep's own call history and
// every report keyed on `salesRepId` credited it to somebody who was not on
// the call, or to nobody at all.
//
// It is also why an inbound call could not be transferred: the transfer route
// reads the attempt by the rep on it, and that was usually a different rep.
//
// ══ The browser makes a CLAIM. Twilio settles it ══════════════════════════
//
// The dock posts one CallSid — `call.parameters.CallSid`, which for an
// incoming Voice SDK call is the leg Twilio placed to `client:sales_rep:<id>`,
// a child of the contractor's own inbound call. A CallSid on its own proves
// nothing: a rep could post one they were never rung on and file a colleague's
// caller against themselves, then transfer them.
//
// So the leg is read back FROM THE CARRIER and two things are checked against
// it before a byte is written: Twilio's `to` must be this rep's own client
// identity, rebuilt from the session's rep id (never parsed out of the string
// Twilio returned), and its `parentCallSid` must be an inbound attempt we
// wrote. A rep can only ever claim a leg Twilio agrees was rung at them.
//
// The parent case — a SID that IS `providerCallSid` — is accepted too, and
// deliberately does NOT enable transfer: it means we have the contractor's leg
// and not the rep's, and transfer.js refuses without the rep's leg rather than
// guessing at one. Neither case is silent; an unmatchable SID is refused in
// words.
//
// ══ Which gate, and why not the outreach one ══════════════════════════════
//
// requireCallingRep. This writes SalesCallAttempt, which is on
// lib/sales/calls/gate.js's REP_CALL_WRITES list and is NOT on
// lib/sales/outreachGate.js's — scripts/check-sales-outreach.mjs asserts that
// no route under /api/sales writes a model outside the list of whichever gate
// it uses, and the calling gate is the one this act belongs to. It is the same
// gate app/api/sales/calls/transfer uses, which matters: the two routes are
// halves of one action and a rep who can answer must be exactly the set who
// can transfer.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { twilioRest } from "@/lib/sms/twilioClient";
import { recordError } from "@/lib/platform/errorLog";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState, recordAnswered } from "@/lib/sales/calls/store";
import { claimAnswer, isCallSid, legAnsweredBy, LEG_CHILD, LEG_PARENT } from "@/lib/sales/calls/answered";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The attempt this leg belongs to, and which of the two legs arrived.
 *
 * Tried in the cheap order: the row first, because a SID that IS a
 * `providerCallSid` needs no carrier call at all, and a Twilio fetch on the
 * hot path of somebody pressing Pick up is latency a rep can hear.
 *
 * A carrier that cannot be read returns `{ error }` rather than null. "We
 * could not ask Twilio" and "that call is not yours" are different answers and
 * collapsing them would tell a rep their own call was somebody else's.
 */
async function locateAttempt({ callSid, repId }) {
  const parent = await db.salesCallAttempt
    .findUnique({
      where: { providerCallSid: callSid },
      select: {
        id: true,
        direction: true,
        providerCallSid: true,
        repCallSid: true,
        answeredByRepId: true,
      },
    })
    .catch(() => null);
  if (parent) return { attempt: parent, leg: LEG_PARENT, error: null };

  let call = null;
  try {
    call = await twilioRest.calls(callSid).fetch();
  } catch (err) {
    return {
      attempt: null,
      leg: null,
      error: `That call could not be checked with the carrier (${err?.message || "no reason given"}).`,
    };
  }

  if (!legAnsweredBy({ carrierTo: call?.to, repId })) {
    // Not this rep's leg. Said as "not yours" rather than "not found": the
    // rep is holding a phone, and a vague refusal would read as a bug in the
    // dock rather than as a call that belongs to somebody else.
    return { attempt: null, leg: null, error: "That call was not rung at your line." };
  }

  const parentSid = call?.parentCallSid || null;
  if (!isCallSid(parentSid)) {
    // A leg with no parent is not out of a `<Dial>` at all — the likeliest
    // real one is a transfer leg, which /api/sales/calls/transfer placed and
    // which has no attempt of its own. Nothing to file it against.
    return { attempt: null, leg: null, error: "That call is not part of a logged inbound call." };
  }

  const attempt = await db.salesCallAttempt
    .findUnique({
      where: { providerCallSid: parentSid },
      select: {
        id: true,
        direction: true,
        providerCallSid: true,
        repCallSid: true,
        answeredByRepId: true,
      },
    })
    .catch(() => null);
  if (!attempt) {
    return { attempt: null, leg: null, error: "There is no logged call behind that one." };
  }
  return { attempt, leg: LEG_CHILD, error: null };
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!callStoreState().ready) {
    return NextResponse.json(
      {
        error:
          "Calls are not in this database yet. SalesCallAttempt is missing from the generated client; run `npx prisma db push`.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");
  const callSid = typeof body.callSid === "string" ? body.callSid.trim() : "";
  // Shape-checked here rather than sent on: Twilio answers a malformed SID
  // with a 404 that is indistinguishable from "that call does not exist".
  if (!isCallSid(callSid)) return bad("That is not a call.");

  const located = await locateAttempt({ callSid, repId: rep.id });
  if (!located.attempt) {
    // A refusal in words, never a 200 that did nothing. The dock renders no
    // transfer control on this answer, which is the honest half of AGENTS.md's
    // first rule — the call still works, it just cannot be handed on.
    return bad(located.error || "That call could not be matched.", 404);
  }

  const plan = claimAnswer({
    attempt: located.attempt,
    repId: rep.id,
    // Only the CHILD leg is the rep's own. When the parent arrived we have the
    // contractor's leg and not the rep's, and inventing one would be the
    // guess transfer.js exists to refuse.
    legSid: located.leg === LEG_CHILD ? callSid : null,
  });
  if (!plan.ok) return bad(plan.reason, 409);

  const written = await recordAnswered({
    attemptId: located.attempt.id,
    repId: rep.id,
    data: plan.data,
  });
  if (!written.claimed) {
    await recordError({
      area: "sales_inbound",
      code: "answer_claim_lost",
      message: `Two reps claimed inbound call ${located.attempt.id}; it is filed to ${written.heldBy || "nobody"}.`,
    }).catch(() => {});
    return bad("Somebody else picked that call up.", 409);
  }

  return NextResponse.json({
    ok: true,
    attemptId: located.attempt.id,
    // Said by the server, acted on by the dock. Both legs have to exist before
    // a transfer control is worth rendering.
    transferable: plan.transferable,
  });
}
