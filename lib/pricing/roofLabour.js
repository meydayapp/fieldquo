// lib/pricing/roofLabour.js
//
// How many crew-hours a roof takes. Pure arithmetic — no rates, no I/O, no
// React — so it runs against hostile input in scripts/check-roof-labour.mjs,
// which is where this kind of bug actually surfaces.
//
// ── Why this is not "squares × hours/square × difficulty" ───────────────────
//
// The common calculator — including the reference one this engine was
// reconciled against — is:
//
//     labour hours = squares × 2 h/sq × pitch factor
//     crew hours   = labour hours ÷ crew size
//     days         = crew hours ÷ 8
//
// It is a good first cut, and this file keeps its pitch factors unchanged so
// the difference between the two answers is never "someone moved a number I
// was used to". Three things it cannot express, each of which moves a real
// quote by more than the pitch factor does:
//
//   1. TEAR-OFF IS MISSING. That model returns the same 20 hours for a new
//      build with bare deck and for stripping three layers of 1965 shingle off
//      the same house. Layers are ADDITIVE TO DEMOLITION, not multiplicative on
//      the job: a second layer does not make installation twice as slow, it
//      makes the strip slower. Modelled as first-layer + per-additional-layer,
//      and the debris drives dump runs, which are hours nobody bills and
//      everybody spends.
//
//   2. NO FIXED COMPONENT. Load, drive, ladders, staging, tarps, trailer
//      positioning, magnet sweep, final walk. On a 6-square garage that is most
//      of the job; on a 50-square roof it rounds to nothing. A pure per-square
//      rate is therefore wrong at BOTH ends — it underquotes small roofs and
//      overquotes large ones. This is the same correction the interlock model
//      needed, and it is the single biggest improvement available here.
//
//   3. GEOMETRY IS FREE INFORMATION AND IS BEING THROWN AWAY. Valleys, ridge,
//      hips, step flashing, skylights and chimneys are where the hours go on a
//      cut-up roof, and a 30-square simple gable and a 30-square roof with six
//      valleys and two dormers are not the same job. lib/measure/roofMeasurement
//      already returns segment count and area-weighted pitch from satellite;
//      the estimator only has to count the details.
//
// ── The one trap in the geometry ────────────────────────────────────────────
//
// `areaSqft` from lib/measure/roofMeasurement.js is the ACTUAL SLOPED SURFACE —
// Google Solar has already applied the pitch. Multiplying it by a pitch factor
// AGAIN to "account for slope" is the classic error and inflates a 10/12 roof
// by 30%. Pitch in this file only ever multiplies HOURS. The single place area
// and pitch meet is slopedAreaSqft(), which exists for the opposite case: an
// estimator who typed a FOOTPRINT off a survey and needs it converted up.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const positive = (v) => {
  const n = num(v);
  return n > 0 ? n : 0;
};
const count = (v) => Math.max(0, Math.floor(num(v)));
// Rounding that survives absurd input. `Math.round(n * 100) / 100` turns 1e307
// into Infinity on the way through — finite in, Infinity out — and stored JSON
// can hold 1e308. Past the point where cents mean anything the value is passed
// through unrounded rather than overflowed, so a nonsense roof reads as a
// nonsense number instead of silently becoming 0 or Infinity in a cost panel.
const roundTo = (n, places) => {
  const v = num(n);
  if (!Number.isFinite(v)) return 0;
  const scale = 10 ** places;
  return Math.abs(v) > 1e12 ? v : Math.round(v * scale) / scale;
};
const round1 = (n) => roundTo(n, 1);
const round2 = (n) => roundTo(n, 2);

// Own-property lookup: material and storey keys arrive from stored JSON, and
// MAP["__proto__"] is truthy on any plain object. Same guard, same reason, as
// the one in app/data/tradePriceBooks.js.
const own = (map, key) =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export const SQFT_PER_SQUARE = 100;

