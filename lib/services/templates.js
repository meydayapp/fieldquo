// lib/services/templates.js
//
// The template INSIDE a service: the labour, material and other lines a
// service expands to on an estimate, the discount it opens with, and the
// figures a roofing line takes from the satellite measurement.
//
// ── Why a service holds lines ──────────────────────────────────────────────
//
// A contractor's "Panel upgrade — 200 A" is not one price. It is two labour
// lines (remove the old panel, fit the new one), a materials line (the panel
// itself, taxed differently from the labour) and a new-customer discount, and
// the same three lines every time the service is sold. Product.unitPrice
// stays the company's headline price; `templateLines` is what the estimate
// opens with, and every line is repriceable on the estimate without touching
// the template.
//
// ── Two boundaries, one file ───────────────────────────────────────────────
//
//   sanitiseTemplateLines / sanitiseDefaultDiscount — the boundary between
//     what a browser (or a seed) sent and what a Product row stores. A line
//     with no name is dropped; a negative cost, a NaN qty, a kind the closed
//     list does not know, a measurement key the satellite report does not
//     produce — each is normalised or dropped, never stored as sent.
//   expandTemplate — the boundary between a stored template and the lines an
//     estimate gets: measurements resolved, a seed's USD converted into the
//     company's currency, translations picked for the document's language.
//
// Pure — no database, no React — so scripts/check-service-templates.mjs can
// execute every rule here against hostile input.
//
// ── Money ──────────────────────────────────────────────────────────────────
//
// The browser sends unit prices and unit costs here, because this is the
// CONTRACTOR editing its own price book in Settings — the same as typing a
// rate into Products & Services. Non-negotiable #5 ("the browser never sends
// money amounts") is about CLIENT-facing surfaces; nothing in this file is
// reachable from one, and the check asserts no client route imports it.

import { roundSuggested } from "@/lib/pricing/benchmarkFx";
import { MEASUREMENT_KEY_LIST, isMeasurementKey, measurementValue } from "@/lib/services/measurementKeys";
import { PAINT_ESTIMATE_TYPES } from "@/lib/pricing/paintTakeoff";

// ── Where a template is offered — the access rule ──────────────────────────
//
// The owner (2026-09-24): templates attach by QUOTE TYPE, not by trade.
//
//   1. Every company that offers a trade gets ALL of that trade's templates
//      installed (the seeder writes them as Product rows, exactly as it writes
//      the trade's services). Nothing is held back per company.
//   2. `Product.categories` (the quote types a service can be added to — the
//      link the price book has always used) is the primary link: a template
//      is offered on a quote whose type is one of them.
//   3. `Product.estimateTypes` narrows it for a quote type with sub-types —
//      painting's PAINT_ESTIMATE_TYPES (interior · exterior · cabinets ·
//      staining · commercial). EMPTY means every estimate type of the quote
//      type; a list means only those.
//   4. `Product.templateEnabled` lets a company switch a seeded template off
//      without deleting it. Off = not offered; the row and its lines stay.
//
// `templatesFor` below is that rule as one pure function; the quote builder
// (a later pass) calls it and wires the picker — it decides nothing itself.
//
// Stairs is NOT an estimate type: `stairs` is its own quote type
// (ServiceCategory key, lib/trades/catalog.js) priced by its price-book tier
// grid inside a scope group; lib/estimate/stairsFromSteps.js derives a
// staircase's counts for that scope, it is not a key here. A stairs template
// carries `categories: ["stairs"]` and an empty `estimateTypes`.

