// lib/sales/playbook/recordingDisclosure.js
//
// "This call may be recorded." — said by the rep, first, on every call.
//
// ══ Why the rep says it and not a machine ═════════════════════════════════
//
// Sales calls are recorded (lib/sales/calls/recording.js, 2026-09-17). The
// jurisdictions callingRules.js enumerates include all-party-consent states,
// and Canada's PIPEDA asks that a person be told a business call is being
// recorded. What satisfies both is one sentence at the start. The owner's
// decision was to put it in the SCRIPT rather than play a <Say> before the
// contractor is connected: a recorded announcement delays the ring, sounds
// like a call centre, and is the first thing a tradesperson hangs up on. A
// rep saying it in their own voice, in the language of the call, costs
// nothing and is the disclosure.
//
// ══ Why a table in three languages, like turnaround.js ════════════════════
//
// The rules playbook is English and rendered verbatim; the AI script is
// written per prospect in the lead's language. This sentence is neither —
// it is the same on every call and has to be on the screen in the language
// the rep is reading the call in, whether or not a script was ever written
// for the row. EN / FR / ES, English as the fallback that says so. The
// English string is also woven into the shared OPENER so the printed
// playbook carries it and scripts/check-playbook-copy.mjs asserts it.
//
// Pure. Executed by scripts/check-sales-recording.mjs.

export const RECORDING_DISCLOSURE = Object.freeze({
  en: "This call may be recorded.",
  fr: "Cet appel peut être enregistré.",
  es: "Esta llamada puede ser grabada.",
});

export const RECORDING_DISCLOSURE_LANGUAGES = Object.freeze(Object.keys(RECORDING_DISCLOSURE));

/** The English sentence, for the shared opener. One string, four playbooks. */
export const RECORDING_DISCLOSURE_EN = RECORDING_DISCLOSURE.en;

/**
 * The sentence in the script's language, and which language that turned out
 * to be — so a rep reading a call in Ukrainian sees the English line and the
 * screen can say it fell back rather than pretend.
 */
export function recordingDisclosureFor(language) {
  const code = typeof language === "string" ? language.slice(0, 2).toLowerCase() : "";
  const known = RECORDING_DISCLOSURE_LANGUAGES.includes(code);
  return { text: RECORDING_DISCLOSURE[known ? code : "en"], language: known ? code : "en", fallback: !known };
}

/** True when a line of script carries the disclosure in any of the languages. */
export function carriesDisclosure(text) {
  if (typeof text !== "string") return false;
  const t = text.toLowerCase();
  return RECORDING_DISCLOSURE_LANGUAGES.some((l) => t.includes(RECORDING_DISCLOSURE[l].toLowerCase().replace(/\.$/, "")));
}
