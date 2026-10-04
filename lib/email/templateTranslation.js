// lib/email/templateTranslation.js
//
// A company's own email template, in its client's language.
//
// ══ The owner's decision (2026-10-03) ══════════════════════════════════════
//
// "enable them to be in various language that matches the client's language
// too given that external communication is about client's preferred language
// but building it might be easier in the company's language". So:
//
//   1. A template (follow-up rule or campaign) is AUTHORED in one language —
//      the company's, recorded on DocumentTemplate.language.
//   2. For each other language, the company can have a TRANSLATION: drafted
//      once per template version by the model (lib/ai/provider.js, through
//      lib/email/templateTranslationStore.js), stored, and shown to the
//      company to review and edit. Nothing is used until a person approves it.
//   3. At send time a client whose language differs gets the APPROVED,
//      UP-TO-DATE translation for that language — and otherwise the original,
//      as written. A send is never held up for a translation, and nothing is
//      ever translated at send time: the words a client receives are words
//      somebody at the company read.
//
// "Which language is the client's" is lib/i18n/clientLanguage.js's answer,
// unchanged: a follow-up about a quote or an invoice goes out in the
// DOCUMENT's language (AGENTS.md non-negotiable 6 — the covering email matches
// the document), anything else in the client's saved language, then the
// company default.
//
// ══ Merge tokens are not words ═════════════════════════════════════════════
//
// {{clientName}}, {{quoteTotal}} and the rest are filled in by software; a
// translation that renamed, dropped or doubled one would greet nobody or
// print an empty price. So before a string reaches the model every token —
// and every other span that must come back byte-for-byte: HTML tags, links,
// email addresses, amounts of money already written out — is replaced by a
// numbered marker ⟦1⟧, ⟦2⟧…, and the reply is REFUSED unless every marker
// comes back exactly once and nothing else that looks like a token appears.
// The same rule holds a person's edit in the review screen: the {{tokens}} of
// a reviewed string must be exactly the source's.
//
// Pure: no database, no model, no node:crypto — the editor's panel imports it
// to preview a translation and to tell a stale one from a current one.

import { isSupported } from "@/app/i18n/languages";
import { contentHash } from "@/lib/i18n/contentHash";
import { sentModeOf } from "./templateBody.js";
import { DEFAULT_STAGE_KEYS, DEFAULT_LINE_ITEMS_TITLE } from "./renderTemplateSections.js";

// ── The money rule, in one place ────────────────────────────────────────────
//
// Who pays for drafting a translation is lib/ai/emailTranslationMeter.js's
// decision; the two thresholds it applies live here so the panel can state
// them without importing a server module.
//
// A translation is charged to the company's AI credit whenever the company
// HAS credit. Without credit, FieldQuo absorbs it — but only while one
// translated version costs no more than PER_VERSION_ABSORB_MAX_MICROS (the
// owner's 5¢) and the company's FieldQuo-paid translations this month stay
// under MONTHLY_ABSORB_CAP_MICROS. Past either, the company needs AI credit
// to translate; sending is never affected.
//
// The cap, worked: a typical 150–300-word email costs about 0.09–0.18¢ to
// translate on the standard model (lib/ai/emailTranslationMeter.js's header
// has the arithmetic). $1.00 a month is therefore ~550–1,100 translated
// versions — a company translating four campaigns a month into all seven
// other languages uses 28 of them (~4¢). Genuine use never meets it; a
// scripted Regenerate loop is bounded at $1 per company per month, and across
// 1,000 companies FieldQuo's worst case is $1,000 a month against a typical
// few cents each.

/** The owner's per-email line: 5¢, in millionths of a dollar. */
export const PER_VERSION_ABSORB_MAX_MICROS = 50_000;

/** What FieldQuo absorbs per company per calendar month: $1.00. */
export const MONTHLY_ABSORB_CAP_MICROS = 1_000_000;

/** Longer than this (translatable characters) and the template is not sent
 *  to the model in one call — the panel says so and nothing is charged. */
export const MAX_TRANSLATABLE_CHARS = 20_000;

/** Statuses a TemplateTranslation row can hold. */
export const TRANSLATION_STATUSES = Object.freeze(["draft", "approved"]);

