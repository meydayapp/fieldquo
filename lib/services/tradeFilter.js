// lib/services/tradeFilter.js
//
// Which service categories Settings › Services & pricing draws, given the
// search box, the company's trade preset and the "Show other trades" toggle.
//
// ══ The rule ════════════════════════════════════════════════════════════════
//
// The trade preset (categoryKeysForIndustries of the industries picked at
// signup) narrows the CATALOGUE — the ~60 system categories a company has
// not switched on — so a cabinet maker is not handed a wall of pool-cleaning
// rows to scroll past. It never hides a category the company HAS switched on.
//
// It did. TrueFinish (a cabinet company) had Roofing and Siding enabled, and
// the owner only found them after pressing "Show other trades": "all of the
// ones I have selected should already be displayed in Services & pricing".
// An enabled category is a statement the company made, exactly like a custom
// category, so both pass the trade filter unconditionally. Search still
// narrows everything — a search is the person asking for less.
//
// Pure, so scripts/check-services-trade-filter.mjs executes it rather than
// reading the component.

function matchesSearch(category, query) {
  if (!query) return true;
  return String(category?.label || "").toLowerCase().includes(query);
}

/**
 * Whether the trade preset alone keeps this category off screen (search is
 * not considered). Custom and enabled categories never are; with no preset
 * or the toggle on, nothing is.
 */
export function hiddenByTradePreset(category, { showAllTrades = false, presetKeys = [] } = {}) {
  if (!category?.isSystem) return false;
  if (category.enabled) return false;
  if (showAllTrades || !Array.isArray(presetKeys) || presetKeys.length === 0) return false;
  return !presetKeys.includes(category.key);
}

/** The categories to render, in their original order. */
export function filterServiceCategories(categories, { search = "", showAllTrades = false, presetKeys = [] } = {}) {
  const q = String(search || "").trim().toLowerCase();
  return (Array.isArray(categories) ? categories : []).filter(
    (c) => matchesSearch(c, q) && !hiddenByTradePreset(c, { showAllTrades, presetKeys }),
  );
}

/**
 * How many categories the toggle would reveal — only disabled system
 * categories outside the preset, so "Show other trades" never promises rows
 * that are already on screen.
 */
export function countHiddenByTradePreset(categories, { presetKeys = [] } = {}) {
  return (Array.isArray(categories) ? categories : []).filter((c) =>
    hiddenByTradePreset(c, { showAllTrades: false, presetKeys }),
  ).length;
}
