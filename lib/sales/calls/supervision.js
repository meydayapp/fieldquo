// lib/sales/calls/supervision.js
//
// A superadmin on the floor board listens to a live sales call, whispers to
// the rep, joins the conversation, or takes the call away — and a rep puts
// the prospect on hold. The decisions, pure; the hands are in
// supervisionRest.js and the routes.
//
// ══ The model: OMniLeads ═══════════════════════════════════════════════════
//
// ominicontacto_app/services/asterisk/supervisor_activity.py, lines 34–35:
// EXTENSIONES = AGENTLOGOUT, AGENTUNPAUSE, AGENTPAUSE, CHANTAKECALL,
// CHANSPYWISHPER, CHANSPY, CHANCONFER. Lines 78–100,
// `ejecutar_accion_sobre_agente`: the three AGENT* actions are handled in
// Python (presence — another agent owns those here and this file does not
// touch them); the four CHAN* actions ORIGINATE A CALL FROM THE SUPERVISOR'S
// OWN PHONE (`PJSIP/<sip_extension>`, line 81) into dialplan context
// `oml-sup-actions` with the agent's id in a channel variable (lines 82–83,
// 100). That is the shape kept here: the supervisor is a participant on
// their own audio device, the server puts them in the room, and nothing
// about which call or which mode comes from the browser.
//
// api_app/views/supervisor.py, InteraccionDeSupervisorSobreAgenteView
// (lines 275–305): a POST with `accion`, permission-checked on the
// supervisor profile, refused with 403 when the user is not one. The
// shipped board (supervision_app/static/supervision_app/JS/supervision.js,
// lines 210–235) wires CHANSPY ("Monitoreo") and CHANSPYWISHPER
// ("Susurrar") as buttons; CHANCONFER and CHANTAKECALL exist in the
// extension list and in the Asterisk dialplan (not in this repository) but
// have no button in that JS. FieldQuo ships all four, because the owner
// asked for all four.
//
// Hold: ominicontacto_app/static/ominicontacto/JS/agente/phoneJsController.js
// lines 200–218 (the hold button: FSM `startOnHold` / `releaseHold`, a
// timer shown while held, and `oml_api.eventHold(call_id)` on BOTH edges),
// lines 1368–1379 (`disableOnHold`: the button is removed from the OnCall
// and OnHold states when the group's `on_hold` privilege is off — a control
// that cannot work is not drawn), and models.py Grupo.on_hold (~line 297).
// api_app/views/agente.py ApiEventoHold (lines 610–640) writes a LlamadaLog
// row with event HOLD or UNHOLD and the time; reportes_app/models.py line
// 408 (EVENTOS_HOLD) and reportes/reporte_agente_tiempos.py lines 338–350
// sum hold time from those pairs. SalesCallEvent is that table here.
//
// ══ The Twilio mechanism, and why (a) — a conference from the start ═══════
//
// Twilio can only coach a participant of a CONFERENCE: Participant
// `Coaching=true` + `CallSidToCoach=<the rep's leg>` ("the participant being
// coached is the only participant who can hear the participant who is
// coaching" — docs, Participant resource). Today an outbound sales call is
// a two-party `<Dial><Number>` bridge, and only a transfer moves the legs
// into a conference (lib/sales/calls/transfer.js). Two options were weighed:
//
//   (a) every rep call runs in a per-attempt conference from the first
//       ring — the OMniLeads model, where every agent leg is a queue member
//       Asterisk can ChanSpy at any moment;
//   (b) on demand — redirect both legs into a conference the moment a
//       supervisor presses a button, exactly as transfer.js does.
//
// (a) is what this file builds, for three reasons read out of the code:
//
//   1. (b) ENDS THE RECORDING. The `<Dial>`'s `record-from-answer-dual`
//      file stops when the `<Dial>` ends, which is what redirecting the
//      prospect's leg does (transfer.js, "Twilio's rule, which decides this
//      entirely"). The conference then starts a second file, and
//      lib/sales/calls/store.js recordCallRecording lets the later sid
//      REPLACE the earlier one — so a supervised call would lose its first
//      half of transcript. That is a silent change to the recording shape,
//      and the brief said not to make one.
//   2. (b) is audible: a one-to-two second gap while two legs are moved,
//      and the prospect hears it at precisely the moment a supervisor
//      decided the call needed help.
//   3. Hold needs the conference anyway. A `<Dial>` bridge has no hold —
//      the only per-participant hold Twilio has is a conference
//      participant's `Hold=true` (transfer.js, "Hold, rather than 'start
//      the conference later'"). With (a) hold is one REST call on the
//      prospect's participant; with (b) it would be the same redirect and
//      the same lost recording.
//
// What (a) costs, and where the owner's approval lives: Twilio bills
// conference minutes ON TOP of each leg — US voice pricing page, read
// 2026-09-21: browser leg $0.0040/min, outbound US PSTN $0.0140/min,
// conference "starting at $0.0018 / participant per min", recording
// $0.0025/min. A two-party call is $0.018/min as a bridge and $0.0216/min
// as a two-participant conference (+$0.0036/min, +20%); a supervisor
// listening adds their own browser leg and participant, $0.0058/min. That
// delta is why the whole mode sits behind `sales.supervision.enabled`,
// default OFF: flipping it on /platform/sales/windows is the approval.
// OFF means the bridge is byte-for-byte what it was — no conference, no
// hold button, no supervision buttons (the board says why), no cost change.
//
// ══ Recording, in conference mode ═════════════════════════════════════════
//
// The prospect's PARTICIPANT is recorded, dual-channel, from answer:
// Participant `Record=true`, `RecordingChannels=dual`. Twilio's Recording
// resource docs: "for conferences, the Recording's dual-channel media file
// contains the audio of the first participant that joined the Conference
// with recording enabled in the first channel and all other audio from
// the Call mixed in the second channel." So channel 1 is the prospect and
// channel 2 is everything they heard — the rep, and a supervisor who barged
// (which the prospect heard, and belongs on a transcript of what was said
// to them). A WHISPER is never in the file: it is audio to the rep only,
// and the rep's leg is not the one recorded. Hold music IS on channel 2
// while the prospect is held; lib/sales/calls/transcribe.js blanks those
// seconds from the rep's track using the HOLD/UNHOLD rows before the model
// hears them. The channel ORDER is the reverse of a `<Dial>`'s (parent
// first — recording.js channelSpeakers); `conferenceName` on the row is
// what tells the transcriber which rule applies. The callback URL, the
// webhook and the store are unchanged.
//
// ══ Who may do what ═══════════════════════════════════════════════════════
//
// Superadmin only, checked server-side on every action (AGENTS.md
// non-negotiable #3 is about a COMPANY's data; these are FieldQuo's own
// reps on FieldQuo's own calls, which is what the platform console is
// for). One supervisor per call at a time: `supervisedBy` on the row is
// the lock. The rep is told, on their console, when somebody joined
// audibly (barge, take) — always — and when somebody is listening or
// whispering only if `sales.supervision.tellRepOnListen` says so (default
// ON; the owner decides). The PROSPECT is never told anything by this
// code, and nothing here can speak to them.
//
// Nothing in this file reaches Twilio, the database or the clock it is not
// handed. scripts/check-sales-supervision.mjs executes every branch.

