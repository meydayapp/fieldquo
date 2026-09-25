// app/data/checklistSeeds/_build.js
//
// The compact authoring format every file in this folder is written in, and
// the one place it is expanded into the shape lib/checklists/seedTemplates.js
// installs. Imports nothing, so scripts/check-checklist-templates.mjs loads
// the whole folder under plain node.
//
// ── The shape a checklist expands to ───────────────────────────────────────
//
//   seedKey          "fq.cl.<trade>.<slug>" — ours, stable, unique; stored on
//                    JobChecklistTemplate.seedKey so a re-run adds nothing twice
//   trades           ServiceCategory keys that get this list when switched on;
//                    ["*"] = every trade (the generic set)
//   autoAddFor       keys whose NEW jobs get it attached — the estimate type
//                    it accompanies, never every trade it is offered to
//   requiredToClose  false for every seed: the company flips it
//   phase            pre | during | post (lib/jobs/checklistItems.js)
//   name             { en, fr, es, it, de, uk, tl, pa }
//   sections         [{ title: {…8}, items: [{ type, required, label: {…8},
//                    options?: { en: [...], … } }] }]
//
// Item types are the template vocabulary of lib/jobs/checklistItems.js
// (ITEM_TYPE_TO_RESPONSE). Wording is FieldQuo's own; the structure (sections,
// value types, which items are required) follows what the per-trade
// checklists in Housecall Pro and Jobber showed, read for evidence only.

import { PA } from "./_pa.js";

/// The eight languages FieldQuo supports (lib/i18n/documentLabels.js). The
/// first seven are written inline, in this order, on every call below;
/// Punjabi is looked up from ./_pa.js by the English — see that file for why.
export const LANGS = ["en", "fr", "es", "it", "de", "uk", "tl", "pa"];
const INLINE = LANGS.filter((l) => l !== "pa");

export const CK = "check";
export const TX = "text";
export const NU = "number";
export const SE = "select";
export const MS = "multiselect";
export const SL = "stoplight";
export const PH = "photo";
export const SG = "signature";

/** Required flag, spelled short because it appears hundreds of times. */
export const R = true;
export const O = false;

const byLang = (arr) => ({
  ...Object.fromEntries(INLINE.map((lang, i) => [lang, arr[i]])),
  pa: PA[arr[0]],
});
const optionsByLang = (arrs) => ({
  ...Object.fromEntries(INLINE.map((lang, i) => [lang, arrs[i]])),
  pa: (arrs[0] || []).map((en) => PA[en]),
});

/** An item: type, required, then the label in the seven inline languages, LANGS order. */
export function I(type, required, ...labels) {
  return { type, required: !!required, label: byLang(labels) };
}

/** A select / multi-select item: `options` is seven arrays, one per inline language. */
export function IO(type, required, labels, options) {
  return { type, required: !!required, label: byLang(labels), options: optionsByLang(options) };
}

export function S(titles, items) {
  return { title: byLang(titles), items };
}

export function C(seedKey, { trades, autoAddFor = [], phase = "during" }, names, sections) {
  return { seedKey, trades, autoAddFor, requiredToClose: false, phase, name: byLang(names), sections };
}
