// lib/planRead/tradeDefaults.js
//
// FieldQuo's own starting figures for a drawing-read item the company has no
// rate for — the pricing ladder's third rung (lib/planRead/tradePricing.js).
// Every figure here is IMPORTED from the module that already holds it, with
// that module's own source and tag; nothing is restated as a new number,
// because a copy is the one that rots (AGENTS.md failure class 4). Where no
// module in the repo states a figure, there is none: the item is "No rate —
// add one", never a plausible guess.
//
// ══ What a suggestion is ═══════════════════════════════════════════════════
//
// Hours (a production default × the quantity) and a material cost per unit —
// the COST of the work. It is never the company's price. The sell side is
// worked out from the company's own target margin by the recommendation
// (lib/planRead/recommendation.js), or, for framing, read from the framing
// price book (app/data/priceBooks/structural.js — the owner, 2026-10-04:
// "switch it on"), and it is shown everywhere as "FieldQuo suggestion — not
// your price yet". It reaches a quote only through a person's button.
//
// ══ Commercial electrical (the owner's decision, 2026-10-04) ═══════════════
//
// NECA Manual of Labor Units minutes as PUBLISHED (factor 1.0) for a
// commercial job; the residential factor (0.456, fitted to one real
// whole-house rewire) for a house only. Both are cited on the line.
//
// Each coefficient: { name, value, unit, source, tag } — tag READ (published),
// DERIVED (computed from read figures) or GUESS (stated as such where it is).
//
// Pure.

import {
  NECA_ROUGH_IN_MINUTES,
  TRIM_SHARE_OF_ROUGH_IN,
  RESIDENTIAL_PRODUCTIVITY_FACTOR,
  PANEL_SWAP_HOURS,
  MATERIAL_COSTS as ELECTRICAL_MATERIAL_COSTS,
} from "@/lib/estimate/rewireTakeoff";
import { getInteriorRecipe, interiorCost } from "@/app/data/priceBooks/interior";
import { STRUCTURAL_PRICE_BOOKS, STRUCTURAL_RECIPES, flattenPriceBook, flattenRecipe } from "@/app/data/priceBooks/structural";
import { HD } from "@/app/data/serviceSeeds/_materialCosts";

const round2 = (n) => Math.round(n * 100) / 100;
const c = (name, value, unit, source, tag) => ({ name, value, unit, source, tag });

/** Complexity → a stated multiplier on HOURS only, applied once per line
 *  (the rule lib/pricing/roofLabour.js keeps). [GUESS] — the plan's opening
 *  position (1.0 / 1.15 / 1.35 / 1.6), the same register as
 *  lib/pricing/complexity/index.js's unmeasured defaults. */
export const COMPLEXITY_HOUR_FACTORS = Object.freeze({ low: 1.0, medium: 1.15, high: 1.35, very_high: 1.6 });

export function complexityFactor(level) {
  return Object.hasOwn(COMPLEXITY_HOUR_FACTORS, level) ? COMPLEXITY_HOUR_FACTORS[level] : COMPLEXITY_HOUR_FACTORS.medium;
}

/** The drywall / framing books' tier for a trade's complexity level. */
export function tierFor(level) {
  if (level === "very_high") return "high";
  if (level === "high") return "moderate";
  return "standard";
}

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRICAL — NECA units (lib/estimate/rewireTakeoff.js)
// ═══════════════════════════════════════════════════════════════════════════

const NECA_SRC = "NECA Manual of Labor Units rough-in minutes (lib/estimate/rewireTakeoff.js NECA_ROUGH_IN_MINUTES)";
const ELECTRICAL_DEVICE = Object.freeze({
  receptacle: { neca: "receptacle", tag: "READ", material: ["receptacle", "box", "plate"] },
  receptacle_gfci: { neca: "receptacle", tag: "READ", material: ["gfciReceptacle", "box", "plate"] },
  receptacle_dedicated: { neca: "dedicated", tag: "GUESS", material: ["receptacle", "box", "plate"] },
  switch: { neca: "switch", tag: "READ", material: ["switchDevice", "box", "plate"] },
  dimmer: { neca: "switch", tag: "READ", material: null },
  light_fixture: { neca: "fixture", tag: "READ", material: ["fixture"] },
  smoke_co: { neca: "smokeCo", tag: "GUESS", material: ["smokeCoDetector"] },
  circuit: { neca: "circuit", tag: "READ", material: null },
});

