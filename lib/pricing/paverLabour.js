// lib/pricing/paverLabour.js
//
// How many crew-hours an interlock job takes. Pure arithmetic — no rates, no
// I/O, no React — so it runs against hostile input in a check script.
//
// ── What this replaces, and why ─────────────────────────────────────────────
//
// The paving book shipped with a single number, `labourHoursPerSqft: 0.12`,
// derived from a real job: Custom Interlocking at 636 Mikinak Rd, 1,220 sqft of
// pure interlock, "6 Days to complete", which at a three-person crew on
// eight-hour days is 144 crew-hours, or 0.118 h/sqft. Gardocki puts the same
// work at 0.080–0.092, a second published model at 0.10–0.12, and piece-rate
// quotes span 0.08–0.16. So the NUMBER is well corroborated.
//
// What is wrong is the SHAPE. Two things a flat per-square-foot rate cannot
// express, both of which move a real quote further than the rate itself does:
//
//   1. NO FIXED COMPONENT. Floating a machine in and out, protecting the site,
//      loading and returning tools happen once, whether the patio is 300 sqft
//      or 3,000. Gardocki's own figures put roughly 12.5 of 40 crew-hours on a
//      500 SF job into travel, setup, cleanup and estimating — a third of it.
//      A pure per-sqft rate is therefore wrong at BOTH ends: it underquotes
//      small jobs and overquotes large ones. Costed here, the same constants
//      give 0.150 h/sqft on a 300 sqft patio, 0.119 on the 1,220 sqft anchor
//      job, and 0.112 on a 3,000 sqft one.
//
//   2. DEPTH IS INVISIBLE TO IT. Excavation, disposal and base placement are
//      VOLUME work, and an Ottawa driveway carries 18" of base against a
//      patio's 12". Priced per square foot of surface, a driveway and a patio
//      of the same area cost the same hours; priced per cubic yard, the
//      driveway costs 50% more spoil to dig, haul and replace, which is what
//      actually happens. Volumes come from lib/pricing/paverTakeoff.js so the
//      hours and the material order can never disagree about how deep the hole
//      is.
//
// ── The complexity tier is READ, not asked again ────────────────────────────
//
// The estimator has already chosen standard / moderate / high, and already
// ticked "poor access" and "curves and cuts". Asking a second time in
// different words — "how hard is the labour?" — is how two answers to the same
// question end up on one quote, disagreeing. Every multiplier below is keyed
// to a field the takeoff already carries.
//
// MODERATE IS THE REFERENCE, not standard. The constants are measured on the
// Custom Interlocking job, and that job is what anchors the book's `moderate`
// price tier — 12" excavation in three compacted lifts, snap edge, polymeric
// sand, geotextile, grading and seed. Calibrating at standard and multiplying
// up would have moved the anchor off its own measurement.

import { baseMaterials } from "@/lib/pricing/paverTakeoff";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const positive = (v) => {
  const n = num(v);
  return n > 0 ? n : 0;
};
const roundTo = (n, places) => {
  const v = num(n);
  if (!Number.isFinite(v)) return 0;
  const scale = 10 ** places;
  return Math.abs(v) > 1e12 ? v : Math.round(v * scale) / scale;
};
const round1 = (n) => roundTo(n, 1);
const round2 = (n) => roundTo(n, 2);

