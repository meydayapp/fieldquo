// lib/prepGuide/resolve.js
//
// The guide a client actually receives: the built-in one for the trade, or
// the company's own copy of it when they made one.
//
// ── The same precedence as serviceContent, for the same reason ──────────────
//
// A company that customised the guide under Settings > Services has it stored
// on CompanyServiceCategory.prepGuide, keyed by language. That copy wins for
// that language and only that language: a French copy does not change what
// English clients receive, and a company that never opened the screen gets
// the built-in guide in every language, improved every time this catalogue
// is. The built-in is never modified — "Reset to original" deletes the copy.
//
// ── What a company copy may contain ─────────────────────────────────────────
//
// The four sections of the built-in (checklist, warning, dayOf, afterCare)
// plus `notes`, a free paragraph for things only this company would say
// ("Park on Elm Street, the cul-de-sac is a fire route"). sanitisePrepGuideCopy
// is the boundary between what a browser sent and what is stored: lengths are
// capped, non-strings dropped, and an empty copy stores as null — which means
// "no copy", never "an empty guide".
//
// ── No imports beyond the catalogue, on purpose ─────────────────────────────
//
// scripts/check-prep-guide.mjs executes this file with fixtures; it must not
// pull in the database or the renderer.

import { builtInGuide, guideLanguage } from "@/lib/prepGuide/content";

export const MAX_ITEMS = 20;
export const MAX_ITEM_LEN = 400;
export const MAX_PARAGRAPH_LEN = 1200;

const clean = (v, max) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";

const cleanList = (v) =>
  Array.isArray(v)
    ? v
        .map((s) => clean(s, MAX_ITEM_LEN))
        .filter(Boolean)
        .slice(0, MAX_ITEMS)
    : [];

/**
 * One language's company copy, as stored. Null when there is nothing in it.
 */
export function sanitisePrepGuideCopy(input) {
  if (!input || typeof input !== "object") return null;
  const copy = {
    checklist: cleanList(input.checklist),
    warning: clean(input.warning, MAX_PARAGRAPH_LEN),
    dayOf: cleanList(input.dayOf),
    afterCare: clean(input.afterCare, MAX_PARAGRAPH_LEN),
    notes: clean(input.notes, MAX_PARAGRAPH_LEN),
  };
  const empty =
    !copy.checklist.length &&
    !copy.warning &&
    !copy.dayOf.length &&
    !copy.afterCare &&
    !copy.notes;
  return empty ? null : copy;
}

/**
 * Merge one language's copy into the stored map. `copy` null deletes the
 * language — that IS "Reset to original". Returns the next map, or null when
 * no language is left, so the column reads null rather than {}.
 */
export function withPrepGuideCopy(stored, language, copy) {
  const lang = guideLanguage(language);
  const next = { ...(stored && typeof stored === "object" ? stored : {}) };
  const sane = sanitisePrepGuideCopy(copy);
  if (sane) next[lang] = sane;
  else delete next[lang];
  return Object.keys(next).length ? next : null;
}

/**
 * The guide for one category, in one language, for one company.
 *
 * @param categoryKey  ServiceCategory.key (null → generic)
 * @param override     the CompanyServiceCategory row (needs `prepGuide`), or null
 * @param language     the CLIENT's language; the body falls back to English
 *                     for languages it is not written in
 */
export function resolvePrepGuide(categoryKey, override, language) {
  const original = builtInGuide(categoryKey, language);
  const stored = override?.prepGuide;
  const copy =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? sanitisePrepGuideCopy(stored[original.language])
      : null;

  if (!copy) {
    return { ...original, notes: "", customised: false, original };
  }
  // A company copy replaces the SECTIONS it filled and inherits the rest —
  // an office that only wanted to add two items to the checklist did not
  // mean to delete the after-care paragraph.
  return {
    guideKey: original.guideKey,
    language: original.language,
    checklist: copy.checklist.length ? copy.checklist : original.checklist,
    warning: copy.warning || original.warning,
    dayOf: copy.dayOf.length ? copy.dayOf : original.dayOf,
    afterCare: copy.afterCare || original.afterCare,
    notes: copy.notes || "",
    customised: true,
    original,
  };
}
