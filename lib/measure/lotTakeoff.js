// lib/measure/lotTakeoff.js
//
// The landscaping trades' half of the polygon measuring tool: WHICH trades
// get a "trace the lawn" canvas on the quote builder, and WHICH intake
// fields the traced numbers land in.
//
// ── Why this is intake, not a takeoff ──────────────────────────────────────
//
// Paving has a structured takeoff (TradeTakeoff.js → PavingTakeoff) with
// three square-footage boxes the paver engine prices from, so the paver
// canvas writes those. The landscaping trades have no engine and no takeoff:
// they price by line item, and what the builder asks for is the intake in
// app/data/quoteIntakeFields.js — `lotSize` for every one of them, which an
// estimator today types by hand from a lot plan or a guess. A traced outline
// is the same number arrived at honestly, so that is the field it fills, and
// the intake form shows the result in the same box the estimator would have
// typed into. Nothing new is invented for the costing to ignore.
//
// The outline's LENGTH is the second number a landscaper wants — bed edging
// and lawn edging are bought and laid by the linear foot — and until this
// module there was no field for it. `edgingFt` was added to the two trades
// that lay edging (landscaping_design, lawn_care) and only those: a mowing
// contract has no edging line, and writing a foot count into a trade that
// cannot use it would be a number that appears to matter and doesn't.
//
// Pure. scripts/check-polygon-scale.mjs asserts every trade listed here
// actually has the fields this module writes, so a "Trace the area" button
// can never appear above a form that has no box for its answer.

/**
 * Trades whose quote-builder intake gets the polygon canvas. Every one has a
 * `lotSize` intake field (asserted by the check); the two that lay edging
 * also have `edgingFt`.
 */
export const LOT_MEASURE_TRADES = [
  "landscaping_design",
  "lawn_care",
  "lawn_mowing",
  "irrigation",
];

/** The intake field the traced AREA fills, whole square feet. */
export const LOT_AREA_FIELD = "lotSize";

/** The intake field the traced OUTLINE fills, feet to one decimal. */
export const LOT_EDGE_FIELD = "edgingFt";

/**
 * Trades whose builder panel fetches an aerial still.
 *
 * Declarative since 2026-09-18: the builder page no longer fetches one still
 * for the quote off this list — each panel (PavingTakeoff for paving,
 * LotAreaMeasure for the trades above) fetches its own from the address on
 * its takeoff, through app/components/quotes/builder/useSatelliteStill.js.
 * The list stays as the record of which trades those are, and
 * scripts/check-polygon-scale.mjs holds it to the intake fields the panels
 * write into.
 */
export const SITE_IMAGE_TRADES = ["paving", ...LOT_MEASURE_TRADES];

export function isLotMeasureTrade(categoryKey) {
  return LOT_MEASURE_TRADES.includes(categoryKey);
}

export function wantsSiteImage(categoryKey) {
  return SITE_IMAGE_TRADES.includes(categoryKey);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The intake patch a traced lot produces, restricted to the fields this
 * category's form actually shows. PURE.
 *
 * Restricted on purpose: writing `edgingFt` into a mowing group would store a
 * value no box displays and no engine reads — the "field written and never
 * read" class AGENTS.md lists first. The form's field list is the contract,
 * so the caller passes it and this function writes nothing outside it.
 *
 * Whole square feet and tenths of a foot: a shape traced over a satellite
 * tile is not accurate to a hundredth, and a box reading "4,371.26" claims a
 * precision the method does not have.
 *
 * @param {{areaSqFt:number, perimeterFt:number}} totals
 * @param {Array<{key:string}>} fields  the category's intake field list
 * @returns {object} `{}` when the form has no box for either number
 */
export function lotIntakePatch(totals, fields) {
  const keys = new Set(
    (Array.isArray(fields) ? fields : []).map((f) => f?.key).filter(Boolean),
  );
  const patch = {};
  if (keys.has(LOT_AREA_FIELD)) {
    patch[LOT_AREA_FIELD] = Math.round(num(totals?.areaSqFt));
  }
  if (keys.has(LOT_EDGE_FIELD)) {
    patch[LOT_EDGE_FIELD] = Math.round(num(totals?.perimeterFt) * 10) / 10;
  }
  return patch;
}