import { normalisePhone } from "../suppressionRules";

// ── Settings ────────────────────────────────────────────────────────────

/** The PlatformSetting key. One row, a JSON object; see normaliseSupervisionSettings. */
export const SUPERVISION_SETTING_KEY = "sales.supervision";

/** Twilio's own default hold music plays when this is null (transfer.js says why). */
export const DEFAULT_SUPERVISION_SETTINGS = Object.freeze({
  enabled: false,
  tellRepOnListen: true,
  holdMusicUrl: null,
});

/**
 * The stored object, made safe. Anything that is not a literal boolean
 * keeps the default — "enabled": "yes" is off, because a string that
 * happens to be truthy must not turn on a mode that costs money.
 * `holdMusicUrl` must be https and short; anything else is Twilio's music.
 */
export function normaliseSupervisionSettings(value) {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const url = typeof v.holdMusicUrl === "string" ? v.holdMusicUrl.trim() : "";
  return {
    enabled: v.enabled === true,
    tellRepOnListen: v.tellRepOnListen === false ? false : true,
    holdMusicUrl: /^https:\/\/[^\s"'<>]{1,500}$/.test(url) ? url : null,
  };
}

// ── The vocabulary ──────────────────────────────────────────────────────

/** What a supervisor can be doing on a call. The OMniLeads four, in English. */
export const SUP_LISTEN = "listen"; // CHANSPY
export const SUP_WHISPER = "whisper"; // CHANSPYWISHPER
export const SUP_BARGE = "barge"; // CHANCONFER
export const SUP_TAKE = "take"; // CHANTAKECALL
export const SUPERVISION_KINDS = Object.freeze([SUP_LISTEN, SUP_WHISPER, SUP_BARGE, SUP_TAKE]);

/** The kinds a supervisor can SWITCH to while in the room. Take is one-way. */
export const SUPERVISION_MODES = Object.freeze([SUP_LISTEN, SUP_WHISPER, SUP_BARGE]);

/** Which kinds the prospect can hear. The rep is always told of these. */
export const AUDIBLE_KINDS = Object.freeze([SUP_BARGE, SUP_TAKE]);

/** SalesCallEvent.event values. */
export const EV_HOLD = "HOLD";
export const EV_UNHOLD = "UNHOLD";
export const EV_LISTEN = "LISTEN";
export const EV_WHISPER = "WHISPER";
export const EV_BARGE = "BARGE";
export const EV_TAKE = "TAKE";
export const EV_SUPERVISION_END = "SUPERVISION_END";
export const CALL_EVENTS = Object.freeze([EV_HOLD, EV_UNHOLD, EV_LISTEN, EV_WHISPER, EV_BARGE, EV_TAKE, EV_SUPERVISION_END]);

export function eventForKind(kind) {
  switch (kind) {
    case SUP_LISTEN:
      return EV_LISTEN;
    case SUP_WHISPER:
      return EV_WHISPER;
    case SUP_BARGE:
      return EV_BARGE;
    case SUP_TAKE:
      return EV_TAKE;
    default:
      return null;
  }
}

// ── Attempt kinds (SalesCallAttempt.kind) ───────────────────────────────

export const KIND_PROSPECT = "prospect";
export const KIND_INTERNAL = "internal";
export const KIND_OFF_CAMPAIGN = "off_campaign";
export const ATTEMPT_KINDS = Object.freeze([KIND_PROSPECT, KIND_INTERNAL, KIND_OFF_CAMPAIGN]);

/**
 * What goes in `toE164` on an internal call. Not a phone number and not
 * shaped like one, on purpose — the same reason store.js's WITHHELD_NUMBER
 * is the word "withheld": a screen that prints the column can recognise
 * it, and no 24-hour cap query on a real number will ever match it.
 */
export const INTERNAL_NUMBER = "internal";

// ── Identities and names ────────────────────────────────────────────────

/**
 * The Voice SDK identity a supervisor's browser registers with. A different
 * prefix from a rep's (browserDial.js IDENTITY_PREFIX "sales_rep:") so a
 * token minted for one can never be read as the other on the way back in.
 */
export const SUPERVISOR_IDENTITY_PREFIX = "supervisor:";

export function supervisorIdentity(adminId) {
  if (typeof adminId !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(adminId)) return null;
  return `${SUPERVISOR_IDENTITY_PREFIX}${adminId}`;
}

/** The admin behind a `client:supervisor:<id>` From, or null. One `client:` stripped, exactly one. */
export function adminIdFromIdentity(identity) {
  if (typeof identity !== "string") return null;
  const bare = identity.startsWith("client:") ? identity.slice("client:".length) : identity;
  if (!bare.startsWith(SUPERVISOR_IDENTITY_PREFIX)) return null;
  const id = bare.slice(SUPERVISOR_IDENTITY_PREFIX.length);
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null;
}

/**
 * The conference one attempt runs in. Named from the attempt id: a second
 * dial is a second attempt and a second room, and Twilio's silent reuse of
 * an existing name (transfer.js conferenceNameFor) cannot join two calls.
 * A different prefix from a transfer's `fq_xfer_` so the two families can
 * never collide.
 */
export function conferenceNameForAttempt(attemptId) {
  if (typeof attemptId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(attemptId)) return null;
  return `fq_call_${attemptId}`;
}

// ── The bridge's decision: conference or plain <Dial> ───────────────────

/**
 * How the bridge should connect an outbound PROSPECT call.
 *
 * `conference: false` is exactly today's `<Dial><Number>` bridge; the
 * route renders it as it always did. `conference: true` is the mode above:
 * the rep's TwiML is `<Dial><Conference>` and the prospect is added by REST
 * as a recorded participant. Only the setting decides — not the rep, not
 * the request — and only a prospect call qualifies: an internal call is
 * `<Dial><Client>` (a browser cannot be a participant we spy on without a
 * prospect to protect, and there is nothing to hold), an off-campaign call
 * behaves as a prospect call.
 */
export function bridgeMode({ settings = null, attempt = null } = {}) {
  const s = normaliseSupervisionSettings(settings);
  if (!attempt || attempt.kind === KIND_INTERNAL) return { conference: false, why: "internal" };
  if (!s.enabled) return { conference: false, why: "supervision_off" };
  const name = conferenceNameForAttempt(attempt.id);
  if (!name) return { conference: false, why: "bad_attempt_id" };
  return { conference: true, why: null, conferenceName: name };
}

/**
 * The `<Conference>` attributes for the REP's leg in conference mode.
 *
 * `endConferenceOnExit` is FALSE on the rep, on purpose: TAKE removes the
 * rep and keeps the prospect talking to the supervisor, which a true here
 * would end. The rep hanging up is caught by the conference callback
 * (`participant-leave` of repCallSid with no take in progress → end the
 * room). The PROSPECT's participant carries endConferenceOnExit true, so
 * the person who can end the call is the person who was rung.
 */
export function repConferenceAttrs({ origin, attemptId, conferenceName }) {
  return {
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    beep: false,
    statusCallback: `${origin}/api/rep-dial/conference?attemptId=${encodeURIComponent(attemptId)}`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: "join leave end",
    name: conferenceName,
  };
}

/**
 * The REST parameters that dial the prospect INTO the room.
 *
 * `earlyMedia` true so the rep hears it ring rather than silence. Recorded
 * dual on this leg — see the header for why this leg and not the rep's —
 * and the recording callback is the same URL recording.js builds for a
 * `<Dial>`, so /api/rep-dial/recording files it against this attempt with
 * no new code. The status callback is /api/rep-dial/status, also unchanged:
 * `providerCallSid`, `answeredAt`, `talkSeconds` and the price arrive the
 * way they always did.
 */
export function prospectParticipantParams({ attempt, origin, ringSeconds = 30, recordingAttrs = null }) {
  const to = typeof attempt?.toE164 === "string" ? attempt.toE164 : null;
  const from = typeof attempt?.fromE164 === "string" ? attempt.fromE164 : null;
  if (!to || !from || !attempt?.id) return null;
  return {
    to,
    from,
    earlyMedia: true,
    beep: false,
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    timeout: ringSeconds,
    statusCallback: `${origin}/api/rep-dial/status?attemptId=${encodeURIComponent(attempt.id)}`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["ringing", "answered", "completed"],
    record: true,
    recordingChannels: "dual",
    recordingTrack: "both",
    ...(recordingAttrs || {}),
  };
}

// ── Supervision: may this admin do this, to this call? ──────────────────

/**
 * @param attempt   the SalesCallAttempt row, read fresh.
 * @param adminId   the superadmin acting (already role-checked by the route).
 * @param kind      one of SUPERVISION_KINDS.
 * @param settings  the platform setting, raw or normalised.
 * @param now       the clock.
 * @returns `{ ok, reason, event, lock }` — `lock` is what to write on the
 *          row when ok; the route writes it conditionally on
 *          `supervisedBy IS NULL OR = adminId` so two admins pressing at
 *          once cannot both win.
 */
export function startSupervisionPlan({ attempt = null, adminId = null, kind = null, settings = null, now = new Date() } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code, event: null, lock: null });
  const s = normaliseSupervisionSettings(settings);
  if (!s.enabled) return no("Supervision is switched off. Turn it on under Sales → Calling rules to listen to calls.", "disabled");
  if (!adminId) return no("Only a signed-in superadmin can supervise a call.", "who");
  if (!SUPERVISION_KINDS.includes(kind)) return no("Say whether to listen, whisper, barge or take the call.", "kind");
  if (!attempt || typeof attempt !== "object") return no("That call is not on the board any more.", "gone");
  if (attempt.endedAt) return no("That call has ended.", "ended");
  if (!attempt.conferenceName) {
    return no("This call is not running in a conference, so nobody can join it. Calls placed after supervision was switched on are.", "no_conference");
  }
  if (!attempt.repCallSid) return no("The rep's leg of this call was never recorded, so there is nothing to coach.", "no_rep_leg");
  if (attempt.supervisedBy && attempt.supervisedBy !== adminId) {
    return no("Somebody else is already on this call. One supervisor at a time.", "taken");
  }
  if (attempt.supervisionKind === SUP_TAKE && attempt.supervisedBy === adminId) {
    return no("You have already taken this call.", "already_taken");
  }
  return {
    ok: true,
    reason: null,
    code: null,
    event: eventForKind(kind),
    lock: { supervisedBy: adminId, supervisionKind: kind, supervisedAt: now },
  };
}

