// lib/voice/agentLanguage.js
//
// Which language(s) the receptionist speaks, as the phone provider — and Intl —
// spell them.
//
// ══ Why this is a file and not two ternaries ═══════════════════════════════
//
// It was two ternaries, `language === "fr" ? "fr-CA" : "en-US"`, one in
// provision.js deciding what the agent SPEAKS and one in triggers.js deciding
// how it reads a date aloud. Two copies of one rule is the failure this repo
// keeps finding: the copy nobody looks at is the copy that rots. Teaching the
// receptionist Spanish by editing only the first would have produced an agent
// speaking Spanish and announcing "Tuesday, August 12" in the middle of it.
//
// ══ Why Spanish is here and Punjabi is not ════════════════════════════════
//
// A company can be set to any of the eight languages this app speaks. This
// rule mapped exactly two: fr became fr-CA and EVERYTHING else became en-US.
// So a Spanish-speaking contractor's receptionist answered the phone in
// English, silently, with no screen anywhere admitting it.
//
// es-419 is Latin American Spanish — the Spanish spoken by the customers and
// crews this product actually has, rather than es-ES.
//
// uk, pa, tl, de and it still fall through to en-US, deliberately. The
// provider's enum is not the whole question: the receptionist's prompt, its
// greeting and every sentence it improvises come from lib/voice/prompt.js,
// which has no Punjabi in it. Setting the provider's language without
// translating what it says would produce an agent reading English words in a
// Punjabi accent — worse than English, and much harder to notice. Honest
// English until the prompt follows — and the settings screen SAYS so, in the
// owner's language, rather than leaving a French/English/Spanish selector to
// imply the phone matches the app. (Punjabi is also simply absent from
// Retell's `language` enum, so for pa there is nothing to fall through TO.)
//
// ══ The spoken language is the AGENT's, not the company's ══════════════════
//
// `Company.defaultLanguage` is what the back office is read in. It used to
// decide the phone too, and for most shops the two agree — but an Ottawa
// painter whose books are in English and whose callers are half Gatineau is
// not an edge case, and neither is a Montreal shop run in French whose
// English callers hang up on a French-only greeting. So the phone has its own
// setting, `VoiceAgent.spokenLanguage`, chosen on Settings › Voice, and the
// company language is only what answers when nobody has chosen.
//
// ══ What Retell actually accepts (read 2026-09-17) ═════════════════════════
//
// From https://docs.retellai.com/api-references/create-agent, the `language`
// field: "Specifies what language(s) the agent will operate in. Accepts either
// a single locale (e.g. en-US) or an array of locales for multilingual agents
// (e.g. ["en-US","es-ES"]). The scalar value `multi` is deprecated but still
// accepted as a scalar, and is stored and returned as the ten locales it used
// to mean. It must not appear inside the array form. Send an explicit locale
// array instead. If unset, defaults to en-US."
//
// So bilingual is an ARRAY of two locales, never the old `multi` — which was a
// fixed ten-language set (en-US, es-ES, fr-FR, de-DE, hi-IN, ru-RU, pt-PT,
// ja-JP, it-IT, nl-NL: European French and European Spanish, neither of which
// is what this product's callers speak) and which the dashboard now flags as
// legacy. The enum holds fr-CA, es-419 and en-US, and it holds uk-UA and
// fil-PH too; it holds nothing for Punjabi.
//
// From https://docs.retellai.com/agent/multilingual, what a two-locale agent
// does at call time: speech recognition "figures out which of the selected
// languages the caller is speaking and transcribes accordingly"; the voice
// "detects the language of each response and uses the matching pronunciation.
// If detection fails, it falls back to the FIRST language you selected"; and
// the model "is allowed to respond in any of the selected languages and
// chooses based on what the caller speaks (and any instructions you give in
// the prompt)". The ORDER of the array therefore matters, which is why
// spokenLocales() puts the company's own language first.
//
// The cost of that, in Retell's words: "Crossing language families (for
// example, en-US and es-ES) routes speech recognition to the multilingual
// pipeline, which is less accurate per language than single-language models.
// Pick the smallest set of languages you actually need." There is no price
// difference — the pricing page lists none for multilingual agents, and the
// per-call cost this product records (lib/voice/providerCost.js) would show
// one if it appeared — the cost is accuracy, and the settings screen says so.
//
// Every locale here must be covered by one ASR vendor able to switch between
// them mid-call. Per https://docs.retellai.com/build/asr-providers, Deepgram
// code-switches across ten languages including English, French and Spanish,
// and Soniox across sixty; Retell routes to one of them itself because
// lib/voice/agentTuning.js deliberately pins no `custom_stt_config`.
//
// ══ No imports ════════════════════════════════════════════════════════════
//
// The settings card renders the selector and its limitation sentence, and it
// is a client component. Same rule as agentTuning.js: nothing here may reach
// Prisma, so nothing here imports anything.

