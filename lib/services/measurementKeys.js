// lib/services/measurementKeys.js
//
// The closed registry of measurements a template line may take its quantity
// from — every trade, not only roofing. The owner: "for us it's not just the
// pricing but also taking measurements like the room for an interior painter
// to determine sq ft." A template line that names one of these keys opens on
// the estimate with its qty filled from the takeoff (and stays editable); a
// line that names a key the takeoff did not produce keeps its seed qty and is
// flagged `needsMeasurement` so the screen can ask.
//
// ── The rule: real names only ──────────────────────────────────────────────
//
// Every key is the EXACT field name the named module already produces — a
// registry that renames a takeoff's figure is a second vocabulary that drifts
// from the first (AGENTS.md failure class 4). Where the coordinator's list
// asked for a name a module does not produce (paint `trimLf`, `baseboardLf`,
// `doorCount`, `windowCount`, `perimeterLf`, closet counts; roofing
// `stepFlashingFt`) the key is NOT here: the paint takeoff counts doors,
// windows and closets as substrate rows, not as named area figures, and the
// satellite report produces no step-flashing length. Adding such a key would
// be a control that appears to work and does not. `linearFt` IS the paint
// area's perimeter (derivedGeometry returns it under that name), so that is
// the perimeter key.
//
//   source            the module and function whose output carries the key
//   unit              the unit the figure is in — what a template line naming
//                     the key should be priced per
//   kind              "area" | "length" | "count" | "modifier"
//
// `wastePct` is not a key: it is a modifier on a MATERIAL line naming a key
// (qty × (1 + wastePct/100)) and never on labour — see expandTemplate.
//
// ── The calculators this covers (the owner: template lines sit ON TOP of the
//    calculators — the calculator produces the quantity, the line supplies
//    price and cost) ────────────────────────────────────────────────────────
//
//   interior / exterior painting  lib/pricing/paintTakeoff.js#derivedGeometry
//   roofing                       lib/measure/roofMeasurement.js#summariseRoof,
//                                 lib/measure/roofGeometry.js#roofLinears,
//                                 lib/pricing/roofLabour.js#roofLabour
//   gutters                       lib/measure/gutterMeasurement.js
//   paving                        lib/pricing/paverTakeoff.js#baseMaterials
//   lawn / landscaping / irrigation  lib/measure/lotTakeoff.js (LOT_AREA_FIELD,
//                                 LOT_EDGE_FIELD) over lib/measure/lotArea.js;
//                                 lib/estimate/lawnCare.js prices off the same
//                                 area
//   electrical (rewire)           lib/estimate/rewireTakeoff.js (#estimateOpenings,
//                                 #estimateCircuits, #estimateWire,
//                                 #estimateLabourHours)
//   any traced outline            lib/estimate/tracedArea.js#measureTracedArea
//   stairs                        lib/estimate/stairsFromSteps.js
//   cabinets                      the cabinet intake (instantEstimate.js)
//   residential cleaning          the intake lib/cleaning/pricing.js reads
//                                 (bedrooms, bathrooms, squareFootage)
//
// ── Trades without a calculator of their own reuse the existing ones ──────
//
// The owner (2026-09-24): reuse the takeoffs rather than leave these trades
// bare. TRADE_MEASUREMENTS below maps each to the keys it draws on:
//
//   flooring  floorSqft (install, subfloor, underlay — waste on materials) and
//             linearFt, which IS the room perimeter: derivedGeometry returns
//             2 × (L + W) under that name for a room measured by area — the
//             transitions / baseboard / quarter-round lines use it
//   tile      floorSqft for floors, wallSqft for walls, backsplash, surrounds
//   drywall   wallSqft + ceilingSqft; a sheet line carries `coverage: { per: 32,
//             unit: "sqft" }` (a 4×8 sheet) so qty = ceil(area × (1 + waste) ÷ 32)
//   siding    wallSqft of an exterior area measured as a wall run
//             (derivedGeometry's "wall" style: run × height) — the exterior
//             body the paint takeoff already measures
//   fencing   edgingFt — the traced outline's LENGTH (lib/measure/lotTakeoff.js
//             LOT_EDGE_FIELD). tracedArea.js#measureTracedArea's `kind` only
//             colours the still and returns an area, never a length, so it is
//             not the source; a post line carries `coverage: { per: 8, unit: "linft" }`
//   concrete  areaSqft from tracedArea.js#measureTracedArea; the cubic-yard
//             line carries coverage { per: 324 ÷ thickness in inches, unit:
//             "sqft" } (81 sq ft per cu yd at 4 in)
//
// WIRED 2026-09-25 (lib/measure/reuseTakeoffs.js, mounted by
// app/components/quotes/builder/ReuseTakeoff.js): flooring_install, tiling
// and drywall_install measure rooms with paint's geometry; siding measures
// its walls as elevations into its own `sqft` box; fence_services and
// concrete trace on the aerial still into their intake boxes. None of them
// joins lib/pricing/takeoffTrades.js — they produce figures, not lines — so
// nothing is double-priced. Beside the keys above, the takeoffs produce a few
// purchase counts of their own, registered below: drywallSheets (4 × 8 or
// 4 × 12, chosen per job, waste inside the count), fencePosts (every 8 ft plus
// the closing post), concreteCuYd (area × the intake's thickness, waste
// inside, rounded up to the quarter yard), and the fence intake's gate counts.
// A template line keyed to one of those needs no `coverage`; the coverage
// lines described above keep working beside them. The generic areaSqFt /
// perimeterLf are filled too, from each trade's primary figure (floor,
// tiled, board or slab area; the fence run) — the seeded flooring templates
// are keyed to areaSqFt.

