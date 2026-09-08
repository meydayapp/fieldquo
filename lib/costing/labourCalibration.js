// lib/costing/labourCalibration.js
//
// "The quote said 16 hours for 500 sqft of siding; the crew logged 21."
//
// The labour half of the close-out's "update your costing?" — the material
// half is lib/costing/materialCalibration.js and this keeps its rules: pure,
// never applies anything, never fills in a missing actual, never offers a
// button for a rate that has nowhere to go.
//
// ══ Where labour hours per unit of work are configured ═════════════════════
//
// Only ONE saved path exists today: `labourHoursPerSqft` on a price book, and
// tradeLabourHours() reads it flat (sqft × rate × material factor) for trades
// that publish it and are not itemised — siding is the one whose rate card
// declares the field (PRICE_BOOK_FIELDS.siding), so it is the one trade where
// a suggestion can be saved. Every other trade builds its hours from several
// steps at once:
//
//   * cabinets       cabinetRunLabour — sanding, degreasing, spraying, drying,
//                    reinstall, each its own timing
//   * painting       paintTakeoff — production rate per substrate, per coat
//   * exterior-by-   recipe: walls ÷ production rate, PLUS prep, wash, trim,
//     intake         doors, masking (RECIPE_EDITABLE_FIELDS.production_rate
//                    holds every one, and one job's total cannot say which ran
//                    over)
//   * roofing, paving, insulation — itemised engines with a dozen constants
//
// For those the comparison is still shown, per unit of work where the job
// has a denominator, and the line says "not adjustable from here yet" rather
// than guessing which of five rates to move.
//
// ══ One job, one trade ══════════════════════════════════════════════════════
//
// Time entries are tagged to a JOB, not to a scope group. A job that spans two
// trades has one pile of hours and no way to say how many went on the roof
// and how many on the siding, so nothing is suggested; the totals are still
// compared. Splitting them by the estimate's own proportions would be
// inventing an attribution, and one invented number is enough to move a rate
// the wrong way for every quote after it.

import { PRICE_BOOK_FIELDS, getPriceBook, readField } from "@/app/data/tradePriceBooks";
import { isUnitPriced } from "@/app/data/cabinetPricing";
import { hasRecipe } from "@/app/data/materialRecipes";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round = (v, places) => {
  const f = 10 ** places;
  const r = Math.round(num(v) * f) / f;
  return Number.isFinite(r) ? r : 0;
};

/** Why the labour line has no suggestion. Keys, not sentences. */
export const LABOUR_REASONS = Object.freeze({
  NO_ESTIMATE: "no_estimate",
  NO_ACTUAL: "no_actual",
  HOURS_PENDING: "hours_pending",
  MULTI_GROUP: "multi_group",
  NO_WORK: "no_work",
  NOT_OVERRIDABLE: "not_overridable",
  HAND_ADDED_HOURS: "hand_added_hours",
  NO_RATE: "no_rate",
  MATCHES: "matches",
  PERMISSION: "permission",
});

/** Trades whose hours come from an itemised engine rather than one flat rate. */
const ITEMISED = new Set([
  "roofing_service",
  "paving",
  "insulation",
  "interior_painting",
  "exterior_painting",
]);

/** Does this trade's rate card let a company SAVE a labour rate at `path`? */
function bookDeclares(categoryKey, path) {
  const fields = PRICE_BOOK_FIELDS[categoryKey];
  return Array.isArray(fields) && fields.some((f) => f && f.path === path);
}

/** The surface a takeoff measures, summed the way tradeLabourHours sums it. */
function takeoffSqft(takeoff) {
  if (!takeoff || typeof takeoff !== "object") return 0;
  return (
    num(takeoff.sqft) +
    num(takeoff.patioSqft) +
    num(takeoff.walkwaySqft) +
    num(takeoff.drivewaySqft)
  );
}

