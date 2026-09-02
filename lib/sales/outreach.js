// lib/sales/outreach.js
//
// The pure half of a rep's own outreach: tokens, addresses, the text of an
// email, and the rules for reading one that came back.
//
// ══ Why "both halves" is a real requirement and not a nicety ═══════════════
//
// The owner was offered the usual trade — the rep gets a real mailbox, and the
// thread therefore lives in that mailbox rather than against the prospect — and
// answered "it should be both". So: FieldQuo sends FROM the rep's own address
// and keeps the copy, and the rep's mailbox forwards replies back to us to be
// filed. Neither half is the source of truth for the other. See the SalesThread
// header in prisma/schema.prisma.
//
// ══ Everything decidable without a database lives here ═════════════════════
//
// AGENTS.md: most of the real bugs in this repo were found by executing pure
// functions against hostile input, not by reading them. What is hostile here is
// unusually concrete — the input to half of these functions is an email written
// by a stranger, arriving through a mail provider we do not control. So the
// token reader, the opt-out reader, the header sanitiser and the secret check
// are all plain functions with no db and no next/server import, and
// scripts/check-sales-outreach.mjs executes every one of them against the ways
// they could each be wrong.
//
// That is also why verifyInboundSecret() returns a verdict object rather than a
// NextResponse the way lib/security/cronAuth.js's requireCronSecret does. Same
// rule, same timing-safe comparison, same refusal when the secret is unset —
// but a shape the check script can call directly, since bare node cannot
// resolve "next/server". The route builds the 401 itself, which is also what
// check:refusal-shape already requires of every route in this codebase.

import { timingSafeEqual } from "node:crypto";
import { randomBytes } from "node:crypto";
import { escapeHtml } from "@/lib/email/emailTheme";

// ── The pipeline ───────────────────────────────────────────────────────────
//
// Re-exported from lib/sales/outreachPipeline.js, which has no imports, so the
// screens can read the same five statuses without pulling node:crypto into a
// browser bundle. See that file's header.
export {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  isLeadStatus,
  statusAfterSend,
} from "./outreachPipeline";

import { isLeadStatus as isLeadStatusValue } from "./outreachPipeline";

// ── Reply tokens ───────────────────────────────────────────────────────────
//
// The token has to survive a round trip through mail systems we do not control
// and then be findable inside a blob of forwarded text. That rules out the
// base64url shape used by portal and unsubscribe tokens: `-` and `_` are legal
// in a local part but case is not reliably preserved by every provider, and a
// token that changes case in transit is a token that no longer matches a
// @unique column. Lowercase hex with a fixed prefix survives case-mangling
// (we lowercase on the way in) and is unambiguous to find in a haystack.
//
// 16 bytes, not 32: this is a routing label, not a bearer credential. Finding a
// thread proves nothing and grants nothing — the inbound endpoint is already
// behind a shared secret, and every read path is scoped by salesRepId. 128 bits
// is far past the point where a collision or a guess matters for a routing key.

const TOKEN_PREFIX = "fqs";
const TOKEN_HEX_LENGTH = 32;

/** Anchored — for validating a whole string. */
const TOKEN_EXACT = new RegExp(`^${TOKEN_PREFIX}[0-9a-f]{${TOKEN_HEX_LENGTH}}$`);
/**
 * Unanchored — for finding one inside a header or a quoted reply.
 *
 * Case-insensitive across the WHOLE token, prefix included. Found the hard way
 * on the first run of this: a provider that upper-cases a local part turns
 * `emilio+fqs61f7…` into `EMILIO+FQS61F7…`, and a pattern that only allowed a
 * lowercase `fqs` matched nothing — a reply that arrived intact and filed
 * nowhere, which is the exact failure this token exists to prevent. Matches are
 * lower-cased before they are returned, so the @unique column still sees one
 * spelling.
 */
