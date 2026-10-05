// lib/planRead/projectModel.js
//
// The project overview a drawing read produces — areas, surfaces, access,
// complexity, assumptions, questions — and the arithmetic that turns it into
// quantities, every one with its source.
//
// ══ Who decides what ═══════════════════════════════════════════════════════
//
//   the MODEL   says which printed dimensions belong to which surface
//               (lengthRefs / widthRefs are ids from lib/planRead/sheetFacts.js),
//               which spreadsheet row states a quantity, which photo surface
//               shows it, which catalogue item it is, and — only when none of
//               those exist — an estimate with its basis.
//   THIS FILE   computes the quantity from those references, picks the
//               source by a fixed order, labels what is estimated, and turns
//               a disagreement between sources into a question.
//   the ENGINE  prices it (lib/planRead/pricing.js → lib/pricing/paintTakeoff.js).
//
// No field the model fills is a price, and the sanitisers below copy fields
// by name, so a "price" the model volunteers has nowhere to land.
//
// ══ Source order ═══════════════════════════════════════════════════════════
//
//   measured   the estimator traced it on the sheet (the measure tool)
//   drawing    printed dimensions, computed here
//   face       the first pass's own takeoff — faces, rooms and heights the
//              measurement pass located on the sheets, scaled and checked in
//              code (lib/planRead/takeoff.js) — printed figures first
//   excel      a number in a cited spreadsheet cell
//   photo      reference-object scaling (lib/planRead/photoScale.js)
//   estimate   the model's own figure, with its basis
//
// Only "measured" and a drawing computed from vector text are NOT estimates.
// A drawing quantity that leans on a dimension read off a SCANNED sheet, or on
// a bare number assumed to be millimetres, is marked estimated too.
//
// When the drawing and the spreadsheet or a photo both speak and differ by
// more than CONFLICT_RATIO, the drawing wins and the disagreement becomes a
// question for the estimator — never silently averaged.
//
// Pure: imports only other pure files.

import { measureForUnit, unitForSubstrate, EQUIPMENT_KINDS, EQUIPMENT_LABELS } from "./catalogue";
import { photoSurfaceQuantity, groupingSentence } from "./photoScale";
import { formatFeet } from "./dimensions";
import { faceQuantity, bandsWithoutFaces, FACE_MEASURES } from "./takeoff";
import { cleanAssumed, ASSUMED } from "./firstPassRules";
import { ACCESS_REASONS, accessReasonLabel } from "./accessReasons";

export const CONFLICT_RATIO = 0.25;
export const MODEL_VERSION = 1;
const MAX_SURFACES = 120;
const MAX_AREAS = 60;

const text = (s, max = 200) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const nullableText = (s, max) => text(s, max) || null;
const posNum = (v, max) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
const posInt = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null);
const r = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Every dimension the read can cite, by id. Vector dimensions come from the
 * sheet's text; a scanned sheet's dimensions were READ by the model off the
 * image (`scanDims`) and carry fromScan, which makes anything built on them an
 * estimate.
 */
export function buildDimIndex(sheets) {
  const index = new Map();
  for (const s of Array.isArray(sheets) ? sheets : []) {
    const name = s?.sheetNumber || `Page ${s?.page}`;
    for (const d of Array.isArray(s?.dims) ? s.dims : []) index.set(d.id, { ...d, sheet: name, fromScan: false });
    for (const d of Array.isArray(s?.scanDims) ? s.scanDims : []) index.set(d.id, { ...d, sheet: name, fromScan: true });
  }
  return index;
}

