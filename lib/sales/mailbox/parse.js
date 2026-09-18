// lib/sales/mailbox/parse.js
//
// One raw message from the mailbox → the shape the sync files.
//
// ══ Pure over mailparser's output, so fixtures can drive it ═══════════════
//
// mailparser's simpleParser turns RFC 5322 bytes into { from, to, cc,
// subject, text, html, messageId, inReplyTo, references, date, attachments }.
// Everything after that — which address is the counterpart, what the stored
// body is, how the References chain is normalised, which attachments are
// worth keeping — is decided here on plain objects, and
// scripts/check-sales-mailbox.mjs runs it on a multipart message, an
// HTML-only one, a quoted reply, one with attachments and one with none of
// the headers a well-behaved client sends.
//
// The body is TEXT, always: text/plain when the message has it, else the
// HTML flattened by lib/sales/outreach.js's htmlToText — the same rule the
// Resend door applies and the reason every screen renders a body as text.

import { htmlToText, sanitiseBodyText, sanitiseHeaderText, bareAddress } from "../outreach";

/** Angle brackets off an id; lowercase is NOT applied — Message-IDs are case-sensitive. */
export function cleanMessageId(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = s.match(/<([^<>\s]+)>/);
  return (m ? m[1] : s).slice(0, 998) || null;
}

/** References as an ordered, deduplicated list of clean ids. */
export function referencesList(value) {
  const raw = Array.isArray(value) ? value.join(" ") : String(value || "");
  const out = [];
  for (const m of raw.matchAll(/<([^<>\s]+)>/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  if (!out.length && raw.trim() && !/[<>\s]/.test(raw.trim())) out.push(raw.trim());
  return out;
}

/** mailparser's address object → "Name <addr>" strings and bare addresses. */
function addressesOf(field) {
  const list = Array.isArray(field?.value) ? field.value : Array.isArray(field) ? field : [];
  const display = [];
  const bare = [];
  for (const a of list) {
    const address = String(a?.address || "").trim().toLowerCase();
    if (!address) {
      // A group ("undisclosed-recipients:;") — its members, if any.
      for (const g of Array.isArray(a?.group) ? a.group : []) {
        const ga = String(g?.address || "").trim().toLowerCase();
        if (ga) {
          bare.push(ga);
          display.push(g?.name ? `${g.name} <${ga}>` : ga);
        }
      }
      continue;
    }
    bare.push(address);
    display.push(a?.name ? `${String(a.name).trim()} <${address}>` : address);
  }
  return { display: display.join(", "), bare };
}

/**
 * @param parsed   mailparser's ParsedMail
 * @param folder   "INBOX" | the Sent folder's name
 * @param self     the mailbox's own address, lowercase
 * @returns {
 *   direction, fromAddress, toAddress, ccAddresses, counterpart, subject,
 *   body, messageId, inReplyTo, references[], sentAt, attachments[]
 * }
 */
export function normaliseParsedMail(parsed, { folder, self }) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const from = addressesOf(p.from);
  const to = addressesOf(p.to);
  const cc = addressesOf(p.cc);
  const me = bareAddress(self);

  // Direction is the FOLDER's, not the header's: a message in Sent went out,
  // one in INBOX came in — even a note the rep mailed to themselves, which
  // sits in both and is both.
  const direction = folder && folder !== "INBOX" ? "out" : "in";

  // The other party: who wrote (inbound) or who was written to (outbound).
  // For outbound the first To that is not the rep; a Cc-only message keeps
  // its first Cc.
  const others = direction === "in" ? from.bare : [...to.bare, ...cc.bare].filter((a) => a !== me);
  const counterpart = others[0] || (direction === "in" ? null : to.bare[0] || null);

  const text = typeof p.text === "string" && p.text.trim() ? sanitiseBodyText(p.text) : htmlToText(p.html || p.textAsHtml || "");

  const date = p.date instanceof Date && !Number.isNaN(p.date.getTime()) ? p.date : null;

  return {
    direction,
    fromAddress: sanitiseHeaderText(from.display, 500) || (from.bare[0] || ""),
    toAddress: sanitiseHeaderText(to.display, 2000),
    ccAddresses: sanitiseHeaderText(cc.display, 2000) || null,
    counterpart: counterpart ? bareAddress(counterpart) : null,
    subject: sanitiseHeaderText(p.subject, 500),
    body: text,
    messageId: cleanMessageId(p.messageId),
    inReplyTo: cleanMessageId(p.inReplyTo),
    references: referencesList(p.references),
    sentAt: date,
    attachments: (Array.isArray(p.attachments) ? p.attachments : [])
      // Inline images that are part of an HTML body's layout are noise in a
      // text-only record; a real inline photo still has a filename.
      .filter((a) => a && (a.contentDisposition !== "inline" || a.filename))
      .map((a) => ({
        filename: sanitiseHeaderText(a.filename, 200) || "attachment",
        contentType: sanitiseHeaderText(a.contentType, 100) || "application/octet-stream",
        content: Buffer.isBuffer(a.content) ? a.content : null,
        size: Number.isFinite(a.size) ? a.size : Buffer.isBuffer(a.content) ? a.content.length : null,
      })),
  };
}

/** "Re: Re: Fwd: quote" → "quote" — the subject a thread is keyed on when headers fail. */
export function normaliseSubject(subject) {
  return String(subject || "")
    .replace(/^\s*((re|aw|sv|fwd?|tr|wg)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}
