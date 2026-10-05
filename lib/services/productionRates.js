// lib/services/productionRates.js
//
// A service's PRODUCTION RATE — how much of its measured quantity one crew-hour
// does — and the hours a quote's service groups take because of it.
//
// The owner (2026-09-24): "production rates per service so that it can help
// the calculator". A painter knows he rolls about 250 sq ft of wall an hour; a
// refinisher knows her shop does 12 doors a day; a stair builder knows a tread
// is an hour and a half. Until this file, the only place hours came from was
// the trade's price book (lib/pricing/tradeScope.js tradeLabourHours) or a
// material recipe — and most trades' books state no productivity at all, so
// the cost panel scored those jobs labour-blind and the job plan had no hours.
//
// ── What a rate is ─────────────────────────────────────────────────────────
//
//   Product.production = { key, amount, basis } | null
//
//   key     a measurement key (lib/services/measurementKeys.js) — the unit
//           the rate is in IS that key's unit: wallSqft → sq ft, treads →
//           each, gutterFt → linear ft. Keys whose unit is already `hour`
//           (roof crew-hours, rewire hours) are refused: "hours per hour" is
//           not a rate.
//   amount  a positive number, as the contractor typed it
//   basis   how they typed it — the three ways the trade says it:
//             per_hour        250 sq ft per crew-hour
//             per_day         12 doors per crew-day (CREW_DAY_HOURS = 8)
//             hours_per_unit  1.5 hours per tread
//
// Stored as typed, not normalised, so the box reopens saying what was
// written ("12 / day", not "1.5 / hr"). unitsPerHour() normalises on read.
//
// A crew-hour here is one paid hour of labour — the SAME unit tradeLabourHours
// returns and the cost panel multiplies by the crew's blended rate
// (laborCostPerHour, lib/costing/crew.js) or the fallback. A two-person crew
// on a 250 sq ft/hr rate is two crew-hours an hour; lib/costing/crew.js
// explains why the pool of hours, not the head count, is what costs money.
//
// ── Where the hours come from on a quote ───────────────────────────────────
//
// A scope group's services are the template runs on it — the lines a
// Product's template expanded to (lib/quotes/serviceTemplateLines.js, each
// line's meta.template.{runId, productId}). A plain one-line product add
// carries no product id (lib/quotes/lineDetail.js lineFromProduct, kept byte
// for byte), so it has no rate to apply — matching it back by description
// would be a guess wearing a number.
//
// The quantity a run's rate is applied to, in order:
//   1. the run's own non-material lines keyed to the rate's key, the largest
//      quantity > 0 — what the estimator left on the estimate, including a
//      quantity they typed over the takeoff's figure. Material lines are
//      skipped: their quantity carries waste and coverage (13 sheets is not
//      416 sq ft of work).
//   2. the group's own measured figure for the key (groupMeasurements — the
//      takeoff or intake that group carries).
//   3. nothing — the service is listed, its hours are null, and the screen
//      says "no measurement yet". Zero is absent on a builder form
//      (serviceTemplateLines.js header), so a 0 line never counts as 1.
//
// ── Precedence ─────────────────────────────────────────────────────────────
//
// When at least one rated service on a group resolves a quantity, the group's
// hours ARE the sum of its services' hours, and the trade's own hours for that
// group (the price book's takeoff hours, and a material recipe's labour) are
// not used — the owner: "where hours today come from trade defaults, the
// service's rate takes precedence". Group-wide on purpose: the book's hours
// and the service's describe the same crew on the same scope, and adding them
// would count the job twice; picking them apart line by line is possible only
// for painting, and a rule that holds for one trade is two rules.
//
// A group with no rated service, or none that resolves a quantity, returns
// hours null and everything downstream runs exactly as before — the check
// (scripts/check-production-rates.mjs) pins the md5 of the cost summary, the
// builder's estimate and the job plan to their values before this file.
//
// Pure — no React, no database.

import { MEASUREMENT_KEYS, isMeasurementKey, measurementKeysForTrade } from "@/lib/services/measurementKeys";
import { groupMeasurements } from "@/lib/quotes/serviceTemplateLines";
import { HOURS_PER_DAY } from "@/lib/proposal/sections";
import { LABOUR_PRESETS } from "@/lib/pricing/labourPresets";
import { STRUCTURAL_RECIPES } from "@/app/data/priceBooks/structural";

