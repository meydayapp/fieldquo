// lib/mailbox/send.js
//
// Sending a company's client email through its own connected mailbox, so a
// quote arrives from quotes@theircompany.com (the real mailbox) and sits in
// that mailbox's Sent folder — opt-in, off until an owner/admin switches it
// on for a company-scope mailbox.
//
// ══ One seam, and a fallback that never drops a message ═══════════════════
//
// lib/email/resend.js's sendEmail() is the ONE place client email leaves
// FieldQuo. Callers that send CLIENT mail (a quote, an invoice, a payment
// request, a booking confirmation, a reply from the conversation inbox) pass
// `clientMail: true`; sendEmail calls trySendThroughMailbox() first, and on
// ANY failure — a refused password, a provider rate limit (after which the
// mailbox rests a full window), a timeout, our own hourly/daily throttle, more
// recipients than the provider takes on one message — the message goes out
// through the existing sender instead and the reason is written on the
// mailbox row, where the settings card
// prints "Sending from your mailbox failed — sent from FieldQuo instead".
// Marketing campaigns never pass the flag: bulk mail through a contractor's
// own mailbox would hit their provider's limits and their reputation.
//
// ══ White-label ══════════════════════════════════════════════════════════
//
// The message is the caller's subject, html, text and attachments, composed
// once by nodemailer's MailComposer. Nothing is added — no header, footer or
// "via" line naming FieldQuo. The From is the company's display name and the
// mailbox's own address. Reply-To is left off: replies should reach the real
// mailbox, which is the one being filed.

import { randomUUID } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import nodemailer from "nodemailer";
import { openMailSecret, sealMailSecret, mailCryptoConfigured } from "./crypto";
import { withImap } from "./providers/imap";
import { gmailSendRaw, GMAIL_SEND_SCOPE } from "./providers/google";
import { microsoftSendRaw } from "./providers/microsoft";
import { sendLimitFor, maxRecipientsFor, loginFor } from "./presets";
import { throttleVerdict, backoffVerdict } from "./sendThrottle";
import { db as realDb } from "@/lib/db";

export const SMTP_TIMEOUT_MS = 20 * 1000;

/** Can this row send? Pure — the settings card and the send path agree. */
export function canSend(conn) {
  if (!conn || conn.scope !== "company" || !conn.sendEnabled) return false;
  if (conn.status !== "connected" || !conn.secretEnc) return false;
  if (conn.provider === "imap") return Boolean(conn.smtpHost && conn.smtpPort);
  if (conn.provider === "google") return String(conn.grantedScopes || "").includes(GMAIL_SEND_SCOPE);
  if (conn.provider === "microsoft") return /(^|\s)(https:\/\/graph\.microsoft\.com\/)?Mail\.Send(\s|$)/i.test(String(conn.grantedScopes || ""));
  return false;
}

/** "Northline <quotes@send.northline.ca>" → "Northline". */
export function displayNameOf(from) {
  const m = String(from || "").match(/^\s*"?([^"<]*?)"?\s*</);
  return m ? m[1].trim().replace(/[\r\n<>"]/g, "") : "";
}

function smtpTransport(conn, password) {
  const security = conn.smtpSecurity || (Number(conn.smtpPort) === 465 ? "tls" : "starttls");
  return nodemailer.createTransport({
    host: conn.smtpHost,
    port: Number(conn.smtpPort),
    secure: security === "tls",
    requireTLS: security === "starttls",
    ignoreTLS: security === "plain",
    auth: { user: loginFor(conn, "smtp"), pass: password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: 60 * 1000,
    logger: false,
  });
}

export function describeSmtpError(err, conn = {}) {
  const msg = String(err?.response || err?.message || err || "unknown error");
  const where = `${conn.smtpHost || "?"}:${conn.smtpPort || "?"}`;
  if (err?.responseCode === 535 || err?.code === "EAUTH" || /535|Invalid login|authentication failed/i.test(msg)) return { code: "auth_failed", error: `${where} refused the address or password for sending.` };
  if (err?.responseCode === 421 || err?.responseCode === 450 || err?.responseCode === 451 || err?.responseCode === 452 || /rate|limit|too many/i.test(msg)) return { code: "rate_limited", error: `${where} is limiting how much this mailbox can send (${msg.slice(0, 120)}).` };
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return { code: "host_not_found", error: `The host ${conn.smtpHost || "?"} could not be found.` };
  if (/ETIMEDOUT|timeout|Timeout|ECONNRESET|ECONNREFUSED/i.test(msg)) return { code: "timeout", error: `No answer from ${where}.` };
  return { code: "rejected", error: `${where}: ${msg.slice(0, 200)}` };
}

/** Log in to SMTP and send nothing — run when sending is switched on. */
export async function testSmtpLogin(conn, password, { transport } = {}) {
  const t = transport || smtpTransport(conn, password);
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, ...describeSmtpError(err, conn) };
  } finally {
    t.close?.();
  }
}

/**
 * Compose once. Attachments arrive in Resend's shape ({ filename, content:
 * Buffer | base64 string }) because that is what every caller already builds.
 */
