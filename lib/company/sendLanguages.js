// lib/company/sendLanguages.js
//
// Which languages a company sends CLIENT documents in, and which of them is
// primary.
//
// ── Why this is a function and not two lines at each call site ──────────────
//
// The public self-quote form offers this list and the route that receives the
// submission validates against it. Those two have to agree exactly — a form
// offering a language the POST then rejects is a control that appears to work
// and doesn't — and they sat in different files with the fallback written out
// by hand in each. This is that rule, once.
//
// ── Empty is "the default only", not "all six" ──────────────────────────────
//
// Company.sendLanguages defaults to [] and, at the time of writing, NOTHING in
// the product writes it: Settings → Language sets the user's own language and
// the company default, and there is no control anywhere for the send list. So
// every company reads as [].
//
// The tempting fix is to treat empty as "offer everything FieldQuo supports",
// which would make the switcher visible immediately. It is the wrong fix.
// Absence of a statement is not a statement (AGENTS.md recurring failure 5) —
// a homeowner offered Tagalog reasonably expects the contractor to answer in
// Tagalog, and no contractor has said they can. Empty means the default only,
// and the missing settings control is a gap to close rather than to paper over.
//
// Pure. Feed it a company row; it returns codes.

import { isSupported, DEFAULT_LANGUAGE } from "@/app/i18n/languages";

/**
 * The languages a homeowner may choose from, primary first.
 *
 * @param company  needs `defaultLanguage` and `sendLanguages`
 * @returns {string[]} at least one code, never empty
 */
export function sendLanguagesFor(company = {}) {
  const fallback = isSupported(company.defaultLanguage)
    ? company.defaultLanguage
    : DEFAULT_LANGUAGE;

  const stated = (
    Array.isArray(company.sendLanguages) ? company.sendLanguages : []
  ).filter((l) => isSupported(l));

  if (!stated.length) return [fallback];

  // De-duplicated, and the company default leads only when it is genuinely one
  // of the languages they said they send in. A contractor who listed French and
  // Spanish has not offered English just because the back office runs in it.
  const unique = [...new Set(stated)];
  return unique.includes(fallback)
    ? [fallback, ...unique.filter((l) => l !== fallback)]
    : unique;
}

/** The one the form opens on. */
export function primarySendLanguage(company = {}) {
  return sendLanguagesFor(company)[0];
}

/**
 * The language to WRITE a record in, given what the browser asked for.
 *
 * Falls back to the primary rather than trusting the body: a crafted POST must
 * not be able to stamp a document with a language the contractor never offered.
 */
export function resolveRequestedLanguage(company, requested) {
  const offered = sendLanguagesFor(company);
  return offered.includes(requested) ? requested : offered[0];
}
