// lib/pricing/insulation.js
//
// How much insulation a job needs, and how long it takes to put in. Pure —
// no rates, no I/O, no React — so it runs against hostile input in a script.
//
// ── Why insulation cannot be quoted per square foot ─────────────────────────
//
// Every other area trade covers a surface once. Insulation fills a DEPTH, and
// the depth is not a preference — it is arithmetic:
//
//     inches needed = (target R − existing R) ÷ the material's R per inch
//
// Two attics of identical area, one bare and one with four inches already in
// it, are not the same job and are not the same price. A $/sqft rate cannot
// tell them apart, which is why the published $1.65–$3.80 per square foot for
// blown-in is a band four numbers wide: it is quietly averaging over depth.
// Priced per square foot PER POINT OF R ADDED, the band collapses and the
// existing insulation stops being invisible.
//
// ── The targets are ENERGY STAR's, and the zone is asked, never assumed ─────
//
// ENERGY STAR's attic recommendation is R30 in Zone 1, R49 in Zones 2–3 and
// R60 in Zones 4–8 for an UNINSULATED attic, dropping to R25 / R38 / R49 where
// three to four inches are already there. Floors run R13 to R38 by zone.
//
// The zone is a required input with no default. Ottawa is Zone 6 and Miami is
// Zone 1, and an R60 recommendation printed on a Florida quote — or an R30 one
// on an Ottawa quote — is a number the contractor will have to defend. Check
// the IECC map; do not infer it from a postal code this file cannot see.
//
// ── Radiant barrier deliberately has no R per inch ──────────────────────────
//
// Foil products resist radiant heat by emissivity, not by conduction, and
// their effective R depends on the air gap and the assembly around them. Any
// single "R per inch" for foil is marketing. It is sold here by the square
// foot with no depth calculation at all, and the takeoff says so.

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

const own = (map, key) =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export const CLIMATE_ZONES = [
  { value: "1", label: "Zone 1 — southern Florida, Hawaii" },
  { value: "2", label: "Zone 2 — Gulf coast, southern Texas" },
  { value: "3", label: "Zone 3 — southern US" },
  { value: "4", label: "Zone 4 — mid-Atlantic, Pacific northwest" },
  { value: "5", label: "Zone 5 — Great Lakes, New England, southern Ontario" },
  { value: "6", label: "Zone 6 — Ottawa, Montreal, northern New England" },
  { value: "7", label: "Zone 7 — northern Prairies, northern Quebec" },
  { value: "8", label: "Zone 8 — far north" },
];

/**
 * ENERGY STAR recommended R, by zone and by what is being insulated.
 *
 * `attic` is the uninsulated figure; `atticTopUp` is the same table's
 * recommendation where three to four inches are already present. Both are
 * carried rather than one being derived, because they are two published rows
 * and the difference between them is not a constant.
 */
export const ENERGY_STAR_TARGETS = {
  1: { attic: 30, atticTopUp: 25, floor: 13 },
  2: { attic: 49, atticTopUp: 38, floor: 13 },
  3: { attic: 49, atticTopUp: 38, floor: 19 },
  4: { attic: 60, atticTopUp: 49, floor: 19 },
  5: { attic: 60, atticTopUp: 49, floor: 30 },
  6: { attic: 60, atticTopUp: 49, floor: 30 },
  7: { attic: 60, atticTopUp: 49, floor: 38 },
  8: { attic: 60, atticTopUp: 49, floor: 38 },
};

/**
 * The recommended R for an assembly in a zone.
 *
 * Returns null — not a number — when the zone is unknown. Absence of a
 * recommendation is not a recommendation of zero, and printing "R0 recommended"
 * on a quote because a dropdown was left blank is worse than printing nothing.
 *
 * `existingDepthIn` picks the top-up row: ENERGY STAR's lower targets apply
 * where three to four inches are already in place, and applying the bare-attic
 * figure to an attic that has some is how a top-up gets over-quoted.
 */