/** A number in a spreadsheet cell: "2,400 SF" → 2400. Null when none. */
export function cellNumber(cell) {
  const m = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/.exec(String(cell ?? ""));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function excelCell(excel, row, col, sheet = null) {
  if (!Number.isInteger(row) || typeof col !== "string") return null;
  // The named sheet when there is one; otherwise the first sheet holding
  // that row (a one-sheet workbook, which is the usual case).
  const sheets = (excel?.sheets || []).filter((s) => !sheet || s.name === sheet);
  for (const s of sheets) {
    const hit = s.rows.find((x) => x.r === row);
    if (hit && Object.prototype.hasOwnProperty.call(hit.cells, col)) return { sheet: s.name, value: hit.cells[col] };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SANITISING WHAT THE MODEL RETURNED
// ═══════════════════════════════════════════════════════════════════════════

function cleanRefs(list, dimIds) {
  const out = [];
  for (const id of Array.isArray(list) ? list : []) {
    if (typeof id === "string" && dimIds.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= 12) break;
  }
  return out;
}

function cleanSurface(s, ctx, idFallback) {
  const { dimIds, itemKeys, productKeys, photoIds, areaIds, excel } = ctx;
  const itemKey = typeof s?.itemKey === "string" && itemKeys.has(s.itemKey) ? s.itemKey : null;
  if (!itemKey) return null;
  const excelRow = posInt(s.excelRow, 1_000_000);
  const excelCol = typeof s.excelCol === "string" && /^[A-Z]{1,3}$/.test(s.excelCol) ? s.excelCol : null;
  const excelSheet = typeof s.excelSheet === "string" ? text(s.excelSheet, 60) || null : null;
  const hasExcel = excelRow && excelCol && excelCell(excel, excelRow, excelCol, excelSheet);
  return {
    id: text(s.id, 24) || idFallback,
    areaId: typeof s.areaId === "string" && areaIds.has(s.areaId) ? s.areaId : null,
    label: text(s.label, 80) || itemKey,
    itemKey,
    coats: posInt(s.coats, 4),
    productKey: typeof s.productKey === "string" && productKeys.has(s.productKey) ? s.productKey : null,
    lengthRefs: cleanRefs(s.lengthRefs, dimIds),
    widthRefs: cleanRefs(s.widthRefs, dimIds),
    multiplier: posNum(s.multiplier, 100) ?? 1,
    count: posInt(s.count, 100000),
    excelSheet: hasExcel ? excelSheet : null,
    excelRow: hasExcel ? excelRow : null,
    excelCol: hasExcel ? excelCol : null,
    photoSurfaceId: typeof s.photoSurfaceId === "string" && photoIds.has(s.photoSurfaceId) ? s.photoSurfaceId : null,
    estimate: posNum(s.estimate, 1_000_000),
    estimateBasis: nullableText(s.estimateBasis, 160),
    sheet: nullableText(s.sheet, 40),
    note: nullableText(s.note, 200),
    included: s.included === false ? false : true,
    override: null,
    // The first pass's takeoff: which measured faces/rooms this surface is,
    // read how, and to which measured height. Only when the read has a
    // takeoff and the model cited one — a read without one keeps exactly the
    // surface it always had (md5-pinned in check:plan-deep-read).
    ...takeoffRefs(s, ctx),
  };
}

/** faceRefs / faceMeasure / heightRef, kept only when they name something real. */
function takeoffRefs(s, { faceIds, heightIds } = {}) {
  if (!faceIds && !heightIds) return {};
  const out = {};
  const refs = (Array.isArray(s?.faceRefs) ? s.faceRefs : []).filter((id) => typeof id === "string" && faceIds?.has(id)).slice(0, 20);
  if (refs.length) out.faceRefs = [...new Set(refs)];
  if (refs.length && FACE_MEASURES.includes(s?.faceMeasure)) out.faceMeasure = s.faceMeasure;
  if (typeof s?.heightRef === "string" && (heightIds?.has(s.heightRef) || faceIds?.has(s.heightRef))) out.heightRef = s.heightRef;
  return out;
}

function cleanAccess(a, { dimIds, areaIds }) {
  if (!a || !EQUIPMENT_KINDS.includes(a.equipment)) return null;
  return {
    areaId: typeof a.areaId === "string" && areaIds.has(a.areaId) ? a.areaId : null,
    equipment: a.equipment,
    workingHeightFt: posNum(a.workingHeightFt, 400),
    heightRef: typeof a.heightRef === "string" && dimIds.has(a.heightRef) ? a.heightRef : null,
    reason: text(a.reason, 200),
    included: true,
    // The estimator's price, typed on the screen — never the model's. Null
    // until they type one; an unpriced access line is drafted as unpriced.
    price: null,
  };
}

/**
 * The synthesis pass's JSON → the stored model. Pure.
 *
 * @param raw   the model's object (already schema-checked by provider.js)
 * @param ctx   { dimIds: Set, itemKeys: Set, productKeys: Set,
 *                photoIds: Set, excel }
 */
export function sanitiseSynthesis(raw, ctx) {
  const areas = [];
  for (const a of Array.isArray(raw?.areas) ? raw.areas : []) {
    if (areas.length >= MAX_AREAS) break;
    const id = text(a?.id, 24);
    const name = text(a?.name, 80);
    if (!id || !name || areas.some((x) => x.id === id)) continue;
    areas.push({ id, name, level: nullableText(a.level, 40), side: a.side === "exterior" ? "exterior" : "interior", included: a.include === false ? false : true });
  }
  const areaIds = new Set(areas.map((a) => a.id));
  const full = { ...ctx, areaIds };
  const surfaces = [];
  for (const [i, s] of (Array.isArray(raw?.surfaces) ? raw.surfaces : []).entries()) {
    if (surfaces.length >= MAX_SURFACES) break;
    const clean = cleanSurface(s, full, `s${i + 1}`);
    if (!clean || surfaces.some((x) => x.id === clean.id)) continue;
    surfaces.push(clean);
  }
  const access = (Array.isArray(raw?.access) ? raw.access : [])
    .map((a) => cleanAccess(a, full))
    .filter(Boolean)
    .slice(0, 20)
    .map((a, i) => ({ id: `x${i + 1}`, ...a }));
  const level = ["low", "medium", "high", "very_high"].includes(raw?.complexity?.level) ? raw.complexity.level : "medium";
  const list = (v, n, max = 200) => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : []);
  return {
    version: MODEL_VERSION,
    summary: text(raw?.summary, 600),
    buildingType: text(raw?.buildingType, 60),
    commercial: raw?.commercial === true,
    areas,
    surfaces,
    access,
    complexity: { level, factors: list(raw?.complexity?.factors, 8) },
    assumptions: list(raw?.assumptions, 20),
    exclusions: list(raw?.exclusions, 20),
    questions: list(raw?.questions, 12).map((q, i) => ({ id: `q${i + 1}`, text: q, source: "model", resolved: false })),
    // What the first pass PRICED ON instead of asking (substrate, colours,
    // heritage, site hours, occupied) — lib/planRead/firstPassRules.js. Only
    // when the model stated it: a read from before keeps its old shape.
    ...(raw?.assumed ? { assumed: cleanAssumed(raw.assumed, "ai") } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUANTITIES
// ═══════════════════════════════════════════════════════════════════════════

const roundFor = (unit, v) => (unit === "lnft" ? r(v, 1) : r(v));

/** " — mm assumed from the metric scale, verify" for a bare number read as a
 *  unit — saying WHICH unit: a UK plan's bare "4.7" is metres, a bare "3800"
 *  millimetres (lib/planRead/dimensions.js). Exported for the trade model. */
export function assumedUnitNote(dims) {
  const units = [...new Set((dims || []).filter((d) => d.unitAssumed).map((d) => d.assumedUnit || "mm"))];
  if (!units.length) return "";
  return ` — ${units.join(" and ")} assumed from the metric scale, verify`;
}

function drawingQuantity(s, unit, dims) {
  const lens = s.lengthRefs.map((id) => dims.get(id)).filter(Boolean);
  const wids = s.widthRefs.map((id) => dims.get(id)).filter(Boolean);
  const measure = measureForUnit(unit);
  if (!lens.length) return null;
  const sum = (list) => list.reduce((n, d) => n + d.feet, 0);
  let value;
  if (measure === "area") {
    if (!wids.length) return null;
    value = sum(lens) * sum(wids) * s.multiplier;
  } else if (measure === "length") {
    value = sum(lens) * s.multiplier;
  } else {
    return null;
  }
  const all = [...lens, ...wids];
  const estimated = all.some((d) => d.fromScan || d.unitAssumed);
  const sheetNames = [...new Set(all.map((d) => d.sheet))].join(", ");
  const part = (list) => list.map((d) => d.raw).join(" + ");
  const mult = s.multiplier !== 1 ? ` × ${r(s.multiplier, 2)}` : "";
  const formula = measure === "area" ? `${part(lens)} × ${part(wids)}${mult}` : `${part(lens)}${mult}`;
  return {
    value: roundFor(unit, value),
    source: "drawing",
    estimated,
    sourceText: `${sheetNames}: ${formula}${all.some((d) => d.fromScan) ? " — read from a scanned sheet, estimated, verify" : ""}${assumedUnitNote(all)}`,
    refs: all.map((d) => ({ id: d.id, raw: d.raw, sheet: d.sheet, x: d.x, y: d.y })),
  };
}

function excelQuantity(s, excel) {
  if (!s.excelRow || !s.excelCol) return null;
  const cell = excelCell(excel, s.excelRow, s.excelCol, s.excelSheet);
  const n = cellNumber(cell?.value);
  if (!n) return null;
  return { value: n, source: "excel", estimated: false, sourceText: `Scope sheet "${cell.sheet}" row ${s.excelRow}, column ${s.excelCol}: ${cell.value}` };
}

const differs = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) > CONFLICT_RATIO;

/**
 * One surface's quantity, by the source order in the header. Pure.
 * Returns the chosen quantity and any conflicts against it.
 */
export function surfaceQuantity(s, ctx) {
  const unit = unitForSubstrate(s.itemKey, ctx.book) || "each";
  const dims = ctx.dims || new Map();
  const conflicts = [];
  if (s.override && posNum(s.override.value, 10_000_000)) {
    return {
      quantity: { value: roundFor(unit, s.override.value), unit, source: "measured", estimated: false, sourceText: text(s.override.sourceText, 200) || "Measured on the sheet" },
      conflicts,
    };
  }
  const drawing = drawingQuantity(s, unit, dims);
  // The first pass's takeoff — after printed dimensions the model cited
  // directly, before everything else (header: source order).
  const face = drawing ? null : faceQuantity(s, unit, ctx.takeoff, { metric: ctx.metric !== false });
  const excel = excelQuantity(s, ctx.excel);
  const ps = s.photoSurfaceId ? (ctx.photoRead?.surfaces || []).find((x) => x.id === s.photoSurfaceId) : null;
  const photo = ps ? photoSurfaceQuantity(ps, unit) : null;
  const count = measureForUnit(unit) === "count" && s.count
    ? { value: s.count, source: "count", estimated: true, sourceText: `Counted by FieldQuo AI${s.sheet ? ` on ${s.sheet}` : ""} — estimated, verify` }
    : null;
  const estimate = s.estimate
    ? { value: roundFor(unit, s.estimate), source: "estimate", estimated: true, sourceText: `Estimated — verify${s.estimateBasis ? ` (${s.estimateBasis})` : ""}` }
    : null;

  const photoQ = photo
    ? { value: roundFor(unit, photo.value), low: photo.low, high: photo.high, source: "photo", estimated: true, sourceText: photo.sourceText, photos: photo.photos }
    : null;

  const drawn = drawing || face;
  const chosen = drawn || excel || count || photoQ || estimate;
  if (!chosen) return { quantity: { value: 0, unit, source: "none", estimated: true, sourceText: "No quantity yet — measure it on the sheet or tell the chat" }, conflicts };

  if (drawn && excel && differs(drawn.value, excel.value)) {
    conflicts.push(`${s.label}: the drawings give ${drawn.value} ${unit} (${drawn.sourceText}) but the scope sheet says ${excel.value} (${excel.sourceText}). The drawing figure is used — which is right?`);
  }
  if ((drawn || excel) && photoQ && differs((drawn || excel).value, photoQ.value)) {
    conflicts.push(`${s.label}: ${drawn ? "the drawings" : "the scope sheet"} give ${(drawn || excel).value} ${unit}, but photo ${photo.photo} suggests about ${photoQ.value} (${photo.reference}). The ${drawn ? "drawing" : "scope sheet"} figure is used — check on site.`);
  }
  return { quantity: { ...chosen, unit }, conflicts };
}

function heightOf(a, dims) {
  const d = a.heightRef ? dims.get(a.heightRef) : null;
  if (d) return { heightFt: d.feet, heightSource: `${d.sheet}: ${d.raw}${d.fromScan ? " — estimated, verify" : ""}` };
  if (a.workingHeightFt) return { heightFt: a.workingHeightFt, heightSource: `about ${formatFeet(a.workingHeightFt)} — estimated, verify` };
  return { heightFt: null, heightSource: null };
}

/**
 * The model, with every quantity computed and every conflict asked. Pure;
 * recomputed on every read, so it can never disagree with the model it
 * came from.
 */
export function computeProject(model, ctx) {
  const m = model && typeof model === "object" ? model : null;
  if (!m) return null;
  const dims = ctx.dims || new Map();
  const areaById = new Map((m.areas || []).map((a) => [a.id, a]));
  const conflictQs = [];
  const surfaces = (m.surfaces || []).map((s) => {
    const area = s.areaId ? areaById.get(s.areaId) : null;
    const { quantity, conflicts } = surfaceQuantity(s, { ...ctx, dims });
    for (const c of conflicts) conflictQs.push(c);
    // Height bands only on a read with a takeoff (the first pass): the share
    // of the quantity in each working-height band, and what the height rests
    // on. A read without one prices exactly as before.
    const height = ctx.takeoff
      ? quantity.source === "face"
        ? { bands: quantity.bands, heightBasis: quantity.heightBasis, topFt: quantity.topFt }
        : bandsWithoutFaces(s, quantity.unit, ctx.takeoff)
      : null;
    return {
      ...s,
      ...(height ? { bands: height.bands, heightBasis: height.heightBasis, heightAssumed: Boolean(height.assumed), topFt: height.topFt || 0 } : {}),
      areaName: area?.name || null,
      // Off when its own switch is off OR its area's is.
      active: s.included !== false && (!area || area.included !== false),
      quantity,
    };
  });
  const access = (m.access || []).map((a) => ({
    ...a,
    label: EQUIPMENT_LABELS[a.equipment] || a.equipment,
    areaName: a.areaId ? areaById.get(a.areaId)?.name || null : null,
    ...heightOf(a, dims),
  }));
  // Every photo surface as the Photos card draws it: its photos, the
  // grouping sentence, the size code worked out from its reference, and —
  // when a surface of the overview links to it AND has drawing dimensions —
  // which sheet won (the photo then speaks to condition only).
  const photoSurfaces = (ctx.photoRead?.surfaces || []).map((p) => {
    const linked = surfaces.filter((s) => s.photoSurfaceId === p.id);
    const drawn = linked.find((s) => s.quantity.source === "drawing" || s.quantity.source === "measured");
    return {
      id: p.id,
      label: p.label,
      photos: p.photos,
      sentence: groupingSentence(p),
      condition: p.condition || null,
      confidence: p.confidence,
      estimate: photoSurfaceQuantity(p, "sqft") || photoSurfaceQuantity(p, "lnft"),
      drawing: drawn ? [...new Set((drawn.quantity.refs || []).map((r) => r.sheet))].join(", ") || drawn.sheet || null : null,
      linkedTo: linked.map((s) => s.id),
    };
  });
  const photoGroups = photoSurfaces.filter((g) => g.sentence);
  const resolved = new Set((m.questions || []).filter((q) => q.resolved).map((q) => q.text));
  const questions = [
    ...(m.questions || []),
    ...conflictQs.filter((t) => !resolved.has(t)).map((t, i) => ({ id: `c${i + 1}`, text: t, source: "conflict", resolved: false })),
  ];
  const estimatedCount = surfaces.filter((s) => s.active && s.quantity.estimated).length;
  // Never a scoped surface at 0 silently: every active one without a quantity
  // is named, and the screen says it is not priced.
  const unmeasured = surfaces.filter((s) => s.active && !(s.quantity.value > 0)).map((s) => ({ id: s.id, label: s.label, areaName: s.areaName }));
  return { ...m, surfaces, access, questions, photoSurfaces, photoGroups, estimatedCount, unmeasured };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANGES — from the chat and from the screen
// ═══════════════════════════════════════════════════════════════════════════

export const CHAT_OPS = Object.freeze([
  "set_surface",
  "add_surface",
  "remove_surface",
  "include_area",
  "exclude_area",
  "add_area",
  "set_access",
  "remove_access",
  "add_assumption",
  "add_exclusion",
  "add_question",
  "resolve_question",
  "set_commercial",
  // The owner's live test (2026-10-05): "I can't manually set labour hours"
  // and "I can't enter rental costs here" — both things an owner naturally
  // asks the chat. Prep hours are the builder's own per-line field; an
  // equipment price only from the estimator's own words (below).
  "set_prep_hours",
  "set_access_price",
]);

/** Most extra prep hours one surface may carry — a month of one painter. */
export const MAX_PREP_HOURS = 500;

/**
 * Apply a list of changes to a model. Pure; returns a NEW model, what changed
 * in words, and what was refused and why. Used by the chat (the model's ops)
 * and by the screen (the estimator's own: a measurement, a price for a lift,
 * a switch). `actor: "model"` refuses the operations only a person may make.
 */
export function applyOps(model, ops, ctx, { actor = "model" } = {}) {
  const m = JSON.parse(JSON.stringify(model || {}));
  m.areas = Array.isArray(m.areas) ? m.areas : [];
  m.surfaces = Array.isArray(m.surfaces) ? m.surfaces : [];
  m.access = Array.isArray(m.access) ? m.access : [];
  m.assumptions = Array.isArray(m.assumptions) ? m.assumptions : [];
  m.exclusions = Array.isArray(m.exclusions) ? m.exclusions : [];
  m.questions = Array.isArray(m.questions) ? m.questions : [];
  const changes = [];
  const dropped = [];
  const areaIds = () => new Set(m.areas.map((a) => a.id));
  const sctx = () => ({ ...ctx, areaIds: areaIds() });
  const findSurface = (id) => m.surfaces.find((s) => s.id === id);

  for (const op of Array.isArray(ops) ? ops.slice(0, 30) : []) {
    const kind = op?.op;
    if (kind === "set_surface") {
      const s = findSurface(op.surfaceId);
      if (!s) {
        dropped.push(`No surface "${text(op.surfaceId, 24)}"`);
        continue;
      }
      const before = s.label;
      if (typeof op.itemKey === "string" && ctx.itemKeys.has(op.itemKey)) s.itemKey = op.itemKey;
      if (posInt(op.coats, 4)) s.coats = op.coats;
      if (typeof op.productKey === "string" && ctx.productKeys.has(op.productKey)) s.productKey = op.productKey;
      if (typeof op.include === "boolean") s.included = op.include;
      const lens = cleanRefs(op.lengthRefs, ctx.dimIds);
      const wids = cleanRefs(op.widthRefs, ctx.dimIds);
      if (lens.length) s.lengthRefs = lens;
      if (wids.length) s.widthRefs = wids;
      if (posNum(op.multiplier, 100)) s.multiplier = op.multiplier;
      if (posInt(op.count, 100000)) s.count = op.count;
      if (posNum(op.estimate, 1_000_000)) {
        s.estimate = op.estimate;
        s.estimateBasis = nullableText(op.estimateBasis, 160) || s.estimateBasis;
      }
      if (text(op.label, 80)) s.label = text(op.label, 80);
      changes.push(`Updated ${before}`);
    } else if (kind === "add_surface") {
      let n = m.surfaces.length + 1;
      while (findSurface(`s${n}`)) n++;
      const clean = cleanSurface({ ...op, id: `s${n}` }, sctx(), `s${n}`);
      if (!clean) {
        dropped.push("A surface with an item that isn't in your painting rates");
        continue;
      }
      m.surfaces.push(clean);
      changes.push(`Added ${clean.label}`);
    } else if (kind === "remove_surface") {
      const s = findSurface(op.surfaceId);
      if (!s) continue;
      // Switched off rather than deleted: the estimator can switch it back,
      // and "what did the read first say" stays answerable.
      s.included = false;
      changes.push(`Left out ${s.label}`);
    } else if (kind === "include_area" || kind === "exclude_area") {
      const a = m.areas.find((x) => x.id === op.areaId);
      if (!a) continue;
      a.included = kind === "include_area";
      changes.push(`${a.included ? "Included" : "Excluded"} ${a.name}`);
    } else if (kind === "add_area") {
      const name = text(op.label, 80);
      if (!name) continue;
      const id = `a${m.areas.length + 1}x`;
      m.areas.push({ id, name, level: null, side: op.side === "exterior" ? "exterior" : "interior", included: true });
      changes.push(`Added area ${name}`);
    } else if (kind === "set_access") {
      const clean = cleanAccess({ ...op, reason: op.text || op.reason }, sctx());
      if (!clean) {
        dropped.push("Access equipment that isn't one of the kinds FieldQuo knows");
        continue;
      }
      // One access line per area (the bell tower needs a 60 ft lift — that
      // REPLACES the tower's scaffold), or per kind when it names no area.
      const existing = m.access.find((a) =>
        clean.areaId ? a.areaId === clean.areaId : !a.areaId && a.equipment === clean.equipment,
      );
      if (existing) {
        const price = existing.price;
        Object.assign(existing, clean, { id: existing.id, price });
        changes.push(`Changed access: ${EQUIPMENT_LABELS[clean.equipment]}`);
      } else {
        m.access.push({ id: `x${m.access.length + 1}`, ...clean });
        changes.push(`Added access: ${EQUIPMENT_LABELS[clean.equipment]}`);
      }
    } else if (kind === "remove_access") {
      const a = m.access.find((x) => x.id === op.accessId || x.id === op.surfaceId);
      if (!a) continue;
      a.included = false;
      changes.push(`Removed access: ${EQUIPMENT_LABELS[a.equipment]}`);
    } else if (kind === "add_assumption" || kind === "add_exclusion" || kind === "add_question") {
      const t = text(op.text, 200);
      if (!t) continue;
      if (kind === "add_question") m.questions.push({ id: `q${m.questions.length + 1}x`, text: t, source: "model", resolved: false });
      else (kind === "add_assumption" ? m.assumptions : m.exclusions).push(t);
      changes.push(`${kind === "add_assumption" ? "Assumption" : kind === "add_exclusion" ? "Exclusion" : "Question"}: ${t}`);
    } else if (kind === "resolve_question") {
      const q = m.questions.find((x) => x.id === op.questionId || x.text === op.text);
      if (q) {
        q.resolved = true;
        changes.push(`Answered: ${q.text}`);
      } else if (text(op.text, 400)) {
        // A conflict question is computed, not stored; answering one stores
        // it as resolved so it is not asked again.
        m.questions.push({ id: `q${m.questions.length + 1}r`, text: text(op.text, 400), source: "conflict", resolved: true });
        changes.push("Answered a question");
      }
    } else if (kind === "set_commercial") {
      if (typeof op.include === "boolean") {
        m.commercial = op.include;
        changes.push(op.include ? "Priced on your commercial rates" : "Priced on your residential rates");
      }
    } else if (kind === "measure" && actor === "person") {
      const s = findSurface(op.surfaceId);
      const v = posNum(op.value, 10_000_000);
      if (!s || !v) continue;
      s.override = { value: v, sourceText: text(op.sourceText, 200) || "Measured on the sheet" };
      changes.push(`Measured ${s.label}`);
    } else if (kind === "clear_measure" && actor === "person") {
      const s = findSurface(op.surfaceId);
      if (!s) continue;
      s.override = null;
      changes.push(`Cleared the measurement on ${s.label}`);
    } else if (kind === "set_assumption" && actor === "person") {
      // One tap on "priced on these assumptions" (lib/planRead/firstPassRules.js):
      // the read re-prices in code from it — no model call.
      const key = typeof op.key === "string" && Object.hasOwn(ASSUMED, op.key) ? op.key : null;
      if (!key || !ASSUMED[key].options.includes(op.value)) {
        dropped.push("An assumption the read doesn't price on");
        continue;
      }
      m.assumed = m.assumed && typeof m.assumed === "object" ? m.assumed : {};
      m.assumed[key] = { value: op.value, basis: "Set by your team", source: "person" };
      changes.push(`Priced on: ${ASSUMED[key].label} — ${String(op.value).replace(/_/g, " ")}`);
    } else if (kind === "confirm_access" && actor === "person") {
      // "Confirm" on an access line priced from the company's rental rates or
      // the reference table: the figure becomes the estimator's own. The
      // price here is the SERVER's (the PATCH route works it out from the
      // read now) — the browser sends only which line.
      const a = m.access.find((x) => x.id === op.accessId);
      const p = Number(op.price);
      if (!a || !Number.isFinite(p) || p < 0) {
        dropped.push("An equipment line with no estimate to confirm");
        continue;
      }
      a.price = Math.round(p * 100) / 100;
      a.priceSource = "person";
      a.confirmed = true;
      a.confirmedWhy = text(op.why, 300) || null;
      changes.push(`Confirmed ${EQUIPMENT_LABELS[a.equipment] || a.equipment} at ${a.price}${a.confirmedWhy ? ` — ${a.confirmedWhy}` : ""}`);
    } else if (kind === "set_access_reason" && actor === "person") {
      // The one-tap reason an access line costs nothing or is left out —
      // "we own it", "client provides", "not needed", "included elsewhere".
      // Who and when come from the route (op.userId / op.at), never a body.
      const a = m.access.find((x) => x.id === op.accessId);
      if (!a || !ACCESS_REASONS.includes(op.reason)) {
        dropped.push("A reason for an equipment line that isn't one of the four");
        continue;
      }
      a.zeroReason = op.reason;
      a.zeroBy = typeof op.userId === "string" ? op.userId : null;
      a.zeroAt = typeof op.at === "string" ? op.at : null;
      // "We own it" on a line still being priced makes it the owner's $0.
      if (op.reason === "owned" && a.included !== false) {
        a.price = 0;
        a.priceSource = "person";
      }
      changes.push(`${EQUIPMENT_LABELS[a.equipment] || a.equipment}: ${accessReasonLabel(op.reason)}`);
    } else if (kind === "set_material_qty" && actor === "person") {
      // The estimator's own quantity on the read's material list; null puts
      // the computed one back.
      const key = typeof op.key === "string" && /^(?:paint|prep):[a-z0-9_]{1,40}$/.test(op.key) ? op.key : null;
      const q = op.qty === null ? null : Number(op.qty);
      if (!key || (q !== null && !(Number.isFinite(q) && q >= 0 && q <= 100000))) {
        dropped.push("A material quantity between 0 and 100,000");
        continue;
      }
      m.materialQty = m.materialQty && typeof m.materialQty === "object" ? m.materialQty : {};
      if (q === null) delete m.materialQty[key];
      else m.materialQty[key] = Math.round(q * 100) / 100;
      changes.push(q === null ? `Material quantity back to the computed one (${key})` : `Material quantity set: ${key} = ${q}`);
    } else if (kind === "review_check" && actor === "person") {
      // "Looks right" / "Change" on one item of "Check before sending"
      // (lib/planRead/review.js) — recorded with who and when.
      const key = text(op.key, 160);
      if (!key || !["ok", "change"].includes(op.verdict)) {
        dropped.push("A review answer that isn't Looks right or Change");
        continue;
      }
      m.review = m.review && typeof m.review === "object" ? m.review : {};
      m.review[key] = { verdict: op.verdict, by: typeof op.userId === "string" ? op.userId : null, at: typeof op.at === "string" ? op.at : null, text: text(op.text, 200) || null };
      changes.push(`${op.verdict === "ok" ? "Checked — looks right" : "Marked to change"}: ${text(op.text, 200) || key}`);
    } else if (kind === "set_crew" && actor === "person") {
      // The crew plan: painters and productive hours a day, for this read.
      m.plan = m.plan && typeof m.plan === "object" ? m.plan : {};
      const size = Number(op.crewSize);
      const hpd = Number(op.hoursPerDay);
      if (op.crewSize !== undefined) {
        if (Number.isInteger(size) && size >= 1 && size <= 50) m.plan.crewSize = size;
        else if (op.crewSize === null) delete m.plan.crewSize;
        else {
          dropped.push("A crew of 1 to 50 painters");
          continue;
        }
      }
      if (op.hoursPerDay !== undefined) {
        if (Number.isFinite(hpd) && hpd >= 1 && hpd <= 24) m.plan.hoursPerDay = Math.round(hpd * 100) / 100;
        else if (op.hoursPerDay === null) delete m.plan.hoursPerDay;
        else {
          dropped.push("Productive hours a day between 1 and 24");
          continue;
        }
      }
      changes.push(`Crew plan: ${m.plan.crewSize ? `${m.plan.crewSize} painters` : "your default crew"}, ${m.plan.hoursPerDay ? `${m.plan.hoursPerDay} h a day` : "the default day"}`);
    } else if (kind === "set_access_price") {
      const a = m.access.find((x) => x.id === op.accessId);
      if (!a) {
        dropped.push(`No equipment line "${text(op.accessId, 24)}"`);
        continue;
      }
      const label = EQUIPMENT_LABELS[a.equipment] || a.equipment;
      const clearing = op.price === null || op.price === undefined || op.price === "";
      // Zero IS a price: ladders the company owns cost this job nothing, and
      // "unpriced" would keep warning about them (posNum refused 0, so a
      // typed 0 was saved as "no price").
      const n = Number(op.price);
      const p = clearing ? null : Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : undefined;
      if (p === undefined) {
        dropped.push(`A price for ${label} that isn't a number between 0 and 1,000,000`);
        continue;
      }
      if (actor === "model") {
        // Only a figure the estimator typed, or accepted from the last reply
        // (ctx.statedFigures — lib/planRead/chat.js). Never one nobody said,
        // and never clearing a person's price.
        const said = Array.isArray(ctx.statedFigures) ? ctx.statedFigures : [];
        if (p === null || !said.some((f) => Math.abs(f - p) < 0.005)) {
          dropped.push(`A price for ${label} that isn't a figure you gave or accepted`);
          continue;
        }
        a.price = p;
        a.priceSource = "ai";
        changes.push(`Price for ${label} — entered by FieldQuo AI from the conversation; verify it`);
      } else {
        a.price = p;
        a.priceSource = p === null ? null : "person";
        changes.push(`Price for ${label}`);
      }
    } else if (kind === "set_prep_hours") {
      const s = findSurface(op.surfaceId);
      if (!s) {
        dropped.push(`No surface "${text(op.surfaceId, 24)}"`);
        continue;
      }
      const h = typeof op.hours === "number" && Number.isFinite(op.hours) && op.hours >= 0 && op.hours <= MAX_PREP_HOURS ? Math.round(op.hours * 100) / 100 : null;
      if (h === null) {
        dropped.push(`Prep hours on ${s.label} must be between 0 and ${MAX_PREP_HOURS}`);
        continue;
      }
      const why = text(op.text, 160);
      if (actor === "model" && h > 0 && !why) {
        dropped.push(`Extra prep hours on ${s.label} without saying why`);
        continue;
      }
      if (h === 0) {
        s.prepHours = null;
        s.prepNote = null;
        s.prepSource = null;
        changes.push(`Took the extra prep hours off ${s.label}`);
      } else {
        // The builder's own per-line "Prep hours" (lib/pricing/paintTakeoff.js
        // row.prepHours): priced at the line's hourly rate, carried onto the
        // quote's takeoff by lib/planRead/pricing.js.
        s.prepHours = h;
        s.prepNote = why || null;
        s.prepSource = actor === "model" ? "ai" : "person";
        changes.push(`Extra prep hours on ${s.label}: ${h} h${why ? ` — ${why}` : ""}${actor === "model" ? " (FieldQuo AI — verify)" : ""}`);
      }
    } else {
      dropped.push(`Unknown change "${text(String(kind), 30)}"`);
    }
  }
  return { model: m, changes, dropped };
}
