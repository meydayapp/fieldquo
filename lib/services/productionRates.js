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
//   Painting — PDCA (Painting Contractors Association) estimating guidance and
//     Craftsman's "National Painting Cost Estimator" production tables: rolling
//     smooth interior walls ~200–300 sq ft per hour per coat, ceilings a little
//     slower, brushed baseboard/trim ~60–100 linear ft per hour; exterior
//     siding bodies ~100–200 sq ft/hr with ladder moves, fascia/trim ~30–50.
//   Flooring — manufacturers' and NWFA installation guides put a floating
//     click floor at ~400–600 sq ft per installer-day (≈ 50–75/hr).
//   Drywall — RSMeans (Gordian) board-hanging crews: ~10–16 4×8 sheets per
//     hanger-day, hang only (taping is its own service).
//   Stairs — the owner's own example: 1.5 h per tread (fit, glue, nail,
//     finish nosing); RSMeans stair-tread installs run ~1–2 h each.
//   Cabinets — the owner's own example: 12 doors per day for a refinishing
//     shop (strip, sand, prime, two coats, cure); refacing is in the same band.
//   Gutters — seamless K-style: a two-person crew hangs ~200–300 linear ft a
//     day, ≈ 15 ft per crew-hour.
//   Fencing — wood privacy fence including posts: a two-person crew builds
//     ~60–100 ft a day, ≈ 5 ft per crew-hour.
//   Concrete — flatwork (form, place, finish) on RSMeans' slab-on-grade
//     crews works out to ~20–30 sq ft per labour-hour.
//
// Keyed by trade (ServiceCategory.key) and measurement key, because one key
// means different work in different trades: wallSqft rolled by a painter is
// not wallSqft of siding hung.

export const SUGGESTED_PRODUCTION = Object.freeze({
  interior_painting: { wallSqft: { amount: 250, basis: "per_hour" }, ceilingSqft: { amount: 200, basis: "per_hour" }, linearFt: { amount: 75, basis: "per_hour" } },
  exterior_painting: { wallSqft: { amount: 150, basis: "per_hour" }, linearFt: { amount: 40, basis: "per_hour" } },
  flooring: { floorSqft: { amount: 50, basis: "per_hour" } },
  flooring_install: { floorSqft: { amount: 50, basis: "per_hour" }, areaSqFt: { amount: 50, basis: "per_hour" } },
  drywall_install: { drywallSheets: { amount: 12, basis: "per_day" } },
  stairs: { treads: { amount: 1.5, basis: "hours_per_unit" } },
  cabinet_refinishing: { doorCount: { amount: 12, basis: "per_day" } },
  cabinet_refacing: { doorCount: { amount: 12, basis: "per_day" } },
  gutter_services: { gutterFt: { amount: 15, basis: "per_hour" } },
  fence_services: { edgingFt: { amount: 5, basis: "per_hour" }, perimeterLf: { amount: 5, basis: "per_hour" } },
  concrete: { areaSqft: { amount: 25, basis: "per_hour" }, areaSqFt: { amount: 25, basis: "per_hour" } },
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
