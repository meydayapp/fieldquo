// lib/email/companySender.js
//
// Async companion to senderFor() in resend.js, for the case that function
// can't handle on its own: working out where replies should go when a company
// hasn't filled in its contact email.
//
// Why this matters. senderFor() sets `replyTo` from Company.email. If that's
// blank, replies fall through to the From address — quotes@send.<their
// domain> or FieldQuo's shared sender — and nobody is reading either. The
// client sees their reply send successfully and it silently evaporates. That
// is the worst possible failure mode for a quote, so we fall back to the
// account owner's login email, which always exists because they signed up
// with it.
//
// The UI still nags them to set a proper company email (see
// ReplyToPromptModal) — this is the safety net, not the solution.

import { db } from "@/lib/db";
import { senderFor } from "./resend";

// Cheap in-process cache. Sends happen in loops (a marketing campaign hits
// every subscriber), and the owner's email doesn't change mid-run.
const ownerEmailCache = new Map();

export async function ownerEmailFor(companyId) {
  if (!companyId) return undefined;
  if (ownerEmailCache.has(companyId)) return ownerEmailCache.get(companyId);

  const member = await db.member.findFirst({
    where: { companyId, role: "owner" },
    select: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const email = member?.user?.email || undefined;
  ownerEmailCache.set(companyId, email);
  return email;
}

/**
 * senderFor() plus the reply-to safety net.
 *
 * @param {object} company   Company row including SENDER_SELECT fields
 * @param {string} companyId used to look up the owner if company.email is blank
 */
export async function resolveSender(company = {}, companyId) {
  const base = senderFor(company);
  if (base.replyTo) return base;

  return { ...base, replyTo: await ownerEmailFor(companyId) };
}