/**
 * The `<Conference>` attributes for the SUPERVISOR's leg, from the row —
 * never from the request. Twilio's TwiML `coach` is the CallSid to coach;
 * `muted` makes a coach a listener.
 *
 *   listen   coach=rep, muted     — CHANSPY: hears both, heard by nobody
 *   whisper  coach=rep, unmuted   — CHANSPYWISHPER: heard by the rep only
 *   barge    no coach, unmuted    — CHANCONFER: a third party in the room
 *   take     as barge; the rep is removed by REST once the supervisor is in
 */
export function supervisorConferenceAttrs({ attempt, origin }) {
  if (!attempt?.conferenceName || !attempt?.repCallSid) return null;
  const kind = attempt.supervisionKind;
  const coaching = kind === SUP_LISTEN || kind === SUP_WHISPER;
  return {
    // Never starts the room and never ends it: a supervisor's arrival or
    // departure must be inaudible in the call's own lifecycle.
    startConferenceOnEnter: false,
    endConferenceOnExit: false,
    beep: false,
    muted: kind === SUP_LISTEN,
    ...(coaching ? { coach: attempt.repCallSid } : {}),
    statusCallback: `${origin}/api/rep-dial/conference?attemptId=${encodeURIComponent(attempt.id)}`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: "join leave",
    name: attempt.conferenceName,
  };
}

