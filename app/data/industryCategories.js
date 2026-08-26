// app/data/industryCategories.js
//
// Industry ⇄ quote-type presets. The DECLARATION moved to
// lib/trades/catalog.js, where each trade names the industries that surface it
// alongside its label, its sort order and its instant estimator.
//
// ── Why it moved ────────────────────────────────────────────────────────────
//
// This file was one of four lists that each answered part of "what does this
// company sell", and no two agreed. A painter's Settings > Services showed the
// seven trades this file lists under `painting`, while Settings > Instant
// Quotes offered him roofing, parging, lawn mowing and junk removal — because
// that screen read a different list entirely, one with no relationship to
// anything a company had enabled. Splitting a trade's facts across files is
// what let the two drift; the catalogue holds them together now.
//
// The two exports below keep their exact names and shapes: app/signup/page.js
// and app/app/settings/services/page.js read them, and a company's stored
// `industries` array is unchanged, so every existing tenant resolves to the
// same preset it did before. scripts/check-trade-catalog.mjs asserts that
// set-for-set, per industry.

import {
  TRADE_CATALOG,
  categoryKeysForIndustries,
} from "@/lib/trades/catalog";

/**
 * { [industrySlug]: ServiceCategory.key[] } — derived, not typed again.
 *
 * A category belonging to more than one industry is normal and deliberate
 * (gutters are sold by roofers, handymen and window cleaners alike), so
 * resolving several industries unions and de-dupes.
 */
export const INDUSTRY_CATEGORY_KEYS = Object.entries(TRADE_CATALOG).reduce(
  (acc, [key, entry]) => {
    for (const slug of entry.industries) (acc[slug] ||= []).push(key);
    return acc;
  },
  {},
);

export { categoryKeysForIndustries };