// ── Which takeoff fills which measurement key ─────────────────────────────
//
// A template line names a key from lib/services/measurementKeys.js; the
// builder (a later pass) passes the takeoff's output as `measurements` to
// expandTemplate. The calculator produces the quantity, the line supplies
// the price and the cost:
//
//   paintTakeoff.js#derivedGeometry     wallSqft, ceilingSqft, floorSqft, linearFt
//   roofMeasurement.js#summariseRoof    squares, areaSqft, footprintSqft
//   roofGeometry.js#roofLinears         eaveFt, rakeFt, ridgeFt, hipFt, valleyFt, perimeterFt
//   roofLabour.js#roofLabour            hours, onRoofHours, fixedHours
//   gutterMeasurement.js                gutterFt, downspouts
//   paverTakeoff.js#baseMaterials       gravelCuYd, sandCuYd
//   lotTakeoff.js (lotArea.js)          lotSize, edgingFt
//   rewireTakeoff.js                    openings, receptaclesPractical, switches, lighting,
//                                       smokeCo, dedicated, counterReceptacles,
//                                       exteriorReceptacles, garageReceptacles, circuits,
//                                       totalFt, roughInHours, trimOutHours, panelHours,
//                                       totalHours
//   tracedArea.js#measureTracedArea     areaSqft
//   stairsFromSteps.js                  steps, treads, risers, balusters, posts, handrailFt
//   cabinet intake                      doorCount, drawerCount, boxLinearFt
//   cleaning intake (cleaning/pricing)  bedrooms, bathrooms, squareFootage; halfBaths typed
//   typed on the quote (no takeoff)     areaSqFt, perimeterLf, each
//
// Trades that reuse another trade's takeoff (measurementKeys.js
// TRADE_MEASUREMENTS): flooring floorSqft + linearFt (the room perimeter),
// tile floorSqft / wallSqft, drywall wallSqft + ceilingSqft, siding wallSqft
// of an exterior wall run, fencing edgingFt (the traced outline length),
// concrete areaSqft (traced). A line whose unit is not the figure's unit
// carries `coverage: { per, unit }` — how much of the figure one unit covers:
// { per: 32, unit: "sqft" } per drywall sheet, { per: 8, unit: "linft" } per
// fence post, { per: 81, unit: "sqft" } per cubic yard of 4-in concrete — so
// qty = ceil(figure × (1 + wastePct/100) ÷ per). Material lines only: you
// buy whole sheets, you do not bill labour by the sheet.
//
// The registry header lists the output names deliberately NOT registered.

/** The estimate-type keys a template may name — painting's, by their exact keys. */
export const ESTIMATE_TYPE_KEYS = Object.keys(PAINT_ESTIMATE_TYPES);

/** What a Product row stores for `estimateTypes`: known keys only, deduplicated, in the registry's order. */
export function sanitiseEstimateTypes(input) {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.filter((k) => typeof k === "string" && Object.hasOwn(PAINT_ESTIMATE_TYPES, k)));
  return ESTIMATE_TYPE_KEYS.filter((k) => set.has(k));
}

/**
 * The templates a quote may offer — the access rule above as one function.
 *
 * @param products     the company's Product rows (with `categories` as the
 *                     API returns them: [{ id, key?, label }]) — every row,
 *                     templated or not
 * @param categoryKey  the quote's type (ServiceCategory.key); `categoryId`
 *                     may be given instead or as well, for rows whose linked
 *                     categories carry ids but no keys
 * @param estimateType the quote's estimate type for a quote type with
 *                     sub-types, or null
 * @returns the enabled, templated rows offered on that quote, in name order.
 *          Hostile input (no products, no key) → [].
 */
