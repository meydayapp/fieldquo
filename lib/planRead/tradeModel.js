// lib/planRead/tradeModel.js
//
// The trades beyond painting — drywall, framing, roofing, electrical,
// plumbing, flooring — as the drawing read's project model holds them
// (`PlanRead.model.trades[]`), and the arithmetic that turns each scope item
// into a quantity WITH ITS SOURCE AND A CONFIDENCE. Painting keeps its own
// model (lib/planRead/projectModel.js) untouched: a read whose scope is
// painting, or that has no scope, produces exactly what it did before.
//
// ══ Who decides what ═══════════════════════════════════════════════════════
//
// The same split as painting (projectModel.js header):
//
//   the MODEL   names an item from the trade's vocabulary
//               (lib/planRead/tradeCatalogue.js) and POINTS at where its
//               quantity is printed — dimension ids, a symbol count it made
//               per tile on a sheet, a schedule row (with the quantity text it
//               read in that row), a spreadsheet cell, a photo surface — or,
//               only when none exists, an estimate with its basis.
//   THIS FILE   computes the quantity, picks the source by a fixed order,
//               states the CONFIDENCE in code (never asked of the model), and
//               turns a disagreement between sources into a question.
//   PRICING     lib/planRead/tradePricing.js — never the model.
//
// No field the model fills is a price; the sanitisers copy fields by name.
//
// ══ Source order and confidence ════════════════════════════════════════════
//
//   measured   traced on the sheet by a person                       high
//   drawing    printed dimensions (vector text)                      high
//              … from a scanned sheet, or a bare number whose unit
//              was assumed                                           low
//   schedule   a schedule row on a vector sheet whose printed
//              quantity code found in that row's text                high
//   excel      a cited spreadsheet cell                              medium
//   counted    symbol counts the sheet pass made per tile, summed
//              here: every count matched to a legend row and the
//              quarters agreeing with the whole-sheet count (within
//              COUNT_AGREEMENT) on a vector sheet                    medium
//              … otherwise                                           low
//   count      a bare count the synthesis gave with no sheet count   low
//   photo      reference-object scaling                              low
//   estimate   the model's own figure, with its basis                low + a question
//
// "Estimated" (the painting model's flag, which the screen badges) is
// confidence low.
//
// Pure: imports only other pure files.

import { TRADE_LABELS, ITEM_ATTRIBUTES, ITEM_ATTRIBUTE_CHOICES, PERSON_SETTABLE_ATTRIBUTES, itemDef, measureOfUnit, MULTI_TRADE_KEYS } from "./tradeCatalogue";
import { assumedUnitNote, cellNumber, CONFLICT_RATIO } from "./projectModel";
import { photoSurfaceQuantity } from "./photoScale";
import { slopedAreaSqft, SQFT_PER_SQUARE } from "@/lib/pricing/roofLabour";

export const TRADE_MODEL_VERSION = 1;
/** Quarters and whole-sheet counts agreeing within this share = medium. */
export const COUNT_AGREEMENT = 0.15;
const MAX_ITEMS = 150;
const MAX_AREAS = 60;

const text = (s, max = 200) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const nullableText = (s, max) => text(s, max) || null;
const posNum = (v, max) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
const posInt = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null);
const r = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const roundFor = (unit, v) => (unit === "sq" ? r(v, 2) : unit === "lnft" ? r(v, 1) : r(v));
export const UNIT_LABELS = Object.freeze({ sqft: "sq ft", lnft: "lin ft", each: "ea", sq: "sq" });

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE SHEET PASSES COUNTED
// ═══════════════════════════════════════════════════════════════════════════

const normSymbol = (s) => text(s, 40).toLowerCase();

/**
 * One sheet pass's per-tile symbol counts → aggregated counts, each with an
 * id the synthesis cites ("p3.c2"). Tile 0 is the whole sheet; tiles 1–4 the
 * four quarters, which the model counts only for symbols whose CENTRE lies in
 * that quarter's own half of the sheet (the overlap strip is split down its
 * middle — lib/planRead/prompts.js), so summing them double-counts nothing.
 * Pure.
 */
