// lib/email/resend.js
//
// Thin wrapper around Resend. Requires `npm install resend` and RESEND_API_KEY
// in .env. If the key is missing, sends are skipped (logged) rather than
// throwing, so local dev without email configured still works.
//
// IMPORTANT — sender address: Resend only sends from a DOMAIN you've verified
// in the Resend dashboard. You cannot send "from" a gmail.com address (nobody
// can — you don't own the domain). Until you verify a domain, this uses
// Resend's shared `onboarding@resend.dev` sender, which in test mode only
// delivers to the email on your own Resend account. Set EMAIL_FROM once a
// domain is verified (e.g. "FieldQuo <team@fieldquo.com>"). Replies go to
// EMAIL_REPLY_TO regardless, so you can route replies to your Gmail today.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const DEFAULT_FROM = process.env.EMAIL_FROM || "FieldQuo <onboarding@resend.dev>";
// Platform-level fallback only — for FieldQuo's own mail (invites, billing).
// Tenant mail must NOT fall back to this: see senderFor() below.
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || "";

// The address clients see, and where their replies land, for mail sent on
// behalf of a company. Two tiers:
//
//   1. The company has verified its own domain (Settings > Email Domain) —
//      send from quotes@send.theircompany.com. No "via fieldquo.com" in
//      Gmail, and the company owns its own sender reputation.
//   2. It hasn't — fall back to FieldQuo's shared domain, using the company's
//      NAME as the display name so the client still sees "Northline
//      Refinishing" rather than "FieldQuo".
//
// Either way replies go to the company's own inbox, so a client hitting reply
// on a quote reaches the people who sent it.
export function senderFor(company = {}) {
  const name = String(company.name || "").replace(/[<>"]/g, "").trim();

  const verified =
    company.emailDomainStatus === "verified" && company.emailDomain;

  const address = verified
    ? `${company.emailFromLocal || "quotes"}@${company.emailDomain}`
    : (DEFAULT_FROM.match(/<(.+)>/)?.[1] || DEFAULT_FROM).trim();

  return {
    from: name ? `${name} <${address}>` : DEFAULT_FROM,
    // Falls back to undefined, never to a hardcoded personal address — a
    // client replying to one company's quote must never reach anyone else.
    replyTo: company.email || undefined,
  };
}

// The Company fields senderFor() needs. Exported so every send path selects
// the same set — miss one and mail silently reverts to the shared domain.
export const SENDER_SELECT = {
  name: true,
  email: true,
  emailDomain: true,
  emailDomainStatus: true,
  emailFromLocal: true,
};

export async function sendEmail({ to, subject, html, text, replyTo, from }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`,
    );
    return { skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: from || DEFAULT_FROM,
      to,
      subject,
      html,
      // Plain-text alternative. Not cosmetic: some corporate filters score
      // HTML-only mail as spam, and a quote in a junk folder is the same
      // outcome as one never sent.
      ...(text && { text }),
      ...((replyTo || DEFAULT_REPLY_TO) && {
        replyTo: replyTo || DEFAULT_REPLY_TO,
      }),
    });
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { error: result.error };
    }
    return { id: result.data?.id };
  } catch (err) {
    console.error("[email] send failed:", err.message);
    return { error: err.message };
  }
}