/**
 * The REST update that switches a supervisor already in the room to
 * another mode. Take is not a mode: it is barge plus removing the rep, and
 * takePlan says so.
 */
export function participantUpdateForKind(kind, repCallSid) {
  if (!repCallSid) return null;
  switch (kind) {
    case SUP_LISTEN:
      return { coaching: true, callSidToCoach: repCallSid, muted: true };
    case SUP_WHISPER:
      return { coaching: true, callSidToCoach: repCallSid, muted: false };
    case SUP_BARGE:
    case SUP_TAKE:
      return { coaching: false, callSidToCoach: repCallSid, muted: false };
    default:
      return null;
  }
}

/** May this admin switch this call's supervision to `kind`? */
export function changeSupervisionPlan({ attempt = null, adminId = null, kind = null } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code, update: null, event: null });
  if (!attempt || attempt.endedAt) return no("That call has ended.", "ended");
  if (!adminId || attempt.supervisedBy !== adminId) return no("You are not on this call.", "not_yours");
  if (!attempt.supervisorCallSid) return no("Your line has not joined the call yet. Give it a moment.", "not_joined");
  if (attempt.supervisionKind === SUP_TAKE) return no("You have taken this call; there is no mode to change.", "taken");
  if (!SUPERVISION_MODES.includes(kind)) return no("Say whether to listen, whisper or barge.", "kind");
  if (attempt.supervisionKind === kind) return { ok: true, reason: null, code: "same", update: null, event: null };
  return { ok: true, reason: null, code: null, update: participantUpdateForKind(kind, attempt.repCallSid), event: eventForKind(kind) };
}

