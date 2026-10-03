// scripts/estimateKindFixtures.mjs
//
// Existing quotes of every painting estimate kind, and the cabinet and stair
// groups a TrueFinish-shaped quote holds, reduced to one md5 each — for
// scripts/check-estimate-kind-routing.mjs, which pins them.
//
// IMPORTS NOTHING from the product on purpose. The pricing functions are
// passed in, so the very same fixtures can be run through the origin/main
// tree the pins were taken from (2026-10-03, before the estimate-kind
// routing landed) and through the working tree: a pin that moves means a
// stored quote of that kind would print a different number.
//
// Rows are written as literals with the substrates origin/main already had,
// never through newPaintSubstrate — a fixture built by the code under test
// would move with it.
import { createHash } from "node:crypto";

const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

const sub = (key, patch = {}) => ({ key, label: key, coats: 2, prepHours: 0, quantity: null, optional: false, ...patch });
const room = (patch, substrates) => ({
  areaType: "den", label: "Room", surface: "interior", measurement: "area",
  lengthFt: 12, widthFt: 14, heightFt: 8, linearFt: 0, surfaceSqft: 0,
  prepHours: 0.5, optional: false, substrates, options: [], ...patch,
});

export const PAINT_FIXTURES = {
  legacy_untyped: { model: "area_substrate", areas: [room({}, [sub("walls", { driver: "wallSqft" }), sub("ceiling", { driver: "ceilingSqft" }), sub("door", { quantity: 3, driver: null })])] },
  interior: { model: "area_substrate", estimateType: "interior", areas: [room({}, [sub("walls", { driver: "wallSqft", rateKey: "walls_16ft" }), sub("baseboard", { driver: "linearFt" }), sub("window_sill", { quantity: 2 })])] },
  exterior_room: { model: "area_substrate", estimateType: "exterior", areas: [room({ areaType: "exterior", surface: "exterior", lengthFt: 40, widthFt: 30, heightFt: 18 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 }), sub("soffit_fascia", { quantity: 140 }), sub("garage_door", { quantity: 1 })])] },
  exterior_surface: { model: "area_substrate", estimateType: "exterior", areas: [room({ areaType: "exterior", surface: "exterior", measurement: "surface", lengthFt: 0, widthFt: 0, heightFt: 0, surfaceSqft: 2340, linearFt: 260 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 }), sub("soffit_fascia", { quantity: 260 }), sub("garage_door", { quantity: 1 })])] },
  cabinets: { model: "area_substrate", estimateType: "cabinets", areas: [room({ areaType: "kitchen", surface: "cabinets" }, [sub("cab_door", { quantity: 24 }), sub("cab_drawer", { quantity: 8, rateKey: "cab_drawer_flat" }), sub("cab_box", { quantity: 30 })])] },
  staining: { model: "area_substrate", estimateType: "staining", areas: [room({ areaType: "stairwell", surface: "staining" }, [sub("stain_tread", { quantity: 13 }), sub("stain_riser", { quantity: 14 }), sub("stain_railing", { quantity: 12 })]), room({ areaType: "deck", surface: "staining", lengthFt: 16, widthFt: 12, heightFt: 0 }, [sub("stain_deck", { driver: "floorSqft" })])] },
  commercial: { model: "area_substrate", estimateType: "commercial", areas: [room({ areaType: "commercial_unit" }, [sub("walls", { driver: "wallSqft" })]), room({ areaType: "commercial_unit", surface: "exterior", lengthFt: 60, widthFt: 40, heightFt: 14 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 })])] },
};

const stairs = {
  sections: [{ title: "Main Staircase", complexityLevel: "standard", treads: 13, risers: 14, balusters: 30, posts: 2, handrailFt: 14, landingSqft: 9, paintRisers: true, paintBalusters: true, paintPosts: false, twoTone: false, stainColour: "Jacobean", notes: "" }],
  basement: false,
  basementTreads: 0,
  notes: "",
};

