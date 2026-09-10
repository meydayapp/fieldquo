// app/api/rep-dial/transfer/route.js
//
// Twilio's side of a transfer: the two legs that have to be told what to do,
// and the two reports that say what happened.
//
// ══ Why it is NOT under /api/sales ════════════════════════════════════════
//
// The same reason its siblings /api/rep-dial/bridge, /status and /inbound give,
// repeated rather than referenced because it is the kind of thing a rename
// undoes: middleware.js refuses everything under `/api/sales` that does not
// carry a rep's cookie, and Twilio posts from its own infrastructure with no
// session at all. Note that `/api/sales-transfer` would still match that
// prefix — `"/api/sales-transfer".startsWith("/api/sales")` is true — so the
// sibling namespace is the answer rather than a hyphen.
//
// ══ The signature IS the access control ═══════════════════════════════════
//
// Through the same lib/sms/verifyTwilioWebhook.js every other Twilio endpoint
// here uses. What it needs is the account's AUTH TOKEN specifically: a
// deployment holding only API keys can place calls while being unable to
// verify a single webhook.
//
// Unsigned access to this endpoint would be worse than to the bridge. The
// stages below take somebody off hold, hang a leg up and move a live caller
// into a conference — a stranger who could post here could listen to, or drop,
// a call in progress.
//
// ══ NOTHING IN THE REQUEST CHOOSES A DESTINATION ══════════════════════════
//
// Every stage is keyed on `transferId` or `attemptId` — ids of our own rows,
// put into the URL by our own code. The conference name, the legs and the kind
// of transfer are all read from the row. There is no request shape that
// reaches a number or a client of the caller's choosing.
//
// ══ Four stages, and what each one is for ═════════════════════════════════
//
//   rep-leg        the transferring rep's own leg, arriving because the
//                  bridge's <Dial> ended when the caller was moved. It follows
//                  them into the conference. Without this stage the rep's leg
//                  simply ends and the transfer loses the only person who
//                  could take the caller back.
//                  OUTBOUND ONLY. On an inbound call the legs are the other
//                  way round — the contractor is the parent — so it is the
//                  REP who is redirected and the CALLER who arrives at a Dial
//                  action, which is /api/rep-dial/inbound?stage=after-dial.
//                  See conferenceMoveLeg in lib/sales/calls/transfer.js.
//   target         the TwiML the person being transferred to hears: a whisper
//                  saying who it is from, then the conference.
//   target-status  the target's leg ended. This is where "nobody answered"
//                  becomes "the caller goes back to the rep".
//   conference     join and leave. The state machine runs on JOIN rather than
//                  on the carrier's `answered`, because those differ by the
//                  beat in which the target can hear nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import {
  advanceTransfer,
  openTransferFor,
  transferById,
  transferStoreState,
} from "@/lib/sales/calls/store";
import {
  onParticipantJoin,
  onParticipantLeave,
  onTargetEnded,
  repLegPlan,
  targetLegPlan,
} from "@/lib/sales/calls/transfer";
import {
  applyTransferActions,
  conferenceJoinTwiml,
  conferenceParticipantSids,
  legIsUp,
} from "@/lib/sales/calls/transferRest";

