// lib/authLinkLanguage.js
//
// Server side of lib/authLinks.js: which language a page reached from an
// account email renders in, decided from the ACCOUNT before the first byte is
// sent — so the first render is right on a device that has never seen
// FieldQuo, and the browser's own guesses (lib/i18n/statedLanguage.js) are
// only consulted when no account can be identified at all.
//
// The order, everywhere below: the account the link was FOR → the `lang` the
// email put on the link → the account signed in on this browser → null
// (the page keeps today's browser guess). The link's own account comes first
// because it is what the email was written in; a signed-in session may be
// somebody else entirely (the owner's own case, 2026-09-25).
//
// Every function here answers null on any failure. A language is never worth
// an error page.

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { accountLanguageContext } from "@/lib/i18n/accountLanguage";
import { linkLanguage, readVerifyToken } from "@/lib/authLinks";

async function sessionLanguage(headers) {
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user?.id) return null;
    return (await accountLanguageContext({ id: session.user.id })).language;
  } catch {
    return null;
  }
}

/** /verify-email: the token's address, then ?lang=, then the session. */
export async function verifyArrivalLanguage({ token, lang, headers } = {}) {
  if (token) {
    try {
      const { secret } = await auth.$context;
      const read = await readVerifyToken(token, secret);
      if (read.email) {
        const { language } = await accountLanguageContext({ email: read.email });
        if (language) return language;
      }
    } catch {
      // Fall through to the link's own word.
    }
  }
  return linkLanguage(lang) || (await sessionLanguage(headers));
}

/**
 * /reset-password: the account the reset token belongs to (Better Auth keeps
 * it as Verification identifier `reset-password:<token>`, value = user id —
 * api/routes/password.mjs), then ?lang=, then the session.
 */
export async function resetArrivalLanguage({ token, lang, headers } = {}) {
  if (typeof token === "string" && token && token.length <= 512) {
    try {
      const row = await db.verification.findFirst({
        where: { identifier: `reset-password:${token}` },
        select: { value: true },
      });
      if (row?.value) {
        const { language } = await accountLanguageContext({ id: row.value });
        if (language) return language;
      }
    } catch {
      // Fall through.
    }
  }
  return linkLanguage(lang) || (await sessionLanguage(headers));
}

/**
 * /accept-invitation/[id]: the language the invitation EMAIL was written in.
 *
 * lib/email/teamInvite.js reads PendingTeamProfile.invitationLanguage and
 * writes in English when there is none; this answers the same way, so the
 * page matches the email it was opened from. Keyed on the invitation id in
 * the path, which is what makes it right for invitations already sitting in
 * inboxes — nothing had to be added to the link.
 */
export async function invitationArrivalLanguage(invitationId) {
  if (typeof invitationId !== "string" || !invitationId || invitationId.length > 64) return null;
  try {
    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
      select: { email: true, organizationId: true },
    });
    if (!invitation) return null;
    const pending = await db.pendingTeamProfile.findFirst({
      where: { companyId: invitation.organizationId, email: String(invitation.email || "").trim().toLowerCase() },
      select: { invitationLanguage: true },
    });
    return linkLanguage(pending?.invitationLanguage) || "en";
  } catch {
    return null;
  }
}