export function aggregateSheetCounts(raw, sheetKey, { tradeKeys = MULTI_TRADE_KEYS } = {}) {
  const groups = new Map();
  for (const c of Array.isArray(raw) ? raw.slice(0, 300) : []) {
    const tradeKey = typeof c?.tradeKey === "string" && tradeKeys.includes(c.tradeKey) ? c.tradeKey : null;
    if (!tradeKey) continue;
    const def = itemDef(tradeKey, c.itemKey);
    if (!def || measureOfUnit(def.unit) !== "count") continue;
    const tile = Number.isInteger(c.tile) && c.tile >= 0 && c.tile <= 4 ? c.tile : null;
    const n = Number.isInteger(c.count) && c.count >= 0 && c.count <= 5000 ? c.count : null;
    if (tile === null || n === null) continue;
    const key = `${tradeKey}|${c.itemKey}|${normSymbol(c.symbol)}`;
    if (!groups.has(key)) groups.set(key, { tradeKey, itemKey: c.itemKey, symbol: text(c.symbol, 40) || null, legend: null, overview: null, quarters: 0, tilesCounted: 0 });
    const g = groups.get(key);
    if (!g.legend && text(c.legendText, 120)) g.legend = text(c.legendText, 120);
    if (tile === 0) g.overview = (g.overview || 0) + n;
    else {
      g.quarters += n;
      g.tilesCounted += 1;
    }
  }
  return [...groups.values()].map((g, i) => {
    const count = g.tilesCounted ? g.quarters : g.overview || 0;
    const both = g.tilesCounted > 0 && g.overview !== null && g.overview > 0 && g.quarters > 0;
    const agree = both && Math.abs(g.quarters - g.overview) / Math.max(g.quarters, g.overview) <= COUNT_AGREEMENT;
    return { id: `${sheetKey}.c${i + 1}`, ...g, count, agree };
  });
}

/** Every count the read's sheet passes made, by id, with its sheet. */
export function buildCountIndex(sheets) {
  const index = new Map();
  for (const s of Array.isArray(sheets) ? sheets : []) {
    const name = s?.sheetNumber || `Page ${s?.page}`;
    for (const c of Array.isArray(s?.read?.counts) ? s.read.counts : []) index.set(c.id, { ...c, sheet: name, vector: Boolean(s.vector) });
  }
  return index;
}

/** Every schedule row read in code (sheetFacts schedules), by id. */
export function buildScheduleIndex(sheets) {
  const index = new Map();
  for (const s of Array.isArray(sheets) ? sheets : []) {
    const name = s?.sheetNumber || `Page ${s?.page}`;
    for (const sch of Array.isArray(s?.schedules) ? s.schedules : []) {
      for (const row of Array.isArray(sch?.rows) ? sch.rows : []) index.set(row.id, { ...row, kind: sch.kind, sheet: name, vector: Boolean(s.vector) });
    }
  }
  return index;
}

// ═══════════════════════════════════════════════════════════════════════════
// SANITISING THE SYNTHESIS
// ═══════════════════════════════════════════════════════════════════════════

