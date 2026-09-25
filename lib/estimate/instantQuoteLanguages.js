// lib/estimate/instantQuoteLanguages.js
//
// Which languages the instant-estimate form offers a visitor, as the COMPANY
// chose them under Settings › Instant quotes (Company.instantQuoteLanguages),
// and which one a request resolves to. One rule, read by the public payload
// (lib/estimate/instantQuoteServer.js), the request route and the settings
// PUT — the pills a visitor sees and the language a draft is written in
// must never disagree, which is the whole reason this is a file.
//
// ── Unset means all three, deliberately ─────────────────────────────────────
//
// The obvious alternative — "the company's default language plus English",
// or the default alone, the way lib/company/sendLanguages.js reads an empty
// send list — was considered and rejected for THIS setting. Every instant
// form in production has offered English, Français and Español since the
// pills shipped, and contractors have linked to it with ?lang=es from Spanish
// pages. Reading "never chose" as a narrower list would silently take a
// language off live forms and turn those links English, on the day of a
// deploy nobody asked for: a destructive change dressed as a default. So
// until a company saves a choice, its form keeps doing exactly what it does
// today, and the settings card says so ("all three are offered until you
// choose"). The first save is the statement.
//
// Pure: no database, no request.

import { INSTANT_QUOTE_LANGUAGES, instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";

/**
 * A stored or posted list, cleaned: only the instant languages, each once, in
 * the order the pills are drawn. Returns [] for anything else — which the
 * readers below treat as "never chosen".
 */
export function sanitiseInstantLanguages(raw) {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.map((v) => (typeof v === "string" ? v.trim().toLowerCase() : "")));
  return INSTANT_QUOTE_LANGUAGES.filter((code) => wanted.has(code));
}

/**
 * The languages this company's form offers, in pill order, never empty.
 *
 * @param company  needs `instantQuoteLanguages`
 */
export function offeredInstantLanguages(company = {}) {
  const chosen = sanitiseInstantLanguages(company?.instantQuoteLanguages);
  return chosen.length ? chosen : [...INSTANT_QUOTE_LANGUAGES];
}

/**
 * The language a page or a request is served in.
 *
 *   1. what the visitor asked for (the pill, ?lang=, their browser) — when
 *      the company offers it;
 *   2. the company's own default language — when the company offers it;
 *   3. the first language the company offers.
 *
 * Never a language the company switched off: a crafted ?lang= or POST must
 * not produce a draft in a language the contractor said they do not answer
 * in (non-negotiable #6 makes the request's language the document's).
 */
export function resolveInstantLanguage(company = {}, requested = null) {
  const offered = offeredInstantLanguages(company);
  const asked = instantQuoteLanguage(requested);
  if (asked && offered.includes(asked)) return asked;
  const own = instantQuoteLanguage(company?.defaultLanguage);
  if (own && offered.includes(own)) return own;
  return offered[0];
}

/**
 * The value the settings PUT stores, or an error string. An empty choice is
 * refused rather than stored: a form with no language is not a setting, and
 * saving [] would read back as "all three" — the opposite of what somebody
 * unticking every box meant.
 */
export function instantLanguagesForSave(raw) {
  if (!Array.isArray(raw)) return { error: "languages must be a list" };
  const clean = sanitiseInstantLanguages(raw);
  if (!clean.length) return { error: "Offer at least one language." };
  return { languages: clean };
}
