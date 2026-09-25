// lib/measure/reuseTakeoffs.js
//
// The six trades with no calculator of their own — flooring, tile, drywall,
// siding, fencing, concrete — measured with the calculators that already
// exist, so a service's template lines ("Add with its template lines") open
// with their quantities filled instead of at zero.
//
// The owner (2026-09-25): "for Flooring, tile, drywall, siding, fencing,
// concrete — no calculator yet… we could use the room takeoff… that measures
// the surface area and floor (ceiling)". Commit 160dfebc mapped the keys
// (lib/services/measurementKeys.js TRADE_MEASUREMENTS); this is the builder
// half it left owed.
//
// ── What each trade reuses ─────────────────────────────────────────────────
//
//   flooring_install  the ROOM takeoff — paint's own geometry
//   tiling            (lib/pricing/paintTakeoff.js areaGeometry: W × L × H, or
//   drywall_install   a single wall run × height, with the strip overrides)
//                     per room, with the surfaces the trade works ticked
//   siding            the same rooms, measured as wall runs (elevations), with
//                     a gable triangle and the openings taken off; the net
//                     area fills the siding takeoff's own `sqft` box
//   fence_services    the TRACER's outline length (PolygonMeasure via
//                     LotAreaMeasure) → the intake's Linear Feet box
//   concrete          the tracer's area → the intake's Square Footage box
//
// measureTracedArea (lib/estimate/tracedArea.js) was read for a `kind: "wall"`
// or `kind: "line"`: its `kind` only picks the outline colour on the still and
// it returns an area, never a length or a wall. So the fence length is the
// canvas outline's perimeter (usePolygonMeasure totals.perimeterFt, the figure
// the lawn edging already uses), and no satellite source measures a wall —
// siding walls are measured as elevations.
//
// ── Nothing here prices ────────────────────────────────────────────────────
//
// These takeoffs produce FIGURES. The template lines supply the price and
// cost (the owner's rule for templates: "the calculator produces the
// quantity, the line supplies price and cost"). So none of these trades is
// added to lib/pricing/takeoffTrades.js — that list means "the takeoff's
// output IS the group's lines", and a trade in it with no price book would
// price nothing and hide the line table's seeded line. Consequently
// keysPricedByGroup holds nothing back on them: there is no second bill for
// a template line to duplicate. Siding is the exception that proves it: its
// takeoff DOES price the square feet, which is why lib/quotes/
// serviceTemplateLines.js already holds back `wallSqft` on a siding group, and
// the walls measured here only fill that same box.
//
// ── Openings ───────────────────────────────────────────────────────────────
//
// Painting prices GROSS wall area (paintTakeoff.js explains why). Drywall,
// tile and siding are bought by the net area: a 3 × 7 door is 21 sq ft of
// board nobody hangs. So openings are deducted HERE, from the walls of the
// room they are in, and never below zero; paint's areaGeometry is called
// unchanged.
//
// ── Waste — per material, and never twice ──────────────────────────────────
//
// A template's material line carries the company's usual waste (lib/services/
// templates.js wastePct). A job differs — herringbone wastes more than a
// straight lay — so each material's waste can be stated on the takeoff. The
// rule, carried as `wastePct` on each figure this module exports:
//
//   • no waste stated     → the figure goes out net, the template line's own
//                           waste applies (exactly what happens today);
//   • a waste stated      → it REPLACES the template line's waste on material
//                           lines keyed to that figure (serviceTemplateLines.js
//                           expandServiceTemplate) — never added to it;
//   • a count that already includes its waste (drywall sheets, concrete
//     yards) → exported with wastePct 0, so a template line keyed to it adds
//     none on top.
//
// Blank is "the template's", not 0: 0 is a statement ("no waste on this job")
// and absence is not (AGENTS.md failure class 5).
//
// Pure — no React, no database. scripts/check-reuse-takeoffs.mjs executes it
// against hostile input (unit conversions, waste, openings, zero and huge).

import { areaGeometry } from "@/lib/pricing/paintTakeoff";

/** The discriminator on a group's takeoff for the room trades. */
export const ROOM_MEASURE_MODEL = "room_measure";

/** The waste a takeoff may state, the same ceiling a template line has. */
export const MAX_TAKEOFF_WASTE_PCT = 50;

/** Drywall sheets on offer: 4 × 8 and 4 × 12, by the square feet one covers. */
export const DRYWALL_SHEETS = Object.freeze({ 32: "4 × 8", 48: "4 × 12" });
export const DEFAULT_SHEET_SQFT = 32;

