// lib/sales/calls/amd.js
//
// Answering-machine detection on the prospect leg — what the bridge asks
// Twilio for, what the callback says, and what a machine verdict changes.
//
// ══ The model, from OMniLeads ═════════════════════════════════════════════
//
// Queue.detectar_contestadores (ominicontacto_app/models.py ~1799) turns
// Asterisk's AMD on per campaign; AmdConf (configuracion_telefonia_app/
// models.py ~607–627) holds the thresholds; audio_para_contestadores (~1817)
// is the file played to a machine. On the reporting side LlamadaLog
// (reportes_app/models.py ~368–372) files 'AMD' among EVENTOS_NO_DIALOGO —
// the call reached something and nobody spoke — beside ABANDON and
// EXITWITHTIMEOUT, and apart from EVENTOS_NO_CONTACTACION (NOANSWER, BUSY,
// …), where nothing picked up at all. That distinction is the whole point:
// "nobody picked up" and "a machine picked up" are different facts, and
// without AMD the clock cannot tell them apart in the 20–60 second band
// (lib/sales/calls/conversation.js says so).
//
// ══ Twilio's version ══════════════════════════════════════════════════════
//
// The bridge dials the prospect with <Dial><Number>. The <Number> noun takes
// `machineDetection` ("Enable" | "DetectMessageEnd"), `amdStatusCallback`
// and the four thresholds (twilio.com/docs/voice/twiml/number, read
// 2026-09-21; node_modules/twilio/lib/twiml/VoiceResponse.d.ts
// NumberAttributes). On <Number> the verdict is only ever DELIVERED to that
// callback — there is no attribute that would hold the bridge for it — so
// the rep is connected the moment the far end answers and the verdict
// arrives on its own request a few seconds later. `AsyncAmd` is a REST
// Calls.create parameter and does not exist on TwiML; the brief's intent
// ("so the rep's bridge isn't delayed") is what <Number>+amdStatusCallback
// already does.
//
// DetectMessageEnd, not Enable: with Enable the machine verdict comes at the
// start of the greeting; with DetectMessageEnd it comes at the BEEP
// (machine_end_beep) or when the greeting ends in silence
// (machine_end_silence / machine_end_other) — which is the moment a drop
// could be played, and the moment a rep leaving their own message wants to
// know about. A human is reported the moment they are identified either way.
//
// The verdicts (twilio.com/docs/voice/answering-machine-detection):
//   human, machine_start (Enable only), machine_end_beep,
//   machine_end_silence, machine_end_other, fax, unknown.
//
// ══ Cost ═════════════════════════════════════════════════════════════════
//
// $0.0075 per call with detection on (twilio.com/en-us/voice/pricing/us,
// read 2026-09-21) — outcomeSettings.js AMD_USD_PER_CALL, printed beside
// the switch. Default OFF; the owner's flip is the approval.
//
// ══ Never on a human ══════════════════════════════════════════════════════
//
// The one write that hangs up a leg (dropVoicemail) is reachable only from
// a machine_end_* verdict, checked here in isMachineEnd(), and only when
// the platform has set a drop URL. A `human`, `unknown` or `fax` verdict
// does nothing to the call. There is no branch that ends a human's call.

import { twilioRest } from "@/lib/sms/twilioClient";

export const AMD_RESULTS = Object.freeze(["human", "machine_start", "machine_end_beep", "machine_end_silence", "machine_end_other", "fax", "unknown"]);
export const AMD_MODE = "DetectMessageEnd";

/** A verdict Twilio can send, verbatim, or null for anything else. */
export function amdResultOf(raw) {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return AMD_RESULTS.includes(s) ? s : null;
}

/** Any machine verdict — start or end. */
export function isMachine(result) {
  return typeof result === "string" && result.startsWith("machine_");
}

/** The end-of-greeting verdicts — the only ones a drop may follow. */
export function isMachineEnd(result) {
  return result === "machine_end_beep" || result === "machine_end_silence" || result === "machine_end_other";
}

/**
 * The <Number> attributes the bridge adds when detection is on. Nothing
 * when it is off — not `machineDetection: undefined`, which the SDK would
 * still serialise on some paths. Twilio's thresholds are left at their
 * defaults on purpose (outcomeSettings.js says why).
 */
export function amdNumberAttrs({ enabled = false, origin, attemptId } = {}) {
  if (enabled !== true || !origin || !attemptId) return {};
  return {
    machineDetection: AMD_MODE,
    amdStatusCallback: `${origin}/api/rep-dial/amd?attemptId=${encodeURIComponent(attemptId)}`,
    amdStatusCallbackMethod: "POST",
  };
}

/**
 * What one amdStatusCallback says — pure.
 * @returns {{ result: string|null, ms: number|null, callSid: string|null }}
 */
export function amdVerdictFrom(params = {}) {
  const ms = Number(params.MachineDetectionDuration);
  return {
    result: amdResultOf(params.AnsweredBy),
    ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null,
    callSid: typeof params.CallSid === "string" && params.CallSid ? params.CallSid : null,
  };
}

/**
 * Should a drop be played? Only a machine_end verdict AND a configured URL.
 * Pure, and the only gate in front of dropVoicemail.
 */
export function shouldDropVoicemail({ result, dropUrl } = {}) {
  return isMachineEnd(result) && typeof dropUrl === "string" && dropUrl.startsWith("https://");
}

/**
 * Play the drop to the machine and hang up THAT leg. The prospect's call is
 * redirected to a <Play> + <Hangup>; ending the <Dial> ends the rep's side
 * of the bridge the way any far-end hang-up does, and the write-up asks
 * the rep what happened (the card already says "Machine detected").
 *
 * `rest` is injectable so the check script executes this without Twilio.
 */
export async function dropVoicemail({ callSid, dropUrl, rest = twilioRest } = {}) {
  if (!callSid || !dropUrl) return { ok: false, reason: "no_target" };
  if (!rest?.calls) return { ok: false, reason: "no_client" };
  const twiml = `<Response><Play>${String(dropUrl).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Play><Hangup/></Response>`;
  try {
    await rest.calls(callSid).update({ twiml });
    return { ok: true, reason: "dropped" };
  } catch (err) {
    return { ok: false, reason: err?.message || "update_failed" };
  }
}

/**
 * The card's sentence key for a verdict, or null when there is nothing to
 * tell the rep. A human verdict is silence — telling a rep "Human detected"
 * while they are talking to one is noise.
 */
export function amdCardKey(result) {
  if (isMachine(result)) return "app.salesCall.amd.machine";
  if (result === "fax") return "app.salesCall.amd.fax";
  return null;
}