/** How a rate may be stated. The first is the default. */
export const PRODUCTION_BASES = Object.freeze(["per_hour", "per_day", "hours_per_unit"]);

/** Hours in the crew-day a "per day" rate is divided by — the proposal's day. */
export const CREW_DAY_HOURS = HOURS_PER_DAY;

/** Upper bound on a typed amount — a guard against a runaway box, not a product limit. */
export const MAX_PRODUCTION_AMOUNT = 100000;

const finite = (v) => {
  // Number(true) is 1 — a ticked box is not "one door".
  if (typeof v === "boolean") return null;
  const n = typeof v === "object" && v !== null && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;
const list = (v) => (Array.isArray(v) ? v : []);

/** May a rate be stated in this key's unit? Registered, and not already hours. */
export function productionKeyAllowed(key) {
  return isMeasurementKey(key) && MEASUREMENT_KEYS[key].unit !== "hour";
}

/**
 * What a Product row stores for `production`: { key, amount, basis } or null.
 * An unknown or hour-unit key, a zero, negative, NaN or absurd amount — each
 * is null, never stored as sent. `amount` is rounded to three places, enough
 * for "0.75 h per tread" and "1.333 sheets / hr".
 */
export function sanitiseProduction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const key = typeof input.key === "string" ? input.key : "";
  if (!productionKeyAllowed(key)) return null;
  const amount = finite(input.amount);
  if (amount === null || !(amount > 0) || amount > MAX_PRODUCTION_AMOUNT) return null;
  const basis = PRODUCTION_BASES.includes(input.basis) ? input.basis : PRODUCTION_BASES[0];
  const rounded = Math.round(amount * 1000) / 1000;
  if (!(rounded > 0)) return null;
  return { key, amount: rounded, basis };
}

/** Units of the key one crew-hour does, or null for no usable rate. */
export function unitsPerHour(production) {
  const p = sanitiseProduction(production);
  if (!p) return null;
  if (p.basis === "per_day") return p.amount / CREW_DAY_HOURS;
  if (p.basis === "hours_per_unit") return 1 / p.amount;
  return p.amount;
}

/**
 * Crew-hours for `quantity` units at `production`, to the hundredth — or null
 * when there is no usable rate or no usable quantity. Zero units is zero
 * hours (a measured "no valleys" is a figure); a negative, NaN or missing
 * quantity is null.
 *
 * hours_per_unit multiplies rather than dividing by a reciprocal, so 1.5 h ×
 * 14 treads is exactly 21, not 20.999999.
 */
export function hoursFor(production, quantity) {
  const p = sanitiseProduction(production);
  const q = quantity === null || quantity === undefined || quantity === "" ? null : finite(quantity);
  if (!p || q === null || q < 0) return null;
  const hours = p.basis === "hours_per_unit" ? q * p.amount : p.basis === "per_day" ? (q / p.amount) * CREW_DAY_HOURS : q / p.amount;
  return Number.isFinite(hours) ? round2(hours) : null;
}

/**
 * The key a service's rate is most likely stated in: its template's first
 * labour line with an allowed key, else any line's, else null (the person
 * picks). Only a default for an empty box — never written without a save.
 */
export function defaultProductionKey(product) {
  const lines = list(product?.templateLines).filter((l) => l && typeof l === "object");
  const labour = lines.find((l) => l.kind === "labour" && productionKeyAllowed(l.measurementKey));
  if (labour) return labour.measurementKey;
  const any = lines.find((l) => productionKeyAllowed(l.measurementKey));
  return any ? any.measurementKey : null;
}

/** The keys a rate may be picked from: the trade's own first, hour-unit keys left out. */
export function productionKeysFor(tradeKey) {
  return measurementKeysForTrade(tradeKey).filter(productionKeyAllowed);
}