// ── Names deliberately left out ────────────────────────────────────────────
//
//   Output fields too generic to mean one thing once several calculators'
//   figures share one measurements object: paverCount's `exact` / `order`,
//   baseMaterials' `gravelTons` / polySandBags (ranges {low, high}, not a
//   quantity), rewire's `sqft` (the house, an input), roofLabour's `pitch`
//   (an object). A line that needs one of them waits for its calculator to
//   expose a specific name — adding a vague key would fill the wrong line.

export const MEASUREMENT_KEYS = {
  // ── Interior / exterior painting — lib/pricing/paintTakeoff.js#derivedGeometry (per area) ──
  wallSqft: { label: "Wall sq ft", unit: "sqft", kind: "area", source: "lib/pricing/paintTakeoff.js#derivedGeometry" },
  ceilingSqft: { label: "Ceiling sq ft", unit: "sqft", kind: "area", source: "lib/pricing/paintTakeoff.js#derivedGeometry" },
  floorSqft: { label: "Floor sq ft", unit: "sqft", kind: "area", source: "lib/pricing/paintTakeoff.js#derivedGeometry" },
  linearFt: { label: "Perimeter / run (linear ft)", unit: "linear_ft", kind: "length", source: "lib/pricing/paintTakeoff.js#derivedGeometry" },

  // ── Stairs — lib/estimate/stairsFromSteps.js#stairsFromSteps ──
  steps: { label: "Steps", unit: "each", kind: "count", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },
  treads: { label: "Treads", unit: "each", kind: "count", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },
  risers: { label: "Risers", unit: "each", kind: "count", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },
  balusters: { label: "Balusters (spindles)", unit: "each", kind: "count", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },
  posts: { label: "Newel posts", unit: "each", kind: "count", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },
  handrailFt: { label: "Handrail (ft)", unit: "linear_ft", kind: "length", source: "lib/estimate/stairsFromSteps.js#stairsFromSteps" },

  // ── Cabinets — the cabinet intake lib/estimate/instantEstimate.js and instantQuoteServer.js read ──
  doorCount: { label: "Cabinet doors", unit: "each", kind: "count", source: "lib/estimate/instantEstimate.js (cabinet intake)" },
  drawerCount: { label: "Drawer fronts", unit: "each", kind: "count", source: "lib/estimate/instantEstimate.js (cabinet intake)" },
  boxLinearFt: { label: "Cabinet boxes (linear ft)", unit: "linear_ft", kind: "length", source: "lib/estimate/instantEstimate.js (cabinet intake)" },

  // ── Roofing — lib/measure/roofMeasurement.js#summariseRoof (linear feet under `linear`, from lib/measure/roofGeometry.js#roofLinears) ──
  squares: { label: "Roof area (squares)", unit: "square", kind: "area", source: "lib/measure/roofMeasurement.js#summariseRoof" },
  // The same name the traced-outline measurer produces (tracedArea.js#measureTracedArea → measurement.areaSqft).
  areaSqft: { label: "Measured area (sq ft)", unit: "sqft", kind: "area", source: "lib/measure/roofMeasurement.js#summariseRoof; lib/estimate/tracedArea.js#measureTracedArea" },
  footprintSqft: { label: "Roof footprint (sq ft)", unit: "sqft", kind: "area", source: "lib/measure/roofMeasurement.js#summariseRoof" },
  eaveFt: { label: "Eaves (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  rakeFt: { label: "Rakes (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  ridgeFt: { label: "Ridges (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  hipFt: { label: "Hips (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  valleyFt: { label: "Valleys (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  perimeterFt: { label: "Roof perimeter (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },

  hours: { label: "Roof crew-hours", unit: "hour", kind: "count", source: "lib/pricing/roofLabour.js#roofLabour" },
  onRoofHours: { label: "On-roof hours", unit: "hour", kind: "count", source: "lib/pricing/roofLabour.js#roofLabour" },
  fixedHours: { label: "Set-up and clean-up hours", unit: "hour", kind: "count", source: "lib/pricing/roofLabour.js#roofLabour" },

  // ── Gutters — lib/measure/gutterMeasurement.js (the gutter figure off the roof outline) ──
  gutterFt: { label: "Gutter (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/gutterMeasurement.js" },
  downspouts: { label: "Downspouts", unit: "each", kind: "count", source: "lib/measure/gutterMeasurement.js#downspoutCount" },

  // ── Paving — lib/pricing/paverTakeoff.js#baseMaterials ──
  gravelCuYd: { label: "Gravel base (cu yd)", unit: "each", kind: "count", source: "lib/pricing/paverTakeoff.js#baseMaterials" },
  sandCuYd: { label: "Bedding sand (cu yd)", unit: "each", kind: "count", source: "lib/pricing/paverTakeoff.js#baseMaterials" },

  // ── Lawn, landscaping, irrigation — lib/measure/lotTakeoff.js (traced on lotArea.js) ──
  lotSize: { label: "Lot / lawn area (sq ft)", unit: "sqft", kind: "area", source: "lib/measure/lotTakeoff.js#LOT_AREA_FIELD" },
  edgingFt: { label: "Edging (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/lotTakeoff.js#LOT_EDGE_FIELD" },

  // ── Electrical rewire — lib/estimate/rewireTakeoff.js ──
  openings: { label: "Openings (devices)", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  receptaclesPractical: { label: "Receptacles", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  switches: { label: "Switches", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  lighting: { label: "Lighting outlets", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  smokeCo: { label: "Smoke / CO detectors", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  dedicated: { label: "Dedicated appliance circuits", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  counterReceptacles: { label: "Counter receptacles", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  exteriorReceptacles: { label: "Exterior receptacles", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  garageReceptacles: { label: "Garage receptacles", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateOpenings" },
  circuits: { label: "Circuits", unit: "each", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateCircuits" },
  totalFt: { label: "Wire (ft)", unit: "linear_ft", kind: "length", source: "lib/estimate/rewireTakeoff.js#estimateWire" },
  roughInHours: { label: "Rough-in hours", unit: "hour", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateLabourHours" },
  trimOutHours: { label: "Trim-out hours", unit: "hour", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateLabourHours" },
  panelHours: { label: "Panel hours", unit: "hour", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateLabourHours" },
  totalHours: { label: "Rewire hours", unit: "hour", kind: "count", source: "lib/estimate/rewireTakeoff.js#estimateLabourHours" },

  // ── Residential cleaning — the intake lib/cleaning/pricing.js#priceCleaning reads ──
  // (asked for as bedroomCount / bathroomCount / homeSqft; registered under the
  // names the intake already stores — a second spelling would never fill)
  bedrooms: { label: "Bedrooms", unit: "each", kind: "count", source: "lib/cleaning/pricing.js#priceCleaning (intake)" },
  bathrooms: { label: "Bathrooms", unit: "each", kind: "count", source: "lib/cleaning/pricing.js#priceCleaning (intake)" },
  squareFootage: { label: "Home size (sq ft)", unit: "sqft", kind: "area", source: "lib/cleaning/pricing.js#priceCleaning (intake)" },
  // No intake asks for half-baths today: typed on the quote until one does.
  halfBaths: { label: "Half bathrooms", unit: "each", kind: "count", source: "manual — typed on the estimate (no intake field yet)" },

  // ── Air duct cleaning — counted on site; no calculator produces them ──
  // The trade prices by the number of supply vents and return grilles, not
  // by area (app/data/serviceSeeds/air_duct_cleaning.js). Registered
  // 2026-09-24 so those template lines keep their key: until then the
  // sanitiser dropped it and the line lost the note saying what to count.
  ventCount: { label: "Supply vents", unit: "each", kind: "count", source: "manual — counted on site (no intake field yet)" },
  returnCount: { label: "Return grilles", unit: "each", kind: "count", source: "manual — counted on site (no intake field yet)" },

  // ── The reuse takeoffs' own purchase counts — lib/measure/reuseTakeoffs.js ──
  drywallSheets: { label: "Drywall sheets", unit: "each", kind: "count", source: "lib/measure/reuseTakeoffs.js#roomMeasureMeasurements (drywallSheets)" },
  fencePosts: { label: "Fence posts", unit: "each", kind: "count", source: "lib/measure/reuseTakeoffs.js#fencePosts" },
  concreteCuYd: { label: "Concrete (cu yd)", unit: "each", kind: "count", source: "lib/measure/reuseTakeoffs.js#concreteCuYd" },
  // The fence intake's own boxes (app/data/quoteIntakeFields.js fence_services), under their stored names.
  gateCount: { label: "Walk gates", unit: "each", kind: "count", source: "fence_services intake (gateCount)" },
  driveGateCount: { label: "Driveway gates", unit: "each", kind: "count", source: "fence_services intake (driveGateCount)" },

  // ── Generic — typed on the estimate, or filled by a reuse takeoff's primary figure (see the header) ──
  // (flooring, tile, drywall, siding, fencing, concrete — see the header)
  areaSqFt: { label: "Area (sq ft)", unit: "sqft", kind: "area", source: "typed on the estimate; lib/measure/reuseTakeoffs.js (floor, tiled, board or slab area)" },
  perimeterLf: { label: "Perimeter (linear ft)", unit: "linear_ft", kind: "length", source: "typed on the estimate; lib/measure/reuseTakeoffs.js#fenceMeasurements (the fence run)" },
  each: { label: "Count (each)", unit: "each", kind: "count", source: "manual — typed on the estimate" },
};

/** The keys, in registry order. */
export const MEASUREMENT_KEY_LIST = Object.keys(MEASUREMENT_KEYS);

/** Is `key` a registered measurement key? (Own keys only — "constructor" is not one.) */
export function isMeasurementKey(key) {
  return typeof key === "string" && Object.hasOwn(MEASUREMENT_KEYS, key);
}

/** The registry entry, or null. */
export function measurementKeyMeta(key) {
  return isMeasurementKey(key) ? MEASUREMENT_KEYS[key] : null;
}

/**
 * Read one measurement off a takeoff's output: a flat object keyed by the
 * registry's names, or the shape summariseRoof returns (linear feet under
 * `linear`). Null when absent, not a finite number, or negative — "zero
 * valleys" is a figure, "no report" is not.
 */
export function measurementValue(measurements, key) {
  if (!measurements || typeof measurements !== "object" || !isMeasurementKey(key)) return null;
  const direct = Object.hasOwn(measurements, key) ? measurements[key] : undefined;
  const nested =
    measurements.linear && typeof measurements.linear === "object" && Object.hasOwn(measurements.linear, key)
      ? measurements.linear[key]
      : undefined;
  const raw = direct !== undefined ? direct : nested;
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * The measurement keys each trade's template lines draw on — the calculators
 * above, including the trades that reuse another trade's takeoff. The
 * Settings screen lists these first in a line's picker; any registered key
 * stays allowed.
 */
export const TRADE_MEASUREMENTS = {
  interior_painting: ["wallSqft", "ceilingSqft", "floorSqft", "linearFt"],
  exterior_painting: ["wallSqft", "linearFt"],
  flooring: ["floorSqft", "linearFt"],
  flooring_install: ["floorSqft", "linearFt", "wallSqft", "areaSqFt"],
  tiling: ["floorSqft", "wallSqft", "linearFt", "areaSqFt"],
  drywall: ["wallSqft", "ceilingSqft"],
  drywall_install: ["wallSqft", "ceilingSqft", "drywallSheets", "areaSqFt"],
  siding: ["wallSqft"],
  fence_services: ["edgingFt", "fencePosts", "gateCount", "driveGateCount", "perimeterLf"],
  concrete: ["areaSqft", "concreteCuYd", "areaSqFt"],
  roofing_service: ["squares", "areaSqft", "footprintSqft", "eaveFt", "rakeFt", "ridgeFt", "hipFt", "valleyFt", "perimeterFt", "hours", "onRoofHours", "fixedHours"],
  gutter_services: ["gutterFt", "downspouts"],
  paving: ["areaSqft", "gravelCuYd", "sandCuYd"],
  lawn_care: ["lotSize", "edgingFt"],
  lawn_mowing: ["lotSize", "edgingFt"],
  landscaping_design: ["lotSize", "edgingFt"],
  irrigation: ["lotSize", "edgingFt"],
  electrical: ["openings", "receptaclesPractical", "switches", "lighting", "smokeCo", "dedicated", "counterReceptacles", "exteriorReceptacles", "garageReceptacles", "circuits", "totalFt", "roughInHours", "trimOutHours", "panelHours", "totalHours"],
  stairs: ["steps", "treads", "risers", "balusters", "posts", "handrailFt"],
  residential_cleaning: ["bedrooms", "bathrooms", "halfBaths", "squareFootage"],
  deep_cleaning: ["bedrooms", "bathrooms", "halfBaths", "squareFootage"],
  cabinet_refinishing: ["doorCount", "drawerCount", "boxLinearFt"],
  cabinet_refacing: ["doorCount", "drawerCount", "boxLinearFt"],
  air_duct_cleaning: ["ventCount", "returnCount"],
};

/** The keys a trade's lines draw on first, then every other registered key. */
export function measurementKeysForTrade(trade) {
  const first = Object.hasOwn(TRADE_MEASUREMENTS, trade) ? TRADE_MEASUREMENTS[trade].filter(isMeasurementKey) : [];
  return [...first, ...MEASUREMENT_KEY_LIST.filter((k) => !first.includes(k))];
}
