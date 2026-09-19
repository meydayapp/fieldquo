// lib/prepGuide/serviceDocuments.js
//
// Input rules for a ServiceDocument row, shared by the create and edit
// routes so the two cannot accept different titles or languages.

import { LANGUAGE_CODES } from "@/app/i18n/languages";

export const MAX_TITLE = 160;

export function cleanTitle(v) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE) : "";
}

/** null = every language; a code = that one; undefined = not a language we offer. */
export function cleanLanguage(v) {
  if (v === null || v === undefined || v === "") return null;
  const code = String(v).trim().toLowerCase();
  return LANGUAGE_CODES.includes(code) ? code : undefined;
}
