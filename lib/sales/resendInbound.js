// lib/sales/resendInbound.js
//
// The pure half of the Resend Receiving door: proving a webhook came from
// Resend, turning what Resend hands back into the inbound contract every
// other rule already reads, and the words on the copy that goes to the rep.
//
// ══ Why this door exists ═══════════════════════════════════════════════════
//
// docs/SALES-OUTREACH.md §5 assumed the rep's mailbox would forward a copy of
// each reply to our endpoint. The reps' mailboxes are on Namecheap Private
// Email, which can forward mail to another ADDRESS but cannot POST to a URL —
// so nothing ever arrived, every rep's conversation page stayed empty, and the
// owner asked whether replies would land there. They would not.
//
// The fix is to make the reply go to an address WE receive for. Resend can
// receive mail for a domain (docs/SALES-OUTREACH.md §5b): we point the
// outbound Reply-To at `<rep>+fqs<token>@<SALES_REPLY_DOMAIN>`, Resend accepts
// the prospect's reply, posts an `email.received` event here, and we file it
// — then forward a copy to the rep's real mailbox ourselves, since a reply
// that went to Resend never reached a human otherwise. The From stays the
// rep's real address; only the Reply-To moves.
//
// ══ Pure, for the same reason lib/sales/outreach.js is ════════════════════
//
// The signature check is the entire authentication boundary of a public URL
// that writes to the database and sends mail, and "does it deny when the
// secret is unset" is a property that must be EXECUTED, not read. So nothing
// in here imports next/server or the database, and
// scripts/check-resend-inbound.mjs runs every function below against a
// known-good Svix vector, a tampered one, an unset secret, and an event with a
// token in its From and nowhere else.

import { createHmac, timingSafeEqual } from "node:crypto";
import { escapeHtml } from "@/lib/email/emailTheme";

/** The event this door acts on. Everything else is answered 200 and ignored. */
export const RECEIVED_EVENT = "email.received";

/**
 * How far a webhook's own timestamp may sit from our clock, in seconds.
 * Svix's own libraries use five minutes; a replayed capture older than that
 * carries a valid signature over a stale timestamp, and this is the check that
 * refuses it.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

// ── Signature verification ─────────────────────────────────────────────────
//
// Resend signs webhooks through Svix. Three headers arrive with every call:
//
//   svix-id         the message id — the same across redeliveries of one event
//   svix-timestamp  seconds since the epoch, when this attempt was signed
//   svix-signature  "v1,<base64>" — space-separated when a secret was rotated
//
// The signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the
// base64-decoded secret (the part after "whsec_") as the key. Verified against
// the Svix reference vector in the check script rather than against memory.
//
// Implemented by hand rather than through the `svix` package: it is thirty
// lines, the shape is documented and stable, and the one property that
// matters — an unset secret DENIES — is exactly the property a library call
// with `new Webhook(undefined)` would turn into a thrown error somewhere a
// route might catch and ignore. lib/security/cronAuth.js's header is the
// history behind that caution.

function decodeSecret(secret) {
  const raw = String(secret || "").trim();
  if (!raw) return null;
  const parts = raw.split("_");
  const encoded = parts.length > 1 ? parts.slice(1).join("_") : raw;
  try {
    const bytes = Buffer.from(encoded, "base64");
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Compute the signature Resend would have produced for this body.
 *
 * Exported so the check script can sign its own fixtures with a secret of its
 * choosing and then prove that tampering with one byte of the body — or of the
 * id, or of the timestamp — makes verification fail.
 */
