// lib/planRead/backfill.js
//
// Never a scoped side at 0 when the drawings were measured. The owner's live
// test (2026-10-05): the first pass scoped the church correctly — areas,
// exclusions, access with heights — and left every quantity at 0 sq ft,
// inside and out. If the synthesis still lists no surface with a quantity on
// a side the quote is for, but the measurement pass DID measure faces or
// rooms on that side, code drafts the surfaces from them:
//
//   outside   one wall surface per measured elevation face, by its net area
//   inside    walls and ceiling per measured room, to the section's height
//             (or the stated default height, labelled)
//
// Each is marked as FieldQuo's (addedBy "fieldquo"), and an assumption says
// so — the estimator sees exactly where the figures came from. Then any side
// with work above 8 ft and no access listed for it gets an access line
// (firstPass.js missingAccess), so the access is priced too.
//
// Pure.

import { missingAccess } from "./firstPass";
import { surfaceSide } from "./firstPass";
import { sameSurfacePlan } from "./sameSurface";

const HEIGHT_PREFERENCE = ["ceiling", "wall_plate", "eaves", "storey", "parapet", "other"];

function blankSurface(id, fields) {
  return {
    id,
    areaId: null,
    label: "",
    itemKey: "",
    coats: null,
    productKey: null,
    lengthRefs: [],
    widthRefs: [],
    multiplier: 1,
    count: null,
    excelSheet: null,
    excelRow: null,
    excelCol: null,
    photoSurfaceId: null,
    estimate: null,
    estimateBasis: null,
    sheet: null,
    note: null,
    included: true,
    override: null,
    addedBy: "fieldquo",
    ...fields,
  };
}

/**
 * @param model       the sanitised model
 * @param takeoff     buildTakeoff() over the sheets the painting read used
 * @param sides       the painting sides the quote is for
 * @param itemKeys    the company book's substrate keys
 * @param computedOf  (model) → computeProject(model, ctx) — injected so this
 *                    file need not know the read's dimensions or excel
 * @param request     the client's request — which state of the building a
 *                    set drawn as existing and as proposed is priced on
 * @returns {{ model, added: string[], access: number }}
 */
export function backfillFromTakeoff(model, takeoff, { sides = ["interior", "exterior"], itemKeys = new Set(), computedOf, request = null }) {
  if (!model || !takeoff || typeof computedOf !== "function") return { model, added: [], access: 0 };
  const m = JSON.parse(JSON.stringify(model));
  m.areas = Array.isArray(m.areas) ? m.areas : [];
  m.surfaces = Array.isArray(m.surfaces) ? m.surfaces : [];
  m.access = Array.isArray(m.access) ? m.access : [];
  m.assumptions = Array.isArray(m.assumptions) ? m.assumptions : [];
  const added = [];
  const before = computedOf(m);
  const areaSide = new Map((before?.areas || []).map((a) => [a.id, a.side]));
  const measuredBySide = { interior: 0, exterior: 0 };
  for (const s of before?.surfaces || []) {
    if (s.active && s.quantity?.value > 0 && s.quantity.unit === "sqft") measuredBySide[surfaceSide(s, areaSide.get(s.areaId))] += s.quantity.value;
  }
  let n = m.surfaces.length;
  const nextId = () => {
    n += 1;
    while (m.surfaces.some((s) => s.id === `s${n}`)) n += 1;
    return `s${n}`;
  };
  const areaFor = (name, side) => {
    const found = m.areas.find((a) => a.name === name && a.side === side);
    if (found) return found.id;
    let k = m.areas.length + 1;
    while (m.areas.some((a) => a.id === `a${k}m`)) k += 1;
    const id = `a${k}m`;
    m.areas.push({ id, name: String(name).slice(0, 80), level: null, side, included: true });
    return id;
  };
  // One surface per room or wall, not per drawing of it: the nave on three
  // sheets is one nave, from its best measurement, and a room drawn only on
  // the proposed plans is not drafted into a price of the building as it
  // stands (lib/planRead/sameSurface.js).
  const plan = sameSurfacePlan(takeoff, { request, planState: m.planState || null });
  const faces = [...(takeoff.faces?.values() || [])].filter((f) => f.measured && !plan.out.has(f.id) && (plan.groupOf.get(f.id)?.keep ?? f.id) === f.id);
  const heights = [...(takeoff.heights?.values() || [])].filter((h) => h.measured);
  for (const side of sides) {
    if (measuredBySide[side] > 0) continue;
    if (side === "exterior" && itemKeys.has("siding_trim")) {
      const walls = faces.filter((f) => !f.room && f.side === "exterior" && f.netSqft > 0);
      for (const f of walls) {
        const areaId = areaFor(f.view || f.sheet, "exterior");
        m.surfaces.push(blankSurface(nextId(), { areaId, label: f.name, itemKey: "siding_trim", sheet: f.sheet, faceRefs: [f.id], faceMeasure: "net_area", note: f.material ? `Material: ${f.material}` : null }));
        added.push(f.name);
      }
      if (walls.length) m.assumptions.push("The outside quantities are FieldQuo's own measurements of the elevations — the read listed no outside surface with a quantity. Check them against the sheets.");
    }
    if (side === "interior" && itemKeys.has("walls")) {
      const rooms = faces.filter((f) => f.room && f.side === "interior" && (f.perimeterFt > 0 || f.floorSqft > 0));
      const h = HEIGHT_PREFERENCE.map((k) => heights.find((x) => x.kind === k)).find(Boolean) || null;
      for (const f of rooms) {
        const areaId = areaFor(f.name, "interior");
        if (f.perimeterFt > 0) {
          m.surfaces.push(blankSurface(nextId(), { areaId, label: `${f.name} — walls`, itemKey: "walls", sheet: f.sheet, faceRefs: [f.id], faceMeasure: "walls", ...(h ? { heightRef: h.id } : {}) }));
          added.push(`${f.name} walls`);
        }
        if (f.floorSqft > 0 && itemKeys.has("ceiling")) {
          m.surfaces.push(blankSurface(nextId(), { areaId, label: `${f.name} — ceiling`, itemKey: "ceiling", sheet: f.sheet, faceRefs: [f.id], faceMeasure: "ceiling", ...(h ? { heightRef: h.id } : {}) }));
          added.push(`${f.name} ceiling`);
        }
      }
      if (rooms.length) m.assumptions.push(`The inside quantities are FieldQuo's own measurements of the plans${h ? `, to the height on ${h.sheet} (${h.label})` : ", to an assumed storey height"} — the read listed no inside surface with a quantity. Check them against the sheets.`);
    }
  }
  // Access for high work the read did not list.
  const after = computedOf(m);
  const extra = missingAccess(after);
  for (const a of extra) m.access.push({ id: `x${m.access.length + 1}`, ...a });
  return { model: m, added, access: extra.length };
}