// Own-property lookup — a tier name arrives from stored JSON, and
// MAP["__proto__"] is truthy on any plain object.
const own = (map, key) =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export const PAVER_LABOUR_DEFAULTS = {
  // ── Fixed, per job. Complexity does NOT scale this: floating an excavator
  // in and out takes the same afternoon on an easy site as on a hard one.
  mobilisationHours: 8,

  // ── Volume work, per cubic yard ────────────────────────────────────────
  excavationHoursPerCuYd: 0.35, // machine digging, one hand trimming
  baseHoursPerCuYd: 0.3, // spreading granular, lift by lift
  liftHours: 1.0, // plate setup and pass, per compacted lift
  liftDepthIn: 4, // a lift nobody can compact through is not a lift

  // Haul-away. Also NOT complexity-scaled — a round trip to the pit is a round
  // trip whatever the patio looks like.
  haulHoursPerLoad: 1.5,
  cuYdPerLoad: 12,

  // ── Area work, per square foot ─────────────────────────────────────────
  beddingHoursPerSqft: 0.006, // screeding sand
  layHoursPerSqft: 0.062, // the big one: laying and cutting in
  polySandHoursPerSqft: 0.004,
  cleanupHoursPerSqft: 0.003,
  removeExistingHoursPerSqft: 0.02, // breaking out an old surface first

  // ── Linear and face work ───────────────────────────────────────────────
  edgeRestraintHoursPerLf: 0.03,
  // Retaining and garden walls. A two-person crew builds roughly 50 square
  // feet of wall face in a day, which is where 0.32 comes from. The book
  // prices walls by face area for the same reason: the INW invoice does.
  wallHoursPerFaceSqft: 0.32,

  // ── Multipliers, every one read from a field the takeoff already has ───
  complexityLabour: { standard: 0.9, moderate: 1.0, high: 1.2 },
  // The book's own caveat, encoded: "the published rates assume at least 500
  // sqft and 3 ft of machine access; below that every contractor says the rate
  // goes up". Below that access everything is barrowed by hand.
  poorAccessFactor: 1.25,
  // Curves and cuts slow LAYING and nothing else — the hole is the same hole.
  curvesCutsFactor: 1.1,

  // Paving days run long, but nobody screeds sand at seven in the evening.
  productiveHoursPerDay: 8,
  // Crew size is not free division, for the same reasons as roofing: a lone
  // installer does his own barrowing, and past four bodies a residential back
  // yard runs out of room, plate and one wheelbarrow route.
  crewEfficiency: { 1: 1.2, 2: 1.05, 3: 1.0, 4: 1.05, 5: 1.12, 6: 1.2 },
};

/** Merge company overrides over the defaults, one level deep for the maps. */
export function paverLabourRates(overrides) {
  const o = overrides && typeof overrides === "object" ? overrides : {};
  return {
    ...PAVER_LABOUR_DEFAULTS,
    ...o,
    complexityLabour: {
      ...PAVER_LABOUR_DEFAULTS.complexityLabour,
      ...(o.complexityLabour || {}),
    },
    crewEfficiency: {
      ...PAVER_LABOUR_DEFAULTS.crewEfficiency,
      ...(o.crewEfficiency || {}),
    },
  };
}

/**
 * Perimeter of a surface, for edge restraint, when nobody has drawn one.
 *
 * The paver designer reports a real polygon perimeter and that is always
 * preferred. This is the fallback: a square of area A has perimeter 4√A, and
 * real yards are never square, so 4.4√A is the stated approximation. It is
 * labelled as estimated in the breakdown rather than presented as a
 * measurement.
 */
export function estimatedPerimeterFt(areaSqft) {
  const a = positive(areaSqft);
  return a > 0 ? round1(4.4 * Math.sqrt(a)) : 0;
}

/**
 * Crew-hours for an interlock job, itemised.
 *
 * @param {object} config  the paving takeoff
 * @param {object} [rates] price-book labour block; defaults fill any gap
 * @returns {{hours:number, breakdown:Array, sqft:number, hoursPerSqft:number,
 *            fixedHours:number, onSiteHours:number, complexity:object,
 *            incomplete:boolean, warnings:string[]}}
 */