/** The language a template is written in: its own, else the company's, else English. */
export function templateLanguageOf(template, company) {
  const own = String(template?.language || "").toLowerCase();
  if (own && isSupported(own)) return own;
  const co = String(company?.defaultLanguage || "").toLowerCase();
  if (co && isSupported(co)) return co;
  return "en";
}

// ── What in a template is words ─────────────────────────────────────────────

const CANVAS_TEXT_TYPES = new Set(["textbox", "i-text", "text"]);

/** True when a string has a letter in it once tokens and links are taken out. */
function hasWords(text) {
  const bare = String(text ?? "")
    .replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, " ")
    .replace(/<[^<>]*>/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ");
  return /\p{L}/u.test(bare);
}

function parseCanvas(doc) {
  if (!doc) return null;
  if (typeof doc === "string") {
    try {
      return JSON.parse(doc);
    } catch {
      return null;
    }
  }
  return typeof doc === "object" ? doc : null;
}

function blockKey(block, index) {
  return block?.id ? String(block.id) : `#${index}`;
}

/**
 * Every string a client reads in the body that is SENT (sentMode decides),
 * plus the subject — as [{ path, text }] in reading order.
 *
 * Left out on purpose: URLs (a link is not a word), the progress block's
 * stage names while they are still FieldQuo's defaults and the itemised
 * block's default title (both are drawn in the reader's language already),
 * and anything with no letters in it ("{{clientName}}" on its own, "—").
 */
export function extractStrings(template) {
  const out = [];
  const push = (path, text) => {
    if (typeof text === "string" && text.trim() && hasWords(text)) out.push({ path, text });
  };
  push("subject", template?.subject);

  if (sentModeOf(template) === "canvas") {
    const doc = parseCanvas(template?.canvas);
    const objects = Array.isArray(doc?.objects) ? doc.objects : [];
    objects.forEach((o, i) => {
      if (o && CANVAS_TEXT_TYPES.has(String(o.type || "").toLowerCase())) push(`canvas.${i}.text`, o.text);
    });
    return out;
  }

  const sections = Array.isArray(template?.sections) ? template.sections : [];
  sections.forEach((block, i) => {
    if (!block || typeof block !== "object") return;
    const k = blockKey(block, i);
    switch (block.type) {
      case "heading":
      case "text":
        push(`block.${k}.text`, block.text);
        break;
      case "button":
        push(`block.${k}.label`, block.label);
        break;
      case "image":
        push(`block.${k}.alt`, block.alt);
        break;
      case "lineItems":
        if (block.title !== DEFAULT_LINE_ITEMS_TITLE) push(`block.${k}.title`, block.title);
        break;
      case "progress":
        (Array.isArray(block.stages) ? block.stages : []).forEach((stage, si) => {
          if (!Object.prototype.hasOwnProperty.call(DEFAULT_STAGE_KEYS, String(stage ?? ""))) {
            push(`block.${k}.stages.${si}`, stage);
          }
        });
        break;
      default:
        break;
    }
  });
  return out;
}

/** Characters the model would be handed — what the estimate and the cap read. */
export function translatableChars(strings) {
  return (strings || []).reduce((n, s) => n + String(s.text || "").length, 0);
}

/**
 * The version a translation was drafted from. The template's language and
 * the body that is sent are part of it: a template switched from blocks to
 * canvas, or relabelled as written in French, has a different version even
 * when no word moved. Tuples, not objects — JSONB does not keep key order.
 */
export function templateSourceHash(template, language) {
  const strings = extractStrings(template);
  return contentHash([String(language || ""), sentModeOf(template), ...strings.map((s) => [s.path, s.text])]);
}

// ── Protecting what must not be translated ──────────────────────────────────

const MERGE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

