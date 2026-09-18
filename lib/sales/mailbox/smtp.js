// lib/sales/mailbox/smtp.js
//
// Sending as the rep, through the rep's own mailbox.
//
// ══ One set of bytes, two destinations ════════════════════════════════════
//
// The message is composed ONCE (nodemailer's MailComposer → raw RFC 5322
// bytes) and those bytes go to the SMTP server and, by the caller, into the
// Sent folder over IMAP (lib/sales/mailbox/imap.js appendToSent). Composing
// twice — once to send, once to store — is how the copy on the rep's phone
// ends up with a different Message-ID from the one the prospect received,
// and then the prospect's reply threads against a message the mailbox does
// not hold.
//
// The Message-ID is minted here, on the rep's domain, and returned: the
// caller stores it on the SalesMessage so the next sync recognises the
// appended copy as ours rather than filing it a second time.
//
// ══ Resend is not used for a rep's mail any more ══════════════════════════
//
// The rep's outreach used to go out through Resend from their address, with
// a Reply-To on a domain Resend received for (docs/SALES-OUTREACH.md §5b).
// The owner's 2026-09-18 decision replaced that: the portal is a second
// window onto the mailbox the owner bought each rep, so mail leaves through
// that mailbox's SMTP and arrives in its INBOX. Resend keeps every platform
// send (quotes, invites to companies, the digest) and nothing of the rep's.

import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";

export const SMTP_TIMEOUT_MS = 20 * 1000;

function transportFor(mailbox, password) {
  return nodemailer.createTransport({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    secure: true,
    auth: { user: mailbox.address, pass: password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: 60 * 1000,
    logger: false,
  });
}

/** Connect and authenticate, sending nothing. The sentence is the card's. */
export async function testSmtp(mailbox, password) {
  const transport = transportFor(mailbox, password);
  try {
    await transport.verify();
    return { ok: true, sentence: `Signed in to ${mailbox.smtpHost}:${mailbox.smtpPort} as ${mailbox.address}; the server accepts mail from it.` };
  } catch (err) {
    return { ok: false, sentence: describeSmtpError(err, mailbox) };
  } finally {
    transport.close();
  }
}

export function describeSmtpError(err, mailbox = {}) {
  const msg = String(err?.response || err?.message || err || "unknown error");
  const where = `${mailbox.smtpHost || "the SMTP host"}:${mailbox.smtpPort || ""}`;
  if (err?.responseCode === 535 || /535|Invalid login|authentication failed|AUTH/i.test(msg)) {
    return `The server at ${where} refused the password for ${mailbox.address || "this mailbox"}.`;
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return `The host ${where} could not be found. Namecheap Private Email is mail.privateemail.com.`;
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|Timeout/i.test(msg)) {
    return `No answer from ${where} in ${Math.round(SMTP_TIMEOUT_MS / 1000)}s. SMTP over SSL is port 465 on Namecheap.`;
  }
  return `SMTP at ${where}: ${msg.slice(0, 300)}`;
}

/** A fresh Message-ID on the mailbox's own domain. */
export function mintMessageId(address) {
  const domain = String(address || "").split("@")[1] || "fieldquo.com";
  return `${randomUUID()}@${domain}`;
}

/**
 * Compose the message once and return its bytes and id — not yet sent.
 *
 * @param mail  { from: { name, address }, to: [..], cc: [..], subject, text,
 *                html, attachments: [{ filename, content | path }],
 *                inReplyTo, references: [..] }
 * @returns { raw: Buffer, messageId, envelope: { from, to } }
 */
export async function composeMessage(mail) {
  const messageId = mintMessageId(mail.from?.address);
  const composer = new MailComposer({
    from: mail.from?.name ? { name: mail.from.name, address: mail.from.address } : mail.from?.address,
    to: mail.to,
    ...(Array.isArray(mail.cc) && mail.cc.length ? { cc: mail.cc } : {}),
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    messageId: `<${messageId}>`,
    ...(mail.inReplyTo ? { inReplyTo: `<${mail.inReplyTo}>` } : {}),
    ...(Array.isArray(mail.references) && mail.references.length
      ? { references: mail.references.map((r) => `<${r}>`).join(" ") }
      : {}),
    ...(Array.isArray(mail.attachments) && mail.attachments.length ? { attachments: mail.attachments } : {}),
  });
  const raw = await composer.compile().build();
  return {
    raw,
    messageId,
    envelope: { from: mail.from?.address, to: [...(mail.to || []), ...(mail.cc || [])] },
  };
}

/** Send composed bytes. Returns { ok, error } — never throws. */
export async function sendRaw(mailbox, password, { raw, envelope }) {
  const transport = transportFor(mailbox, password);
  try {
    const info = await transport.sendMail({ envelope, raw });
    const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
    if (rejected.length) return { ok: false, error: `The server refused ${rejected.join(", ")}.` };
    return { ok: true, response: String(info?.response || "").slice(0, 200) };
  } catch (err) {
    return { ok: false, error: describeSmtpError(err, mailbox) };
  } finally {
    transport.close();
  }
}
