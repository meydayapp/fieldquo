// app/data/serviceSeeds/_materialCosts.js
//
// The materials the seed templates buy, keyed by the name the trade files use,
// each pointing at a row of the per-country reference
// (app/data/materialReference.js — Home Depot US and Canada, 2026-09-24).
//
// A template material line built from here (hdMaterial in _templateLines.js)
// carries:
//   unit        the PURCHASE unit (gallon, sheet, bundle…), not the area unit
//   unitCost    the US shelf price (USD, the base every seed is written in)
//   unitPrice   unitCost × DEFAULT_MATERIAL_MARKUP (1.25) — a starting markup
//               the company changes; a line priced from a captured competitor
//               template keeps its captured price instead
//   coverage    { per, unit } — how much of the measurement one purchase unit
//               covers, so qty = ceil(measurement × waste ÷ per). `per` folds
//               in the coats a line applies (a gallon of wall paint at 375 sq
//               ft a coat, two coats, covers 187.5 sq ft of wall).
//   materialRef the reference row's key — scripts/check-material-prices.mjs
//               compares every such line to the reference, per country
//   unitCostByCountry / unitPriceByCountry  { CA } — the Canadian shelf
//               price in CAD and its marked-up price, where homedepot.ca had
//               the product; absent otherwise and the loader falls back to the
//               US cost converted at the fixed benchmark rate, marked
//               costSource "fx-estimate"
//   unitByCountry / coverageByCountry  { CA } — only where the Canadian
//               product comes in a different pack or size (7.58 L ceiling
//               pails, 10-packs of baseboard, 7 lb grout)
//
// A seed's coverage may be the reference coverage re-stated for the line's
// measurement (gravel per foot of 12 × 12 trench; a gallon of enamel per
// linear foot of trim) — the check compares coverages only in the same unit.

import { MATERIAL_REFERENCE } from "../materialReference.js";

export const DEFAULT_MATERIAL_MARKUP = 1.25;

const ref = Object.fromEntries(MATERIAL_REFERENCE.map((r) => [r.key, r]));

// name → [reference key, override of the seed's coverage { per, unit } or null for the reference's]
const USES = {
  drywall_half_4x8: ["drywall_half_4x8"],
  joint_compound: ["joint_compound"],
  drywall_tape: ["drywall_tape"],
  paint_interior_gal_2coats: ["paint_interior_gal"],
  ceiling_paint_gal_2coats: ["ceiling_paint_gal"],
  primer_gal: ["primer_gal"],
  paint_exterior_gal_2coats: ["paint_exterior_gal"],
  deck_stain_gal: ["deck_stain_gal"],
  caulk_tube: ["caulk"],
  lvp_box: ["lvp"],
  underlayment_roll: ["underlayment"],
  baseboard_mdf_8ft: ["baseboard_mdf"],
  tile_porcelain_case: ["tile_porcelain_12x24"],
  thinset_50lb: ["thinset_50lb"],
  grout_25lb: ["grout_25lb"],
  shingles_bundle: ["shingles_bundle"],
  roof_underlayment_roll: ["roof_underlayment"],
  deck_board_5_4x6x8: ["deck_board_5_4x6x8"],
  fence_panel_6x8: ["fence_panel"],
  mulch_2cuft: ["mulch_2cuft"],
  sod_pallet: ["sod_pallet"],
  grass_seed_20lb: ["grass_seed"],
  fertilizer_15k: ["fertilizer_15k"],
  edging_20ft: ["edging_20ft"],
  paver_base_half_cuft: ["paver_base"],
  gravel_trench: ["gravel", { per: 0.5, unit: "linft" }], // 0.5 cu ft fills half a foot of 12 × 12 in trench
  flex_duct_6: ["flex_duct_6"],
  gutter_5k_10: ["gutter_5k_10"],
  paint_trim_enamel_gal: ["paint_trim_enamel_gal"],
  paint_trim_enamel_doors: ["paint_trim_enamel_doors"],
  paint_trim_enamel_cabinet: ["paint_trim_enamel_cabinet"],
  wood_stain_qt_trim: ["wood_stain_qt", { per: 250, unit: "linft" }], // 4 in trim, one coat
  water_heater_50_elec: ["water_heater_50_elec"],
  tankless_gas: ["tankless_gas"],
  toilet_2pc: ["toilet"],
  supply_line: ["supply_line"],
  mini_split_12k: ["mini_split_12k"],
  smoke_detector_hw: ["smoke_detector_hw"],
  filter_16x25x1: ["filter_16x25x1"],
  pex_half_100: ["pex_half_100"],
  gfci_15a: ["gfci_15a"],
};

function build(name, [key, coverageOverride]) {
  const r = ref[key];
  if (!r || !r.prices.US) throw new Error(`_materialCosts: ${name} → reference ${key} has no US price`);
  const coverage = coverageOverride || r.coverage;
  const ca = r.prices.CA
    ? {
        cost: r.prices.CA.amount,
        unit: r.prices.CA.unit || r.unit,
        // A Canadian pack with its own coverage uses it; otherwise the line's
        // coverage stands (the same product in a different currency).
        coverage: r.prices.CA.coverage && (!coverageOverride || r.prices.CA.coverage.unit === coverage?.unit) ? r.prices.CA.coverage : coverage,
      }
    : null;
  return {
    ref: key,
    cost: r.prices.US.amount,
    unit: r.unit,
    per: coverage ? coverage.per : 1,
    per_unit: coverage ? coverage.unit : "each",
    ca,
  };
}

export const HD = Object.fromEntries(Object.entries(USES).map(([name, use]) => [name, build(name, use)]));
