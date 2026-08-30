// lib/voice/agentLanguage.js
//
// The company's language as the phone provider — and Intl — spell it.
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
// A company can be set to any of the six languages this app speaks. This rule
// mapped exactly two: fr became fr-CA and EVERYTHING else became en-US. So a
// Spanish-speaking contractor's receptionist answered the phone in English,
// silently, with no screen anywhere admitting it.
//
// es-419 is Latin American Spanish — the Spanish spoken by the customers and
// crews this product actually has, rather than es-ES.
//
// uk, pa and tl still fall through to en-US, deliberately. The provider's enum
// is not the whole question: the receptionist's prompt, its greeting and every
// sentence it improvises come from lib/voice/prompt.js, which has no Punjabi in
// it. Setting the provider's language without translating what it says would
// produce an agent reading English words in a Punjabi accent — worse than
// English, and much harder to notice. Honest English until the prompt follows.

/** BCP-47 for the phone agent and for Intl. Never null: callers need a locale. */
export function agentLanguage(language) {
  if (language === "fr") return "fr-CA";
  if (language === "es") return "es-419";
  return "en-US";
}

/** The languages the receptionist can actually hold a conversation in. */
export const VOICE_LANGUAGES = ["en", "fr", "es"];
