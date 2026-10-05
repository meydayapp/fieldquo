// lib/planRead/tradePricing.js
//
// The pricing ladder for a drawing read's trades beyond painting. The model
// never sets a price: every figure here comes from the company's own books
// and services or from FieldQuo's cited coefficients, and every priced block
// names the rung it came from.
//
// ══ The ladder (the owner, 2026-10-04) ═════════════════════════════════════
//
//   1. engine      the company's own price book through the engine that
//                  prices its typed quotes: drywall_install (hang + GA-214
//                  finish level per sq ft — lib/quotes/drywallFinishLine.js)
//                  and roofing_service (buildTradeLineItems over a roofing
//                  takeoff — lib/pricing/tradeScope.js). A company that has
//                  not edited the book prices on FieldQuo's starting rates
//                  for it, exactly as its typed quotes do — and the screen
//                  says so.
//   2. service     the company's own services (Product.templateLines) keyed
//                  to the item's measurement key, expanded with the read's
//                  quantity (lib/services/templates.js expandTemplate), its
//                  hours from the service's production rate.
//   3. suggestion  FieldQuo's starting figures (lib/planRead/tradeDefaults.js),
//                  each coefficient cited and tagged. NEVER the company's
//                  price: shown as "FieldQuo suggestion — not your price yet",
//                  and onto a quote only through a person's button, flagged.
//                  Its HOURS are the trade's labour presets
//                  (lib/pricing/labourPresets.js): the company's own figure
//                  from its rate card when it has stated one (ctx.presetRates),
//                  FieldQuo's Craftsman-calibrated default when it has not.
//      none        nothing answers — "No rate — add one". Never a $0 line.
//
// Painting keeps lib/planRead/pricing.js (its own engine, paintTakeoff).
//
// ══ Cost beside price ══════════════════════════════════════════════════════
//
// Each block also carries what the work COSTS — hours × the company's labour
// cost rate, materials, the service lines' own costs — so the recommendation
// (lib/planRead/recommendation.js) can hold the company's target margin. A
// block whose cost cannot be told says so (`costComplete: false`); it is
// never filled with a guess.
//
// Pure.