function cleanIds(list, known, max = 12) {
  const out = [];
  for (const id of Array.isArray(list) ? list : []) {
    if (typeof id === "string" && known.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function excelCell(excel, row, col, sheet = null) {
  if (!Number.isInteger(row) || typeof col !== "string") return null;
  const sheets = (excel?.sheets || []).filter((s) => !sheet || s.name === sheet);
  for (const s of sheets) {
    const hit = s.rows.find((x) => x.r === row);
    if (hit && Object.prototype.hasOwnProperty.call(hit.cells, col)) return { sheet: s.name, value: hit.cells[col] };
  }
  return null;
}

/** The attributes an item may carry — by name, by type, and only those its
 *  catalogue entry lists. Anything else the model volunteers lands nowhere. */
export function cleanAttributes(raw, def) {
  const out = {};
  const allowed = new Set(def?.attrs || []);
  for (const [k, type] of Object.entries(ITEM_ATTRIBUTES)) {
    if (!allowed.has(k)) continue;
    const v = raw?.[k];
    if (v === null || v === undefined) continue;
    if (type === "number") {
      const n = posNum(v, k === "pitch" ? 24 : k === "studSpacingIn" ? 48 : 200);
      if (n !== null) out[k] = n;
    } else if (type === "integer") {
      const n = k === "finishLevel" ? (Number.isInteger(v) && v >= 0 && v <= 5 ? v : null) : posInt(v, k === "amps" ? 4000 : 10);
      if (n !== null) out[k] = n;
    } else if (type === "boolean") {
      if (typeof v === "boolean") out[k] = v;
    } else if (type === "choice") {
      // A closed list: kept only when it is one of the answers, never coerced.
      const choice = choiceOf(k, v);
      if (choice) out[k] = choice;
    } else if (text(v, 40)) out[k] = text(v, 40);
  }
  return out;
}

/** One of a choice attribute's answers ("Tankless" → "tankless"), or null. */
export function choiceOf(attribute, value) {
  const list = Object.hasOwn(ITEM_ATTRIBUTE_CHOICES, attribute) ? ITEM_ATTRIBUTE_CHOICES[attribute] : null;
  if (!list || typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return list.includes(v) ? v : null;
}

function cleanItem(raw, tradeKey, ctx, idFallback) {
  const def = itemDef(tradeKey, raw?.itemKey);
  if (!def) return null;
  const excelRow = posInt(raw.excelRow, 1_000_000);
  const excelCol = typeof raw.excelCol === "string" && /^[A-Z]{1,3}$/.test(raw.excelCol) ? raw.excelCol : null;
  const excelSheet = typeof raw.excelSheet === "string" ? text(raw.excelSheet, 60) || null : null;
  const hasExcel = excelRow && excelCol && excelCell(ctx.excel, excelRow, excelCol, excelSheet);
  const scheduleRef = typeof raw.scheduleRef === "string" && ctx.scheduleIds.has(raw.scheduleRef) ? raw.scheduleRef : null;
  return {
    id: text(raw.id, 24) || idFallback,
    areaId: typeof raw.areaId === "string" && ctx.areaIds.has(raw.areaId) ? raw.areaId : null,
    label: text(raw.label, 80) || def.label,
    itemKey: raw.itemKey,
    lengthRefs: cleanIds(raw.lengthRefs, ctx.dimIds),
    widthRefs: cleanIds(raw.widthRefs, ctx.dimIds),
    multiplier: posNum(raw.multiplier, 100) ?? 1,
    countRefs: cleanIds(raw.countRefs, ctx.countIds, 40),
    count: posInt(raw.count, 100000),
    scheduleRef,
    scheduleQty: scheduleRef ? nullableText(raw.scheduleQty, 20) : null,
    specRef: typeof raw.specRef === "string" && ctx.specIds?.has(raw.specRef) ? raw.specRef : null,
    excelSheet: hasExcel ? excelSheet : null,
    excelRow: hasExcel ? excelRow : null,
    excelCol: hasExcel ? excelCol : null,
    photoSurfaceId: typeof raw.photoSurfaceId === "string" && ctx.photoIds.has(raw.photoSurfaceId) ? raw.photoSurfaceId : null,
    estimate: posNum(raw.estimate, 1_000_000),
    estimateBasis: nullableText(raw.estimateBasis, 160),
    sheet: nullableText(raw.sheet, 40),
    note: nullableText(raw.note, 200),
    attributes: cleanAttributes(raw.attributes, def),
    included: raw.include === false ? false : true,
    override: null,
  };
}

/**
 * One trade's synthesis → its stored model. Pure.
 *
 * @param ctx  { dimIds, countIds, scheduleIds, specIds, photoIds, excel }
 */
export function sanitiseTradeSynthesis(raw, tradeKey, ctx) {
  const areas = [];
  for (const a of Array.isArray(raw?.areas) ? raw.areas : []) {
    if (areas.length >= MAX_AREAS) break;
    const id = text(a?.id, 24);
    const name = text(a?.name, 80);
    if (!id || !name || areas.some((x) => x.id === id)) continue;
    areas.push({ id, name, level: nullableText(a.level, 40), included: a.include === false ? false : true });
  }
  const full = { ...ctx, areaIds: new Set(areas.map((a) => a.id)) };
  const items = [];
  for (const [i, it] of (Array.isArray(raw?.items) ? raw.items : []).entries()) {
    if (items.length >= MAX_ITEMS) break;
    const clean = cleanItem(it, tradeKey, full, `${tradeKey.slice(0, 2)}${i + 1}`);
    if (!clean || items.some((x) => x.id === clean.id)) continue;
    items.push(clean);
  }
  const level = ["low", "medium", "high", "very_high"].includes(raw?.complexity?.level) ? raw.complexity.level : "medium";
  const list = (v, n, max = 200) => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : []);
  return {
    version: TRADE_MODEL_VERSION,
    tradeKey,
    included: true,
    summary: text(raw?.summary, 600),
    buildingType: text(raw?.buildingType, 60),
    commercial: raw?.commercial === true,
    areas,
    items,
    complexity: { level, factors: list(raw?.complexity?.factors, 8) },
    assumptions: list(raw?.assumptions, 20),
    exclusions: list(raw?.exclusions, 20),
    questions: list(raw?.questions, 12).map((q, i) => ({ id: `${tradeKey.slice(0, 2)}q${i + 1}`, text: q, source: "model", resolved: false })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUANTITIES
// ═══════════════════════════════════════════════════════════════════════════

const differs = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) > CONFLICT_RATIO;

/** Plan sq ft → roofing squares on the slope, by the pitch the drawing states. */
function roofSquares(planSqft, pitch) {
  const sloped = pitch ? slopedAreaSqft(planSqft, pitch) : planSqft;
  return sloped / SQFT_PER_SQUARE;
}

function drawingQuantity(item, def, dims) {
  const lens = item.lengthRefs.map((id) => dims.get(id)).filter(Boolean);
  const wids = item.widthRefs.map((id) => dims.get(id)).filter(Boolean);
  const measure = measureOfUnit(def.unit);
  if (!lens.length || measure === "count") return null;
  const sum = (list) => list.reduce((n, d) => n + d.feet, 0);
  let value;
  if (measure === "area") {
    if (!wids.length) return null;
    value = sum(lens) * sum(wids) * item.multiplier;
  } else value = sum(lens) * item.multiplier;
  const all = [...lens, ...wids];
  const shaky = all.some((d) => d.fromScan || d.unitAssumed);
  const sheetNames = [...new Set(all.map((d) => d.sheet))].join(", ");
  const part = (list) => list.map((d) => d.raw).join(" + ");
  const mult = item.multiplier !== 1 ? ` × ${r(item.multiplier, 2)}` : "";
  let formula = measure === "area" ? `${part(lens)} × ${part(wids)}${mult}` : `${part(lens)}${mult}`;
  let pitchNote = "";
  if (def.unit === "sq") {
    const pitch = item.attributes?.pitch || null;
    const plan = value;
    value = roofSquares(plan, pitch);
    formula += pitch ? ` = ${r(plan)} sq ft on plan, sloped at ${r(pitch, 1)}/12 ÷ 100` : ` = ${r(plan)} sq ft on plan ÷ 100`;
    if (!pitch) pitchNote = " — no pitch printed, plan area used (understates a pitched roof), verify";
  }
  return {
    value: roundFor(def.unit, value),
    source: "drawing",
    confidence: shaky || pitchNote ? "low" : "high",
    sourceText: `${sheetNames}: ${formula}${all.some((d) => d.fromScan) ? " — read from a scanned sheet, verify" : ""}${assumedUnitNote(all)}${pitchNote}`,
    refs: all.map((d) => ({ id: d.id, raw: d.raw, sheet: d.sheet, x: d.x, y: d.y })),
  };
}

/** The quantity printed in a schedule row — the model READ it, the code
 *  checks the text is in that row before believing it. */
function scheduleQuantity(item, def, schedules) {
  if (!item.scheduleRef) return null;
  const row = schedules.get(item.scheduleRef);
  if (!row) return null;
  const qtyText = String(item.scheduleQty || "").trim();
  const n = cellNumber(qtyText);
  if (!n) return null;
  // The printed figure must be a token of the row: "12" in "A1 | 2X4 LED TROFFER | 12 | 277V".
  const tokens = String(row.text || "").match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) || [];
  const inRow = tokens.some((tok) => Number(tok.replace(/,/g, "")) === n);
  if (!inRow) return null;
  return {
    value: roundFor(def.unit, n),
    source: "schedule",
    confidence: row.vector ? "high" : "low",
    sourceText: `${row.sheet} ${row.kind ? `${row.kind.toLowerCase()} ` : ""}schedule: “${text(row.text, 140)}”`,
  };
}

function excelQuantity(item, def, excel) {
  if (!item.excelRow || !item.excelCol) return null;
  const cell = excelCell(excel, item.excelRow, item.excelCol, item.excelSheet);
  const n = cellNumber(cell?.value);
  if (!n) return null;
  return { value: roundFor(def.unit, n), source: "excel", confidence: "medium", sourceText: `Scope sheet "${cell.sheet}" row ${item.excelRow}, column ${item.excelCol}: ${cell.value}` };
}

function countedQuantity(item, counts) {
  const hits = item.countRefs.map((id) => counts.get(id)).filter(Boolean);
  if (!hits.length) return null;
  const value = hits.reduce((n, c) => n + (c.count || 0), 0);
  if (!(value > 0)) return null;
  const solid = hits.every((c) => c.legend && c.agree && c.vector);
  const parts = hits.map((c) => `${c.sheet} ${c.symbol ? `“${c.symbol}”` : c.itemKey}${c.legend ? ` (legend: ${c.legend})` : ""}: ${c.count}`);
  const why = solid ? "" : hits.some((c) => !c.legend) ? " — no legend match, verify" : " — the quarter counts and the whole-sheet count disagree, verify";
  return {
    value,
    source: "counted",
    confidence: solid ? "medium" : "low",
    sourceText: `Counted by FieldQuo AI on the sheets — ${parts.join("; ")}${why}`,
  };
}

/**
 * One item's quantity, by the source order in the header. Pure.
 * @returns {{ quantity, conflicts: string[] }}
 */
export function tradeItemQuantity(item, tradeKey, ctx) {
  const def = itemDef(tradeKey, item.itemKey);
  const unit = def?.unit || "each";
  const conflicts = [];
  const base = { unit, unitLabel: UNIT_LABELS[unit] || unit };
  if (!def) return { quantity: { ...base, value: 0, source: "none", confidence: "low", estimated: true, sourceText: "Not an item FieldQuo knows for this trade" }, conflicts };
  if (item.override && posNum(item.override.value, 10_000_000)) {
    return { quantity: { ...base, value: roundFor(unit, item.override.value), source: "measured", confidence: "high", estimated: false, sourceText: text(item.override.sourceText, 200) || "Measured on the sheet" }, conflicts };
  }
  const drawing = drawingQuantity(item, def, ctx.dims || new Map());
  const schedule = scheduleQuantity(item, def, ctx.schedules || new Map());
  const excel = excelQuantity(item, def, ctx.excel);
  const counted = measureOfUnit(unit) === "count" ? countedQuantity(item, ctx.counts || new Map()) : null;
  const bare =
    measureOfUnit(unit) === "count" && item.count
      ? { value: item.count, source: "count", confidence: "low", sourceText: `Counted by FieldQuo AI${item.sheet ? ` on ${item.sheet}` : ""} — no sheet count behind it, verify` }
      : null;
  const ps = item.photoSurfaceId ? (ctx.photoRead?.surfaces || []).find((x) => x.id === item.photoSurfaceId) : null;
  const photoUnit = unit === "sq" ? "sqft" : unit;
  const photo = ps && (photoUnit === "sqft" || photoUnit === "lnft") ? photoSurfaceQuantity(ps, photoUnit) : null;
  const photoQ = photo
    ? { value: roundFor(unit, unit === "sq" ? photo.value / SQFT_PER_SQUARE : photo.value), source: "photo", confidence: "low", sourceText: photo.sourceText }
    : null;
  const estimate = item.estimate
    ? { value: roundFor(unit, item.estimate), source: "estimate", confidence: "low", sourceText: `Estimated — verify${item.estimateBasis ? ` (${item.estimateBasis})` : ""}` }
    : null;

  const chosen = drawing || schedule || excel || counted || bare || photoQ || estimate;
  if (!chosen) {
    return { quantity: { ...base, value: 0, source: "none", confidence: "low", estimated: true, sourceText: "No quantity yet — measure it on the sheet or tell the chat" }, conflicts };
  }
  const label = item.label;
  const firm = [drawing, schedule, excel, counted].filter(Boolean);
  for (const other of firm.slice(1)) {
    if (differs(firm[0].value, other.value)) {
      conflicts.push(`${label}: ${firm[0].value} ${base.unitLabel} from ${firm[0].sourceText}, but ${other.value} from ${other.sourceText}. The first is used — which is right?`);
    }
  }
  if (estimate && chosen === estimate) conflicts.push(`${label}: estimated at ${estimate.value} ${base.unitLabel} with nothing printed behind it — measure it or confirm.`);
  return { quantity: { ...base, ...chosen, estimated: chosen.confidence === "low" }, conflicts };
}

/**
 * One trade, with every quantity computed and every conflict asked. Pure;
 * recomputed on every view, like painting's, so it can never disagree with
 * the model it came from.
 */
export function computeTrade(trade, ctx) {
  if (!trade || typeof trade !== "object") return null;
  const areaById = new Map((trade.areas || []).map((a) => [a.id, a]));
  const conflictQs = [];
  const items = (trade.items || []).map((it) => {
    const area = it.areaId ? areaById.get(it.areaId) : null;
    const { quantity, conflicts } = tradeItemQuantity(it, trade.tradeKey, ctx);
    conflictQs.push(...conflicts);
    const def = itemDef(trade.tradeKey, it.itemKey);
    return {
      ...it,
      areaName: area?.name || null,
      measurementKey: def?.key || null,
      active: trade.included !== false && it.included !== false && (!area || area.included !== false),
      quantity,
    };
  });
  const resolved = new Set((trade.questions || []).filter((q) => q.resolved).map((q) => q.text));
  const questions = [
    ...(trade.questions || []),
    ...conflictQs.filter((t) => !resolved.has(t)).map((t, i) => ({ id: `${trade.tradeKey.slice(0, 2)}c${i + 1}`, text: t, source: "conflict", resolved: false })),
  ];
  const active = items.filter((i) => i.active);
  return {
    ...trade,
    label: TRADE_LABELS[trade.tradeKey] || trade.tradeKey,
    items,
    questions,
    confidence: {
      high: active.filter((i) => i.quantity.confidence === "high").length,
      medium: active.filter((i) => i.quantity.confidence === "medium").length,
      low: active.filter((i) => i.quantity.confidence === "low").length,
    },
  };
}

/** Every trade on a model, computed. [] for a painting-only model. */
export function computeTrades(model, ctx) {
  return (Array.isArray(model?.trades) ? model.trades : []).map((t) => computeTrade(t, ctx)).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANGES — from the screen (a person) and, in P4, the chat
// ═══════════════════════════════════════════════════════════════════════════

export const TRADE_PERSON_OPS = Object.freeze(["measure_item", "clear_measure_item", "include_item", "exclude_item", "include_trade", "exclude_trade", "resolve_trade_question", "set_item_choice"]);

/**
 * Apply a person's changes to the trades of a model. Pure; returns a NEW
 * model. Only `actor: "person"` may measure. Unknown ops are refused by
 * name, never silently dropped.
 */
export function applyTradeOps(model, ops, { actor = "model" } = {}) {
  const m = JSON.parse(JSON.stringify(model || {}));
  m.trades = Array.isArray(m.trades) ? m.trades : [];
  const changes = [];
  const dropped = [];
  const findTrade = (k) => m.trades.find((t) => t.tradeKey === k);
  const findItem = (t, id) => (t?.items || []).find((i) => i.id === id);
  for (const op of Array.isArray(ops) ? ops.slice(0, 30) : []) {
    const t = findTrade(op?.tradeKey);
    const label = TRADE_LABELS[op?.tradeKey] || "";
    if (!TRADE_PERSON_OPS.includes(op?.op)) {
      dropped.push(`Unknown change "${text(String(op?.op), 30)}"`);
      continue;
    }
    if (!t) {
      dropped.push(`No ${label || "such"} trade on this read`);
      continue;
    }
    if (op.op === "include_trade" || op.op === "exclude_trade") {
      t.included = op.op === "include_trade";
      changes.push(`${t.included ? "Included" : "Left out"} ${label}`);
      continue;
    }
    if (op.op === "resolve_trade_question") {
      const q = (t.questions || []).find((x) => x.id === op.questionId || x.text === op.text);
      if (q) q.resolved = true;
      else if (text(op.text, 400)) (t.questions = t.questions || []).push({ id: `${t.tradeKey.slice(0, 2)}q${t.questions.length + 1}r`, text: text(op.text, 400), source: "conflict", resolved: true });
      changes.push(`${label}: answered a question`);
      continue;
    }
    const it = findItem(t, op.itemId);
    if (!it) {
      dropped.push(`No item "${text(op.itemId, 24)}" on ${label}`);
      continue;
    }
    if (op.op === "include_item" || op.op === "exclude_item") {
      it.included = op.op === "include_item";
      changes.push(`${it.included ? "Put back" : "Left out"} ${label}: ${it.label}`);
    } else if (actor !== "person") {
      dropped.push("Only a person can measure");
    } else if (op.op === "measure_item") {
      const v = posNum(Number(op.value), 10_000_000);
      if (!v) {
        dropped.push(`A measurement must be a positive number`);
        continue;
      }
      it.override = { value: v, sourceText: text(op.sourceText, 200) || "Measured on the sheet" };
      changes.push(`Measured ${label}: ${it.label}`);
    } else if (op.op === "clear_measure_item") {
      it.override = null;
      changes.push(`Cleared the measurement on ${label}: ${it.label}`);
    } else if (op.op === "set_item_choice") {
      // A person answering what the drawings did not say — a water heater's
      // type (2026-10-05). Only the attributes PERSON_SETTABLE_ATTRIBUTES
      // names for the item, only one of the attribute's answers; null clears.
      const allowed = Object.hasOwn(PERSON_SETTABLE_ATTRIBUTES, it.itemKey) ? PERSON_SETTABLE_ATTRIBUTES[it.itemKey] : [];
      const attr = typeof op.attribute === "string" ? op.attribute : "";
      if (!allowed.includes(attr)) {
        dropped.push(`"${text(attr, 30)}" can't be set on ${label}: ${it.label}`);
        continue;
      }
      if (op.value === null || op.value === "") {
        if (it.attributes) delete it.attributes[attr];
        changes.push(`Cleared ${attr} on ${label}: ${it.label}`);
        continue;
      }
      const choice = choiceOf(attr, op.value);
      if (!choice) {
        dropped.push(`"${text(String(op.value), 30)}" is not a ${attr}`);
        continue;
      }
      it.attributes = { ...(it.attributes || {}), [attr]: choice };
      changes.push(`Set ${label}: ${it.label} — ${attr} ${choice}`);
    }
  }
  return { model: m, changes, dropped };
}
