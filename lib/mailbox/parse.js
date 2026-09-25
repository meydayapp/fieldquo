// lib/mailbox/parse.js
//
// Headers → who it is between (cheap, for EVERY message), and raw bytes →
// the filed shape (only for a message that matched a client or lead).
//
// ══ Two stages, because of what is never downloaded ═══════════════════════
//
// The owner's rule: mail that is not with a client or a lead must not land
// in FieldQuo. The strongest form of that is to never fetch it. So every
// provider adapter (lib/mailbox/providers/) first lists messages by their
// HEADERS only — From, To, Cc, Message-ID, Subject, Date — which is enough to
// match an address; the body and attachments are fetched only for the ones
// that match. A contractor's personal mail is seen as a set of addresses,
// counted as "skipped", and forgotten.

import { simpleParser } from "mailparser";
import { cleanMessageId, referencesList } from "@/lib/sales/mailbox/parse";
import { parseAddressList } from "./addresses";
import { cleanHeader, storedBody } from "./text";
import { syntheticMessageId } from "./file";

/**
 * A headers-only view in one shape, from any adapter's listing.
 * @param h { from, to, cc, messageId, inReplyTo, references, subject, date }
 */
export function headerView(h = {}) {
  const date = h.date ? new Date(h.date) : null;
  return {
    from: parseAddressList(h.from),
    to: parseAddressList(h.to),
    cc: parseAddressList(h.cc),
    rfcMessageId: cleanMessageId(h.messageId),
    inReplyTo: cleanMessageId(h.inReplyTo),
    references: referencesList(h.references),
    subject: cleanHeader(h.subject, 500),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

/**
 * Raw RFC 5322 bytes → the filed shape. Headers from the listing are the
 * fallback for anything the parse lacks (a message too large to fetch keeps
 * its listing's headers and a one-line body saying so).
 *
 * @returns { rfcMessageId, inReplyTo, references[], subject, from[], to[], cc[], date, body, attachments[] }
 */
export async function parseRaw(raw, fallback = {}, { parse = simpleParser } = {}) {
  let p = null;
  if (raw) {
    try {
      p = await parse(raw, { skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true });
    } catch {
      p = null;
    }
  }
  const head = p
    ? headerView({ from: p.from, to: p.to, cc: p.cc, messageId: p.messageId, inReplyTo: p.inReplyTo, references: p.references, subject: p.subject, date: p.date })
    : null;
  const pick = (k) => (head && (Array.isArray(head[k]) ? head[k].length : head[k]) ? head[k] : fallback[k]);
  const body = p ? storedBody({ text: p.text, html: p.html }) : fallback.bodyNote || "";
  const out = {
    from: pick("from") || [],
    to: pick("to") || [],
    cc: pick("cc") || [],
    rfcMessageId: pick("rfcMessageId") || null,
    inReplyTo: pick("inReplyTo") || null,
    references: pick("references") || [],
    subject: pick("subject") || "",
    date: pick("date") || null,
    body,
    attachments: p
      ? (Array.isArray(p.attachments) ? p.attachments : [])
          // An inline image that is part of an HTML signature's layout is not
          // something the client sent; a real inline photo has a filename.
          .filter((a) => a && !(a.contentDisposition === "inline" && !a.filename) && !/^text\/calendar/i.test(a.contentType || ""))
          .map((a) => ({
            filename: cleanHeader(a.filename, 200) || "attachment",
            contentType: cleanHeader(a.contentType, 100) || "application/octet-stream",
            content: Buffer.isBuffer(a.content) ? a.content : null,
            size: Number.isFinite(a.size) ? a.size : Buffer.isBuffer(a.content) ? a.content.length : null,
          }))
      : [],
  };
  if (!out.rfcMessageId) {
    out.rfcMessageId = syntheticMessageId({ from: out.from[0]?.address, date: out.date, subject: out.subject, body: out.body });
  }
  return out;
}
