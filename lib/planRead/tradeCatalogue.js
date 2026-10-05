// lib/planRead/tradeCatalogue.js
//
// The vocabulary a drawing read uses for the trades beyond painting —
// drywall, framing, roofing, electrical, plumbing, flooring — and the rules
// that say which sheets of a set each trade reads. No price, no rate and no
// production figure lives here: the model picks an item KEY and points at
// where its quantity is printed; lib/planRead/tradeModel.js computes the
// quantity; lib/planRead/tradePricing.js prices it.
//
// ══ The trade comes from the quote, never from a separate picker ═══════════
//
// The owner (2026-10-04): "if they are doing a roofing quote the AI should
// understand that the drawings are about the roof and not inside; if interior
// painting, about the interior not exterior". So a read's trades are the
// SERVICES on its quote or request — ServiceCategory keys (interior_painting,
// electrical, roofing_service …) — mapped here to a trade and a FOCUS
// (interior / exterior / roof / whole building). CATEGORY_TRADES is that map.
// A category with no drawing-read trade (cleaning, general contracting) maps
// to nothing, and the read says so rather than guessing a trade for it.
//
// ══ Measurement keys ═══════════════════════════════════════════════════════
//
// Every item names the lib/services/measurementKeys.js key its quantity IS —
// the key a company's own service template line or production rate is stated
// in. That is how an item reaches the company's own services (pricing ladder
// rung 2). Keys the registry did not have (panels, plumbing fixtures, framing
// wall length …) were added THERE, with this read as their producing module,
// not invented here as a second vocabulary (AGENTS.md failure class 4).
//
// Pure — runs in the browser and in Node.

import { isMeasurementKey } from "@/lib/services/measurementKeys";

/** Every trade a read can scope to. Painting keeps its own catalogue
 *  (lib/planRead/catalogue.js) and its own project model. */
export const TRADE_KEYS = Object.freeze(["painting", "drywall", "framing", "roofing", "electrical", "plumbing", "flooring"]);
/** The trades this file's catalogue and lib/planRead/tradeModel.js serve. */
export const MULTI_TRADE_KEYS = Object.freeze(TRADE_KEYS.filter((k) => k !== "painting"));

export const TRADE_LABELS = Object.freeze({
  painting: "Painting",
  drywall: "Drywall",
  framing: "Framing",
  roofing: "Roofing",
  electrical: "Electrical",
  plumbing: "Plumbing",
  flooring: "Flooring",
});

/**
 * ServiceCategory.key → the trade a drawing read reads for it, and where on
 * the building. `focus`:
 *   interior   rooms, ceilings, interior elevations — never the outside
 *   exterior   elevations, the envelope — never the rooms
 *   roof       the roof plan, elevations for pitch, roof details
 *   building   wherever the trade's work is (wiring, pipe, framing)
 */
export const CATEGORY_TRADES = Object.freeze({
  interior_painting: { trade: "painting", focus: "interior" },
  exterior_painting: { trade: "painting", focus: "exterior" },
  drywall_install: { trade: "drywall", focus: "interior" },
  drywall: { trade: "drywall", focus: "interior" },
  carpentry: { trade: "framing", focus: "building" },
  framing: { trade: "framing", focus: "building" },
  roofing_service: { trade: "roofing", focus: "roof" },
  electrical: { trade: "electrical", focus: "building" },
  plumbing: { trade: "plumbing", focus: "building" },
  flooring_install: { trade: "flooring", focus: "interior" },
  flooring: { trade: "flooring", focus: "interior" },
  tiling: { trade: "flooring", focus: "interior" },
});

/** The categories, in the order a company most likely prices each trade
 *  under — the first one the company has switched on receives the trade's
 *  lines (lib/planRead/tradePricing.js, the draft quote). */
export const TRADE_CATEGORIES = Object.freeze({
  painting: ["interior_painting", "exterior_painting"],
  drywall: ["drywall_install", "drywall"],
  framing: ["carpentry", "framing"],
  roofing: ["roofing_service"],
  electrical: ["electrical"],
  plumbing: ["plumbing"],
  flooring: ["flooring_install", "tiling", "flooring"],
});

