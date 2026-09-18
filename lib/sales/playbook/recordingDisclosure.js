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

/**
 * The same fact as a CLAUSE a person would actually say, dropped into the
 * opener right after the rep says who they are — "quick heads-up, this call
 * may be recorded" — rather than announced as a line of its own. The owner:
 * "it has to be added into the conversation, after the opener; it has to
 * sound natural."
 */
export const RECORDING_ASIDE = Object.freeze({
  en: "quick heads-up, this call may be recorded",
  fr: "petite précision, cet appel peut être enregistré",
  es: "un aviso rápido, esta llamada puede ser grabada",
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
  // The fact in any wording: "may be recorded" / "is recorded" / "being
  // recorded", "peut être enregistré(e)" / "est enregistré", "puede ser
  // grabada" / "se graba" — the model or a human may phrase it, and the
  // check is on the fact being said, not on one sentence.
  // No \b after the French form: JavaScript's \b is ASCII-only and treats
  // "é" as a non-word character, so "enregistré." would never match.
  return /\b(?:may be|is being|is|will be|being)\s+recorded\b|enregistr[ée]|\bgrabad[ao]s?\b|\bse\s+graba\b/i.test(text);
}

/**
 * Put the aside into an opener that lacks it, after the sentence in which
 * the rep says who they are — the first sentence that names the rep, the
 * company or "calling from", else simply the first sentence. Pure; returns
 * the text unchanged when the fact is already said. Used on every stored
 * script as it is read (app/api/sales/playbook), so scripts written before
 * 2026-09-17 carry it without being regenerated, and on the generated
 * opener as a guard.
 */
export function weaveDisclosure(text, language) {
  if (typeof text !== "string" || !text.trim()) return text;
  if (carriesDisclosure(text)) return text;
  const code = typeof language === "string" ? language.slice(0, 2).toLowerCase() : "en";
  const aside = RECORDING_ASIDE[code] || RECORDING_ASIDE.en;
  // Sentence ends: ". " "? " "! " — keep the punctuation with its sentence.
  const parts = text.split(/(?<=[.?!])\s+/);
  const self = /\b(?:my name|i'?m|calling from|this is|here from|from fieldquo|je m'appelle|ici|de la part|me llamo|soy|le habla|de fieldquo)\b/i;
  let at = parts.findIndex((p) => self.test(p));
  if (at === -1) at = 0;
  // "…and I'm from FieldQuo." → "…and I'm from FieldQuo — quick heads-up, this call may be recorded."
  const head = parts[at].replace(/[.!?]+$/, "");
  parts[at] = `${head} — ${aside}.`;
  return parts.join(" ");
}
