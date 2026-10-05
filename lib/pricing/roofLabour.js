// lib/pricing/roofLabour.js
//
// How many crew-hours a roof takes. Pure arithmetic — no rates, no I/O, no
// React — so it runs against hostile input in scripts/check-trade-labour.mjs,
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
 * The FACTORS walkable 1.00 and moderate 1.30 are the reference calculator's,
 * unchanged, so a company that has been quoting off that calculator gets the
 * same pitch answer and can see the difference is coming from tear-off and
 * details, not from a number moved under them. Moderate also matches the
 * Craftsman book: Craftsman NRI 2018 p.339, "+35% labour at 6/12–8/12".
 *
 * STEEP AND VERY STEEP moved on 2026-10-05 (owner: "fix the mismatches using
 * their numbers as reference"), both to the book's figure:
 *   Craftsman NRI 2018 p.339, "add 50% labour above 8/12" → ×1.50
 * The reference calculator's steep 1.60 and FieldQuo's own >12/12 2.00 both
 * sat above it — 2.00 by a third. Steep moved WITH very steep, because a
 * ladder in which a 14/12 roof is quicker than an 11/12 one would be a bug,
 * and the book prints one figure for everything above 8/12. Above 12/12 the
 * access, not the slope, is what costs more: that is the roofing complexity
 * factors' job (lib/pricing/complexity/roofing.js), and the warning below
 * still asks for the access to be confirmed.
 *
 * Every factor is editable per company on the roofing rate card
 * (labour.pitchFactor.<band key>); these are the presets.
 *
 * The BOUNDARIES moved once, on 2026-09-18, and the reason is written up in
 * docs/research/ROOFING-RATES-2026.md. The bands used to start "moderate" at
 * 6/12, which put a 6/12 roof — the single most common pitch in the Ottawa
 * housing stock — on a 1.3× labour factor and a 10% sell surcharge. Nobody
 * else draws the line there:
 *
 *   - Xactimate, the pricing every insurance re-roof in North America is
 *     settled on, charges RFG STEEP from 7/12 to 9/12, STEEP> from 10/12 to
 *     12/12 and STEEP>> above that; a 6/12 is standard labour.
 *   - Piece-rate roofing payroll runs a standard rate for 2/12–6/12 and
 *     +15–20% for 7/12–9/12 (PieceWorkPro, March 2025).
 *   - Real GTA quotes spec "3 ft of ice and water at all eaves 6/12 pitch and
 *     less" — 6/12 is the ordinary roof, not the steep one.
 *   - Our OWN public estimator, steepnessTier() in
 *     lib/measure/roofMeasurement.js, already read 6/12 as "standard" and
 *     7–9 as "moderate", so the homeowner's instant price carried no
 *     surcharge on a roof the office builder then surcharged 10%. Two
 *     tables that disagreed on day one, which is the exact thing the price
 *     book comment says must never happen.
 *
 * So: walkable now runs to 6/12, moderate is 7–9/12, steep is 10–12/12. The
 * band KEYS did not change, so every steepnessSurcharge override a company
 * saved still applies to the band it was saved against.
 *
 * Two bands the reference calculator has no opinion on:
 *
 *   ≤2/12  0.90  Low slope. Easy footing, but shingles are out of spec below
 *                2/12 and the underlayment requirements go up, so the discount
 *                is small — not the 0.7 that "it's nearly flat" suggests.
 *   >12/12 1.50  Craftsman NRI 2018 p.339, +50% above 8/12. WAS 2.00 ("the
 *                published range is 1.8–2.0") — a third above the book.
 *
 * Bands are inclusive of maxRise: 6/12 is walkable, 7/12 is moderate.
 */
export const PITCH_BANDS = [
  { maxRise: 2, factor: 0.9, key: "low_slope", label: "Low slope (≤2/12)" },
  { maxRise: 6, factor: 1.0, key: "walkable", label: "Walkable (3–6/12)" },
  { maxRise: 9, factor: 1.3, key: "moderate", label: "Moderate (7–9/12)" },
  // Craftsman NRI 2018 p.339, "add 50% labour above 8/12" → ×1.50 (WAS 1.6)
  { maxRise: 12, factor: 1.5, key: "steep", label: "Steep (10–12/12)" },
  {
    maxRise: Infinity,
    // Craftsman NRI 2018 p.339, "add 50% labour above 8/12" → ×1.50 (WAS 2.0)
    factor: 1.5,
    key: "very_steep",
    label: "Very steep (>12/12)",
  },
];

/** The pitch factors as an editable map — what the rate card overrides. */
export const PITCH_FACTORS = Object.freeze(
  Object.fromEntries(PITCH_BANDS.map((b) => [b.key, b.factor])),
);

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
 * Starting labour constants, in LABOUR-hours — paid person-hours, one roofer
 * for one hour. NOT crew-hours: roofCrewDays() below divides these by the
 * head count to get the crew's time, and the cost panel multiplies them by
 * one person's rate. (This comment said "crew-hours" until 2026-10-05; the
 * maths always treated them as labour-hours, which is also how the Craftsman
 * books print theirs — "manhours".) Every one is editable in the price book —
 * these are mid-market figures for a competent residential crew, not a claim
 * about any particular company.
 *
 * ── How these were calibrated against the reference calculator ─────────────
 *
 * That calculator's 2.0 h/square is ALL-IN: it is the whole re-roof, tear-off
 * included, because it has no other component to put the strip in. So 2.0 is
 * not comparable to any single number here. What it is comparable to is the
 * sum of the three things it can plausibly be covering:
 *
 *     install 1.4 + underlayment 0.2 + strip one layer 0.5  =  2.1 h/sq
 *
 * 5% apart, which is close enough to say the two models agree about the field
 * work. Everything past that — valleys, chimney, ridge vent, dump runs, set-up
 * — is work the reference model has no way to charge for, and it is why a real
 * job here lands 1.5–1.8× its answer. That gap is the point of the exercise,
 * not a disagreement about how fast a roofer nails a shingle.
 *
 * What crews actually report, all-in and tear-off included, is 1.5–2.7 crew-
 * hours per square on a walkable one-storey (a six-man crew doing 30 sq in a
 * 10–12 h day; nine people doing a 31-sq north-east house in one day; two
 * people at 6 sq/day), with the older "published 2.5–3.5" band sitting above
 * the production crews and below a two-man outfit on a cut-up hip. A simple
 * walkable roof costed here lands at 2.8 h/sq and a cut-up two-storey well
 * above 3, which is the behaviour a per-square rate cannot produce at all.
 * Every one of those figures is cited in docs/research/ROOFING-RATES-2026.md;
 * a company whose crew is faster edits installPerSquare and the tear-off
 * constants on the rate card, and the days-on-site follow.
 */
export const ROOF_LABOUR_DEFAULTS = {
  // ── Field work, per roofing square (100 sqft of SLOPED area) ────────────
  // One roofer lays roughly 5–6 squares of architectural shingle in a day on a
  // walkable roof. 1.4 is that, rounded toward the slower end.
  installPerSquare: 1.4,
  // Underlayment: felt or SYNTHETIC only. Ice-and-water has its own line
  // (iceWaterPerLf), so this figure may not carry it — which is why the old
  // 0.2 (2.5–4x the book, defensible only as "synthetic plus ice-and-water")
  // could not stand beside that line.
  // Craftsman NRR 2018 p.359–360, laminated shingles over deck incl. felt 1.21 − over existing roofing 1.13 → 0.08 mh/sq
  // A synthetic roll covers ten squares to felt's four, so the book's felt
  // figure is, if anything, generous for synthetic. WAS 0.2.
  underlaymentPerSquare: 0.08,
  // Tear-off. The first layer costs the most: it carries the setup of the strip
  // itself. Each further layer is faster per layer but never free.
  //
  // Calibrated 2026-10-05 to the Craftsman books (owner: "fix the mismatches
  // using their numbers as reference"). The crew reports behind the old 0.5
  // (0.27–0.6 h/sq, docs/research/ROOFING-RATES-2026.md §1) are production
  // strip crews; every Craftsman book is 1.7–2.7x that, because it includes
  // carrying the debris to the bin.
  // Craftsman NRR 2018 p.359, "remove 3-tab to deck" LB 0.85 Lg / 1.00 Sm → 1.00 mh/sq (NRI 2018 p.339 1D@1.02)
  tearOffFirstLayerPerSquare: 1.0,
  // Craftsman NHI 2026 p.34, asphalt tear-off "double layer" BL@2.00 − "single layer" 1.33 → 0.67 mh/sq
  tearOffAdditionalLayerPerSquare: 0.67,
  // The FIRST layer when it is not asphalt — the takeoff's tearOffMaterial.
  // NHI's own asphalt row is 1.33, so these are NHI's figures as printed,
  // not scaled to the 1.0 above.
  tearOffPerSquareByMaterial: {
    // Craftsman NHI 2026 p.34, tear-off "wood shingle" → 2.02 mh/sq
    wood: 2.02,
    // Craftsman NHI 2026 p.34, tear-off "slate" → 1.79 mh/sq (NRI 2018 p.340 prints 3.70)
    slate: 1.79,
    // Craftsman NHI 2026 p.34, tear-off "clay or concrete tile" → 1.65 mh/sq
    tile: 1.65,
    // Craftsman NHI 2026 p.34, tear-off "built-up roofing" → 1.50 mh/sq
    built_up: 1.5,
  },
  deckSheetHours: 0.4, // per 4×8 sheet of replacement sheathing

  // ── Linear details, per foot ───────────────────────────────────────────
  iceWaterPerLf: 0.02,
  // Craftsman NCE 2018 p.267, "drip edge or roof edge, 10'" SW@.350 → 0.035 mh/LF (WAS 0.012)
  dripEdgePerLf: 0.035,
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
  // A roofing job is never shorter than this, however small: a crew that
  // turns up has loaded, driven, set ladders and cleaned up.
  // Craftsman NRI 2018 p.339, "minimum charge per roofing job" 6R@5.50 → 5.5 mh (2.50 for a shingle repair)
  jobMinimumHours: 5.5,

  // ── Materials the roofing book does not sell ───────────────────────────
  // Tile, slate and fibre-cement have no SELL rate in the book (no source to
  // set one from), so they are not on the takeoff's material list. The
  // drawing read still meets them on a spec sheet, and times them from these
  // — install hours as a multiple of installPerSquare, the same rule a book
  // material's labourFactor follows (lib/planRead/tradePricing.js).
  materialLabourFactor: {
    // Craftsman NCE 2018 p.261, "concrete tile" R1@4.25 per sq ÷ installPerSquare 1.4 → ×3.04
    concrete_tile: 3.04,
    // Craftsman NCE 2018 p.261, "clay S-tile" R1@4.50 per sq ÷ 1.4 → ×3.21 (2-piece mission 5.84 → ×4.17)
    clay_tile: 3.21,
    // Craftsman NRI 2018 p.340, "slate" 6R@4.00 per sq ÷ 1.4 → ×2.86
    slate: 2.86,
    // Craftsman NCE 2018 p.261, "fiber-cement slate" R1@5.50–7.00 per sq (mid 6.25) ÷ 1.4 → ×4.46
    fiber_cement_slate: 4.46,
  },
  // Craftsman NCE 2018 p.262, "load tile onto roof" R1@.822 → 0.822 mh/sq (tile materials only)
  tileLoadingPerSquare: 0.822,

  // Pitch, per band — the presets are PITCH_BANDS' factors (see there).
  pitchFactor: { ...PITCH_FACTORS },

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
    // The same one-level merge for the three maps added 2026-10-05: a company
    // that edits the slate strip must not lose the tile one.
    tearOffPerSquareByMaterial: {
      ...ROOF_LABOUR_DEFAULTS.tearOffPerSquareByMaterial,
      ...(o.tearOffPerSquareByMaterial || {}),
    },
    materialLabourFactor: {
      ...ROOF_LABOUR_DEFAULTS.materialLabourFactor,
      ...(o.materialLabourFactor || {}),
    },
    pitchFactor: {
      ...ROOF_LABOUR_DEFAULTS.pitchFactor,
      ...(o.pitchFactor || {}),
    },
  };
}

