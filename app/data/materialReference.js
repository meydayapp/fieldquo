// app/data/materialReference.js
//
// The material reference every seeded material cost is checked against —
// shelf prices read from Home Depot on 2026-09-24, per country:
//
//   US  homedepot.com, Massena NY store, USD
//       (docs/research/material-costs-homedepot.md, passes 1 and 2)
//   CA  homedepot.ca, store 7274, CAD
//       (docs/research/material-costs-homedepot-ca.md)
//
// A row is { key, name, unit, coverage: { per, unit } | null, coverageSource,
// prices: { US?, CA? } }. Where the capture gave a range the FIRST figure is
// used. A CA price is absent where the .ca search failed (the file's GAP
// rows) — the seed then falls back to the US cost converted at the fixed
// benchmark rate and says so (costSource "fx-estimate"); it never guesses a
// Canadian shelf price.
//
// Canadian products differ in size (3.79 L cans, 7.58 L ceiling pails, 7 lb
// grout bags, 10-packs of baseboard), so a CA price carries its own `unit`
// and `coverage` when they differ from the US product: a quantity computed
// from the measurement always divides by the coverage of the product the
// company in that country actually buys.
//
// Copyright note: product NAMES are generic descriptions here; no retailer
// text or image is reproduced. This file is read by the seeds
// (app/data/serviceSeeds/_materialCosts.js) and by
// scripts/check-material-prices.mjs — never by a client-facing route.

const US = (amount) => ({ amount, currency: "USD", store: "homedepot.com — Massena NY", capturedAt: "2026-09-24" });
const CA = (amount, extra = {}) => ({ amount, currency: "CAD", store: "homedepot.ca 7274", capturedAt: "2026-09-24", ...extra });
const cov = (per, unit) => ({ per, unit });
const R = (key, name, unit, coverage, coverageSource, prices) => ({ key, name, unit, coverage, coverageSource, source: "homedepot", prices });