export function paverLabour(config, rates) {
  const r = paverLabourRates(rates);
  const c = config && typeof config === "object" ? config : {};
  const warnings = [];

  // Each surface is costed at ITS OWN base depth. A driveway and a patio of
  // the same area are not the same hole, and averaging them is how a driveway
  // quote loses a day of digging.
  const surfaces = [
    ["patio", positive(c.patioSqft)],
    ["walkway", positive(c.walkwaySqft)],
    ["driveway", positive(c.drivewaySqft)],
  ].filter(([, sqft]) => sqft > 0);

  const sqft = surfaces.reduce((s, [, a]) => s + a, 0);
  const wallFaceSqft = positive(c.wallFaceSqft);

  const tierKey = own(r.complexityLabour, c.complexityLevel) !== undefined
    ? c.complexityLevel
    : "moderate";
  const tier = positive(own(r.complexityLabour, tierKey)) || 1;
  const access = c.poorAccess ? positive(r.poorAccessFactor) || 1 : 1;
  const complexity = {
    tier: tierKey,
    tierFactor: round2(tier),
    accessFactor: round2(access),
    // Multiplied together and reported, so an estimator can see that a "high"
    // job with poor access is running at 1.5x and decide whether that is what
    // they meant.
    combined: round2(tier * access),
  };

  if (sqft <= 0 && wallFaceSqft <= 0) {
    return {
      hours: 0,
      sqft: 0,
      breakdown: [],
      complexity,
      fixedHours: 0,
      onSiteHours: 0,
      hoursPerSqft: 0,
      incomplete: true,
      warnings: ["Enter an area before the hours mean anything."],
    };
  }

  // ── Volumes, from the one quantity engine ──────────────────────────────
  let spoilCuYd = 0;
  let baseCuYd = 0;
  let lifts = 0;
  for (const [surface, area] of surfaces) {
    const mats = baseMaterials({
      areaSqFt: area,
      surface,
      frostRegion: c.frostRegion !== false,
    });
    // The hole is the finished base plus the bedding sand plus the paver, which
    // baseMaterials reports as depth. Spoil is the LOOSE volume dug out, so the
    // compaction factor that pads the gravel ORDER is divided back out here —
    // you dig the hole once, you just buy 20% more stone to fill it.
    const depthIn = num(mats.gravelDepthIn) + num(mats.sandDepthIn);
    spoilCuYd += (area * depthIn) / 12 / 27;
    baseCuYd += num(mats.gravelCuYd);
    lifts = Math.max(
      lifts,
      Math.ceil(num(mats.gravelDepthIn) / (positive(r.liftDepthIn) || 4)),
    );
  }

  const perimeterFt =
    positive(c.perimeterFt) > 0
      ? positive(c.perimeterFt)
      : estimatedPerimeterFt(sqft);

  // ── The work ───────────────────────────────────────────────────────────
  const scaled = []; // complexity and access apply
  const flat = []; // they do not
  const add = (list, key, label, hours, detail) => {
    const h = positive(hours);
    if (h > 0) list.push({ key, label, hours: h, detail });
  };

  add(flat, "mobilisation", "Mobilise and demobilise", r.mobilisationHours, "fixed, per job");

  if (c.removeExisting) {
    add(
      scaled,
      "remove_existing",
      "Break out the existing surface",
      sqft * positive(r.removeExistingHoursPerSqft),
      `${round1(sqft)} sqft`,
    );
  }

  add(
    scaled,
    "excavation",
    "Excavate",
    spoilCuYd * positive(r.excavationHoursPerCuYd),
    `${round1(spoilCuYd)} cu yd`,
  );

  const loads =
    positive(r.cuYdPerLoad) > 0 ? Math.ceil(spoilCuYd / positive(r.cuYdPerLoad)) : 0;
  add(
    flat,
    "disposal",
    "Haul spoil away",
    loads * positive(r.haulHoursPerLoad),
    `${loads} load${loads === 1 ? "" : "s"}`,
  );

  add(
    scaled,
    "base",
    "Place granular base",
    baseCuYd * positive(r.baseHoursPerCuYd),
    `${round1(baseCuYd)} cu yd`,
  );
  add(
    flat,
    "compaction",
    "Compact in lifts",
    lifts * positive(r.liftHours),
    `${lifts} lift${lifts === 1 ? "" : "s"}`,
  );
  add(
    scaled,
    "bedding",
    "Screed bedding sand",
    sqft * positive(r.beddingHoursPerSqft),
    `${round1(sqft)} sqft`,
  );

  // Laying is the only operation curves and cuts touch: the hole is the same
  // hole whether the edge is straight or a radius.
  const cuts = c.curvesCuts ? positive(r.curvesCutsFactor) || 1 : 1;
  add(
    scaled,
    "lay",
    "Lay and cut in pavers",
    sqft * positive(r.layHoursPerSqft) * cuts,
    c.curvesCuts
      ? `${round1(sqft)} sqft, curves and cuts x${round2(cuts)}`
      : `${round1(sqft)} sqft`,
  );
  add(
    scaled,
    "edge",
    "Edge restraint",
    perimeterFt * positive(r.edgeRestraintHoursPerLf),
    positive(c.perimeterFt) > 0
      ? `${round1(perimeterFt)} lf`
      : `${round1(perimeterFt)} lf, estimated from the area`,
  );
  add(
    scaled,
    "walls",
    "Build walls and steps",
    wallFaceSqft * positive(r.wallHoursPerFaceSqft),
    `${round1(wallFaceSqft)} sqft of face`,
  );
  add(
    scaled,
    "poly_sand",
    "Polymeric sand and final compaction",
    sqft * positive(r.polySandHoursPerSqft),
    `${round1(sqft)} sqft`,
  );
  add(
    scaled,
    "cleanup",
    "Grade, clean and hand over",
    sqft * positive(r.cleanupHoursPerSqft),
    `${round1(sqft)} sqft`,
  );

  const factor = tier * access;
  const onSiteHours = scaled.reduce((s, i) => s + i.hours, 0) * factor;
  const fixedHours = flat.reduce((s, i) => s + i.hours, 0);
  const hours = onSiteHours + fixedHours;

  if (sqft > 0 && sqft < 500 && !c.poorAccess) {
    warnings.push(
      "Under 500 sqft the published rates stop applying — check access and your minimum before quoting this.",
    );
  }
  if (loads > 6) {
    warnings.push(
      `${loads} truckloads of spoil. Confirm the tipping fee and whether a bin on site beats round trips.`,
    );
  }

  const breakdown = [
    ...scaled.map((i) => ({ ...i, hours: round2(i.hours * factor), scaled: true })),
    ...flat.map((i) => ({ ...i, hours: round2(i.hours), scaled: false })),
  ];

  return {
    hours: round2(hours),
    sqft: round2(sqft),
    breakdown,
    complexity,
    spoilCuYd: round1(spoilCuYd),
    baseCuYd: round1(baseCuYd),
    perimeterFt: round1(perimeterFt),
    fixedHours: round2(fixedHours),
    onSiteHours: round2(onSiteHours),
    // The figure the flat rate used to be. Kept so it can be sanity-checked
    // against the 0.08–0.16 published spread — and so the fixed component is
    // visible as this number moving with job size.
    hoursPerSqft: sqft > 0 ? round2(hours / sqft) : 0,
    incomplete: false,
    warnings,
  };
}

/** Crew-hours and days. Same shape and same reasoning as roofCrewDays. */
export function paverCrewDays(totalHours, { crewSize = 3, rates, hoursPerDay } = {}) {
  const r = paverLabourRates(rates);
  const hours = positive(totalHours);
  const size = Math.max(1, Math.floor(num(crewSize)) || 1);
  const eff =
    positive(own(r.crewEfficiency, String(size))) ||
    positive(own(r.crewEfficiency, size)) ||
    positive(own(r.crewEfficiency, 6)) ||
    1;
  const adjusted = hours * eff;
  const crewHours = adjusted / size;
  const perDay = positive(hoursPerDay) || positive(r.productiveHoursPerDay) || 8;
  return {
    crewSize: size,
    crewEfficiency: round2(eff),
    labourHours: round2(adjusted),
    crewHours: round1(crewHours),
    hoursPerDay: perDay,
    days: hours > 0 ? Math.max(0.5, Math.round((crewHours / perDay) * 10) / 10) : 0,
  };
}