/**
 * TAKE THE CALL: the supervisor becomes the only FieldQuo voice on the line
 * and the rep's leg is hung up.
 *
 * Refused until the supervisor's own leg is in the room — removing the rep
 * first would leave the prospect alone for the seconds it takes a browser
 * to connect, which is a dropped call with extra steps. The row is marked
 * `take` BEFORE the rep's leg is ended, so the conference callback that
 * sees the rep leave knows not to end the room.
 */
export function takePlan({ attempt = null, adminId = null } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code, actions: [] });
  if (!attempt || attempt.endedAt) return no("That call has ended.", "ended");
  if (!adminId || attempt.supervisedBy !== adminId) return no("You are not on this call.", "not_yours");
  if (!attempt.supervisorCallSid) return no("Your line has not joined the call yet. Give it a moment.", "not_joined");
  if (attempt.supervisionKind === SUP_TAKE) return no("You have already taken this call.", "already_taken");
  if (!attempt.repCallSid) return no("The rep's leg is not known, so it cannot be removed.", "no_rep_leg");
  return {
    ok: true,
    reason: null,
    code: null,
    actions: [
      { type: "mark", kind: SUP_TAKE },
      { type: "unmuteSupervisor" },
      // Off hold first, if held: a prospect handed to a supervisor while
      // listening to music would be a prospect on hold with nobody coming.
      ...(attempt.heldAt ? [{ type: "unholdProspect" }] : []),
      { type: "hangupRep" },
    ],
  };
}

