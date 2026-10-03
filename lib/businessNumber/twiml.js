// lib/businessNumber/twiml.js
//
// What Twilio is told to do with a call on a brought number. PURE — strings in,
// TwiML out — so the caller-ID rules are executed by the check, not read.
//
// ══ The one call routing, not a second one ═════════════════════════════════
//
// The product already answers missed calls: a company forwards its line to
// its receptionist number (lib/voice/numbers.js "FORWARD — the default") and
// Retell answers there. Once a number is PORTED, there is no carrier left to
// set conditional forwarding on — the number lives in FieldQuo's Twilio
// account. So the inbound TwiML below does on Twilio exactly what the carrier
// code did: ring the company's own phone(s) first, and on no answer hand the
// call to that SAME receptionist number. Nothing about the receptionist
// changes and no second answering system exists; a company without one gets
// voicemail instead.
//
// ══ Caller ID, both directions ═════════════════════════════════════════════
//
//   inbound  the caller's own number is passed through (callerId = From), so
//            the contractor's cell shows who is calling, exactly as it did
//            before the port. The receptionist sees it too, which is what lets
//            it greet a returning client by name.
//   bridge   the BUSINESS number, always — never the contractor's cell. That
//            is the whole point of the call button: the client sees the number
//            they already know, and the contractor's personal cell stays
//            private. bridgeTwiml() takes no other caller-ID argument, so a
//            route cannot hand it the cell by mistake.

import twilio from "twilio";

const { VoiceResponse } = twilio.twiml;

/** Twilio <Say> voices per language we speak. Anything else speaks English. */
const SAY_LANGUAGE = Object.freeze({ en: "en-US", fr: "fr-CA", es: "es-US", de: "de-DE", it: "it-IT", zh: "cmn-CN", uk: "uk-UA" });

const VOICEMAIL_GREETING = Object.freeze({
  en: (name) => `You've reached ${name}. We can't take your call right now. Please leave a message after the tone.`,
  fr: (name) => `Vous avez joint ${name}. Nous ne pouvons pas répondre pour le moment. Laissez un message après le bip.`,
  es: (name) => `Ha llamado a ${name}. No podemos atenderle ahora. Deje un mensaje después del tono.`,
});

const BRIDGE_PROMPT = Object.freeze({
  en: (who) => `Calling ${who}. Press 1 to connect.`,
  fr: (who) => `Appel à ${who}. Appuyez sur 1 pour être mis en relation.`,
  es: (who) => `Llamada a ${who}. Pulse 1 para conectar.`,
});

function sayLanguage(lang) {
  return SAY_LANGUAGE[lang] || SAY_LANGUAGE.en;
}

const E164 = /^\+\d{8,15}$/;

