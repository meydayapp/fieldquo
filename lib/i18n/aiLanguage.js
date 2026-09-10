// lib/i18n/aiLanguage.js
//
// The clause that makes a model WRITE in the reader's language.
//
// ── Why generated, not translated ──────────────────────────────────────────
//
// The owner reported a finance panel headed "Resumen de IA" whose body was
// English: the chrome went through t() and the one sentence that mattered did
// not. The obvious repair — run the English output through a translator — is
// the wrong one twice over. It doubles the model calls and the cost, and it
// produces text that reads as translated: a summary written for a Spanish
// contractor should use the words a Spanish contractor uses, not the Spanish
// shadow of an English sentence. lib/site/generateSite.js reached the same
// conclusion for website copy and says so in its own header; this is that
// instruction, extracted so every summary generator states it identically
// instead of each inventing its own phrasing.
//
// ── Why the English name, not the native one ───────────────────────────────
//
// The instruction is addressed to the model, not to the reader. "Write in
// Ukrainian" is unambiguous to every model; "Write in Українська" is a token
// sequence some of them handle worse than the plain English name.
//
// This is NOT a licence to translate documents. AGENTS.md non-negotiable 6
// still holds: a quote keeps the language it was created in. What this covers
// is prose generated fresh, for one reader, at the moment they ask for it.

import { LANGUAGES, DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

/** The model-facing English name of a supported code ("es" → "Spanish"). */
export function aiLanguageName(code) {
  return (
    LANGUAGES.find((l) => l.code === String(code || "").toLowerCase())?.name ||
    LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE).name
  );
}

/**
 * A sentence to append to a system prompt.
 *
 * Returns "" for English and for anything unsupported. An empty clause is
 * deliberate: English prompts already produce English, and adding "Write in
 * English." to every one of them would change the wording of output nobody
 * complained about, for no gain.
 */
export function aiLanguageDirective(code) {
  const normalised = String(code || "").toLowerCase();
  if (!isSupported(normalised) || normalised === DEFAULT_LANGUAGE) return "";
  const name = aiLanguageName(normalised);
  return (
    ` Write your entire answer in ${name}, as someone who speaks ${name} would` +
    ` write it for a tradesperson — not as a word-for-word translation of` +
    ` English. Numbers, currency amounts and names stay exactly as given.`
  );
}

/**
 * The house pattern: take a generator's existing system prompt and return it
 * with the directive attached. One helper so a new summary generator cannot
 * accidentally place the instruction where the model weights it differently
 * from every other one.
 */
export function withLanguage(systemPrompt, code) {
  return `${systemPrompt}${aiLanguageDirective(code)}`;
}