/**
 * The supervisor left (pressed Leave, or their browser dropped). What to
 * write: the seconds this stint lasted, added to the row's total, and the
 * lock released. Idempotent on a row that has no open supervision.
 */
export function endSupervisionPlan({ attempt = null, now = new Date() } = {}) {
  if (!attempt?.supervisedBy || !attempt?.supervisedAt) {
    return { changed: false, seconds: 0, data: null };
  }
  const started = new Date(attempt.supervisedAt).getTime();
  const seconds = Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 1000)) : 0;
  return {
    changed: true,
    seconds,
    data: {
      supervisionSeconds: (Number.isFinite(attempt.supervisionSeconds) ? attempt.supervisionSeconds : 0) + seconds,
      supervisedBy: null,
      supervisedAt: null,
      supervisorCallSid: null,
      // The KIND is kept: "this call was taken" is a fact about the call
      // that outlives the supervisor's presence on it. The floor and the
      // performance page count on it.
    },
  };
}

/**
 * What the REP's console is told about who else is on the line.
 *
 * Barge and take are always said — the prospect can hear a third voice
 * and the rep must know whose. Listen and whisper are said only when the
 * platform setting says so. Never anything for the prospect: this shape
 * only ever reaches the rep's session route.
 */
export function repNotice({ attempt = null, settings = null, supervisorName = null } = {}) {
  if (!attempt?.supervisedBy || !attempt?.supervisionKind) return null;
  const s = normaliseSupervisionSettings(settings);
  const kind = attempt.supervisionKind;
  if (!AUDIBLE_KINDS.includes(kind) && !s.tellRepOnListen) return null;
  return {
    kind,
    name: typeof supervisorName === "string" && supervisorName.trim() ? supervisorName.trim() : null,
    since: attempt.supervisedAt ? new Date(attempt.supervisedAt).toISOString() : null,
    audible: AUDIBLE_KINDS.includes(kind),
  };
}