export async function composeClientMail({ fromName, fromAddress, to, cc, subject, html, text, attachments, headers, inReplyTo, references }) {
  const domain = String(fromAddress).split("@")[1] || "localhost";
  const messageId = `${randomUUID()}@${domain}`;
  const toList = Array.isArray(to) ? to : [to];
  const composer = new MailComposer({
    from: fromName ? { name: fromName, address: fromAddress } : fromAddress,
    to: toList,
    ...(Array.isArray(cc) && cc.length ? { cc } : {}),
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    messageId: `<${messageId}>`,
    ...(inReplyTo ? { inReplyTo: `<${inReplyTo}>` } : {}),
    ...(Array.isArray(references) && references.length ? { references: references.map((r) => `<${r}>`).join(" ") } : {}),
    ...(headers && Object.keys(headers).length ? { headers } : {}),
    ...(Array.isArray(attachments) && attachments.length
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content || ""), "base64"),
            ...(a.contentType ? { contentType: a.contentType } : {}),
          })),
        }
      : {}),
  });
  const raw = await composer.compile().build();
  return { raw, messageId, envelope: { from: fromAddress, to: [...toList, ...(Array.isArray(cc) ? cc : [])] } };
}

/**
 * Send composed bytes through the row's provider. Never throws.
 * @returns { ok, code?, error? }
 */
export async function sendRawThrough(db, conn, secret, composed, deps = {}) {
  if (conn.provider === "google") return gmailSendRaw(secret, composed.raw, deps.googleDeps);
  if (conn.provider === "microsoft") {
    return microsoftSendRaw(secret, composed.raw, {
      ...(deps.microsoftDeps || {}),
      onRotate: async (rotated) => db.mailboxConnection.update({ where: { id: conn.id }, data: { secretEnc: sealMailSecret(rotated, conn.id) } }),
    });
  }
  const t = deps.transport || smtpTransport(conn, secret);
  try {
    const info = await t.sendMail({ envelope: composed.envelope, raw: composed.raw });
    if (Array.isArray(info?.rejected) && info.rejected.length) return { ok: false, code: "rejected", error: `The server refused ${info.rejected.join(", ")}.` };
  } catch (err) {
    return { ok: false, ...describeSmtpError(err, conn) };
  } finally {
    t.close?.();
  }
  // SMTP does not file a copy in Sent (Gmail and Graph do); append one so the
  // contractor's phone shows what went out. Best effort: the message is
  // already delivered, and a failed copy must not turn a send into a failure.
  const sentFolder = conn.cursor?.sent?.folder;
  if (sentFolder) {
    const append = deps.append || ((c) => c.append(sentFolder, composed.raw, ["\\Seen"], new Date()));
    await withImap(conn, secret, append, deps.imapDeps).catch(() => null);
  }
  return { ok: true };
}

/**
 * The first choice for one client email. Never throws; never sends twice.
 *
 * @returns { sent: true, messageId } | { skipped: true } | { failed: true, code, error }
 *   `skipped` — no sending mailbox, or it is off: the caller sends as before,
 *   silently. `failed` — the mailbox was tried and did not carry it: the
 *   caller sends as before AND the reason is already on the row.
 */
export async function trySendThroughMailbox(dbArg, { companyId, mail }, deps = {}) {
  const db = dbArg || realDb;
  if (!companyId || !mailCryptoConfigured()) return { skipped: true };
  const now = deps.now ? deps.now() : new Date();
  const conn = await db.mailboxConnection.findFirst({
    where: { companyId, scope: "company", sendEnabled: true, status: "connected", secretEnc: { not: null } },
    orderBy: { sendEnabledAt: "desc" },
  });
  if (!canSend(conn)) return { skipped: true };

  const fail = async (code, error) => {
    await db.mailboxConnection
      .update({ where: { id: conn.id }, data: { lastSendFallbackAt: now, lastSendFallbackReason: `${code}: ${String(error || "").slice(0, 240)}` } })
      .catch(() => null);
    return { failed: true, code, error };
  };

  const limit = sendLimitFor(conn);
  // Resting after the provider's own rate refusal (sendThrottle.js). The row
  // is NOT rewritten here: the refusal already on it is the reason the card
  // shows, and stamping "now" on every skipped send would keep the rest going
  // for as long as quotes keep being sent.
  const rest = backoffVerdict(conn, { now, windowMs: limit?.windowMs });
  if (rest.resting) return { failed: true, code: "provider_backoff", error: `The provider refused for sending too much; resting until ${rest.until.toISOString()}.` };

  const verdict = throttleVerdict(conn, { now, limit: limit?.count ?? null, windowMs: limit?.windowMs });
  if (!verdict.ok) {
    const period = limit?.per === "day" ? "today" : "this hour";
    return fail(limit?.per === "day" ? "daily_limit" : "hourly_limit", `This mailbox has sent ${verdict.count} emails ${period}; its provider allows about ${verdict.limit}.`);
  }

  let secret;
  try {
    secret = openMailSecret(conn.secretEnc, conn.id);
  } catch {
    return fail("secret_unreadable", "The stored credential could not be opened; reconnect the mailbox.");
  }

  let composed;
  try {
    composed = await composeClientMail({ ...mail, fromName: displayNameOf(mail.from), fromAddress: conn.address });
  } catch (err) {
    return fail("compose_failed", err?.message);
  }

  // Namecheap refuses past 50 recipients a message, GoDaddy past 100 — the
  // whole message, not the overflow. Send it the usual way instead.
  const maxRecipients = maxRecipientsFor(conn);
  if (maxRecipients && composed.envelope.to.length > maxRecipients) {
    return fail("too_many_recipients", `${composed.envelope.to.length} recipients; this provider accepts at most ${maxRecipients} on one message.`);
  }

  const result = await sendRawThrough(db, conn, secret, composed, deps).catch((err) => ({ ok: false, code: "threw", error: err?.message }));
  if (!result.ok) return fail(result.code || "rejected", result.error);

  await db.mailboxConnection
    .update({ where: { id: conn.id }, data: { ...verdict.next, lastSentAt: now } })
    .catch(() => null);
  return { sent: true, messageId: composed.messageId, mailboxId: conn.id, address: conn.address };
}
