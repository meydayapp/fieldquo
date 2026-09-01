// lib/costing/assetLifeSuggestions.js
//
// A starting point for "how many months will you get out of it" — never the
// answer.
//
// ══ Why this exists ═════════════════════════════════════════════════════════
//
// POST /api/assets requires usefulLifeMonths and refuses to default it (see
// that route and lib/accounting/depreciation.js's header) — inventing five
// years for a blank field is padding absent data with a default, and the
// output is a price floor. That refusal is correct and stays. What it left
// behind is a blank field with no help beside it: someone adding "ladder rack"
// has no idea whether to type 36 or 360.
//
// ══ Why this is a suggestion and never applied silently ════════════════════
//
// AGENTS.md failure class 5 again, from the other direction: a SUGGESTED
// number that gets written to the database without the person confirming it
// is exactly as invented as a hard-coded default, just with an extra click
// pretending otherwise. So this file only ever returns a number for the
// FORM to pre-fill — POST /api/assets never imports it, never reads
// Asset.category to backfill a life, and the pre-filled value is a normal,
// editable form field the person can change or clear before they submit.
//
// ══ Where these numbers come from, honestly ════════════════════════════════
//
// These are rough, commonly-cited planning figures for how long equipment
// classes typically last in field-service use — the kind of range a
// contractor's accountant or supplier catalogue would quote off the top of
// their head, not a figure taken from a specific tax schedule, manufacturer
// warranty, or regulatory table. Nothing here has been checked against CRA
// capital cost allowance classes, a specific manufacturer's spec sheet, or any
// other authority, and the UI must say so — see app.assets.categorySuggestion
// in app/i18n/appMessages.js. A company that knows their spray rig runs eight
// years, not five, should type eight; this list exists only so the blank
// field has a plausible place to start from.
export const ASSET_CATEGORIES = [
  { key: "vehicle", labelKey: "app.assets.category.vehicle", suggestedMonths: 60 },
  { key: "trailer", labelKey: "app.assets.category.trailer", suggestedMonths: 120 },
  { key: "power_tool", labelKey: "app.assets.category.powerTool", suggestedMonths: 48 },
  { key: "hand_tool", labelKey: "app.assets.category.handTool", suggestedMonths: 84 },
  { key: "ladder_scaffold", labelKey: "app.assets.category.ladderScaffold", suggestedMonths: 120 },
  { key: "spray_equipment", labelKey: "app.assets.category.sprayEquipment", suggestedMonths: 84 },
  { key: "compressor_generator", labelKey: "app.assets.category.compressorGenerator", suggestedMonths: 120 },
  { key: "measuring_electronic", labelKey: "app.assets.category.measuringElectronic", suggestedMonths: 36 },
  { key: "safety_equipment", labelKey: "app.assets.category.safetyEquipment", suggestedMonths: 60 },
  { key: "other", labelKey: "app.assets.category.other", suggestedMonths: null },
];

const BY_KEY = new Map(ASSET_CATEGORIES.map((c) => [c.key, c]));

export function isAssetCategory(key) {
  return BY_KEY.has(key);
}

/** The category row, or null for an unrecognised/blank key. */
export function assetCategory(key) {
  return BY_KEY.get(key) || null;
}

/**
 * The suggested usefulLifeMonths for a category, or null when there isn't one
 * (an unrecognised key, or "other"). Callers must treat null as "no
 * suggestion to offer" — never as zero months.
 */
export function suggestedLifeMonths(categoryKey) {
  return BY_KEY.get(categoryKey)?.suggestedMonths ?? null;
}