// ── Suggested rates — shown greyed, "suggested", never applied ─────────────
//
// For the trades that have a takeoff to measure from. A starting point to
// compare against, not a rate: every figure is per ONE crew-hour (one paid
// person-hour, see the header), mid-range for ordinary residential work, and
// the screen shows it as a placeholder with a "Use" button — nothing here is
// written to a Product row unless a person presses Use and then Save.
//
// Sources, as ranges, so the round number chosen inside each is visible:
//   Painting — interior figures are FINISHED rates: every coat the service
//     paints (normally two), the same basis as the painting takeoff
//     (lib/pricing/paintTakeoff.js), because this rate is applied to the
//     measured sq ft once, not once per coat. WAS 250 / 200 / 75, labelled
//     "per coat" here and applied as finished — 2–2.5× the takeoff, so "Use"
//     cut the hours by half and the cost panel overstated margin. Now 110
//     walls / 120 ceilings / 45 trim (owner, 2026-10-05), against Craftsman's
//     National Painting Cost Estimator two-coat roll: smooth walls 167 / 268 /
//     369 bare, 58 / 90 / 136 with the cutting-in at a different-coloured
//     ceiling (2018 p242–243 + 2014 p92–94); ceilings 174 / 197 / 219 (2014
//     p77); baseboard 50 / 60 / 70 lf (2014 p43). Each sits beside the
//     takeoff's recovered 100 / 110 / 40 — a repaint with setup and
//     protection, which NPC excludes. Exterior: siding bodies ~100–200 sq
//     ft/hr with ladder moves, fascia/trim ~30–50 (NPC 2014 p120 fascia,
//     brushed two coats 35 / 45 / 55 lf).
//   Flooring — manufacturers' and NWFA installation guides put a floating
//     click floor at ~400–600 sq ft per installer-day (≈ 50–75/hr).
//   Drywall — FieldQuo's own drywall recipe, hang only: 0.010 labour-hours
//     per sq ft of board is 25 4×8 sheets in an 8-hour labour day (derived
//     below, so the two cannot disagree). Craftsman NHI 2018 p.242 prints
//     hang at .008 walls / .012 ceilings — 31 / 21 sheets — around it. WAS
//     12 sheets a day, read from "RSMeans 10–16 per hanger-day" as if it were
//     a crew-day: 2.6x the book and half FieldQuo's own recipe.
//   Stairs — the owner's own example: 1.5 h per tread (fit, glue, nail,
//     finish nosing); RSMeans stair-tread installs run ~1–2 h each.
//   Cabinets — the owner's own example: 12 doors per day for a refinishing
//     shop (strip, sand, prime, two coats, cure); refacing is in the same band.
//   Gutters — seamless K-style: a two-person crew hangs ~200–300 linear ft a
//     day, ≈ 15 ft per crew-hour.
//   Fencing — wood privacy fence including posts: a two-person crew builds
//     ~60–100 ft a day, ≈ 5 ft per crew-hour.
//   Concrete — Craftsman NCE 2019 p.615, a 4-inch driveway apron including
//     forms, mesh and finishing, P9@.024 labour-hours per sq ft (~42 sq ft an
//     hour). WAS 25 an hour (.040) — 1.67x the book.
//
// Calibrated 2026-10-05 against the Craftsman estimating guides (owner:
// "fill the gaps and fix the mismatches using their numbers as reference"),
// and filled for the trades the drawing read prices — electrical, plumbing,
// carpentry — plus HVAC, fencing gates, masonry and cabinet installs. Where
// the figure is a labour PRESET (lib/pricing/labourPresets.js) it is READ
// from there, so a service's suggestion and the read's hours are one number;
// the rest carry their citation here. Electrical and plumbing suggestions are
// a HOUSE's (Craftsman NRI's device with its wiring run; NPH's residential
// set plus rough-in) — a commercial shop types its own. Painting followed
// on 2026-10-05, once the owner decided its corrections (above).
//
// Keyed by trade (ServiceCategory.key) and measurement key, because one key
// means different work in different trades: wallSqft rolled by a painter is
// not wallSqft of siding hung.

/** A preset's default value (lib/pricing/labourPresets.js) — the one copy. */
const presetHours = (group, key) => {
  const p = (LABOUR_PRESETS[group] || []).find((x) => x.key === key);
  if (!p) throw new Error(`productionRates: no labour preset ${group}.${key}`);
  return p.value;
};

/**
 * Labour-hours per unit → the way the trade says it: under 0.1 h a unit reads
 * as units per hour (26.7 ft of conduit an hour, not 0.038 h a foot — and the
 * sanitiser's three decimals would round the small figure); above it, hours
 * per unit (4.1 h a toilet).
 */
const perUnit = (hours) =>
  hours < 0.1 ? { amount: Math.round((1 / hours) * 1000) / 1000, basis: "per_hour" } : { amount: Math.round(hours * 1000) / 1000, basis: "hours_per_unit" };