/** Fence posts: one every 8 ft of run, plus the one that closes the run. */
export const FENCE_POST_SPACING_FT = 8;

/** Ready-mix is sold by the quarter yard; a volume is rounded UP to one. */
export const CONCRETE_YARD_STEP = 0.25;

/** The fence and concrete intake boxes the tracer fills (app/data/quoteIntakeFields.js). */
export const FENCE_LENGTH_FIELD = "linearFeet";
export const CONCRETE_AREA_FIELD = "squareFootage";
export const CONCRETE_THICKNESS_FIELD = "thicknessInches";
export const CONCRETE_WASTE_FIELD = "wasteFactorPercent";

// surface → the geometry figure it contributes.
const SURFACE_KEY = { floor: "floorSqft", walls: "wallSqft", ceiling: "ceilingSqft", perimeter: "linearFt" };

/**
 * The room trades: which surfaces a room card offers, which are ticked on a
 * new room, which figures carry a stated waste, and what the trade's generic
 * area (`areaSqFt`, the key the seeded flooring templates use) is made of.
 *
 * flooring_install's generic area is the FLOOR only, even with a backsplash
 * measured beside it: the seeded flooring lines keyed to areaSqFt are floor
 * install and floor material, and billing LVP over a backsplash is the wrong
 * figure with a confident label. Tile's generic area is everything tiled.
 */
export const ROOM_MEASURE_TRADES = Object.freeze({
  flooring_install: {
    surfaces: ["floor", "perimeter", "walls"],
    ticked: { floor: true, perimeter: true, walls: false },
    waste: ["floorSqft", "linearFt", "wallSqft"],
    area: ["floorSqft"],
    openings: true,
  },
  tiling: {
    surfaces: ["floor", "walls", "perimeter"],
    ticked: { floor: true, walls: false, perimeter: false },
    waste: ["floorSqft", "wallSqft", "linearFt"],
    area: ["floorSqft", "wallSqft"],
    openings: true,
  },
  drywall_install: {
    surfaces: ["walls", "ceiling"],
    ticked: { walls: true, ceiling: true },
    waste: [],
    area: ["wallSqft", "ceilingSqft"],
    openings: true,
    sheets: true,
  },
});

/** The trades whose builder panel is the tracer, and the intake box it fills. */
export const TRACE_MEASURE_TRADES = Object.freeze({
  fence_services: { edgeField: FENCE_LENGTH_FIELD },
  concrete: { areaField: CONCRETE_AREA_FIELD },
});

export function isRoomMeasureTrade(key) {
  return typeof key === "string" && Object.hasOwn(ROOM_MEASURE_TRADES, key);
}
export function isTraceMeasureTrade(key) {
  return typeof key === "string" && Object.hasOwn(TRACE_MEASURE_TRADES, key);
}
/** Every trade this module measures, siding included. */
export const REUSE_TAKEOFF_TRADES = Object.freeze([...Object.keys(ROOM_MEASURE_TRADES), "siding", ...Object.keys(TRACE_MEASURE_TRADES)]);

/* ── Small arithmetic ──────────────────────────────────────────────────── */

// Positive and finite, else 0. Dimensions arrive from stored JSON and from
// inputs; "abc", -10 and Infinity are all "not measured".
const pos = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const list = (v) => (Array.isArray(v) ? v : []);
// A dimension past a mile is a typo, not a room. Capped so a stray 1e308
// cannot turn every downstream product into Infinity.
const MAX_FT = 5280;
const dim = (v) => Math.min(MAX_FT, pos(v));

/** A stated waste %, or null for "not stated" (the template's applies). */
export function statedWaste(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(MAX_TAKEOFF_WASTE_PCT, Math.round(n * 10) / 10);
}

/* ── Blank shapes ──────────────────────────────────────────────────────── */

/** A new room for a trade: paint's geometry fields, the trade's ticks, no openings. */
export function newMeasureRoom(trade, { label = "", measurement = "area" } = {}) {
  const cfg = ROOM_MEASURE_TRADES[trade];
  return {
    label,
    measurement: measurement === "wall" ? "wall" : "area",
    // No seeded dimensions — a room name is not a measurement.
    lengthFt: 0,
    widthFt: 0,
    heightFt: 0,
    linearFt: 0,
    linearFtOverride: null,
    wallSqftOverride: null,
    ceilingSqftOverride: null,
    floorSqftOverride: null,
    surfaces: { ...(cfg?.ticked || { walls: true }) },
    openings: [],
  };
}

