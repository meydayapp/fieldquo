// lib/sales/calls/transferRest.js
//
// The hands. lib/sales/calls/transfer.js decides; this does what it decided.
//
// ══ Why this is its own file ══════════════════════════════════════════════
//
// Two callers need it — the rep pressing a button (app/api/sales/calls/transfer)
// and Twilio reporting on the conference (app/api/rep-dial/transfer) — and
// they apply the SAME action list. A copy in each is AGENTS.md failure class 4,
// and the copy that rots would be the webhook, because that is the one nobody
// looks at.
//
// ══ It contains no decisions ══════════════════════════════════════════════
//
// Every branch below is on the ACTION TYPE, never on the state of the
// transfer, never on who is reachable, never on warm versus cold. If a
// condition ever needs to be added here, it belongs in transfer.js instead,
// where a check script can execute it without a Twilio account.
//
// ══ A failed action is reported, not swallowed ════════════════════════════
//
// Every one of these is a live call: an unhold that silently failed leaves a
// contractor listening to hold music with nobody coming. So each result is
// collected, the caller is told which ones failed, and the routes record an
// error against the transfer rather than answering "ok" because the loop
// finished.
import twilio from "twilio";
import { twilioRest } from "@/lib/sms/twilioClient";
import { repLegPlan } from "./transfer";

const VoiceResponse = twilio.twiml.VoiceResponse;

/** The voice Twilio's <Say> uses. The same one every rep-dial route speaks with. */
const VOICE = "alice";

/** Which CallSid one `who` refers to. The only mapping in this file. */
function sidFor(transfer, who) {
  if (who === "caller") return transfer?.callerCallSid || null;
  if (who === "rep") return transfer?.repCallSid || null;
  if (who === "target") return transfer?.targetCallSid || null;
  return null;
}

/**
 * Is a leg still up?
 *
 * Read fresh from the carrier every time it is asked, never inferred from a
 * webhook we happened to receive. `onTargetEnded` branches on this to decide
 * between handing the caller back and rescuing them into the queue, and
 * guessing wrong in the optimistic direction leaves somebody on hold in an
 * empty room.
 *
 * Returns `true` on an error rather than `false`, and that direction is
 * deliberate: an unreadable carrier means we do not know, and the answer to
 * "we do not know" is to hand the caller back to a rep who is probably there
 * rather than to eject them into a queue they did not need.
 */
export async function legIsUp(callSid) {
  if (!callSid) return false;
  try {
    const call = await twilioRest.calls(callSid).fetch();
    return call?.status === "in-progress" || call?.status === "ringing";
  } catch {
    return true;
  }
}

/**
 * Move the caller out of the two-party bridge and into the transfer's
 * conference.
 *
 * ── The CALLER's leg is redirected, never the rep's ─────────────────────
 *
 * Twilio treats the two ends of a `<Dial>` completely differently. Redirecting
 * the PARENT (the rep's browser leg) cancels the `<Dial>` and hangs the caller
 * up — the exact opposite of a transfer. Redirecting the CHILD (the caller)
 * ends the `<Dial>` cleanly and sends the parent to the Dial's `action` URL,
 * which is how the rep follows them into the conference. That asymmetry is the
 * single most important sentence in this file.
 *
 * `startConferenceOnEnter` is false for the caller so that Twilio's own wait
 * music starts the moment they arrive: there is a beat between joining and the
 * hold being applied, and a beat of silence is what a person on a bad line
 * reads as a dropped call.
 */
export async function moveCallerToConference({ transfer, origin }) {
  const sid = transfer?.callerCallSid;
  if (!sid || !transfer?.conferenceName) {
    return { ok: false, error: "There is no caller leg to move." };
  }
  // Rendered through Twilio's own builder rather than concatenated, so the
  // callback URL's `&` is escaped as XML requires. A hand-built document with
  // a bare ampersand is well-formed right up until the day a second query
  // parameter is added to it.
  const twiml = callerConferenceTwiml({ transfer, origin }).toString();
  await twilioRest.calls(sid).update({ twiml });
  return { ok: true, error: null };
}

/**
 * The caller's conference document. Exported so the check script can render it
 * and assert on the XML — an ordering or attribute guarantee is only true if
 * it survives into what Twilio actually reads.
 */
