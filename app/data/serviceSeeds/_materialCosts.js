// app/data/serviceSeeds/_materialCosts.js
//
// Real shelf costs for the materials the templates buy, and how far one
// purchase unit goes. Source: docs/research/material-costs-homedepot.md —
// Home Depot, Massena NY store, USD, read 2026-09-24, first match per query;
// where the capture gave a range the FIRST figure is used. Coverage is the
// product label where it states one, else the trade rule of thumb the table
// marks "rule" — a company should confirm those.
//
// A template material line built from here carries:
//   unit      the PURCHASE unit (gallon, sheet, bundle…), not the area unit
//   unitCost  the shelf price
//   unitPrice unitCost × DEFAULT_MATERIAL_MARKUP (1.25) — a starting markup
//             the company changes; a line priced from a captured competitor
//             template keeps its captured price instead
//   coverage  { per, unit } — how much of the measurement one purchase unit
//             covers, so qty = ceil(measurement ÷ per). `per` already folds
//             in the coats a line applies (a gallon of wall paint at 375 sq
//             ft a coat, two coats, covers 187.5 sq ft of wall).
//             unit: "sqft" | "linft" | "cuft" | "square" | "each"
//
// Canadian companies: these are US shelf prices. They are COSTS, and costs
// are not converted between markets (see lib/pricing/benchmarkFx.js) — a .ca
// pass is the follow-up, not a conversion here.

export const DEFAULT_MATERIAL_MARKUP = 1.25;

export const HD = {
  drywall_half_4x8: { cost: 16.98, unit: "sheet", per: 32, per_unit: "sqft" },
  joint_compound: { cost: 26.35, unit: "pail", per: 350, per_unit: "sqft" },
  drywall_tape: { cost: 9.67, unit: "roll", per: 416, per_unit: "sqft" },
  paint_interior_gal_2coats: { cost: 37.98, unit: "gallon", per: 187.5, per_unit: "sqft" },
  ceiling_paint_gal_2coats: { cost: 23.98, unit: "gallon", per: 187.5, per_unit: "sqft" },
  primer_gal: { cost: 23.98, unit: "gallon", per: 350, per_unit: "sqft" },
  paint_exterior_gal_2coats: { cost: 35.98, unit: "gallon", per: 162.5, per_unit: "sqft" },
  deck_stain_gal: { cost: 41.48, unit: "gallon", per: 200, per_unit: "sqft" },
  caulk_tube: { cost: 3.62, unit: "tube", per: 40, per_unit: "linft" },
  lvp_box: { cost: 42.87, unit: "box", per: 22, per_unit: "sqft" }, // sq ft/box pending a product-page pass
  underlayment_roll: { cost: 59, unit: "roll", per: 100, per_unit: "sqft" },
  baseboard_mdf_8ft: { cost: 12.36, unit: "piece", per: 8, per_unit: "linft" },
  tile_porcelain_case: { cost: 29.47, unit: "case", per: 15.6, per_unit: "sqft" },
  thinset_50lb: { cost: 14.97, unit: "bag", per: 95, per_unit: "sqft" },
  grout_25lb: { cost: 16.98, unit: "bag", per: 150, per_unit: "sqft" },
  shingles_bundle: { cost: 45.97, unit: "bundle", per: 0.333, per_unit: "square" },
  roof_underlayment_roll: { cost: 115.53, unit: "roll", per: 10, per_unit: "square" },
  deck_board_5_4x6x8: { cost: 7.78, unit: "board", per: 1, per_unit: "each" },
  fence_panel_6x8: { cost: 66.98, unit: "panel", per: 1, per_unit: "each" },
};
