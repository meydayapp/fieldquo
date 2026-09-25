// lib/i18n/companyText.js
//
// The Company-level texts a CLIENT reads, and how a document in another
// language gets the company's own wording in that language.
//
// ── The closed list ─────────────────────────────────────────────────────────
//
// Every key here is a sentence the company typed once in Settings that is
// then printed, mailed or texted to a stranger: the payment terms on every
// quote and invoice, "what happens next", the proposal's "About us", and the
// three custom SMS wordings. Adding a key here is what makes a field
// auto-translate on save (lib/i18n/autoTranslate.js reads COMPANY_TEXT_KEYS)
// and appear on /app/settings/translations — nowhere else has a list.
//
// ── The reader's contract: a translation is used only for the text it was
//    drafted from ────────────────────────────────────────────────────────────
//
// `CompanyTextTranslation.sourceHash` is the hash of the source text at the
// moment the row was written. localiseCompanyText() compares it with the hash
// of the text the company has NOW and ignores any row that does not match.
// So there is no "stale" flag to forget to set: the company edits its terms,
// every old row stops applying in the same instant, and until the fresh draft
// lands the client reads the source language. A translation of a sentence the
// company no longer says is the one thing this must never print.
//
// The fallback is the whole source text, never an empty string and never a
// mix: a French quote either gets French payment terms or the English ones
// the company wrote, and the section renders exactly as it did before this
// file existed.
//
// ── Not a document translator ───────────────────────────────────────────────
//
// AGENTS.md non-negotiable 6 holds. Nothing here touches Quote.processNotes
// once a quote exists: the quote creation route copies the company default
// IN THE QUOTE'S LANGUAGE (localised through here) and from then on the quote
// keeps its own words. The translation is picked at the moment a document is
// created or rendered from the company record, exactly where the source text
// was already being read.

import { SMS_TEMPLATE_TYPES } from "@/lib/sms/renderTemplate";
import { sourceHash } from "./sourceHash";
import { loadPhrases } from "./phrases";

// Re-exported: every existing importer reads it from here.
export { sourceHash };

const str = (v) => (typeof v === "string" ? v : "");

/** The three custom SMS wordings, as "smsTemplates.<type>" keys. */
const SMS_KEYS = Object.entries(SMS_TEMPLATE_TYPES)
  .filter(([, spec]) => spec.editable)
  .map(([type, spec]) => ({
    key: `smsTemplates.${type}`,
    labelKey: spec.labelKey,
    label: spec.label,
    kind: "sms",
    maxChars: 600,
    get: (company) => str(company?.smsTemplates?.[type]),
    set: (company, text) => ({
      ...company,
      smsTemplates: { ...(company?.smsTemplates || {}), [type]: text },
    }),
  }));

/**
 * key → how to read it off a Company row, how to put a translation back, and
 * what the review screen calls it. `kind` steers the drafting prompt: terms
 * and process notes are printed on a document a client signs, a story is
 * marketing prose, an SMS must keep its {tokens} exactly.
 */
export const COMPANY_TEXT_KEYS = Object.freeze([
  {
    key: "paymentTerms",
    labelKey: "app.translations.key.paymentTerms",
    label: "Payment terms",
    kind: "terms",
    maxChars: 4000,
    get: (c) => str(c?.paymentTerms),
    set: (c, text) => ({ ...c, paymentTerms: text }),
  },
  {
    key: "defaultProcessNotes",
    labelKey: "app.translations.key.defaultProcessNotes",
    label: "What happens next",
    kind: "terms",
    maxChars: 8000,
    get: (c) => str(c?.defaultProcessNotes),
    set: (c, text) => ({ ...c, defaultProcessNotes: text }),
  },
  {
    key: "storyHeadline",
    labelKey: "app.translations.key.storyHeadline",
    label: "Story headline",
    kind: "story",
    maxChars: 160,
    get: (c) => str(c?.storyHeadline),
    set: (c, text) => ({ ...c, storyHeadline: text }),
  },
  {
    key: "story",
    labelKey: "app.translations.key.story",
    label: "Your story",
    kind: "story",
    maxChars: 4000,
    get: (c) => str(c?.story),
    set: (c, text) => ({ ...c, story: text }),
  },
  ...SMS_KEYS,
]);