// ═══════════════════════════════════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════════════════════════════════
//
// unit   sqft · lnft · each · sq (roofing squares — 100 sq ft of SLOPED
//        roof; the model cites the PLAN dimensions and the pitch, and code
//        slopes it with lib/pricing/roofLabour.js slopedAreaSqft)
// key    the measurement key (lib/services/measurementKeys.js)
// attrs  which attributes matter for the item — the model fills only these

const I = (label, unit, key, attrs = []) => Object.freeze({ label, unit, key, attrs: Object.freeze(attrs) });

export const TRADE_ITEMS = Object.freeze({
  electrical: Object.freeze({
    receptacle: I("Duplex receptacles", "each", "receptaclesPractical"),
    receptacle_gfci: I("GFCI receptacles", "each", "receptaclesPractical"),
    receptacle_dedicated: I("Dedicated receptacles / appliance circuits", "each", "dedicated", ["amps"]),
    switch: I("Switches", "each", "switches"),
    dimmer: I("Dimmers", "each", "switches"),
    light_fixture: I("Light fixtures", "each", "lighting", ["fixtureType"]),
    smoke_co: I("Smoke / CO detectors", "each", "smokeCo"),
    fire_alarm_device: I("Fire alarm devices", "each", "fireAlarmDevices"),
    panel: I("Panels", "each", "panels", ["amps"]),
    circuit: I("Circuits (panel schedule)", "each", "circuits"),
    feeder: I("Home runs and feeders", "lnft", "totalFt", ["conduit"]),
    conduit: I("Conduit", "lnft", "conduitFt", ["conduit"]),
    data_drop: I("Data / low-voltage drops", "each", "dataDrops"),
    disconnect: I("Disconnects", "each", "each", ["amps"]),
    ev_charger: I("EV chargers", "each", "each", ["amps"]),
    demo_device: I("Existing devices to remove", "each", "each"),
  }),
  plumbing: Object.freeze({
    water_closet: I("Toilets (water closets)", "each", "plumbingFixtures"),
    urinal: I("Urinals", "each", "plumbingFixtures"),
    lavatory: I("Lavatories (bathroom sinks)", "each", "plumbingFixtures"),
    sink: I("Sinks (kitchen, bar, utility)", "each", "plumbingFixtures"),
    mop_sink: I("Mop / service sinks", "each", "plumbingFixtures"),
    shower: I("Showers", "each", "plumbingFixtures"),
    tub: I("Tubs", "each", "plumbingFixtures"),
    drinking_fountain: I("Drinking fountains", "each", "plumbingFixtures"),
    floor_drain: I("Floor drains", "each", "plumbingFixtures"),
    hose_bib: I("Hose bibs", "each", "plumbingFixtures"),
    water_heater: I("Water heaters", "each", "waterHeaters"),
    supply_pipe: I("Supply pipe", "lnft", "supplyPipeFt", ["pipeSize", "material"]),
    drain_pipe: I("Drain, waste and vent pipe", "lnft", "drainPipeFt", ["pipeSize", "material"]),
    gas_outlet: I("Gas outlets", "each", "gasOutlets"),
    cleanout: I("Cleanouts", "each", "each"),
    riser: I("Risers", "each", "each", ["pipeSize"]),
  }),
  drywall: Object.freeze({
    wall_board: I("Wall board", "sqft", "wallSqft", ["finishLevel", "layers", "boardType", "heightFt"]),
    ceiling_board: I("Ceiling board", "sqft", "ceilingSqft", ["finishLevel", "layers", "boardType"]),
    corner_bead: I("Corner bead and trims", "lnft", "cornerBeadFt"),
    patch: I("Patches", "each", "each"),
    demo: I("Drywall removal", "sqft", "areaSqFt"),
  }),
  framing: Object.freeze({
    wall_framing: I("Wall framing", "lnft", "wallFramingFt", ["heightFt", "studSize", "studSpacingIn", "material", "bearing"]),
    header: I("Headers", "each", "headers", ["spanFt"]),
    sheathing: I("Sheathing", "sqft", "sheathingSqft"),
    blocking: I("Blocking and backing", "lnft", "blockingFt"),
  }),
  roofing: Object.freeze({
    roof_plane: I("Roof (squares)", "sq", "squares", ["pitch", "material", "layers"]),
    low_slope: I("Low-slope membrane", "sqft", "areaSqft", ["material"]),
    ridge: I("Ridge", "lnft", "ridgeFt"),
    hip: I("Hips", "lnft", "hipFt"),
    valley: I("Valleys", "lnft", "valleyFt"),
    eave: I("Eaves", "lnft", "eaveFt"),
    rake: I("Rakes", "lnft", "rakeFt"),
    flashing: I("Step, counter and wall flashing", "lnft", "flashingFt"),
    parapet: I("Parapet", "lnft", "parapetFt"),
    penetration: I("Penetrations (vents, stacks, skylights)", "each", "penetrations"),
    roof_drain: I("Roof drains", "each", "each"),
  }),
  flooring: Object.freeze({
    floor_area: I("Floor area", "sqft", "floorSqft", ["material"]),
    base: I("Base", "lnft", "linearFt", ["material"]),
    transition: I("Transitions", "each", "transitions"),
    stair_tread: I("Stair treads", "each", "treads", ["material"]),
    floor_prep: I("Floor prep and levelling", "sqft", "areaSqFt"),
  }),
});