/** BCP-47 for ONE company language, for the phone agent and for Intl. Never null. */
export function agentLanguage(language) {
  if (language === "fr") return "fr-CA";
  if (language === "es") return "es-419";
  return "en-US";
}

/** The languages the receptionist can actually hold a conversation in. */
export const VOICE_LANGUAGES = ["en", "fr", "es"];

/**
 * Every value the language selector on Settings › Voice can hold.
 *
 * Three single languages and two pairs. English is in both pairs because it
 * is the language every other one in this product is bilingual WITH — a
 * French–Spanish shop is not a business this product has met, and per
 * Retell's own guidance every extra language costs recognition accuracy, so
 * the list is the pairs that exist rather than every pair that could.
 */
export const SPOKEN_LANGUAGE_VALUES = ["en", "fr", "es", "en-fr", "en-es"];

/** Is this a value the selector can hold? */
export function isSpokenLanguage(value) {
  return typeof value === "string" && SPOKEN_LANGUAGE_VALUES.includes(value);
}

/**
 * The two-letter codes a selector value stands for, in selector order.
 * "en-fr" → ["en", "fr"]; "es" → ["es"]. Junk → ["en"], never empty.
 */
export function languagesOf(value) {
  if (!isSpokenLanguage(value)) return ["en"];
  return value.split("-");
}

/** Does the receptionist speak this company language at all? */
export function receptionistSpeaks(companyLanguage) {
  return VOICE_LANGUAGES.includes(companyLanguage);
}

/**
 * What the phone speaks when the company has never chosen: its own language
 * when the receptionist has it, English otherwise. Exactly the old rule, so a
 * company that never opens the new selector hears no change.
 */
export function defaultSpokenLanguage(companyLanguage) {
  return receptionistSpeaks(companyLanguage) ? companyLanguage : "en";
}

/**
 * A stored `VoiceAgent.spokenLanguage` — or null, or a value from a release
 * that was rolled back — as a value we recognise.
 *
 * Never throws and never passes a stranger through: the provider payload is
 * built from the OUTPUT of this and nothing else, so an unknown string cannot
 * reach Retell however it got into the database. Same contract as
 * normaliseTuning.
 */
export function resolveSpokenLanguage(stored, companyLanguage) {
  return isSpokenLanguage(stored) ? stored : defaultSpokenLanguage(companyLanguage);
}

/**
 * The locale(s) the agent is provisioned with, primary first.
 *
 * For a pair, the company's own language leads when it is one of the two —
 * Retell falls back to the FIRST locale when it cannot tell which language a
 * reply is in, and a Gatineau shop run in French should fall back to French.
 * An English company, or one on a language outside the pair, gets English
 * first. The greeting follows the same order (lib/voice/prompt.js).
 *
 * @returns string[] of one or two BCP-47 locales, never empty
 */
export function spokenLocales(value, companyLanguage = "en") {
  const langs = languagesOf(value);
  if (langs.length > 1 && langs.includes(companyLanguage) && langs[0] !== companyLanguage) {
    langs.splice(langs.indexOf(companyLanguage), 1);
    langs.unshift(companyLanguage);
  }
  return langs.map(agentLanguage);
}

/**
 * The exact `language` value sent to /create-agent and /update-agent.
 *
 * A bare string for one locale, an array for two. Never the deprecated
 * `multi` scalar — see the header for what it silently expands to.
 */
export function retellLanguage(locales) {
  const list = Array.isArray(locales) && locales.length ? locales : ["en-US"];
  return list.length === 1 ? list[0] : list;
}

/** The two-letter code a locale stands for. */
export function languageOfLocale(locale) {
  return locale === "fr-CA" ? "fr" : locale === "es-419" ? "es" : "en";
}

/** The language a default voice and a fallback are chosen for. */
export function primaryLanguage(value, companyLanguage = "en") {
  return languageOfLocale(spokenLocales(value, companyLanguage)[0]);
}