/** An empty document. Ends the leg without saying anything. */
function silence() {
  const twiml = new twilio.twiml.VoiceResponse();
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/** A notification, not a request for instructions. */
const noted = () => new NextResponse("", { status: 204 });

/**
 * The join document, as an HTTP answer.
 *
 * The document itself is built by lib/sales/calls/transferRest.js, because a
 * rep's leg reaches the conference two ways — fetched here when a `<Dial>`
 * action sends it, and PUSHED by moveRepToConference when an inbound call is
 * transferred — and two copies of it is the copy that forgets
 * `endConferenceOnExit: false` and ends the room when a rep steps out.
 */
function joinResponse({ plan, conferenceName, origin, transferId }) {
  const twiml = conferenceJoinTwiml({ plan, conferenceName, origin, transferId });
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    // 403 with no body, exactly as every rep-dial sibling answers. An unsigned
    // request is not a caller to explain ourselves to.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const origin = getAppOrigin(request);

  if (!transferStoreState().ready) {
    // The table is not there, so no transfer can exist and no stage can mean
    // anything. Answering with silence rather than an error keeps a leg that
    // arrived here from hearing Twilio's "an application error has occurred".
    return stage === "target-status" || stage === "conference" ? noted() : silence();
  }

  // ── The transferring rep's own leg ──────────────────────────────────────
  if (stage === "rep-leg") {
    const attemptId = url.searchParams.get("attemptId");
    const transfer = attemptId ? await openTransferFor(attemptId) : null;
    const plan = repLegPlan({ transfer });
    return joinResponse({
      plan,
      conferenceName: plan.conferenceName,
      origin,
      transferId: transfer?.id || "",
    });
  }

  const transferId = url.searchParams.get("transferId");
  const transfer = transferId ? await transferById(transferId) : null;

  // ── What the person being transferred to hears ──────────────────────────
  if (stage === "target") {
    let fromRepName = null;
    if (transfer?.fromRepId) {
      const row = await db.salesRep
        .findUnique({ where: { id: transfer.fromRepId }, select: { name: true } })
        .catch(() => null);
      fromRepName = row?.name || null;
    }
    const plan = targetLegPlan({ transfer, fromRepName });
    return joinResponse({
      plan,
      conferenceName: plan.conferenceName,
      origin,
      transferId: transfer?.id || "",
    });
  }

  // ── The target's leg ended ──────────────────────────────────────────────
  if (stage === "target-status") {
    if (!transfer) return noted();
    const status = typeof params.CallStatus === "string" ? params.CallStatus : null;
    // `answered` is deliberately ignored: the state machine moves on the
    // conference JOIN, which is a beat later and is the moment the target can
    // actually hear anything.
    if (status === "answered" || status === "in-progress" || status === "ringing") return noted();

    // Read fresh, never assumed. This is the parameter that decides between
    // handing the caller back and rescuing them into the queue.
    const repLegUp = await legIsUp(transfer.repCallSid);
    const result = onTargetEnded({ transfer, callStatus: status, repLegUp });
    if (!result.changed) return noted();

    const moved = await advanceTransfer({
      id: transfer.id,
      fromState: transfer.state,
      toState: result.state,
      failureReason: result.reason,
      endedAt: new Date(),
    });
    if (!moved.applied) return noted();

    const applied = await applyTransferActions({ actions: result.actions, transfer, origin });
    if (!applied.ok) {
      await recordError({
        area: "sales_dial",
        code: "transfer_recover_failed",
        message: `Transfer ${transfer.id} ended (${status}) and could not ${applied.failed
          .map((f) => f.action.type)
          .join(", ")}: ${applied.failed.map((f) => f.error).join("; ")}. Somebody may be on hold with nobody coming.`,
      }).catch(() => {});
    }
    return noted();
  }

  // ── Somebody arrived in, or left, the conference ────────────────────────
  if (stage === "conference") {
    if (!transfer) return noted();
    const event = typeof params.StatusCallbackEvent === "string" ? params.StatusCallbackEvent : "";
    const callSid = typeof params.CallSid === "string" ? params.CallSid : null;

    if (event === "participant-join") {
      // Only consulted for the target on a warm transfer, and only then,
      // because it costs a call to the carrier. A rep who hung up while their
      // target was ringing cannot have the private conversation warm is for.
      const needsRepCheck =
        callSid === transfer.targetCallSid && transfer.kind === "warm";
      const repLegUp = needsRepCheck ? await legIsUp(transfer.repCallSid) : true;

      const result = onParticipantJoin({ transfer, callSid, repLegUp });
      if (result.actions.length === 0 && !result.changed) return noted();

      if (result.changed) {
        const moved = await advanceTransfer({
          id: transfer.id,
          fromState: transfer.state,
          toState: result.state,
          failureReason: result.reason ?? undefined,
          answeredAt: new Date(),
          endedAt: result.state === "completed" ? new Date() : undefined,
        });
        // Lost the race — another delivery of the same event already applied
        // it. Doing the Twilio half anyway would hang a rep up twice.
        if (!moved.applied) return noted();
      }

      const applied = await applyTransferActions({ actions: result.actions, transfer, origin });
      if (!applied.ok) {
        await recordError({
          area: "sales_dial",
          code: "transfer_join_failed",
          message: `Transfer ${transfer.id} could not ${applied.failed
            .map((f) => f.action.type)
            .join(", ")} on join: ${applied.failed.map((f) => f.error).join("; ")}`,
        }).catch(() => {});
      }
      return noted();
    }

    if (event === "participant-leave") {
      const remaining = await conferenceParticipantSids(transfer.conferenceName);
      // Null means we could not read the room. Not empty, and not "the caller
      // is alone" — ejecting somebody mid-conversation on an unreadable list
      // is worse than leaving them.
      if (remaining === null) return noted();
      const result = onParticipantLeave({ transfer, remainingSids: remaining });
      if (result.actions.length === 0) return noted();
      const applied = await applyTransferActions({ actions: result.actions, transfer, origin });
      if (!applied.ok) {
        await recordError({
          area: "sales_dial",
          code: "transfer_rescue_failed",
          message: `A caller was left alone after transfer ${transfer.id} and could not be moved to the queue: ${applied.failed
            .map((f) => f.error)
            .join("; ")}`,
        }).catch(() => {});
      }
      return noted();
    }

    return noted();
  }

  // An unknown stage. Silence rather than a 400: whatever leg this is, it is a
  // live call and Twilio turns a non-2xx into "an application error has
  // occurred" in somebody's ear.
  return silence();
}
