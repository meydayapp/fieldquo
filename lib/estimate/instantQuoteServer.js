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
import { visibilityFor, lockedEstimateMessage, gatedMessage } from "@/lib/estimate/visibility";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { canBookVisit } from "@/lib/booking/canBookVisit";
import {
  computeInstantEstimate,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { priceOptionsFor, sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { primaryCategoryForInstantTrade } from "@/lib/trades/catalog";
import { JUNK_ITEMS, JOB_TYPES } from "@/lib/junk/pricing";

// Public trade names. Exported so the settings screen and the public error
// message read from one list — three copies is how "Cabinet Refacing" becomes
// "cabinet_refacing" on the one surface nobody re-reads.
export const TRADE_LABELS = {
  roofing: "Roofing",
  epoxy: "Epoxy & Concrete Coatings",
  parging: "Parging",
  lawn_mowing: "Lawn Mowing",
  cabinet_refinishing: "Cabinet Refinishing",
  cabinet_refacing: "Cabinet Refacing",
  countertop: "Countertops",
  flooring: "Flooring",
  painting: "Painting",
  stair: "Stairs & Railings",
  junk_removal: "Junk Removal",
};

// Which ServiceCategory an instant draft files under comes from the trade
// catalogue (lib/trades/catalog.js), not from a map here.
//
// There WAS a map here, and it had drifted: `stair` named a category key
// "stair" that no seed has ever created, and `painting` named one that does not
// exist at all, so both quietly filed their drafts with no scope group —
// `findUnique({ key })` returning null reads identically to "this trade has no
// category", which is a real case. One declaration, in the file the seeder
// itself reads, is the only version of this that cannot drift again.

/** The homeowner-facing name of a trade, or the raw key if it's unlabelled. */
export function tradeLabel(trade) {
  return TRADE_LABELS[trade] || trade;
}

const SOURCE_BY_MEASURE = {
  roof_address: "google_solar",
  lawn_polygon: "lawn_polygon",
  manual_area: "manual",
  manual_units: "manual",
  stair_count: "manual",
  item_picker: "manual",
};

/**
 * Public list of a company's enabled instant-quote trades. Material LABELS
 * only — never the rates. A homeowner needs to pick "Standing seam metal", not
 * to read the company's $/square (non-negotiable #4).
 */
export async function loadCompanyInstantTrades(companySlug) {
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true, name: true, slug: true, logoUrl: true, brandColor: true,
      defaultLanguage: true,
      // The budget bands are labelled in the company's own currency — a
      // Michigan contractor asking "Under CA$3,500" is a form that looks like
      // it belongs to someone else.
      currency: true,
      // Enough to answer "can they book a home visit?" — the result screen
      // offers one, and an offer onto an empty calendar is a dead control.
      bookingModes: true,
      bookingSlug: true,
      eventTypes: { where: { active: true }, select: { id: true } },
    },
  });
  if (!company) return null;

  const configs = await db.instantQuoteConfig.findMany({
    where: { companyId: company.id, enabled: true },
  });

  const trades = configs
    .map((row) => {
      const spec = INSTANT_ESTIMATE_TRADES[row.trade];
      if (!spec) return null;
      // Through the sanitiser like every other read of a saved config: this is
      // the first public call in the flow, so a malformed row must cost the
      // homeowner a material choice, not the whole page.
      const materials = spec.hasMaterials
        ? (sanitiseInstantConfig(row.config)?.materials || []).map((m) => ({ key: m.key, label: m.label }))
        : [];
      // The estimate panel is on screen from first paint — locked, empty or
      // live, depending on the trade. So WHICH of those it is has to arrive
      // with the page rather than after a measurement, or the panel spends the
      // first few seconds of every visit being the wrong one.
      //
      // This is a mode name, not a price: "we reveal after you submit" tells a
      // competitor nothing they couldn't learn by filling in the form.
      const estimateDisplay = visibilityFor(sanitiseInstantConfig(row.config));
      const lang = company.defaultLanguage || "en";

      return {
        trade: row.trade,
        estimateDisplay,
        ...(estimateDisplay === "after_submit" && { lockedMessage: lockedEstimateMessage(lang) }),
        ...(estimateDisplay === "gated" && { gatedMessage: gatedMessage(lang, "prompt") }),
        // Labels and index only. The { min, max } behind each band stays on the
        // server: the form posts which band was tapped, never what it was worth
        // (non-negotiable #5), so there is nothing here worth forging.
        budgetBands: budgetBands(row.config?.budgetThresholds, {
          currency: company.currency,
          language: lang,
        }).map((b) => ({ index: b.index, label: b.label })),
        label: tradeLabel(row.trade),
        measure: spec.measure,
        hasMaterials: spec.hasMaterials,
        materials,
        // The item-picker flow needs the taxonomy to render — item labels and
        // job types only, NEVER volumes or rates (those stay server-side; the
        // browser sends keys + quantities and the server reprices, per #5).
        ...(spec.measure === "item_picker" && {
          items: JUNK_ITEMS.map((i) => ({ key: i.key, label: i.label, notAccepted: !!i.notAccepted })),
          jobTypes: Object.values(JOB_TYPES).map((j) => ({ key: j.key, label: j.label })),
        }),
      };
    })
    .filter(Boolean);

  return {
    company,
    trades,
    // Handed to the page rather than re-derived there: the same fact decides
    // whether the result screen offers a visit and whether the estimate email
    // carries a booking button, and those two must never disagree.
    booking: canBookVisit(company)
      ? { canBookVisit: true, slug: company.bookingSlug || company.slug }
      : { canBookVisit: false },
  };
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
        // Carry the surcharge selections the estimator reads (epoxy/parging/
        // flooring/painting) — each trade reads only the keys it defined.
        surfaceCondition: input?.intake?.surfaceCondition,
        access: input?.intake?.access,
        condition: input?.intake?.condition,
        scope: input?.intake?.scope,
        // Countertop extras — additive, optional, ignored by the other area
        // trades. Kept here so all manual_area trades share one measure branch.
        edgeFt: Number(input?.intake?.edgeFt) || 0,
        cutouts: Number(input?.intake?.cutouts) || 0,
        backsplashSqft: Number(input?.intake?.backsplashSqft) || 0,
      },
    };
  }

  if (spec.measure === "stair_count") {
    const treads = Number(input?.intake?.treads);
    if (!(treads > 0)) return { ok: false, reason: "no_treads" };
    return {
      ok: true,
      measurement: {
        treads: Math.floor(treads),
        railingFt: Math.max(0, Number(input?.intake?.railingFt) || 0),
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
        // Refacing veneers the exposed box sides by the foot; refinishing has
        // no rate for them and its estimator ignores this.
        boxLinearFt: Number(input?.intake?.boxLinearFt) || 0,
        // Refinishing-only, and ignored by refacing — the same arrangement the
        // countertop extras have on manual_area above, for the same reason:
        // two trades share a measurement branch and each reads the keys it
        // defined. Absent stays absent; nothing here substitutes a default.
        ...(input?.intake?.complexityLevel
          ? { complexityLevel: input.intake.complexityLevel }
          : {}),
        ...(input?.intake?.woodSpecies ? { woodSpecies: input.intake.woodSpecies } : {}),
        // Upgrade KEYS the customer asked for. Strings only: this arrives from
        // a browser on the public path, and the estimator turns them into the
        // booleans cabinetAddOnLines reads — an unrecognised key sets a flag
        // nothing reads rather than pricing anything.
        ...(Array.isArray(input?.intake?.addOns)
          ? {
              addOns: input.intake.addOns
                .filter((k) => typeof k === "string" && k)
                .slice(0, 12),
            }
          : {}),
      },
    };
  }

  if (spec.measure === "item_picker") {
    // The browser sends item KEYS + quantities, a job type, and access flags —
    // never a price. Everything here is a plain intake selection; priceJunk
    // reprices from the company's rates in the estimate step.
    const items = Array.isArray(input?.intake?.items)
      ? input.intake.items
          .map((it) => ({ key: it?.key, quantity: Math.max(0, Math.floor(Number(it?.quantity) || 0)) }))
          .filter((it) => it.key && it.quantity > 0)
      : [];
    if (!items.length) return { ok: false, reason: "no_items" };
    return {
      ok: true,
      measurement: {
        items,
        jobType: input?.intake?.jobType || "single_items",
        stairsFlights: Math.max(0, Number(input?.intake?.stairsFlights) || 0),
        disassembly: !!input?.intake?.disassembly,
        demolition: !!input?.intake?.demolition,
        longCarry: !!input?.intake?.longCarry,
        noElevator: !!input?.intake?.noElevator,
        outOfArea: !!input?.intake?.outOfArea,
        heavyLoads: Math.max(0, Number(input?.intake?.heavyLoads) || 0),
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

  // Whether the homeowner is shown these figures at all is the owner's per-trade
  // choice — surfaced here so the route can gate the response in one place. The
  // prices are still COMPUTED either way (the draft quote needs them); this only
  // travels with them so the route knows what may cross to the browser.
  const visibility = visibilityFor(config);

  // The option-building itself is pure and lives in instantQuoteReadiness, so
  // the settings screen can dry-run this exact code and tell the owner the
  // truth about what a homeowner will get. Before that, this function had its
  // own copy of the rules and disagreed with the one the settings screen used —
  // an enabled, fully-priced Cabinet Refacing answered "not taking instant
  // quotes right now", because this copy iterated a materials array that trade
  // has never had.
  const priced = priceOptionsFor({ trade, config, measurement });
  if (!priced.ok) return { ok: false, reason: priced.reason };
  return { ok: true, visibility, options: priced.options };
}

/**
 * Price ONE chosen material — the authoritative figure used when creating the
 * draft. Returns the full estimate (with breakdown) plus the source + category.
 */
export async function priceOneMaterial({ companyId, trade, materialKey, measurement }) {
  // Same normalising boundary the /measure route crosses: the saved config is
  // browser-authored JSON, and a malformed material row would otherwise throw
  // inside the estimator and 500 a public POST.
  const config = sanitiseInstantConfig(await loadEnabledConfig(companyId, trade));
  if (!config) return { ok: false, reason: "not_configured" };

  const est = computeInstantEstimate({ trade, measurements: measurement, materialKey, config });
  if (!est.ok) return { ok: false, reason: est.reason || "no_estimate" };

  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const categoryKey = primaryCategoryForInstantTrade(trade);
  const category = categoryKey
    ? await db.serviceCategory.findUnique({ where: { key: categoryKey }, select: { id: true } })
    : null;

  return {
    ok: true,
    estimate: est,
    source: SOURCE_BY_MEASURE[spec.measure] || "manual",
    categoryId: category?.id || null,
    // So the confirmation email can honour the same gate the on-screen result
    // did — a gated trade shows no figure in the email either.
    visibility: visibilityFor(config),
    // The owner's saved thresholds, so the request route can turn the index the
    // browser posted into a real { min, max } from ITS OWN rows rather than
    // trusting a figure that arrived over the wire.
    budgetThresholds: config.budgetThresholds,
  };
}