// The house's five common fixtures, set plus rough-in, averaged — a service
// keyed to "plumbing fixtures" counts all of them as one.
const FIXTURE_AVERAGE = [
  ["wcSet", "wcRough"],
  ["lavSet", "lavRough"],
  ["sinkSet", "sinkRough"],
  ["tubSet", "tubRough"],
  ["showerSet", "showerRough"],
].reduce((n, [a, b]) => n + presetHours("plumbing", a) + presetHours("plumbing", b), 0) / 5;

export const SUGGESTED_PRODUCTION = Object.freeze({
  interior_painting: { wallSqft: { amount: 110, basis: "per_hour" }, ceilingSqft: { amount: 120, basis: "per_hour" }, linearFt: { amount: 45, basis: "per_hour" } },
  exterior_painting: { wallSqft: { amount: 150, basis: "per_hour" }, linearFt: { amount: 40, basis: "per_hour" } },
  // `flooring` is hardwood REFINISHING: sand three passes, seal, two coats.
  // Craftsman NCE 2018 p.155, sand .023 + stain/seal .010 + 2 coats urethane .012 → 0.045 mh/sf
  // WAS 50 sq ft an hour — the click-install figure below, on the wrong trade.
  flooring: { floorSqft: perUnit(presetHours("flooring", "sandAndFinishPerSqft")) },
  flooring_install: { floorSqft: { amount: 50, basis: "per_hour" }, areaSqFt: { amount: 50, basis: "per_hour" } },
  // 8 h ÷ (32 sq ft × the recipe's hang rate) — 25 sheets a labour-day.
  drywall_install: { drywallSheets: { amount: Math.round(CREW_DAY_HOURS / (32 * presetHours("drywall", "hangPerSqft"))), basis: "per_day" } },
  stairs: { treads: { amount: 1.5, basis: "hours_per_unit" } },
  cabinet_refinishing: { doorCount: { amount: 12, basis: "per_day" } },
  cabinet_refacing: { doorCount: { amount: 12, basis: "per_day" } },
  gutter_services: { gutterFt: { amount: 15, basis: "per_hour" } },
  fence_services: {
    edgingFt: { amount: 5, basis: "per_hour" },
    perimeterLf: { amount: 5, basis: "per_hour" },
    // Craftsman NCE 2018 p.147, "build and hang wood fence gate, total" BL@1.51 → 1.51 mh/ea
    // (a chain-link walk gate is .50–.67, p.143). Driveway gates: no row.
    gateCount: { amount: 1.51, basis: "hours_per_unit" },
  },
  // Craftsman NCE 2019 p.615, "driveway apron 4", forms, mesh and finishing" P9@.024 → 0.024 mh/sf
  concrete: { areaSqft: perUnit(0.024), areaSqFt: perUnit(0.024) },
  // Brick veneer, running bond — the staged masonry recipe's figure
  // (Craftsman NRI 2019 p.240, 4M@.144), read from there.
  masonry: { areaSqFt: { amount: STRUCTURAL_RECIPES.masonry.labourBrickHoursPerSqft.value, basis: "hours_per_unit" } },
  electrical: {
    receptaclesPractical: perUnit(presetHours("electrical", "resReceptacle")),
    switches: perUnit(presetHours("electrical", "resSwitch")),
    lighting: perUnit(presetHours("electrical", "resLightFixture")),
    smokeCo: perUnit(presetHours("electrical", "resSmokeCo")),
    dedicated: perUnit(presetHours("electrical", "resDedicated")),
    circuits: perUnit(presetHours("electrical", "resCircuit")),
    panels: perUnit(presetHours("electrical", "panelSwap")),
    dataDrops: perUnit(presetHours("electrical", "resDataDrop")),
    fireAlarmDevices: perUnit(presetHours("electrical", "fireAlarmSmoke")),
    // EMT concealed, 3/4 in — the house and light-commercial default run.
    conduitFt: perUnit(presetHours("electrical", "conduit_emtConcealed_0_75") / 100),
  },
  plumbing: {
    plumbingFixtures: perUnit(FIXTURE_AVERAGE),
    // A new 40-gallon gas tank: set, connection and 10 ft of B-vent.
    waterHeaters: perUnit(presetHours("plumbing", "heaterGasSet") + presetHours("plumbing", "heaterConnection") + presetHours("plumbing", "heaterVentFt") * presetHours("plumbing", "heaterVentPerLf")),
    supplyPipeFt: perUnit(presetHours("plumbing", "pipe_copper_0_5")),
    drainPipeFt: perUnit(presetHours("plumbing", "pipe_plastic_2")),
    gasOutlets: perUnit(presetHours("plumbing", "gasOutletEach")),
  },
  carpentry: {
    wallFramingFt: perUnit(presetHours("framing", "labourPartitionHoursPerLf")),
    headers: perUnit(presetHours("framing", "labourHeaderHoursPerOpening")),
    sheathingSqft: perUnit(presetHours("framing", "labourSheathingHoursPerSqft")),
    blockingFt: perUnit(presetHours("framing", "labourBlockingHoursPerLf")),
  },
  hvac_install: {
    // Craftsman NRR 2025 p.31, "supply registers 10x6 to 14x6" UA .333–.444 → midpoint 0.389 mh/ea
    ventCount: perUnit(0.389),
    // Craftsman NRR 2025 p.31, "return air grilles" .40–.50 → midpoint 0.45 mh/ea
    returnCount: perUnit(0.45),
    // Craftsman NRR 2025 p.29, condensing unit, crew SB, 2 t 10.7 / 3 t 16.0 / 4 t 21.3 → 5.33 mh per ton (1 t 8.0 and 5 t 32.0 sit off the line)
    condenserTons: perUnit(5.33),
    // Craftsman NRR 2025 p.31, galvanized rectangular duct incl. fittings and supports, under 400 lb, UF .120 → 0.120 mh/lb
    ductLb: perUnit(0.12),
    // Craftsman NRR 2025 p.32, insulated flex duct 6" UD .091 → 0.091 mh/LF
    flexDuctFt: perUnit(0.091),
    // Craftsman NPH 2018 p.289, "commission and test" 4.00 + "air balance" 4.00 → 8.0 mh per system
    hvacSystems: perUnit(8),
    // NOT adopted: NRR 2025 p.28 prints an air handler at 21.3–26.7 h (2–5 t),
    // which reads high for a residential swap. Left for the owner to review.
  },
  kitchen_design: {
    // Craftsman NCE 2020 p.29, "base cabinets, 34-1/2" high" BC@.521 → 0.521 mh/LF
    baseCabinetFt: perUnit(0.521),
    // Craftsman NCE 2020 p.29, "wall cabinets, 30" high" BC@.340 → 0.340 mh/LF
    wallCabinetFt: perUnit(0.34),
  },
});