export function recommendedR(zone, assembly = "attic", existingDepthIn = 0) {
  const row = own(ENERGY_STAR_TARGETS, String(zone));
  if (!row) return null;
  if (assembly === "floor") return row.floor;
  if (assembly !== "attic") return null;
  return positive(existingDepthIn) >= 3 ? row.atticTopUp : row.attic;
}

/**
 * Depth of material to reach a target R.
 *
 * @returns {{inches:number, addedR:number, existingR:number, capped:boolean}}
 *          `capped` means the cavity could not hold the depth the target asks
 *          for — a 5.5" wall cavity cannot reach R38 in fibreglass batt, and a
 *          quote that says it does is a quote that lies.
 */
export function depthForTarget({
  targetR,
  existingR = 0,
  existingDepthIn = 0,
  rPerInch,
  maxDepthIn = 0,
}) {
  const perInch = positive(rPerInch);
  if (perInch <= 0) {
    return { inches: 0, addedR: 0, existingR: 0, capped: false, unrated: true };
  }
  // Existing R is either stated outright or inferred from the depth already
  // there at the SAME material's rating. Inferring across materials would be a
  // guess dressed as a measurement, so a stated figure always wins.
  const have =
    positive(existingR) > 0
      ? positive(existingR)
      : positive(existingDepthIn) * perInch;
  const needR = Math.max(0, positive(targetR) - have);
  const raw = needR / perInch;
  const cap = positive(maxDepthIn);
  const inches = cap > 0 ? Math.min(raw, cap) : raw;
  return {
    inches: round1(inches),
    addedR: round1(inches * perInch),
    existingR: round1(have),
    capped: cap > 0 && raw > cap,
    unrated: false,
  };
}

export const INSULATION_LABOUR_DEFAULTS = {
  // Fixed, per job: rig or blower set up, hoses run, floors and finishes
  // protected, tools returned. Same reason as roofing and paving — a 400 sqft
  // attic and a 2,000 sqft one do not both amortise this away.
  mobilisationHours: 3,
  // Spray foam arrives on a truck with a proportioner that has to come up to
  // temperature and be flushed afterwards. It is its own set-up, not a bigger
  // version of a blower's.
  sprayRigSetupHours: 2.5,
  // Air sealing before anything is covered up. Skipping it and blowing over
  // the leaks is the single most common way an attic job fails to perform.
  airSealHoursPerSqft: 0.004,
  baffleHoursEach: 0.12,
  // Removing wet, compacted or contaminated existing insulation, per sqft.
  removalHoursPerSqft: 0.02,
  crewEfficiency: { 1: 1.15, 2: 1.0, 3: 1.05, 4: 1.12 },
  productiveHoursPerDay: 7.5,
};

/**
 * Material quantity and crew-hours for one insulated assembly.
 *
 * @param {object} config   the takeoff
 * @param {object} material the chosen entry from the price book
 * @param {object} [rates]  the book's labour block
 */
