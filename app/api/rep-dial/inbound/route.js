// app/api/rep-dial/inbound/route.js
//
// A contractor rings back one of the numbers a FieldQuo rep called them from.
// Until this existed, they reached nothing at all.
//
// ══ The sequence this ends ════════════════════════════════════════════════
//
// A closer rings a roofer from a local number, because a contractor in Tulsa
// answers a 918 number and lets an unknown one ring out. The roofer is on a
// roof. Two hours later they see a missed call and ring it back — and the
// number was bought, pointed at nothing, and answered by nobody. That is the
// most qualified inbound call this business can receive.
//
// ══ Why it is NOT under /api/sales ════════════════════════════════════════
//
// Identical to its siblings /api/rep-dial/bridge and /api/rep-dial/status, and
// their reasoning is copied here rather than referenced because it is the kind
// of thing that gets undone by a rename: middleware.js refuses everything
// under `/api/sales` that does not carry a rep's cookie, and Twilio posts from
// its own infrastructure with no session at all. Note also that a path
// beginning `/api/sales-` would still match the prefix —
// `"/api/sales-inbound".startsWith("/api/sales")` is true — so the sibling
// namespace is the answer rather than a hyphen.
//
// ══ The signature IS the access control ═══════════════════════════════════
//
// Through the same lib/sms/verifyTwilioWebhook.js the crew inbound route and
// both rep-dial siblings use, so a fix to the URL reconstruction lands on all
// of them at once. Note what it requires: the account's AUTH TOKEN
// specifically. A deployment holding only API keys can mint access tokens and
// place calls while being unable to verify a single webhook.
//
// An unsigned endpoint here would be worse than an unsigned SMS one: a
// stranger who could post to it would make FieldQuo's Twilio account dial the
// transfer destination, on FieldQuo's bill, as often as they liked.
//
// ══ NOTHING IN THE REQUEST CHOOSES A DESTINATION ══════════════════════════
//
// The same property that makes the bridge safe. `To` selects a row from
// PlatformSmsNumber and is otherwise inert; the number dialled on the transfer
// leg comes from FIELDQUO_SALES_TRANSFER_TO, an environment variable. There is
// no request shape that reaches a number of the caller's choosing, which is
// what stops this being an open relay for toll fraud.
//
// ══ The calling window is NOT consulted, and that is the point ════════════
//
// lib/sales/callingRules.js governs when FieldQuo may RING a business. A
// business ringing FieldQuo has chosen the moment. Gating an inbound answer on
// the outbound window would refuse a prospect who is trying to buy — see
// lib/sales/calls/inboundRouting.js's header, and
// docs/sales-intel/CALL-HANDLING.md §6, which said so before this was built.
// scripts/check-sales-inbound-call.mjs asserts this file imports no part of
// the calling-window module.
//
// ══ THE CONVERSATION is recorded, and so is a VOICEMAIL — differently ═════
//
// Two different things that the word "recording" hides.
//
//   A CALL RECORDING captures a conversation between two people. Off until
//   2026-09-17 on a consent-law argument; on since, by the owner's decision,
//   with the disclosure carried in the rep's opening script rather than
//   played by a machine. Every <Dial> in this file carries the attributes
//   lib/sales/calls/recording.js hands out — dual-channel, from answer, filed
//   by /api/rep-dial/recording onto SalesCallAttempt.recordingUrl and
//   transcribed onto .transcript.
//
//   A VOICEMAIL is one person talking to a machine after an announcement, with
//   nobody else on the line. It is the <Record> at the end of the queue, it is
//   written to SalesCallAttempt.voicemailUrl, and the superadmin floor board
//   plays it — which is the half that was missing when those columns were
//   added and nothing wrote or read them.
//
// `transcribe` is off on that <Record>: transcription is a per-minute charge
// and a rep listening to a ninety-second message is cheaper than transcribing
// every wrong number.
//
// ══ A caller is HELD before they are sent to a machine ════════════════════
//
// One glance at a presence table used to decide the whole call: nobody free,
// voicemail, goodbye — while a rep four seconds from hanging up would have
// taken it. lib/sales/calls/queue.js is the missing middle. It holds, looks
// again, rings whoever has come free, and reaches the same voicemail when
// looking runs out. It never holds for ever and never holds in silence; both
// promises are executable and scripts/check-call-transfer.mjs executes them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { acknowledged } from "@/lib/sales/calls/twilioAck";
import { answeredAtFrom } from "@/lib/sales/calls/providerStatus";
import { ringPlan } from "@/lib/sales/calls/inboundDistribution";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { dialRecordingAttrs } from "@/lib/sales/calls/recording";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { checkSuppression } from "@/lib/sales/suppression";
import { canAuthenticate } from "@/lib/sales/invite";
import { matchInboundCaller } from "@/lib/sales/calls/inboundMatch";
import {
  INBOUND_CONNECT,
  INBOUND_MESSAGE,
  afterTransfer,
  anyRepLive,
  fallbackSayFor,
  inboundPlan,
} from "@/lib/sales/calls/inboundRouting";
import { queueStep, MAX_QUEUE_ROUNDS } from "@/lib/sales/calls/queue";
import {
  attachProviderCall,
  callStoreState,
  lastOutboundBetween,
  openTransferFor,
  presenceFor,
  recordInbound,
  recordVoicemail,
  salesVoiceNumber,
  transferStoreState,
} from "@/lib/sales/calls/store";
import { callerConferenceTwiml } from "@/lib/sales/calls/transferRest";
import {
  assignedRepForNumber,
  isEndedStatus,
  markMissed,
  notifyMissed,
  notifyVoicemail,
} from "@/lib/sales/calls/missed";