const CABINET_INTAKE = { doorCount: 24, drawerCount: 8, woodSpecies: "oak", condition: "normal", hingeType: "clip" };
const REFACING_INTAKE = { doorCount: 20, drawerCount: 6, boxLinearFt: 18 };

/**
 * fns: { paintTakeoff, getPriceBook, buildTradeLineItems, tradeSubtotal,
 *        scopeGroupPayload, groupSubtotal, newScopeGroup }
 */
export function fixtureDigests(fns) {
  const out = {};
  for (const [name, t] of Object.entries(PAINT_FIXTURES)) {
    for (const key of ["interior_painting", "exterior_painting"]) {
      const g = { tempId: "f", persisted: false, categoryKey: key, takeoff: t, lineItems: [], intakeValues: {} };
      out[`${name}/${key}`] = md5({
        engine: fns.paintTakeoff(t, fns.getPriceBook(key, null)?.takeoff),
        lines: fns.buildTradeLineItems(key, t, null),
        subtotal: fns.tradeSubtotal(key, t, null),
        payload: fns.scopeGroupPayload(g, null, "en"),
      });
    }
  }
  // A stair takeoff, live and as stored (its lines are the quote).
  {
    const live = { tempId: "s", persisted: false, categoryKey: "stairs", takeoff: stairs, lineItems: [], intakeValues: {} };
    const payload = fns.scopeGroupPayload(live, null, "en");
    out["stairs/live"] = md5({ lines: fns.buildTradeLineItems("stairs", stairs, null), payload, subtotal: fns.groupSubtotal(live, null) });
    const stored = { ...live, persisted: true, lineItems: payload.lineItems };
    out["stairs/stored"] = md5({ payload: fns.scopeGroupPayload(stored, null, "en"), subtotal: fns.groupSubtotal(stored, null) });
  }
  // Cabinet refinishing and refacing groups — the unit-priced path.
  for (const [key, intake] of [["cabinet_refinishing", CABINET_INTAKE], ["cabinet_refacing", REFACING_INTAKE]]) {
    const g = fns.newScopeGroup({ id: `cat-${key}`, key, label: key }, key, null, { tempId: "c", intakeValues: intake });
    const payload = fns.scopeGroupPayload(g, null, "en");
    out[`${key}/live`] = md5({ group: g, payload, subtotal: fns.groupSubtotal(g, null) });
    const stored = { ...g, persisted: true, lineItems: payload.lineItems };
    out[`${key}/stored`] = md5({ payload: fns.scopeGroupPayload(stored, null, "en"), subtotal: fns.groupSubtotal(stored, null) });
  }
  return out;
}

// ── The second set (2026-10-03, later) ─────────────────────────────────────
//
// What the same day's second change touches — the drywall repair book going
// live, the cabinet stain add-on, the legacy room label, and an area holding
// both trims — pinned against origin/main (f74dd7f9) through the same
// injected functions. Kept apart from fixtureDigests so the first set's pins
// stay exactly the ones they were taken as.

// A legacy complexity-grid painting takeoff (no `model`): the "Wall area"
// box (it said "Floor area") is `sqft` here. Label only — the number prices
// as it did.
export const LEGACY_ROOMS = {
  rooms: [
    { title: "Living", roomType: "living_room", sqft: 420, walls: true, ceiling: true, trim: true, doors: true, doorsCount: 2, closets: false, closetsCount: 0, colorChange: false, drywallPrep: false, complexityLevel: "standard" },
    { title: "Bed", roomType: "bedroom", sqft: 300, walls: true, ceiling: false, trim: true, doors: true, doorsCount: 1, complexityLevel: "moderate" },
  ],
  popcornRemoval: false,
  popcornSqft: 0,
  furnitureMoving: false,
  notes: "",
};