/** A siding elevation: a wall run × height, with an optional gable on top. */
export function newSidingWall(label = "") {
  return { ...newMeasureRoom(null, { label, measurement: "wall" }), surfaces: { walls: true }, gableRiseFt: 0 };
}

/**
 * An opening row. The sizes a new row opens with are a standard exterior
 * door (3 × 7 ft) and a common window (3 × 5 ft) — on screen and typed over,
 * the way a new stair section opens with a staircase's usual counts.
 */
export function newOpening(kind = "door") {
  if (kind === "window") return { kind: "window", count: 1, widthFt: 3, heightFt: 5 };
  if (kind === "other") return { kind: "other", count: 1, widthFt: 0, heightFt: 0 };
  return { kind: "door", count: 1, widthFt: 3, heightFt: 7 };
}

/** A blank room takeoff for a trade. Drywall states 10% sheet waste — see sheets(). */
export function newRoomMeasure(trade) {
  if (!isRoomMeasureTrade(trade)) return null;
  const cfg = ROOM_MEASURE_TRADES[trade];
  return {
    model: ROOM_MEASURE_MODEL,
    rooms: [newMeasureRoom(trade)],
    waste: Object.fromEntries(cfg.waste.map((k) => [k, null])),
    ...(cfg.sheets ? { sheetSqft: DEFAULT_SHEET_SQFT, sheetWastePct: 10 } : {}),
  };
}

/* ── One room ──────────────────────────────────────────────────────────── */

/** Square feet of a room's openings: Σ count × width × height. */
export function openingsSqft(room) {
  let total = 0;
  for (const o of list(room?.openings)) {
    if (!o || typeof o !== "object") continue;
    // A count is whole; 2.7 doors is 2 doors mistyped, not 2.7.
    const count = Math.min(500, Math.floor(pos(o.count)));
    total += count * dim(o.widthFt) * dim(o.heightFt);
  }
  return round2(total);
}

/**
 * One room's figures, for the surfaces ticked on it.
 *
 * The gross geometry is paint's areaGeometry — the same numbers the room
 * strip shows and the estimator types over. On top of it: the gable of a
 * siding wall (½ × run × rise, only on a single-wall run), and the openings,
 * taken off the walls and never below zero. A surface not ticked contributes
 * nothing; its figure is 0 in the result and absent downstream.
 */
export function roomFigures(room, { surfaces = null } = {}) {
  const r = room && typeof room === "object" ? room : {};
  const clean = {
    ...r,
    lengthFt: dim(r.lengthFt),
    widthFt: dim(r.widthFt),
    heightFt: dim(r.heightFt),
    linearFt: dim(r.linearFt),
    surfaceSqft: Math.min(MAX_FT * MAX_FT, pos(r.surfaceSqft)),
  };
  const geo = areaGeometry(clean);
  const ticks = surfaces || (r.surfaces && typeof r.surfaces === "object" ? r.surfaces : {});
  const on = (s) => ticks[s] === true;
  const single = r.measurement === "wall";
  const gable = single ? round2(0.5 * dim(r.linearFt) * dim(r.gableRiseFt)) : 0;
  const grossWall = on("walls") ? round2(geo.wallSqft + gable) : 0;
  const openings = on("walls") ? Math.min(openingsSqft(r), grossWall) : 0;
  return {
    floorSqft: on("floor") ? geo.floorSqft : 0,
    wallSqft: round2(Math.max(0, grossWall - openings)),
    ceilingSqft: on("ceiling") ? geo.ceilingSqft : 0,
    linearFt: on("perimeter") ? geo.linearFt : 0,
    grossWallSqft: grossWall,
    gableSqft: on("walls") ? gable : 0,
    openingsSqft: round2(openings),
  };
}

/* ── The takeoff ───────────────────────────────────────────────────────── */

/** Sheets of drywall: ceil(board area × (1 + waste) ÷ sheet), or 0 with no board. */
export function drywallSheets(boardSqft, sheetSqft = DEFAULT_SHEET_SQFT, wastePct = null) {
  const area = pos(boardSqft);
  const per = Object.hasOwn(DRYWALL_SHEETS, String(sheetSqft)) ? Number(sheetSqft) : DEFAULT_SHEET_SQFT;
  if (!(area > 0)) return 0;
  const w = statedWaste(wastePct) ?? 0;
  // The epsilon keeps 12.000000001 sheets from buying a thirteenth.
  return Math.ceil((area * (1 + w / 100)) / per - 1e-9);
}

