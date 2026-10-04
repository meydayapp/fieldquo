// lib/chat/linkify.js
//
// Which runs of a chat message are links, decided as DATA — the thread draws
// the anchors (app/components/chat/Thread.js); nothing here builds markup.
//
// ══ Why parts and not HTML ════════════════════════════════════════════════
//
// The obvious linkify is a regex replace into an HTML string handed to
// dangerouslySetInnerHTML. That makes every other byte of every message
// markup, and "escape the rest" becomes a promise this file would have to
// keep forever. Returning [{ text } | { text, href }] instead leaves the
// escaping where it already is — React's text nodes — so a body of
// `<img onerror=…>` can only ever draw as those characters.
//
// ══ What becomes a link ═══════════════════════════════════════════════════
//
// http:// and https:// only, and only when the URL parser agrees: an href is
// the parser's own `href`, so its scheme is checked on the parsed value, not
// on the text. javascript:, data:, vbscript:, file:, mailto: and a bare
// "www.x.com" stay text. A URL carrying a user:password@ is text too —
// "https://fieldquo.com@evil.example" is the oldest trick for showing one
// host and opening another, and nobody on a crew needs credentials in a
// link.
//
// Trailing punctuation belongs to the sentence, not the URL: "see
// https://x.com/a." links "https://x.com/a". A closing bracket is kept only
// when the URL opened one ("https://en.wikipedia.org/wiki/Foo_(bar)"), so
// "(https://x.com)" drops the ")" and the Wikipedia link keeps it.
//
// The work-order link "Share to team" posts for the crew
// (lib/quotes/shareWithStaff.js) is an absolute https URL on the app's own
// origin; it is the case this exists for. Pure.

const CANDIDATE = /https?:\/\/[^\s<>"'`]+/gi;

// Sentence punctuation that may trail a URL, Latin and CJK. Brackets are
// handled separately, by balance.
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "…", "'", "\"", "’", "”", "»", "。", "，", "、", "！", "？", "；", "："]);
const CLOSERS = { ")": "(", "]": "[", "}": "{" };

function count(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n += 1;
  return n;
}

/** The candidate with the sentence's punctuation taken back off its end. */
function trimTrailing(raw) {
  let s = raw;
  for (;;) {
    const last = s.slice(-1);
    if (TRAILING.has(last)) {
      s = s.slice(0, -1);
      continue;
    }
    const opener = CLOSERS[last];
    if (opener && count(s, last) > count(s, opener)) {
      s = s.slice(0, -1);
      continue;
    }
    return s;
  }
}

/** The parsed http(s) URL, or null for anything that must stay text. */
export function safeHref(candidate) {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (url.username || url.password) return null;
  return url.href;
}

/**
 * The message as runs: `{ text }` for words, `{ text, href }` for a link.
 * Joining every run's `text` gives back the input exactly — nothing is
 * dropped or rewritten in what the reader sees.
 */
export function linkParts(body) {
  const text = typeof body === "string" ? body : body == null ? "" : String(body);
  const out = [];
  let at = 0;
  const push = (t) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && !prev.href) prev.text += t;
    else out.push({ text: t });
  };
  for (const m of text.matchAll(CANDIDATE)) {
    const start = m.index;
    // A scheme glued to a word ("xhttps://…") is not the start of a link.
    // Latin script only: Chinese and Japanese put no space between words,
    // so "看这里https://…" is a sentence followed by a link.
    if (start > 0 && /[\p{Script=Latin}\p{N}_]/u.test(text[start - 1])) continue;
    const raw = trimTrailing(m[0]);
    const href = safeHref(raw);
    if (!href) continue;
    push(text.slice(at, start));
    out.push({ text: raw, href });
    at = start + raw.length;
  }
  push(text.slice(at));
  return out;
}
