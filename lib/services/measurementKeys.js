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
  areaSqft: { label: "Roof area (sq ft)", unit: "sqft", kind: "area", source: "lib/measure/roofMeasurement.js#summariseRoof" },
  footprintSqft: { label: "Roof footprint (sq ft)", unit: "sqft", kind: "area", source: "lib/measure/roofMeasurement.js#summariseRoof" },
  eaveFt: { label: "Eaves (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  rakeFt: { label: "Rakes (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  ridgeFt: { label: "Ridges (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  hipFt: { label: "Hips (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  valleyFt: { label: "Valleys (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },
  perimeterFt: { label: "Roof perimeter (ft)", unit: "linear_ft", kind: "length", source: "lib/measure/roofGeometry.js#roofLinears" },

  // ── Generic — typed on the estimate by the estimator, no module computes them ──
  areaSqFt: { label: "Area (sq ft)", unit: "sqft", kind: "area", source: "manual — typed on the estimate" },
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