// One pattern, alternatives in priority order. Every match becomes a marker.
//   merge token   {{clientName}}
//   HTML          <b>, </a>, <br/>, &nbsp;
//   link          https://…, www.…
//   email         office@example.com
//   money         $1,500 · 1 500 € · CHF 200 · 1.500,00 EUR
//   bracket       a literal ⟦ or ⟧ the company typed, so it cannot pose as a marker
const MONEY_CODES = "CHF|CAD|USD|EUR|GBP|AUD|NZD";
// An amount as people type it: grouped in threes by a comma, dot, apostrophe
// or any kind of space ("1,500", "1 500", "1.000", "1'000"), or ungrouped,
// with optional cents. A space only counts as grouping before exactly three
// digits, so "$5 and 10" protects "$5", not "$5 and 10".
const NUM = "(?:\\d{1,3}(?:[,.'\\u00a0\\u202f ]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
const PROTECT_RE = new RegExp(
  [
    "\\{\\{\\s*[a-zA-Z0-9_]+\\s*\\}\\}",
    "<\\/?[a-zA-Z][^<>]*>",
    "&(?:[a-zA-Z]+|#\\d+|#x[0-9a-fA-F]+);",
    "(?:https?:\\/\\/|www\\.)[^\\s<>\"']*[^\\s<>\"'.,;:!?)\\]]",
    "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    `(?:[$€£]|\\b(?:${MONEY_CODES})\\b)[\\u00a0\\u202f ]?${NUM}`,
    `${NUM}[\\u00a0\\u202f ]?(?:[$€£]|\\b(?:${MONEY_CODES})\\b)`,
    "[⟦⟧]",
  ].join("|"),
  "g",
);

const MARKER_RE = /⟦(\d+)⟧/g;

/**
 * Hide every protected span behind a numbered marker.
 * @returns {{ text: string, spans: string[] }} — spans[n-1] is what ⟦n⟧ stands for
 */
export function protectText(text) {
  const spans = [];
  const out = String(text ?? "").replace(PROTECT_RE, (m) => {
    spans.push(m);
    return `⟦${spans.length}⟧`;
  });
  return { text: out, spans };
}

/** Put the spans back. Only call on text that passed checkMarkers(). */
export function restoreText(text, spans) {
  return String(text ?? "").replace(MARKER_RE, (_, n) => spans[Number(n) - 1] ?? "");
}

/** The {{tokens}} in a string, as a sorted list (a multiset). */
export function mergeTokensOf(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(MERGE_TOKEN_RE)) out.push(m[1]);
  return out.sort();
}