/**
 * Pitch → labour multiplier.
 *
 * The three middle bands ARE the reference calculator's, unchanged: walkable
 * 3–5/12 at 1.00, moderate 6–8/12 at 1.30, steep 9/12+ at 1.60. Keeping them
 * identical means a company that has been quoting off that calculator gets the
 * same pitch answer here and can see the difference is coming from tear-off and
 * details, not from a number moved under them.
 *
 * Two bands are ADDED, because that calculator has no opinion where it matters
 * most and the estimator is left applying "steep" to a 9/12 and to a 16/12:
 *
 *   ≤2/12  0.90  Low slope. Easy footing, but shingles are out of spec below
 *                2/12 and the underlayment requirements go up, so the discount
 *                is small — not the 0.7 that "it's nearly flat" suggests.
 *   >12/12 2.00  Everything is roped, staged and passed up by hand. The
 *                published range is 1.8–2.0; the top of it is the honest
 *                default because a roof that steep also has the worst access.
 *
 * Bands are inclusive of maxRise: 5/12 is walkable, 6/12 is moderate.
 */
export const PITCH_BANDS = [
  { maxRise: 2, factor: 0.9, key: "low_slope", label: "Low slope (≤2/12)" },
  { maxRise: 5, factor: 1.0, key: "walkable", label: "Walkable (3–5/12)" },
  { maxRise: 8, factor: 1.3, key: "moderate", label: "Moderate (6–8/12)" },
  { maxRise: 12, factor: 1.6, key: "steep", label: "Steep (9–12/12)" },
  {
    maxRise: Infinity,
    factor: 2.0,
    key: "very_steep",
    label: "Very steep (>12/12)",
  },
];

/** The band a rise/12 falls in. Never returns undefined — the last band is open. */
export function pitchBand(riseOver12) {
  const rise = positive(riseOver12);
  return (
    PITCH_BANDS.find((b) => rise <= b.maxRise) ||
    PITCH_BANDS[PITCH_BANDS.length - 1]
  );
}

/**
 * Footprint → sloped surface. sqrt(1 + (rise/12)²).
 *
 * ONLY for an area typed off a survey or a site plan. Anything measured from
 * satellite through lib/measure/roofMeasurement.js is already sloped and must
 * not come through here — hence the deliberate absence of a "just in case"
 * call inside roofLabour().
 */
export function slopedAreaSqft(footprintSqft, riseOver12) {
  const area = positive(footprintSqft);
  if (area <= 0) return 0;
  const slope = positive(riseOver12) / 12;
  return round1(area * Math.sqrt(1 + slope * slope));
}

/**
 * Starting labour constants, in crew-hours. Every one is editable in the price
 * book — these are mid-market figures for a competent residential crew, not a
 * claim about any particular company.
 *
 * ── How these were calibrated against the reference calculator ─────────────
 *
 * That calculator's 2.0 h/square is ALL-IN: it is the whole re-roof, tear-off
 * included, because it has no other component to put the strip in. So 2.0 is
 * not comparable to any single number here. What it is comparable to is the
 * sum of the three things it can plausibly be covering:
 *
 *     install 1.4 + underlayment 0.2 + strip one layer 0.7  =  2.3 h/sq
 *
 * 15% apart, which is close enough to say the two models agree about the field
 * work. Everything past that — valleys, chimney, ridge vent, dump runs, set-up
 * — is work the reference model has no way to charge for, and it is why a real
 * job here lands 1.5–1.8× its answer. That gap is the point of the exercise,
 * not a disagreement about how fast a roofer nails a shingle.
 *
 * Published all-in residential asphalt productivity runs about 2.5–3.5 crew-
 * hours per square including tear-off. A simple walkable roof costed here lands
 * near the bottom of that band and a cut-up two-storey near the top, which is
 * the behaviour a per-square rate cannot produce at all.
 */