const TOKEN_ANYWHERE = new RegExp(
  `${TOKEN_PREFIX}[0-9a-f]{${TOKEN_HEX_LENGTH}}`,
  "i",
);

export function newReplyToken() {
  return TOKEN_PREFIX + randomBytes(TOKEN_HEX_LENGTH / 2).toString("hex");
}

export function isReplyToken(value) {
  return typeof value === "string" && TOKEN_EXACT.test(value);
}

/**
 * Find the thread's token in an inbound message.
 *
 * ══ The sender's address is not a parameter, and that is the point ═════════
 *
 * app/api/crew/inbound/route.js already wrote down why an inbound message's
 * `From` is never a routing key: it is forgeable, and it is not even reliably
 * the person you think it is — a prospect who replies from their phone, or
 * whose assistant answers, or whose address is an alias, arrives as somebody
 * else. Matching on the address would file that reply nowhere (or, worse, file
 * a stranger's mail into a thread because their address happened to match).
 *
 * So this function takes only the carriers that we ourselves put the token
 * into, plus the ones a mail client echoes back:
 *
 *   explicit   the forwarder was configured to send us the token outright
 *   to         the reply was addressed to our plus-tagged Reply-To
 *   replyTo    the forwarded copy preserved the original Reply-To
 *   references / inReplyTo   threading headers, when the provider passes them
 *   subject    a rare provider convention; harmless to look at
 *   body       the quoted original, which carries the "Ref:" line we send
 *
 * `from` is absent from that list deliberately and permanently. The check
 * script asserts it stays absent.
 *
 * @returns the lowercase token, or null.
 */