/**
 * "Incoming call — Desert Sun Painting": a Web Push to every rep the plan is
 * about to ring, so a rep whose portal tab is in the background (or closed,
 * on a phone) sees the call the moment Twilio starts ringing their browser
 * client. The Voice SDK's own `incoming` event is the in-tab half
 * (IncomingCallDock.js). Same tag on both, so they collapse.
 *
 * Fire-and-forget, before the TwiML is returned: Twilio waits for this
 * response to start ringing, so nothing here may be awaited. Only `client`
 * targets — a transfer to a desk phone is not a browser.
 */
function pushRing(ring, { callerLabel = null, callerNumber = null } = {}) {
  const salesRepIds = (ring?.targets || []).filter((x) => x.kind === "client" && x.salesRepId).map((x) => x.salesRepId);
  if (!salesRepIds.length) return;
  const who = callerLabel || callerNumber || "";
  void pushToReps({
    salesRepIds,
    payload: async (language) => ({
      title: await appSentence(language, "app.notify.incomingCall.title"),
      body: who,
      tag: `sales-ring:${callerNumber || "withheld"}`,
      url: "/sales/queue",
    }),
  });
}

/** The voice Twilio's <Say> uses. The same one the bridge refuses with. */
const VOICE = "alice";

/**
 * The clip played between spoken lines while somebody waits.
 *
 * Unset is NOT silence: lib/sales/calls/queue.js falls back to a bounded pause
 * between announcements, so the worst case with nothing configured is ten
 * quiet seconds and then a human voice again. A hold that plays nothing at all
 * is the failure this queue exists to avoid, and it must not depend on an
 * environment variable somebody remembered to set.
 */
function holdMusicUrl() {
  const raw = (process.env.FIELDQUO_SALES_HOLD_MUSIC_URL || "").trim();
  return raw || null;
}

/** An XML answer. Every branch of this file returns one — see speak(). */
function xml(twiml) {
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Hand this call to the queue.
 *
 * A `<Redirect>` rather than building the queue's TwiML in three places. The
 * queue has to re-read presence, re-run ringPlan and re-decide, and a copy of
 * that per entry point is AGENTS.md failure class 4 pointed at the one code
 * path where a mistake leaves somebody on hold for ever.
 *
 * `afterRing` says whether we got here from a phone that rang out, which the
 * queue needs: it holds rather than immediately ringing the same desk again.
 */
function toQueue({ origin, attemptId, round = 0, afterRing = false }) {
  const twiml = new twilio.twiml.VoiceResponse();
  const query = new URLSearchParams({ stage: "queue", round: String(round) });
  if (attemptId) query.set("attemptId", attemptId);
  if (afterRing) query.set("after", "ring");
  twiml.redirect({ method: "POST" }, `${origin}/api/rep-dial/inbound?${query.toString()}`);
  return xml(twiml);
}

/**
 * TwiML that speaks the lines and hangs up.
 *
 * Always a 200 with a document. Twilio treats a non-2xx as a failed webhook
 * and plays its own error announcement — "an application error has occurred" —
 * which is the worst possible thing for a prospect to hear on a number a
 * salesperson gave them. So every branch of this file answers with TwiML that
 * says something true, and the machine-readable failure goes to
 * /platform/errors instead.
 *
 * ── speak() is for REFUSALS only ─────────────────────────────────────────
 *
 * A number that is not ours, a deployment that cannot write the row. Neither
 * should be offered a message: inviting one from somebody we may not act on
 * is worse than not inviting one at all.
 *
 * It is NOT for the "nobody free" case. That case used to end here too, and
 * the comment above it claimed the queue had taken it over — but the queue is
 * only reached from the CONNECT decision. A plan of INBOUND_MESSAGE (the floor
 * signed out, or no transfer destination set) still came through speak(),
 * which said "we have logged your call" and hung up. Both real callbacks to
 * the sales line so far took that path; neither could leave a word. The
 * action is literally named "message"; takeMessage() below is what it does.
 */
function speak(lines) {
  const twiml = new twilio.twiml.VoiceResponse();
  for (const line of lines || []) twiml.say({ voice: VOICE }, line);

  twiml.hangup();
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * The one <Record> in this file, so the queue's last stop and the empty-floor
 * branch cannot drift into two voicemails with two behaviours.
 *
 * Nothing spoken here promises a callback — see fallbackSayFor() for why an
 * inbound webhook cannot make that promise. The offer is the offer.
 */
function offerMessage(twiml, { origin, attemptId }) {
  twiml.say({ voice: VOICE }, "If you would like to leave a message, please do so after the tone.");
  twiml.record({
    maxLength: 120,
    playBeep: true,
    timeout: 5,
    transcribe: false,
    action: attemptId
      ? `${origin}/api/rep-dial/inbound?stage=after-voicemail&attemptId=${encodeURIComponent(attemptId)}`
      : `${origin}/api/rep-dial/inbound?stage=after-voicemail`,
    method: "POST",
  });
  twiml.hangup();
}

/** The "nobody free" answer: say what is true, then take the message. */
function takeMessage(lines, { origin, attemptId }) {
  const twiml = new twilio.twiml.VoiceResponse();
  for (const line of lines || []) twiml.say({ voice: VOICE }, line);
  offerMessage(twiml, { origin, attemptId });
  return xml(twiml);
}

/**
 * The rep to attribute this call to, re-read and re-checked in this request.
 *
 * ── A rep who has left is not the answer ────────────────────────────────
 *
 * canAuthenticate() is the same predicate the calling gate uses, applied for a
 * different purpose: a departed rep's console will never be opened again, so
 * attributing a callback to them files it where nobody will look. That is
 * worse than filing it nowhere, because a row with a rep's name on it reads as
 * handled. With no eligible rep the row is written unattributed and shows on
 * the superadmin floor board, which is a place somebody actually looks.
 */
async function repToTell(candidateIds) {
  for (const id of candidateIds) {
    if (!id) continue;
    const row = await db.salesRep
      .findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          active: true,
          endedAt: true,
          acceptedAt: true,
          kind: true,
          passwordHash: true,
        },
      })
      .catch(() => null);
    if (row && canAuthenticate(row)) return { id: row.id, name: row.name };
  }
  return null;
}

