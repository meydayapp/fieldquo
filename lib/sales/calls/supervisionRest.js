// lib/sales/calls/supervisionRest.js
//
// The hands for lib/sales/calls/supervision.js: every Twilio REST call the
// conference mode, hold and supervision make. No decisions here — the same
// split transferRest.js keeps from transfer.js, for the same reason: a
// check script can execute every decision without a Twilio account, and a
// route that decided for itself would be the copy that rots.
//
// ══ Every action names the room by SID when it has one ════════════════════
//
// Twilio resolves a conference's friendly name only while the room is
// in-progress (the live test on 2026-09-21: participants.create by name
// created the room; participants(...).update by name answered 404 once the
// room had ended). The first conference status callback carries the
// ConferenceSid and /api/rep-dial/conference writes it on the row;
// `roomRef` prefers it and falls back to the name, so a REST action in the
// first second of a call still finds the room.
//
// ══ A failure is returned, never thrown, and never silent ═════════════════
//
// Each of these is on a live call. The routes read `ok` and tell the person
// who pressed the button, and record an error against the attempt.
import { twilioRest } from "@/lib/sms/twilioClient";

function roomRef(attempt) {
  return attempt?.conferenceSid || attempt?.conferenceName || null;
}

/**
 * Dial the prospect into the attempt's room as a recorded participant.
 * Called by the bridge with the params supervision.js built. Returns the
 * participant's CallSid, which the status webhook will also report.
 */
export async function addProspectParticipant({ conferenceName, params }) {
  if (!conferenceName || !params) return { ok: false, error: "nothing to dial", callSid: null };
  try {
    const p = await twilioRest.conferences(conferenceName).participants.create(params);
    return { ok: true, error: null, callSid: p?.callSid || null, conferenceSid: p?.conferenceSid || null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), callSid: null, conferenceSid: null };
  }
}

/** Hold / unhold / mute / coach one participant of the attempt's room. */
export async function updateParticipant({ attempt, callSid, update }) {
  const room = roomRef(attempt);
  if (!room || !callSid || !update) return { ok: false, error: "no participant to update" };
  try {
    await twilioRest.conferences(room).participants(callSid).update(update);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * End the whole room. Every leg in it is hung up by Twilio, which is what
 * fires the rep's browser `disconnect` and the ordinary write-up flow.
 * Idempotent: a room that is already over answers ok.
 */
export async function endConference(attempt) {
  const room = roomRef(attempt);
  if (!room) return { ok: false, error: "no conference on this attempt" };
  try {
    if (attempt?.conferenceSid) {
      await twilioRest.conferences(attempt.conferenceSid).update({ status: "completed" });
      return { ok: true, error: null };
    }
    // Only the name is known: look the live room up first.
    const rows = await twilioRest.conferences.list({ friendlyName: room, status: "in-progress", limit: 1 });
    if (!rows.length) return { ok: true, error: null };
    await twilioRest.conferences(rows[0].sid).update({ status: "completed" });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err?.message || String(err);
    // 20404 / "not found": the room is gone already, which is the goal.
    if (/not found|20404/i.test(msg)) return { ok: true, error: null };
    return { ok: false, error: msg };
  }
}

/** Hang one leg up. Used for the rep on TAKE and for the supervisor on Leave. */
export async function hangupLeg(callSid) {
  if (!callSid) return { ok: false, error: "no leg" };
  try {
    await twilioRest.calls(callSid).update({ status: "completed" });
    return { ok: true, error: null };
  } catch (err) {
    const msg = err?.message || String(err);
    if (/not found|20404|not in-progress|Call is not in-progress/i.test(msg)) return { ok: true, error: null };
    return { ok: false, error: msg };
  }
}

/**
 * Apply takePlan's action list, in order. `ok` is false when any step
 * failed — a rep removed while the supervisor is still muted is a prospect
 * talking to silence.
 */
export async function applyTakeActions({ actions = [], attempt, mark }) {
  const failed = [];
  for (const action of actions) {
    try {
      if (action.type === "mark") {
        await mark(action.kind);
      } else if (action.type === "unmuteSupervisor") {
        const r = await updateParticipant({ attempt, callSid: attempt.supervisorCallSid, update: { coaching: false, callSidToCoach: attempt.repCallSid, muted: false } });
        if (!r.ok) throw new Error(r.error);
      } else if (action.type === "unholdProspect") {
        const r = await updateParticipant({ attempt, callSid: attempt.providerCallSid, update: { hold: false } });
        if (!r.ok) throw new Error(r.error);
      } else if (action.type === "hangupRep") {
        const r = await hangupLeg(attempt.repCallSid);
        if (!r.ok) throw new Error(r.error);
      } else {
        throw new Error(`unknown action "${action.type}"`);
      }
    } catch (err) {
      failed.push({ action, error: err?.message || String(err) });
    }
  }
  return { ok: failed.length === 0, failed };
}