// ── Hold ────────────────────────────────────────────────────────────────

/**
 * May this rep put this call on hold (or take it off)?
 *
 * Only the rep on the call, only a conference-mode call (a `<Dial>` bridge
 * has no per-participant hold — the header says why), only when the
 * prospect's leg is known, and only in the direction that changes
 * something: holding a held call is refused rather than logged twice.
 *
 * @returns `{ ok, reason, participant: { hold, holdUrl? }, data, event, seconds }`
 */
export function holdPlan({ attempt = null, repId = null, hold = null, settings = null, now = new Date() } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code, participant: null, data: null, event: null, seconds: 0 });
  if (typeof hold !== "boolean") return no("Say whether to hold or resume.", "which");
  if (!attempt || typeof attempt !== "object") return no("There is no call to hold.", "gone");
  if (!repId || attempt.salesRepId !== repId) return no("That is not your call.", "not_yours");
  if (attempt.endedAt) return no("That call has ended.", "ended");
  if (attempt.kind === KIND_INTERNAL) return no("A colleague cannot be put on hold from here — just mute.", "internal");
  if (!attempt.conferenceName) {
    return no("This call is not running in a conference, so it cannot be held. Calls placed after supervision was switched on can.", "no_conference");
  }
  if (!attempt.providerCallSid) return no("The call has not finished connecting yet. Give it a moment.", "not_connected");
  if (attempt.supervisionKind === SUP_TAKE) return no("A supervisor has taken this call.", "taken");
  const s = normaliseSupervisionSettings(settings);
  if (hold) {
    if (attempt.heldAt) return no("They are already on hold.", "already_held");
    return {
      ok: true,
      reason: null,
      code: null,
      participant: { hold: true, ...(s.holdMusicUrl ? { holdUrl: s.holdMusicUrl, holdMethod: "GET" } : {}) },
      data: { heldAt: now },
      event: EV_HOLD,
      seconds: 0,
    };
  }
  if (!attempt.heldAt) return no("They are not on hold.", "not_held");
  const started = new Date(attempt.heldAt).getTime();
  const seconds = Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 1000)) : 0;
  return {
    ok: true,
    reason: null,
    code: null,
    participant: { hold: false },
    data: { heldAt: null, holdSeconds: (Number.isFinite(attempt.holdSeconds) ? attempt.holdSeconds : 0) + seconds },
    event: EV_UNHOLD,
    seconds,
  };
}

// ── The conference ended, or somebody left it ───────────────────────────

/**
 * What to write when the room is over — the call ended, whichever side
 * did it. Closes an open hold and an open supervision so no row is left
 * saying "held since 14:02" at midnight. Pure; the route applies `data`
 * and writes the events.
 */
export function conferenceEndPlan({ attempt = null, now = new Date() } = {}) {
  if (!attempt) return { data: null, events: [] };
  const data = {};
  const events = [];
  if (attempt.heldAt) {
    const h = holdPlan({ attempt, repId: attempt.salesRepId, hold: false, now });
    if (h.ok) {
      Object.assign(data, h.data);
      events.push({ event: EV_UNHOLD, salesRepId: attempt.salesRepId, seconds: h.seconds, detail: { reason: "conference_ended" } });
    }
  }
  const sup = endSupervisionPlan({ attempt, now });
  if (sup.changed) {
    Object.assign(data, sup.data);
    events.push({ event: EV_SUPERVISION_END, platformAdminId: attempt.supervisedBy, seconds: sup.seconds, detail: { reason: "conference_ended", kind: attempt.supervisionKind } });
  }
  return { data: Object.keys(data).length ? data : null, events };
}

