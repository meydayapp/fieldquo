// lib/pricing/paverTakeoff.js
//
// How much material a paver job needs. Pure arithmetic — no rates, no I/O, no
// React — so it can be executed against hostile input in a check script, which
// is where the bugs in this kind of code actually surface.
//
// Prices live in the price book; this file only answers "how many" and "how
// much of". Keeping them apart matters because the quantities are physics and
// the prices are a market: a company edits the second constantly and should
// never be able to edit the first.
//
// ── Two errors in the published sources, deliberately not reproduced ────────
//
// 1. InchCalculator's own worked example rounds paver area to 0.23 sq ft and
//    gets 2,609 pavers for a 600 sq ft patio in 4×8s. The unrounded answer is
//    2,700 — and their own "450 per 100 sq ft" table agrees with 2,700. The
//    rounding loses 3.4%, which on a real job is ninety-one pavers the crew
//    does not have on the last morning. Intermediate area is never rounded
//    here; only the final count is, and always up.
//
// 2. Their base-material table reads 10.67 cu yd for 700 sq ft at 4", where
//    the formula gives 10.37. Every other row in that table computes
//    correctly, so it is a transposition. The formula wins.
//
// ── The compaction factor applies to gravel only ────────────────────────────
//
// Base gravel is ordered 20% over the finished volume because it compacts.
// Bedding sand is not compacted — it is screeded — and applying the factor to
// it over-orders sand on every job. Verified against the source's own table at
// 100, 550 and 600 sq ft: the gravel rows carry the 1.2 and the sand rows do
// not.

const SQ_IN_PER_SQ_FT = 144;
const CU_FT_PER_CU_YD = 27;

/** Waste allowance by laying pattern. Straight courses cut less than diagonals. */
export const PAVER_WASTE = {
  straight: 0.1,
  diagonal: 0.2,
  herringbone: 0.2,
  multi_piece: 0.2,
};

/**
 * Compacted base depth, in inches, by what the surface has to carry.
 *
 * ── These are FROST-REGION depths, and that is a correction ─────────────────
 *
 * This shipped with the US calculator's figures — 4–6" for a patio, 6–8" for a
 * driveway. Those are fine where the ground does not freeze and wrong
 * everywhere this software is actually used. Two real Ottawa jobs:
 *
 *   Custom Interlocking, 636 Mikinak Rd, 2021 — "Excavate 12\", 12"
 *   compressed granular base, 3 compacted lifts" on a 1,220 sqft patio.
 *   Allen Landscaping, Ottawa — "10 to 14 inches for a patio and 18+ inches
 *   for a driveway."
 *
 * At the old numbers a 600 sqft Ottawa patio ordered 13.3 cu yd of gravel when
 * the job needs 26.7 — half the base, on the quote and on the truck. Depth is
 * the single biggest driver of aggregate cost, so this was not a rounding
 * error; it was half the material money.
 *
 * `temperate` keeps the original figures for anywhere that does not freeze.
 */
export const BASE_DEPTH_IN = {
  walkway: { min: 8, max: 10, standard: 8 },
  patio: { min: 10, max: 14, standard: 12 },
  driveway: { min: 12, max: 18, standard: 18 },
};

/** Non-freezing ground. The depths this file used to apply everywhere. */
export const BASE_DEPTH_IN_TEMPERATE = {
  walkway: { min: 4, max: 6, standard: 4 },
  patio: { min: 4, max: 6, standard: 6 },
  driveway: { min: 6, max: 8, standard: 8 },
};

export const BEDDING_SAND_IN = 1;
export const GRAVEL_COMPACTION = 1.2;

/**
 * Tons per cubic yard. Ranges, because aggregate density genuinely varies with
 * gradation and moisture — the low figure under-orders and the high one
 * over-orders, so a quote should be built on one of them knowingly.
 */
export const DENSITY_TONS_PER_CU_YD = {
  gravel: { low: 1.4, high: 1.7 },
  sand_dry: { low: 1.3, high: 1.5 },
  sand_wet: { low: 1.5, high: 1.7 },
};

/**
 * Polymeric sand coverage per 50 lb bag, by joint width. Product-specific and
 * printed on the bag, which is why the price book carries it as an editable
 * field rather than this file treating it as a constant.
 */
