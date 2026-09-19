// lib/products/presetTranslations.js
//
// Presets ship translated; the translations page lists only what is custom.
//
// ── The owner's complaint ───────────────────────────────────────────────────
//
// "I don't think we have the translations of all the preset items in
// /app/settings/translations for the default services and products and
// add-ons. Anything in that page should be things that don't yet have
// translations, like custom services."
//
// The seeded standard add-ons (lib/products/seedStandardAddOns.js) were
// written with a French translation and nothing else, and with no mark that
// said where the French came from — so on the page they counted as
// "drafted, not read" in French and as "missing" in every other language,
// and a company was asked to translate "Soft-Close Hinges" into Punjabi on
// FieldQuo's behalf.
//
// ── The mark ────────────────────────────────────────────────────────────────
//
// A translation written from the catalogue carries two fields beside name
// and description:
//
//   source: "catalogue"   it came from app/data/standardAddOns.{fr,i18n}.js
//   of:     "<English>"   the English NAME it is a translation of
//
// `reviewed: true` as well, because it was — by whoever wrote the catalogue.
// `of` is what makes a RENAME visible: a company that renames the seeded
// "Travel Fee" to "Travel Fee (over 40 km)" has a catalogue translation that
// no longer says what the English says, and the page shows that row again,
// flagged, until they read it. A company that edits the translation by hand
// saves through the page's PATCH, which writes without `source`, and the row
// is theirs from then on.
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// No database here. planPresetTranslationBackfill takes rows and returns the
// rows to write; scripts/backfill-preset-translations.mjs does the reading
// and writing and scripts/check-preset-translations.mjs proves the plan is
// idempotent and never touches a translation a person reviewed.

import {
  STANDARD_ADDONS_FR,
  CATALOGUE_SOURCE,
  CATALOGUE_LANGUAGES,
  catalogueEntry,
  standardAddOnTranslations,
} from "@/app/data/standardAddOns.fr";

export { CATALOGUE_SOURCE, CATALOGUE_LANGUAGES, catalogueEntry };

/** Every English preset name the catalogue knows. */
export const CATALOGUE_NAMES = Object.freeze(Object.keys(STANDARD_ADDONS_FR));

/**
 * Every catalogue language for one preset name — what a seeded row carries
 * from creation. Null for a name the catalogue does not know.
 */
export function catalogueTranslations(name, at = new Date()) {
  return standardAddOnTranslations(name, at);
}

/** Was this stored entry written from the catalogue (rather than by a person or the AI)? */
export function isCatalogueEntry(entry) {
  return Boolean(entry && typeof entry === "object" && entry.source === CATALOGUE_SOURCE);
}

/**
 * The page's verdict on one product in one language.
 *
 *   preset    a catalogue translation that still matches the product's
 *             English name — hidden from the page
 *   renamed   a catalogue translation of a name the product no longer has —
 *             shown, flagged, unreviewed
 *   missing   no usable translation
 *   reviewed  a person (or the catalogue, when current) has read it
 */
export function translationStatus(product, language) {
  const entry = product?.translations?.[language] || null;
  const hasName = Boolean(entry?.name);
  const missing = !hasName || (Boolean(product?.description) && !entry?.description);
  const fromCatalogue = isCatalogueEntry(entry);
  const current = fromCatalogue && entry.of === product?.name;
  return {
    preset: current && !missing,
    renamed: fromCatalogue && !current && hasName,
    missing,
    reviewed: current ? true : fromCatalogue ? false : Boolean(entry?.reviewed),
    reviewedAt: entry?.reviewedAt || null,
  };
}

/**
 * Which rows need writing, and what. Idempotent: a row already carrying
 * current catalogue entries in every language plans nothing.
 *
 * A language is written when the row has no entry for it, or when the entry
 * is the catalogue's own text without the mark (what the seeder wrote before
 * this file existed: French, unmarked, unreviewed). An entry a PERSON saved —
 * reviewed without a catalogue source — is never touched, whatever it says:
 * that is their wording, and it was seen on their quotes. An AI draft that
 * was never reviewed is replaced, because it was never read either.
 *
 * @param products  [{ id, name, translations }]
 * @returns [{ id, name, languages: [..], translations }]
 */
export function planPresetTranslationBackfill(products, at = new Date()) {
  const plan = [];
  for (const p of Array.isArray(products) ? products : []) {
    if (!p || !CATALOGUE_NAMES.includes(p.name)) continue;
    const stored = p.translations && typeof p.translations === "object" && !Array.isArray(p.translations) ? p.translations : {};
    const next = { ...stored };
    const languages = [];
    for (const lang of CATALOGUE_LANGUAGES) {
      const want = catalogueEntry(lang, p.name, at);
      if (!want) continue;
      const have = stored[lang];
      if (have && isCatalogueEntry(have) && have.of === p.name && have.name === want.name && (have.description || "") === want.description) continue;
      if (have && have.reviewed && !isCatalogueEntry(have)) continue; // a person's
      next[lang] = want;
      languages.push(lang);
    }
    if (languages.length) plan.push({ id: p.id, name: p.name, languages, translations: next });
  }
  return plan;
}
