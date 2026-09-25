// lib/mailbox/text.js
//
// An email body → the text FieldQuo stores. Never markup.
//
// ══ Why not lib/sales/outreach.js's htmlToText ════════════════════════════
//
// That one is "deliberately crude" and is fed by a sales mailbox FieldQuo's
// own reps use. This is fed by every client a contractor has ever emailed,
// and by whatever those clients' mail programs and spammers produce, so it
// is hardened against the inputs scripts/check-mailbox.mjs throws at it: an
// unterminated <script>, a `>` inside a quoted attribute, comments that hide
// tags, numeric entities spelling `<script>`, bidi overrides that make
// "exe.pdf" read as "fdp.exe", and zero-width characters. The OUTPUT is
// rendered by React as text in every screen (never dangerouslySetInnerHTML),
// so markup that survives could never execute — this is about a readable
// record that says what the client said, and nothing it did not.
//
// ══ Each message once ═════════════════════════════════════════════════════
//
// Email quotes the whole history under every reply. Stored whole, a ten-
// message thread holds the first message ten times — the history timeline
// repeats itself and the conversation score and the monthly review (which
// read Message.body) count the same sentence ten times. So the stored body is
// what the person TYPED: the quoted tail is cut with lib/sales/emailQuote.js's
// splitQuoted (one rule for the sales inbox and this) and a signature after a
// "-- " delimiter goes with it. A message whose every line is quoted keeps
// its full text — a hidden sentence is a lost answer; a repeated one is only
// a nuisance.

import { splitQuoted } from "@/lib/sales/emailQuote";

/** Stored body cap. One forwarded chain must not be a 5 MB row. */
export const MAX_BODY_CHARS = 50_000;

const NAMED = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8}|#39);/gi, (m, code) => {
    const c = code.toLowerCase();
    if (c.startsWith("#x") || /^#\d/.test(c)) {
      const n = c.startsWith("#x") ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return "";
      return String.fromCodePoint(n);
    }
    return Object.prototype.hasOwnProperty.call(NAMED, c) ? NAMED[c] : m;
  });
}

/**
 * Characters that change how text LOOKS without being text: C0/C1 controls
 * (except tab and newline), bidi embeddings/overrides/isolates, zero-width
 * joiners and spaces, the BOM, and the soft hyphen.
 */
export function stripInvisible(s) {
  return String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/[​-‏‪-‮⁠-⁩﻿­]/g, "");
}

/** One header value (a subject, a name): one line, no controls, capped. */
export function cleanHeader(value, max = 500) {
  return stripInvisible(value).replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * HTML → text. Tolerant of garbage; never throws; no markup from the source
 * survives as markup (text that SAYS "<b>" — written as &lt;b&gt; — stays text).
 *
 * Order matters: comments and the content-bearing-but-invisible blocks go
 * first (a comment can contain what looks like a tag, and an unterminated
 * <style> would otherwise leak CSS into the body), then block-level breaks,
 * then every remaining tag — matched with quoted attribute values so a `>`
 * inside `title=">"` does not end the tag early — then entities, LAST, so an
 * entity-encoded `&lt;script&gt;` becomes the literal text "<script>" and is
 * shown as the text it is rather than re-parsed as markup.
 */
export function htmlToText(html) {
  let s = String(html ?? "");
  if (s.length > 2_000_000) s = s.slice(0, 2_000_000);
  s = s
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/gi, "")
    .replace(/<(script|style|head|title|template|noscript|svg|math|object|iframe)\b[\s\S]*?(<\/\1\s*>|$)/gi, "")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote|pre|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, "");
  // A lone "<" left by a broken tag ("<scr<b>ipt") is just text now.
  s = decodeEntities(s);
  s = stripInvisible(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.slice(0, MAX_BODY_CHARS);
}

/** A plain-text part, cleaned the same way minus the tag stripping. */
export function plainText(text) {
  return stripInvisible(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

/**
 * What the sender typed: the quoted history and a "-- " signature removed.
 * Falls back to the whole text when that would leave nothing.
 */
export function typedPart(text) {
  const full = String(text || "").trim();
  if (!full) return "";
  let { visible } = splitQuoted(full);
  // RFC 3676's signature delimiter, "-- " on a line of its own (some clients
  // trim the trailing space, so "--" alone counts too).
  const sig = visible.search(/\n-- ?\n/);
  if (sig >= 0) visible = visible.slice(0, sig);
  visible = visible.trim();
  return visible || full;
}

/**
 * The body to store for one parsed message: text/plain when the message has
 * a real one, else its HTML flattened; then the typed part.
 */
export function storedBody({ text, html }) {
  const base = typeof text === "string" && text.trim() ? plainText(text) : htmlToText(html || "");
  return typedPart(base);
}