/** Attribute names an item may carry, and what each holds. The sanitiser
 *  (tradeModel.js) copies only these, by name. */
export const ITEM_ATTRIBUTES = Object.freeze({
  heightFt: "number",
  studSize: "text",
  studSpacingIn: "number",
  material: "text",
  bearing: "boolean",
  spanFt: "number",
  finishLevel: "integer",
  layers: "integer",
  boardType: "text",
  pitch: "number",
  amps: "integer",
  fixtureType: "text",
  conduit: "text",
  pipeSize: "text",
});

export function itemDef(tradeKey, itemKey) {
  const items = Object.hasOwn(TRADE_ITEMS, tradeKey) ? TRADE_ITEMS[tradeKey] : null;
  return items && typeof itemKey === "string" && Object.hasOwn(items, itemKey) ? items[itemKey] : null;
}

export function itemKeysFor(tradeKey) {
  return Object.hasOwn(TRADE_ITEMS, tradeKey) ? Object.keys(TRADE_ITEMS[tradeKey]) : [];
}

/** sqft / sq → area, lnft → length, each → count. */
export function measureOfUnit(unit) {
  if (unit === "sqft" || unit === "sq") return "area";
  if (unit === "lnft") return "length";
  return "count";
}

/**
 * What the model is shown for one trade: item keys, labels, units and the
 * attributes that matter — plus which items the COMPANY prices with a service
 * of its own (`yours`), so the read knows which quantities matter most. Never
 * a rate.
 *
 * @param ownKeys  measurement keys the company's own services in this trade
 *                 are keyed to (lib/planRead/tradePricing.js ownServiceKeys)
 */
