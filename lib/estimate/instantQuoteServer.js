// lib/estimate/instantQuoteServer.js
//
// Server-side glue for the public instant estimator: what trades a company
// offers, how each one is measured, and the price — always recomputed here,
// never trusted from the browser (non-negotiable #5). The browser sends an
// address, a drawn polygon, or a few intake numbers plus a material KEY; every
// dollar comes from this module reading the company's saved config.

import { db } from "@/lib/db";
import { measureRoof } from "@/lib/measure/roofMeasurement";
import { sphericalPolygonAreaSqft } from "@/lib/measure/lotArea";
import {
  computeInstantEstimate,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";

const TRADE_LABELS = {
  roofing: "Roofing",
  epoxy: "Epoxy & Concrete Coatings",
  parging: "Parging",
  lawn_mowing: "Lawn Mowing",
  cabinet_refacing: "Cabinet Refacing",
};

// estimator trade → ServiceCategory key, so the draft files under a real
// catalogue entry the rest of the app understands.
const TRADE_CATEGORY_KEY = {
  roofing: "roofing_service",
  epoxy: "epoxy",
  parging: "parging",
  lawn_mowing: "lawn_mowing",
  cabinet_refacing: "cabinet_refacing",
};

const SOURCE_BY_MEASURE = {
  roof_address: "google_solar",
  lawn_polygon: "lawn_polygon",
  manual_area: "manual",
  manual_units: "manual",
};

/**
 * Public list of a company's enabled instant-quote trades. Material LABELS
 * only — never the rates. A homeowner needs to pick "Standing seam metal", not
 * to read the company's $/square (non-negotiable #4).
 */
export async function loadCompanyInstantTrades(companySlug) {
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, defaultLanguage: true },
  });
  if (!company) return null;

  const configs = await db.instantQuoteConfig.findMany({
    where: { companyId: company.id, enabled: true },
  });

  const trades = configs
    .map((row) => {
      const spec = INSTANT_ESTIMATE_TRADES[row.trade];
      if (!spec) return null;
      const materials = spec.hasMaterials
        ? (row.config?.materials || []).map((m) => ({ key: m.key, label: m.label }))
        : [];
      return {
        trade: row.trade,
        label: TRADE_LABELS[row.trade] || row.trade,
        measure: spec.measure,
        hasMaterials: spec.hasMaterials,
        materials,
      };
    })
    .filter(Boolean);

  return { company, trades };
}

// Load a single enabled trade's saved config, or null.
async function loadEnabledConfig(companyId, trade) {
  const row = await db.instantQuoteConfig.findUnique({
    where: { companyId_trade: { companyId, trade } },
  });
  if (!row || !row.enabled) return null;
  return { ...(row.config || {}), enabled: true };
}

/**
 * Measure the property for a trade from whatever the browser supplied. Returns
 * { ok, measurement } or { ok:false, reason }. Pure of pricing — pricing is a
 * separate step so the same measurement can price every material at once.
 */
export async function measureForTrade(trade, input = {}) {
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) return { ok: false, reason: "unknown_trade" };

  if (spec.measure === "roof_address") {
    const roof = await measureRoof(input.address);
    if (!roof.ok) return { ok: false, reason: roof.reason, partial: roof };
    // Tear-off layers come from the homeowner, not the satellite.
    const tearOffLayers = Math.max(0, Math.floor(Number(input?.intake?.tearOffLayers) || 0));
    return { ok: true, measurement: { ...roof, tearOffLayers } };
  }

  if (spec.measure === "lawn_polygon") {
    const areaSqft = sphericalPolygonAreaSqft(input.polygon);
    if (!(areaSqft > 0)) return { ok: false, reason: "no_polygon" };
    return { ok: true, measurement: { areaSqft, polygon: input.polygon } };
  }

  if (spec.measure === "manual_area") {
    const areaSqft = Number(input?.intake?.squareFootage);
    if (!(areaSqft > 0)) return { ok: false, reason: "no_area" };
    return {
      ok: true,
      measurement: {
        areaSqft,
        // Carry the surcharge selections the estimator reads.
        surfaceCondition: input?.intake?.surfaceCondition,
        access: input?.intake?.access,
        condition: input?.intake?.condition,
      },
    };
  }

  if (spec.measure === "manual_units") {
    const doorCount = Number(input?.intake?.doorCount) || 0;
    const drawerCount = Number(input?.intake?.drawerCount) || 0;
    if (doorCount + drawerCount <= 0) return { ok: false, reason: "no_units" };
    return {
      ok: true,
      measurement: {
        doorCount,
        drawerCount,
        boxLinearFt: Number(input?.intake?.boxLinearFt) || 0,
      },
    };
  }

  return { ok: false, reason: "unsupported" };
}

/**
 * Price EVERY enabled material for a measurement — the "GAF from $X, metal from
 * $Y" list the homeowner picks from. Ranges only, no rate card echoed back.
 */
export async function priceAllMaterials({ companyId, trade, measurement }) {
  const config = await loadEnabledConfig(companyId, trade);
  if (!config) return { ok: false, reason: "not_configured" };
  const spec = INSTANT_ESTIMATE_TRADES[trade];

  if (!spec.hasMaterials) {
    const est = computeInstantEstimate({ trade, measurements: measurement, config });
    if (!est.ok) return { ok: false, reason: est.reason || "no_estimate" };
    return { ok: true, options: [{ materialKey: null, label: null, low: est.low, high: est.high, point: est.point, unit: est.unit || null }] };
  }

  const materials = config.materials || [];
  const options = [];
  for (const m of materials) {
    const est = computeInstantEstimate({ trade, measurements: measurement, materialKey: m.key, config });
    if (est.ok) {
      options.push({ materialKey: m.key, label: m.label, low: est.low, high: est.high, point: est.point });
    }
  }
  if (!options.length) return { ok: false, reason: "no_priceable_materials" };
  return { ok: true, options };
}

/**
 * Price ONE chosen material — the authoritative figure used when creating the
 * draft. Returns the full estimate (with breakdown) plus the source + category.
 */
export async function priceOneMaterial({ companyId, trade, materialKey, measurement }) {
  const config = await loadEnabledConfig(companyId, trade);
  if (!config) return { ok: false, reason: "not_configured" };

  const est = computeInstantEstimate({ trade, measurements: measurement, materialKey, config });
  if (!est.ok) return { ok: false, reason: est.reason || "no_estimate" };

  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const categoryKey = TRADE_CATEGORY_KEY[trade];
  const category = categoryKey
    ? await db.serviceCategory.findUnique({ where: { key: categoryKey }, select: { id: true } })
    : null;

  return {
    ok: true,
    estimate: est,
    source: SOURCE_BY_MEASURE[spec.measure] || "manual",
    categoryId: category?.id || null,
  };
}