function sameList(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Did the model hand back every marker exactly once, and nothing else?
 * @returns {null | { reason: string, detail?: string }}
 */
export function checkMarkers(output, spanCount) {
  const seen = new Map();
  for (const m of String(output ?? "").matchAll(MARKER_RE)) {
    const n = Number(m[1]);
    seen.set(n, (seen.get(n) || 0) + 1);
  }
  for (const [n, count] of seen) {
    if (n < 1 || n > spanCount) return { reason: "extra_token", detail: `⟦${n}⟧` };
    if (count > 1) return { reason: "duplicated_token", detail: `⟦${n}⟧` };
  }
  for (let n = 1; n <= spanCount; n++) {
    if (!seen.has(n)) return { reason: "dropped_token", detail: `⟦${n}⟧` };
  }
  // A bracket left over means a marker came back mangled ("⟦ 3⟧", "⟦3").
  const stripped = String(output ?? "").replace(MARKER_RE, "");
  if (/[⟦⟧]/.test(stripped)) return { reason: "altered_token" };
  return null;
}

/**
 * One translated string, verified and restored — or refused.
 *
 * @param source   the company's string, as written
 * @param output   the model's reply for it, still in markers
 * @returns {{ ok: true, text } | { ok: false, reason, detail? }}
 */
export function acceptModelString(source, output) {
  const { spans } = protectText(source);
  const reply = String(output ?? "");
  if (!reply.trim()) return { ok: false, reason: "empty" };
  // A reply many times the source is the model talking, not translating.
  if (reply.length > String(source).length * 6 + 400) return { ok: false, reason: "runaway" };
  const markerProblem = checkMarkers(reply, spans.length);
  if (markerProblem) return { ok: false, ...markerProblem };
  const restored = restoreText(reply, spans);
  // Belt and braces: the {{tokens}} of the result are exactly the source's.
  // A model that wrote a literal "{{clientName}}" instead of using its marker
  // would pass the marker check and add a token the company never wrote.
  if (!sameList(mergeTokensOf(restored), mergeTokensOf(source))) {
    return { ok: false, reason: "extra_token" };
  }
  return { ok: true, text: restored };
}

/**
 * A person's edit in the review screen: the {{tokens}} must be exactly the
 * source's (same names, same count). Wording, markup and how an amount the
 * company typed is written are theirs to change.
 * @returns {null | { reason, missing: string[], extra: string[] }}
 */
export function checkHumanEdit(source, edited) {
  const want = mergeTokensOf(source);
  const got = mergeTokensOf(edited);
  if (sameList(want, got)) return null;
  const missing = [...want];
  const extra = [];
  for (const t of got) {
    const i = missing.indexOf(t);
    if (i >= 0) missing.splice(i, 1);
    else extra.push(t);
  }
  return { reason: missing.length ? "dropped_token" : "extra_token", missing, extra };
}

// ── Applying an approved translation ────────────────────────────────────────

function setAtPath(template, path, value) {
  const parts = path.split(".");
  if (parts[0] === "subject") {
    template.subject = value;
    return;
  }
  if (parts[0] === "canvas") {
    const i = Number(parts[1]);
    if (template.canvas?.objects?.[i]) template.canvas.objects[i].text = value;
    return;
  }
  if (parts[0] === "block") {
    const key = parts[1];
    const sections = template.sections || [];
    const idx = key.startsWith("#") ? Number(key.slice(1)) : sections.findIndex((b) => String(b?.id) === key);
    const block = sections[idx];
    if (!block) return;
    if (parts[2] === "stages") {
      if (Array.isArray(block.stages)) block.stages[Number(parts[3])] = value;
      return;
    }
    block[parts[2]] = value;
  }
}

/**
 * Is this stored translation usable for this template, now, in this language?
 * @returns {null | string} — null when usable, else why not
 */
export function translationUnusableReason(template, translation, language, company = null) {
  if (!translation) return "none";
  if (translation.language !== language) return "language";
  if (translation.status !== "approved") return "not_approved";
  const source = templateLanguageOf(template, company);
  if (language === source) return "same_language";
  if (translation.sourceHash !== templateSourceHash(template, source)) return "stale";
  const strings = translation.strings && typeof translation.strings === "object" ? translation.strings : {};
  for (const s of extractStrings(template)) {
    const entry = strings[s.path];
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) return "incomplete";
    if (entry.src !== s.text) return "stale";
    if (checkHumanEdit(s.text, entry.text)) return "token_mismatch";
  }
  return null;
}

/**
 * The template a client in `language` is sent.
 *
 * The approved translation's words laid over a COPY of the template — the
 * layout, links, images, theme and the progress stage logic are the
 * template's own; only the strings change. Anything short of an approved,
 * current, complete, token-clean translation returns the original: the rule
 * the panel states is "no approved translation → the original", and a send is
 * never held up for one.
 *
 * @param translationsByLanguage  Map or object: language → TemplateTranslation row
 * @returns {{ template, translated: boolean, reason: string|null }}
 */
export function localizeTemplate(template, translationsByLanguage, language, company = null) {
  const lang = String(language || "").toLowerCase();
  const source = templateLanguageOf(template, company);
  if (!template || !lang || lang === source) return { template, translated: false, reason: lang === source ? "same_language" : "none" };
  const row =
    translationsByLanguage instanceof Map
      ? translationsByLanguage.get(lang)
      : translationsByLanguage && typeof translationsByLanguage === "object"
        ? translationsByLanguage[lang]
        : null;
  const why = translationUnusableReason(template, row, lang, company);
  if (why) return { template, translated: false, reason: why };
  const words = {};
  for (const s of extractStrings(template)) words[s.path] = row.strings[s.path].text;
  return { template: overlayStrings(template, words), translated: true, reason: null };
}

/**
 * A copy of the template with `words` ({ path: text }) laid over it — the
 * one place a path is written back. The send path reaches it only through
 * localizeTemplate's checks; the review screen calls it directly to preview
 * lines a person has not approved yet. The original is never mutated.
 */
export function overlayStrings(template, words) {
  const copy = structuredClone({
    ...template,
    sections: Array.isArray(template?.sections) ? template.sections : [],
    canvas: parseCanvas(template?.canvas),
  });
  for (const [path, text] of Object.entries(words || {})) {
    if (typeof text === "string") setAtPath(copy, path, text);
  }
  return copy;
}