export function tradeCatalogueForModel(tradeKey, { ownKeys = [] } = {}) {
  const own = new Set(ownKeys);
  return {
    trade: tradeKey,
    items: itemKeysFor(tradeKey).map((key) => {
      const d = TRADE_ITEMS[tradeKey][key];
      return { key, label: d.label, unit: d.unit, attributes: d.attrs, yours: own.has(d.key) };
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCOPE — the read's trades, from the quote's services
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The stored scope (PlanRead.scope) → the trades a read reads, each with its
 * focus. Pure. A painting scope with both interior and exterior categories
 * reads both; a scope with no mappable category is empty, and an empty scope
 * means "no scope stated" — the read behaves exactly as it did before scopes
 * existed (painting, every sheet), which is what keeps every read made before
 * this file byte-identical.
 *
 * @param scope  { categories: [{ key, label }], from } | null
 * @returns {{ trades: [{ tradeKey, focus: string[], categories: string[] }],
 *             unmapped: string[], stated: boolean }}
 */
export function tradesFromScope(scope) {
  const cats = Array.isArray(scope?.categories) ? scope.categories : [];
  const byTrade = new Map();
  const unmapped = [];
  for (const c of cats) {
    const key = typeof c === "string" ? c : c?.key;
    if (typeof key !== "string" || !key) continue;
    const hit = Object.hasOwn(CATEGORY_TRADES, key) ? CATEGORY_TRADES[key] : null;
    if (!hit) {
      if (!unmapped.includes(key)) unmapped.push(key);
      continue;
    }
    if (!byTrade.has(hit.trade)) byTrade.set(hit.trade, { tradeKey: hit.trade, focus: [], categories: [] });
    const t = byTrade.get(hit.trade);
    if (!t.focus.includes(hit.focus)) t.focus.push(hit.focus);
    if (!t.categories.includes(key)) t.categories.push(key);
  }
  const trades = TRADE_KEYS.filter((k) => byTrade.has(k)).map((k) => byTrade.get(k));
  return { trades, unmapped, stated: trades.length > 0 };
}

/** The painting side(s) a scope reads: null = both (no scope, or both chosen). */
export function paintingFocus(scope) {
  const t = tradesFromScope(scope).trades.find((x) => x.tradeKey === "painting");
  if (!t) return null;
  const sides = t.focus.filter((f) => f === "interior" || f === "exterior");
  return sides.length === 1 ? sides[0] : null;
}

/** Does the scope include painting? (No scope stated = painting, as before.) */
export function scopeHasPainting(scope) {
  const { trades, stated } = tradesFromScope(scope);
  return !stated || trades.some((t) => t.tradeKey === "painting");
}

/** The non-painting trades a scope reads. */
export function scopeMultiTrades(scope) {
  return tradesFromScope(scope).trades.filter((t) => t.tradeKey !== "painting");
}

/**
 * Clean a scope sent by a browser or derived from a quote/lead into what is
 * stored. Only categories the COMPANY has (the caller passes their keys and
 * labels) survive — a key from a request is looked up, never trusted.
 */
export function sanitiseScope(input, { companyCategories = [], from = "estimator" } = {}) {
  const known = new Map();
  for (const c of Array.isArray(companyCategories) ? companyCategories : []) {
    if (c && typeof c.key === "string") known.set(c.key, String(c.label || c.key).slice(0, 80));
  }
  const keys = [];
  for (const k of Array.isArray(input) ? input : []) {
    const key = typeof k === "string" ? k : k?.key;
    if (typeof key === "string" && known.has(key) && !keys.includes(key)) keys.push(key);
    if (keys.length >= 12) break;
  }
  if (!keys.length) return null;
  return {
    categories: keys.map((key) => ({ key, label: known.get(key) })),
    from: ["quote", "lead", "estimator"].includes(from) ? from : "estimator",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET ROUTING — which sheets each trade reads (free, in code)
// ═══════════════════════════════════════════════════════════════════════════
//
// A sheet is sent to the model only when one of the read's trades needs it.
// An electrical sheet is never paid for on a drywall quote; a roof plan never
// on an interior paint job. Decided from what sheetFacts read off the sheet's
// own text — its number's discipline letter and its titles — so a sheet with
// no number and no title (a scan) is always sent: there is nothing to route
// it by, and skipping it would be a guess.

const ROUTE = Object.freeze({
  interiorOnly: /\bEXTERIOR ELEVATIONS?\b|\bROOF PLAN\b|\bSITE PLAN\b|\bSITE\b(?! VISIT)/,
  exteriorOnly: /\bREFLECTED CEILING\b|\bRCP\b|\bINTERIOR ELEVATIONS?\b|\bENLARGED (?:TOILET|RESTROOM|WASHROOM)/,
  roof: /\bROOF\b|\bELEVATIONS?\b|\bBUILDING SECTIONS?\b|\bWALL SECTIONS?\b/,
  electricalTitle: /\bELECTRICAL\b|\bPOWER\b|\bLIGHTING\b|\bPANEL\b|\bREFLECTED CEILING\b|\bRCP\b/,
  plumbingTitle: /\bPLUMBING\b|\bFIXTURE\b|\bRISER\b|\bSANITARY\b|\bDOMESTIC WATER\b|\bENLARGED (?:TOILET|RESTROOM|WASHROOM)/,
  floorPlan: /\bFLOOR PLANS?\b|\bPLAN\b/,
  never: /\bCOVER SHEET\b|\bCODE ANALYSIS\b|\bCODE REVIEW\b|\bSHEET INDEX\b|\bDRAWING INDEX\b|\bLIFE SAFETY\b/,
});

/** The words a sheet carries about itself. */
function sheetTitle(facts) {
  return [facts?.title, ...(Array.isArray(facts?.titles) ? facts.titles : [])].filter(Boolean).join(" · ").toUpperCase();
}

/**
 * Is this page a SPECIFICATION page rather than a drawing? A vector page
 * dense with text, nearly no dimensions, and a CSI section header ("SECTION
 * 09 29 00"). Spec pages are digested in code (specDigest) and never sent as
 * images: a picture of a page of words costs a sheet pass and adds nothing
 * the text does not already say.
 */
export function isSpecPage(facts) {
  if (!facts?.vector) return false;
  const text = String(facts.textSample || "");
  return (facts.dims || []).length <= 3 && text.length > 1200 && /\bSECTION\s+\d{2}\s?\d{2}\s?\d{2}\b/.test(text);
}

/**
 * Does `tradeKey` (with its focus) need this sheet? Pure.
 * @returns {boolean|null} null = cannot tell (no discipline, no title)
 */
export function tradeWantsSheet(facts, tradeKey, focus = []) {
  const disc = facts?.discipline || null;
  const title = sheetTitle(facts);
  if (!disc && !title) return null;
  if (ROUTE.never.test(title)) return false;
  if (disc === "title" || disc === "civil" || disc === "landscape" || disc === "general") return false;
  const archLike = disc === "architectural" || disc === "interior" || disc === null;
  const f = new Set(focus);
  switch (tradeKey) {
    case "painting": {
      if (!archLike) return false;
      const inside = f.has("interior");
      const outside = f.has("exterior");
      if (inside && !outside) return !ROUTE.interiorOnly.test(title);
      if (outside && !inside) return disc !== "interior" && !ROUTE.exteriorOnly.test(title);
      return true;
    }
    case "drywall":
    case "flooring":
      if (!archLike) return false;
      if (tradeKey === "flooring" && /\bREFLECTED CEILING\b|\bRCP\b/.test(title)) return false;
      return !ROUTE.interiorOnly.test(title);
    case "framing":
      if (disc === "structural") return true;
      if (!archLike || disc === "interior") return false;
      return !/\bSITE PLAN\b/.test(title);
    case "roofing":
      if (disc === "structural") return /\bROOF\b/.test(title);
      if (!archLike || disc === "interior") return false;
      return ROUTE.roof.test(title);
    case "electrical":
      if (disc === "electrical") return true;
      return archLike && ROUTE.electricalTitle.test(title);
    case "plumbing":
      if (disc === "plumbing") return true;
      if (disc === "mechanical") return ROUTE.plumbingTitle.test(title);
      return archLike && ROUTE.plumbingTitle.test(title);
    default:
      return false;
  }
}

/** The discipline a trade's own sheets carry, for the "no sheets of its own" fallback. */
const OWN_DISCIPLINE = Object.freeze({ electrical: "electrical", plumbing: "plumbing" });

/**
 * Route every sheet of a read. Pure.
 *
 * @param sheets  the read's active sheets (sheetFacts + key)
 * @param trades  tradesFromScope(scope).trades — EMPTY means no scope stated:
 *                every non-spec sheet is read, as before scopes existed
 * @returns Map<sheetKey, { send: boolean, trades: string[], reason: string }>
 *   reason: "no_scope" | "trade" | "unknown" | "fallback" | "spec" | "not_for_trade"
 */
export function routeSheets(sheets, trades) {
  const list = Array.isArray(sheets) ? sheets : [];
  const out = new Map();
  if (!Array.isArray(trades) || !trades.length) {
    for (const s of list) out.set(s.key, { send: true, trades: [], reason: "no_scope" });
    return out;
  }
  for (const s of list) {
    if (isSpecPage(s)) {
      out.set(s.key, { send: false, trades: [], reason: "spec" });
      continue;
    }
    const wants = [];
    let unknown = false;
    for (const t of trades) {
      const w = tradeWantsSheet(s, t.tradeKey, t.focus);
      if (w === null) unknown = true;
      else if (w) wants.push(t.tradeKey);
    }
    if (unknown) out.set(s.key, { send: true, trades: trades.map((t) => t.tradeKey), reason: "unknown" });
    else if (wants.length) out.set(s.key, { send: true, trades: wants, reason: "trade" });
    else out.set(s.key, { send: false, trades: [], reason: "not_for_trade" });
  }
  // A residential set often has no E- or P-sheets: the outlets and fixtures
  // are on the architect's floor plans. When a trade found no sheet of its
  // own discipline, it reads the floor plans instead — and its counts carry
  // the low confidence a plan symbol deserves (tradeModel.js).
  for (const t of trades) {
    const own = OWN_DISCIPLINE[t.tradeKey];
    if (!own) continue;
    if (list.some((s) => s.discipline === own)) continue;
    for (const s of list) {
      const r = out.get(s.key);
      if (r.reason === "spec") continue;
      if ((s.discipline === "architectural" || s.discipline === null) && ROUTE.floorPlan.test(sheetTitle(s)) && !ROUTE.interiorOnly.test(sheetTitle(s))) {
        if (!r.trades.includes(t.tradeKey)) r.trades.push(t.tradeKey);
        if (!r.send) Object.assign(r, { send: true, reason: "fallback" });
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIFICATIONS — a free digest in code
// ═══════════════════════════════════════════════════════════════════════════

const SPEC_SECTION = /\bSECTION\s+(\d{2})\s?(\d{2})\s?(\d{2})\b\s*[-–—:]?\s*([A-Z][A-Z ,&/-]{3,60})?/;
/** Lines worth carrying: what a spec says that changes a quantity or a price. */
const SPEC_HINT = /\bLEVEL\s*[0-5]\b|\bTYPE\s*X\b|\bTYPE\s*C\b|\bFIRE[- ]RATED?\b|\bGAUGE\b|\b\d{1,2}\s*(?:"|IN\.?)\s*O\.?\s*C\b|\bO\.C\.|\bMIL\b|\bEMT\b|\bRIGID\b|\bMC CABLE\b|\bPEX\b|\bCOPPER\b|\bPVC\b|\bCAST IRON\b|\bSHINGLES?\b|\bMEMBRANE\b|\bTPO\b|\bEPDM\b|\bUNDERLAYMENT\b|\bLVT\b|\bLVP\b|\bCARPET\b|\bTILE\b|\bHARDWOOD\b|\bRESILIENT\b|\bSTUDS?\b|\bSHEATHING\b|\bPLYWOOD\b|\bOSB\b/i;

/**
 * Spec pages → a short digest per CSI section: the section, its title, the
 * page, and the lines that state levels, ratings, materials or spacings.
 * Pure; no model. The synthesis cites a section by `id`.
 */
export function specDigest(sheets, { maxSections = 30, maxLinesPerSection = 8 } = {}) {
  const out = [];
  for (const s of Array.isArray(sheets) ? sheets : []) {
    if (!isSpecPage(s)) continue;
    let current = null;
    for (const raw of String(s.textSample || "").split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      const m = SPEC_SECTION.exec(line.toUpperCase());
      if (m) {
        if (out.length >= maxSections) break;
        current = { id: `${s.key}.sp${out.length + 1}`, section: `${m[1]} ${m[2]} ${m[3]}`, title: (m[4] || "").trim() || null, page: s.page, lines: [] };
        out.push(current);
        continue;
      }
      if (current && current.lines.length < maxLinesPerSection && SPEC_HINT.test(line)) current.lines.push(line.slice(0, 200));
    }
  }
  return out;
}

/** Sanity at import: every item names a registered measurement key. */
export function unregisteredItemKeys() {
  const bad = [];
  for (const [trade, items] of Object.entries(TRADE_ITEMS)) {
    for (const [key, d] of Object.entries(items)) if (!isMeasurementKey(d.key)) bad.push(`${trade}.${key}:${d.key}`);
  }
  return bad;
}
