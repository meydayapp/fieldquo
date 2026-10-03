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