/**
 * Every figure a room takeoff holds, summed over its rooms:
 *   { rooms: [roomFigures…], floorSqft, wallSqft, ceilingSqft, linearFt,
 *     openingsSqft, areaSqFt, waste: {key: stated|null},
 *     sheets?: { sheetSqft, label, wastePct, boardSqft, count } }
 * Null for a takeoff that is not a room measure, or a trade that has none.
 */
export function roomMeasureFigures(takeoff, trade) {
  if (!isRoomMeasureTrade(trade)) return null;
  if (!takeoff || typeof takeoff !== "object" || takeoff.model !== ROOM_MEASURE_MODEL) return null;
  const cfg = ROOM_MEASURE_TRADES[trade];
  const allowed = new Set(cfg.surfaces);
  const sum = { floorSqft: 0, wallSqft: 0, ceilingSqft: 0, linearFt: 0, openingsSqft: 0 };
  const rooms = [];
  // A room ticks only surfaces its trade offers: a stored "ceiling: true" on
  // a flooring room is not a ceiling anybody is floored.
  for (const room of list(takeoff.rooms).slice(0, 200)) {
    const ticks = {};
    const raw = room && typeof room === "object" && room.surfaces && typeof room.surfaces === "object" ? room.surfaces : {};
    for (const s of allowed) ticks[s] = raw[s] === true;
    const f = roomFigures(room, { surfaces: ticks });
    rooms.push(f);
    for (const k of Object.keys(sum)) sum[k] += f[k];
  }
  for (const k of Object.keys(sum)) sum[k] = round2(sum[k]);
  const waste = {};
  const rawWaste = takeoff.waste && typeof takeoff.waste === "object" ? takeoff.waste : {};
  for (const k of cfg.waste) waste[k] = statedWaste(rawWaste[k]);
  const out = {
    rooms,
    ...sum,
    areaSqFt: round2(cfg.area.reduce((s, k) => s + sum[k], 0)),
    waste,
  };
  if (cfg.sheets) {
    const sheetSqft = Object.hasOwn(DRYWALL_SHEETS, String(takeoff.sheetSqft)) ? Number(takeoff.sheetSqft) : DEFAULT_SHEET_SQFT;
    const w = statedWaste(takeoff.sheetWastePct);
    const board = round2(sum.wallSqft + sum.ceilingSqft);
    out.sheets = { sheetSqft, label: DRYWALL_SHEETS[sheetSqft], wastePct: w, boardSqft: board, count: drywallSheets(board, sheetSqft, w) };
  }
  return out;
}

/**
 * The waste the generic area carries when it is made of several figures
 * (tile: floor + wall): the area-weighted mean of their stated wastes, which
 * is exact — area × (1 + w̄) = Σ part × (1 + wᵢ). Null when any part with an
 * area has no stated waste: half a statement is not one.
 */
function blendedWaste(parts) {
  const live = parts.filter((p) => p.value > 0);
  if (!live.length || live.some((p) => p.waste === null)) return null;
  const total = live.reduce((s, p) => s + p.value, 0);
  const w = live.reduce((s, p) => s + p.value * p.waste, 0) / total;
  return Math.round(w * 1000) / 1000;
}

/**
 * What a room takeoff exports to the template lines: { key: { value,
 * wastePct? } } by the registry's names, positive figures only (zero is
 * absent on a builder form — nobody measured it). `wastePct` present only
 * when the takeoff states one (see the header).
 */
export function roomMeasureMeasurements(takeoff, trade) {
  const f = roomMeasureFigures(takeoff, trade);
  if (!f) return {};
  const cfg = ROOM_MEASURE_TRADES[trade];
  const out = {};
  const put = (key, value, wastePct = null) => {
    if (!(value > 0)) return;
    out[key] = { value: round2(value), ...(wastePct !== null ? { wastePct } : {}) };
  };
  for (const s of cfg.surfaces) {
    const key = SURFACE_KEY[s];
    put(key, f[key], Object.hasOwn(f.waste, key) ? f.waste[key] : null);
  }
  put("areaSqFt", f.areaSqFt, blendedWaste(cfg.area.map((k) => ({ value: f[k], waste: Object.hasOwn(f.waste, k) ? f.waste[k] : null }))));
  // Sheets carry their waste inside the count; a line keyed to them adds none.
  if (f.sheets && f.sheets.count > 0) put("drywallSheets", f.sheets.count, f.sheets.wastePct === null ? null : 0);
  return out;
}

