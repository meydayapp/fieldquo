// lib/notifications/teamReaders.js
//
// Who reads a team notice, and in which language — the two lookups every
// sender of lib/notifications/teamEmails.js needs, written once.
//
// The language is lib/i18n/letterLanguage.js's ONE rule (the reader's own
// User.language, then the company's default, then English), held to the
// languages the notice exists in (teamNoticeHas). Until 2026-10-13 the
// large-quote, payment and quote-decision notices were English whatever the
// reader had chosen, and the ticket notice read the company's language alone.
//
// Imported LAZILY by the public and webhook routes that send these (the
// quote-approval route, the Stripe payment path, the kitchen self-quote form):
// letterLanguage loads the app catalogue to know which codes exist, and the
// far commoner request through those routes sends no notice at all.

import { letterLanguage, ownerLetterLanguage } from "@/lib/i18n/letterLanguage";
import { teamNoticeHas } from "@/lib/i18n/teamNoticeCopy";

/** The member columns a notice needs: who, how to reach them, what they may see. */
export const READER_MEMBER_SELECT = Object.freeze({
  id: true,
  userId: true,
  role: true,
  permissions: true,
  user: { select: { email: true, language: true, name: true } },
});

/**
 * Member rows → [{ email, language, reader }]. Rows with no address are
 * dropped (there is nobody to write to), and the same address twice is one
 * reader.
 *
 * @param members  [{ role, permissions, user: { email, language } }]
 * @param company  { defaultLanguage }
 * @param has      the notice's language table — teamNoticeHas by default
 */
export function memberReaders(members, company, has = teamNoticeHas) {
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(members) ? members : []) {
    const email = String(m?.user?.email || "").trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push({
      email,
      language: letterLanguage(m.user, company, has),
      reader: { role: m.role, permissions: m.permissions ?? null },
    });
  }
  return out;
}

/** The language of a notice to the company's own address: the earliest owner's, else the company's. */
export function inboxLanguage(companyId, has = teamNoticeHas, client) {
  return client ? ownerLetterLanguage(companyId, has, client) : ownerLetterLanguage(companyId, has);
}