const BY_KEY = new Map(COMPANY_TEXT_KEYS.map((k) => [k.key, k]));

export function companyTextKey(key) {
  return BY_KEY.get(key) || null;
}

/**
 * The texts a Company row currently carries, keyed — only the non-empty
 * ones. What autoTranslateOnSave receives after a settings save, and what
 * the review screen lists as sources.
 */
export function companyTextFields(company) {
  const out = {};
  for (const k of COMPANY_TEXT_KEYS) {
    const text = k.get(company).trim();
    if (text) out[k.key] = text;
  }
  return out;
}

/**
 * The rows that apply to ONE language, in a shape the resolvers below read:
 * { key: { text, sourceHash, status, reviewedAt } }. Pending rows carry no
 * text and are left out here; the review screen reads them separately.
 */
export async function loadCompanyTextTranslations(db, companyId, language) {
  if (!db || !companyId || !language) return {};
  const rows = await db.companyTextTranslation.findMany({
    where: { companyId, language, status: { in: ["drafted", "reviewed"] } },
    select: { key: true, language: true, text: true, sourceHash: true, sourceLanguage: true, status: true, reviewedAt: true },
  });
  const out = {};
  for (const r of rows) {
    if (typeof r.text === "string" && r.text.trim()) out[r.key] = r;
  }
  return out;
}

/**
 * A copy of `company` with each text replaced by its translation WHEN the
 * translation was drafted from the text the row holds now. Pure: the check
 * script runs it against a stale row, an empty row and a matching one.
 *
 * The SMS keys are folded back into `smsTemplates` so renderMessage's
 * callers can hand the localised object straight through; see
 * smsTemplateTranslations() for the per-type map the SMS path prefers.
 */
export function localiseCompanyText(company, translations) {
  if (!company || !translations || typeof translations !== "object") return company;
  let out = company;
  for (const k of COMPANY_TEXT_KEYS) {
    const row = translations[k.key];
    if (!applies(row)) continue;
    const current = k.get(company).trim();
    if (!current) continue;
    if (row.sourceHash !== sourceHash(current)) continue;
    out = k.set(out, row.text);
  }
  return out;
}

/**
 * A row that may stand in for the source. Since detection (2026-09-25) a row
 * records the language its source was found to be written in; a row IN that
 * language — "translated" from French into French, written before anyone
 * knew the text was French — is never printed: the source itself is.
 */
function applies(row) {
  if (!row || typeof row.text !== "string" || !row.text.trim()) return false;
  if (row.sourceLanguage && row.language && row.sourceLanguage === row.language) return false;
  return true;
}

/**
 * The company row as a document in `language` should read it.
 *
 * One indexed read per render, including in the company's own default
 * language. Until detection that case returned the row untouched with no
 * query — which is exactly how an English-default company's French story
 * printed in French on every English quote: "the default needs no
 * translation" assumed the text was written in the default. A row for the
 * default language now exists only when the source was detected in another
 * one, so for a monolingual company the read finds nothing and the row comes
 * back as it went in. No texts at all still costs no query.
 */