/**
 * Somebody left the room. Decides whether the room should END.
 *
 *   the rep left and the call was not taken → end (the rep hung up; the
 *     prospect must not be left with hold music or a silent supervisor)
 *   the rep left and the call WAS taken → keep (that is what take means)
 *   the supervisor left → keep; close their stint
 *   the prospect left → Twilio ends the room itself (endConferenceOnExit)
 */
export function participantLeavePlan({ attempt = null, callSid = null } = {}) {
  if (!attempt || !callSid) return { endConference: false, supervisorLeft: false, repLeft: false };
  if (callSid === attempt.repCallSid) {
    return { endConference: attempt.supervisionKind !== SUP_TAKE, supervisorLeft: false, repLeft: true };
  }
  if (callSid === attempt.supervisorCallSid) {
    return { endConference: false, supervisorLeft: true, repLeft: false };
  }
  return { endConference: false, supervisorLeft: false, repLeft: false };
}

/**
 * The prospect's leg reached a terminal status while the rep is still in
 * the room — no answer, busy, failed, or they hung up. With
 * endConferenceOnExit the hang-up case ends the room by itself; the never-
 * answered cases do not (they never joined), and the rep would sit in
 * silence. So: end the room on any terminal status, idempotently.
 */
export const TERMINAL_STATUSES = Object.freeze(["completed", "busy", "no-answer", "failed", "canceled"]);

export function prospectStatusPlan({ attempt = null, status = null } = {}) {
  if (!attempt?.conferenceName) return { endConference: false };
  return { endConference: TERMINAL_STATUSES.includes(status) };
}

// ── Internal and off-campaign calls ─────────────────────────────────────

/**
 * May this rep ring that colleague?
 *
 * Browser to browser: the callee is a Voice SDK identity, there is no PSTN
 * leg and no carrier price beyond two client legs (Twilio: $0.004/min each).
 * Refused for the rep's own id, for a colleague who is not reachable right
 * now (the same presence rule the transfer picker uses — no name is
 * offered that pressing would not reach), and without the per-rep
 * privilege.
 */
export function internalCallPlan({ rep = null, colleague = null, reachable = false } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code });
  if (!rep?.id) return no("Sign in again.", "who");
  if (rep.canCallColleagues === false) return no("Calling colleagues is switched off for your account. Ask a superadmin.", "not_allowed");
  if (!colleague?.id) return no("Pick somebody to call.", "target");
  if (colleague.id === rep.id) return no("That is you.", "self");
  if (colleague.active === false) return no("That account is closed.", "inactive");
  if (!reachable) return no("They are not at their desk right now.", "unreachable");
  return { ok: true, reason: null, code: null };
}

/**
 * The typed, record-less dial. The number is normalised here so the route
 * and the check agree on what "a number" is; the calling window is judged
 * by the route through salesCallReadiness with the jurisdiction the rep
 * SAID the phone rings in — nothing infers a state from an area code
 * (callingRules.js, "there is no permissive default").
 */
export function offCampaignPlan({ rep = null, typed = null, country = null, province = null, ownNumbers = [] } = {}) {
  const no = (reason, code) => ({ ok: false, reason, code, e164: null });
  if (!rep?.id) return no("Sign in again.", "who");
  if (rep.canCallOffCampaign !== true) return no("Dialling a number outside the queue is switched off for your account. Ask a superadmin.", "not_allowed");
  const e164 = normalisePhone(typed);
  if (!e164) return no("That is not a number this build can dial.", "number");
  if ((Array.isArray(ownNumbers) ? ownNumbers : []).includes(e164)) {
    return no("That is one of our own numbers. Calling it would bridge a loop and bill both legs.", "own_number");
  }
  if (!country || !province) return no("Say which state or province the phone rings in — calling hours depend on it.", "location");
  return { ok: true, reason: null, code: null, e164 };
}

/** Seconds-to-"m:ss" for the floor's live bar and the rep's hold timer. */
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
