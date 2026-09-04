// lib/platform/serviceCategoryKey.js
//
// What makes a service-category key legal, in the one place both halves read.
//
// The key is referenced in code (seedStandardAddOns, quote types), so it has to
// be stable, lowercase and underscore-separated. That rule was enforced in
// app/api/platform/service-categories/route.js and described — in prose, as
// "Lowercase, underscores only" — in the form. Prose and a regex drift, and
// when they do it is the form that is wrong, because the form is the half
// nobody re-reads.
//
// Shared so the console can refuse a bad key BEFORE the click, with the same
// message the server would have sent after it.

export const CATEGORY_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const CATEGORY_KEY_RULE =
  "Key must be lowercase letters, numbers and underscores, starting with a " +
  "letter (e.g. cabinet_refinishing).";

export function isValidCategoryKey(key) {
  return typeof key === "string" && CATEGORY_KEY_PATTERN.test(key);
}

/** The auto-derivation the form does as you type a label. */
export function categoryKeyFromLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
