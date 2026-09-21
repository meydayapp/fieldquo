// lib/quotes/richText.js
//
// The one rich-text format a quote line may carry, and the three renderings
// of it: HTML (email, escaped), plain text (the .txt alternative and any
// reader that wants sentences), and a block/run tree the PDF and the React
// pages draw themselves.
//
// ── Why a five-rule markdown subset and not HTML ────────────────────────────
//
// The library's blocks want bold, italic, two kinds of list and a link. A
// stored HTML body would have to be sanitised on every path a browser can
// reach it by — the builder, the settings page, the PATCH route, the public
// approval page, the covering email, the PDF — and the PDF cannot render HTML
// at all (@react-pdf draws Text nodes). Storing the subset instead means no
// path ever turns a string into markup: the parser only ever emits text runs,
// so `<script>` in a body is the eleven characters "<script>" on the page,
// the email and the PDF alike. This is the same decision
// app/components/hr/PolicyBody.js took for policies, with lists and links
// added because a scope paragraph needs them and a policy did not.
//
// The subset, and nothing else:
//
//   paragraph        one or more lines, separated by a blank line
//   - item / * item  bullet list (consecutive lines)
//   1. item          numbered list (consecutive lines; any number)
//   **bold**   _italic_ or *italic*   [text](https://…)
//
// Links keep only http, https and mailto. A `javascript:` link is printed as
// its own text, never as a link — the words survive, the payload does not.
//
// Pure: no React, no DOM, no @react-pdf. app/components/quotes/RichTextBody.js
// and lib/documentSections/richTextPdf.js draw the tree this returns;
// scripts/check-quote-text-blocks.mjs executes every function here against
// hostile input.

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/**
 * Inline runs for one line: [{ text, bold, italic, href }].
 *
 * One pass over the tokens rather than nested regexes: bold and italic
 * markers toggle state, a link is consumed whole. Unbalanced markers are
 * printed as the characters they are — a stray "**" in a price note must not
 * eat the rest of the paragraph.
 */
export function parseInline(text) {
  const src = String(text ?? "");
  const runs = [];
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = () => {
    if (!buf) return;
    runs.push({ text: buf, bold, italic, href: null });
    buf = "";
  };

  let i = 0;
  while (i < src.length) {
    // [text](href)
    if (src[i] === "[") {
      const close = src.indexOf("](", i + 1);
      const end = close >= 0 ? src.indexOf(")", close + 2) : -1;
      if (close > i && end > close) {
        const label = src.slice(i + 1, close);
        const href = src.slice(close + 2, end).trim();
        if (label && href && !/[\s<>"]/.test(href) && SAFE_LINK.test(href)) {
          flush();
          runs.push({ text: label, bold, italic, href });
          i = end + 1;
          continue;
        }
        // Not a link we honour: the label is still the words the author
        // typed. The href is dropped, not printed — "click here (javascript:…)"
        // on a quote is neither a link nor a sentence.
        if (label && href && !/[\s<>"]/.test(href)) {
          buf += label;
          i = end + 1;
          continue;
        }
      }
    }
    // Opening bold needs a closing pair ahead of it; closing bold is the
    // pair itself. Asking the closer for a further closer left every
    // "**Asbestos:**" bold to the end of the line.
    if (src.startsWith("**", i) && (bold || hasClosing(src, i + 2, "**"))) {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if ((src[i] === "_" || src[i] === "*") && !src.startsWith("**", i)) {
      const marker = src[i];
      // A marker inside a word ("snake_case", "2*4") is punctuation, not
      // emphasis. Emphasis opens after a non-word character and closes before
      // one, which is how people actually type it.
      const prev = i > 0 ? src[i - 1] : " ";
      const next = src[i + 1] ?? " ";
      const opens = !italic && /[\s(]/.test(prev) && !/\s/.test(next);
      const closes = italic && !/\s/.test(prev);
      if ((opens && hasClosing(src, i + 1, marker)) || closes) {
        flush();
        italic = !italic;
        i += 1;
        continue;
      }
    }
    buf += src[i];
    i += 1;
  }
  flush();
  // An emphasis left open is text, not formatting. The runs already carry
  // the flag; strip it so a dangling "_" does not italicise a paragraph.
  return mergeRuns(runs);
}

function hasClosing(src, from, marker) {
  const at = src.indexOf(marker, from);
  return at > from;
}

/** Adjacent runs with identical styling become one — fewer Text nodes. */
function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic && last.href === r.href) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/**
 * The block tree: [{ kind: "p", runs }, { kind: "ul"|"ol", items: [runs] }].
 *
 * Lines inside a paragraph are kept as separate runs joined by "\n" — an
 * estimator who typed three steps on three lines gets three lines, exactly
 * as the plain `detail` field has always rendered (whitespace-pre-line).
 */
export function parseRichText(body) {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  let list = null;

  const flushPara = () => {
    if (!para.length) return;
    const runs = [];
    para.forEach((line, i) => {
      if (i > 0) runs.push({ text: "\n", bold: false, italic: false, href: null });
      runs.push(...parseInline(line));
    });
    blocks.push({ kind: "p", runs });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push(parseInline((ul || ol)[1]));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** True when the body uses any of the subset — the renderers' fast path. */
export function hasRichText(body) {
  const s = String(body ?? "");
  return /\*\*|(^|\s)[_*]\S|\[[^\]]+\]\([^)]+\)|^\s*([-*•]|\d+[.)])\s+/m.test(s);
}

/** Sentences only — for the plain-text email and anything that counts words. */
export function richTextToPlain(body) {
  return parseRichText(body)
    .map((b) => {
      if (b.kind === "p") return b.runs.map((r) => r.text).join("");
      return b.items
        .map((runs, i) => `${b.kind === "ol" ? `${i + 1}.` : "•"} ${runs.map((r) => r.text).join("")}`)
        .join("\n");
    })
    .join("\n\n");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escaped HTML for an email body. Every character of the author's text goes
 * through escapeHtml; the only tags emitted are the ones this function
 * writes. `linkColor` is the email theme's accent so a link on the
 * company's wash is measured, not guessed.
 */
export function richTextToHtml(body, { linkColor = "#1a1a1a", font = "inherit" } = {}) {
  const runsHtml = (runs) =>
    runs
      .map((r) => {
        let t = escapeHtml(r.text).replace(/\n/g, "<br />");
        if (r.bold) t = `<strong>${t}</strong>`;
        if (r.italic) t = `<em>${t}</em>`;
        if (r.href) {
          t = `<a href="${escapeHtml(r.href)}" style="color:${escapeHtml(linkColor)};text-decoration:underline;">${t}</a>`;
        }
        return t;
      })
      .join("");
  return parseRichText(body)
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 6px;font-family:${font};">${runsHtml(b.runs)}</p>`;
      const tag = b.kind;
      return `<${tag} style="margin:0 0 6px;padding-left:18px;font-family:${font};">${b.items
        .map((runs) => `<li>${runsHtml(runs)}</li>`)
        .join("")}</${tag}>`;
    })
    .join("");
}

/**
 * Nothing but the subset survives this: HTML tags typed into a body are
 * kept as literal text (they are printed, not executed — see the header),
 * control characters go, and the body is capped so a pasted novel cannot
 * blow up a PDF. This is what the API routes store.
 */
export const MAX_BODY_CHARS = 6000;

export function sanitiseRichText(body) {
  return String(body ?? "")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[ --]/g, "")
    .slice(0, MAX_BODY_CHARS)
    .trim();
}