export async function localisedCompany(db, company, { companyId, language } = {}) {
  if (!company) return company;
  const id = companyId || company.id;
  const lang = String(language || "").toLowerCase();
  if (!id || !lang) return company;
  // The quote email's two company lists ride on the same row: gallery
  // captions (quoteEmailBeforeAfter, filled from the one gallery) and
  // reference notes. Short texts of their own, drafted as phrases
  // (lib/i18n/phrases.js) and put back here, so every email/PDF path that
  // already localises the company gets them without a second call site.
  const pairs = Array.isArray(company.quoteEmailBeforeAfter) ? company.quoteEmailBeforeAfter : null;
  const refs = Array.isArray(company.quoteEmailReferences) ? company.quoteEmailReferences : null;
  const phraseEntries = [
    ...(pairs || []).map((p) => ({ ns: "galleryCaption", text: p?.caption })),
    ...(refs || []).map((r) => ({ ns: "referenceNote", text: r?.note })),
  ].filter((e) => typeof e.text === "string" && e.text.trim());
  const hasTexts = COMPANY_TEXT_KEYS.some((k) => k.get(company).trim());
  if (!hasTexts && !phraseEntries.length) return company;
  try {
    const [translations, tr] = await Promise.all([
      hasTexts ? loadCompanyTextTranslations(db, id, lang) : {},
      loadPhrases(db, id, lang, phraseEntries),
    ]);
    let out = hasTexts ? localiseCompanyText(company, translations) : company;
    if (phraseEntries.length) {
      out = {
        ...out,
        ...(pairs ? { quoteEmailBeforeAfter: pairs.map((p) => (p?.caption ? { ...p, caption: tr("galleryCaption", p.caption) } : p)) } : {}),
        ...(refs ? { quoteEmailReferences: refs.map((r) => (r?.note ? { ...r, note: tr("referenceNote", r.note) } : r)) } : {}),
      };
    }
    return out;
  } catch (err) {
    // A metering or connection hiccup must not turn a working PDF into a 500:
    // the source language is the documented fallback.
    console.error("[companyText] translations not loaded:", err?.message);
    return company;
  }
}

/**
 * { <smsType>: translatedText } for one language, only for wordings whose
 * translation matches the company's current custom text. What the three SMS
 * send paths hand to renderMessage as `translatedTemplates`.
 */
export function smsTemplateTranslations(company, translations, { language = null, sourceLanguages = null } = {}) {
  const out = {};
  if (!company?.smsTemplates || !translations) return out;
  for (const k of SMS_KEYS) {
    const current = k.get(company).trim();
    if (!current) continue;
    const type = k.key.slice("smsTemplates.".length);
    // The reader reads the language the wording was DETECTED in: the
    // company's own words, handed over as that reader's wording. Without
    // this a French reader of a French-written wording at an English-default
    // company got the built-in French, because renderMessage only uses the
    // custom text for a reader in the company's default language.
    const src = sourceLanguages?.[k.key];
    if (language && src && src.language === language && src.sourceHash === sourceHash(current)) {
      out[type] = current;
      continue;
    }
    const row = translations[k.key];
    if (!applies(row)) continue;
    if (row.sourceHash !== sourceHash(current)) continue;
    out[type] = row.text;
  }
  return out;
}

/**
 * { key: { language, sourceHash } } — the language each company text was
 * detected in, off the rows drafted from it. Only rows that recorded one
 * (since 2026-09-25); a text never detected is absent and is assumed to be
 * in the company's default language.
 */
export async function loadTextSourceLanguages(db, companyId) {
  if (!db || !companyId) return {};
  const rows = await db.companyTextTranslation.findMany({
    where: { companyId, sourceLanguage: { not: null } },
    select: { key: true, sourceHash: true, sourceLanguage: true, updatedAt: true },
  });
  const out = {};
  for (const r of rows) {
    const seen = out[r.key];
    if (!seen || (r.updatedAt && seen.updatedAt && r.updatedAt > seen.updatedAt)) {
      out[r.key] = { language: r.sourceLanguage, sourceHash: r.sourceHash, updatedAt: r.updatedAt };
    }
  }
  return out;
}

/** One call for the SMS paths: the reader's language in, the map out. */
export async function loadSmsTemplateTranslations(db, company, { companyId, language } = {}) {
  const id = companyId || company?.id;
  const lang = String(language || "").toLowerCase();
  if (!id || !lang || !company?.smsTemplates) return {};
  try {
    const [translations, sourceLanguages] = await Promise.all([
      loadCompanyTextTranslations(db, id, lang),
      loadTextSourceLanguages(db, id),
    ]);
    return smsTemplateTranslations(company, translations, { language: lang, sourceLanguages });
  } catch (err) {
    console.error("[companyText] sms translations not loaded:", err?.message);
    return {};
  }
}