export const ROOF_LABOUR_DEFAULTS = {
  // ── Field work, per roofing square (100 sqft of SLOPED area) ────────────
  // One roofer lays roughly 5–6 squares of architectural shingle in a day on a
  // walkable roof. 1.4 is that, rounded toward the slower end.
  installPerSquare: 1.4,
  underlaymentPerSquare: 0.2,
  // Tear-off. The first layer costs the most: it carries the setup of the strip
  // itself. Each further layer is faster per layer but never free.
  tearOffFirstLayerPerSquare: 0.7,
  tearOffAdditionalLayerPerSquare: 0.45,
  deckSheetHours: 0.4, // per 4×8 sheet of replacement sheathing

  // ── Linear details, per foot ───────────────────────────────────────────
  iceWaterPerLf: 0.02,
  dripEdgePerLf: 0.012,
  starterPerLf: 0.01,
  valleyPerLf: 0.1, // cut, line and weave — the slowest foot on a roof
  ridgeHipCapPerLf: 0.035,
  ridgeVentPerLf: 0.045, // includes cutting the slot
  stepFlashingPerLf: 0.06,

  // ── Penetrations, each ─────────────────────────────────────────────────
  ventBootEach: 0.35,
  boxVentEach: 0.5,
  skylightEach: 2.5,
  chimneyEach: 3.0,

  // ── Fixed and size-driven overhead ─────────────────────────────────────
  // Does NOT scale with the roof: load out, drive, set ladders and staging,
  // tarp the beds, break down at the end. Charged once per job.
  mobilisationHours: 3.5,
  cleanupPerSquare: 0.1, // debris, magnet sweep — this one does scale
  dumpRunHours: 1.5,
  squaresPerDumpRun: 20, // one trailer of single-layer asphalt

  // ── Multipliers ────────────────────────────────────────────────────────
  // Height. Every trip up and down costs more, and staging a third storey is a
  // different job from leaning a ladder on a bungalow.
  storeyFactor: { one: 1.0, two: 1.1, three_plus: 1.25 },

  // Crew size is NOT free division.
  //
  // The reference calculator divides hours by head count and stops, which says
  // one person shingles a 50-square steep roof in 20 days at exactly the same
  // total hours as four people in 5. Neither end is true: a lone roofer does
  // his own ground work with nobody feeding the roof, and past about four
  // bodies a residential roof runs out of staging, hoist and trailer. The curve
  // is modest and it is editable — set every entry to 1 to get the plain
  // division back.
  crewEfficiency: { 1: 1.15, 2: 1.0, 3: 1.02, 4: 1.06, 5: 1.12, 6: 1.2 },

  // Hours a crew actually gets on the roof in a day. Not 8: weather holds,
  // material deliveries and the last-hour tidy are real and are not in the
  // component list above.
  productiveHoursPerDay: 7.5,
};

/**
 * Merge a company's overrides over the defaults. Shallow for scalars, one level
 * deep for the two nested maps, so overriding `storeyFactor.two` does not wipe
 * `storeyFactor.one` — the same failure mode getPriceBook's array/key rule
 * exists to avoid.
 */
export function roofLabourRates(overrides) {
  const o = overrides && typeof overrides === "object" ? overrides : {};
  return {
    ...ROOF_LABOUR_DEFAULTS,
    ...o,
    storeyFactor: {
      ...ROOF_LABOUR_DEFAULTS.storeyFactor,
      ...(o.storeyFactor || {}),
    },
    crewEfficiency: {
      ...ROOF_LABOUR_DEFAULTS.crewEfficiency,
      ...(o.crewEfficiency || {}),
    },
  };
}

/**
 * Crew-hours for a roof, itemised.
 *
 * @param {object} config   the takeoff
 * @param {object} [rates]  price-book labour block; defaults fill any gap
 * @returns {{hours:number, squares:number, breakdown:Array, pitch:object,
 *            onRoofHours:number, fixedHours:number, hoursPerSquare:number,
 *            incomplete:boolean, warnings:string[]}}
 *
 * `incomplete` means the answer is not usable, not that it is zero — a cost
 * panel must be able to tell "this roof takes no time" from "nobody has said
 * how big it is yet", which is the distinction the padding-defaults failure
 * class in AGENTS.md is about.
 */