/** Tile materials carry the loading-onto-the-roof hours. */
export const TILE_MATERIAL_KEYS = Object.freeze(["concrete_tile", "clay_tile"]);

/** What a first-layer tear-off can be stripping: asphalt (the default, at
 *  tearOffFirstLayerPerSquare) or one of tearOffPerSquareByMaterial. */
export const TEAR_OFF_MATERIALS = Object.freeze(["asphalt", "wood", "slate", "tile", "built_up"]);

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
  // The company's own factor for the band when it has one (rate card), else
  // the band's preset. A zero or nonsense override falls back, never zeroes
  // the roof.
  const ownPitch = positive(own(r.pitchFactor, band.key));
  const pitch = { rise, factor: ownPitch > 0 ? ownPitch : band.factor, key: band.key, label: band.label };

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
  // remembering a second table exists. A material the book does not sell
  // (tile, slate, fibre-cement — the drawing read meets them) takes its factor
  // from the labour block's materialLabourFactor instead.
  const labourOnlyFactor = positive(own(r.materialLabourFactor, c.materialKey));
  const materialFactor =
    positive(material?.labourFactor) > 0
      ? positive(material.labourFactor)
      : labourOnlyFactor > 0
        ? labourOnlyFactor
        : 1;

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
  if (TILE_MATERIAL_KEYS.includes(c.materialKey)) {
    add(
      "tile_loading",
      "Load tile onto the roof",
      squares * positive(r.tileLoadingPerSquare),
      `${squares} sq`,
    );
  }

  if (layers > 0) {
    // The first layer by what it is: asphalt (the default) at the first-layer
    // rate, or wood, slate, tile or built-up at the material's own rate.
    const stripped = own(r.tearOffPerSquareByMaterial, c.tearOffMaterial);
    const firstRate =
      positive(stripped) > 0
        ? positive(stripped)
        : positive(r.tearOffFirstLayerPerSquare);
    const first = squares * firstRate;
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

  // The job minimum (Craftsman NRI's per-job floor): a small roof is topped
  // up to it, and the top-up is its own row so nobody mistakes it for work.
  const subtotal = onRoofHours + fixed.reduce((s, i) => s + i.hours, 0);
  const minimum = positive(r.jobMinimumHours);
  if (minimum > subtotal) {
    fixed.push({
      key: "job_minimum",
      label: "Job minimum",
      hours: minimum - subtotal,
      detail: `${minimum} h per job`,
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
