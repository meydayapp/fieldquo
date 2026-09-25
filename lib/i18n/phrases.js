// lib/i18n/phrases.js
//
// The company's SHORT client-facing texts that live on rows of their own —
// a gallery caption, a document's title, an appointment type's name, a
// payment stage's label — drafted into the other document languages on save
// and read back by the surface that prints them.
//
// ── Why a second mechanism beside companyText.js ────────────────────────────
//
// companyText.js is a closed list of one text per company (the payment terms,
// the story). These are open-ended: a company has any number of captions and
// stages, created, renamed and deleted from half a dozen screens, and some
// are COPIED before they are printed (a schedule stage's label is snapshotted
// onto each job's JobPaymentStage). Keying a translation by the row would
// miss every copy. So a phrase is keyed by its namespace and the hash of its
// TEXT: `phrase:<ns>:<sha1-20>`. Any reader holding the text and a language
// finds the translation — the settings row, the job's copy, a website block
// — and a renamed caption simply has a new key, so a translation of words
// the company no longer uses can never be printed (the hash rule
// companyText.js relies on, by construction).
//
// Stored as CompanyTextTranslation rows like the company texts, drafted by
// lib/i18n/autoTranslate.js (model "phrase", FieldQuo-paid, per-company
// daily cap, language detection) — the one drafter, not a second one.
//
// ── Readers ──────────────────────────────────────────────────────────────────
//
// loadPhrases(db, companyId, language, [{ ns, text }]) → tr(ns, text): one
// indexed read for everything a render prints, then a lookup that returns
// the translation or, on any gap, the company's own text — never an empty
// string, never a row in the language the text is written in.

import { sourceHash } from "./sourceHash";

/** The namespaces a phrase may belong to, and the kind of prompt it gets. */
export const PHRASE_NAMESPACES = Object.freeze({
  galleryCaption: { kind: "title", label: "Before & after caption" },
  documentTitle: { kind: "title", label: "Document title" },
  documentSummary: { kind: "terms", label: "Document summary" },
  financingNote: { kind: "terms", label: "Financing note" },
  paymentStage: { kind: "title", label: "Payment stage" },
  customFieldLabel: { kind: "title", label: "Custom field label" },
  aiGreeting: { kind: "story", label: "AI employee greeting" },
  eventTypeName: { kind: "title", label: "Appointment type" },
  referenceNote: { kind: "title", label: "Reference note" },
  materialLabel: { kind: "title", label: "Instant-quote option" },
  templateLineName: { kind: "title", label: "Service line name" },
  templateLineDescription: { kind: "terms", label: "Service line description" },
  categoryLabel: { kind: "title", label: "Service name" },
});

const KEY = /^phrase:([A-Za-z]+):([0-9a-f]{20})$/;

export function phraseKey(ns, text) {
  return `phrase:${ns}:${sourceHash(String(text ?? "").trim())}`;
}

/** { ns, hash } for a phrase key, or null for anything else. */
export function parsePhraseKey(key) {
  const m = KEY.exec(String(key || ""));
  if (!m || !Object.prototype.hasOwnProperty.call(PHRASE_NAMESPACES, m[1])) return null;
  return { ns: m[1], hash: m[2] };
}

export function isPhraseKey(key) {
  return Boolean(parsePhraseKey(key));
}

/**
 * The `fields` a save hands the drafter: { [phraseKey]: text } for every
 * non-empty text of one namespace. Duplicates collapse (the same caption on
 * two pairs is one phrase).
 */
export function phraseFields(ns, texts) {
  if (!PHRASE_NAMESPACES[ns]) return {};
  const out = {};
  for (const raw of Array.isArray(texts) ? texts : [texts]) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text || text.length > 4000) continue;
    out[phraseKey(ns, text)] = text;
  }
  return out;
}

/**
 * Pure lookup over loaded rows: the translation of `text` in the rows'
 * language, or the text itself. Exported for the check script.
 */
export function phraseLookup(rows) {
  const byKey = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.text !== "string" || !r.text.trim()) continue;
    if (r.status && r.status !== "drafted" && r.status !== "reviewed") continue;
    // A row in the language its text was detected in is never printed.
    if (r.sourceLanguage && r.language && r.sourceLanguage === r.language) continue;
    const parsed = parsePhraseKey(r.key);
    if (!parsed || r.sourceHash !== parsed.hash) continue;
    byKey.set(r.key, r.text);
  }
  return (ns, text) => {
    const source = typeof text === "string" ? text : "";
    if (!source.trim()) return source;
    return byKey.get(phraseKey(ns, source)) || source;
  };
}

const identity = (ns, text) => text;

/**
 * Everything a render prints, in one read. `entries` is [{ ns, text }] —
 * the texts the render is about to print; returns tr(ns, text).
 *
 * No language, or nothing to look up → the identity, no query. A failure →
 * the identity too: the company's own words are the documented fallback, and
 * a connection hiccup must not turn a working quote into a 500.
 */
export async function loadPhrases(db, companyId, language, entries = []) {
  const lang = String(language || "").toLowerCase();
  const keys = [...new Set((entries || []).filter((e) => e && typeof e.text === "string" && e.text.trim() && PHRASE_NAMESPACES[e.ns]).map((e) => phraseKey(e.ns, e.text)))];
  if (!db || !companyId || !lang || !keys.length) return identity;
  try {
    const rows = await db.companyTextTranslation.findMany({
      where: { companyId, language: lang, key: { in: keys }, status: { in: ["drafted", "reviewed"] } },
      select: { key: true, language: true, text: true, sourceHash: true, sourceLanguage: true, status: true },
    });
    return phraseLookup(rows);
  } catch (err) {
    console.error("[phrases] translations not loaded:", err?.message);
    return identity;
  }
}

/**
 * { [language]: text } for one phrase in every language that has a draft —
 * for a payload a browser renders in a language only it knows (the booking
 * page picks the visitor's). Missing languages are simply absent.
 */
export async function loadPhraseTranslations(db, companyId, ns, texts) {
  const keys = [...new Set((texts || []).filter((t) => typeof t === "string" && t.trim()).map((t) => phraseKey(ns, t)))];
  if (!db || !companyId || !keys.length) return {};
  try {
    const rows = await db.companyTextTranslation.findMany({
      where: { companyId, key: { in: keys }, status: { in: ["drafted", "reviewed"] } },
      select: { key: true, language: true, text: true, sourceHash: true, sourceLanguage: true, status: true },
    });
    const out = {};
    for (const r of rows) {
      const parsed = parsePhraseKey(r.key);
      if (!parsed || r.sourceHash !== parsed.hash || !r.text?.trim()) continue;
      if (r.sourceLanguage && r.sourceLanguage === r.language) continue;
      (out[r.key] ||= {})[r.language] = r.text;
    }
    // Re-key by text for the caller.
    const byText = {};
    for (const t of texts || []) {
      if (typeof t !== "string" || !t.trim()) continue;
      const m = out[phraseKey(ns, t)];
      if (m) byText[t] = m;
    }
    return byText;
  } catch (err) {
    console.error("[phrases] translations not loaded:", err?.message);
    return {};
  }
}