export function insulationTakeoff(config, material, rates) {
  const r = { ...INSULATION_LABOUR_DEFAULTS, ...(rates || {}) };
  const c = config && typeof config === "object" ? config : {};
  const sqft = positive(c.sqft);
  const warnings = [];

  if (!material || sqft <= 0) {
    return {
      sqft: 0,
      inches: 0,
      addedR: 0,
      finalR: 0,
      hours: 0,
      breakdown: [],
      incomplete: true,
      warnings: [
        sqft <= 0
          ? "Enter the area before any of this means anything."
          : "Choose a material.",
      ],
    };
  }

  // Foil has no depth calculation — see the header. It is covered once, and
  // the takeoff reports no R because claiming one would be inventing it.
  const rated = positive(material.rPerInch) > 0;
  const target =
    positive(c.targetR) > 0
      ? positive(c.targetR)
      : recommendedR(c.climateZone, c.assembly, c.existingDepthIn) || 0;

  const depth = rated
    ? depthForTarget({
        targetR: target,
        existingR: c.existingR,
        existingDepthIn: c.existingDepthIn,
        rPerInch: material.rPerInch,
        maxDepthIn: c.maxDepthIn,
      })
    : { inches: 0, addedR: 0, existingR: 0, capped: false, unrated: true };

  if (depth.capped) {
    warnings.push(
      `The cavity holds ${round1(c.maxDepthIn)}" — that is R${depth.addedR} in ${material.label}, not the R${round1(target)} asked for. Say so on the quote or change the material.`,
    );
  }
  if (rated && target > 0 && depth.inches <= 0) {
    warnings.push(
      `Already at R${depth.existingR} against a target of R${round1(target)} — there is nothing to add here.`,
    );
  }
  if (!rated) {
    warnings.push(
      "Foil products work by emissivity, not by depth. This line carries no R-value claim.",
    );
  }

  const rows = [];
  const add = (key, label, hours, detail) => {
    const h = positive(hours);
    if (h > 0) rows.push({ key, label, hours: h, detail });
  };

  add(
    "mobilisation",
    "Set up and protect",
    r.mobilisationHours,
    "fixed, per job",
  );
  if (material.sprayRig) {
    add("rig", "Rig set-up and flush", r.sprayRigSetupHours, "spray foam");
  }
  if (c.removeExisting) {
    add(
      "removal",
      "Remove existing insulation",
      sqft * positive(r.removalHoursPerSqft),
      `${round1(sqft)} sqft`,
    );
  }
  if (c.airSeal) {
    add(
      "air_seal",
      "Air seal penetrations",
      sqft * positive(r.airSealHoursPerSqft),
      `${round1(sqft)} sqft`,
    );
  }
  if (positive(c.baffles) > 0) {
    add(
      "baffles",
      "Install soffit baffles",
      Math.floor(positive(c.baffles)) * positive(r.baffleHoursEach),
      `${Math.floor(positive(c.baffles))}`,
    );
  }

  // Installation. Part of it is per square foot (walking the space, working
  // around wiring) and part is per inch of depth (the material actually going
  // in), which is why a top-up is quicker than a bare attic of the same size.
  const install =
    sqft * positive(material.hoursPerSqft) +
    sqft * depth.inches * positive(material.hoursPerSqftPerInch);
  add(
    "install",
    `Install ${material.label}`,
    install,
    rated
      ? `${round1(sqft)} sqft at ${depth.inches}"`
      : `${round1(sqft)} sqft`,
  );

  const hours = rows.reduce((s, i) => s + i.hours, 0);

  return {
    sqft: round1(sqft),
    inches: depth.inches,
    addedR: depth.addedR,
    existingR: depth.existingR,
    // What the assembly ends up at. The number the homeowner and the rebate
    // programme both care about, and the one worth printing.
    finalR: rated ? round1(depth.existingR + depth.addedR) : 0,
    targetR: round1(target),
    rated,
    capped: depth.capped,
    hours: round2(hours),
    hoursPerSqft: sqft > 0 ? round2(hours / sqft) : 0,
    breakdown: rows.map((i) => ({ ...i, hours: round2(i.hours) })),
    incomplete: false,
    warnings,
  };
}

/** Crew-hours and days. Same shape and reasoning as the roofing and paving ones. */
export function insulationCrewDays(totalHours, { crewSize = 2, rates, hoursPerDay } = {}) {
  const r = { ...INSULATION_LABOUR_DEFAULTS, ...(rates || {}) };
  const hours = positive(totalHours);
  const size = Math.max(1, Math.floor(num(crewSize)) || 1);
  const eff =
    positive(own(r.crewEfficiency, String(size))) ||
    positive(own(r.crewEfficiency, 4)) ||
    1;
  const adjusted = hours * eff;
  const crewHours = adjusted / size;
  const perDay = positive(hoursPerDay) || positive(r.productiveHoursPerDay) || 7.5;
  return {
    crewSize: size,
    crewEfficiency: round2(eff),
    labourHours: round2(adjusted),
    crewHours: round1(crewHours),
    hoursPerDay: perDay,
    days: hours > 0 ? Math.max(0.5, Math.round((crewHours / perDay) * 10) / 10) : 0,
  };
}
