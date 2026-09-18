// lib/estimate/instantQuoteCosting.js
//
// Translating an instant estimate's MEASUREMENT into the takeoff the quote
// builder already knows how to read — so an instant quote opens in the editor
// with the same cost panel, labour hours, material recipes and overhead as a
// quote an estimator built by hand.
//
// ── What was wrong before 2026-09-16 ─────────────────────────────────────────
//
// The instant estimator prices a job from Company.instantQuoteConfig — a rate
// table an owner types under Settings → Instant Quotes, built for a homeowner
// picking a material off a public page. The draft it created stored only the
// flat price breakdown; the measurement (square feet, treads, doors, roof
// squares) was used once to compute the range and then dropped, except for
// roofing and cabinets where it fed a costing row. So every instant quote
// opened in the editor with no takeoff: no crew hours, no materials, overhead
// applied to nothing — the owner: "the instant quotes don't have the same
// amount of information or the same cost and materials and crew hours ... and
// when you edit the quote it gives you a different look and feel with not the
// right overhead cost".
//
// The builder's cost panel (lib/costing/quoteCosting.js) reads a group's
// `takeoff` in the field names of app/data/tradePriceBooks.js — through
// tradeLabourHours() for hours, paintTakeoff for painting, the cabinet recipe
// through `intakeValues` — and TradeTakeoff.js shows the same object. This
// module writes THAT object from the measurement, for every instant trade,
// and the draft stores it on the scope group (createEstimateQuote.js).
//
// ── Rules ────────────────────────────────────────────────────────────────────
//
// Nothing here invents a number. A field is written only when the measurement
// carries it under some name; everything else is left absent so the engine
// defaults or warns exactly as it does for a hand-typed takeoff with the same
// field untouched. The instant PRICE is not touched either: the group's line
// items stay the breakdown the homeowner saw (a persisted group is edited as
// lines, never re-priced), and the takeoff feeds the COST side only.
//
// Trades whose builder has no structured takeoff (junk removal, epoxy,
// parging, countertop's supplier-invoice model) get their measurement
// in `intakeValues`, where the editor and the AI review can read "850 sq ft
// measured" — that is the same information a hand-built quote of that trade
// would carry, because for those trades there is nothing else to derive.

import { alreadyCaptured } from "@/lib/measure/satelliteCapture";
import { lawnTakeoffPatch } from "@/lib/measure/lawnEstimate";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// ── The still the price was worked out from ─────────────────────────────────
//
// createEstimateQuote captures the Google still to Cloudinary BEFORE this
// runs (withCapturedSatellite), so `satelliteImageUrl` here is normally ours.
// Only a captured URL is written as the document's `url`: a Static Maps link
// carries the public key and re-bills on every open, and the document section
// prints `url` alone. The Google link is kept as `sourceUrl` so the save path
// (lib/measure/measureImages.js) can capture it later if this one failed —
// no Cloudinary in local dev, a timeout — rather than the document losing the
// picture for good.
function measureImageFor(m) {
  const url = typeof m?.satelliteImageUrl === "string" ? m.satelliteImageUrl : null;
  if (!url) return undefined;
  if (alreadyCaptured(url)) {
    return drop({ url, sourceUrl: m.satelliteSourceUrl || undefined, capturedAt: m.satelliteCapturedAt || undefined });
  }
  return { sourceUrl: url };
}
const pos = (v) => {
  const n = num(v);
  return n !== undefined && n > 0 ? n : undefined;
};
const drop = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));

/** The instant intake's three-step condition → the price books' complexity keys. */
const COMPLEXITY_BY_CONDITION = { good: "standard", fair: "moderate", poor: "high" };

/**
 * @param {string} trade        the instant-quote trade key
 * @param {string} materialKey  the material the homeowner picked, if any
 * @param {object} measurement  the server-measured facts (see
 *                               lib/estimate/instantQuoteServer.js)
 * @param {object} [opts]
 * @param {string} [opts.categoryKey]  the ServiceCategory the draft files
 *                                     under — painting needs it to choose
 *                                     interior vs exterior
 * @returns {{ takeoff: object|null, intakeValues: object|null }}
 *          takeoff null when the builder has no structured form for the
 *          trade; intakeValues carries the measurement then.
 */
