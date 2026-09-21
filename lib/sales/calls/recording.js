// lib/sales/calls/recording.js
//
// Every sales call is recorded. This is where that is decided, in one place.
//
// ══ 2026-09-17: the reversal ══════════════════════════════════════════════
//
// Until this file existed the answer was no — callPlan and inboundRouting
// both froze `record: false` into the plan, with a long argument about consent
// law: several of the states callingRules.js enumerates are all-party-consent,
// so a recording needs a disclosure. The argument was right about the
// disclosure and wrong about the conclusion. The disclosure is a sentence, and
// the person best placed to say it is the rep, in the opening, in the language
// of the call. So the sentence lives in the script (lib/sales/playbook/
// defaults.js — "this call may be recorded"), every default playbook carries
// it, and the recording is on. The owner's reason: what a rep actually says on
// a call has to be reviewable against what the script asked them to say, and
// nothing recorded means nothing to review.
//
// A VOICEMAIL was always recorded (one person and a machine) and stays on its
// own columns; see app/api/rep-dial/inbound.
//
// ══ Dual-channel, from answer ═════════════════════════════════════════════
//
// `record-from-answer-dual`: the rep is one track, the contractor the other,
// and nothing is kept while the phone is still ringing. Two tracks is what
// lets lib/sales/calls/transcribe.js say WHO said each line rather than guess
// from a mixed signal — the whole point is comparing the rep's words with the
// script, and a transcript that cannot tell the rep from the customer is
// useless for that. Twilio bills a dual-channel recording the same as mono.
//
// A conference (a transferred call, lib/sales/calls/transferRest.js) can only
// be recorded as one mixed track. Those transcripts are marked "unknown"
// speaker rather than attributed by guesswork.
//
// ══ The callback, and why the attempt id rides in the URL ═════════════════
//
// Twilio posts the finished recording to `recordingStatusCallback`. The
// attempt id is put in the query string we build — never read from the body —
// for the reason app/api/rep-dial/status states: Twilio echoes the URL it was
// given, and a body parameter is whatever the leg happened to carry. The
// webhook (app/api/rep-dial/recording) still checks the signature first.

/** The <Dial> attribute. Exported so the checks can assert on the value. */
export const DIAL_RECORDING = "record-from-answer-dual";

/** The <Conference> attribute. */
export const CONFERENCE_RECORDING = "record-from-start";

/**
 * Attributes for a <Dial> that records the conversation and tells us when the
 * file is ready. Spread into the `twiml.dial({...})` options.
 *
 * `who` is the query the webhook needs to find the row: `{ attemptId }` on a
 * call whose row already exists, `{ transferId }` for a conference. A dial
 * with neither still records — the webhook falls back to CallSid — but says
 * so with a plain object rather than a half-built URL.
 */
export function dialRecordingAttrs({ origin, attemptId = null, transferId = null } = {}) {
  return {
    record: DIAL_RECORDING,
    recordingStatusCallback: recordingCallbackUrl({ origin, attemptId, transferId }),
    recordingStatusCallbackMethod: "POST",
    // `completed` only. `in-progress` and `absent` fire before there is a
    // file and would only write nulls over a row.
    recordingStatusCallbackEvent: "completed",
  };
}

/** The same for a <Conference>. */
export function conferenceRecordingAttrs({ origin, transferId = null } = {}) {
  return {
    record: CONFERENCE_RECORDING,
    recordingStatusCallback: recordingCallbackUrl({ origin, transferId }),
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: "completed",
  };
}

export function recordingCallbackUrl({ origin, attemptId = null, transferId = null } = {}) {
  const base = `${origin}/api/rep-dial/recording`;
  if (attemptId) return `${base}?attemptId=${encodeURIComponent(attemptId)}`;
  if (transferId) return `${base}?transferId=${encodeURIComponent(transferId)}`;
  return base;
}

/**
 * What Twilio posts, read into the shape the store writes. Pure, so the
 * check can hand it hostile bodies. Returns null when the body is not a
 * completed recording with a sid — the caller answers 200 and moves on,
 * because a retry of a malformed body would be a retry of a malformed body.
 */
export function recordingFromWebhook(params = {}) {
  const sid = typeof params.RecordingSid === "string" ? params.RecordingSid.trim() : "";
  if (!/^RE[0-9a-f]{32}$/i.test(sid)) return null;
  const status = typeof params.RecordingStatus === "string" ? params.RecordingStatus : "";
  if (status && status !== "completed") return null;
  const url = typeof params.RecordingUrl === "string" ? params.RecordingUrl.trim() : "";
  if (!/^https:\/\/api\.twilio\.com\//.test(url)) return null;
  const seconds = Number(params.RecordingDuration);
  const channels = Number(params.RecordingChannels);
  return {
    sid,
    // Stored without an extension; the proxy adds .wav or .mp3 as it needs.
    url: url.replace(/\.(wav|mp3)$/i, ""),
    seconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null,
    channels: channels === 1 || channels === 2 ? channels : null,
    callSid: typeof params.CallSid === "string" ? params.CallSid : null,
    conferenceSid: typeof params.ConferenceSid === "string" ? params.ConferenceSid : null,
  };
}

/**
 * Which track is whom. Twilio's dual-channel rule: the first channel is the
 * PARENT of the <Dial>, the second is the leg it dialled. Outbound, the parent
 * is the rep's browser; inbound, it is the contractor. A mixed track has no
 * answer and says so.
 *
 * ── Conference mode is the other way round ──────────────────────────────
 *
 * With supervision on (lib/sales/calls/supervision.js) the recording is on
 * the CONTRACTOR's participant, and Twilio's rule for a conference
 * participant's dual recording is "the first participant that joined with
 * recording enabled in the first channel and all other audio mixed in the
 * second". So the contractor is first and everything they heard — the rep,
 * a supervisor who barged, hold music — is second. `conference` is the
 * row's conferenceName being set; the direction is irrelevant there
 * (inbound calls are never in a conference).
 */
export function channelSpeakers({ direction, channels, conference = false } = {}) {
  if (channels !== 2) return ["unknown"];
  if (conference) return ["contractor", "rep"];
  return direction === "in" ? ["contractor", "rep"] : ["rep", "contractor"];
}

/**
 * The credentials header for fetching media from Twilio, or null. The API
 * key pair first, the account token second — the same order the voicemail
 * proxy uses, kept here so a third copy does not drift.
 */
export function twilioMediaAuth(env = process.env) {
  const key = env.TWILIO_API_KEY_SID;
  const secret = env.TWILIO_API_KEY_SECRET;
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (key && secret) return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
  if (sid && token) return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
  return null;
}

/**
 * The flat text the export carries: one line per segment, speaker first.
 * "rep: Hi, this is Favor…" is what an analysis prompt can read without
 * parsing JSON.
 */
export function transcriptToText(segments = []) {
  return (Array.isArray(segments) ? segments : [])
    .filter((s) => s && typeof s.text === "string" && s.text.trim())
    .map((s) => `${s.speaker || "unknown"}: ${s.text.trim()}`)
    .join("\n");
}
