// app/api/rep-dial/bridge/route.js
//
// Twilio asks "what should I do with this call?" and this answers in TwiML.
//
// ══ Why it is NOT under /api/sales ════════════════════════════════════════
//
// middleware.js refuses everything under `/api/sales` that does not carry a
// rep's cookie, and scripts/check-sales-auth.mjs separately refuses any
// handler there that does not resolve a rep through a declared gate. Both are
// right and neither can be satisfied by Twilio, which posts from its own
// infrastructure with no session at all. A path beginning `/api/sales-` would
// still match that prefix, which is a trap worth naming: `"/api/sales-dial"
// .startsWith("/api/sales")` is true. Hence `/api/rep-dial`.
//
// ══ The signature IS the access control ═══════════════════════════════════
//
// Exactly as app/api/sms/inbound and app/api/crew/inbound already work, and
// through the same verifier so a fix to the URL reconstruction lands on all of
// them. Note what that requires: the account's AUTH TOKEN specifically. A
// deployment holding only API keys can mint tokens and place calls while being
// unable to verify a single webhook — see lib/sms/verifyTwilioWebhook.js.
//
// ══ THE NUMBER DIALLED COMES FROM OUR ROW, NEVER FROM THE REQUEST ═════════
//
// This is the security property of the whole feature. The browser SDK sends an
// `attemptId` and nothing else that matters; the destination is read from the
// SalesCallAttempt that /api/sales/calls already created after clearing the
// calling window, the do-not-contact flag and the per-24h cap. A client that
// sent a `To` parameter would be ignored, so a compromised or curious rep
// cannot turn FieldQuo's Twilio account into a way to ring anybody they like.
//
// ══ And the row has to be FRESH ═══════════════════════════════════════════
//
// An attempt id is not a bearer token, but it is a stable string that appears
// in a browser. Bridging one that is four hours old would place a call whose
// window was checked four hours ago — at 20:30 in Oklahoma, on a decision
// taken at 16:30. So an attempt older than BRIDGE_WINDOW_SECONDS is refused.
// A rep who lets a call sit that long presses the button again.
//
// ══ 2026-09-21: three shapes of call, one webhook ══════════════════════════
//
// The TwiML app's voice URL is this route, so every browser-placed call
// lands here. It now answers three of them, told apart by the FROM identity
// and the row — never by a parameter the browser chose:
//
//   a rep, prospect attempt, supervision OFF   <Dial><Number>  (unchanged)
//   a rep, prospect attempt, supervision ON    <Dial><Conference> for the
//                                              rep; the prospect is dialled
//                                              INTO the room by REST as a
//                                              recorded participant
//   a rep, kind "internal"                     <Dial><Client> — a
//                                              colleague's browser, no PSTN
//   a superadmin (From client:supervisor:…)    <Dial><Conference> into the
//                                              room the row says they hold
//
// The mode is read from the platform setting in THIS request; the
// supervisor's mode (listen / whisper / barge) is read from the row the
// platform route wrote, so a supervisor's browser cannot ask for a mode
// the server did not grant. lib/sales/calls/supervision.js decides all of
// it and says why (a) — a conference from the first ring — was chosen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { salesRepIdFromIdentity } from "@/lib/sales/calls/browserDial";
import { callStoreState, recordRepLeg } from "@/lib/sales/calls/store";
import { recordError } from "@/lib/platform/errorLog";
import { dialRecordingAttrs, recordingCallbackUrl } from "@/lib/sales/calls/recording";
import {
  KIND_INTERNAL,
  adminIdFromIdentity,
  bridgeMode,
  prospectParticipantParams,
  repConferenceAttrs,
  supervisorConferenceAttrs,
} from "@/lib/sales/calls/supervision";
import { addProspectParticipant } from "@/lib/sales/calls/supervisionRest";
import {
  loadSupervisionSettings,
  recordSupervisorLeg,
  supervisionAttempt,
  writeAttempt,
} from "@/lib/sales/calls/supervisionStore";
import { repIdentity } from "@/lib/sales/calls/browserDial";

/** How long after the gate cleared a bridge may still happen. */
export const BRIDGE_WINDOW_SECONDS = 120;

/** How long to let it ring. Matches callPlan's timeout, said once per side. */
const RING_SECONDS = 30;

/**
 * TwiML that says nothing and hangs up, with the reason spoken to the REP's
 * leg only — the prospect's leg does not exist yet, so nobody else hears it.
 *
 * A refusal that returned an empty document would drop the call with the rep
 * staring at a dialer that went quiet, which is the same dead control in
 * audio. They hear why.
 */
