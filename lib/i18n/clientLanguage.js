// lib/i18n/clientLanguage.js
//
// Which language a client is written to in.
//
// ── One rule, one place ─────────────────────────────────────────────────────
//
// Every client-facing send has to answer the same question, and answering it
// slightly differently in six routes is how a client ends up with a French
// quote, an English payment reminder and a Spanish follow-up. So the
// precedence lives here and every send path calls this.
//
//   1. The DOCUMENT's own language, when the document has one.
//      Quote.language and Invoice.language are fixed at creation. A quote
//      written in French stays French even if the client's preference is
//      changed afterwards — the covering email must match the attachment it
//      is carrying, not a preference edited last week.
//
//   2. The CLIENT's saved language. Used for anything not tied to a specific
//      document: a payment reminder, a booking confirmation.
//
//   3. The company default. A contractor in Gatineau whose clients are mostly
//      francophone sets this once.
//
//   4. English.
//
// ── Why the document wins over the client ───────────────────────────────────
//
// It's tempting to always use the client's current preference — it sounds
// more personal. But the email carries a link to a document that was written
// once and can't be re-rendered without changing what was agreed. An English
// covering note wrapped around a French quote is confusing; a French covering
// note wrapped around an English quote is worse, because it implies a
// translation that doesn't exist.

import { SUPPORTED_EMAIL_LANGUAGES } from "./emailCopy";

const ok = (v) => (v && SUPPORTED_EMAIL_LANGUAGES.includes(v) ? v : null);

/**
 * @param document  quote or invoice, or null for correspondence not tied to one
 * @param client    the Client row (needs `language`)
 * @param company   the Company row (needs `defaultLanguage`)
 */
export function resolveClientLanguage({ document, client, company } = {}) {
  return (
    ok(document?.language) ||
    ok(client?.language) ||
    ok(company?.defaultLanguage) ||
    "en"
  );
}