/**
 * The suggestion for a trade and key, as a production value ({ key, amount,
 * basis }) or null. `tradeKeys` may be one key or several (a service linked to
 * more than one quote type); the first with a suggestion wins.
 */
export function suggestedProduction(tradeKeys, key) {
  if (!productionKeyAllowed(key)) return null;
  for (const trade of Array.isArray(tradeKeys) ? tradeKeys : [tradeKeys]) {
    const byKey = typeof trade === "string" && Object.hasOwn(SUGGESTED_PRODUCTION, trade) ? SUGGESTED_PRODUCTION[trade] : null;
    const hit = byKey && Object.hasOwn(byKey, key) ? byKey[key] : null;
    if (hit) return sanitiseProduction({ key, ...hit });
  }
  return null;
}

/** The trade a seeded row came from ("fq.<trade>.<category>.<slug>"), or null. */
export function tradeOfSeedKey(seedKey) {
  const m = typeof seedKey === "string" ? /^fq\.([a-z0-9_]+)\./.exec(seedKey) : null;
  return m ? m[1] : null;
}

// ── The services on a quote group ──────────────────────────────────────────

/** Product id → sanitised production, from rows carrying `production`. Rows without one are left out. */
export function productionMapFrom(products) {
  const out = new Map();
  for (const p of list(products)) {
    if (!p || typeof p !== "object" || !p.id) continue;
    const prod = sanitiseProduction(p.production);
    if (prod) out.set(String(p.id), { production: prod, name: String(p.name || "") });
  }
  return out;
}