function refuse(reason) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "alice" }, reason);
  twiml.hangup();
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    // 403 with no body. An unsigned request is not a caller to explain
    // ourselves to, and the SMS routes answer the same way.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const store = callStoreState();
  if (!store.ready) {
    return refuse("Calling is not finished being set up. Please try again later.");
  }

  // ── A supervisor's leg ──────────────────────────────────────────────────
  //
  // The identity was minted by /api/platform/sales/supervision/token for a
  // superadmin only, and Twilio validated the token before placing this
  // call — so `From` is trustworthy in a way a body parameter is not. What
  // the leg joins, and how, comes from the ROW: the platform route wrote
  // supervisedBy and supervisionKind before the browser was told to
  // connect. A leg for a row that does not name this admin is refused.
  const supervisorId = adminIdFromIdentity(params.From || "");
  if (supervisorId) {
    const superviseId = typeof params.supervise === "string" ? params.supervise.trim() : "";
    const row = superviseId ? await supervisionAttempt(superviseId) : null;
    if (!row || row.supervisedBy !== supervisorId || row.endedAt || !row.conferenceName) {
      return refuse("That call is not yours to join, or it has ended.");
    }
    const attrs = supervisorConferenceAttrs({ attempt: row, origin: getAppOrigin(request) });
    if (!attrs) return refuse("That call cannot be joined: the rep's leg is not known.");
    await recordSupervisorLeg({ attemptId: row.id, adminId: supervisorId, callSid: params.CallSid }).catch(() => {});
    const { name, ...conf } = attrs;
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial().conference(conf, name);
    return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const attemptId = typeof params.attemptId === "string" ? params.attemptId.trim() : "";
  const identity = salesRepIdFromIdentity(params.From || "");
  if (!attemptId || !identity) {
    return refuse("This call could not be matched to a prospect, so it was not connected.");
  }

  const attempt = await db.salesCallAttempt
    .findFirst({
      where: { id: attemptId, salesRepId: identity },
      select: { id: true, toE164: true, fromE164: true, dialledAt: true, providerCallSid: true, kind: true, internalToRepId: true },
    })
    .catch(() => null);

  if (!attempt) {
    // Scoped to the rep in the WHERE rather than checked after: a mismatched
    // pair matches nothing, which is the same shape every sales route uses.
    return refuse("This call could not be matched to a prospect, so it was not connected.");
  }
  if (attempt.providerCallSid) {
    return refuse("That call has already been placed.");
  }
  if (attempt.kind !== KIND_INTERNAL && !attempt.fromE164) {
    return refuse("There is no number to call from, so this call was not connected.");
  }

  const ageMs = Date.now() - new Date(attempt.dialledAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > BRIDGE_WINDOW_SECONDS * 1000) {
    await recordError({
      area: "sales_dial",
      message: `A bridge was refused for a stale attempt (${Math.round(ageMs / 1000)}s old).`,
    }).catch(() => {});
    return refuse("This call sat too long before connecting. Press call again.");
  }

  // ── Remember the rep's own leg ──────────────────────────────────────────
  //
  // This is the only moment it is knowable. The browser SDK does not hand the
  // page its own CallSid in time, and a CallSid the BROWSER sent would be a
  // CallSid a rep could have made up — which would let one rep put another
  // rep's call on hold. So it is taken from the signed webhook and written
  // here, and lib/sales/calls/transfer.js refuses a transfer without it rather
  // than guessing at a leg.
  //
  // Soft: a call that could not record its leg is a call that cannot be
  // transferred, which is said in words. It is not a reason to refuse to
  // connect somebody.
  await recordRepLeg({ attemptId: attempt.id, repCallSid: params.CallSid }).catch(async (err) => {
    await recordError({
      area: "sales_dial",
      message: `Could not record the rep leg for attempt ${attempt.id}: ${err?.message}. This call will not be transferable.`,
    }).catch(() => {});
  });

  const origin = getAppOrigin(request);
  const twiml = new twilio.twiml.VoiceResponse();

  // ── A colleague's browser ───────────────────────────────────────────────
  //
  // `<Dial><Client>`: two client legs and nothing on the PSTN. The From the
  // callee's dock sees is already `client:sales_rep:<caller>`, which is how
  // it knows to print a colleague's name rather than look a number up. The
  // status callback is the same route a prospect leg reports to, so
  // answered / ended / seconds land on the row the same way. Recorded dual
  // like any call — cheap, and a colleague call is still a FieldQuo call.
  if (attempt.kind === KIND_INTERNAL) {
    const to = repIdentity(attempt.internalToRepId);
    if (!to) return refuse("That colleague could not be reached.");
    const dial = twiml.dial({
      timeout: RING_SECONDS,
      answerOnBridge: true,
      ...dialRecordingAttrs({ origin, attemptId: attempt.id }),
    });
    dial.client(
      {
        statusCallback: `${origin}/api/rep-dial/status?attemptId=${encodeURIComponent(attempt.id)}`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["ringing", "answered", "completed"],
      },
      to,
    );
    return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // ── Conference mode, when the owner has switched it on ──────────────────
  //
  // Read in this request. The prospect is dialled INTO the room first, by
  // REST, recorded dual on their leg (supervision.js, "Recording, in
  // conference mode"); then the rep's TwiML joins the same room by name.
  // If the carrier refuses the participant (a geo permission, a bad
  // number) the rep hears why and nothing rings — the same shape as every
  // refusal above, and the prospect never knew.
  const mode = bridgeMode({ settings: await loadSupervisionSettings(), attempt });
  if (mode.conference) {
    const params2 = prospectParticipantParams({
      attempt,
      origin,
      ringSeconds: RING_SECONDS,
      recordingAttrs: {
        recordingStatusCallback: recordingCallbackUrl({ origin, attemptId: attempt.id }),
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: ["completed"],
      },
    });
    const added = await addProspectParticipant({ conferenceName: mode.conferenceName, params: params2 });
    if (!added.ok) {
      await recordError({
        area: "sales_dial",
        code: "conference_dial_failed",
        message: `Attempt ${attempt.id} could not be dialled into its conference: ${added.error}. The rep was told and nothing rang.`,
      }).catch(() => {});
      return refuse("The call could not be placed. The reason has been logged for the platform team.");
    }
    // The room's name (and SID, when the participant reported one) go on the
    // row NOW, before the rep joins: every later action keys on them.
    await writeAttempt({
      attemptId: attempt.id,
      data: { conferenceName: mode.conferenceName, ...(added.conferenceSid ? { conferenceSid: added.conferenceSid } : {}) },
    }).catch(() => {});
    const { name, ...conf } = repConferenceAttrs({ origin, attemptId: attempt.id, conferenceName: mode.conferenceName });
    const dial = twiml.dial({
      // The same action as the plain bridge: when the room ends — the
      // prospect hung up, a supervisor ended it, or a transfer moved the
      // prospect out — this leg lands at the transfer stage, which joins
      // an open transfer or answers with an empty document.
      action: `${origin}/api/rep-dial/transfer?stage=rep-leg&attemptId=${encodeURIComponent(attempt.id)}`,
      method: "POST",
    });
    dial.conference(conf, name);
    return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  const dial = twiml.dial({
    // A number FieldQuo owns, chosen by callPlan when the attempt was written.
    // Never taken from the request — Twilio rejects an unowned caller ID
    // anyway (21210), but the refusal should not depend on the vendor noticing.
    callerId: attempt.fromE164,
    timeout: RING_SECONDS,
    answerOnBridge: true,
    // ── Where the rep's leg goes when this <Dial> ends ────────────────────
    //
    // Normally nowhere: the prospect hangs up, the action is fetched, there is
    // no transfer, and it answers with an empty document — the same hangup the
    // leg would have got without it.
    //
    // The case it exists for is a TRANSFER. Moving the caller into a
    // conference ends this <Dial> from the caller's side, and without an
    // action the rep's leg would simply stop — taking with it the only person
    // who could hand the caller back when the transfer target does not answer.
    // With one, the rep follows the caller into the same conference. See
    // lib/sales/calls/transfer.js.
    action: `${origin}/api/rep-dial/transfer?stage=rep-leg&attemptId=${encodeURIComponent(attempt.id)}`,
    method: "POST",
    // Recorded, dual-channel, from the moment the contractor answers, and
    // Twilio posts the file to /api/rep-dial/recording with this attempt's
    // id in the URL. lib/sales/calls/recording.js is the one place that
    // decides this and says why.
    ...dialRecordingAttrs({ origin, attemptId: attempt.id }),
  });
  dial.number(
    {
      statusCallback: `${origin}/api/rep-dial/status?attemptId=${encodeURIComponent(attempt.id)}`,
      statusCallbackMethod: "POST",
      // `initiated` is deliberately absent: it fires before anything has
      // happened and would only ever write columns we already know.
      statusCallbackEvent: ["ringing", "answered", "completed"],
    },
    attempt.toE164,
  );

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