/* ── Siding walls ──────────────────────────────────────────────────────── */

/**
 * The elevations a siding takeoff measured: { walls: [roomFigures…],
 * grossSqft, gableSqft, openingsSqft, netSqft } — netSqft is what fills the
 * siding takeoff's `sqft` box. Null with no walls listed.
 */
export function sidingWallsFigures(walls) {
  const rows = list(walls).slice(0, 200);
  if (!rows.length) return null;
  const out = { walls: [], grossSqft: 0, gableSqft: 0, openingsSqft: 0, netSqft: 0 };
  for (const w of rows) {
    const f = roomFigures(w, { surfaces: { walls: true } });
    out.walls.push(f);
    out.grossSqft += f.grossWallSqft;
    out.gableSqft += f.gableSqft;
    out.openingsSqft += f.openingsSqft;
    out.netSqft += f.wallSqft;
  }
  for (const k of ["grossSqft", "gableSqft", "openingsSqft", "netSqft"]) out[k] = round2(out[k]);
  return out;
}

/* ── Fence and concrete, from the intake the tracer fills ──────────────── */

/** Posts for a run: one every FENCE_POST_SPACING_FT, plus the closing post. */
export function fencePosts(lengthFt) {
  const L = Math.min(MAX_FT * 10, pos(lengthFt));
  if (!(L > 0)) return 0;
  return Math.ceil(L / FENCE_POST_SPACING_FT - 1e-9) + 1;
}

/**
 * A fence group's figures, off its intake (typed or traced into Linear
 * Feet): the run as `edgingFt` (the key the seeded fence templates use) and
 * `perimeterLf` (the generic length), and the post count. Gate counts are
 * intake boxes under their own registered names and are read by the generic
 * intake pass — not here, so they are never read twice.
 */
export function fenceMeasurements(intakeValues) {
  const iv = intakeValues && typeof intakeValues === "object" ? intakeValues : {};
  const L = Math.min(MAX_FT * 10, pos(iv[FENCE_LENGTH_FIELD]));
  if (!(L > 0)) return {};
  const v = round2(L);
  return { edgingFt: { value: v }, perimeterLf: { value: v }, fencePosts: { value: fencePosts(L) } };
}

/**
 * Cubic yards of concrete: sq ft × (inches ÷ 12) ÷ 27, with the stated waste,
 * rounded UP to the quarter yard a plant sells. 0 without an area or a
 * thickness — a slab with no thickness has no volume, and assuming 4 in would
 * be a statement nobody made.
 */
export function concreteCuYd(areaSqft, thicknessIn, wastePct = null) {
  const a = Math.min(MAX_FT * MAX_FT, pos(areaSqft));
  const t = Math.min(48, pos(thicknessIn));
  if (!(a > 0) || !(t > 0)) return 0;
  const w = statedWaste(wastePct) ?? 0;
  const yards = ((a * (t / 12)) / 27) * (1 + w / 100);
  return Math.round(Math.ceil(yards / CONCRETE_YARD_STEP - 1e-9) * CONCRETE_YARD_STEP * 100) / 100;
}

/**
 * A concrete group's figures, off its intake: the slab area as `areaSqft`
 * (the traced-outline key) and `areaSqFt` (the generic one), and the yards
 * at the thickness and waste the intake states. The waste is the concrete's
 * — it is inside the yards (wastePct 0 on them) and is not applied to the
 * area, whose lines (mesh, finishing) carry their own.
 */
export function concreteMeasurements(intakeValues) {
  const iv = intakeValues && typeof intakeValues === "object" ? intakeValues : {};
  const area = Math.min(MAX_FT * MAX_FT, pos(iv[CONCRETE_AREA_FIELD]));
  if (!(area > 0)) return {};
  const v = round2(area);
  const out = { areaSqft: { value: v }, areaSqFt: { value: v } };
  const w = statedWaste(iv[CONCRETE_WASTE_FIELD]);
  const yd = concreteCuYd(area, iv[CONCRETE_THICKNESS_FIELD], w);
  if (yd > 0) out.concreteCuYd = { value: yd, ...(w !== null ? { wastePct: 0 } : {}) };
  return out;
}