export const POLY_SAND_COVERAGE = {
  narrow: { low: 75, high: 100 },
  wide: { low: 30, high: 60 },
  flagstone: { low: 8, high: 10 },
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const positive = (v) => {
  const n = num(v);
  return n > 0 ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;

// Own-property lookup. A surface, pattern or joint name can arrive from stored
// JSON, and BASE_DEPTH_IN["__proto__"] is truthy on any plain object — which
// handed `depths` Object.prototype and silently produced a zero-depth base.
// Same guard, same reason, as the one in app/data/tradePriceBooks.js.
const own = (map, key) =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

/**
 * Area of one paver in square feet.
 *
 * `jointIn` widens the effective footprint: a 1/8" joint on a 4×8 makes each
 * unit cover 0.2328 sq ft rather than 0.2222, which is 4.7% fewer pavers.
 * Defaults to 0, matching the published tables — those absorb the joint into
 * the waste allowance instead, and counting it in both places orders short.
 */
export function paverAreaSqFt(lengthIn, widthIn, jointIn = 0) {
  const l = positive(lengthIn) + positive(jointIn);
  const w = positive(widthIn) + positive(jointIn);
  if (l <= 0 || w <= 0) return 0;
  return (l * w) / SQ_IN_PER_SQ_FT;
}

/**
 * How many pavers to order.
 *
 * @returns {{exact:number, order:number, wastePct:number, perSqFt:number}}
 *          `exact` is the theoretical count, `order` is what to buy.
 */
export function paverCount({
  areaSqFt,
  paverLengthIn,
  paverWidthIn,
  jointIn = 0,
  pattern = "straight",
  wastePct = null,
}) {
  const area = positive(areaSqFt);
  const unit = paverAreaSqFt(paverLengthIn, paverWidthIn, jointIn);
  if (area <= 0 || unit <= 0) {
    return { exact: 0, order: 0, wastePct: 0, perSqFt: 0 };
  }
  const waste =
    wastePct != null
      ? positive(wastePct)
      : (own(PAVER_WASTE, pattern) ?? PAVER_WASTE.straight);
  const exact = area / unit;
  return {
    exact: round2(exact),
    // Up, always. A part-paver is a paver you have to have on site.
    order: Math.ceil(exact * (1 + waste)),
    wastePct: waste,
    perSqFt: round2(1 / unit),
  };
}

/**
 * Base gravel and bedding sand for an area.
 *
 * @returns {{gravelCuYd:number, gravelTons:{low:number,high:number},
 *            sandCuYd:number, sandTons:{low:number,high:number},
 *            gravelDepthIn:number}}
 */
export function baseMaterials({
  areaSqFt,
  surface = "patio",
  gravelDepthIn = null,
  sandDepthIn = BEDDING_SAND_IN,
  // Frost region by default: this software is sold in Canada, and a base built
  // to a non-freezing spec heaves. Pass false for a temperate market.
  frostRegion = true,
}) {
  const area = positive(areaSqFt);
  const table = frostRegion === false ? BASE_DEPTH_IN_TEMPERATE : BASE_DEPTH_IN;
  const depths = own(table, surface) || table.patio;
  const gravelDepth =
    gravelDepthIn != null ? positive(gravelDepthIn) : depths.standard;
  const sandDepth = positive(sandDepthIn);

  const looseGravel = (area * gravelDepth) / 12 / CU_FT_PER_CU_YD;
  const gravelCuYd = round2(looseGravel * GRAVEL_COMPACTION);
  const sandCuYd = round2((area * sandDepth) / 12 / CU_FT_PER_CU_YD);

  const tons = (cuYd, d) => ({
    low: round2(cuYd * d.low),
    high: round2(cuYd * d.high),
  });

  return {
    gravelDepthIn: gravelDepth,
    sandDepthIn: sandDepth,
    gravelCuYd,
    gravelTons: tons(gravelCuYd, DENSITY_TONS_PER_CU_YD.gravel),
    sandCuYd,
    sandTons: tons(sandCuYd, DENSITY_TONS_PER_CU_YD.sand_dry),
  };
}

/** Polymeric sand bags for an area, rounded up. Coverage is per 50 lb bag. */
export function polySandBags({
  areaSqFt,
  joint = "narrow",
  coverageSqFtPerBag = null,
}) {
  const area = positive(areaSqFt);
  if (area <= 0) return { low: 0, high: 0 };
  if (coverageSqFtPerBag != null) {
    const c = positive(coverageSqFtPerBag);
    const bags = c > 0 ? Math.ceil(area / c) : 0;
    return { low: bags, high: bags };
  }
  const c = own(POLY_SAND_COVERAGE, joint) || POLY_SAND_COVERAGE.narrow;
  // Wider coverage means fewer bags, so the high coverage gives the LOW count.
  return { low: Math.ceil(area / c.high), high: Math.ceil(area / c.low) };
}

/**
 * Is a drawn rectangle actually square?
 *
 * A true rectangle has equal diagonals. This is the check a crew does with a
 * tape before laying anything, and the same check validates a shape drawn on
 * a satellite image — a quadrilateral whose diagonals disagree is a
 * parallelogram, and its area is not length × width.
 *
 * @returns {{diagonal:number, diagonal2:number|null, square:boolean,
 *            differenceFt:number}}
 */
export function squareCheck({
  lengthFt,
  widthFt,
  measuredDiagonalFt = null,
  toleranceFt = 0.25,
}) {
  const l = positive(lengthFt);
  const w = positive(widthFt);
  const diagonal = round2(Math.sqrt(l * l + w * w));
  if (measuredDiagonalFt == null) {
    return { diagonal, diagonal2: null, square: true, differenceFt: 0 };
  }
  const measured = positive(measuredDiagonalFt);
  const difference = round2(Math.abs(diagonal - measured));
  return {
    diagonal,
    diagonal2: round2(measured),
    square: difference <= positive(toleranceFt),
    differenceFt: difference,
  };
}

/** Area of any drawn polygon, by the shoelace formula. Points are [{x,y}] in feet. */
export function polygonAreaSqFt(points) {
  const p = Array.isArray(points)
    ? points.filter(
        (q) =>
          q && Number.isFinite(Number(q.x)) && Number.isFinite(Number(q.y)),
      )
    : [];
  if (p.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    twice += num(a.x) * num(b.y) - num(b.x) * num(a.y);
  }
  // Absolute, so a shape drawn anticlockwise measures the same as clockwise.
  return round2(Math.abs(twice) / 2);
}

/** Perimeter of a drawn polygon in feet — what edge restraint is bought by. */
export function polygonPerimeterFt(points) {
  const p = Array.isArray(points)
    ? points.filter(
        (q) =>
          q && Number.isFinite(Number(q.x)) && Number.isFinite(Number(q.y)),
      )
    : [];
  if (p.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    total += Math.hypot(num(b.x) - num(a.x), num(b.y) - num(a.y));
  }
  return round2(total);
}
