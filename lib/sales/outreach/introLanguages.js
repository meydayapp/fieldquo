// lib/sales/outreach/introLanguages.js
//
// The three languages the intro email is written in — in a file with no
// imports, so the pop-up (a client component) can list them without
// pulling lib/sales/outreach.js's node:crypto into a browser bundle. The
// same reason lib/sales/outreachPipeline.js exists beside outreach.js.
// They are SCRIPT_LANGUAGES (lib/sales/intel/callScript.js): the languages
// a rep can sell in.

export const INTRO_EMAIL_LANGUAGES = Object.freeze(["en", "fr", "es"]);

export function isIntroEmailLanguage(value) {
  return INTRO_EMAIL_LANGUAGES.includes(value);
}

/** The prospect's language when nothing else is known. */
export const INTRO_EMAIL_DEFAULT_LANGUAGE = "en";
