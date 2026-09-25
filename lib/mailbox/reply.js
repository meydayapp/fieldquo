// lib/mailbox/reply.js
//
// Answering an EMAIL conversation from the inbox (/app/messages).
//
// A filed email thread has no Meta channel to answer on, so the reply route
// hands it here instead of to lib/messaging/send.js. The reply is a real
// email to the client: through the company's own mailbox when "Send client
// emails from this mailbox" is on (lib/mailbox/send.js, via sendEmail's
// `clientMail`), otherwise from the company's usual sender — its verified
// domain, or FieldQuo's shared one under the company's name, Reply-To the
// company. Either way the client receives it; the stored row says which way
// it went (EmailMessage.sentVia) so nobody has to guess.
//
// Threading: "Re: <subject>" and In-Reply-To / References pointing at the
// latest email in the thread, so the client's mail program files the answer
// under their own question.

import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { cleanHeader } from "./text";

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The typed text → a plain, unbranded HTML part (paragraphs, line breaks). */
export function replyHtml(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function replySubject(subject) {
  const s = cleanHeader(subject, 400) || "";
  if (!s) return "Re:";
  return /^\s*re\s*:/i.test(s) ? s : `Re: ${s}`;
}

/**
 * @returns { ok: true, externalId, rfcMessageId, sentVia, headers }
 *        | { ok: false, reason, message }
 */
export async function sendEmailThreadReply(db, { companyId, thread, text }) {
  const to = thread.participantExternalId;
  if (!to || !/@/.test(to)) return { ok: false, reason: "no_address", message: "This conversation has no email address to reply to." };

  const last = await db.emailMessage.findFirst({
    where: { companyId, message: { threadId: thread.id } },
    orderBy: { createdAt: "desc" },
    select: { rfcMessageId: true, references: true, subject: true },
  });
  const company = await db.company.findUnique({ where: { id: companyId }, select: SENDER_SELECT });
  const { from, replyTo } = await resolveSender(company || {}, companyId);
  const subject = replySubject(last?.subject || "");
  const references = [...String(last?.references || "").split(/\s+/).filter(Boolean), last?.rfcMessageId].filter(Boolean).slice(-20);
  const headers = last?.rfcMessageId
    ? { "In-Reply-To": `<${last.rfcMessageId}>`, References: references.map((r) => `<${r.replace(/[<>]/g, "")}>`).join(" ") }
    : undefined;

  const result = await sendEmail({
    companyId,
    clientMail: true,
    to,
    subject,
    text,
    html: replyHtml(text),
    from,
    replyTo,
    ...(headers ? { headers } : {}),
  });
  if (result?.skipped) return { ok: false, reason: "email_not_configured", message: "Email isn't configured on this deployment, so nothing was sent." };
  if (result?.error) return { ok: false, reason: "send_failed", message: String(result.error?.message || result.error).slice(0, 300) };

  const sentVia = result?.via === "mailbox" ? "mailbox" : "fieldquo";
  // Through the mailbox we minted the Message-ID, and the Sent copy the next
  // sync reads will carry it — the unique index recognises it as this row.
  // Through the platform sender the provider mints one we never see; the id
  // stored is our own, namespaced so it can never collide with a real one.
  const rfcMessageId = sentVia === "mailbox" && result.id ? result.id : `fq-reply-${result?.id || globalThis.crypto.randomUUID()}@reply.invalid`;
  return { ok: true, externalId: `email:${rfcMessageId}`, rfcMessageId, sentVia, subject, from, to, inReplyTo: last?.rfcMessageId || null, references };
}
