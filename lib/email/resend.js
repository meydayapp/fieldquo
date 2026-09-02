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

// ══ This file is the ONE place a Resend client is constructed ══════════════
//
// It wasn't. Thirteen routes and libraries each did their own
// `lazyClient(() => new Resend(process.env.RESEND_API_KEY))` and called
// `resend.emails.send()` directly, so "the send path" was fourteen send paths
// and a guard in any one of them would have protected nothing. They were
// converted to sendEmail() so that the demo interception below has exactly one
// seam to sit at — the same reasoning as lib/demo/simulatedSpend.js's header,
// arriving at the opposite answer because here there genuinely IS one vendor
// and one module. scripts/check-demo-email.mjs holds the line: it fails if any
// file outside this one constructs a Resend client again.
import { Resend } from "resend";
import { recordError, errorDetail } from "@/lib/platform/errorLog";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { recordSimulatedSend } from "./demoMail";

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
/**
 * @param platformFrom  the platform's own From header, resolved asynchronously
 *                      by lib/email/platformSender.js. Optional so this stays
 *                      synchronous for callers that already know it; omitting
 *                      it falls back to EMAIL_FROM and then to Resend's
 *                      sandbox. Prefer resolveSender(), which supplies it.
 */
export function senderFor(company = {}, platformFrom) {
  const name = String(company.name || "").replace(/[<>"]/g, "").trim();

  const verified =
    company.emailDomainStatus === "verified" && company.emailDomain;

  const fallback = platformFrom || DEFAULT_FROM;

  const address = verified
    ? `${company.emailFromLocal || "quotes"}@${company.emailDomain}`
    : (fallback.match(/<(.+)>/)?.[1] || fallback).trim();

  return {
    from: name ? `${name} <${address}>` : fallback,
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

/**
 * @param companyId  the tenant this mail is sent ON BEHALF OF, when there is
 *                   one. Every tenant send path passes it; FieldQuo's own mail
 *                   (auth, billing to the platform, the marketing site's
 *                   contact form) has no tenant and omits it.
 *
 *                   It is an ID and never a boolean, deliberately. The caller
 *                   does not get to tell this function whether the company is a
 *                   demo — isDemoCompany() re-reads the row, for the reason
 *                   lib/demo/simulatedSpend.js gives at length: an id arriving
 *                   from an HTTP request is an id, and the only thing that can
 *                   safely divert a send is what the row says about itself.
 */
export async function sendEmail({ to, subject, html, text, replyTo, from, attachments, headers, companyId }) {
  // ── Before the key check, not after ──────────────────────────────────────
  //
  // A demo send is not "unconfigured", and the two must not be conflated: with
  // no RESEND_API_KEY the branch below returns { skipped }, which the send
  // routes correctly turn into a 503 that leaves the quote a draft. A demo has
  // to walk the whole flow instead, so it is answered first and answered with
  // success.
  if (companyId) {
    let demo;
    try {
      demo = await isDemoCompany(companyId);
    } catch (err) {
      // Fail as a send FAILURE, not as a send.
      //
      // isDemoCompany returns false for a company that isn't there — the safe
      // answer when the row is simply absent. A thrown error is different: it
      // means we could not read the row at all (Neon scaling from zero throws
      // P1001 — see AGENTS.md), so we do not know who this mail is for. The
      // obvious alternative, carrying on to the real path, is precisely the
      // leak this function exists to stop, and it would take a database blip to
      // trigger it. The routes already handle { error }: a real company's send
      // fails loudly, its status is left alone, and the person retries.
      console.error("[email] couldn't establish whether the sender is a demo:", err?.message);
      await recordError({
        area: "email",
        code: "demo_check_failed",
        message: `Refused to send mail to ${to}: could not read company ${companyId} to check isDemo`,
        companyId,
        detail: errorDetail(err, { to, subject }),
      });
      return { error: "Couldn't confirm the sending account, so nothing was sent. Try again." };
    }
    if (demo) {
      return recordSimulatedSend({ companyId, to, subject, html, text, from, replyTo, attachments });
    }
  }

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
      // e.g. the quote/invoice PDF. Resend accepts { filename, content } where
      // content is a Buffer or base64 string.
      ...(Array.isArray(attachments) && attachments.length && { attachments }),
      // List-Unsubscribe / List-Unsubscribe-Post — see
      // lib/marketing/unsubscribe.js's unsubscribeHeaders(). Only commercial
      // send paths pass this; a transactional email (a sent invoice, a
      // password reset) has no `headers` and nothing changes for it.
      ...(headers && Object.keys(headers).length && { headers }),
    });
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      // The failure mode this exists for: Resend accepts the call, rejects the
      // message, and the company believes the client got it. Durably recorded
      // so support sees it without anyone tailing logs.
      await recordError({
        area: "email",
        code: "resend_rejected",
        message: `Resend rejected mail to ${to}: ${result.error?.message || "unknown error"}`,
        detail: { to, subject, from: from || DEFAULT_FROM, error: result.error },
      });
      return { error: result.error };
    }
    return { id: result.data?.id };
  } catch (err) {
    console.error("[email] send failed:", err.message);
    await recordError({
      area: "email",
      code: "send_threw",
      message: `Sending mail to ${to} threw: ${err.message}`,
      detail: errorDetail(err, { to, subject }),
    });
    return { error: err.message };
  }
}