/**
 * The second leg: the transfer ended, one way or another.
 *
 * Twilio posts back here with DialCallStatus because the <Dial> below carries
 * an `action`. Answering with an empty document would hang up on a caller who
 * has just listened to twenty seconds of ringing and been told nothing, so a
 * call nobody took gets the same sentence it would have got if we had never
 * tried to transfer it — carried on the plan rather than recomputed, so the
 * two cannot drift apart.
 */
async function afterDial(request, params) {
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  const status = typeof params.DialCallStatus === "string" ? params.DialCallStatus : null;
  const seconds = Number(params.DialCallDuration);

  // ── The <Dial> ended because this call is being TRANSFERRED ────────────
  //
  // Checked before anything else, because everything else in this function is
  // about a call that is over and this one is not.
  //
  // On an inbound call the contractor is the PARENT of the <Dial> and the
  // rep's browser is the child. Twilio's rule — see conferenceMoveLeg in
  // lib/sales/calls/transfer.js — is that redirecting the parent hangs the
  // child up, so an inbound transfer redirects the REP, and the contractor
  // arrives HERE the instant that happens, with DialCallStatus "completed".
  //
  // Falling through would do two wrong things at once: mark the attempt ended
  // while the caller is still on the line, and answer with an empty document,
  // which hangs up on the person the transfer was supposed to keep hold of.
  // So the caller is placed in the same conference the rep just entered,
  // through the SAME builder /api/sales/calls/transfer uses for the outbound
  // direction — a second copy of that document is the one that would forget
  // the hold callback and leave somebody in silence.
  if (attemptId && transferStoreState().ready) {
    const open = await openTransferFor(attemptId).catch(() => null);
    // Matched on the leg, not merely on the attempt: a call that was
    // transferred, came back, and rang out again reaches this function for
    // ordinary reasons, and only the leg named on the transfer row is the one
    // being moved.
    if (open && open.callerCallSid && open.callerCallSid === params.CallSid) {
      return xml(callerConferenceTwiml({ transfer: open, origin: getAppOrigin(request) }));
    }
  }

  // The rep's name is re-read from the attempt rather than carried across the
  // two legs in the query string. Two reasons, and the second is the one that
  // decided it: a name in a URL is a name in Twilio's request logs, and a
  // value round-tripped through a webhook is a value the webhook could have
  // been handed by somebody else. The row is ours and is scoped by id.
  let repName = null;
  if (attemptId && callStoreState().ready) {
    const row = await db.salesCallAttempt
      .findFirst({
        where: { id: attemptId, direction: "in" },
        select: { salesRep: { select: { name: true } } },
      })
      .catch(() => null);
    repName = row?.salesRep?.name || null;
  }

  const result = afterTransfer({
    dialCallStatus: status,
    plan: { fallbackSay: fallbackSayFor({ repName }) },
  });

  if (attemptId && callStoreState().ready) {
    // What the carrier saw about the leg we placed to the desk. Never a
    // disposition: the network saying `completed` and a person saying what the
    // conversation was are two different statements, and /api/rep-dial/status
    // holds the same line for outbound.
    // ── The pickup, not the hang-up ─────────────────────────────────────
    //
    // This stamped answeredAt with `new Date()` — the moment the <Dial>
    // ENDED — so every inbound row's wait-to-answer read as the whole call.
    // The same fix the outbound status route made (providerStatus.js
    // answeredAtFrom): the desk leg's DialCallDuration is its connected
    // seconds, so the pickup is the end minus that. The service-level
    // figures (lib/sales/calls/serviceLevel.js) read arrival (dialledAt)
    // to this stamp.
    const endedAtNow = new Date();
    await attachProviderCall({
      attemptId,
      providerStatus: status,
      answeredAt: result.answered ? answeredAtFrom({ status: "completed", at: endedAtNow, seconds }) || endedAtNow : null,
      endedAt: endedAtNow,
      // Zero is a real answer — answered and hung up immediately — so the
      // guard is finiteness, not truthiness.
      talkSeconds: Number.isFinite(seconds) ? seconds : null,
    }).catch(async (err) => {
      await recordError({
        area: "sales_inbound",
        message: `Could not attach a transfer result to attempt ${attemptId}: ${err?.message}`,
      }).catch(() => {});
    });
  }

  if (result.answered) {
    // Somebody took it. Nothing left to say; ending the document ends the call
    // that has already ended.
    const twiml = new twilio.twiml.VoiceResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // ── Nobody took it, and that is no longer the end ───────────────────────
  //
  // This used to speak the fallback and hang up: one ring, one glance at
  // presence, and a contractor who rang a salesperson back was finished with.
  // A rep who hangs up four seconds later would have answered.
  //
  // So it goes to the queue instead — which holds, looks again, and reaches
  // the SAME voicemail this branch used to reach when looking runs out. The
  // queue goes before the voicemail, not instead of it.
  //
  // `after=ring` matters: the queue holds this round rather than ringing the
  // same desk again on a presence row that has learned nothing in the last
  // second. See lib/sales/calls/queue.js.
  if (!callStoreState().ready) {
    // No presence to re-read and no attempt to hang a message on. The old
    // behaviour is the honest one here, and it still says something true.
    return speak(result.say);
  }

  // The floor said it was empty and the one browser we rang anyway did not
  // pick up. Holding them for four rounds of "still trying" on a floor
  // that has already said nobody is there is the queue's promise broken
  // the other way round — so straight to the message. `floor=empty` is
  // written into this URL by the main branch from the plan's verdict at
  // the moment of the call, not re-derived here.
  if (new URL(request.url).searchParams.get("floor") === "empty") {
    return takeMessage(result.say, { origin: getAppOrigin(request), attemptId });
  }

  const round = Number(new URL(request.url).searchParams.get("round"));
  return toQueue({
    origin: getAppOrigin(request),
    attemptId,
    round: Number.isFinite(round) && round > 0 ? round : 0,
    afterRing: true,
  });
}

/**
 * The queue: hold them, look again, and take a message when looking runs out.
 *
 * ── Entered by redirect, from four places ───────────────────────────────
 *
 * The first look finding nobody, a ring nobody took, a transfer that
 * stranded its caller, and a rep who parked the caller here on purpose — a
 * transfer to the queue (both through lib/sales/calls/transferRest.js's
 * callerToQueue; the last carries `parked=1`). One implementation,
 * because the promise it keeps — never for ever, never in silence — is only
 * worth anything if there is one place it can be broken.
 *
 * ── The call's own row is the source of the numbers ─────────────────────
 *
 * `To` and `From` are NOT read here, and that is deliberate: a caller rescued
 * out of a failed transfer arrived on an OUTBOUND call, where To is the
 * contractor and From is ours — the opposite way round from an inbound one.
 * SalesCallAttempt records which is which regardless of direction (`toE164` is
 * always the other party), so reading the row is the only version of this that
 * works in both directions.
 */
async function queueStage(request, params) {
  const url = new URL(request.url);
  const origin = getAppOrigin(request);
  const attemptId = url.searchParams.get("attemptId");
  const roundRaw = Number(url.searchParams.get("round"));
  const round = Number.isFinite(roundRaw) && roundRaw > 0 ? Math.floor(roundRaw) : 0;
  const justRang = url.searchParams.get("after") === "ring";
  // A rep handed this caller to the queue on purpose (lib/sales/calls/
  // transfer.js, kind "queue"; the flag is set by transferRest.js's
  // callerToQueue and by nothing else). Round zero's words change; nothing
  // about the bound, the hold or the voicemail does.
  const parked = url.searchParams.get("parked") === "1";

  const store = callStoreState();
  const attempt =
    store.ready && attemptId
      ? await db.salesCallAttempt
          .findUnique({
            where: { id: attemptId },
            select: {
              id: true,
              toE164: true,
              fromE164: true,
              salesRepId: true,
              salesRep: { select: { name: true } },
              // Only for the push's one line — who is ringing, by name.
              prospect: { select: { businessName: true } },
            },
          })
          .catch(() => null)
      : null;

  // Who is free RIGHT NOW. Re-read every round — the whole point of holding
  // somebody is that this answer changes while they wait.
  // `sellsIn` beside the id: a Quebec caller in the hold queue may only be
  // rung by a rep with French, re-judged every round like presence is.
  const reps = store.ready
    ? await db.salesRep.findMany({ where: { active: true }, select: { id: true, sellsIn: true } }).catch(() => null)
    : null;
  const presence = reps ? await presenceFor(reps.map((r) => r.id)).catch(() => null) : null;

  const ourNumber = attempt?.fromE164 || normalisePhone(params.To) || null;
  const numberRung = ourNumber ? await salesVoiceNumber(ourNumber).catch(() => null) : null;

  // The caller's number is the attempt row's OTHER party (toE164 — see the
  // direction note in this function's header), else Twilio's From.
  const callerNumber = attempt?.toE164 || normalisePhone(params.From) || null;
  // Re-read each round rather than carried on the row: the row's salesRepId
  // may have come from a lead match rather than a dial, and only a DIAL is
  // the evidence RECENT_CALLER_MINUTES rests on.
  const lastOut =
    attempt && callerNumber && ourNumber
      ? await lastOutboundBetween({ contactE164: callerNumber, ourE164: ourNumber }).catch(() => null)
      : null;
  const ring = ringPlan({
    assignedRepId: numberRung?.assignedRepId || null,
    presence,
    lastCalledBy: attempt?.salesRepId || null,
    lastCalledAt: lastOut?.salesRepId && lastOut.salesRepId === attempt?.salesRepId ? lastOut.dialledAt : null,
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
    // No language rule on inbound — see the first-ring block above.
  });

  const step = queueStep({
    round,
    reachableNow: ring.targets.length,
    justRang,
    holdMusicUrl: holdMusicUrl(),
    // The name is spoken only when that rep was on the ring plan: "X isn't
    // picking up" about a rep the plan never rang is a lie (queue.js).
    repName:
      attempt?.salesRep?.name && ring.targets.some((t) => t.salesRepId === attempt.salesRepId)
        ? attempt.salesRep.name
        : null,
    parked,
    maxRounds: MAX_QUEUE_ROUNDS,
  });

  const twiml = new twilio.twiml.VoiceResponse();
  for (const line of step.say) twiml.say({ voice: VOICE }, line);

  if (step.action === "ring") {
    const dial = twiml.dial({
      // The contractor's own number, so whoever picks up sees who is ringing.
      // Taken from the row rather than from `From`, for the direction reason
      // in this function's header.
      callerId: attempt?.toE164 || ourNumber || undefined,
      timeout: ring.ringSeconds,
      answerOnBridge: true,
      action: `${origin}/api/rep-dial/inbound?stage=after-dial&round=${step.nextRound}${
        attempt ? `&attemptId=${encodeURIComponent(attempt.id)}` : ""
      }`,
      method: "POST",
      // The conversation is recorded — lib/sales/calls/recording.js.
      ...dialRecordingAttrs({ origin, attemptId: attempt?.id || null }),
    });
    // Every target inside ONE <Dial>, in order. A second <Dial> verb only
    // starts after the first gives up entirely, which is a different and much
    // slower behaviour than ringing a team.
    pushRing(ring, { callerLabel: attempt?.prospect?.businessName || null, callerNumber });
    for (const target of ring.targets) {
      if (target.kind === "client") dial.client(target.value);
      else dial.number(target.value);
    }
    return xml(twiml);
  }

  if (step.action === "hold") {
    if (step.playUrl) twiml.play({}, step.playUrl);
    // Never zero and never unbounded. With no clip configured this is the
    // whole of the wait between two spoken lines.
    else if (step.pauseSeconds > 0) twiml.pause({ length: step.pauseSeconds });
    const query = new URLSearchParams({ stage: "queue", round: String(step.nextRound) });
    if (attempt) query.set("attemptId", attempt.id);
    twiml.redirect({ method: "POST" }, `${origin}/api/rep-dial/inbound?${query.toString()}`);
    return xml(twiml);
  }

  // voicemail — the end of every path through here.
  offerMessage(twiml, { origin, attemptId: attempt?.id || null });
  return xml(twiml);
}

/**
 * A message was left.
 *
 * ── This stage had no handler at all ────────────────────────────────────
 *
 * `speak()` has built a `<Record>` pointing at `?stage=after-voicemail` since
 * inbound calling landed, and POST only ever recognised `after-dial`. So the
 * recording callback fell through to the main branch and was treated as a
 * brand new inbound call: the whole floor was rung again, and the URL of the
 * message the contractor had just left was dropped on the floor. Meanwhile
 * SalesCallAttempt.voicemailUrl and .voicemailSeconds sat in the schema with
 * nothing writing them — AGENTS.md failure class 1 in both directions at once.
 *
 * Zero seconds is stored as zero: `<Record>` fires after five seconds of
 * silence, so a zero-length recording is somebody who heard the beep and
 * thought better of speaking, which is a different fact from no recording.
 */
async function afterVoicemail(request, params) {
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  const url = typeof params.RecordingUrl === "string" ? params.RecordingUrl : null;
  const seconds = Number(params.RecordingDuration);

  if (attemptId && callStoreState().ready) {
    // Read BEFORE the write, for two reasons: the push needs the rep and the
    // business name, and a Twilio retry of this callback carries the same
    // RecordingUrl — a row that already holds it has already been pushed
    // for, and must not be pushed for twice.
    const before = await db.salesCallAttempt
      .findFirst({
        where: { id: attemptId, direction: "in" },
        select: {
          id: true,
          salesRepId: true,
          toE164: true,
          fromE164: true,
          dialledAt: true,
          voicemailUrl: true,
          prospect: { select: { businessName: true } },
          lead: { select: { businessName: true } },
        },
      })
      .catch(() => null);
    const written = await recordVoicemail({
      attemptId,
      url,
      seconds: Number.isFinite(seconds) ? seconds : null,
    }).catch(async (err) => {
      await recordError({
        area: "sales_inbound",
        code: "voicemail_write_failed",
        message: `A contractor left a message on attempt ${attemptId} and it could not be attached: ${err?.message}`,
        detail: { recordingUrl: url, callSid: params.CallSid || null },
      }).catch(() => {});
      return null;
    });
    // The push that was missing. Fire-and-forget like pushRing(): Twilio is
    // waiting for the TwiML below. Only for a message that actually landed,
    // and only the first time it did.
    if (written?.updated && url && before && before.voicemailUrl !== url) {
      void assignedRepForNumber(before.fromE164).then((assignedRepId) =>
        notifyVoicemail({
          attempt: before,
          assignedRepId,
          seconds: Number.isFinite(seconds) ? seconds : null,
        }),
      );
    }
  } else if (url) {
    // Nowhere to put it. Recorded as lost rather than swallowed — somebody
    // spoke into this and a human should know the message exists.
    await recordError({
      area: "sales_inbound",
      code: "voicemail_orphaned",
      message: "A voicemail was left on the sales line with no attempt row to attach it to.",
      detail: { recordingUrl: url },
    }).catch(() => {});
  }

  const twiml = new twilio.twiml.VoiceResponse();
  // Not "somebody will ring you back": a callback is an outbound call that
  // has to clear the calling window and the do-not-contact list, and this
  // webhook cannot promise it. See fallbackSayFor().
  twiml.say({ voice: VOICE }, "Thanks — we have got your message.");
  twiml.hangup();
  return xml(twiml);
}

/**
 * The number's status callback: Twilio telling us the PARENT call ended.
 *
 * ── The only signal for a caller who hangs up ───────────────────────────
 *
 * Every other stage in this file is an `action` URL on a verb, and Twilio
 * requests none of them when the CALLER hangs up — "if the initial caller
 * hangs up, the Twilio session ends" (the <Dial> reference). A contractor who
 * rang back, heard ringing for eight seconds and gave up produced an attempt
 * row and then nothing, ever. This stage is the one request Twilio makes
 * regardless of what TwiML was running, and it is set as the number's
 * `statusCallback` at purchase (lib/crew/platformNumber.js) — for numbers
 * bought before that, by hand in the console.
 *
 * Only a terminal status does anything. `ringing` and `in-progress` are
 * acknowledged and ignored: the after-dial stage already records an answer
 * with better information than this callback carries.
 *
 * A 204 rather than TwiML: this is not a call asking what to do next.
 */
async function statusStage(params) {
  const status = typeof params.CallStatus === "string" ? params.CallStatus : null;
  const callSid = typeof params.CallSid === "string" ? params.CallSid : null;
  if (!isEndedStatus(status) || !callSid) return new NextResponse(null, { status: 204 });
  if (!callStoreState().ready) {
    await recordError({
      area: "sales_inbound",
      code: "status_before_store",
      message: `A final status (${status}) arrived for ${callSid} and SalesCallAttempt is not there to hold it.`,
      detail: { callSid, status },
    }).catch(() => {});
    return new NextResponse(null, { status: 204 });
  }
  const res = await markMissed({ providerCallSid: callSid, providerStatus: status }).catch(async (err) => {
    await recordError({
      area: "sales_inbound",
      code: "missed_write_failed",
      message: `Could not record the end of inbound call ${callSid} (${status}): ${err?.message}`,
      detail: { callSid, status },
    }).catch(() => {});
    return null;
  });
  if (res && !res.ok && res.reason === "no_attempt") {
    // A call ended that we never wrote a row for. Either the main branch
    // refused it (not our number, store down — both already logged) or it is
    // an outbound leg, whose own status callback is /api/rep-dial/status.
    // Logged at the lowest useful volume: once per CallSid, by construction.
    await recordError({
      area: "sales_inbound",
      code: "status_for_unknown_call",
      message: `A final status (${status}) arrived for ${callSid}, which has no inbound attempt row.`,
      detail: { callSid, status, to: params.To || null, from: params.From || null },
    }).catch(() => {});
  }
  if (res?.marked) {
    void assignedRepForNumber(res.attempt.fromE164).then((assignedRepId) =>
      notifyMissed({ attempt: res.attempt, assignedRepId }),
    );
  }
  return new NextResponse(null, { status: 204 });
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    // 403 with no body, exactly as the bridge and status siblings answer. An
    // unsigned request is not a caller to explain ourselves to.
    //
    // But it IS written down. A refused webhook used to leave no trace at
    // all, so a number whose voice URL pointed at a domain whose host header
    // did not match the signed URL — the exact failure a domain move or a
    // preview deployment produces — would refuse every real call from Twilio
    // silently, and the only symptom would be a rep saying a client rang and
    // nothing happened. The CallSid is the handle the owner needs to find the
    // call in Twilio's own log; the URL is what the signature was checked
    // against, which is the thing that is usually wrong.
    await recordError({
      area: "sales_inbound",
      code: "signature_rejected",
      message: `A request to the sales inbound webhook failed Twilio signature verification${
        params?.CallSid ? ` (CallSid ${params.CallSid})` : ""
      }.`,
      detail: {
        callSid: params?.CallSid || null,
        callStatus: params?.CallStatus || null,
        to: params?.To || null,
        from: params?.From || null,
        stage: new URL(request.url).searchParams.get("stage") || null,
        url: request.url,
        host: request.headers.get("host") || null,
        forwardedProto: request.headers.get("x-forwarded-proto") || null,
        signaturePresent: Boolean(request.headers.get("x-twilio-signature")),
        authTokenSet: Boolean(process.env.TWILIO_AUTH_TOKEN),
      },
    }).catch(() => {});
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    return await handle(request, params);
  } catch (err) {
    // Never a 500 to Twilio: it plays "an application error has occurred"
    // to a contractor who was given this number by a salesperson. The
    // failure goes to /platform/errors WITH the CallSid, and the caller
    // hears a true sentence. Before this, a throw anywhere below reached
    // Next's default handler and was recorded nowhere we look.
    await recordError({
      area: "sales_inbound",
      code: "webhook_threw",
      message: `The sales inbound webhook threw${params?.CallSid ? ` on CallSid ${params.CallSid}` : ""}: ${err?.message}`,
      detail: {
        callSid: params?.CallSid || null,
        stage: new URL(request.url).searchParams.get("stage") || null,
        to: params?.To || null,
        from: params?.From || null,
        stack: String(err?.stack || "").split("\n").slice(0, 5).join("\n"),
      },
    }).catch(() => {});
    return speak([
      "Thanks for calling back.",
      "We are not able to take your call at the moment. Please try again shortly.",
    ]);
  }
}

