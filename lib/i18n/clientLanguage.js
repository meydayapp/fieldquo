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

/**
 * The language of a payment RECEIPT: the client's own, then the invoice's,
 * then the company default, then English.
 *
 * The one deliberate exception to the document-first order above, and the
 * owner's instruction (2026-10-12): receipts go "taking into consideration the
 * language of the client". It does not break non-negotiable 6. A receipt
 * carries no document — no PDF, no signed page that must keep saying what it
 * said; it is correspondence about money that arrived, the "everything else
 * they receive" the client's language drives. Its link opens the invoice in
 * the portal, which still renders in the invoice's own language. The invoice
 * is the fallback only for a client who never stated one, because then it is
 * the best evidence of what this client reads.
 *
 * @param client   the Client row (needs `language`)
 * @param invoice  the invoice paid against (needs `language`)
 * @param company  the Company row (needs `defaultLanguage`)
 */
export function resolveReceiptLanguage({ client, invoice, company } = {}) {
  return (
    ok(client?.language) ||
    ok(invoice?.language) ||
    ok(company?.defaultLanguage) ||
    "en"
  );
}