/**
 * What predicted a scope group's labour hours: the units of work, the label
 * for them, and — where a company can save it today — the rate's path.
 *
 * @param {object} p
 * @param {string} p.categoryKey
 * @param {object} p.intake         the group's intakeValues (cabinets, exterior
 *                                  by intake)
 * @param {object} p.takeoff        the group's takeoff (area trades)
 * @param {object} p.rateOverrides  the company's saved price-book edits
 * @param {object} p.recipeOverrides the company's saved recipe edits
 * @returns {{ units:number, unitLabel:string, store:"book"|null, path:string|null,
 *            rate:number|null, rateLabel:string|null, factor:number }|null}
 *          null when the group has no denominator at all
 */
export function labourBasisFor({
  categoryKey,
  intake = {},
  takeoff = null,
  rateOverrides = null,
  recipeOverrides = {},
} = {}) {
  if (!categoryKey) return null;
  const noPath = (units, unitLabel) =>
    units > 0
      ? { units, unitLabel, store: null, path: null, rate: null, rateLabel: null, factor: 1 }
      : null;

  // Cabinets: doors + drawers is the denominator, the rate is eleven steps.
  if (isUnitPriced(categoryKey)) {
    const units = num(intake?.doorCount) + num(intake?.drawerCount);
    return noPath(units, "doorsDrawers");
  }

  // Exterior painting by intake answers (the production-rate recipe): wall
  // area is the denominator, but prep, trim and doors are added on top, so
  // the wall rate alone cannot be held responsible for the total.
  if (categoryKey === "exterior_painting" && !takeoff && hasRecipe(categoryKey)) {
    const direct = num(intake?.wallSquareFootage);
    const area = direct > 0 ? direct : num(intake?.wallLengthFt) * num(intake?.wallHeightFt);
    // The recipe's wall production rate IS a saved path
    // (wallProductionRateSqftPerHour), and it is deliberately not offered:
    // recipeOverrides is accepted so a caller can pass the same bag the
    // material side gets, but the hours it predicts are walls PLUS prep, wash,
    // trim, doors and masking, and one total cannot say which of those ran
    // long. Moving the wall rate to absorb a slow prep day would be wrong on
    // every quote after it.
    void recipeOverrides;
    return noPath(area, "sqftWalls");
  }

  if (ITEMISED.has(categoryKey)) {
    return noPath(takeoffSqft(takeoff), "sqft");
  }

  // The flat path: hours = sqft × labourHoursPerSqft × material factor.
  const book = getPriceBook(categoryKey, rateOverrides || null);
  const units = takeoffSqft(takeoff);
  if (!book || units <= 0) return null;
  const rate = num(readField(book, "labourHoursPerSqft"));
  if (rate <= 0) return noPath(units, "sqft");

  // Siding's material factor rides with the chosen material — tradeLabourHours
  // multiplies by it, so the suggestion has to divide by it or the saved rate
  // would carry cedar's slowness into every vinyl quote.
  let factor = 1;
  if (categoryKey === "siding") {
    const materials = book.materials && typeof book.materials === "object" ? book.materials : {};
    const key = takeoff?.materialKey || book.defaultMaterial;
    const chosen = Object.prototype.hasOwnProperty.call(materials, key) ? materials[key] : null;
    factor = num(chosen?.labourFactor) || 1;
  }

  const declared = bookDeclares(categoryKey, "labourHoursPerSqft");
  return {
    units,
    unitLabel: "sqft",
    store: declared ? "book" : null,
    path: declared ? "labourHoursPerSqft" : null,
    rate,
    rateLabel: "hoursPerSqft",
    factor,
  };
}

/**
 * The labour comparison for one finished job, and a suggested rate where
 * there is exactly one rate to suggest.
 *
 * @param {object} p
 * @param {number|null} p.estimatedHours the quote's labour hours (frozen when
 *                                       the quote was costed, else derived)
 * @param {number} p.approvedHours       hours approved on this job
 * @param {number} p.pendingHours        hours logged and not yet approved
 * @param {number} p.unratedHours        approved hours from a worker with no rate
 * @param {Array}  p.groups              [{ categoryKey, label, labourHours,
 *                                       basis }] — basis from labourBasisFor
 * @returns one line, or null when the quote estimated no hours at all (the
 *          close-out draws nothing rather than a comparison against zero)
 */
