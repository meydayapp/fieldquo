// lib/estimate/instantQuoteServer.js
//
// Server-side glue for the public instant estimator: what trades a company
// offers, how each one is measured, and the price — always recomputed here,
// never trusted from the browser (non-negotiable #5). The browser sends an
// address, a drawn polygon, or a few intake numbers plus a material KEY; every
// dollar comes from this module reading the company's saved config.

import { db } from "@/lib/db";
import { stairShape } from "@/lib/estimate/stairsFromSteps";
import { measureRoof } from "@/lib/measure/roofMeasurement";
import { measureGutters } from "@/lib/measure/gutterMeasurement";
import { measureTracedArea, isPolygonMeasure } from "@/lib/estimate/tracedArea";
import { estimateLawn } from "@/lib/measure/lawnEstimate";
import { normaliseLawnCareConfig, lawnText, LAWN_MIN_SQFT_DEFAULT } from "@/lib/estimate/lawnCare";
import { visibilityFor, lockedEstimateMessage, gatedMessage } from "@/lib/estimate/visibility";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { canBookVisit } from "@/lib/booking/canBookVisit";
import {
  computeInstantEstimate,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { priceOptionsFor, sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { primaryCategoryForInstantTrade, instantTradeOffered } from "@/lib/trades/catalog";
import { companyEnabledCategoryRows } from "@/lib/trades/companyCategories";
import {
  applyOfferedScope,
  paintingScopesOffered,
  applyDerivedSeed,
  deriveInstantSeed,
  seedInputsFor,
  DERIVED_SEED_TRADES,
} from "@/lib/estimate/instantSeed";
import { JUNK_ITEMS, JOB_TYPES } from "@/lib/junk/pricing";
import { instantTradeLabel, junkItemLabel, junkJobTypeLabel, instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";

// ── Which painting scopes this company sells ────────────────────────────────
//
// Interior and exterior painting are two services behind one estimator. The
// public form used to ask every homeowner "interior or exterior?" and price
// whichever they picked — for a company that sells only one of them, that was
// a question with a wrong answer on it, and an exterior-only painter was
// quoting interiors at their base rate minus the surcharge that IS their
// exterior price. So the scope is settled HERE, from the services the company
// has switched on, before anything is priced: one scope sold means the
// measurement is fixed to it whatever the browser sent, none sold means
// painting is not offered at all. Read fresh per request rather than stored
// on the instant row, because a company switching Exterior Painting off under
// Services should stop being asked about exteriors that same minute.
async function offeredPaintingScopes(companyId) {
  return paintingScopesOffered((await companyEnabledCategoryRows(companyId)).map((r) => r.key));
}

// ── The price comes from the company's price book, not from a copy of it ────
//
// The instant row used to be SEEDED from Settings › Services & Pricing and then
// price off its own saved copy for ever: edit the per-door rate under Services
// to $175 and the homeowner kept being quoted the $150 that was copied across
// the day the row was created. The settings screen grew a drift notice and an
// "adopt" button to paper over that, which made keeping two numbers in step a
// chore the contractor had to remember to do.
//
// The owner's instruction settles it — "keep only the information that is NOT
// in a quote ... because the pricing is already there" — so for every trade the
// price book can state, the book is read LIVE on each estimate and applied over
// the saved row. What the book cannot state (the range width, the floor, the
// budget bands, the visibility mode, extra grades the company typed in) is on
// the row and survives untouched: applyDerivedSeed only writes the paths
// seedFields declares.
//
// A derivable trade whose book states nothing returns null — "we cannot price
// this yet", which the flow says out loud — rather than falling back to the
// stale copy. Non-derivable trades are unchanged: their rates have no home in
// the price book, so the saved row is still the only statement of them.
export function effectiveInstantConfig(trade, savedConfig, enabledRows) {
  const keys = (enabledRows || []).map((r) => r?.key);
  if (!instantTradeOffered(trade, keys)) return null;
  if (!DERIVED_SEED_TRADES.includes(trade)) return savedConfig;
  const derived = deriveInstantSeed(trade, seedInputsFor(trade, enabledRows || []));
  if (!derived) return null;
  return applyDerivedSeed(trade, savedConfig, derived);
}

/** The measurement with painting's scope settled against the company's services. */
async function withOfferedScope(companyId, trade, measurement) {
  if (trade !== "painting") return { ok: true, measurement };
  return applyOfferedScope(trade, measurement, await offeredPaintingScopes(companyId));
}

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
  paving: "Paving",
  stair: "Stairs & Railings",
  junk_removal: "Junk Removal",
  gutters: "Gutters & Eavestroughs",
  lawn_care: "Lawn Care Programs",
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
  gutter_address: "google_solar",
  lawn_polygon: "lawn_polygon",
  // The generic trace (paving). Its own source word rather than "traced",
  // which is lawn care's and is labelled "Lawn traced on map" on the review
  // screen — a driveway outline must not be filed under that sentence.
  area_polygon: "area_polygon",
  // Overridden per measurement below: the lawn measurer says which of
  // parcel / traced / minimum produced the figure, and THAT is the source
  // the draft records.
  lawn_address: "lawn_estimate",
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
export async function loadCompanyInstantTrades(companySlug, { language: requested = null } = {}) {
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true, name: true, slug: true, logoUrl: true, brandColor: true,
      defaultLanguage: true,
      // For the "Call us" half of the this-doesn't-look-right control under
      // every measured figure. A phone number is on the company's own
      // website already; it is not a rate.
      phone: true,
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

  const [configs, enabledRows] = await Promise.all([
    db.instantQuoteConfig.findMany({
      where: { companyId: company.id, enabled: true },
    }),
    // What the company SELLS, with their rates. The gate below and the live
    // price both read it, so one query serves both and the list a homeowner
    // sees cannot disagree with the list the pricer will honour.
    companyEnabledCategoryRows(company.id),
  ]);

  // Only looked up when painting is on: the answer decides whether the form
  // asks "interior or exterior?" (both sold), fixes it silently (one sold), or
  // drops painting from the page (neither). Scope NAMES are not prices — a
  // competitor learns nothing from "this company paints exteriors" that the
  // company's own website doesn't say.
  const paintingScopes = configs.some((r) => r.trade === "painting")
    ? paintingScopesOffered(enabledRows.map((r) => r.key))
    : [];

  const trades = configs
    .map((row) => {
      const spec = INSTANT_ESTIMATE_TRADES[row.trade];
      if (!spec) return null;
      if (row.trade === "painting" && paintingScopes.length === 0) return null;
      // ── A trade the company doesn't sell is never offered ────────────────
      //
      // Painting has been gated this way since the interior/exterior fix; this
      // is the same rule for the other thirteen, and it is the same call the
      // settings screen makes (instantTradeOffered). Switch Roofing off under
      // Services and the roofing card stops being offered to strangers that
      // minute, whatever the saved instant row still says — the row is left
      // alone, because turning someone's saved row off on their behalf is a
      // destructive operation dressed as tidying.
      //
      // effectiveInstantConfig returns null for exactly that, and also for a
      // derivable trade the company's price book cannot state a rate for.
      // Either way the honest answer is "not offered", not a stale number.
      const config = effectiveInstantConfig(row.trade, row.config, enabledRows);
      if (!config) return null;
      // Through the sanitiser like every other read of a saved config: this is
      // the first public call in the flow, so a malformed row must cost the
      // homeowner a material choice, not the whole page.
      const materials = spec.hasMaterials
        ? (sanitiseInstantConfig(config)?.materials || []).map((m) => ({ key: m.key, label: m.label }))
        : [];
      // The estimate panel is on screen from first paint — locked, empty or
      // live, depending on the trade. So WHICH of those it is has to arrive
      // with the page rather than after a measurement, or the panel spends the
      // first few seconds of every visit being the wrong one.
      //
      // This is a mode name, not a price: "we reveal after you submit" tells a
      // competitor nothing they couldn't learn by filling in the form.
      const estimateDisplay = visibilityFor(sanitiseInstantConfig(config));
      // The VISITOR's language when the page asked for one (the selector on
      // the form, or ?lang= on a link from a French page), else the
      // company's. Every label below follows it, so switching the pills
      // re-fetches this payload rather than leaving "Sofa / couch" in the
      // middle of a French junk-removal picker.
      const lang = instantQuoteLanguage(requested) || company.defaultLanguage || "en";

      return {
        trade: row.trade,
        estimateDisplay,
        ...(estimateDisplay === "after_submit" && { lockedMessage: lockedEstimateMessage(lang) }),
        ...(estimateDisplay === "gated" && { gatedMessage: gatedMessage(lang, "prompt") }),
        // Labels and index only. The { min, max } behind each band stays on the
        // server: the form posts which band was tapped, never what it was worth
        // (non-negotiable #5), so there is nothing here worth forging.
        budgetBands: budgetBands(config?.budgetThresholds, {
          currency: company.currency,
          language: lang,
        }).map((b) => ({ index: b.index, label: b.label })),
        label: instantTradeLabel(row.trade, lang, tradeLabel(row.trade)),
        measure: spec.measure,
        hasMaterials: spec.hasMaterials,
        materials,
        // Painting only: the scopes the form may ask about. One entry means
        // the question is not asked and the server prices that scope; the
        // browser cannot pick the other one, because withOfferedScope below
        // overrides whatever it sends.
        ...(row.trade === "painting" && { scopes: paintingScopes }),
        // Lawn care: the programs and add-ons as CARDS — names, descriptions,
        // season windows and which services a program includes — in the
        // company's language, with no price on any of them. The prices are
        // computed per property by /measure, exactly as a material list
        // carries labels here and ranges there (non-negotiable #4).
        ...(row.trade === "lawn_care" && { lawn: publicLawnOffer(config, lang) }),
        // The item-picker flow needs the taxonomy to render — item labels and
        // job types only, NEVER volumes or rates (those stay server-side; the
        // browser sends keys + quantities and the server reprices, per #5).
        ...(spec.measure === "item_picker" && {
          items: JUNK_ITEMS.map((i) => ({ key: i.key, label: junkItemLabel(i.key, i.label, lang), notAccepted: !!i.notAccepted })),
          jobTypes: Object.values(JOB_TYPES).map((j) => ({ key: j.key, label: junkJobTypeLabel(j.key, j.label, lang) })),
        }),
      };
    })
    .filter(Boolean);

  return {
    company,
    // The language the labels above were built in — the page echoes it back
    // on every later request so the measurement notes and the draft agree
    // with the form the homeowner read.
    language: instantQuoteLanguage(requested) || company.defaultLanguage || "en",
    trades,
    // Handed to the page rather than re-derived there: the same fact decides
    // whether the result screen offers a visit and whether the estimate email
    // carries a booking button, and those two must never disagree.
    booking: canBookVisit(company)
      ? { canBookVisit: true, slug: company.bookingSlug || company.slug }
      : { canBookVisit: false },
  };
}

/**
 * The lawn-care card WITHOUT prices: what the page renders before anything
 * is measured. `minSqft` is not a rate — it is the size the form says a
 * property is at least priced as, and the copy needs it to be honest.
 */
function publicLawnOffer(config, language) {
  const normalised = normaliseLawnCareConfig(config);
  if (!normalised) return { minSqft: LAWN_MIN_SQFT_DEFAULT, programs: [], addOns: [] };
  const text = (item) => ({
    key: item.key,
    name: lawnText(item.name, language),
    description: lawnText(item.description, language),
    window: lawnText(item.window, language),
  });
  return {
    minSqft: normalised.minSqft,
    programs: normalised.programs.map((p) => ({ ...text(p), services: p.services.map(text) })),
    addOns: normalised.addOns.map((a) => ({ ...text(a), kind: a.kind })),
  };
}

/**
 * The config one enabled trade PRICES off, or null when it cannot be priced.
 *
 * Both pricers below go through here, so the gate and the live price-book read
 * happen once and identically for the option list and for the authoritative
 * figure the draft is written from. Null means "not offered": the row is off,
 * the company no longer sells the service, or the price book states no rate for
 * a trade that derives from it. A hand-crafted POST naming a trade the company
 * has switched off under Services gets the same null the page does.
 */
async function loadEnabledConfig(companyId, trade) {
  const [row, enabledRows] = await Promise.all([
    db.instantQuoteConfig.findUnique({
      where: { companyId_trade: { companyId, trade } },
    }),
    companyEnabledCategoryRows(companyId),
  ]);
  if (!row || !row.enabled) return null;
  const config = effectiveInstantConfig(trade, row.config, enabledRows);
  if (!config) return null;
  return { ...config, enabled: true };
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

  if (spec.measure === "gutter_address") {
    const gutters = await measureGutters(input.address);
    if (!gutters.ok) return { ok: false, reason: gutters.reason, partial: gutters };
    // The measurement's own verdict is the gate. A run under 40 ft, a roof
    // that is a strip mall, a pin two lots over: no figure leaves the server,
    // and the flags travel in `partial` so the form can say why. A competitor
    // priced "7 ft of gutter" at its minimum; the honest answer is a visit.
    if (gutters.trustworthy === false) {
      return { ok: false, reason: "needs_site_visit", partial: gutters };
    }
    return { ok: true, measurement: gutters };
  }

  if (isPolygonMeasure(spec.measure)) {
    // lawn_polygon and area_polygon are one path: the vertices the browser
    // posted, the area recomputed from them here, and a still with the
    // outline drawn on it — lawn green for a lawn, amber for a paved
    // surface. The outline travels as `vertices`, the name the draft's
    // snapshot, the takeoff and the document already read for a traced
    // shape; the old `{ areaSqft, polygon }` shape kept the outline under a
    // key nothing downstream kept, so a mowing draft printed no trace.
    return measureTracedArea(input.polygon, { kind: spec.measure === "lawn_polygon" ? "lawn" : "area" });
  }

  if (spec.measure === "lawn_address") {
    // The trace wins when there is one; otherwise the address is sized from
    // the parcel and the roof, or falls to the minimum band and says so. The
    // company's own floor is read here so the fallback figure is THEIR band,
    // not a constant. The measurer's verdict gates the price like gutters'.
    const minSqft = normaliseLawnCareConfig(input.config)?.minSqft || LAWN_MIN_SQFT_DEFAULT;
    const lawn = await estimateLawn(input.address, { polygon: input.polygon, minSqft });
    if (!lawn.ok) return { ok: false, reason: lawn.reason, partial: lawn };
    if (lawn.trustworthy === false) return { ok: false, reason: "needs_site_visit", partial: lawn };
    // The selection travels ON the measurement as keys (cabinet add-ons do
    // the same): a program key and add-on keys, never an amount.
    const programKey = typeof input?.intake?.programKey === "string" ? input.intake.programKey.slice(0, 60) : null;
    const addOnKeys = Array.isArray(input?.intake?.addOnKeys)
      ? input.intake.addOnKeys.filter((k) => typeof k === "string" && k).map((k) => k.slice(0, 60)).slice(0, 24)
      : [];
    return { ok: true, measurement: { ...lawn, programKey, addOnKeys } };
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
        // straight | L | U — anything else is the default (L). The shape,
        // with the step count, is what the balusters, posts and handrail
        // are derived from (lib/estimate/stairsFromSteps.js).
        shape: stairShape(input?.intake?.shape),
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
export async function priceAllMaterials({ companyId, trade, measurement: requested, language = "en" }) {
  // Painting's scope is the company's services' call, not the browser's — and
  // it is settled BEFORE the config is loaded so a painter who sells neither
  // scope gets `scope_not_offered`, the reason that says which screen fixes
  // it, rather than the generic `not_configured` the service gate would give.
  // Same refusal either way; the difference is whether the flow can explain it.
  const scoped = await withOfferedScope(companyId, trade, requested);
  if (!scoped.ok) return { ok: false, reason: scoped.reason };
  const measurement = scoped.measurement;

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
  const priced = priceOptionsFor({ trade, config, measurement, language });
  if (!priced.ok) return { ok: false, reason: priced.reason };
  return { ok: true, visibility, options: priced.options, ...(priced.offer && { offer: priced.offer }) };
}

/**
 * Price ONE chosen material — the authoritative figure used when creating the
 * draft. Returns the full estimate (with breakdown) plus the source + category.
 */
export async function priceOneMaterial({ companyId, trade, materialKey, measurement: requested, language = "en" }) {
  // Same normalising boundary the /measure route crosses: the saved config is
  // browser-authored JSON, and a malformed material row would otherwise throw
  // inside the estimator and 500 a public POST.
  // Same settlement as priceAllMaterials, and first for the same reason: this
  // is the authoritative figure the draft is written from, so it must not
  // price a scope the company doesn't sell just because a request body named
  // one, and the refusal must say which of the two things is wrong.
  const scoped = await withOfferedScope(companyId, trade, requested);
  if (!scoped.ok) return { ok: false, reason: scoped.reason };
  const measurement = scoped.measurement;

  const config = sanitiseInstantConfig(await loadEnabledConfig(companyId, trade));
  if (!config) return { ok: false, reason: "not_configured" };

  const est = computeInstantEstimate({ trade, measurements: measurement, materialKey, config, language });
  if (!est.ok) return { ok: false, reason: est.reason || "no_estimate" };

  const spec = INSTANT_ESTIMATE_TRADES[trade];
  const categoryKey = primaryCategoryForInstantTrade(trade);
  // A lawn figure names where it came from — parcel, trace or the minimum
  // band — and that word, not the measure's generic one, is what the draft
  // and the review screen record.
  const source =
    spec.measure === "lawn_address" && measurement?.source
      ? measurement.source
      : SOURCE_BY_MEASURE[spec.measure] || "manual";
  const category = categoryKey
    ? await db.serviceCategory.findUnique({ where: { key: categoryKey }, select: { id: true } })
    : null;

  return {
    ok: true,
    estimate: est,
    // The measurement as PRICED — painting's scope settled above — so the
    // draft records the scope the figure was computed at, not the one the
    // request body happened to name.
    measurement,
    source,
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
