// lib/portal/loginLink.js
//
// "Client login" on a company's website, the part after the email is typed:
// find this company's clients with that address and email each one its own
// portal link.
//
// ── One company, always ────────────────────────────────────────────────────
//
// `companyId` comes from the SITE the form was on (resolved by subdomain in
// the route), never from the browser. The client lookup is scoped to it, so a
// homeowner who is a client of two contractors, logging in on contractor A's
// site, is sent A's link and only A's — B is never queried, and nothing about
// B can reach A's page or A's email. Several matches inside ONE company (a
// household entered twice) each get their own link: each is a real account
// with that company, and the address is the one on file for all of them.
//
// ── No password, by decision ───────────────────────────────────────────────
//
// Homeowners forget passwords and reuse them. The per-client portal token is
// the credential (lib/clientPortal.js); this only re-delivers it to the
// address the company already holds. Typing someone else's email sends THEM
// their own link — it grants the typist nothing.

import { db as defaultDb } from "@/lib/db";
import { sendEmail as defaultSend, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender as defaultResolveSender } from "@/lib/email/companySender";
import { ensurePortalToken } from "@/lib/clientPortal";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { buildPortalLinkEmail } from "@/lib/portal/loginEmail";

/** More than this many client rows on one address is a data problem, not a
 *  household; the first few still get their links. */
export const MAX_LINKS_PER_EMAIL = 5;

/**
 * @param companyId  from the site row, never from the request body
 * @param email      normaliseLoginEmail() output
 * @param origin     where the link should open — the company's own site host
 *                   in production (/portal passes through the subdomain
 *                   rewrite — middleware.js SUBDOMAIN_PASSTHROUGH)
 * @returns {{ matched: number, sent: number, failed: number }} — for the
 *          server log and the check script. NEVER returned to the browser:
 *          the response is the same sentence whatever this says.
 */
export async function sendPortalLinks({
  companyId,
  email,
  origin,
  db = defaultDb,
  send = defaultSend,
  resolveSender = defaultResolveSender,
}) {
  if (!companyId || !email || !origin) return { matched: 0, sent: 0, failed: 0 };

  const clients = await db.client.findMany({
    where: { companyId, email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, language: true, companyId: true },
    orderBy: { createdAt: "asc" },
    take: MAX_LINKS_PER_EMAIL,
  });
  // The where already says it; this says it again in code a check can run
  // with a stub that ignores the where.
  const mine = clients.filter((c) => c.companyId === companyId && c.email);
  if (mine.length === 0) return { matched: 0, sent: 0, failed: 0 };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { ...SENDER_SELECT, logoUrl: true, brandColor: true, phone: true, defaultLanguage: true },
  });
  if (!company) return { matched: mine.length, sent: 0, failed: mine.length };
  const { from, replyTo } = await resolveSender(company, companyId);

  let sent = 0;
  let failed = 0;
  for (const client of mine) {
    const token = await ensurePortalToken(db, client.id, companyId);
    if (!token) {
      failed += 1;
      continue;
    }
    const language = resolveClientLanguage({ client, company });
    const { subject, html, text } = buildPortalLinkEmail({
      company,
      client,
      url: `${origin.replace(/\/+$/, "")}/portal/${token}`,
      language,
    });
    // To the address ON FILE, not the string that was typed — they match
    // case-insensitively, and the stored one is the one the company agreed
    // to write to.
    const result = await send({ companyId, from, replyTo, to: client.email, subject, html, text });
    if (result?.error || result?.skipped) failed += 1;
    else sent += 1;
  }
  return { matched: mine.length, sent, failed };
}
