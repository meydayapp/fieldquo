// lib/quotes/builderLayout.js
//
// The two quote builders, by name, and how a company's choice is read.
//
// "document" is the document-shaped builder (mockup b7, approved 2026-09-21):
// the estimator edits the page the client will read. "classic" is the long
// form it replaced. The same QuoteBuilderForm renders both from the same
// state, saves through the same runSave, and posts the same body —
// scripts/check-doc-builder.mjs hashes that body under each layout and
// requires the bytes to match.
//
// Pure, no React: the platform PATCH validates against this list, the
// builder resolves the bootstrap through it, and the check script imports it.

export const QUOTE_BUILDER_LAYOUTS = Object.freeze(["document", "classic"]);

/** The column's default for a company created from now on. */
export const DEFAULT_QUOTE_BUILDER_LAYOUT = "document";

/**
 * Which layout to render for what business-info returned.
 *
 * An unknown or absent value resolves to "classic", not to the column
 * default: absence here means an older server (or a harness fixture written
 * before the flag) and the screen it knew is the safe one. The database
 * default only applies to a company that was created without the value.
 */
export function resolveBuilderLayout(value) {
  return QUOTE_BUILDER_LAYOUTS.includes(value) ? value : "classic";
}
