// lib/email/resendReceiving.js
//
// Thin wrapper around Resend's Receiving API — the half of Resend that takes
// mail IN. Used by the sales inbound door (app/api/webhooks/resend-inbound).
//
// ══ Why a second fetch after the webhook ═══════════════════════════════════
//
// Resend's `email.received` event carries METADATA only: the email's id, the
// addresses, the subject, and the names of any attachments. Never the body,
// never the headers, never the bytes. Their docs give the reason — large
// attachments would not fit a serverless request body — so a receiver
// calls back for the content by id. That is what this does, with a plain
// fetch against the REST API in the shape lib/email/resendDomains.js already
// uses. No Resend SDK client is constructed here: lib/email/resend.js is the
// one file allowed to do that, and scripts/check-demo-email.mjs holds that
// line.
//
// ══ What the endpoints return ══════════════════════════════════════════════
//
//   GET /emails/receiving/:id               the message — `from`, `to[]`,
//                                           `cc[]`, `bcc[]`, `reply_to[]`,
//                                           `received_for[]`, `subject`,
//                                           `html`, `text`, `headers{}`,
//                                           `message_id`, `created_at`,
//                                           `attachments[]` (metadata only)
//   GET /emails/receiving/:id/attachments   `data[]` of { id, filename,
//                                           content_type, size, download_url,
//                                           expires_at } — the URL is signed
//                                           and good for an hour
//
// Read from resend.com/docs/api-reference/emails/retrieve-received-email and
// list-received-email-attachments on the day this was written, not from
// memory. If Resend renames a field the mapper in lib/sales/resendInbound.js
// is where it shows up, and the check script's fixture is a copy of their
// documented example so the two cannot silently disagree.

const API = "https://api.resend.com";

function apiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY isn't set — received email can't be fetched until it is.");
  }
  return key;
}

async function call(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || data?.error?.message || `Resend returned ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** The full received message, by the id the webhook carried. */
export async function getReceivedEmail(id) {
  return call(`/emails/receiving/${encodeURIComponent(id)}`);
}

/** Every attachment on a received message, each with a one-hour download URL. */
export async function listReceivedAttachments(id) {
  const data = await call(`/emails/receiving/${encodeURIComponent(id)}/attachments`);
  return Array.isArray(data?.data) ? data.data : [];
}
