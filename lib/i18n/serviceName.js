// lib/i18n/serviceName.js
//
// A service's name as a client reads it, for BOTH kinds of ServiceCategory.
//
// Catalogue categories (companyId null — "Interior Painting") carry
// FieldQuo's own translations in `labelTranslations`, written once in the
// seed, and categoryLabel (lib/i18n/translateContent.js) reads them. A
// company's OWN category (companyId set — "Heritage window restoration",
// created in Settings › Services) has none: nothing writes its
// labelTranslations. Its name is drafted instead as a phrase when it is
// created (POST /api/settings/service-categories, namespace categoryLabel —
// lib/i18n/phrases.js), keyed by the hash of its text.
//
// ── Why a wrapper, not labelTranslations filled from the drafts ─────────────
//
// Copying drafts into the shared column would be a second store of the same
// translation, one that goes stale the day the name changes — the problem
// keying a phrase by its text exists to avoid. And categoryLabel returns the
// label untouched whenever the reader's language is its default ("en"), so a
// name a Quebec company typed in French would never reach an English reader
// through it. So catalogue rows keep going through categoryLabel exactly as
// before, and only a company's own row looks its phrase up.
//
// Pure: the caller loads the lookup (loadPhrases, or loadPhraseTranslations +
// phraseMapLookup when the language is only known later) and passes it in.

import { categoryLabel } from "./translateContent";

const isOwn = (category) => Boolean(category?.companyId) && typeof category?.label === "string" && Boolean(category.label.trim());

/**
 * The phrase entries for the company-owned categories in `categories`, for
 * loadPhrases. Catalogue rows are left out — they have no phrase and need no
 * query. Callers must select `companyId` on the category for this to see one.
 */
export function customCategoryPhrases(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter(isOwn)
    .map((c) => ({ ns: "categoryLabel", text: c.label }));
}

/**
 * The name to print. `tr` is a phrase lookup — (ns, text) → translation or
 * the text — from loadPhrases in `language`. Without one (or for a catalogue
 * row) this is categoryLabel, unchanged.
 */
export function serviceName(category, language, tr = null, defaultLanguage = "en") {
  if (!category) return "";
  if (isOwn(category) && typeof tr === "function") {
    // A company row that somehow carries its own labelTranslations (none do
    // today) keeps them: a stored, reviewed wording beats a draft.
    const stored = category.labelTranslations?.[language];
    if (typeof stored === "string" && stored.trim()) return stored;
    return tr("categoryLabel", category.label);
  }
  return categoryLabel(category, language, defaultLanguage);
}

/**
 * A phrase lookup over loadPhraseTranslations' `{ [text]: { [lang]: text } }`
 * for one language — for a loader that reads before the language is
 * resolved (the prep guide resolves it in its pure builder). Same contract
 * as loadPhrases' tr: the translation, or the text itself, never empty.
 */
export function phraseMapLookup(byText, language) {
  return (ns, text) => {
    const source = typeof text === "string" ? text : "";
    if (!source.trim() || !language) return source;
    const hit = byText && typeof byText === "object" ? byText[source]?.[language] : null;
    return typeof hit === "string" && hit.trim() ? hit : source;
  };
}
