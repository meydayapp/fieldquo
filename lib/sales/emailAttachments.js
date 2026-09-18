// lib/sales/emailAttachments.js
//
// What a rep may attach to an email from the portal: files that are already
// on the thread, and nothing else.
//
// ══ Why there is no upload here ═══════════════════════════════════════════
//
// The brief asked for "a quote or PDF from the lead where one exists". A
// sales LEAD is a prospect, not a company: the quotes that exist in FieldQuo
// belong to tenants, and a rep — FieldQuo staff — has no standing to read a
// customer's quote, let alone mail it (AGENTS.md non-negotiable 3, the
// console views and never touches a company's data; the sales portal is
// narrower still). What a lead's record DOES hold is what the prospect sent
// us: the PDF they attached to a reply, re-hosted to Cloudinary by
// lib/sales/inboundAttachments.js. Those can be sent back or forwarded, by
// URL, and a URL that is not one of those rows' is dropped — the request
// never names a file the thread does not hold.
//
// Resend takes an attachment by `path` (a URL it fetches) or by content;
// `path` here, so a 20 MB PDF is not read into the request. The Cloudinary
// URL is ours and public-readable, which is what makes that safe.

import { publicAttachments } from "@/lib/messaging/attachments";

/** The most a message carries, matching lib/sales/inboundAttachments.js's forward cap. */
export const MAX_ATTACHMENTS = 10;

/**
 * Every file on the thread a rep may re-send: [{ url, filename, mimeType,
 * bytes, messageId }] — only stored (state "stored") entries with a URL.
 */
export function attachableOnThread(messages = []) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    for (const a of publicAttachments(m?.attachments)) {
      if (!a.url || a.state !== "stored") continue;
      out.push({ url: a.url, filename: a.filename || "attachment", mimeType: a.mimeType || null, bytes: a.bytes ?? null, messageId: m.id });
    }
  }
  return out;
}

/**
 * The Resend attachments for a send: the request's picks ∩ the thread's
 * files, by exact URL. Unknown URLs vanish rather than fail the send —
 * the compose box only offers the thread's files, so an unknown one is a
 * stale draft, not a rep's mistake.
 */
export function threadAttachmentsFor(messages, picks) {
  if (!Array.isArray(picks) || !picks.length) return [];
  const byUrl = new Map(attachableOnThread(messages).map((a) => [a.url, a]));
  const chosen = [];
  const seen = new Set();
  for (const p of picks) {
    const url = typeof p === "string" ? p : p?.url;
    const found = byUrl.get(String(url || ""));
    if (!found || seen.has(found.url)) continue;
    seen.add(found.url);
    chosen.push({ filename: found.filename, path: found.url });
    if (chosen.length >= MAX_ATTACHMENTS) break;
  }
  return chosen;
}