export const MATERIAL_REFERENCE = [
  // ── Drywall and framing ──
  R("drywall_half_4x8", "1/2 in drywall 4 × 8", "sheet", cov(32, "sqft"), "label", { US: US(16.98) }),
  R("drywall_mold_4x8", "1/2 in mould-resistant drywall 4 × 8", "sheet", cov(32, "sqft"), "label", { US: US(25.98) }),
  R("drywall_half_4x12", "1/2 in drywall 4 × 12", "sheet", cov(48, "sqft"), "label", { US: US(26.92) }),
  R("drywall_58_firecode", "5/8 in fire-rated drywall 4 × 8", "sheet", cov(32, "sqft"), "label", { US: US(20.78), CA: CA(36.06, { unit: "sheet", coverage: cov(40, "sqft"), note: "5/8 in 4 × 10 mould-resistant fire-rated" }) }),
  R("joint_compound", "All-purpose joint compound", "pail", cov(350, "sqft"), "rule", { US: US(26.35), CA: CA(18.51, { unit: "carton", note: "16 L carton" }) }),
  R("drywall_tape", "Paper joint tape, 500 ft", "roll", cov(416, "sqft"), "rule", { US: US(9.67), CA: CA(5.67) }),
  R("drywall_screws", "Drywall screws, 5 lb", "box", cov(1120, "sqft"), "rule", { US: US(24.98), CA: CA(16.88) }),
  R("corner_bead", "Metal corner bead, 8 ft", "piece", cov(8, "linft"), "label", { US: US(4.98), CA: CA(4.26) }),
  R("stud_2x4x8", "2 × 4 × 8 stud", "each", null, "rule", { US: US(4.25) }),
  R("stud_2x6x8", "2 × 6 × 8 stud", "each", null, "rule", { US: US(9.42) }),
  R("pt_2x4x8", "2 × 4 × 8 pressure-treated", "each", null, "rule", { US: US(5.18) }),
  R("pt_2x6x10", "2 × 6 × 10 pressure-treated", "each", null, "rule", { US: US(13.88), CA: CA(20.26) }),
  R("post_4x4x8", "4 × 4 × 8 pressure-treated post", "each", null, "rule", { US: US(11.78) }),
  R("osb_7_16", "7/16 in OSB sheathing 4 × 8", "sheet", cov(32, "sqft"), "label", { US: US(11.9) }),
  R("osb_subfloor_23_32", "23/32 in T&G OSB subfloor", "sheet", cov(32, "sqft"), "label", { US: US(25.73), CA: CA(84.33) }),
  R("plywood_3_4_pt", "3/4 in pressure-treated plywood", "sheet", cov(32, "sqft"), "label", { US: US(63.08) }),
  R("deck_board_5_4x6x8", "5/4 × 6 pressure-treated deck board", "board", cov(3.7, "sqft"), "rule", { US: US(7.78), CA: CA(10.35, { coverage: cov(4.6, "sqft"), note: "10 ft premium decking — the Canadian store's shortest" }) }),
  // ── Paint and finishing ──
  R("paint_interior_gal", "Interior eggshell, 1 gal (3.79 L)", "gallon", cov(187.5, "sqft"), "rule", { US: US(37.98), CA: CA(45.97, { unit: "can" }) }),
  R("paint_interior_5gal", "Interior eggshell, 5 gal", "pail", cov(937.5, "sqft"), "rule", { US: US(168) }),
  R("ceiling_paint_gal", "Flat ceiling paint", "gallon", cov(187.5, "sqft"), "rule", { US: US(23.98), CA: CA(60.97, { unit: "pail", coverage: cov(375, "sqft"), note: "7.58 L pail" }) }),
  R("primer_gal", "All-purpose primer, 1 gal", "gallon", cov(350, "sqft"), "rule", { US: US(23.98), CA: CA(47.97, { unit: "can" }) }),
  R("paint_exterior_gal", "Exterior satin, 1 gal", "gallon", cov(162.5, "sqft"), "rule", { US: US(35.98), CA: CA(37.97, { unit: "can", note: "exterior flat 3.79 L — the .ca match was a barn-and-fence paint" }) }),
  R("deck_stain_gal", "Semi-transparent deck stain, 1 gal", "gallon", cov(200, "sqft"), "rule", { US: US(41.48), CA: CA(68.97, { unit: "can" }) }),
  R("paint_trim_enamel_gal", "Cabinet, door and trim enamel, 1 gal", "gallon", cov(500, "linft"), "rule", { US: US(55.98), CA: CA(86.47, { unit: "can" }) }),
  R("paint_trim_enamel_doors", "Cabinet, door and trim enamel — per door coverage", "gallon", cov(4.5, "each"), "rule", { US: US(55.98), CA: CA(86.47, { unit: "can" }) }),
  R("paint_trim_enamel_cabinet", "Cabinet, door and trim enamel — per cabinet door", "gallon", cov(15, "each"), "rule", { US: US(55.98), CA: CA(86.47, { unit: "can" }) }),
  R("paint_ppg_diamond", "Interior eggshell (premium), 1 gal", "gallon", cov(187.5, "sqft"), "rule", { US: US(38.98) }),
  R("wood_stain_qt", "Wood stain, 1 qt", "quart", cov(85, "sqft"), "rule", { US: US(14.98) }),
  R("poly_qt", "Polyurethane, 1 qt", "quart", cov(125, "sqft"), "rule", { US: US(18.98) }),
  R("caulk", "Paintable acrylic caulk, 10 oz", "tube", cov(40, "linft"), "rule", { US: US(3.62), CA: CA(3.07) }),
  R("painters_tape", "Painter's tape, 60 yd", "roll", cov(180, "linft"), "label", { US: US(7.98), CA: CA(10.97) }),
  R("roller_covers", "Roller covers, 3-pack", "pack", null, "rule", { US: US(9.98), CA: CA(21.47) }),
  R("drop_cloth", "Canvas drop cloth 9 × 12", "each", cov(108, "sqft"), "label", { US: US(22.75), CA: CA(36.97) }),
  R("spackle", "Lightweight spackle", "tub", null, "rule", { US: US(11.48), CA: CA(6.98, { unit: "tube", note: "162 mL tube" }) }),
  R("sanding_sponge", "Sanding sponge", "each", null, "rule", { US: US(8.48) }),
  R("tsp_substitute", "TSP substitute cleaner, 1 qt", "bottle", null, "rule", { US: US(6.97) }),
  // ── Flooring and tile ──
  R("lvp", "Click luxury vinyl plank", "box", cov(22, "sqft"), "rule", { US: US(42.87) }),
  R("laminate_12mm", "12 mm laminate", "case", cov(15.9, "sqft"), "label", { US: US(31.72) }),
  R("underlayment", "Floor underlayment, 100 sq ft", "roll", cov(100, "sqft"), "label", { US: US(59), CA: CA(109) }),
  R("carpet_pad", "7/16 in carpet pad", "roll", null, "label", { US: US(110.45) }),
  R("baseboard_mdf", "Primed MDF baseboard, 8 ft", "piece", cov(8, "linft"), "label", { US: US(12.36), CA: CA(56.47, { unit: "pack", coverage: cov(80, "linft"), note: "10-pack of 8 ft lengths" }) }),
  R("quarter_round", "Quarter round, 8 ft", "piece", cov(8, "linft"), "label", { US: US(8.08), CA: CA(5.92) }),
  R("t_molding", "Hardwood T-moulding, 78 in", "piece", cov(6.5, "linft"), "label", { US: US(21.98) }),
  R("tile_porcelain_12x24", "12 × 24 glazed porcelain tile", "case", cov(15.6, "sqft"), "label", { US: US(29.47), CA: CA(92.48, { coverage: cov(16, "sqft") }) }),
  R("tile_subway_3x6", "3 × 6 ceramic subway tile", "case", cov(12.5, "sqft"), "label", { US: US(14.98) }),
  R("thinset_50lb", "Modified thinset, 50 lb", "bag", cov(95, "sqft"), "rule", { US: US(14.97) }),
  R("grout_25lb", "Sanded grout, 25 lb", "bag", cov(150, "sqft"), "rule", { US: US(16.98), CA: CA(22.86, { coverage: cov(50, "sqft"), note: "7 lb bag" }) }),
  // ── Roofing and gutters ──
  R("shingles_bundle", "Architectural shingles", "bundle", cov(33.3, "sqft"), "label", { US: US(45.97), CA: CA(39.97) }),
  R("ridge_vent", "Rigid ridge vent, 4 ft", "piece", cov(4, "linft"), "label", { US: US(12.97), CA: CA(26.24) }),
  R("roof_underlayment", "Synthetic roof underlayment, 1,000 sq ft", "roll", cov(1000, "sqft"), "label", { US: US(115.53), CA: CA(305) }),
  R("ice_water", "Ice and water membrane", "roll", cov(225, "sqft"), "label", { US: US(199), CA: CA(110, { coverage: cov(195, "sqft") }) }),
  R("drip_edge", "Drip edge, 10 ft", "piece", cov(10, "linft"), "label", { US: US(7.68), CA: CA(14.06) }),
  R("roofing_nails", "Coil roofing nails", "box", null, "rule", { US: US(49.98), CA: CA(52.98) }),
  R("gutter_5k_10", "5 in K-style aluminium gutter, 10 ft", "length", cov(10, "linft"), "label", { US: US(22.98) }),
  R("downspout_2x3_10", "Aluminium downspout, 10 ft", "length", cov(10, "linft"), "label", { US: US(19.98), CA: CA(31.62) }),
  R("gutter_guard_kit", "Micro-mesh gutter guard", "kit", cov(80, "linft"), "label", { US: US(199), CA: CA(56.83, { unit: "pack", coverage: cov(20, "linft"), note: "5 × 4 ft pack" }) }),
  // ── Concrete, hardscape, siding, insulation ──
  R("concrete_80lb", "Concrete mix, 80 lb", "bag", cov(0.6, "cuft"), "label", { US: US(6.47), CA: CA(6.98, { coverage: cov(0.5, "cuft"), note: "30 kg bag" }) }),
  R("rebar_10ft", "#4 rebar, 10 ft", "bar", cov(10, "linft"), "label", { US: US(9.55), CA: CA(8.98, { coverage: cov(20, "linft"), note: "10M × 20 ft" }) }),
  R("paver_base", "Paver base, 0.5 cu ft", "bag", cov(1.5, "sqft"), "rule", { US: US(6.25), CA: CA(10.84, { note: "limestone screenings 30 kg" }) }),
  R("gravel", "All-purpose gravel, 0.5 cu ft", "bag", cov(0.5, "cuft"), "label", { US: US(6.97) }),
  R("fence_picket", "Pressure-treated dog-ear picket", "each", null, "rule", { US: US(2.38) }),
  R("fence_panel", "6 × 8 privacy fence panel", "panel", cov(8, "linft"), "label", { US: US(66.98) }),
  R("vinyl_siding", "Vinyl siding, double 4 in", "piece", cov(8.3, "sqft"), "rule", { US: US(9.48), CA: CA(10.94) }),
  R("house_wrap", "House wrap", "roll", cov(1350, "sqft"), "label", { US: US(118), CA: CA(137, { coverage: cov(900, "sqft") }) }),
  R("insulation_r13", "R-13 faced batt roll", "roll", cov(40, "sqft"), "label", { US: US(27.97) }),
  R("insulation_r19", "R-19 faced batt roll", "roll", cov(49, "sqft"), "label", { US: US(50.57) }),
  // ── Landscaping ──
  R("mulch_2cuft", "Shredded mulch, 2 cu ft", "bag", cov(8, "sqft"), "rule", { US: US(3.33), CA: CA(4.0) }),
  R("sod_pallet", "Sod pallet", "pallet", cov(500, "sqft"), "label", { US: US(599) }),
  R("grass_seed", "Grass seed", "bag", cov(6660, "sqft"), "rule", { US: US(43.97), CA: CA(24.98, { coverage: cov(1863, "sqft"), note: "smaller bag, label coverage" }) }),
  R("fertilizer_15k", "Lawn fertilizer, 15,000 sq ft", "bag", cov(15000, "sqft"), "label", { US: US(35.49) }),
  R("edging_20ft", "No-dig landscape edging, 20 ft", "kit", cov(20, "linft"), "label", { US: US(20.97), CA: CA(22.98) }),
  // ── HVAC ──
  R("mini_split_12k", "Ductless mini-split, 12,000 BTU", "system", null, "rule", { US: US(609.99), CA: CA(1199) }),
  R("mini_split_24k", "Ductless mini-split, 24,000 BTU", "system", null, "rule", { US: US(1829.95) }),
  R("evap_coil_5t", "Cased evaporator coil, 5 ton", "each", null, "rule", { US: US(772) }),
  R("line_set_mini", "Copper line set 1/4 × 3/8, 25 ft", "set", cov(25, "linft"), "label", { US: US(99.81) }),
  R("capacitor_45_5", "Dual run capacitor 45/5", "each", null, "rule", { US: US(17.17) }),
  R("contactor_30a", "30 A contactor", "each", null, "rule", { US: US(14.78) }),
  R("condensate_pump", "Condensate pump", "each", null, "rule", { US: US(84.98) }),
  R("thermostat_basic", "Programmable thermostat", "each", null, "rule", { US: US(39.98), CA: CA(95) }),
  R("thermostat_smart", "Smart thermostat", "each", null, "rule", { US: US(129.99), CA: CA(179.99) }),
  R("filter_16x25x1", "Pleated furnace filter 16 × 25 × 1", "each", null, "rule", { US: US(18.97), CA: CA(4.66, { note: "3-pack MERV 8 at 13.98 — a lower rating than the US MERV 11" }) }),
  R("flex_duct_6", "6 in insulated flex duct, 25 ft", "roll", cov(25, "linft"), "label", { US: US(68.48) }),
  R("floor_register", "Steel floor register 4 × 10", "each", null, "rule", { US: US(17.98) }),
  R("foil_tape", "HVAC foil tape", "roll", cov(150, "linft"), "label", { US: US(14.78) }),
  // ── Plumbing ──
  R("water_heater_40_gas", "40 gal gas water heater", "each", null, "rule", { US: US(629) }),
  R("water_heater_50_elec", "50 gal electric water heater", "each", null, "rule", { US: US(549) }),
  R("tankless_gas", "Gas tankless water heater, 9.5 GPM", "each", null, "rule", { US: US(1299), CA: CA(1988) }),
  R("toilet", "Two-piece elongated toilet", "each", null, "rule", { US: US(99), CA: CA(199) }),
  R("wax_ring", "Wax ring with bolts", "each", null, "rule", { US: US(10.98), CA: CA(12.98) }),
  R("faucet_kitchen", "Pull-down kitchen faucet", "each", null, "rule", { US: US(89), CA: CA(159) }),
  R("faucet_bath", "4 in centerset bath faucet", "each", null, "rule", { US: US(59), CA: CA(65.98) }),
  R("disposal_half_hp", "Garbage disposal, 1/2 HP", "each", null, "rule", { US: US(121.91), CA: CA(184) }),
  R("supply_line", "Braided supply line", "each", null, "rule", { US: US(7.9), CA: CA(3.96, { note: "12–16 in compression × FIP" }) }),
  R("angle_stop", "Quarter-turn angle stop", "each", null, "rule", { US: US(9.73), CA: CA(10.75) }),
  R("pex_half_100", "1/2 in PEX, 100 ft", "coil", cov(100, "linft"), "label", { US: US(33.3), CA: CA(56.93) }),
  R("pvc_dwv_1_5_10", "1-1/2 in PVC DWV, 10 ft", "length", cov(10, "linft"), "label", { US: US(11.96) }),
  R("sump_pump", "Sump pump, 1/3 HP", "each", null, "rule", { US: US(158.26), CA: CA(179) }),
  // ── Electrical ──
  R("romex_14_2", "NM-B 14/2 cable", "coil", cov(250, "linft"), "label", { US: US(124), CA: CA(148, { coverage: cov(246, "linft"), note: "75 m coil" }) }),
  R("romex_12_2", "NM-B 12/2 cable", "coil", cov(250, "linft"), "label", { US: US(179), CA: CA(242, { coverage: cov(246, "linft"), note: "75 m coil" }) }),
  R("outlet_15a_10pk", "Duplex receptacle 15 A, 10-pack", "pack", cov(10, "each"), "label", { US: US(6.48) }),
  R("gfci_15a", "Self-test GFCI 15 A", "each", null, "rule", { US: US(18.98), CA: CA(27.97) }),
  R("switch_10pk", "Single-pole switch, 10-pack", "pack", cov(10, "each"), "label", { US: US(7.98), CA: CA(14.95) }),
  R("dimmer_led", "LED dimmer", "each", null, "rule", { US: US(30.97), CA: CA(39.98) }),
  R("breaker_20a", "Single-pole breaker", "each", null, "rule", { US: US(7.26), CA: CA(20.95, { note: "15 A QO — a different panel family" }) }),
  R("panel_200a", "200 A 30-space main-breaker panel", "each", null, "rule", { US: US(214) }),
  R("ev_charger_48a", "Level 2 EV charger 40–48 A", "each", null, "rule", { US: US(329.99), CA: CA(869.99) }),
  R("led_flush_mount", "12 in LED flush mount", "each", null, "rule", { US: US(24.97), CA: CA(9.98) }),
  R("recessed_6in_12pk", "6 in canless LED, 12-pack", "pack", cov(12, "each"), "label", { US: US(179.99) }),
  R("ceiling_fan_52", "52 in LED ceiling fan", "each", null, "rule", { US: US(119) }),
  R("smoke_detector_hw", "Hard-wired smoke alarm with battery", "each", null, "rule", { US: US(28.47), CA: CA(52.33, { note: "3-pack at 157 — per alarm" }) }),
  // ── Cleaning ──
  R("house_wash_concentrate", "House and siding wash concentrate", "jug", null, "rule", { CA: CA(11.98) }),
];

/** One reference row by key, or null. */
export function materialRef(key) {
  return MATERIAL_REFERENCE.find((r) => r.key === key) || null;
}