// A stored exterior area carrying BOTH Siding & trim and Trim boards — the
// pair the builder now keeps apart. Its lines are what the quote billed, as
// stored (literal, never derived here): a stored quote prints from them.
const BOTH_TRIMS_TAKEOFF = {
  model: "area_substrate",
  estimateType: "exterior",
  areas: [room({ areaType: "exterior", surface: "exterior", measurement: "surface", lengthFt: 0, widthFt: 0, heightFt: 0, surfaceSqft: 1200, linearFt: 180 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 }), sub("ext_trim", { driver: "linearFt" })])],
};
const BOTH_TRIMS_LINES = [
  { description: "Exterior — Siding & trim", quantity: 1200, unit: "sqft", rate: 1.1077, amount: 1329.24 },
  { description: "Exterior — Trim boards", quantity: 180, unit: "lnft", rate: 2.9744, amount: 535.39 },
];

/**
 * fns: as fixtureDigests.
 */
export function moreFixtureDigests(fns) {
  const out = {};
  // Drywall repairs: a company's own rate line ($3.25/sqft — six of the eight
  // drywall companies' figure), intake answered, Level 4. New groups must open
  // exactly as before the repair book went live.
  for (const [key, cat] of [
    ["drywall", { id: "cat-dw", key: "drywall", label: "Drywall", unit: "sqft", defaultRate: 3.25 }],
    ["drywall_install", { id: "cat-dwi", key: "drywall_install", label: "Drywall Installation", unit: null, defaultRate: null }],
  ]) {
    const g = fns.newScopeGroup(cat, cat.label, null, { tempId: "d", fieldDefaults: true, language: "en", intakeValues: { squareFootage: 400 } });
    const payload = fns.scopeGroupPayload(g, null, "en");
    out[`${key}/live`] = md5({ group: g, payload, subtotal: fns.groupSubtotal(g, null) });
    const stored = { ...g, persisted: true, lineItems: payload.lineItems };
    out[`${key}/stored`] = md5({ payload: fns.scopeGroupPayload(stored, null, "en"), subtotal: fns.groupSubtotal(stored, null) });
  }
  // Cabinet refinishing with upgrades ticked — the stain finish is offered
  // beside them now, and must change nothing on a group that did not tick it.
  {
    const g = fns.newScopeGroup({ id: "cat-rf", key: "cabinet_refinishing", label: "Cabinet Refinishing" }, "Cabinet Refinishing", null, {
      tempId: "u",
      intakeValues: CABINET_INTAKE,
      addOns: ["softCloseHinges", "twoTone", "handleHoles"],
    });
    const payload = fns.scopeGroupPayload(g, null, "en");
    out["cabinet_refinishing_upgrades/live"] = md5({ group: g, payload, subtotal: fns.groupSubtotal(g, null) });
    const stored = { ...g, persisted: true, lineItems: payload.lineItems };
    out["cabinet_refinishing_upgrades/stored"] = md5({ payload: fns.scopeGroupPayload(stored, null, "en"), subtotal: fns.groupSubtotal(stored, null) });
  }
  // The legacy room grid.
  {
    const g = { tempId: "l", persisted: false, categoryKey: "interior_painting", takeoff: LEGACY_ROOMS, lineItems: [], intakeValues: {} };
    out["legacy_rooms/interior_painting"] = md5({
      lines: fns.buildTradeLineItems("interior_painting", LEGACY_ROOMS, null),
      subtotal: fns.tradeSubtotal("interior_painting", LEGACY_ROOMS, null),
      payload: fns.scopeGroupPayload(g, null, "en"),
    });
  }
  // A stored area with both trims: its price is kept.
  {
    const g = { tempId: "b", persisted: true, categoryKey: "exterior_painting", takeoff: BOTH_TRIMS_TAKEOFF, lineItems: BOTH_TRIMS_LINES, intakeValues: {} };
    out["both_trims/stored"] = md5({ payload: fns.scopeGroupPayload(g, null, "en"), subtotal: fns.groupSubtotal(g, null) });
  }
  return out;
}

export const STORED_BOTH_TRIMS = { takeoff: BOTH_TRIMS_TAKEOFF, lineItems: BOTH_TRIMS_LINES };