export function templatesFor({ products, categoryKey = null, categoryId = null, estimateType = null } = {}) {
  if (!Array.isArray(products) || (!categoryKey && !categoryId)) return [];
  const type = typeof estimateType === "string" && estimateType ? estimateType : null;
  return products
    .filter((p) => {
      if (!p || typeof p !== "object") return false;
      if (p.templateEnabled === false) return false;
      if (!Array.isArray(p.templateLines) || p.templateLines.length === 0) return false;
      const cats = Array.isArray(p.categories) ? p.categories : [];
      const linked = cats.some((c) => (categoryKey && c?.key === categoryKey) || (categoryId && c?.id === categoryId));
      if (!linked) return false;
      const types = Array.isArray(p.estimateTypes) ? p.estimateTypes.filter((t) => typeof t === "string") : [];
      if (types.length === 0) return true;
      return type ? types.includes(type) : false;
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

/** The three kinds a line can be, matching the columns the estimate prints. */
export const LINE_KINDS = ["labour", "material", "other"];

/**
 * The measurement keys a line may name — the closed registry in
 * lib/services/measurementKeys.js (every trade's takeoff figures, by the
 * names the takeoffs already produce). Re-exported so the older import
 * path keeps working; `measurementValue` likewise.
 */
export const MEASUREMENT_KEYS = MEASUREMENT_KEY_LIST;
export { measurementValue };

/** The units a coverage may be stated in. */
export const COVERAGE_UNITS = ["sqft", "linft", "cuft", "each"];

/**
 * A line's coverage, normalised: { per, unit } or undefined. A bare number
 * (the first shape, 2026-09-24) is read as { per: n, unit: "each" }. `per`
 * is kept even when it is zero or negative — expandTemplate ignores such a
 * coverage and flags the line needsReview, which it cannot do for a value
 * the sanitiser silently dropped.
 */
function coverageOf(input) {
  if (input == null || input === "") return undefined;
  const raw = typeof input === "object" ? input : { per: input, unit: "each" };
  const per = Number(raw.per);
  if (!Number.isFinite(per)) return undefined;
  const unit = COVERAGE_UNITS.includes(raw.unit) ? raw.unit : "each";
  return { per: Math.round(per * 1000) / 1000, unit };
}

/** Discount kinds, spelled the way the estimate's own discount is. */
export const DISCOUNT_KINDS = ["fixed", "percent"];

/** Most lines a template may hold — a guard against a runaway client, not a product limit. */
export const MAX_TEMPLATE_LINES = 60;
export const MAX_WASTE_PCT = 50;

const MAX_NAME = 200;
const MAX_DESCRIPTION = 2000;
const MAX_UNIT = 24;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "object" && typeof v?.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const qtyOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
};

/**
 * Per-language { name, description } for a line, in the shape
 * Product.translations documents. Only two-letter language keys with a
 * string name survive; anything else is dropped rather than stored.
 */
function sanitiseTranslations(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out = {};
  for (const [lang, entry] of Object.entries(input)) {
    if (!/^[a-z]{2}$/.test(lang) || !entry || typeof entry !== "object") continue;
    const name = str(entry.name, MAX_NAME);
    if (!name) continue;
    const description = str(entry.description, MAX_DESCRIPTION);
    out[lang] = description ? { name, description } : { name };
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * One line, or null when it cannot be a line (no name, or not an object).
 * Exported for the check; callers use sanitiseTemplateLines.
 */
export function sanitiseTemplateLine(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const name = str(input.name, MAX_NAME);
  if (!name) return null;
  const kind = LINE_KINDS.includes(input.kind) ? input.kind : "other";
  const line = {
    kind,
    name,
    description: str(input.description, MAX_DESCRIPTION),
    // A line with no qty is one unit — the estimate's own default. Zero is
    // kept as zero: a contractor who typed 0 meant "priced elsewhere".
    qty: qtyOf(input.qty) ?? 1,
    unit: str(input.unit, MAX_UNIT) || (kind === "labour" ? "flat" : "each"),
    unitPrice: money(input.unitPrice),
    unitCost: money(input.unitCost),
    // Labour is taxable in every province and state the product bills in;
    // the capture the shape was copied from marks materials per line. An
    // absent flag is "taxable", never "tax-free".
    taxable: typeof input.taxable === "boolean" ? input.taxable : true,
  };
  if (isMeasurementKey(input.measurementKey)) {
    line.measurementKey = input.measurementKey;
    // How much of the figure one unit of the line covers (Roofr's
    // "coverage") — material lines only.
    const cov = kind === "material" ? coverageOf(input.coverage) : undefined;
    if (cov) line.coverage = cov;
    // Waste is a MATERIAL modifier: an extra 10 % of shingles is real, an
    // extra 10 % of labour hours is not. Stored on material lines only.
    const waste = Number(input.wastePct);
    if (kind === "material" && Number.isFinite(waste) && waste > 0) line.wastePct = Math.min(MAX_WASTE_PCT, Math.round(waste * 10) / 10);
  }
  const translations = sanitiseTranslations(input.translations);
  if (translations) line.translations = translations;
  return line;
}

/**
 * Seed-validation: the problems a template's lines carry that the sanitiser
 * would silently normalise — an unknown measurement key above all, since a
 * seed naming one the takeoff does not produce is a line that never fills.
 * Returns [] for a clean template; the check scripts (ours and the seeds')
 * fail on anything else. The sanitiser stays lenient at request time so a
 * company's saved template is never refused for a key that was retired.
 */
export function validateTemplateLines(input) {
  const problems = [];
  if (!Array.isArray(input)) return input == null ? [] : ["templateLines is not an array"];
  input.forEach((l, i) => {
    if (!l || typeof l !== "object") return problems.push(`[${i}] not an object`);
    if (!LINE_KINDS.includes(l.kind)) problems.push(`[${i}] kind "${l.kind}" is not labour|material|other`);
    if (l.measurementKey !== undefined && !isMeasurementKey(l.measurementKey)) problems.push(`[${i}] measurementKey "${l.measurementKey}" is not in lib/services/measurementKeys.js`);
    if (l.wastePct !== undefined && l.kind !== "material") problems.push(`[${i}] wastePct on a ${l.kind} line — waste is a material modifier`);
    if (l.wastePct !== undefined && !(Number(l.wastePct) >= 0 && Number(l.wastePct) <= MAX_WASTE_PCT)) problems.push(`[${i}] wastePct ${l.wastePct} outside 0–${MAX_WASTE_PCT}`);
    if (l.coverage !== undefined) {
      const c = coverageOf(l.coverage);
      if (!c || !(c.per > 0)) problems.push(`[${i}] coverage.per must be a positive number`);
      if (typeof l.coverage === "object" && l.coverage && !COVERAGE_UNITS.includes(l.coverage.unit)) problems.push(`[${i}] coverage.unit "${l.coverage.unit}" is not ${COVERAGE_UNITS.join("|")}`);
      if (l.measurementKey === undefined) problems.push(`[${i}] coverage without a measurementKey`);
      if (l.kind !== "material") problems.push(`[${i}] coverage on a ${l.kind} line — coverage is a material modifier`);
    }
  });
  return problems;
}

/**
 * What a Product row stores for `templateLines`: an array of clean lines, or
 * null when nothing usable was sent (so an emptied template clears the
 * column rather than storing `[]` beside `null` as two spellings of "none").
 */
export function sanitiseTemplateLines(input) {
  if (!Array.isArray(input)) return null;
  const lines = input.slice(0, MAX_TEMPLATE_LINES).map(sanitiseTemplateLine).filter(Boolean);
  return lines.length ? lines : null;
}

/**
 * What a Product row stores for `defaultDiscount`: { name, kind, amount } or
 * null. A percent over 100 is clamped — a 300 % discount is a typo, not a
 * refund — and a non-positive amount is no discount at all.
 */
export function sanitiseDefaultDiscount(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const kind = DISCOUNT_KINDS.includes(input.kind) ? input.kind : "fixed";
  let amount = money(input.amount);
  if (amount == null || amount <= 0) return null;
  if (kind === "percent") amount = Math.min(100, amount);
  const name = str(input.name, 120) || "Discount";
  return { name, kind, amount };
}

/** A photo URL the catalogue card may show: https only, or null. */
export function sanitiseImageUrl(input) {
  const s = str(input, 2048);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The text a line shows in `language`, in the shape resolveProductText
 * (lib/i18n/translateContent.js) returns for a product — re-stated here so
 * this file stays free of the AI provider that module imports.
 */
export function lineText(line, language, defaultLanguage = "en") {
  const source = { name: line?.name || "", description: line?.description || "" };
  if (!language || language === defaultLanguage) return { ...source, missing: false };
  const entry = line?.translations?.[language];
  if (!entry?.name) return { ...source, missing: true };
  return {
    name: entry.name,
    description: entry.description || source.description,
    missing: !entry.description && Boolean(source.description),
  };
}

/**
 * The lines an estimate opens with for a service.
 *
 * @param product       a Product row (or a seed service) carrying templateLines
 * @param measurements  a takeoff's figures keyed by lib/services/
 *                      measurementKeys.js names (summariseRoof's shape, with
 *                      linear feet under `linear`, is read too), or null — a
 *                      line naming a measurementKey takes its qty from here
 *                      (a material line × 1 + wastePct/100) and, when the
 *                      figure is missing or not a number, keeps its seed qty
 *                      and is flagged `needsMeasurement` so the screen can
 *                      ask; the qty stays editable either way
 * @param currency      the currency the lines should come out in
 * @param fromCurrency  the currency the template's prices are in (a seed's
 *                      are USD; a company's own row has none → `currency`)
 * @param fx            multiplier fromCurrency → currency when they differ;
 *                      a converted rate is rounded by roundSuggested so it
 *                      cannot read as exact. Missing or invalid when needed →
 *                      the rate is null and the line says so, never the
 *                      foreign number wearing the wrong sign
 * @param language      the DOCUMENT's language for the line text
 * @returns lines[] — [{ kind, description, detail, quantity, unit, rate,
 *          amount, cost, taxable, measurementKey, measured, needsMeasurement,
 *          wastePct, missing, warnings[] }], one per template line, in
 *          template order.
 *          `[]` for a product with no template.
 */
export function expandTemplate(product, { measurements = null, currency = null, fromCurrency = null, fx = null, language = null, defaultLanguage = "en" } = {}) {
  const lines = sanitiseTemplateLines(product?.templateLines);
  if (!lines) return [];

  const to = String(currency || "").toUpperCase();
  const from = String(fromCurrency || to).toUpperCase();
  const needsFx = Boolean(to) && from !== to;
  const rate = Number(fx);
  const fxOk = Number.isFinite(rate) && rate > 0;
  const convert = (v) => {
    if (v == null) return null;
    if (!needsFx) return v;
    if (!fxOk) return null;
    return roundSuggested(v * rate);
  };

  return lines.map((line) => {
    const warnings = [];
    let quantity = line.qty;
    let measured = false;
    let needsMeasurement = false;
    let needsReview = false;
    if (line.measurementKey) {
      const m = measurementValue(measurements, line.measurementKey);
      if (m == null) {
        needsMeasurement = true;
        warnings.push(`measurement:${line.measurementKey}`);
      } else {
        measured = true;
        const waste = line.kind === "material" ? line.wastePct || 0 : 0;
        const withWaste = m * (1 + waste / 100);
        if (line.coverage && line.coverage.per > 0) {
          // Whole units: 12.1 sheets is 13 sheets bought. The epsilon keeps
          // 12.000000001 from floating up to 13.
          quantity = Math.ceil(withWaste / line.coverage.per - 1e-9);
        } else {
          if (line.coverage) {
            needsReview = true;
            warnings.push("coverage");
          }
          quantity = Math.round(withWaste * 100) / 100;
        }
      }
    }
    const unitRate = convert(line.unitPrice);
    const unitCost = convert(line.unitCost);
    if (needsFx && !fxOk && (line.unitPrice != null || line.unitCost != null)) warnings.push("fx");
    const text = lineText(line, language, defaultLanguage);
    if (text.missing) warnings.push(`translation:${language}`);
    const amount = unitRate == null ? null : Math.round(unitRate * quantity * 100) / 100;
    return {
      kind: line.kind,
      description: text.name,
      detail: text.description || "",
      quantity,
      unit: line.unit,
      rate: unitRate,
      amount,
      cost: unitCost == null ? null : Math.round(unitCost * quantity * 100) / 100,
      taxable: line.taxable,
      measurementKey: line.measurementKey || null,
      measured,
      needsMeasurement,
      needsReview,
      coverage: line.coverage || null,
      wastePct: line.kind === "material" ? line.wastePct || 0 : 0,
      currency: to || from || null,
      missing: text.missing,
      warnings,
    };
  });
}

/**
 * Subtotal, cost, the discount the template applies to that subtotal, and
 * the total — the numbers Settings > Services prints under a template. A
 * line with a null rate contributes nothing and is counted in `unpriced`, so
 * the total is never quietly short by a line the reader cannot see.
 */
export function templateTotals(lines, discount = null) {
  const list = Array.isArray(lines) ? lines : [];
  let subtotal = 0;
  let cost = 0;
  let unpriced = 0;
  for (const l of list) {
    if (l?.amount == null) unpriced += 1;
    else subtotal += l.amount;
    if (l?.cost != null) cost += l.cost;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  cost = Math.round(cost * 100) / 100;
  const d = sanitiseDefaultDiscount(discount);
  let discountAmount = 0;
  if (d) {
    discountAmount = d.kind === "percent" ? (subtotal * d.amount) / 100 : Math.min(d.amount, subtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;
  }
  return {
    subtotal,
    cost,
    discount: d,
    discountAmount,
    total: Math.round((subtotal - discountAmount) * 100) / 100,
    margin: subtotal > 0 ? Math.round(((subtotal - discountAmount - cost) / subtotal) * 1000) / 10 : null,
    unpriced,
  };
}

/** Group expanded (or stored) lines by kind, in the order the estimate prints them. */
export function groupLinesByKind(lines) {
  const groups = { labour: [], material: [], other: [] };
  for (const l of Array.isArray(lines) ? lines : []) {
    const k = LINE_KINDS.includes(l?.kind) ? l.kind : "other";
    groups[k].push(l);
  }
  return groups;
}