export function roofLabour(config, rates) {
  const r = roofLabourRates(rates);
  const c = config && typeof config === "object" ? config : {};
  const warnings = [];

  // Area may arrive as squares, as sloped sqft, or as a footprint the
  // estimator typed. Squares win when present because that is what a roofer
  // orders in.
  let areaSqft = positive(c.areaSqft);
  if (positive(c.squares) > 0) areaSqft = positive(c.squares) * SQFT_PER_SQUARE;
  const rise = positive(c.pitchRise);
  if (areaSqft <= 0 && positive(c.footprintSqft) > 0) {
    areaSqft = slopedAreaSqft(c.footprintSqft, rise);
  }
  const squares = round2(areaSqft / SQFT_PER_SQUARE);

  const band = pitchBand(rise);
  const pitch = { rise, factor: band.factor, key: band.key, label: band.label };

  if (squares <= 0) {
    return {
      hours: 0,
      squares: 0,
      breakdown: [],
      pitch,
      onRoofHours: 0,
      fixedHours: 0,
      hoursPerSquare: 0,
      incomplete: true,
      warnings: ["Enter the roof area before the hours mean anything."],
    };
  }

  const material = own(c.materials, c.materialKey) || null;
  // A material's labour factor rides with its rate in the price book, so a
  // company that adds standing seam sets both in one place instead of
  // remembering a second table exists.
  const materialFactor =
    positive(material?.labourFactor) > 0 ? positive(material.labourFactor) : 1;

  const storeyFactor =
    positive(own(r.storeyFactor, c.storeys)) > 0
      ? positive(own(r.storeyFactor, c.storeys))
      : r.storeyFactor.one;

  const layers = count(c.layers);

  // ── On-roof work. Pitch and storey apply to all of it. ─────────────────
  const onRoof = [];
  const add = (key, label, hours, detail) => {
    const h = positive(hours);
    if (h > 0) onRoof.push({ key, label, hours: h, detail });
  };

  add(
    "install",
    "Install",
    squares * positive(r.installPerSquare) * materialFactor,
    `${squares} sq × ${round2(positive(r.installPerSquare) * materialFactor)} h/sq`,
  );
  add(
    "underlayment",
    "Underlayment",
    squares * positive(r.underlaymentPerSquare),
    `${squares} sq`,
  );

  if (layers > 0) {
    const first = squares * positive(r.tearOffFirstLayerPerSquare);
    const extra =
      (layers - 1) * squares * positive(r.tearOffAdditionalLayerPerSquare);
    add(
      "tear_off",
      `Tear off ${layers} layer${layers === 1 ? "" : "s"}`,
      first + extra,
      layers === 1
        ? `${squares} sq`
        : `${squares} sq, first layer + ${layers - 1} more`,
    );
  }

  add(
    "deck_repair",
    "Replace sheathing",
    count(c.deckSheets) * positive(r.deckSheetHours),
    `${count(c.deckSheets)} sheet${count(c.deckSheets) === 1 ? "" : "s"}`,
  );

  const lf = [
    ["ice_water", "Ice & water membrane", c.iceWaterFt, r.iceWaterPerLf],
    ["drip_edge", "Drip edge", c.dripEdgeFt, r.dripEdgePerLf],
    ["starter", "Starter course", c.starterFt, r.starterPerLf],
    ["valley", "Valleys", c.valleyFt, r.valleyPerLf],
    ["ridge_cap", "Ridge & hip cap", c.ridgeHipFt, r.ridgeHipCapPerLf],
    ["ridge_vent", "Ridge vent", c.ridgeVentFt, r.ridgeVentPerLf],
    ["step_flashing", "Step flashing", c.stepFlashingFt, r.stepFlashingPerLf],
  ];
  for (const [key, label, ft, rate] of lf) {
    add(key, label, positive(ft) * positive(rate), `${positive(ft)} lf`);
  }

  const each = [
    ["vent_boots", "Plumbing vent boots", c.ventBoots, r.ventBootEach],
    ["box_vents", "Roof vents", c.boxVents, r.boxVentEach],
    ["skylights", "Skylight flashing", c.skylights, r.skylightEach],
    ["chimneys", "Chimney flashing", c.chimneys, r.chimneyEach],
  ];
  for (const [key, label, qty, rate] of each) {
    add(key, label, count(qty) * positive(rate), `${count(qty)}`);
  }

  const onRoofRaw = onRoof.reduce((s, i) => s + i.hours, 0);
  const onRoofHours = onRoofRaw * pitch.factor * storeyFactor;

  // ── Fixed and size-driven work. Pitch does not apply: none of it happens
  // on the slope. Storey does apply to mobilisation — staging a third storey
  // is the mobilisation.
  const fixed = [];
  const mob = positive(r.mobilisationHours) * storeyFactor;
  if (mob > 0)
    fixed.push({
      key: "mobilisation",
      label: "Set up & break down",
      hours: mob,
      detail: "fixed, per job",
    });

  const cleanup = squares * positive(r.cleanupPerSquare);
  if (cleanup > 0)
    fixed.push({
      key: "cleanup",
      label: "Debris & magnet sweep",
      hours: cleanup,
      detail: `${squares} sq`,
    });

  if (layers > 0 && positive(r.squaresPerDumpRun) > 0) {
    const runs = Math.ceil((squares * layers) / positive(r.squaresPerDumpRun));
    const dump = runs * positive(r.dumpRunHours);
    if (dump > 0)
      fixed.push({
        key: "disposal",
        label: "Dump runs",
        hours: dump,
        detail: `${runs} run${runs === 1 ? "" : "s"}`,
      });
  }

  const fixedHours = fixed.reduce((s, i) => s + i.hours, 0);
  const hours = onRoofHours + fixedHours;

  if (layers >= 3) {
    warnings.push(
      `${layers} layers is at or past what most decks were sheathed for — budget sheathing replacement, not just the strip.`,
    );
  }
  if (rise > 12) {
    warnings.push(
      "Above 12/12 the crew is roped and staged; confirm the access before this number is quoted.",
    );
  }

  const breakdown = [
    ...onRoof.map((i) => ({
      ...i,
      hours: round2(i.hours * pitch.factor * storeyFactor),
      onRoof: true,
    })),
    ...fixed.map((i) => ({ ...i, hours: round2(i.hours), onRoof: false })),
  ];

  return {
    hours: round2(hours),
    squares,
    breakdown,
    pitch,
    storeyFactor: round2(storeyFactor),
    materialFactor: round2(materialFactor),
    onRoofHours: round2(onRoofHours),
    fixedHours: round2(fixedHours),
    // The number a roofer sanity-checks against his own experience. All-in,
    // so it is NOT comparable to the reference calculator's 2 h/sq, which is
    // install only.
    hoursPerSquare: round2(hours / squares),
    incomplete: false,
    warnings,
  };
}

