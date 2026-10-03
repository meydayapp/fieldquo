// lib/planRead/catalogue.js
//
// The vocabulary a drawing read may use — the company's OWN painting and
// staining items, by key, with no price on any of them.
//
// The items are lib/pricing/paintTakeoff.js's substrates: the same keys the
// builder's paint takeoff prices, from the company's own book (its rate
// sets, production rates, hourly sell rate and paint costs —
// CompanyServiceCategory.rates over app/data/tradePriceBooks.js). So the
// model picks "walls" or "soffit_fascia" and a quantity source; the engine
// that prices every typed painting quote prices this one. Nothing in this
// file, and nothing the model sees, carries a dollar figure — the same rule
// lib/ai/callQuoteDraft.js's buildCatalogue keeps.
//
// Pure.

import { PAINT_SUBSTRATE_DEFAULTS, PAINT_PRODUCT_DEFAULTS } from "@/lib/pricing/paintTakeoff";

/** Wallpaper and the free-text "custom" line are not something a drawing
 *  read should draft; everything else the book prices is fair game. */
const EXCLUDED = new Set(["custom", "wallpaper_strip", "wallpaper_install"]);

/** Substrates priced under the EXTERIOR painting book. */
const EXTERIOR_KEYS = new Set(["siding_trim", "soffit_fascia", "garage_door", "stain_deck", "stain_fence", "stain_front_door"]);

/** Access and equipment a read may say a job needs. No rates exist for these
 *  in any price book today (see the report in this feature's commit), so a
 *  line for one is drafted UNPRICED and the estimator types their price. */
export const EQUIPMENT_KINDS = Object.freeze([
  "step_ladder",
  "extension_ladder",
  "scaffold",
  "scissor_lift",
  "boom_lift",
  "crane",
  "swing_stage",
]);

export const EQUIPMENT_LABELS = Object.freeze({
  step_ladder: "Step ladders",
  extension_ladder: "Extension ladders",
  scaffold: "Scaffolding",
  scissor_lift: "Scissor lift",
  boom_lift: "Boom lift",
  crane: "Crane",
  swing_stage: "Swing stage",
});

/** The keys a read may draft, in the book's order. */
export function planSubstrateKeys(book) {
  const subs = book?.substrates && typeof book.substrates === "object" ? book.substrates : PAINT_SUBSTRATE_DEFAULTS;
  return Object.keys(subs).filter((k) => !EXCLUDED.has(k));
}

/** sqft → an area, lnft → a length, each/side → a count. */
export function measureForUnit(unit) {
  if (unit === "sqft") return "area";
  if (unit === "lnft") return "length";
  return "count";
}

export function substrateDef(key, book) {
  const subs = book?.substrates && typeof book.substrates === "object" ? book.substrates : PAINT_SUBSTRATE_DEFAULTS;
  return Object.prototype.hasOwnProperty.call(subs, key) ? subs[key] : null;
}

export function unitForSubstrate(key, book) {
  return substrateDef(key, book)?.unit || null;
}

/** Which painting category's book prices this substrate. */
export function categoryForSubstrate(key) {
  return EXTERIOR_KEYS.has(key) ? "exterior_painting" : "interior_painting";
}

/**
 * The estimate type — and so the rate set — a substrate prices under.
 * A commercial project prices interior and exterior surfaces on the
 * commercial set (PAINT_ESTIMATE_TYPES.commercial); staining and cabinet
 * substrates keep their own sets, which commercial does not carry.
 */
export function estimateTypeForSubstrate(key, book, { commercial = false } = {}) {
  const surface = substrateDef(key, book)?.surface;
  if (surface === "staining") return "staining";
  if (surface === "cabinets") return "cabinets";
  if (commercial) return "commercial";
  return surface === "exterior" ? "exterior" : "interior";
}

/**
 * What the model is shown: keys, labels, units and where each applies.
 * Never a rate, a production figure or a price.
 */
export function catalogueForModel(book) {
  const items = planSubstrateKeys(book).map((key) => {
    const d = substrateDef(key, book);
    return { key, label: d?.label || key, unit: d?.unit || "each", applies: d?.surface || "interior" };
  });
  const productSource = book?.products && typeof book.products === "object" ? book.products : PAINT_PRODUCT_DEFAULTS;
  const products = Object.keys(productSource).map((key) => ({ key, label: productSource[key]?.label || key }));
  return { items, products, equipment: EQUIPMENT_KINDS };
}
