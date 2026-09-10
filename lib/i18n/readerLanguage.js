// lib/i18n/readerLanguage.js
//
// The language of the PERSON about to read something the server is producing.
//
// lib/i18n/resolveLanguage.js already answers this, and this file adds exactly
// one thing: the two rows. A route holds a member — a userId and a companyId —
// not a User and a Company, and every generator that wanted the answer would
// otherwise grow its own pair of queries and its own opinion about what to do
// when one fails. Three copies of that is how the same screen ends up in two
// languages.
//
// Never throws. A summary in the wrong language is a disappointment; a 500 on
// the button that produces it is a broken feature.

import { db } from "@/lib/db";
import { DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { resolveUserLanguage } from "./resolveLanguage";

/**
 * @param userId     the signed-in user, or null for an unattended job
 * @param companyId  their company
 * @returns a supported language code, never null
 */
export async function readerLanguage({ userId, companyId } = {}) {
  try {
    const [user, company] = await Promise.all([
      userId
        ? db.user.findUnique({ where: { id: userId }, select: { language: true } })
        : null,
      companyId
        ? db.company.findUnique({
            where: { id: companyId },
            select: { defaultLanguage: true },
          })
        : null,
    ]);
    return resolveUserLanguage(user, company);
  } catch (err) {
    console.error("[readerLanguage] couldn't resolve the reader's language:", err);
    return DEFAULT_LANGUAGE;
  }
}