/** At most three numbers, all E.164, no duplicates, never the business number itself. */
export function cleanForwardList(list, { businessE164 = null } = {}) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const n = String(raw || "").trim();
    if (!E164.test(n) || n === businessE164 || out.includes(n)) continue;
    out.push(n);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * The first answer to an inbound call: ring the company's phones together.
 *
 * @param from         the caller (Twilio's From) — passed through as caller ID
 * @param forwardTo    the company's chosen phones
 * @param ringSeconds  how long before the fallback takes it
 * @param afterUrl     where Twilio reports how the <Dial> ended
 */
export function inboundRingTwiml({ from, forwardTo = [], ringSeconds = 20, afterUrl }) {
  const vr = new VoiceResponse();
  const targets = cleanForwardList(forwardTo);
  if (!targets.length) {
    // Nobody to ring. Straight to the fallback rather than twenty seconds of
    // ringing into nothing — the redirect asks the same route what to do on
    // "no answer".
    vr.redirect({ method: "POST" }, `${afterUrl}${afterUrl.includes("?") ? "&" : "?"}skipped=1`);
    return vr.toString();
  }
  const timeout = Math.min(60, Math.max(5, Math.round(Number(ringSeconds) || 20)));
  const dial = vr.dial({
    // The caller's own number. See the header.
    ...(E164.test(String(from || "")) ? { callerId: from } : {}),
    timeout,
    action: afterUrl,
    method: "POST",
    answerOnBridge: true,
  });
  // Several <Number> nouns in one <Dial> ring simultaneously and the first to
  // answer wins — Twilio's own ring group, so nothing here has to build one.
  for (const n of targets) dial.number(n);
  return vr.toString();
}

/**
 * After the ring: nothing more if somebody answered, else the receptionist,
 * else voicemail.
 *
 * @param dialStatus      Twilio's DialCallStatus (completed | busy | no-answer | failed | canceled)
 * @param receptionistE164 the company's live receptionist number, or null
 * @param fallback        receptionist | voicemail
 * @param voicemailUrl    recordingStatusCallback for <Record>
 * @param doneUrl         where <Record> goes when it finishes (a hang-up)
 */
export function afterRingTwiml({
  dialStatus,
  from,
  receptionistE164 = null,
  fallback = "receptionist",
  companyName = "us",
  language = "en",
  voicemailUrl,
  doneUrl,
}) {
  const vr = new VoiceResponse();
  if (String(dialStatus || "") === "completed") {
    vr.hangup();
    return { twiml: vr.toString(), outcome: "answered" };
  }
  if (fallback !== "voicemail" && receptionistE164 && E164.test(receptionistE164)) {
    const dial = vr.dial({ ...(E164.test(String(from || "")) ? { callerId: from } : {}), answerOnBridge: true });
    dial.number(receptionistE164);
    return { twiml: vr.toString(), outcome: "receptionist" };
  }
  const greet = (VOICEMAIL_GREETING[language] || VOICEMAIL_GREETING.en)(String(companyName || "us").slice(0, 80));
  vr.say({ language: sayLanguage(language) }, greet);
  vr.record({
    maxLength: 120,
    playBeep: true,
    timeout: 5,
    action: doneUrl,
    method: "POST",
    recordingStatusCallback: voicemailUrl,
    recordingStatusCallbackMethod: "POST",
  });
  return { twiml: vr.toString(), outcome: "voicemail" };
}

/** The end of a voicemail: hang up. */
export function hangupTwiml() {
  const vr = new VoiceResponse();
  vr.hangup();
  return vr.toString();
}

/**
 * Leg one of the call button: the contractor's own phone has answered.
 * Ask for a key press first, so a call that reached the contractor's
 * VOICEMAIL never dials the client into it.
 */
export function bridgePromptTwiml({ clientLabel, connectUrl, language = "en" }) {
  const vr = new VoiceResponse();
  const prompt = (BRIDGE_PROMPT[language] || BRIDGE_PROMPT.en)(String(clientLabel || "your client").slice(0, 80));
  const gather = vr.gather({ numDigits: 1, timeout: 8, action: connectUrl, method: "POST" });
  gather.say({ language: sayLanguage(language) }, prompt);
  // No key pressed: nothing is dialled.
  vr.hangup();
  return vr.toString();
}

/**
 * Leg two: dial the client, showing the BUSINESS number. The only caller-ID
 * argument is `businessE164`; see the header.
 */
export function bridgeConnectTwiml({ digits, clientE164, businessE164, doneUrl }) {
  const vr = new VoiceResponse();
  if (String(digits || "") !== "1" || !E164.test(String(clientE164 || "")) || !E164.test(String(businessE164 || ""))) {
    vr.hangup();
    return vr.toString();
  }
  const dial = vr.dial({ callerId: businessE164, timeout: 30, answerOnBridge: true, action: doneUrl, method: "POST" });
  dial.number(clientE164);
  return vr.toString();
}

/**
 * May this member ring this client from the business number, now? PURE.
 *
 * @returns {{ allowed, reason, reasonKey }}
 */
export function bridgeVerdict({
  numberActive = false,
  path = null,
  memberPhone = null,
  clientPhone = null,
  doNotCall = false,
  withinHours = false,
} = {}) {
  const no = (reasonKey, reason) => ({ allowed: false, reasonKey, reason });
  if (!numberActive || path !== "port") {
    return no("no_number", "Calling from your business number needs the number moved to FieldQuo first (Settings → Business number).");
  }
  if (!E164.test(String(memberPhone || ""))) {
    return no("no_member_phone", "Add your own phone number to your profile — FieldQuo rings you first, then connects the client.");
  }
  if (!E164.test(String(clientPhone || ""))) return no("no_client_phone", "This record has no phone number to call.");
  if (doNotCall) return no("do_not_call", "This person asked not to be called.");
  if (!withinHours) {
    return no("outside_hours", "It's outside calling hours where they are (9:00–20:00 their time). Try again then.");
  }
  return { allowed: true, reasonKey: null, reason: null };
}
