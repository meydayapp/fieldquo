// lib/estimate/instantQuoteCosting.js
//
// Translating an instant estimate's MEASUREMENT into the shape
// lib/costing/quoteCosting.js already knows how to read.
//
// ── Why this exists instead of costing the estimate directly ────────────────
//
// The instant estimator prices a job from Company.instantQuoteConfig — a rate
// table an owner types under Settings → Instant Quotes, built for a homeowner
// picking a material off a public page. It has never known an hour: there is
// no crew, no labour-hours-per-square, nothing quoteCostSummary can read.
//
// The normal builder's cost panel prices labour from a DIFFERENT table —
// app/data/tradePriceBooks.js, read through lib/pricing/tradeScope.js's
// tradeLabourHours() — which wants a structured TAKEOFF: roof squares and
// pitch, cabinet door and drawer counts, and so on. That table is what
// lib/costing/quoteCosting.js was written against, and it is the one
// quoteCostSummary calls unconditionally.
//
// Two engines, and this file does not become a third. It only reshapes data
// the instant estimator ALREADY measured — squares off a satellite read,
// doors and drawers the homeowner typed — into the field names
// tradeLabourHours expects, for the handful of trades where that translation
// is a rename rather than a guess. Nothing here invents a number; every field
// either comes straight off the measurement or is left absent, exactly the
// way TradeTakeoff.js leaves an untouched field absent for the same functions
// to default (or warn about) on their own.
//
// ── Why only two trades ──────────────────────────────────────────────────────
//
// Cabinet refinishing/refacing and roofing are the two instant trades whose
// measurement already carries what the labour engine asks for by another
// name — doorCount/drawerCount are cabinetRunLabour's doors/drawers exactly,
// and the satellite read is roofLabour's squares/pitchRise/layers exactly.
// Every other instant trade (epoxy, parging, flooring, painting, countertop,
// stairs, lawn mowing, junk removal) prices from Company.instantQuoteConfig
// with no equivalent structured form on the builder side, so there is nothing
// honest to translate — inventing a mapping for those would be exactly the
// "second costing calculation" this module exists to avoid. Those trades
// still get a QuoteCosting row when there is a real basis to cost from (see
// buildInstantQuoteCosting in createEstimateQuote.js); they just don't get
// labour hours from a takeoff, the same as a generic line-item quote today.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * @param {string} trade        the instant-quote trade key
 * @param {string} materialKey  the material the homeowner picked, if any
 * @param {object} measurement  the server-measured facts (see
 *                               lib/estimate/instantQuoteServer.js)
 * @returns {{ takeoff: object|null, intakeValues: object|null }}
 *          Both null when this trade has no honest translation — the caller
 *          leaves the scope group's takeoff/intakeValues absent, same as it
 *          always has.
 */
export function costingInputsForInstantTrade(trade, materialKey, measurement) {
  const m = measurement && typeof measurement === "object" ? measurement : {};

  if (trade === "roofing") {
    // roofLabour() reads what's here and defaults everything else (storeys,
    // vents, chimneys, valleys — none of it visible from a satellite image)
    // without throwing; see lib/pricing/roofLabour.js. squares/areaSqft and
    // pitchRise are literally what measureRoof() returns, under the names
    // roofLabour already reads them by.
    const takeoff = {
      ...(num(m.areaSqft) !== undefined && { areaSqft: num(m.areaSqft) }),
      ...(num(m.squares) !== undefined && { squares: num(m.squares) }),
      ...(num(m.predominantPitch?.rise) !== undefined && {
        pitchRise: num(m.predominantPitch.rise),
      }),
      ...(num(m.tearOffLayers) !== undefined && { layers: num(m.tearOffLayers) }),
      ...(materialKey && { materialKey }),
    };
    return Object.keys(takeoff).length ? { takeoff, intakeValues: null } : { takeoff: null, intakeValues: null };
  }

  if (trade === "cabinet_refinishing" || trade === "cabinet_refacing") {
    // cabinetRunLabour() reads doors/drawers/complexityLevel — the same
    // translation lib/costing/quoteCosting.js's own cabinetConfigFrom() does
    // from a builder-typed intake, applied here to the homeowner's typed
    // counts instead.
    const doors = num(m.doorCount) || 0;
    const drawers = num(m.drawerCount) || 0;
    if (doors + drawers <= 0) return { takeoff: null, intakeValues: null };
    return {
      takeoff: null,
      intakeValues: {
        doorCount: doors,
        drawerCount: drawers,
        ...(m.complexityLevel && { complexityLevel: m.complexityLevel }),
      },
    };
  }

  return { takeoff: null, intakeValues: null };
}