export function callerConferenceTwiml({ transfer, origin }) {
  const response = new VoiceResponse();
  const dial = response.dial();
  dial.conference(
    {
      startConferenceOnEnter: false,
      // The caller ends the room. If the person who rang hangs up, nobody is
      // left holding a conference that bills by the participant-minute.
      endConferenceOnExit: true,
      beep: false,
      statusCallback: `${origin}/api/rep-dial/transfer?stage=conference&transferId=${encodeURIComponent(transfer.id)}`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: "join leave",
    },
    transfer.conferenceName,
  );
  return response;
}

/**
 * Say the lines, then join the conference — or say them and stop.
 *
 * The document a REP-side leg gets, whichever way it arrives at the
 * conference: fetched, when the leg was sent here by a `<Dial>` action
 * (app/api/rep-dial/transfer), or pushed, when the leg is redirected into it
 * (moveRepToConference below). It was written once in the webhook route and
 * has moved here so the pushed copy cannot be the one that forgets
 * `endConferenceOnExit: false` and ends the whole conference when a rep steps
 * out of it — AGENTS.md failure class 4 aimed at a live call.
 *
 * Returns the VoiceResponse rather than an HTTP response, because only one of
 * its two callers is answering a request.
 */
export function conferenceJoinTwiml({ plan, conferenceName, origin, transferId }) {
  const twiml = new VoiceResponse();
  for (const line of plan?.say || []) twiml.say({ voice: VOICE }, line);
  if (!plan?.join || !conferenceName) {
    twiml.hangup();
    return twiml;
  }
  const dial = twiml.dial();
  dial.conference(
    {
      // A rep entering starts the room. The caller was placed with
      // startConferenceOnEnter false so they hear wait music until somebody
      // who can actually talk to them arrives.
      startConferenceOnEnter: true,
      // NEVER true here. The transferring rep steps out of a completed
      // transfer on purpose, and ending the conference on their way would drop
      // the caller and the person who just took them.
      endConferenceOnExit: false,
      beep: false,
      statusCallback: `${origin}/api/rep-dial/transfer?stage=conference&transferId=${encodeURIComponent(transferId)}`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: "join leave",
    },
    conferenceName,
  );
  return twiml;
}

/**
 * Move the transferring REP into the conference — the inbound half of
 * moveCallerToConference.
 *
 * ── Why the rep is the one redirected on an inbound call ────────────────
 *
 * Because on an inbound call the rep's browser leg is the CHILD of the
 * contractor's `<Dial>`, and Twilio's rule — stated at moveCallerToConference
 * and applied by lib/sales/calls/transfer.js's conferenceMoveLeg — is that
 * redirecting the child ends the Dial cleanly while redirecting the parent
 * hangs the other party up. Calling moveCallerToConference on an inbound call
 * would therefore drop the rep, leaving nobody to hand the caller back to.
 *
 * The contractor is not left behind: their `<Dial>` ends the moment this leg
 * leaves it, which sends them to that Dial's own action —
 * /api/rep-dial/inbound?stage=after-dial — where the open transfer is found
 * and they are placed in the same conference.
 *
 * For the beat between the two the rep is alone in a started conference. That
 * is deliberate rather than tidy: the alternative, entering with
 * `startConferenceOnEnter` false, leaves the room unstarted, and a transfer
 * cancelled before the target answers would then unhold two people into a
 * conference that never began — hold music with no end, which is the exact
 * failure this module is built around.
 */
export async function moveRepToConference({ transfer, origin }) {
  const sid = transfer?.repCallSid;
  if (!sid || !transfer?.conferenceName) {
    return { ok: false, error: "There is no rep leg to move." };
  }
  const plan = repLegPlan({ transfer });
  if (!plan.join) {
    return { ok: false, error: "That transfer is no longer open." };
  }
  const twiml = conferenceJoinTwiml({
    plan,
    conferenceName: plan.conferenceName,
    origin,
    transferId: transfer.id,
  }).toString();
  await twilioRest.calls(sid).update({ twiml });
  return { ok: true, error: null };
}

/**
 * Who is still in the conference.
 *
 * Read from the carrier rather than counted from the events we have seen: a
 * missed or reordered webhook would make a local tally say two people are in a
 * room containing one, and that tally is what decides whether a caller is
 * rescued.
 */