function electricalSuggestion(itemKey, { commercial, currency }) {
  if (itemKey === "panel") {
    return {
      hoursPerUnit: PANEL_SWAP_HOURS,
      materialPerUnit: null,
      materialNote: "No panel material default — FieldQuo's $2,250 figure is an installed price, not a material cost.",
      coefficients: [c("Panel swap and re-land", PANEL_SWAP_HOURS, "h each", "lib/estimate/rewireTakeoff.js PANEL_SWAP_HOURS", "GUESS")],
    };
  }
  const dev = ELECTRICAL_DEVICE[itemKey];
  if (!dev) return null;
  const minutes = NECA_ROUGH_IN_MINUTES[dev.neca];
  const factor = commercial ? 1 : RESIDENTIAL_PRODUCTIVITY_FACTOR;
  const hoursPerUnit = (minutes / 60) * (1 + TRIM_SHARE_OF_ROUGH_IN) * factor;
  const coefficients = [
    c(`Rough-in, ${dev.neca}`, minutes, "min each", NECA_SRC, dev.tag),
    c("Trim-out", TRIM_SHARE_OF_ROUGH_IN, "× rough-in", "lib/estimate/rewireTakeoff.js TRIM_SHARE_OF_ROUGH_IN (published 30–50%)", "READ"),
    commercial
      ? c("Productivity", 1, "× NECA", "Commercial job: NECA units as published (the owner's decision, 2026-10-04)", "READ")
      : c("Residential productivity", RESIDENTIAL_PRODUCTIVITY_FACTOR, "× NECA", "lib/estimate/rewireTakeoff.js RESIDENTIAL_PRODUCTIVITY_FACTOR — fitted to one real 1,461 sq ft rewire", "DERIVED"),
  ];
  let materialPerUnit = null;
  let materialNote = null;
  if (dev.material && currency === "USD") {
    materialPerUnit = dev.material.reduce((n, k) => n + ELECTRICAL_MATERIAL_COSTS[k], 0);
    for (const k of dev.material) coefficients.push(c(`Material: ${k}`, ELECTRICAL_MATERIAL_COSTS[k], "USD each", "lib/estimate/rewireTakeoff.js MATERIAL_COSTS (Caudill trade prices; box and plate GUESS)", k === "box" || k === "plate" ? "GUESS" : "READ"));
  } else if (dev.material) {
    materialNote = "FieldQuo's device costs are US trade prices; none is held in your currency — add your own.";
  } else {
    materialNote = "No material default for this item.";
  }
  return { hoursPerUnit, materialPerUnit, materialNote, coefficients };
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUMBING — the only per-unit hour figure the repo holds
// ═══════════════════════════════════════════════════════════════════════════

function plumbingSuggestion(itemKey) {
  if (itemKey !== "water_heater") return null;
  return {
    hoursPerUnit: 3,
    materialPerUnit: null,
    materialNote: "A water heater is an allowance — FieldQuo holds no unit cost for one.",
    coefficients: [c("Water heater install", 3, "h each", "app/data/plumbingBenchmarks.js wh_install_package — install labour 2–4 hours, the midpoint", "DERIVED")],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOORING — the staged flooring_install recipe (app/data/priceBooks/interior.js)
// ═══════════════════════════════════════════════════════════════════════════

const FLOOR_RECIPE_SRC = "app/data/priceBooks/interior.js INTERIOR_RECIPES.flooring_install (staged; ASSUMPTION per its own comments)";

/** A finish code or name → the recipe's material. Null = not one FieldQuo
 *  holds a production figure for (tile, carpet, sheet vinyl). */
export function floorMaterialOf(text) {
  const s = String(text || "").toLowerCase();
  if (/\blv[pt]\b|luxury vinyl|vinyl plank|\bspc\b/.test(s)) return "lvp";
  if (/laminate/.test(s)) return "laminate";
  if (/engineered/.test(s)) return "engineered";
  if (/hardwood|\boak\b|maple|\bwood\b|solid/.test(s)) return "solid";
  return null;
}

const FLOOR_MATERIAL = Object.freeze({
  lvp: { labour: "lvpPerSqft", stock: "lvp_click" },
  laminate: { labour: "laminatePerSqft", stock: "laminate" },
  engineered: { labour: "engineeredNailPerSqft", stock: "engineered_hardwood" },
  solid: { labour: "solidNailPerSqft", stock: "solid_hardwood" },
});

function flooringSuggestion(itemKey, { currency, attributes }) {
  const recipe = getInteriorRecipe("flooring_install");
  const L = recipe?.labour || {};
  const cost = (key) => interiorCost(recipe?.materials?.[key]?.cost, currency);
  if (itemKey === "floor_area") {
    const kind = floorMaterialOf(attributes?.material);
    if (!kind) return null;
    const m = FLOOR_MATERIAL[kind];
    const unit = cost(m.stock);
    return {
      hoursPerUnit: L[m.labour],
      materialPerUnit: unit,
      materialNote: unit === null ? "No material default in your currency." : null,
      coefficients: [
        c(`Install, ${kind}`, L[m.labour], "h per sq ft", FLOOR_RECIPE_SRC, "DERIVED"),
        ...(unit !== null ? [c(`Material, ${kind}`, unit, `${currency} per sq ft`, "app/data/priceBooks/interior.js flooring_install materials — trade-typical band, typical", "READ")] : []),
      ],
    };
  }
  const simple = {
    base: ["shoeMouldingPerLf", "shoe_moulding", 8, "per 8 ft length"],
    transition: ["transitionEach", "transition_strip", 1, "each"],
    stair_tread: ["stairTreadEach", "stair_tread_retrofit", 1, "each"],
    floor_prep: ["levellingPerSqft", "self_leveller", 20, "per 50 lb bag (20 sq ft at 1/4 in)"],
  }[itemKey];
  if (!simple) return null;
  const [labourKey, stockKey, per, perText] = simple;
  const pack = cost(stockKey);
  const unit = pack === null ? null : pack / per;
  return {
    hoursPerUnit: L[labourKey],
    materialPerUnit: unit,
    materialNote: unit === null ? "No material default in your currency." : null,
    coefficients: [
      c(labourKey, L[labourKey], "h per unit", FLOOR_RECIPE_SRC, "DERIVED"),
      ...(pack !== null ? [c(`Material, ${stockKey}`, pack, `${currency} ${perText}`, "app/data/priceBooks/interior.js flooring_install materials — trade-typical band, typical", "READ")] : []),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAMING — the framing price book and recipe (app/data/priceBooks/structural.js)
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner (2026-10-04): switch it on. The book is a SELL book with a
// labour-and-material recipe beside it, every figure with its basis and a
// read/derived tag, in USD and CAD reasoned separately (never converted). It
// has no ServiceCategory yet (its proposedCatalogEntry is not merged), so a
// company cannot edit it in Settings → Services: here it is the framing
// price a read suggests, labelled as FieldQuo's starting rates. Flattened to
// the company's currency; a currency the book does not hold gets no price.

export const FRAMING_BOOK_SRC = "app/data/priceBooks/structural.js FRAMING (published-range midpoints, North American residential, 2025)";

export function framingBook(currency) {
  const cur = String(currency || "").toUpperCase();
  if (cur !== "USD" && cur !== "CAD") return null;
  return {
    book: flattenPriceBook(STRUCTURAL_PRICE_BOOKS.framing, cur),
    recipe: flattenRecipe(STRUCTURAL_RECIPES.framing, cur),
    raw: STRUCTURAL_PRICE_BOOKS.framing,
    rawRecipe: STRUCTURAL_RECIPES.framing,
    currency: cur,
  };
}

/** Is a wall line exterior / bearing (2x6, wallFrame) or a partition (2x4)? */
function framingWallKind(attributes) {
  const size = String(attributes?.studSize || "").toLowerCase();
  if (attributes?.bearing === true || /2\s*x\s*6|2x6|140/.test(size)) return "wallFrame";
  return "partition";
}

function framingSuggestion(itemKey, { currency, attributes, level }) {
  const fb = framingBook(currency);
  if (!fb) return null;
  if (String(attributes?.material || "").toLowerCase().includes("metal") && itemKey === "wall_framing") {
    return null; // the recipe is wood; a steel-stud wall has no figure here
  }
  const tier = tierFor(level);
  const R = fb.recipe;
  const basisOf = (path) => {
    const node = path.reduce((o, k) => (o ? o[k] : null), fb.raw);
    return node?.basis ? `${FRAMING_BOOK_SRC} — ${node.basis}` : FRAMING_BOOK_SRC;
  };
  const tagOf = (path) => {
    const node = path.reduce((o, k) => (o ? o[k] : null), fb.raw);
    return node?.confidence === "read" ? "READ" : "DERIVED";
  };
  const recipeBasis = (key) => {
    const node = fb.rawRecipe[key];
    return { source: `app/data/priceBooks/structural.js FRAMING_RECIPE.${key}${node?.basis ? ` — ${node.basis}` : ""}`, tag: node?.confidence === "read" ? "READ" : "DERIVED" };
  };
  const waste = 1 + R.wasteLumberPct;
  if (itemKey === "wall_framing") {
    const kind = framingWallKind(attributes);
    const sell = fb.book.complexity[tier][kind];
    const labourKey = kind === "wallFrame" ? "labourWallFrameHoursPerLf" : "labourPartitionHoursPerLf";
    const studKey = kind === "wallFrame" ? "matStud2x6x8" : "matStud2x4x8";
    // Studs at the stated spacing plus three plates (bottom and a doubled
    // top), stated as the assumption it is: 3 lf of plate per lf of wall,
    // cut from 8-ft stock, so 3 ÷ 8 of a stud length per foot.
    const spacing = Number(attributes?.studSpacingIn) > 0 ? Number(attributes.studSpacingIn) : R.specStudSpacingIn;
    const studsPerLf = 12 / spacing;
    const piecesPerLf = studsPerLf + 3 / 8;
    return {
      sellPerUnit: sell,
      hoursPerUnit: R[labourKey],
      materialPerUnit: round2(piecesPerLf * R[studKey] * waste * 100) / 100,
      coefficients: [
        c(`Framing book, ${kind} (${tier})`, sell, `${fb.currency} per lin ft`, basisOf(["complexity", tier, kind]), tagOf(["complexity", tier, kind])),
        c(labourKey, R[labourKey], "h per lin ft", recipeBasis(labourKey).source, recipeBasis(labourKey).tag),
        c("Studs per lin ft", round2(studsPerLf), `at ${spacing} in o.c.`, recipeBasis("specStudsPerLf").source, "DERIVED"),
        c("Plates", 3, "lin ft per lin ft of wall (assumption: one bottom, doubled top)", "FieldQuo assumption, stated", "GUESS"),
        c(studKey, R[studKey], `${fb.currency} each`, recipeBasis(studKey).source, recipeBasis(studKey).tag),
        c("Lumber waste", R.wasteLumberPct, "share", recipeBasis("wasteLumberPct").source, recipeBasis("wasteLumberPct").tag),
      ],
    };
  }
  if (itemKey === "header") {
    const span = Number(attributes?.spanFt) > 0 ? Number(attributes.spanFt) : null;
    return {
      sellPerUnit: fb.book.flats.headerEach,
      hoursPerUnit: R.labourHeaderHoursPerOpening,
      materialPerUnit: span ? round2(span * R.matLvlPerLf * waste) : null,
      materialNote: span ? null : "No span printed — the header's LVL is not costed.",
      coefficients: [
        c("Framing book, header", fb.book.flats.headerEach, `${fb.currency} each`, basisOf(["flats", "headerEach"]), tagOf(["flats", "headerEach"])),
        c("labourHeaderHoursPerOpening", R.labourHeaderHoursPerOpening, "h each", recipeBasis("labourHeaderHoursPerOpening").source, recipeBasis("labourHeaderHoursPerOpening").tag),
        ...(span ? [c("matLvlPerLf", R.matLvlPerLf, `${fb.currency} per lin ft × ${span} ft span`, recipeBasis("matLvlPerLf").source, recipeBasis("matLvlPerLf").tag)] : []),
      ],
    };
  }
  if (itemKey === "sheathing") {
    const perSqft = (R.matOsbSheathingPerSheet / R.specSqftPerSheet) * (1 + R.wasteSheathingPct);
    return {
      sellPerUnit: fb.book.complexity[tier].sheathing,
      hoursPerUnit: R.labourSheathingHoursPerSqft,
      materialPerUnit: round2(perSqft * 1000) / 1000,
      coefficients: [
        c(`Framing book, sheathing (${tier})`, fb.book.complexity[tier].sheathing, `${fb.currency} per sq ft`, basisOf(["complexity", tier, "sheathing"]), tagOf(["complexity", tier, "sheathing"])),
        c("labourSheathingHoursPerSqft", R.labourSheathingHoursPerSqft, "h per sq ft", recipeBasis("labourSheathingHoursPerSqft").source, recipeBasis("labourSheathingHoursPerSqft").tag),
        c("matOsbSheathingPerSheet", R.matOsbSheathingPerSheet, `${fb.currency} per 32 sq ft sheet`, recipeBasis("matOsbSheathingPerSheet").source, recipeBasis("matOsbSheathingPerSheet").tag),
        c("Sheathing waste", R.wasteSheathingPct, "share", recipeBasis("wasteSheathingPct").source, recipeBasis("wasteSheathingPct").tag),
      ],
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRYWALL & ROOFING — only what their ENGINE does not cover (rung 1 handles
// board, finish levels, roof squares and the edges; see tradePricing.js)
// ═══════════════════════════════════════════════════════════════════════════

/** Drywall's cost side for the engine's lines: the staged drywall recipe. */
export function drywallCostParts({ itemKey, level, layers = 1, currency }) {
  const recipe = getInteriorRecipe("drywall_install");
  const L = recipe?.labour;
  const M = recipe?.materials || {};
  if (!L) return null;
  const SRC = "app/data/priceBooks/interior.js INTERIOR_RECIPES.drywall_install (staged; ASSUMPTION per its own comments)";
  const lvl = Math.max(0, Math.min(5, Number(level) || 0));
  if (itemKey === "corner_bead") {
    const stick = interiorCost(M.corner_bead?.cost, currency);
    return {
      hoursPerUnit: L.cornerBeadPerLf,
      materialPerUnit: stick === null ? null : stick / 8,
      coefficients: [c("cornerBeadPerLf", L.cornerBeadPerLf, "h per lin ft", SRC, "DERIVED"), ...(stick !== null ? [c("Corner bead", stick, `${currency} per 8 ft`, "interior.js drywall_install materials — trade-typical band", "READ")] : [])],
    };
  }
  if (itemKey !== "wall_board" && itemKey !== "ceiling_board") return null;
  const hang = L.hangPerSqft * (itemKey === "ceiling_board" ? L.hangCeilingMultiplier : 1) * Math.max(1, layers);
  const finish = lvl > 0 ? L.finishPerSqftByLevel[lvl] || 0 : 0;
  const board = interiorCost(M.board_half_4x8?.cost, currency);
  const compound = interiorCost(M.compound_allpurpose?.cost, currency);
  const tape = interiorCost(M.tape_paper?.cost, currency);
  const screws = interiorCost(M.screws?.cost, currency);
  const per = board === null || compound === null || tape === null || screws === null
    ? null
    : (board / 32) * 1.1 * Math.max(1, layers) +
      (lvl > 0 ? (compound / 475) * (lvl === 5 ? 2 : lvl / 4) : 0) +
      (tape / 500) * 0.4 +
      (screws / 1300) * 1.0 * Math.max(1, layers);
  return {
    hoursPerUnit: hang + finish,
    materialPerUnit: per === null ? null : round2(per * 1000) / 1000,
    coefficients: [
      c(itemKey === "ceiling_board" ? "Hang (ceiling ×1.35)" : "Hang", L.hangPerSqft, "h per sq ft of board", SRC, "DERIVED"),
      ...(lvl > 0 ? [c(`Finish, Level ${lvl}`, L.finishPerSqftByLevel[lvl], "h per sq ft", SRC, "DERIVED")] : []),
      ...(per !== null ? [c("Board, compound, tape, screws", round2(per * 1000) / 1000, `${currency} per sq ft`, "interior.js drywall_install materials and consumption — trade-typical bands, 10% board waste", "READ")] : []),
    ],
  };
}

/** Roofing's material cost per square: architectural shingles, Home Depot. */
export function roofingShingleCostPerSquare(currency) {
  const hd = HD.shingles_bundle;
  if (!hd) return null;
  const cur = String(currency || "").toUpperCase();
  const bundle = cur === "USD" ? hd.cost : cur === "CAD" ? hd.ca?.cost ?? null : null;
  if (!(bundle > 0)) return null;
  return { perSquare: round2(bundle * 3), coefficient: c("Architectural shingles", bundle, `${cur} per bundle × 3 per square`, "app/data/materialReference.js shingles_bundle (Home Depot, 2026-09-24)", "READ") };
}

/**
 * The third rung for one item: { hoursPerUnit, materialPerUnit, sellPerUnit?,
 * materialNote?, coefficients } or null — "No rate — add one".
 */
export function suggestionFor(tradeKey, itemKey, { commercial = false, currency = "USD", attributes = {}, level = "medium" } = {}) {
  const cur = String(currency || "USD").toUpperCase();
  switch (tradeKey) {
    case "electrical":
      return electricalSuggestion(itemKey, { commercial, currency: cur });
    case "plumbing":
      return plumbingSuggestion(itemKey);
    case "flooring":
      return flooringSuggestion(itemKey, { currency: cur, attributes });
    case "framing":
      return framingSuggestion(itemKey, { currency: cur, attributes, level });
    case "drywall":
      return drywallCostParts({ itemKey, level: attributes?.finishLevel, layers: attributes?.layers || 1, currency: cur });
    default:
      return null;
  }
}
