// lib/i18n/resolveLanguage.js
//
// Which language do we write to this person in?
//
// Three separate questions that are easy to conflate:
//
//   1. What language is the APP shown in?      → the logged-in user
//   2. What language is a DOCUMENT written in? → the client receiving it
//   3. What language was this quote SENT in?   → frozen on the record
//
// (3) matters more than it looks. Quote.language records what a client
// actually received. If a company later switches its default from English to
// French, a quote sent last month must still render in English — otherwise
// reprinting it produces a document the client never agreed to, which is a
// problem if anyone ever disputes what was quoted.
//
// Null means "inherit" at every level, deliberately. Storing "en" explicitly
// on a user who never opened settings would freeze them there, so changing
// the company default would silently skip exactly the people who never
// expressed a preference.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

/**
 * Interface language for a signed-in user.
 * user.language → company.defaultLanguage → "en"
 */
export function resolveUserLanguage(user, company) {
  if (isSupported(user?.language)) return user.language;
  if (isSupported(company?.defaultLanguage)) return company.defaultLanguage;
  return DEFAULT_LANGUAGE;
}

/**
 * Language for anything a CLIENT reads — quote PDFs, invoice emails, the
 * portal. Never falls back to the staff member's own language: an English-
 * speaking estimator sending to a Spanish-speaking homeowner should produce
 * a Spanish document.
 */
export function resolveClientLanguage(client, company) {
  if (isSupported(client?.language)) return client.language;
  if (isSupported(company?.defaultLanguage)) return company.defaultLanguage;
  return DEFAULT_LANGUAGE;
}

/**
 * Language for an existing quote or invoice. Prefers the language frozen on
 * the record at send time; only falls back for drafts that haven't been sent.
 */
export function resolveDocumentLanguage(doc, client, company) {
  if (isSupported(doc?.language)) return doc.language;
  return resolveClientLanguage(client, company);
}