export function extractReplyToken({
  explicit,
  to,
  replyTo,
  references,
  inReplyTo,
  subject,
  body,
} = {}) {
  // Ordered most-trustworthy first. A token we were handed outright beats one
  // scraped out of a quoted reply that could contain an older thread's.
  const haystacks = [explicit, to, replyTo, references, inReplyTo, subject, body];

  for (const value of haystacks) {
    if (typeof value !== "string" || !value) continue;
    const match = value.match(TOKEN_ANYWHERE);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

// ── Where a reply is asked to go ───────────────────────────────────────────

export const REPLY_ADDRESSING_MODES = ["plus", "plain"];

/**
 * The Reply-To for a thread.
 *
 * ══ Why the mode is required configuration and not a guess ═════════════════
 *
 * "plus" produces rep+fqs<token>@domain — sub-addressing. The reply carries the
 * token in its `To` header, which is the most reliable way to file it, AND it
 * still lands in the rep's real mailbox. That is exactly the "both" the owner
 * asked for.
 *
 * It also depends entirely on the mail provider supporting sub-addressing, and
 * we do not know which provider that is. Guessing wrong is not a degraded
 * feature: every reply BOUNCES, and the prospect's answer is lost — the worst
 * outcome available, and invisible from inside FieldQuo, since a bounce goes to
 * the prospect. So there is no default. The mode is set deliberately after the
 * owner has tested their own mailbox (docs/SALES-OUTREACH.md says how, in two
 * minutes), and until it is set, outreach reports itself as not ready and the
 * compose box does not render.
 *
 * "plain" is the safe mode: Reply-To is the rep's real address, which cannot
 * bounce because it is their actual mailbox. The token then travels only in the
 * visible "Ref:" line that buildOutboundEmail puts in every message, which a
 * normal reply quotes back. That is a weaker carrier — a reply that quotes
 * nothing files nowhere — which is why it is not silently the default either.
 */
export function replyToAddress(repEmail, replyToken, mode) {
  const email = String(repEmail || "").trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || !isReplyToken(replyToken)) return null;
  if (!REPLY_ADDRESSING_MODES.includes(mode)) return null;

  if (mode === "plain") return email;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  // A local part that already contains a `+` is not extended further: the
  // second tag is provider-dependent and this is not the place to find out.
  if (local.includes("+")) return null;
  return `${local}+${replyToken}@${domain}`;
}

/** The domain part, lowercased. Null when the address is not one. */
export function emailDomain(address) {
  const value = String(address || "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  const domain = value.slice(at + 1);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

/**
 * The bare address out of a From header — `Ada <ada@acme.com>` becomes
 * `ada@acme.com`, lowercased.
 *
 * Used ONLY to recognise our own outbound message coming back through a
 * mailbox that forwards sent items too. It is never used to find a thread; see
 * extractReplyToken for why an inbound sender address is not a routing key.
 */
export function bareAddress(value) {
  const raw = sanitiseHeaderText(value, 320);
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/** Loose enough to catch a typo, strict enough to refuse a header injection. */
export function isPlausibleEmail(address) {
  const value = String(address || "").trim();
  if (!value || value.length > 254) return false;
  if (/[\r\n<>,;"\s]/.test(value)) return false;
  return emailDomain(value) !== null;
}

// ── Text that becomes a header, or a stored row ────────────────────────────

/**
 * Anything that ends up in a mail header, cleaned.
 *
 * CR and LF are the whole reason this exists: a subject containing "\r\nBcc:"
 * is a header injection, and the address it would silently add is somebody
 * else's inbox. Stripped rather than rejected, because the inbound side has to
 * store whatever arrives — refusing to file a reply because its subject was
 * malformed loses the reply, and the reply is the thing we are here to keep.
 */
export function sanitiseHeaderText(value, max = 500) {
  return String(value ?? "")
    // Control characters, including CR/LF and the NULs some parsers emit.
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Body text, kept as text. Length-capped so one forwarded thread can't be a DoS. */
export function sanitiseBodyText(value, max = 100_000) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, max);
}

/**
 * A crude HTML-to-text, used only when a provider sends us an html body and no
 * text one.
 *
 * Deliberately crude and deliberately lossy: the goal is a readable record of
 * what the prospect said, not fidelity. What matters is that the result is
 * TEXT — every surface that renders a SalesMessage renders it as text, never
 * as markup, so a prospect cannot put script into a rep's screen by replying
 * with it.
 */
export function htmlToText(html) {
  return sanitiseBodyText(
    String(html ?? "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

// ── The email itself ───────────────────────────────────────────────────────
//
// ══ Why this is plain, and not built on renderTemplateSections ════════════
//
// Every other email in this product is a designed document: a quote, an
// invoice, a campaign. This one is a person writing to another person. Arriving
// as a branded HTML card with a header bar is what makes a one-to-one sales
// email read as a blast, which is both worse outreach and a worse CASL posture
// (a blast is what the recipient will call it). So: the rep's own words, in
// paragraphs, and a small footer carrying the things the law requires.
//
// This is also NOT a white-label surface. FieldQuo emailing a prospect on its
// own behalf is the one place FieldQuo's own name is the correct one — see
// AGENTS.md's white-label rule, which is about documents a CONTRACTOR's client
// sees.

/**
 * CASL, applied to this specific message.
 *
 * s.6(2) requires a commercial electronic message to identify the sender and
 * carry an unsubscribe mechanism. Identification means the sender's name AND a
 * mailing address, plus one of a phone number, email address or web address.
 * The unsubscribe mechanism may be "an electronic address" the recipient can
 * write to — it does not have to be a link — and it must be honoured for 60
 * days.
 *
 * So the footer says: who this is, where they are, and "reply and say
 * unsubscribe". That last part is not a claim about machinery that does not
 * exist — the Reply-To is the rep's real, human-read mailbox, and the inbound
 * side reads opt-outs too (see detectOptOut), after which the compose box for
 * that lead refuses to render. Both ends are real before the sentence is
 * printed.
 *
 * The mailing address has no default and cannot be invented. lib/legal/
 * privacyOfficer.js already set the precedent for a legally-required detail
 * FieldQuo had not supplied: ship the gap visibly rather than a plausible
 * fiction. Here the gap BLOCKS the send, because unlike a web page, an email
 * with a placeholder address in it has already been delivered to a stranger by
 * the time anyone notices.
 */
export function caslFooterLines({ rep, mailingAddress, replyToken }) {
  const name = sanitiseHeaderText(rep?.name, 120);
  const email = sanitiseHeaderText(rep?.email, 254);
  return [
    `${name} · FieldQuo · ${email}`,
    sanitiseHeaderText(mailingAddress, 300),
    "Don't want to hear from me again? Reply with \"unsubscribe\" and I'll stop.",
    `Ref: ${replyToken}`,
  ];
}

/**
 * @returns { subject, html, text }
 * @throws  when something required is missing. A throw rather than a degraded
 *          email: every caller has already checked readiness, so reaching here
 *          without a mailing address means the readiness check was bypassed,
 *          and the safe answer to that is not to produce a sendable message.
 */
export function buildOutboundEmail({ rep, subject, body, replyToken, mailingAddress }) {
  const cleanSubject = sanitiseHeaderText(subject, 200);
  const cleanBody = sanitiseBodyText(body, 20_000).trim();
  const address = sanitiseHeaderText(mailingAddress, 300);

  if (!rep?.email || !rep?.name) throw new Error("buildOutboundEmail needs the rep's name and email");
  if (!cleanSubject) throw new Error("An email needs a subject.");
  if (!cleanBody) throw new Error("An email needs a message.");
  if (!isReplyToken(replyToken)) throw new Error("buildOutboundEmail needs a valid reply token");
  if (!address) {
    throw new Error(
      "FieldQuo's mailing address isn't set, and CASL requires one in every " +
        "commercial email. Set SALES_MAILING_ADDRESS — see docs/SALES-OUTREACH.md.",
    );
  }

  const footer = caslFooterLines({ rep, mailingAddress: address, replyToken });

  const paragraphs = cleanBody
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  // #6b7280 on white measures 4.83:1 — the same pair, for the same reason,
  // that lib/marketing/unsubscribe.js's footer uses. A quieter grey would put
  // the one line the law requires be readable below 4.5:1.
  const footerHtml = footer
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;` +
    `font-size:15px;line-height:1.6;color:#111827;max-width:560px;">` +
    paragraphs +
    `<div style="margin-top:26px;padding-top:12px;border-top:1px solid #e5e7eb;` +
    `font-size:12px;line-height:1.6;color:#6b7280;">${footerHtml}</div>` +
    `</div>`;

  const text = `${cleanBody}\n\n—\n${footer.join("\n")}\n`;

  return { subject: cleanSubject, html, text };
}

// ── Reading a reply ────────────────────────────────────────────────────────

/**
 * The part of a reply the person actually typed, with the quoted original
 * dropped.
 *
 * Needed because everything below it is OUR text quoted back — including the
 * word "unsubscribe" from our own footer. Reading opt-outs out of the whole
 * body would mark every single reply as an opt-out, which is the failure mode
 * that would make this feature actively destroy the pipeline.
 */
export function visibleReplyText(body) {
  const lines = sanitiseBodyText(body).split("\n");
  const out = [];
  for (const line of lines) {
    if (
      /^\s*On .+ wrote:\s*$/i.test(line) ||
      /^\s*-{2,}\s*(original message|forwarded message)/i.test(line) ||
      /^\s*_{5,}\s*$/.test(line) ||
      /^\s*From:\s*.+@/i.test(line) ||
      /^\s*Le .+ a écrit\s*:/i.test(line)
    ) {
      break;
    }
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

// Whole-line phrases only. "stop" appears in ordinary prose — "please stop by
// at 3" is a meeting, not an opt-out, and scripts/check-sales-outreach.mjs
// asserts that exact sentence is not read as one. What we ASK for in the
// footer is the word "unsubscribe", so that is what is matched most loosely;
// everything else has to be a line on its own.
const OPT_OUT_PHRASES = [
  "unsubscribe",
  "unsubscribe me",
  "remove me",
  "remove me from your list",
  "take me off your list",
  "take me off",
  "stop emailing me",
  "stop contacting me",
  "no more emails",
  "no more email",
  "opt me out",
  "opt out",
  "do not email me",
  "do not email me again",
  "dont email me",
  "dont email me again",
  "do not contact me",
  "dont contact me",
  "please remove me",
  "please unsubscribe me",
];

/**
 * Did this reply ask us to stop?
 *
 * Only the first few lines the person actually typed are considered. A trailing
 * signature block or a long forwarded chain below it is not a place to go
 * hunting for consent decisions.
 */
export function detectOptOut(body) {
  const visible = visibleReplyText(body);
  if (!visible) return false;

  const lines = visible
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  for (const raw of lines) {
    const line = raw
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/^[\s"'*-]+/, "")
      .replace(/[.!?,;:\s"'*]+$/, "");
    if (!line) continue;
    if (OPT_OUT_PHRASES.includes(line)) return true;
    // "please unsubscribe", "unsubscribe please", "unsubscribe." — the word we
    // asked for, alone or with a courtesy attached, and nothing else.
    if (/^(please\s+)?unsubscribe(\s+please)?$/.test(line)) return true;
  }
  return false;
}

/**
 * Has this lead asked to be left alone?
 *
 * Derived from the inbound messages themselves rather than stored on a column.
 * Not for want of a column — for the reason lib/marketing/unsubscribe.js gives
 * about durability: the messages ARE the evidence, they are append-only, and a
 * verdict recomputed from them cannot drift away from what the prospect
 * actually wrote. It also means this needed no schema change, and every screen
 * and every send path asks the same question of the same rows.
 */
export function leadOptedOut(inboundMessages = []) {
  return inboundMessages.some(
    (m) => m?.direction === "in" && detectOptOut(m?.body),
  );
}

// ── The inbound endpoint's own rules ───────────────────────────────────────

/**
 * The shared-secret check, mirroring lib/security/cronAuth.js exactly:
 * timing-safe, and a MISSING secret always denies rather than comparing
 * against "Bearer undefined" — the fixed, publicly-knowable password that bug
 * was. Verified in the check script from both directions.
 *
 * @returns { ok: boolean, reason: "unconfigured" | "mismatch" | null }
 */
export function verifyInboundSecret(authorizationHeader, secret) {
  if (!secret || typeof secret !== "string") {
    return { ok: false, reason: "unconfigured" };
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(String(authorizationHeader ?? ""));
  // Different lengths would throw inside timingSafeEqual rather than compare
  // false. The length itself leaks nothing the wire did not already.
  if (expected.length !== given.length) return { ok: false, reason: "mismatch" };
  return timingSafeEqual(expected, given)
    ? { ok: true, reason: null }
    : { ok: false, reason: "mismatch" };
}

/**
 * Normalise whatever a mail provider posted into the fields SalesMessage needs.
 *
 * Provider-agnostic on purpose: we do not know which provider the owner's
 * mailboxes are with, and inventing a vendor's payload shape would be inventing
 * a capability. The contract is a small, documented JSON body that any
 * forwarder, parser or three-line script can produce — see
 * docs/SALES-OUTREACH.md — and each field is accepted under two or three of the
 * names providers commonly use, since that costs nothing and saves a mapping
 * layer.
 *
 * @returns { token, fromAddress, toAddress, subject, body, providerId, sentAt }
 *          `token` is null when nothing carried one; the route decides what to
 *          do about that, because "we could not file it" is a different answer
 *          from "this was malformed".
 */
export function parseInboundEmail(payload = {}) {
  const p = payload && typeof payload === "object" ? payload : {};

  const from = sanitiseHeaderText(p.from ?? p.sender ?? p.From, 254);
  const to = sanitiseHeaderText(p.to ?? p.recipient ?? p.To, 254);
  const replyTo = sanitiseHeaderText(p.replyTo ?? p["reply-to"] ?? p.ReplyTo, 254);
  const subject = sanitiseHeaderText(p.subject ?? p.Subject, 500);

  const text = p.text ?? p.plain ?? p.bodyPlain ?? p["body-plain"] ?? p.body;
  const html = p.html ?? p.bodyHtml ?? p["body-html"];
  const body = typeof text === "string" && text.trim()
    ? sanitiseBodyText(text)
    : htmlToText(html);

  const references = sanitiseHeaderText(p.references ?? p.References, 2000);
  const inReplyTo = sanitiseHeaderText(p.inReplyTo ?? p["in-reply-to"] ?? p.InReplyTo, 500);
  const providerId = sanitiseHeaderText(
    p.messageId ?? p["message-id"] ?? p.MessageId ?? p.providerId,
    200,
  );

  const token = extractReplyToken({
    explicit: typeof p.replyToken === "string" ? p.replyToken : undefined,
    to,
    replyTo,
    references,
    inReplyTo,
    subject,
    body,
  });

  return {
    token,
    fromAddress: from,
    toAddress: to,
    subject,
    body,
    providerId: providerId || null,
    sentAt: parseSentAt(p.date ?? p.Date ?? p.sentAt ?? p.timestamp),
  };
}

/**
 * The provider's own timestamp, when there is a usable one.
 *
 * Returns null rather than new Date() so the caller decides — the same
 * discipline SalesCommissionEntry.occurredAt follows with Stripe's event time.
 * A date far in the future is refused: a forwarded message claiming 2085 would
 * sit permanently at the top of every thread.
 */
export function parseSentAt(value, now = new Date()) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const skewMs = 24 * 60 * 60 * 1000;
  if (date.getTime() > now.getTime() + skewMs) return null;
  // Nothing in this product predates FieldQuo; a 1970 epoch is a parse failure
  // wearing a valid date's clothes.
  if (date.getFullYear() < 2020) return null;
  return date;
}

// ── Scoping ────────────────────────────────────────────────────────────────
//
// ══ Why these are functions and not inline where clauses ══════════════════
//
// A rep's lead list is not a filter behind a tenant boundary — it IS the
// boundary, the same argument lib/sales/scope.js makes about a rep's company
// list. There is no companyId in scope to fall back on. A missing salesRepId
// does not narrow a query slightly; it hands one rep another rep's prospects,
// their notes, and the contents of their conversations.
//
// So the fragment is built in one place, it never returns `{}`, and an
// unusable rep id collapses to the `__none__` sentinel that lib/sales/scope.js
// and assignedJobWhere already use — no cuid can equal it, so the query
// matches nothing rather than everything. scripts/check-sales-outreach.mjs
// executes these against empty, null and object rep ids, and separately
// asserts that no route under /api/sales builds its own where clause instead.

function scopedRepId(salesRepId) {
  return typeof salesRepId === "string" && salesRepId.length > 0
    ? salesRepId
    : "__none__";
}

/** One lead of this rep's, by id. Both halves required. */
export function leadWhere(salesRepId, leadId) {
  return {
    id: typeof leadId === "string" && leadId ? leadId : "__none__",
    salesRepId: scopedRepId(salesRepId),
  };
}

/** Every lead of this rep's, optionally at one status. */
export function leadListWhere(salesRepId, status) {
  return {
    salesRepId: scopedRepId(salesRepId),
    ...(isLeadStatusValue(status) ? { status } : {}),
  };
}

/** One thread of this rep's, by id. */
export function threadWhere(salesRepId, threadId) {
  return {
    id: typeof threadId === "string" && threadId ? threadId : "__none__",
    salesRepId: scopedRepId(salesRepId),
  };
}

/** Every thread of this rep's. */
export function threadListWhere(salesRepId) {
  return { salesRepId: scopedRepId(salesRepId) };
}