export function labourCalibration({
  estimatedHours,
  approvedHours = 0,
  pendingHours = 0,
  unratedHours = 0,
  groups = [],
} = {}) {
  const est = estimatedHours == null ? null : num(estimatedHours);
  if (est === null || est <= 0) return null;

  const actual = num(approvedHours);
  const list = (Array.isArray(groups) ? groups : []).filter((g) => g && typeof g === "object");
  const withBasis = list.filter((g) => g.basis && num(g.basis.units) > 0);
  const single = withBasis.length === 1 ? withBasis[0] : null;
  const basis = single ? single.basis : null;
  const units = basis ? num(basis.units) : null;

  const base = {
    estimatedHours: round(est, 2),
    actualHours: round(actual, 2),
    pendingHours: round(num(pendingHours), 2),
    unratedHours: round(num(unratedHours), 2),
    deltaHours: round(actual - est, 2),
    deltaPct: est > 0 ? round(((actual - est) / est) * 100, 1) : null,
    categoryKey: single ? single.categoryKey || null : null,
    label: single ? single.label || null : null,
    unitsOfWork: units,
    unitLabel: basis ? basis.unitLabel || null : null,
    estimatedPerUnit: null,
    actualPerUnit: null,
    currentRate: null,
    suggestedRate: null,
    suggestedDeltaPct: null,
    canApply: false,
    reason: null,
  };

  if (actual <= 0) return { ...base, reason: LABOUR_REASONS.NO_ACTUAL };
  // A short actual would teach a rate that is too fast. Refused until the
  // timesheets are settled, and the close-out links to where that happens.
  if (num(pendingHours) > 0) return { ...base, reason: LABOUR_REASONS.HOURS_PENDING };
  if (withBasis.length > 1) return { ...base, reason: LABOUR_REASONS.MULTI_GROUP };
  if (!single) return { ...base, reason: LABOUR_REASONS.NO_WORK };

  // Per unit both ways, from the GROUP's own hours: the job's total may carry
  // hours the estimator added by hand, and those are not this rate's.
  const groupHours = num(single.labourHours);
  const perUnit = {
    estimatedPerUnit: round((groupHours > 0 ? groupHours : est) / units, 4),
    actualPerUnit: round(actual / units, 4),
  };

  if (!basis.path || !basis.store) {
    return { ...base, ...perUnit, reason: LABOUR_REASONS.NOT_OVERRIDABLE };
  }
  const currentRate = {
    store: basis.store,
    path: basis.path,
    value: num(basis.rate) > 0 ? num(basis.rate) : null,
    label: basis.rateLabel || null,
  };
  const withRate = { ...base, ...perUnit, currentRate };
  if (currentRate.value == null) return { ...withRate, reason: LABOUR_REASONS.NO_RATE };

  // Hours the estimator typed on top of the rate. If they exist, the
  // difference cannot be pinned on the rate alone — the added hours may be
  // what ran over — so nothing is suggested. See the file comment.
  if (est - groupHours > 0.005) {
    return { ...withRate, reason: LABOUR_REASONS.HAND_ADDED_HOURS };
  }

  const factor = num(basis.factor) || 1;
  const suggested = round(actual / units / factor, 4);
  if (!Number.isFinite(suggested) || suggested <= 0) {
    return { ...withRate, reason: LABOUR_REASONS.NO_RATE };
  }
  if (suggested === currentRate.value) {
    return { ...withRate, suggestedRate: suggested, suggestedDeltaPct: 0, reason: LABOUR_REASONS.MATCHES };
  }
  return {
    ...withRate,
    suggestedRate: suggested,
    suggestedDeltaPct: round(((suggested - currentRate.value) / currentRate.value) * 100, 1),
    canApply: true,
    reason: null,
  };
}