export function costingInputsForInstantTrade(trade, materialKey, measurement, { categoryKey = null } = {}) {
  const m = measurement && typeof measurement === "object" ? measurement : {};

  if (trade === "roofing") {
    const takeoff = drop({
      areaSqft: num(m.areaSqft),
      squares: num(m.squares),
      pitchRise: num(m.predominantPitch?.rise),
      layers: num(m.tearOffLayers),
      materialKey: materialKey || undefined,
      measuredFrom: m.areaSqft ? "satellite" : undefined,
      // The satellite still, so the document the client receives shows the
      // roof the price was measured from (lib/documentSections).
      measureImage: m.areaSqft ? measureImageFor(m) : undefined,
    });
    return Object.keys(takeoff).length ? { takeoff, intakeValues: null } : { takeoff: null, intakeValues: null };
  }

  if (trade === "gutters") {
    const ft = pos(m.gutterFt);
    if (!ft) return { takeoff: null, intakeValues: null };
    // The gutter takeoff's own fields (lib/pricing/tradeScope.js buildGutters):
    // an instant gutter estimate is a replacement — new seamless run up,
    // whatever is there down — so the downspouts land on the install count.
    // Storeys are left at the form's default and the flags travel with the
    // takeoff so the review (lib/quotes/completeness.js) reads them.
    return {
      takeoff: drop({
        workType: "replacement",
        gutterFt: Math.round(ft),
        downspoutsInstalled: pos(m.downspouts) ? Math.floor(m.downspouts) : undefined,
        measuredFrom: "satellite",
        measuredAddress: m.formattedAddress || undefined,
        measuredBasis: m.basis || undefined,
        measuredImagery: m.imagery
          ? { date: m.imagery.date || null, year: m.imagery.year || null, quality: m.imagery.quality || null }
          : undefined,
        measuredFlags: Array.isArray(m.flags)
          ? m.flags.map((f) => ({ code: f.code, severe: Boolean(f.severe), text: f.text }))
          : undefined,
        measureImage: measureImageFor(m),
      }),
      intakeValues: null,
    };
  }

  if (trade === "lawn_care") {
    // The evidence the document prints — outline, area, where it came from —
    // in the shape lawnTakeoffPatch writes for the builder too, so a quote
    // an estimator traced and a quote a homeowner's address produced carry
    // the same takeoff. The intake gets `lotSize`, the lawn form's own box,
    // so reopening the quote in the builder shows the figure where the form
    // expects it (lib/measure/lotTakeoff.js LOT_AREA_FIELD).
    const patch = lawnTakeoffPatch(m, m.formattedAddress || "");
    if (!patch) return { takeoff: null, intakeValues: null };
    return {
      takeoff: drop({ ...patch, measureImage: measureImageFor(m) }),
      intakeValues: drop({
        lotSize: Math.round(num(m.areaSqft)),
        programKey: m.programKey || undefined,
        addOnKeys: Array.isArray(m.addOnKeys) && m.addOnKeys.length ? m.addOnKeys : undefined,
      }),
    };
  }

  if (trade === "cabinet_refinishing" || trade === "cabinet_refacing") {
    const doors = num(m.doorCount) || 0;
    const drawers = num(m.drawerCount) || 0;
    if (doors + drawers <= 0) return { takeoff: null, intakeValues: null };
    return {
      takeoff: null,
      intakeValues: drop({
        doorCount: doors,
        drawerCount: drawers,
        boxLinearFt: pos(m.boxLinearFt),
        complexityLevel: m.complexityLevel || undefined,
        woodSpecies: m.woodSpecies || undefined,
      }),
    };
  }

  if (trade === "flooring") {
    const sqft = pos(m.areaSqft);
    if (!sqft) return { takeoff: null, intakeValues: null };
    return {
      takeoff: {
        sections: [
          drop({
            title: "Floor",
            sqft,
            complexityLevel: COMPLEXITY_BY_CONDITION[m.surfaceCondition] || "standard",
            woodSpecies: materialKey || undefined,
          }),
        ],
      },
      intakeValues: drop({ areaSqft: sqft, surfaceCondition: m.surfaceCondition || undefined }),
    };
  }

  if (trade === "stair") {
    const treads = pos(m.treads);
    if (!treads) return { takeoff: null, intakeValues: null };
    return {
      takeoff: {
        sections: [
          drop({
            title: "Staircase",
            complexityLevel: "standard",
            treads: Math.floor(treads),
            risers: Math.floor(treads),
            handrailFt: pos(m.railingFt),
          }),
        ],
      },
      intakeValues: drop({ treads: Math.floor(treads), railingFt: pos(m.railingFt) }),
    };
  }

  if (trade === "painting") {
    const sqft = pos(m.areaSqft);
    if (!sqft) return { takeoff: null, intakeValues: null };
    const exterior = m.scope === "exterior" || categoryKey === "exterior_painting";
    // One measured surface — the homeowner typed a wall/surface area, not a
    // room — driving the substrate the trade actually paints. The area type,
    // measurement style and substrate keys are lib/pricing/paintTakeoff.js's
    // own; the engine derives coats, gallons and hours from them.
    return {
      takeoff: {
        model: "area_substrate",
        areas: [
          {
            areaType: exterior ? "exterior" : "whole_house",
            label: exterior ? "Exterior" : "Interior",
            surface: exterior ? "exterior" : "interior",
            measurement: "surface",
            lengthFt: 0,
            widthFt: 0,
            heightFt: 0,
            linearFt: 0,
            surfaceSqft: sqft,
            prepHours: 0,
            optional: false,
            roundGallonsUp: null,
            crewNote: "",
            clientNote: "",
            substrates: [
              {
                key: exterior ? "siding_trim" : "walls",
                coats: 2,
                prepHours: 0,
                quantity: null,
                driver: "wallSqft",
                productKey: null,
                noProduct: false,
                optional: false,
                showFormula: false,
                roundGallonsUp: null,
              },
            ],
          },
        ],
        notes: "",
      },
      intakeValues: drop({ areaSqft: sqft, scope: exterior ? "exterior" : "interior", surfaceCondition: m.surfaceCondition || undefined }),
    };
  }

  // No structured takeoff on the builder side for these: the measurement
  // travels as intake values so the editor and the review can read it.
  if (trade === "countertop") {
    const sqft = pos(m.areaSqft);
    if (!sqft) return { takeoff: null, intakeValues: null };
    return {
      takeoff: null,
      intakeValues: drop({ areaSqft: sqft, edgeFt: pos(m.edgeFt), cutouts: pos(m.cutouts), backsplashSqft: pos(m.backsplashSqft), materialKey: materialKey || undefined }),
    };
  }
  // ── The two traced trades: the outline reaches the document ──────────────
  //
  // Lawn mowing sat in the epoxy/parging bucket below until 2026-09-18 —
  // `intakeValues: { areaSqft }` and no takeoff — so the shape the homeowner
  // drew never reached the group and the quote printed no trace, while a
  // lawn-care draft from the same map printed the still and "Lawn measured".
  // Both traces now land the way the builder's own tracer
  // (app/components/quotes/builder/LotAreaMeasure.js) lands one.
  if (trade === "lawn_mowing") {
    // Same `takeoff.lawn` as lawn care and the builder — it IS a lawn — and
    // the intake gets `lotSize`, the mowing form's own box
    // (lib/measure/lotTakeoff.js LOT_AREA_FIELD), where before it got an
    // `areaSqft` no form displays.
    const patch = lawnTakeoffPatch(m, m.formattedAddress || "");
    if (!patch) return { takeoff: null, intakeValues: null };
    return {
      takeoff: drop({ ...patch, measureImage: measureImageFor(m) }),
      intakeValues: drop({ lotSize: Math.round(num(m.areaSqft)) }),
    };
  }

  if (trade === "paving") {
    const sqft = pos(m.areaSqft);
    if (!sqft) return { takeoff: null, intakeValues: null };
    // The paving takeoff's own fields (lib/pricing/tradeScope.js buildPaving,
    // PavingTakeoff in TradeTakeoff.js): the traced area lands in the box for
    // the surface the homeowner picked — patioSqft / walkwaySqft /
    // drivewaySqft — so the paver engine costs it, at the standard tier the
    // instant rate was read from. `measuredAreaSqft` is what the document
    // caption reads ("Paving area measured: 640 sq ft", lib/measure/measureImages.js
    // measureCaption); it was a read with no writer until this. The outline
    // itself travels as `traced.vertices`, named so a driveway is never
    // filed under `lawn`.
    const surface = ["patio", "walkway", "driveway"].includes(materialKey) ? materialKey : null;
    const area = Math.round(sqft);
    return {
      takeoff: drop({
        complexityLevel: "standard",
        ...(surface ? { [`${surface}Sqft`]: area } : {}),
        measuredAreaSqft: area,
        measuredFrom: "traced",
        traced: drop({
          areaSqft: area,
          source: m.source || "traced",
          basis: m.basis || "traced",
          vertices: Array.isArray(m.vertices) && m.vertices.length >= 3 ? m.vertices : undefined,
          address: m.formattedAddress || undefined,
        }),
        measureImage: measureImageFor(m),
      }),
      // The paving intake form's own box (app/data/quoteIntakeFields.js).
      // Which surface it is lives on the takeoff above, where the engine
      // reads it; the intake form has no box for it and gets none.
      intakeValues: { squareFootage: area },
    };
  }

  if (trade === "epoxy" || trade === "parging") {
    const sqft = pos(m.areaSqft);
    if (!sqft) return { takeoff: null, intakeValues: null };
    return {
      takeoff: null,
      intakeValues: drop({
        areaSqft: sqft,
        surfaceCondition: m.surfaceCondition || undefined,
        condition: m.condition || undefined,
        access: m.access || undefined,
        materialKey: materialKey || undefined,
      }),
    };
  }
  if (trade === "junk_removal") {
    const items = Array.isArray(m.items) ? m.items : null;
    const load = m.loadSize || m.load || undefined;
    if (!items && !load) return { takeoff: null, intakeValues: null };
    return { takeoff: null, intakeValues: drop({ items: items || undefined, loadSize: load }) };
  }

  return { takeoff: null, intakeValues: null };
}