async function handle(request, params) {
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  if (stage === "status") {
    // A notification: a throw here is a logged error and a 204, never a 500
    // — Twilio sends a final status once and would only file a warning.
    return acknowledged(() => statusStage(params), {
      area: "sales_inbound",
      code: "status_webhook_threw",
      what: `A final status for inbound call ${typeof params.CallSid === "string" ? params.CallSid : "(no CallSid)"}`,
    });
  }
  if (stage === "after-dial") return afterDial(request, params);
  // Two stages that did not exist. `queue` holds a caller instead of dropping
  // them; `after-voicemail` had a <Record> pointing at it and no handler, so
  // every message left on this line was re-processed as a fresh inbound call.
  if (stage === "queue") return queueStage(request, params);
  if (stage === "after-voicemail") return afterVoicemail(request, params);

  const store = callStoreState();
  const rung = normalisePhone(params.To);
  const caller = normalisePhone(params.From);
  const callSid = typeof params.CallSid === "string" ? params.CallSid : null;

  // ── Is this one of ours, and is it a SALES number? ──────────────────────
  //
  // Scoped in the query to purpose "sales_voice" and active, so a number whose
  // purpose is `system` — which sends and receives on behalf of TENANTS —
  // resolves to nothing here rather than to a row a later branch might use. A
  // contractor's crew line answering with FieldQuo's sales message would be a
  // white-label breach as well as a wrong answer.
  const numberRung = rung ? await salesVoiceNumber(rung).catch(() => null) : null;

  if (!numberRung) {
    await recordError({
      area: "sales_inbound",
      code: "unknown_number",
      message: `A call arrived at the sales inbound webhook for ${rung || "an unreadable number"}, which is not an active sales_voice number.`,
      detail: { to: params.To || null, callSid },
    }).catch(() => {});
    return speak(inboundPlan({ numberRung: null }).say);
  }

  if (!store.ready) {
    await recordError({
      area: "sales_inbound",
      code: "call_store_unavailable",
      message: `A contractor rang ${numberRung.e164} and the call could not be recorded: ${store.missing.join(", ")} missing.`,
      detail: { missing: store.missing, callSid },
    }).catch(() => {});
    return speak(inboundPlan({ numberRung, storeReady: false }).say);
  }

  // ── Who is ringing, and who should hear about it ────────────────────────
  //
  // Every read is scoped and none of them is allowed to fail the call: a
  // database hiccup must produce a call that is answered and logged plainly,
  // not a Twilio error announcement. Hence the catch on each, and hence `null`
  // rather than `[]` where the difference matters — matchInboundCaller draws
  // the distinction between "nobody carries this number" and "we could not
  // look", and so does the presence read.
  const [prospects, leads, lastOut, suppression, activeReps] = await Promise.all([
    caller
      ? db.prospect
          .findMany({
            where: { phoneE164: caller },
            // `province`: a matched Quebec row makes this a French call even
            // when the caller's number is not a Quebec area code.
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
    caller
      ? lastOutboundBetween({ contactE164: caller, ourE164: numberRung.e164 }).catch(() => null)
      : Promise.resolve(null),
    // The do-not-contact list still binds, and answering is not a breach of
    // it — they rang us. What it changes is that this call is not an opening
    // to sell, and NOTHING on this path clears the entry: there is no write to
    // salesSuppression anywhere in this file, in either direction.
    caller
      ? checkSuppression(db, { channel: "phone", phone: caller }).catch(() => null)
      : Promise.resolve(null),
    // The active reps WITH their selling languages, kept for the ring plan
    // below; presence is read for the same ids. Null on a failure, which
    // ringPlan reads as "could not look" rather than "nobody".
    db.salesRep
      .findMany({ where: { active: true }, select: { id: true, sellsIn: true } })
      .catch(() => null),
  ]);
  const presenceRows = activeReps ? await presenceFor(activeReps.map((r) => r.id)).catch(() => null) : null;

  const match = matchInboundCaller({ fromE164: params.From, prospects, leads });
  const matchedProspect = match.prospectId ? prospects.find((p) => p.id === match.prospectId) : null;
  // ── No language rule on the way IN (owner, 2026-09-17) ──────────────────
  //
  // "Any person calling this number should not be blocked — you don't know
  // if I'm speaking English or French. The French and English rule is for
  // the leads only." An area code is where a phone was issued, not what its
  // owner speaks, and a contractor ringing back is ringing a number they
  // already talked to. So the rule lib/sales/leadLanguage.js applies to the
  // QUEUE — which rep is handed which lead to dial — stays off the inbound
  // plan: every reachable rep is rung. ringPlan still accepts the language
  // arguments (scripts/check-inbound-distribution.mjs exercises them) and
  // this route simply never sets them.

  // The rep who rang them from THIS number wins over the rep who happens to
  // hold the claim: the contractor is ringing back the number on their screen,
  // and the person who put it there is the person with the context. The claim
  // holder is the fallback, and inboundMatch.js is explicit that reporting a
  // claim holder is telling somebody their prospect rang — never authority to
  // give them anything.
  const rep = await repToTell([lastOut?.salesRepId, match.salesRepId]);
  const ring = ringPlan({
    assignedRepId: numberRung.assignedRepId || null,
    presence: presenceRows,
    lastCalledBy: lastOut?.salesRepId || null,
    lastCalledAt: lastOut?.dialledAt || null,
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
  });

  const plan = inboundPlan({
    numberRung,
    storeReady: true,
    fromE164: caller,
    match,
    rep,
    anyRepLive: anyRepLive(presenceRows),
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
    suppressed: Boolean(suppression?.suppressed),
    // How many browsers the ring plan can reach. An empty floor with one
    // of these still rings — see inboundPlan().
    ringable: ring.targets.filter((t) => t.kind === "client").length,
  });

  // ── The row, before anything is answered ────────────────────────────────
  //
  // A failure to write it does not drop the call — the contractor is on the
  // line and hanging up on them to protect a log would be the wrong trade —
  // but it is recorded loudly, because a call that leaves no trace is the
  // state this route exists to end.
  let attempt = null;
  if (plan.recordAttempt) {
    const written = await recordInbound({
      salesRepId: rep?.id || null,
      // Only ever the single unambiguous match. `ambiguous` deliberately
      // attaches to nothing: two businesses carry this number, prospect
      // dedupe flags rather than merges, and picking one would file a call
      // against the wrong company with no way to notice afterwards.
      prospectId: match.prospectId,
      leadId: match.salesLeadId,
      contactE164: caller,
      ourE164: numberRung.e164,
      providerCallSid: callSid,
      matchedBy: match.matchedBy,
    }).catch(async (err) => {
      await recordError({
        area: "sales_inbound",
        code: "attempt_write_failed",
        message: `A contractor rang ${numberRung.e164} and the attempt row could not be written: ${err?.message}`,
        detail: { callSid, matchOutcome: match.outcome },
      }).catch(() => {});
      return null;
    });
    attempt = written?.attempt || null;
  }

  // ── Who to ring ─────────────────────────────────────────────────────────
  //
  // inboundPlan decides whether the call may be connected at all — suppressed
  // caller, store not ready, number not ours. It used to decide WHERE too, and
  // its only answer was FIELDQUO_SALES_TRANSFER_TO: one env var, so a
  // contractor ringing back the number a rep had called them from was answered,
  // told nobody was free, and hung up on, while that rep sat in the console
  // with a registered Device and an available presence row.
  //
  // ringPlan answers the WHERE: the number's owner first, then whoever rang
  // this caller last, then whoever is genuinely available, then the transfer
  // number. See lib/sales/calls/inboundDistribution.js.

  const origin = getAppOrigin(request);

  // Nobody free — the floor signed out, or no desk to transfer to. Told the
  // truth and then offered the beep. The attempt row already exists
  // (recordAttempt is true on both INBOUND_MESSAGE reasons), so the recording
  // has a row to land on and a rep's Voicemail tab to show up in. This branch
  // used to speak() and hang up, and the two real callbacks so far both did.
  if (plan.action === INBOUND_MESSAGE) {
    return takeMessage(plan.say, { origin, attemptId: attempt?.id || null });
  }

  // A refusal — a number that is not ours, a store that cannot record the
  // call. Said and ended, with no voicemail offered: a message from somebody
  // we may not act on is worse than no message.
  if (plan.action !== INBOUND_CONNECT) {
    return speak(plan.say);
  }

  // ── Nobody free on the first look ───────────────────────────────────────
  //
  // This used to be the end of the call: one glance at a presence table, then
  // noAnswerSay and a voicemail. It is now the START of a wait — the queue
  // holds them, looks again, and reaches that same voicemail when looking runs
  // out. Never an empty <Dial>, which rings for twenty seconds and then hangs
  // up without a word.
  if (ring.targets.length === 0) {
    // The rep who rang them is on another call: the caller is held for
    // her (the queue re-plans every round and rings her when it ends), and
    // she is told now, by name, that they are waiting. Not the generic
    // "Incoming call" — she cannot take it yet, and a notice that says
    // what is true is one she can act on when she hangs up.
    if (ring.holdFor?.salesRepId) {
      const who =
        (matchedProspect && matchedProspect.businessName) ||
        (match.salesLeadId && leads.find((l) => l.id === match.salesLeadId)?.businessName) ||
        caller ||
        "";
      void pushToReps({
        salesRepIds: [ring.holdFor.salesRepId],
        payload: async (language) => ({
          title: await appSentence(language, "app.notify.incomingCall.title"),
          body: await appSentence(language, "app.notify.ringingBack.body", { who }),
          tag: `sales-ring:${caller || "withheld"}`,
          url: "/sales/queue",
        }),
      });
      return toQueue({ origin, attemptId: attempt?.id || null, round: 0 });
    }
    // Nobody to ring, so nobody's browser will show the dock — but the rep
    // this call is filed to still gets the push, so a closed laptop on a
    // phone can open the console while the caller holds. The queue re-reads
    // presence every round and will ring them the moment they are seen.
    if (rep?.id) {
      pushRing(
        { targets: [{ kind: "client", salesRepId: rep.id }] },
        {
          callerLabel:
            (matchedProspect && matchedProspect.businessName) ||
            (match.salesLeadId && leads.find((l) => l.id === match.salesLeadId)?.businessName) ||
            null,
          callerNumber: caller,
        },
      );
    }
    return toQueue({ origin, attemptId: attempt?.id || null, round: 0 });
  }
  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({
    // The CALLER's number, so whoever picks the desk up sees who is ringing.
    // Twilio's rule is that a callerId must be a number the account owns or a
    // verified one, with an explicit exception for forwarding an incoming
    // call, which is exactly what this is. A withheld caller ID falls back to
    // the sales_voice number that was rung — a number FieldQuo owns, so the
    // leg is placeable either way.
    callerId: caller || numberRung.e164,
    timeout: ring.ringSeconds,
    answerOnBridge: true,
    // The attempt id travels in the query string we build, never in the body:
    // Twilio echoes the URL it was given, and a body parameter would be
    // whatever the leg happened to carry. Same rule /api/rep-dial/status
    // states for the outbound direction.
    action: `${origin}/api/rep-dial/inbound?stage=after-dial${
      attempt ? `&attemptId=${encodeURIComponent(attempt.id)}` : ""
    }${plan.floorEmpty ? "&floor=empty" : ""}`,
    method: "POST",
    // The conversation is recorded, dual-channel, from answer — the decision
    // and its reasons are in lib/sales/calls/recording.js.
    ...dialRecordingAttrs({ origin, attemptId: attempt?.id || null }),
  });
  // Every target, in order, inside ONE <Dial>. Twilio rings them in sequence
  // and the first to answer wins — which is what a rep expects when a call
  // "comes to the team" and is the behaviour a second <Dial> would not give,
  // because a second verb only runs after the first one gives up entirely.
  pushRing(ring, {
    callerLabel:
      (matchedProspect && matchedProspect.businessName) ||
      (match.salesLeadId && leads.find((l) => l.id === match.salesLeadId)?.businessName) ||
      null,
    callerNumber: caller,
  });
  for (const target of ring.targets) {
    if (target.kind === "client") dial.client(target.value);
    else dial.number(target.value);
  }

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