/** Every product id a template run on these groups names — what a server has to look up. */
export function productIdsInGroups(groups) {
  const ids = new Set();
  for (const g of list(groups)) {
    for (const item of list(g?.lineItems)) {
      const id = item?.meta?.template?.productId;
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * The template runs on one group, in the order they first appear:
 * [{ runId, productId, service, lines: [{ index, item, template }] }] — the
 * heading line is kept apart as `headingIndex`.
 */
export function templateRunsOf(group) {
  const runs = new Map();
  list(group?.lineItems).forEach((item, index) => {
    const m = item?.meta?.template;
    if (!m || typeof m !== "object" || typeof m.runId !== "string") return;
    if (!runs.has(m.runId)) {
      runs.set(m.runId, { runId: m.runId, productId: typeof m.productId === "string" ? m.productId : null, service: String(m.service || ""), headingIndex: null, lines: [] });
    }
    const run = runs.get(m.runId);
    if (m.heading) run.headingIndex = run.headingIndex ?? index;
    else run.lines.push({ index, item, template: m });
  });
  return [...runs.values()];
}

/**
 * The quantity a run's rate applies to, and where it came from — see the
 * header. Returns { quantity, source: "line"|"measured"|null, index }.
 * `index` is the line the quantity came from (null for a group figure).
 */
export function runQuantity(run, key, measured) {
  let best = null;
  for (const l of list(run?.lines)) {
    if (l.template.measurementKey !== key || l.template.lineKind === "material") continue;
    const q = finite(l.item?.quantity);
    if (q === null || !(q > 0)) continue;
    if (!best || q > best.quantity) best = { quantity: q, source: "line", index: l.index };
  }
  if (best) return best;
  const m = measured && Object.hasOwn(measured, key) ? measured[key] : null;
  const v = m ? finite(m.value) : null;
  if (v !== null && v >= 0) return { quantity: v, source: "measured", index: null };
  return { quantity: null, source: null, index: null };
}

/** The line a run's hours are pinned to on the job plan: the quantity's own line, else its first labour line, else its first line, else its heading. */
function anchorIndexOf(run, quantityIndex) {
  if (quantityIndex !== null && quantityIndex !== undefined) return quantityIndex;
  const labour = list(run.lines).find((l) => l.template.lineKind === "labour");
  if (labour) return labour.index;
  if (run.lines.length) return run.lines[0].index;
  return run.headingIndex;
}

/**
 * The services on a group and the hours their rates give it.
 *
 * @param group         a scope group: lineItems, and — for the measured
 *                      fallback — categoryKey, takeoff, intakeValues (as the
 *                      builder holds it; a stored group passes category.key)
 * @param productionById productionMapFrom(...) — Map id → { production, name }
 * @returns {
 *   services: [{ runId, productId, name, production|null, quantity, quantitySource,
 *                unit, hours|null, anchorIndex }],
 *   hours: number|null   — the sum over services whose hours resolved, or
 *                          null when none did (the trade's own hours stand)
 *   rated: boolean       — at least one service carries a rate
 * }
 */
export function groupProduction(group, productionById) {
  const map = productionById instanceof Map ? productionById : new Map();
  const runs = templateRunsOf(group);
  const out = { services: [], hours: null, rated: false };
  if (!runs.length) return out;
  let measured = null;
  const measuredFor = () => {
    if (measured) return measured;
    const categoryKey = group?.categoryKey || group?.category?.key || null;
    try {
      measured = groupMeasurements({ ...group, categoryKey });
    } catch {
      measured = {};
    }
    return measured;
  };
  let sum = null;
  for (const run of runs) {
    const entry = run.productId ? map.get(run.productId) : null;
    const production = entry ? entry.production : null;
    const name = entry?.name || run.service;
    if (!production) {
      out.services.push({ runId: run.runId, productId: run.productId, name, production: null, quantity: null, quantitySource: null, unit: null, hours: null, anchorIndex: anchorIndexOf(run, null) });
      continue;
    }
    out.rated = true;
    const q = runQuantity(run, production.key, measuredFor());
    const hours = hoursFor(production, q.quantity);
    if (hours !== null) sum = round2((sum ?? 0) + hours);
    out.services.push({
      runId: run.runId,
      productId: run.productId,
      name,
      production,
      quantity: q.quantity,
      quantitySource: q.source,
      unit: MEASUREMENT_KEYS[production.key].unit,
      hours,
      anchorIndex: anchorIndexOf(run, q.index),
    });
  }
  out.hours = sum;
  return out;
}

/** Just the hours: a number when the group's service rates answer, else null (the trade's own hours stand). */
export function groupProductionHours(group, productionById) {
  return groupProduction(group, productionById).hours;
}
