// lib/services/presetLibrary.js
//
// The preset library behind /app/analytics/benchmark: every seeded trade's
// services and standard add-ons, each with a Min / Median / Max range and
// the company's own price beside it.
//
// ── Where the ranges come from, and how they are derived ───────────────────
//
// The seeds (app/data/serviceSeeds/*) carry national quartiles in USD from
// an industry benchmark: `low` is the 25th percentile, `median` the 50th,
// `high` the 75th. The library labels them Min / Median / Max because that
// is what a contractor reads them as, but the DATA keeps quartile semantics
// — a "Min" is the lower quartile, never the cheapest quote anyone wrote.
//
// The numbers shown are FieldQuo's own, never the source's verbatim:
//
//   1. converted into the company's currency by lib/pricing/benchmarkFx.js
//      (the one fixed, dated USD→CAD rate; a currency it cannot convert into
//      gets no range at all, never a USD figure wearing the wrong sign);
//   2. then rounded to a step chosen by the MEDIAN's magnitude, so the three
//      figures of one row share a grain:
//         median <  $50   → nearest $5
//         median <  $500  → nearest $10
//         median <  $2000 → nearest $25
//         otherwise       → nearest $50
//      A quartile is coarse; $1,090 printed as "$1,090" reads as a fact
//      nobody measured, "$1,100" reads as the guideline it is.
//
// The owner's intent for this page: "keep that as the preset library based
// on all the pricing forms they have for all products from all trades, and
// as we have new companies that should be slowly updating." The seam for
// that is `source`: a range whose source is not "benchmark" (the FieldQuo
// median across companies that share, k-anonymous — lib/pricing/benchmark.js)
// arrives already in the company's currency and passes through benchmarkIn
// unconverted; the rounding here still applies. The "Like me" segment on the
// page is disabled until that source exists — a control that appears to
// work and does not is the failure this codebase is swept for.
//
// Add-ons (app/data/standardAddOns.js) carry one preset price each, no
// quartiles: the library shows it as the median with no Min / Max, rather
// than padding a range out of a point (AGENTS.md failure class 5).
//
// Pure — no database, no React — so a check can run it against fixtures.

import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { STANDARD_ADDONS } from "@/app/data/standardAddOns";
import { benchmarkIn } from "@/lib/pricing/benchmarkFx";
import { categoryLabel } from "@/lib/trades/catalog";

/** The rounding step for a row whose median is `median`, in the company's currency. */
export function presetStep(median) {
  const n = Number(median);
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n < 50) return 5;
  if (n < 500) return 10;
  if (n < 2000) return 25;
  return 50;
}

/** Round one figure to the row's step; null stays null, a non-positive figure becomes null. */
export function roundToStep(value, step) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = Math.round(n / step) * step;
  return r > 0 ? r : step;
}

/**
 * A seed's benchmark as the library shows it: { min, median, max, currency,
 * source, step } in the company's currency, rounded; null when the seed has
 * no range or the currency cannot be converted into.
 */
export function presetRange(benchmark, currency) {
  const r = benchmarkIn(benchmark, currency);
  if (!r) return null;
  const step = presetStep(r.median);
  return {
    min: roundToStep(r.low, step),
    median: roundToStep(r.median, step),
    max: roundToStep(r.high, step),
    currency: r.currency,
    source: r.source,
    step,
  };
}

/** Every seeded trade, the company's enabled ones first (in the order given), then the rest alphabetically by label. */
export function libraryTrades(enabledKeys = []) {
  const seeded = Object.keys(SERVICE_SEEDS);
  const enabled = (Array.isArray(enabledKeys) ? enabledKeys : []).filter((k) => seeded.includes(k));
  const rest = seeded.filter((k) => !enabled.includes(k)).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  return [...enabled, ...rest].map((key) => ({ key, label: categoryLabel(key), enabled: enabled.includes(key) }));
}

/**
 * One trade's library: its seeded services with ranges and the company's
 * matching Product (by seed key), and its standard add-ons with their preset
 * and the company's matching Product (by name — the add-on seeder's own
 * join, lib/products/seedStandardAddOns.js).
 *
 * @param products  the company's Product rows (GET /api/products), or [] when
 *                  the caller may not see them
 */
export function libraryForTrade(trade, { products = [], currency = "CAD", language = "en" } = {}) {
  // hasOwn, not a truthy lookup: "constructor" is a key on every object.
  const seed = Object.hasOwn(SERVICE_SEEDS, trade) ? SERVICE_SEEDS[trade] : null;
  if (!seed) return null;
  const byKey = new Map();
  const byName = new Map();
  for (const p of Array.isArray(products) ? products : []) {
    if (p?.seedKey) byKey.set(p.seedKey, p);
    if (p?.name) byName.set(String(p.name).trim().toLowerCase(), p);
  }
  const services = (seed.services || []).map((s) => {
    const product = byKey.get(s.seedKey) || null;
    return {
      seedKey: s.seedKey,
      name: s.name?.[language] || s.name?.en || s.seedKey,
      unit: s.unit || null,
      pricedBy: s.pricedBy || null,
      templateCategory: s.templateCategory || null,
      hasTemplate: Array.isArray(s.templateLines) && s.templateLines.length > 0,
      range: presetRange(s.benchmark, currency),
      product: product
        ? { id: product.id, unitPrice: product.unitPrice == null ? null : Number(product.unitPrice), unit: product.unit || null, name: product.name }
        : null,
    };
  });
  const addOns = (Object.hasOwn(STANDARD_ADDONS, trade) && Array.isArray(STANDARD_ADDONS[trade]) ? STANDARD_ADDONS[trade] : []).map((a) => {
    const product = byName.get(String(a.name).trim().toLowerCase()) || null;
    return {
      name: a.name,
      unit: a.unit || null,
      preset: Number.isFinite(Number(a.unitPrice)) && Number(a.unitPrice) > 0 ? Number(a.unitPrice) : null,
      product: product
        ? { id: product.id, unitPrice: product.unitPrice == null ? null : Number(product.unitPrice), unit: product.unit || null, name: product.name }
        : null,
    };
  });
  return {
    trade,
    label: categoryLabel(trade),
    currency: String(currency || "").toUpperCase(),
    services,
    addOns,
    withRange: services.filter((s) => s.range).length,
  };
}

/**
 * Where a company's price sits against a range: "below" (under Min), "in"
 * (Min..Max), "above" (over Max), or null when either side is missing. The
 * page colours the cell from this and nothing else, so the rule is testable.
 */
export function positionInRange(price, range) {
  const p = Number(price);
  if (!range || !Number.isFinite(p) || p <= 0) return null;
  const lo = range.min ?? range.median;
  const hi = range.max ?? range.median;
  if (lo == null || hi == null) return null;
  if (p < lo) return "below";
  if (p > hi) return "above";
  return "in";
}