/**
 * Crew-hours and calendar days for a total.
 *
 * Two corrections to hours ÷ heads ÷ 8:
 *
 *   crewEfficiency  a lone roofer and a crowded roof both cost hours. See the
 *                   note on the constant.
 *   productive day  7.5, not 8. The fixed hours above already carry load-out
 *                   and break-down; what this absorbs is weather, deliveries
 *                   and the fact that nobody starts a course at ten to five.
 *
 * A job is never shorter than half a day: a crew that turns up has turned up.
 */
export function roofCrewDays(
  totalHours,
  { crewSize = 2, rates, hoursPerDay } = {},
) {
  const r = roofLabourRates(rates);
  const hours = positive(totalHours);
  const size = Math.max(1, count(crewSize) || 1);
  const eff =
    positive(own(r.crewEfficiency, String(size))) ||
    positive(own(r.crewEfficiency, size)) ||
    // Past the top of the table the congestion keeps growing rather than
    // flattening — extrapolating the last step is closer than pretending a
    // crew of ten works like a crew of six.
    positive(own(r.crewEfficiency, 6)) ||
    1;

  const adjusted = hours * eff;
  const crewHours = size > 0 ? adjusted / size : adjusted;
  const perDay =
    positive(hoursPerDay) || positive(r.productiveHoursPerDay) || 7.5;
  const days = perDay > 0 ? crewHours / perDay : 0;

  return {
    crewSize: size,
    crewEfficiency: round2(eff),
    labourHours: round2(adjusted),
    crewHours: round1(crewHours),
    hoursPerDay: perDay,
    days: hours > 0 ? Math.max(0.5, Math.round(days * 10) / 10) : 0,
  };
}