export async function conferenceParticipantSids(conferenceName) {
  if (!conferenceName) return [];
  try {
    const rows = await twilioRest.conferences(conferenceName).participants.list({ limit: 20 });
    return rows.map((p) => p?.callSid).filter(Boolean);
  } catch {
    // Unreadable is not empty. An empty list would read as "the caller is
    // alone" and eject somebody who is mid-conversation.
    return null;
  }
}

/**
 * Place the leg to the transfer target.
 *
 * @param target    one entry from transferTargets() — `kind` decides nothing
 *                  here beyond what string goes in `to`, because Twilio takes
 *                  `client:identity` and an E.164 number in the same field.
 * @param fromE164  the number FieldQuo already presented on this call. Reused
 *                  rather than re-chosen so that a rep receiving a transfer
 *                  sees the same number the contractor is looking at.
 */
export async function dialTransferTarget({
  transfer,
  target,
  fromE164,
  origin,
  ringSeconds,
}) {
  const to = target?.kind === "client" ? `client:${target.value}` : target?.value;
  if (!to || !fromE164) {
    return { ok: false, error: "There is no number to place the transfer leg from.", callSid: null };
  }
  const call = await twilioRest.calls.create({
    to,
    from: fromE164,
    // The target's TwiML names only our own transfer id. Nothing in the
    // request chooses a destination — the same property that keeps
    // /api/rep-dial/bridge from being an open relay.
    url: `${origin}/api/rep-dial/transfer?stage=target&transferId=${encodeURIComponent(transfer.id)}`,
    method: "POST",
    statusCallback: `${origin}/api/rep-dial/transfer?stage=target-status&transferId=${encodeURIComponent(transfer.id)}`,
    statusCallbackMethod: "POST",
    // `completed` covers the answered-then-hung-up case and `no-answer`,
    // `busy` and `failed` all arrive as the terminal event too. `initiated` is
    // left out for the reason the bridge gives: it reports only what we
    // already know.
    statusCallbackEvent: ["answered", "completed"],
    timeout: ringSeconds,
  });
  return { ok: true, error: null, callSid: call?.sid || null };
}

/**
 * Apply an action list from transfer.js.
 *
 * @returns `{ ok, failed: [{ action, error }] }`. `ok` is false when ANY
 *          action failed, because a half-applied transfer is worse than none:
 *          the caller off hold with the rep still on it is a rep talking to
 *          nobody while a contractor listens.
 */
export async function applyTransferActions({ actions = [], transfer = null, origin = null } = {}) {
  const failed = [];
  for (const action of Array.isArray(actions) ? actions : []) {
    try {
      if (action.type === "hold" || action.type === "unhold") {
        const sid = sidFor(transfer, action.who);
        if (!sid) throw new Error(`no ${action.who} leg on this transfer`);
        await twilioRest
          .conferences(transfer.conferenceName)
          .participants(sid)
          // No `holdUrl`. Twilio's own default hold music plays, which is the
          // one arrangement that cannot be broken by a missing asset — and a
          // caller hearing silence is the failure this whole feature is about.
          .update({ hold: action.type === "hold" });
      } else if (action.type === "endOnExit") {
        const sid = sidFor(transfer, action.who);
        if (!sid) throw new Error(`no ${action.who} leg on this transfer`);
        await twilioRest
          .conferences(transfer.conferenceName)
          .participants(sid)
          .update({ endConferenceOnExit: true });
      } else if (action.type === "hangup") {
        const sid = sidFor(transfer, action.who);
        if (!sid) throw new Error(`no ${action.who} leg on this transfer`);
        await twilioRest.calls(sid).update({ status: "completed" });
      } else if (action.type === "hangupTarget") {
        const sid = sidFor(transfer, "target");
        // Not an error: cancelling before the target leg was created is the
        // ordinary fast double-press, and there is nothing to hang up.
        if (sid) await twilioRest.calls(sid).update({ status: "completed" });
      } else if (action.type === "callerToQueue") {
        const sid = sidFor(transfer, "caller");
        if (!sid) throw new Error("no caller leg on this transfer");
        if (!origin) throw new Error("no origin to build the queue URL from");
        await twilioRest.calls(sid).update({
          url: `${origin}/api/rep-dial/inbound?stage=queue&round=0&attemptId=${encodeURIComponent(transfer.attemptId)}`,
          method: "POST",
        });
      } else {
        throw new Error(`unknown action "${action.type}"`);
      }
    } catch (err) {
      failed.push({ action, error: err?.message || String(err) });
    }
  }
  return { ok: failed.length === 0, failed };
}