export function signResendWebhook({ id, timestamp, body }, secret) {
  const key = decodeSecret(secret);
  if (!key) return null;
  return createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

/**
 * The verdict on one webhook request.
 *
 * @param headers   { id, timestamp, signature } — the three svix-* headers,
 *                  as strings or null
 * @param rawBody   the request body EXACTLY as received. Parsing and
 *                  re-serialising it changes whitespace and breaks the
 *                  signature; the route reads request.text() for this reason.
 * @param secret    RESEND_INBOUND_WEBHOOK_SECRET
 * @param now       injectable clock, seconds — for the check script
 *
 * @returns { ok, reason } with reason one of
 *   "unconfigured"  the secret is unset — ALWAYS denies, never falls through
 *   "missing"       a header is absent
 *   "stale"         the timestamp is outside the tolerance window
 *   "mismatch"      no signature in the header matches
 *   null            ok
 */
export function verifyResendWebhook(headers, rawBody, secret, now = Date.now() / 1000) {
  const key = decodeSecret(secret);
  if (!key) return { ok: false, reason: "unconfigured" };

  const id = String(headers?.id ?? "").trim();
  const timestamp = String(headers?.timestamp ?? "").trim();
  const signature = String(headers?.signature ?? "").trim();
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing" };

  // Timestamp before signature: a stale-but-valid capture is refused for
  // being stale, and the answer says so, rather than being reported as a
  // signature mismatch that sends someone looking at the wrong secret.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || !/^\d+$/.test(timestamp)) return { ok: false, reason: "stale" };
  if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${String(rawBody ?? "")}`)
    .digest("base64");

  // Several signatures during a secret rotation; each is "vN,<base64>". Only
  // v1 is defined today. Every candidate is compared in constant time and the
  // loop does not short-circuit on the first mismatch — though with at most a
  // handful of entries the difference is academic, the habit is not.
  let matched = false;
  for (const entry of signature.split(/\s+/)) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    if (safeEqual(value, expected)) matched = true;
  }
  return matched ? { ok: true, reason: null } : { ok: false, reason: "mismatch" };
}

// ── The event, and the email behind it ─────────────────────────────────────

/**
 * Pull what we need out of an `email.received` event.
 *
 * The webhook carries METADATA only — id, addresses, subject, attachment
 * names — never the body or headers. Resend's docs say why (large
 * attachments in serverless bodies) and the route fetches the full message by
 * id afterwards. This just reads the event honestly, and refuses anything
 * that is not the one event type this door handles.
 *
 * @returns { ok: true, emailId, messageId, from, to, subject, attachments }
 *        | { ok: false, reason: "not_received_event" | "no_email_id" }
 */
export function readReceivedEvent(event) {
  const e = event && typeof event === "object" ? event : {};
  if (e.type !== RECEIVED_EVENT) return { ok: false, reason: "not_received_event" };
  const data = e.data && typeof e.data === "object" ? e.data : {};
  const emailId = typeof data.email_id === "string" ? data.email_id.trim() : "";
  if (!emailId) return { ok: false, reason: "no_email_id" };
  return {
    ok: true,
    emailId,
    messageId: typeof data.message_id === "string" ? data.message_id : null,
    from: typeof data.from === "string" ? data.from : "",
    to: Array.isArray(data.to) ? data.to.filter((x) => typeof x === "string") : [],
    subject: typeof data.subject === "string" ? data.subject : "",
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
  };
}

/**
 * Only an id Resend could have minted may be interpolated into an API path.
 *
 * A route that fetches `/emails/receiving/${id}` with an id taken from a
 * request body is a route that fetches whatever path the body names, unless
 * the id is shaped like the UUIDs Resend actually issues. Verified before the
 * signature even matters — it costs nothing and it is the kind of thing that
 * is forgotten the day the signature check is refactored.
 */
export function isResendEmailId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function joinAddresses(list) {
  if (typeof list === "string") return list;
  if (!Array.isArray(list)) return "";
  return list.filter((x) => typeof x === "string" && x.trim()).join(", ");
}

function header(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  // Resend lower-cases header names; be tolerant of a capitalised one anyway.
  const found = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = found ? headers[found] : "";
  return typeof value === "string" ? value : Array.isArray(value) ? value.join(" ") : "";
}

/**
 * Map a retrieved received email (GET /emails/receiving/:id) onto the inbound
 * contract in docs/SALES-OUTREACH.md §5 — the same JSON a forwarder would
 * POST — so parseInboundEmail() and fileInboundMessage() apply every rule
 * they already apply, unchanged.
 *
 * ══ The token comes from `to` first, and never from `from` ═════════════════
 *
 * That ordering is parseInboundEmail's, not ours to restate: `to` is the
 * plus-tagged address the prospect actually replied to, which is the most
 * trustworthy carrier there is. This mapper's job is only to make sure the
 * right things land in the right fields — in particular, that the sender's
 * address goes into `from` and NOWHERE else, so it cannot become a haystack.
 * The check script builds an email whose From carries a token and asserts
 * that no token is found.
 *
 * `received_for` is appended to `to`: when a mailbox at the reply domain was
 * itself forwarded (a `Received: ... for <addr>` clause), that clause is
 * where the plus-tagged address survives.
 *
 * `headers.from` is preferred over the bare `from` for the display name —
 * "Dana at Acme <dana@acme.com>" is what the rep's forwarded copy should say
 * — and it is only ever the sender, so the preference changes nothing about
 * routing.
 */
export function receivedEmailToContract(email, event = {}) {
  const e = email && typeof email === "object" ? email : {};
  const headers = e.headers && typeof e.headers === "object" ? e.headers : {};

  const to = [joinAddresses(e.to), joinAddresses(e.received_for)]
    .filter(Boolean)
    .join(", ");

  return {
    from: header(headers, "from") || (typeof e.from === "string" ? e.from : "") || event.from || "",
    to: to || joinAddresses(event.to),
    replyTo: joinAddresses(e.reply_to) || header(headers, "reply-to"),
    subject: typeof e.subject === "string" ? e.subject : event.subject || "",
    text: typeof e.text === "string" ? e.text : "",
    html: typeof e.html === "string" ? e.html : "",
    inReplyTo: header(headers, "in-reply-to"),
    references: header(headers, "references"),
    messageId:
      (typeof e.message_id === "string" && e.message_id) ||
      header(headers, "message-id") ||
      event.messageId ||
      "",
    date: header(headers, "date") || (typeof e.created_at === "string" ? e.created_at : ""),
  };
}

// ── Where the copy goes ────────────────────────────────────────────────────

/**
 * Which rep's mailbox a message at the reply domain was for.
 *
 * `<local>+fqs<token>@reply.example.com` → "local". The local part of the
 * reply address is the rep's own mailbox local part — replyToAddress() built
 * it that way — so it is how a reply that could NOT be filed (no token, or a
 * token no thread has) still finds its human.
 *
 * ══ This chooses a MAILBOX OF OURS, never a thread ═════════════════════════
 *
 * The value is read off `to`, an address at a domain we control, and it is
 * matched against SalesRep.workEmail — our own rows. A stranger who writes to
 * `nobody+fqs…@reply.example.com` gets their mail forwarded to nobody, which
 * is the worst this can do. It cannot select a thread (only the token can,
 * and only through fileInboundMessage) and it never reads the sender.
 *
 * @returns the lowercase local part, or null when no address at `domain` is
 *          among the recipients.
 */
export function replyDomainLocalPart(to, domain) {
  const wanted = String(domain || "").trim().toLowerCase();
  if (!wanted) return null;
  const addresses = String(to || "")
    .split(/[,\s]+/)
    .map((a) => a.replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase())
    .filter(Boolean);
  for (const address of addresses) {
    const at = address.lastIndexOf("@");
    if (at <= 0) continue;
    if (address.slice(at + 1) !== wanted) continue;
    const local = address.slice(0, at);
    const plus = local.indexOf("+");
    const bare = plus >= 0 ? local.slice(0, plus) : local;
    if (bare) return bare;
  }
  return null;
}

/**
 * The one line at the top of the copy the rep receives.
 *
 * The forwarded message is otherwise the prospect's, verbatim — same subject,
 * Reply-To set to the prospect so a reply from the mailbox reaches them. This
 * line is the only thing added, and it says what FieldQuo did with the
 * message: filed against a prospect, or not, and why. A copy that arrived
 * with no such line would look like the prospect had written to the rep
 * directly, and the rep would have no way to know whether FieldQuo has it.
 *
 * ══ Why "reply from FieldQuo" is the recommendation ═══════════════════════
 *
 * A reply sent from the rep's own mailbox goes straight to the prospect and
 * is NOT captured — nothing sees it leave. A reply sent from the thread in
 * FieldQuo is recorded and carries the token. The line says so plainly
 * rather than implying both are equivalent, because implying it is how a
 * conversation ends up half in FieldQuo and half in a mailbox.
 *
 * English, deliberately. SalesRep carries no language column, and the
 * portal's own readiness sentences (lib/sales/outreachReadiness.js) are
 * server-composed English for the same reason; the day a rep language exists
 * this is one function to translate.
 */
export function forwardHeaderLine({ filed, reason, prospect, attachmentsNote } = {}) {
  const who = String(prospect || "").trim() || "the prospect";
  let line;
  if (filed) {
    line =
      `Filed on ${who} in FieldQuo — reply from FieldQuo to keep the thread there ` +
      `(a reply sent from this mailbox reaches them but is not filed).`;
  } else {
    const why =
      {
        no_token: "the message carried no reply token, so FieldQuo could not tell which prospect it belongs to",
        unknown_token: "the reply token on it matches no thread",
        own_outbound: "it is your own sent message coming back",
        duplicate: "FieldQuo already has this message",
        error: "FieldQuo could not write it to the thread (it will retry)",
      }[reason] || `reason: ${reason || "unknown"}`;
    line = `Not filed in FieldQuo: ${why}.`;
  }
  if (attachmentsNote) line += ` ${attachmentsNote}`;
  return line;
}

/**
 * A sentence naming attachments that did NOT travel with the copy.
 *
 * Absence is stated, not hidden: a forwarded email with an attachment
 * silently dropped reads as "they sent nothing", which is worse than "they
 * sent kitchen-plan.pdf and it is in FieldQuo".
 */
export function attachmentsNote(names = [], { where = "in FieldQuo" } = {}) {
  const list = (Array.isArray(names) ? names : []).map((n) => String(n || "").trim()).filter(Boolean);
  if (!list.length) return "";
  const shown = list.length > 5 ? [...list.slice(0, 5), `and ${list.length - 5} more`] : list;
  return `Attachment${list.length === 1 ? "" : "s"} not included in this copy (${shown.join(", ")}) — ${where}.`;
}

/**
 * The forwarded copy's two bodies.
 *
 * The header line is prepended to the plain text and, for HTML, wrapped in a
 * paragraph ahead of the prospect's own markup. The prospect's HTML is passed
 * through as they sent it — this is THEIR message being delivered to a
 * mailbox, exactly as it would have been had the reply gone there directly,
 * and rewriting it would be a second opinion on a stranger's formatting. The
 * header line itself is escaped: the prospect's name is in it.
 */
export function forwardBodies({ headerLine, text, html }) {
  const line = String(headerLine || "").trim();
  const plain = String(text || "");
  const markup = String(html || "");

  const textBody = line ? `${line}\n\n${"—".repeat(24)}\n\n${plain}` : plain;

  const banner = line
    ? `<p style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #999;font:13px/1.4 -apple-system,Segoe UI,sans-serif;color:#333;background:#f4f4f4">${escapeHtml(line)}</p>`
    : "";
  const htmlBody = markup
    ? `${banner}${markup}`
    : `${banner}<pre style="white-space:pre-wrap;font:14px/1.5 -apple-system,Segoe UI,sans-serif">${escapeHtml(plain)}</pre>`;

  return { text: textBody, html: htmlBody };
}
