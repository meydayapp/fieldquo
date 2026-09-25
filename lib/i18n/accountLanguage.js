// lib/i18n/accountLanguage.js
//
// The one lookup behind "which language does this account read": used by
// lib/auth.js to write the account emails and by lib/authLinkLanguage.js to
// render the pages those emails link to, so the email and the page cannot
// answer differently. Its own module because lib/auth.js imports it and
// lib/authLinkLanguage.js imports lib/auth.js — one file holding both would be
// an import cycle.

import { db } from "@/lib/db";
import { resolveUserLanguage } from "@/lib/i18n/resolveLanguage";

/**
 * The company and language to write to (or render for) this person.
 *
 * The company is the EARLIEST active membership. Someone who runs two
 * businesses on one login has two, and the first one is the one they signed
 * up with — the name they will recognise beside a login they are being asked
 * about. Shared with lib/auth.js's emails so the email and the page it links
 * to cannot answer differently.
 *
 * @param where  { id } or { email }
 * @returns { user, company, language } — user null when there is none
 */
export async function accountLanguageContext(where) {
  try {
    const filter = where?.id
      ? { id: String(where.id) }
      : where?.email
        ? { email: { equals: String(where.email).trim(), mode: "insensitive" } }
        : null;
    if (!filter) return { user: null, company: null, language: null };
    const row = await db.user.findFirst({
      where: filter,
      select: {
        id: true,
        email: true,
        emailVerified: true,
        language: true,
        memberships: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { company: { select: { name: true, defaultLanguage: true } } },
        },
      },
    });
    if (!row) return { user: null, company: null, language: null };
    const company = row.memberships?.[0]?.company || null;
    return { user: row, company, language: resolveUserLanguage(row, company) };
  } catch {
    return { user: null, company: null, language: null };
  }
}