import { getPriceBook } from "@/app/data/tradePriceBooks";
import { hangLine, finishLevelLine } from "@/lib/quotes/drywallFinishLine";
import { buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { roofLabour, roofLabourRates, pitchBand, SQFT_PER_SQUARE } from "@/lib/pricing/roofLabour";
import { presetReader } from "@/lib/pricing/labourPresets";
import { expandTemplate } from "@/lib/services/templates";
import { hoursFor } from "@/lib/services/productionRates";
import { TRADE_CATEGORIES, TRADE_LABELS, itemDef } from "./tradeCatalogue";
import { suggestionFor, complexityFactor, tierFor, drywallCostParts, roofingShingleCostPerSquare, COMPLEXITY_SOURCE } from "./tradeDefaults";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const RUNG_LABELS = Object.freeze({
  engine: "Your rates",
  service: "Your service",
  suggestion: "FieldQuo suggestion — not your price yet",
  none: "No rate — add one",
});

/** The pricing assumptions a person accepted from the conversation, by kind. */
export function assumptionsIndex(list) {
  const out = { production: new Map(), material: new Map(), waste: new Map(), labourRate: null, targetPct: null };
  for (const a of Array.isArray(list) ? list : []) {
    if (!a || a.applied === false) continue;
    const key = `${a.tradeKey || ""}|${a.itemKey || ""}`;
    if (a.kind === "production_rate" && a.value > 0) out.production.set(key, a);
    else if (a.kind === "material_cost" && a.value >= 0) out.material.set(key, a);
    else if (a.kind === "waste" && a.value >= 0) out.waste.set(a.tradeKey || "*", a);
    else if (a.kind === "labour_rate" && a.value > 0) out.labourRate = a;
    else if (a.kind === "target_margin" && a.value >= 0 && a.value < 95) out.targetPct = a;
  }
  return out;
}

function fromChat(a) {
  return { name: `Your figure from the conversation: “${String(a.quote || "").slice(0, 120)}”`, value: a.value, unit: a.unit || "", source: "This read's chat, accepted by a person", tag: "READ" };
}

/** Hours on a block after the trade's complexity and any figure the
 *  estimator gave in the conversation (which replaces the rate, not stacks). */
function hoursWith({ tradeKey, itemKey, qty, baseHours, level, assumptions, applyComplexity = true }) {
  const a = assumptions.production.get(`${tradeKey}|${itemKey}`);
  if (a) return { hours: round2(qty / a.value), coefficients: [fromChat(a)], complexity: null };
  if (baseHours === null || baseHours === undefined) return { hours: null, coefficients: [], complexity: null };
  const f = applyComplexity ? complexityFactor(level) : 1;
  return { hours: round2(baseHours * f), coefficients: [], complexity: applyComplexity ? f : null };
}

function materialWith({ tradeKey, itemKey, qty, perUnit, assumptions }) {
  const a = assumptions.material.get(`${tradeKey}|${itemKey}`);
  const unit = a ? a.value : perUnit;
  if (unit === null || unit === undefined) return { cost: null, coefficients: [] };
  const w = assumptions.waste.get(tradeKey) || assumptions.waste.get("*");
  const waste = w ? 1 + w.value / 100 : 1;
  return { cost: round2(qty * unit * waste), coefficients: [...(a ? [fromChat(a)] : []), ...(w ? [fromChat(w)] : [])] };
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNG 1 — the company's engines
// ═══════════════════════════════════════════════════════════════════════════

function drywallEngineBlock(item, { book, own, level, currency, labourRate, assumptions, presetRates }) {
  const qty = item.quantity.value;
  const tier = tierFor(level);
  const lines = [];
  const notes = [];
  const lvlNum = Number.isInteger(item.attributes?.finishLevel) ? item.attributes.finishLevel : null;
  if (item.itemKey === "wall_board" || item.itemKey === "ceiling_board") {
    const layers = Math.max(1, Number(item.attributes?.layers) || 1);
    const hang = hangLine({ book, quantity: qty * layers, tier });
    if (hang) lines.push(hang);
    // The finish level is the drawings' — GA-214, as the specs or the wall
    // types state it. Not stated: priced at Level 4 (GA-214's paint-ready
    // default), and the block says it was assumed; the trade's question
    // already asks for it.
    const level4 = lvlNum === null;
    const finish = finishLevelLine({ level: `level_${level4 ? 4 : lvlNum}`, book, quantity: qty, tier });
    if (finish) lines.push(finish);
    if (level4) notes.push("Finish level not stated on the drawings — priced at Level 4 (paint-ready). Confirm it.");
    if (item.itemKey === "ceiling_board") {
      const up = Number(book?.complexity?.[tier]?.ceilingUpchargePerSqft);
      if (up > 0) lines.push({ description: "Ceiling / lid surcharge", quantity: round2(qty), unit: "sqft", rate: up, amount: round2(qty * up) });
    }
  } else if (item.itemKey === "corner_bead") {
    const r = Number(book?.complexity?.[tier]?.cornerBeadPricePerLf);
    if (r > 0) lines.push({ description: "Corner bead", quantity: round2(qty), unit: "linear ft", rate: r, amount: round2(qty * r) });
  }
  if (!lines.length) return null;
  const cost = drywallCostParts({ itemKey: item.itemKey, level: lvlNum ?? 4, layers: item.attributes?.layers || 1, currency, boardType: item.attributes?.boardType, get: presetReader(presetRates || {}) });
  const h = hoursWith({ tradeKey: "drywall", itemKey: item.itemKey, qty, baseHours: cost ? cost.hoursPerUnit * qty : null, level, assumptions, applyComplexity: false });
  const m = materialWith({ tradeKey: "drywall", itemKey: item.itemKey, qty, perUnit: cost?.materialPerUnit ?? null, assumptions });
  return {
    rung: "engine",
    own,
    source: own ? "Your drywall rate card (Settings → Services)" : "Your drywall rate card — FieldQuo's starting rates, not yet edited (Settings → Services)",
    tier,
    lines,
    sell: round2(lines.reduce((n, l) => n + num(l.amount), 0)),
    hours: h.hours,
    labourCost: h.hours === null ? null : round2(h.hours * labourRate),
    materialCost: m.cost,
    lineCost: 0,
    costComplete: h.hours !== null && m.cost !== null,
    coefficients: [...(cost?.coefficients || []), ...h.coefficients, ...m.coefficients],
    notes,
  };
}

/** Free text from a drawing → the roofing book's material key. */
export function roofMaterialKey(text, book) {
  const s = String(text || "").toLowerCase();
  const pick = (k) => (book?.materials && Object.hasOwn(book.materials, k) ? k : null);
  // Tile, slate and fibre-cement are not the book's: never the default shingle.
  if (roofLabourOnlyMaterial(s)) return null;
  if (/standing|seam/.test(s)) return pick("metal_standing_seam");
  if (/metal|corrugat|steel/.test(s)) return pick("metal_corrugated");
  if (/cedar|shake/.test(s)) return pick("cedar_shake");
  if (/3.?tab/.test(s)) return pick("asphalt_3tab");
  if (/premium|designer|luxury/.test(s)) return pick("asphalt_premium");
  if (/tpo|epdm|membrane|mod.?bit|built.?up|flat/.test(s)) return pick("membrane_flat");
  if (/architectural|asphalt|shingle|laminated/.test(s)) return pick("asphalt_arch");
  return null;
}

/** Free text → a roofing material the book does NOT sell but the labour
 *  block can time (ROOF_LABOUR_DEFAULTS.materialLabourFactor), or null. */
export function roofLabourOnlyMaterial(text) {
  const s = String(text || "").toLowerCase();
  if (/fib(er|re).?cement/.test(s) && /slate|shingle/.test(s)) return "fiber_cement_slate";
  if (/slate/.test(s) && !/slateline|designer/.test(s)) return "slate";
  if (/clay|terra.?cotta|mission|s-?tile|spanish/.test(s) && /tile/.test(s)) return "clay_tile";
  if (/concrete/.test(s) && /tile/.test(s)) return "concrete_tile";
  if (/\btile\b/.test(s)) return "concrete_tile";
  return null;
}

const ROOF_ENGINE_ITEMS = new Set(["roof_plane", "low_slope", "ridge", "hip", "valley", "eave", "rake", "flashing", "penetration"]);

/**
 * The whole pitched roof as ONE roofing takeoff, priced by the company's
 * roofing book (buildTradeLineItems) and timed by roofLabour — the config the
 * builder's roofing card would hold, so the draft quote can carry it (P4).
 */
export function roofingConfigFrom(items, book) {
  const sum = (keys) => items.filter((i) => keys.includes(i.itemKey)).reduce((n, i) => n + num(i.quantity.value), 0);
  const planes = items.filter((i) => i.itemKey === "roof_plane");
  const squares = round2(planes.reduce((n, i) => n + num(i.quantity.value), 0));
  const pitch = planes.find((i) => num(i.attributes?.pitch) > 0)?.attributes?.pitch || 0;
  const layers = planes.find((i) => Number.isInteger(i.attributes?.layers))?.attributes?.layers ?? 1;
  const statedMaterial = planes.map((i) => roofMaterialKey(i.attributes?.material, book)).find(Boolean) || null;
  return {
    config: {
      squares,
      pitchRise: pitch,
      layers,
      storeys: "one",
      materialKey: statedMaterial || book?.defaultMaterial,
      deckSheets: 0,
      iceWaterFt: 0,
      dripEdgeFt: round2(sum(["eave", "rake"])),
      starterFt: round2(sum(["eave"])),
      valleyFt: round2(sum(["valley"])),
      ridgeHipFt: round2(sum(["ridge", "hip"])),
      ridgeVentFt: 0,
      stepFlashingFt: round2(sum(["flashing"])),
      ventBoots: Math.round(sum(["penetration"])),
      boxVents: 0,
      skylights: 0,
      chimneys: 0,
      crewSize: 2,
      measuredFrom: "drawings",
      notes: "",
    },
    materialStated: Boolean(statedMaterial),
  };
}

function roofingEngineBlocks(items, { book, own, rates, currency, labourRate, assumptions }) {
  const active = items.filter((i) => ROOF_ENGINE_ITEMS.has(i.itemKey) && i.quantity.value > 0);
  if (!active.length || !book) return { blocks: [], covered: new Set() };
  const blocks = [];
  const covered = new Set();
  const pitched = active.filter((i) => i.itemKey !== "low_slope");
  const flat = active.filter((i) => i.itemKey === "low_slope");
  const one = (list, configPatch, label) => {
    const { config, materialStated } = roofingConfigFrom(list, book);
    Object.assign(config, configPatch);
    // Tile, slate or fibre-cement on the drawings: the book has no SELL rate
    // for them, so pricing them as the default shingle would be a price for a
    // roof nobody drew. Their HOURS are known (the roofing rate card's labour
    // block, Craftsman-calibrated) — so they are a suggestion block, timed
    // and priced from the company's target margin, and said to be.
    const labourOnly = !materialStated ? list.map((i) => roofLabourOnlyMaterial(i.attributes?.material)).find(Boolean) : null;
    if (labourOnly) {
      for (const i of list) covered.add(i.id);
      const labour = roofLabour({ ...config, materialKey: labourOnly, materials: {} }, roofLabourRates(book.labour || null));
      const chatHours = list.map((i) => assumptions.production.get(`roofing|${i.itemKey}`)).find(Boolean);
      const hours = chatHours ? round2(num(config.squares) / chatHours.value) : round2(labour.hours);
      blocks.push({
        rung: "suggestion",
        own: false,
        source: "FieldQuo suggestion — your roofing book has no rate for this material; hours from your roofing rate card's labour, price from your target margin",
        label,
        itemIds: list.map((i) => i.id),
        takeoff: { ...config, materialKey: labourOnly },
        lines: [],
        sell: null,
        hours,
        labourCost: round2(hours * labourRate),
        materialCost: null,
        lineCost: 0,
        costComplete: false,
        coefficients: [
          { name: "Roof labour-hours", value: round2(labour.hours), unit: "h", source: `lib/pricing/roofLabour.js roofLabour — ${labourOnly.replace(/_/g, " ")} at ×${labour.materialFactor} install, ${labour.pitch.label}, ${labour.squares} squares`, tag: "DERIVED" },
          ...(chatHours ? [fromChat(chatHours)] : []),
        ],
        notes: [`${labourOnly.replace(/_/g, " ")} is not in your roofing rate card — add it there to price it as your own. No material cost is counted.`],
      });
      return;
    }
    const lines = buildTradeLineItems("roofing_service", config, rates || null);
    if (!lines.length) return;
    for (const i of list) covered.add(i.id);
    const labour = roofLabour(config, roofLabourRates(book.labour || null));
    const shingle = /asphalt/.test(String(config.materialKey)) ? roofingShingleCostPerSquare(currency) : null;
    const chatHours = list.map((i) => assumptions.production.get(`roofing|${i.itemKey}`)).find(Boolean);
    const hours = chatHours ? round2(num(config.squares) / chatHours.value) : round2(labour.hours);
    const m = shingle ? materialWith({ tradeKey: "roofing", itemKey: "roof_plane", qty: num(config.squares), perUnit: shingle.perSquare, assumptions }) : { cost: null, coefficients: [] };
    const notes = [];
    if (!materialStated) notes.push(`Roofing material not stated — priced as your default (${book.materials?.[config.materialKey]?.label || config.materialKey}).`);
    if (shingle) notes.push("Material cost counts the shingles only — underlayment, flashing and fasteners are not in the cost.");
    if (!num(config.pitchRise)) notes.push("No pitch printed — priced as a walkable roof. Confirm the pitch.");
    blocks.push({
      rung: "engine",
      own,
      source: own ? "Your roofing rate card (Settings → Services)" : "Your roofing rate card — FieldQuo's starting rates, not yet edited (Settings → Services)",
      label,
      itemIds: list.map((i) => i.id),
      takeoff: config,
      lines,
      sell: round2(lines.reduce((n, l) => n + num(l.amount), 0)),
      hours,
      labourCost: round2(hours * labourRate),
      materialCost: m.cost,
      lineCost: 0,
      costComplete: m.cost !== null,
      coefficients: [
        { name: "Roof labour-hours", value: round2(labour.hours), unit: "h", source: `lib/pricing/roofLabour.js roofLabour — ${pitchBand(num(config.pitchRise)).label}, ${labour.squares} squares`, tag: "DERIVED" },
        ...(chatHours ? [fromChat(chatHours)] : []),
        ...(shingle ? [shingle.coefficient] : []),
        ...m.coefficients,
      ],
      notes,
    });
  };
  if (pitched.length) one(pitched, {}, "Roof");
  if (flat.length) {
    const sq = round2(flat.reduce((n, i) => n + num(i.quantity.value), 0) / SQFT_PER_SQUARE);
    const key = book.materials && Object.hasOwn(book.materials, "membrane_flat") ? "membrane_flat" : null;
    if (key) one(flat, { squares: sq, materialKey: key, pitchRise: 1, dripEdgeFt: 0, starterFt: 0, valleyFt: 0, ridgeHipFt: 0, stepFlashingFt: 0, ventBoots: 0 }, "Low-slope roof");
  }
  return { blocks, covered };
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNG 2 — the company's own services
// ═══════════════════════════════════════════════════════════════════════════

/** The company's services that can price a trade's items: in the trade's
 *  categories, active, with a template line keyed to a measurement key. */
export function servicesForTrade(services, tradeKey) {
  const cats = new Set(TRADE_CATEGORIES[tradeKey] || []);
  return (Array.isArray(services) ? services : [])
    .filter((p) => p && p.active !== false && p.templateEnabled !== false && Array.isArray(p.templateLines))
    .filter((p) => (p.categoryKeys || []).some((k) => cats.has(k)))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

/** Measurement keys a trade's own services are keyed to — the catalogue's
 *  "yours" flag, so the read knows which quantities the company prices. */
export function ownServiceKeys(services, tradeKey) {
  const keys = new Set();
  for (const p of servicesForTrade(services, tradeKey)) for (const l of p.templateLines) if (l?.measurementKey) keys.add(l.measurementKey);
  return [...keys];
}

function serviceBlocks(items, tradeKey, { services, currency, labourRate, level, assumptions }) {
  const products = servicesForTrade(services, tradeKey);
  const blocks = [];
  const covered = new Set();
  // Items sharing a key are summed into ONE expansion of the service: a
  // template's fixed lines (a call-out, a permit) appear once, not per item.
  const byProduct = new Map();
  for (const item of items) {
    const key = itemDef(tradeKey, item.itemKey)?.key;
    if (!key || !(item.quantity.value > 0)) continue;
    const product = products.find((p) => p.templateLines.some((l) => l?.measurementKey === key));
    if (!product) continue;
    if (!byProduct.has(product.id)) byProduct.set(product.id, { product, keys: new Map(), items: [] });
    const g = byProduct.get(product.id);
    g.keys.set(key, (g.keys.get(key) || 0) + item.quantity.value);
    g.items.push(item);
  }
  for (const { product, keys, items: its } of byProduct.values()) {
    const measurements = Object.fromEntries(keys);
    const expanded = expandTemplate(product, { measurements, currency });
    // A line keyed to a measurement the read did not produce keeps its seed
    // quantity in the builder; here it is left out and SAID, rather than
    // priced at a quantity nobody measured.
    const lines = expanded.filter((l) => !l.needsMeasurement && l.rate !== null);
    const skipped = expanded.length - lines.length;
    if (!lines.length) continue;
    for (const i of its) covered.add(i.id);
    let hours = null;
    const coefficients = [];
    const prodKey = product.production?.key;
    if (prodKey && keys.has(prodKey)) {
      const chat = its.map((i) => assumptions.production.get(`${tradeKey}|${i.itemKey}`)).find(Boolean);
      const base = hoursFor(product.production, keys.get(prodKey));
      const h = hoursWith({ tradeKey, itemKey: chat?.itemKey || its[0].itemKey, qty: keys.get(prodKey), baseHours: base, level, assumptions });
      hours = h.hours;
      coefficients.push({ name: `${product.name} — production rate`, value: product.production.amount, unit: product.production.basis, source: "Your service's production rate (Settings → Services)", tag: "READ" }, ...h.coefficients);
      if (h.complexity && h.complexity !== 1) coefficients.push({ name: "Complexity", value: h.complexity, unit: "× hours", source: COMPLEXITY_SOURCE, tag: "DERIVED" });
    }
    const costKnown = lines.every((l) => l.cost !== null);
    blocks.push({
      rung: "service",
      own: true,
      source: `Your service: ${product.name}`,
      productId: product.id,
      itemIds: its.map((i) => i.id),
      lines: lines.map((l) => ({ description: l.description, detail: l.detail || "", quantity: l.quantity, unit: l.unit, rate: l.rate, amount: l.amount, ...(l.unitCost !== null ? { unitCost: l.unitCost } : {}), meta: { template: { productId: product.id } } })),
      sell: round2(lines.reduce((n, l) => n + num(l.amount), 0)),
      hours,
      // The service's own lines carry its labour and material costs; hours
      // here are crew TIME (for the overhead share), not costed twice.
      labourCost: 0,
      materialCost: 0,
      lineCost: round2(lines.reduce((n, l) => n + num(l.cost), 0)),
      costComplete: costKnown,
      coefficients,
      notes: [
        ...(skipped ? [`${skipped} line${skipped === 1 ? "" : "s"} of “${product.name}” need a measurement this read did not take — left out.`] : []),
        ...(!costKnown ? [`Some lines of “${product.name}” have no cost on file — the margin cannot count them.`] : []),
        ...(hours === null ? [`“${product.name}” has no production rate — its time is not in the overhead share.`] : []),
      ],
    });
  }
  return { blocks, covered };
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNG 3 — FieldQuo's suggestions
// ═══════════════════════════════════════════════════════════════════════════

function suggestionBlock(item, tradeKey, { commercial, currency, labourRate, level, assumptions, presetRates }) {
  const s = suggestionFor(tradeKey, item.itemKey, { commercial, currency, attributes: item.attributes, level, presetRates });
  if (!s) return null;
  const qty = item.quantity.value;
  const h = hoursWith({ tradeKey, itemKey: item.itemKey, qty, baseHours: s.hoursPerUnit * qty, level, assumptions });
  const m = materialWith({ tradeKey, itemKey: item.itemKey, qty, perUnit: s.materialPerUnit ?? null, assumptions });
  const sell = s.sellPerUnit ? round2(s.sellPerUnit * qty) : null;
  return {
    rung: "suggestion",
    own: false,
    source: sell !== null ? "FieldQuo's framing price book — starting rates, not yours yet" : "FieldQuo suggestion — cost from cited production figures; price from your target margin",
    itemIds: [item.id],
    lines: [],
    sell,
    hours: h.hours,
    labourCost: h.hours === null ? null : round2(h.hours * labourRate),
    materialCost: m.cost,
    lineCost: 0,
    costComplete: h.hours !== null && m.cost !== null,
    coefficients: [
      ...s.coefficients,
      ...(h.complexity && h.complexity !== 1 ? [{ name: "Complexity", value: h.complexity, unit: "× hours", source: COMPLEXITY_SOURCE, tag: "DERIVED" }] : []),
      ...h.coefficients,
      ...m.coefficients,
    ],
    notes: [...(s.materialNote ? [s.materialNote] : [])],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ONE TRADE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Price one computed trade (lib/planRead/tradeModel.js computeTrade) by the
 * ladder. Pure.
 *
 * @param ctx { currency, commercial, labourRate, books: { drywall_install:
 *              { book, own, rates }, roofing_service: { book, own, rates } },
 *              services, assumptions (assumptionsIndex), presetRates:
 *              { [categoryKey]: CompanyServiceCategory.rates } — the rate
 *              cards whose `presets` override FieldQuo's labour presets }
 * @returns {{ tradeKey, label, blocks, unpriced, items }}
 */
export function priceTrade(trade, ctx) {
  const assumptions = ctx.assumptions || assumptionsIndex([]);
  const level = trade.complexity?.level || "medium";
  const commercial = ctx.commercial === true || trade.commercial === true;
  const base = { currency: ctx.currency, labourRate: ctx.labourRate, level, assumptions, commercial, presetRates: ctx.presetRates || {} };
  const active = trade.included === false ? [] : (trade.items || []).filter((i) => i.active && i.quantity?.value > 0);
  const blocks = [];
  const covered = new Set();

  if (trade.tradeKey === "roofing") {
    const rb = ctx.books?.roofing_service;
    const r = roofingEngineBlocks(active, { ...base, book: rb?.book || null, own: Boolean(rb?.own), rates: rb?.rates || null });
    blocks.push(...r.blocks);
    for (const id of r.covered) covered.add(id);
  }
  if (trade.tradeKey === "drywall") {
    const db = ctx.books?.drywall_install;
    for (const item of active) {
      if (!db?.book) break;
      const b = drywallEngineBlock(item, { ...base, book: db.book, own: Boolean(db.own) });
      if (b) {
        blocks.push({ ...b, itemIds: [item.id], label: item.label });
        covered.add(item.id);
      }
    }
  }
  const rest = active.filter((i) => !covered.has(i.id));
  const svc = serviceBlocks(rest, trade.tradeKey, { ...base, services: ctx.services || [] });
  blocks.push(...svc.blocks);
  for (const id of svc.covered) covered.add(id);
  const unpriced = [];
  for (const item of active.filter((i) => !covered.has(i.id))) {
    const b = suggestionBlock(item, trade.tradeKey, base);
    if (b) {
      blocks.push({ ...b, label: item.label });
      covered.add(item.id);
    } else unpriced.push({ itemId: item.id, label: item.label, quantity: item.quantity.value, unit: item.quantity.unit });
  }
  const byItem = new Map();
  for (const [i, b] of blocks.entries()) for (const id of b.itemIds || []) byItem.set(id, i);
  return {
    tradeKey: trade.tradeKey,
    label: TRADE_LABELS[trade.tradeKey] || trade.tradeKey,
    blocks: blocks.map((b, i) => ({ id: `${trade.tradeKey}.b${i + 1}`, rungLabel: RUNG_LABELS[b.rung], ...b })),
    unpriced,
    items: active.map((i) => ({ itemId: i.id, block: byItem.has(i.id) ? `${trade.tradeKey}.b${byItem.get(i.id) + 1}` : null, confidence: i.quantity.confidence })),
  };
}

/** Every trade of a computed model. */
export function priceTrades(trades, ctx) {
  return (Array.isArray(trades) ? trades : []).filter((t) => t.included !== false).map((t) => priceTrade(t, ctx));
}

/** Which of the company's categories a trade's lines go under on the quote:
 *  the read's own scope first, then the trade's usual categories the company
 *  has switched on. Null when it has none — the draft says so. */
export function categoryForTrade(tradeKey, { scopeKeys = [], enabledKeys = [] } = {}) {
  const usual = TRADE_CATEGORIES[tradeKey] || [];
  const enabled = new Set(enabledKeys);
  return usual.find((k) => scopeKeys.includes(k) && enabled.has(k)) || usual.find((k) => enabled.has(k)) || null;
}

/** The company's own price books for the engines, read off its saved rates. */
export function engineBooks(ratesByCategory = {}) {
  const out = {};
  for (const key of ["drywall_install", "roofing_service"]) {
    const rates = ratesByCategory[key] || null;
    // `presets` are labour figures (lib/pricing/labourPresets.js), not the
    // book's prices: a company that edited only its hours still sells on
    // FieldQuo's starting rates, and the screen must not say otherwise.
    out[key] = { book: getPriceBook(key, rates), own: Boolean(rates && typeof rates === "object" && Object.keys(rates).some((k) => k !== "presets")), rates };
  }
  return out;
}
