// lib/estimate/rewireTakeoff.js
//
// A computable takeoff model for a whole-house electrical rewire. Given floor
// area, bedroom/bath count and the four access facts, it derives device count,
// circuit count, cable footage, labour hours and an internal cost range —
// so the Cost & Margin panel shows a defensible build-up instead of a $/sqft
// number somebody half-remembered.
//
// Pure. No DB, no I/O, no React. See docs/electrical-pricing-research.md for
// the sourcing behind every coefficient.
//
// ── Nothing here is client-facing ───────────────────────────────────────────
//
// This feeds the contractor's INTERNAL estimate, the same way
// app/data/materialRecipes.js does — company-overridable defaults, shown only
// in the back office. It deliberately does NOT follow defaultLineItems.js
// (which ships `rate: null` because a wrong number on a signed document is
// worse than a blank one). The distinction matters: a homeowner must never see
// output from this file, because these are national-average coefficients and
// the contractor's own labour rate is the only number that makes them true.
//
// ── Why the model counts openings instead of multiplying square feet ────────
//
// $/sqft is how rewires get advertised and it is not how they get built. Cable
// and labour are driven by DEVICE COUNT, and device count is driven by WALL
// PERIMETER — NEC 210.52(A) is a spacing rule along walls, not an area rule.
// Perimeter grows as √(area × rooms), and room count grows more slowly than
// floor area, so a 3,000 sqft home genuinely needs less wire per square foot
// than a 1,000 sqft one (≈1.43 ft/sqft vs ≈1.90). Every published $/sqft
// source applies a flat multiplier and so cannot see this; three of them
// "confirm" 1.5–2.0 ft/sqft only because all three assumed it.
//
// The opening count is also what makes the two competing pricing models agree.
// A 1,500 sqft house comes out at ~117 openings; at the widely published
// $100–300/opening that is $11,700–35,100, and a real 1,461 sqft quote of
// $21,915 sits mid-band at $194/opening. If the count were ~50 (as one
// unverified forum figure claims) the per-opening method could not reproduce
// any real quote.
//
// ── Confidence register ─────────────────────────────────────────────────────
//
// Every coefficient below is tagged. Read the tag before trusting the number:
//
//   [NEC]     Fixed by code. Not a preference, not overridable in spirit.
//   [READ]    Taken from a published source, cited inline.
//   [DERIVED] Computed or fitted by us from READ inputs. Reproducible.
//   [GUESS]   Invented. No source. Says what it was sanity-checked against.

import { safeNumber } from "@/lib/safeNumber";

// ── Code constants — NEC Article 210. These are law, not tuning knobs. ──────
// Larimer County's residential wiring guide restates each of these, which is
// why it's cited as the practical source rather than NFPA 70 (paywalled).

/** [NEC 210.52(A)] No point along a wall may be >6 ft from a receptacle, which
 *  is the same thing as a 12 ft maximum spacing. This single number generates
 *  most of the device count. */
export const NEC_RECEPTACLE_SPACING_FT = 12;

/** [NEC 210.52(A)(2)] Wall space narrower than this doesn't require a
 *  receptacle, so doorways and cabinet runs are deducted before dividing. */
export const NEC_MIN_WALL_SPACE_FT = 2;

/** [NEC 210.52(C)] One receptacle for the first 9 ft² of countertop, then one
 *  per additional 18 ft². Kitchens are counted this way rather than by the
 *  12 ft wall rule, which does not apply above a counter. */
export const NEC_COUNTER_FIRST_SQFT = 9;
export const NEC_COUNTER_ADDITIONAL_SQFT = 18;

/** [NEC 220.12] General lighting load, volt-amps per square foot. Divided by
 *  120 V and then by 15 A to get the general-purpose circuit count. Larimer
 *  states the same rule as "15 A covers ~600 sqft". */
export const NEC_GENERAL_LIGHTING_VA_PER_SQFT = 3;

/** [NEC 210.11(C)] The circuits a dwelling must have regardless of its size.
 *  These are counted before the load calculation, not instead of it. */
export const NEC_MANDATORY_CIRCUITS = {
  smallAppliance: 2, // 210.11(C)(1) — kitchen/dining, 20 A each
  laundry: 1,        // 210.11(C)(2) — 20 A
  bathroom: 1,       // 210.11(C)(3) — 20 A
  garage: 1,         // 210.11(C)(4) — 20 A, only when a garage exists
};

/** [NEC 210.52(E)] Front and back, minimum. A third is added on larger homes
 *  because they generally have more than two exterior doors — that part is a
 *  [GUESS], the floor of 2 is code. */
export const NEC_EXTERIOR_RECEPTACLES_MIN = 2;

// ── Geometry ────────────────────────────────────────────────────────────────

/** [GUESS] Typical room aspect ratio, used to turn an area into a perimeter.
 *  Sanity: at 1.25 a 144 ft² bedroom has a 48 ft perimeter, which matches a
 *  real 12×12 room (48 ft). The model is weakly sensitive to this — moving it
 *  to 1.0 or 1.6 changes total openings by under 4% — so it is not worth
 *  asking the contractor for room dimensions to improve it. */
export const ROOM_ASPECT_RATIO = 1.25;

/** [GUESS] Feet of wall removed by one door opening. Sanity: a standard
 *  interior door is 2'6"–3'0" plus casing. */
export const DOOR_BREAK_FT = 3;

/** [GUESS] Feet of wall removed by a bedroom closet opening, and by the
 *  cabinet run in a kitchen (fixed cabinets without a work surface are excluded
 *  from wall space by 210.52(A)(2), so this is code-shaped but the FOOTAGE is
 *  ours). */
export const CLOSET_BREAK_FT = 6;
export const KITCHEN_CABINET_BREAK_FT = 12;

/** [GUESS] Ratio of receptacles actually installed to the bare code minimum.
 *  Calibrated so a 12×12 bedroom lands at 5 rather than 4 — practitioner
 *  guidance is 6–8 per bedroom, code minimum computes to 4, and quoting the
 *  code minimum loses the job to whoever quoted what gets built. Companies
 *  that bid tight to code should override this to 1.0. */
export const PRACTICAL_RECEPTACLE_RATIO = 1.35;

// ── Labour ──────────────────────────────────────────────────────────────────

/** [READ] NECA Manual of Labor Units rough-in minutes per device, as published
 *  by The Fennec Lab's MLU calculator. Smoke/CO and dedicated-appliance
 *  circuits are [GUESS] — the MLU tables don't break them out separately. */
export const NECA_ROUGH_IN_MINUTES = {
  receptacle: 35,
  switch: 25,
  fixture: 45,
  circuit: 60,
  smokeCo: 30,   // [GUESS]
  dedicated: 55, // [GUESS]
};

/** [READ] Trim-out runs 30–50% of rough-in; 40% is the midpoint. Rough-in is
 *  therefore ~71% of total hours and trim ~29%. */
export const TRIM_SHARE_OF_ROUGH_IN = 0.40;

/** [DERIVED] Residential production crews beat NECA units substantially.
 *  Applying the MLU minutes above as published to a 1,461 sqft rewire predicts
 *  240 crew-hours and $33,782, against a real quote of $21,915 — 2.2× too
 *  high. NECA units are benchmarked to commercial work; this factor rescales
 *  them to residential.
 *
 *  CAUTION: fitted against ONE real quote. It is the least trustworthy number
 *  in this file and the first thing to revisit as real jobs close. The check
 *  script pins it to that quote so a silent drift fails loudly.
 *
 *  Corroboration that it is not merely fitted: at 0.456 the model predicts
 *  79 / 117 / 146 crew-hours for 1,000 / 2,000 / 3,000 sqft, and Caudill's
 *  independently published crew-day figures (3–5, 5–8, 7–10 days at 2–3 crew)
 *  convert to 48–120 / 100–160 / 140–200. All three land inside. */
export const RESIDENTIAL_PRODUCTIVITY_FACTOR = 0.456;

/** [GUESS] Crew-hours to swap the panel and re-land every circuit, on top of
 *  the per-device time. Sanity: a day for two people. */
export const PANEL_SWAP_HOURS = 8;

/** Labour multiplier by how hard the cable is to get into the wall. This is
 *  the single largest lever in the model — best to worst is 2.9× — which is
 *  why the four facts that determine it are mandatory intake.
 *
 *  [READ]    open_walls (NECA base = new construction) and light_reno
 *            (Fennec: residential renovation runs 1.1–1.3× base MLU).
 *  [DERIVED] the rest. Hammerio puts a single outlet at 30–60 min in open
 *            walls against 2–4 hours fished — a 2.5–4× penalty on the fished
 *            device alone. Blended over a whole job it lands lower, because
 *            panel work, home runs and trim don't take the full penalty.
 *            fished_drywall is anchored to the real 1,461 sqft quote. */
export const ACCESS_MULTIPLIERS = {
  open_walls: 1.00,
  light_reno: 1.15,
  fished_drywall: 1.75,
  plaster_lath: 2.35,
  knob_tube_historic: 2.90,
};

/** [GUESS] Extra labour per storey above the first — top plates to drill, a
 *  longer home-run path, attic and soffit work. Sanity: this was one of the
 *  candidate causes of the 30% shortfall against a real "Level 3" quote, and
 *  at 0.17 it closes about a third of that gap on its own. */
export const STOREY_LABOUR_UPLIFT = 0.17;

// ── Cable ───────────────────────────────────────────────────────────────────

/** [GUESS] Average cable run from one device to the next in a daisy chain.
 *  Sanity: konnworld's worked example implies 30 ft per light and 40 ft per
 *  outlet, but those are whole-circuit figures divided by device count, not
 *  hops — using them as hops double-counts the home run, which this model
 *  bills separately. */
export const DEVICE_HOP_FT = 12;

/** [GUESS] Average home run from the panel to the first device on a circuit,
 *  as a function of floor area. Grows with √area because a home run crosses
 *  the plan, plus a fixed allowance for getting into and out of the panel, plus
 *  a per-storey vertical allowance. */
export const HOME_RUN_SQRT_COEFF = 0.55;
export const HOME_RUN_BASE_FT = 15;
export const HOME_RUN_PER_STOREY_FT = 12;

/** [GUESS] Dedicated appliance circuits run further than average — they reach
 *  the far end of a kitchen, an outdoor condenser, a basement water heater. */
export const DEDICATED_RUN_FACTOR = 1.2;

/** [READ] Offcut/waste allowance. Engineerfix says 10–15%; one source says 5%,
 *  which we reject — 5% cannot be right for old work, where fished runs are cut
 *  to fit and the offcut is unusable. Open walls get the low end because cable
 *  is pulled from the reel to length. */
export const WASTE_FACTOR = { open: 0.10, fished: 0.15, default: 0.12 };

/** Cable mix by type. Two defensible splits, because the choice is regional
 *  rather than technical: SPLIT_A is US-traditional (15 A lighting and bedroom
 *  circuits on 14 AWG), SPLIT_B puts general outlets on 12 AWG throughout,
 *  which is konnworld's assumption and normal Canadian practice. The split
 *  moves material cost about 8%, so it is exposed rather than hard-coded.
 *
 *  [GUESS] the percentages — no source publishes a gauge-by-gauge takeoff.
 *  konnworld's functional split (lighting 500–800 ft, general outlets
 *  800–1,200 ft, heavy 200–400 ft per 1,000–1,200 sqft) is what SPLIT_B
 *  reproduces.
 *  [READ] $/ft for 14/2, 12/2 and 10/2 are Caudill's published midpoints. The
 *  three-conductor and heavy-gauge prices are [GUESS] at market. */
export const CABLE_TYPES = {
  "14/2": { costPerFt: 0.85, splitA: 0.50, splitB: 0.30 },
  "12/2": { costPerFt: 1.30, splitA: 0.26, splitB: 0.46 },
  "14/3": { costPerFt: 1.35, splitA: 0.07, splitB: 0.04 },
  "12/3": { costPerFt: 1.95, splitA: 0.05, splitB: 0.06 },
  "10/2": { costPerFt: 1.85, splitA: 0.03, splitB: 0.04 },
  "10/3": { costPerFt: 2.75, splitA: 0.05, splitB: 0.06 },
  "8/3":  { costPerFt: 4.20, splitA: 0.02, splitB: 0.02 },
  "6/3":  { costPerFt: 6.80, splitA: 0.02, splitB: 0.02 },
};

// ── Materials ───────────────────────────────────────────────────────────────

/** [READ] Caudill's published device and breaker costs, at the low-to-mid end
 *  of each range because contractors buy at trade price, not retail. Box and
 *  plate are [GUESS]. */
export const MATERIAL_COSTS = {
  receptacle: 5,
  gfciReceptacle: 25,
  switchDevice: 5,
  box: 3,          // [GUESS]
  plate: 1.5,      // [GUESS]
  fixture: 45,
  smokeCoDetector: 45,
  afciBreaker: 55,
  panel: 2250,     // [READ] panel upgrade installed $1,500–3,000
  permit: 400,     // [READ] permits $75–1,000, inspections $100–400
};

/** [GUESS] Share of receptacles needing a GFCI device rather than a standard
 *  one. Sanity: kitchen counter, both baths, laundry, garage and exterior on a
 *  3bd/2ba plan is roughly a sixth of the total. Only the first receptacle on
 *  a protected circuit needs the device, which is why this isn't higher. */
export const GFCI_RECEPTACLE_SHARE = 0.18;

/** [GUESS] Share of light fixtures the contractor supplies rather than the
 *  homeowner. Most rewire clients buy their own decorative fittings. */
export const CONTRACTOR_SUPPLIED_FIXTURE_SHARE = 0.35;

/** [GUESS] Default markup on material cost. Every company overrides this; it
 *  exists so the model returns a number rather than requiring configuration
 *  before it will run at all. */
export const DEFAULT_MATERIAL_MARKUP = 1.35;

/** [GUESS] Default billed labour rate, $/hr. Same reasoning as the markup —
 *  a placeholder, not a recommendation. */
export const DEFAULT_LABOUR_RATE = 95;

/** [GUESS] Number of dedicated appliance circuits on a standard plan: range,
 *  dryer, water heater, furnace/air handler, AC condenser, dishwasher,
 *  disposal, microwave, refrigerator. Homes without gas heat or without AC
 *  will differ; this is the count to override first. */
export const DEDICATED_APPLIANCES = [
  "Range", "Dryer", "Water heater", "Furnace / air handler", "AC condenser",
  "Dishwasher", "Disposal", "Microwave", "Refrigerator",
];

/** [GUESS] Spare breaker positions left for future load. Sanity: two minimum,
 *  one more per 900 sqft. */
export const SPARE_CIRCUITS_PER_SQFT = 900;

/** [GUESS] 240 V loads consume a second pole each — range, dryer, water
 *  heater, AC. Added to the circuit count to size the panel. */
export const DOUBLE_POLE_LOADS = 4;

// ── Service entrance — its own line, deliberately ───────────────────────────

/** [READ] A panel swap and a service upgrade are different jobs and the model
 *  used to conflate them. MATERIAL_COSTS.panel covers replacing the breaker
 *  box; it does NOT cover the mast, meter base, service conductors, grounding
 *  electrode system or utility coordination, which run $3,000–6,000 on their
 *  own (and $4,000–8,500 when the meter relocates).
 *
 *  That omission was most of a 30% shortfall against a real "Level 3" quote of
 *  $39,752. It is off by default because plenty of rewires reuse an adequate
 *  service — turning it on silently would inflate every estimate to fix one.
 *  It is a separate line rather than a $/sqft uplift because it does not scale
 *  with floor area at all. */
export const SERVICE_ENTRANCE_COST = { low: 3000, typical: 4500, high: 6000 };

// ── Range shape ─────────────────────────────────────────────────────────────

/** [GUESS] Downside band on a fully specified estimate. Narrower than the
 *  upside because rewires surprise in one direction. */
export const RANGE_LOW_FACTOR = 0.85;

/** [READ] Caudill's hidden-condition buffer is 15–25%; 25% is used as the
 *  upside because the conditions this model cannot see are all cost-adding. */
export const RANGE_HIGH_FACTOR = 1.25;

/** Sanity bounds on floor area. Outside these the answer is refusal, not a
 *  clamped number — silently pricing a 900,000 sqft "house" is exactly the
 *  control that appears to work and doesn't. */
export const MIN_SQFT = 200;
export const MAX_SQFT = 20000;

// ── Company overrides ───────────────────────────────────────────────────────

/** Every tunable default in one object, so a company can override any of it
 *  the same way Settings > Material Costs overrides a recipe. Code constants
 *  (the NEC_* exports) are deliberately absent — they are not preferences. */
export const REWIRE_COEFFICIENTS = {
  roomAspectRatio: ROOM_ASPECT_RATIO,
  practicalReceptacleRatio: PRACTICAL_RECEPTACLE_RATIO,
  residentialProductivityFactor: RESIDENTIAL_PRODUCTIVITY_FACTOR,
  trimShareOfRoughIn: TRIM_SHARE_OF_ROUGH_IN,
  panelSwapHours: PANEL_SWAP_HOURS,
  storeyLabourUplift: STOREY_LABOUR_UPLIFT,
  deviceHopFt: DEVICE_HOP_FT,
  wasteFactor: WASTE_FACTOR.default,
  cableSplit: "A",
  materialMarkup: DEFAULT_MATERIAL_MARKUP,
  labourRatePerHour: DEFAULT_LABOUR_RATE,
  dedicatedApplianceCount: DEDICATED_APPLIANCES.length,
  roughInMinutes: { ...NECA_ROUGH_IN_MINUTES },
  accessMultipliers: { ...ACCESS_MULTIPLIERS },
};

const NESTED_COEFFICIENT_KEYS = ["roughInMinutes", "accessMultipliers"];

/** Merge a company's saved overrides on top of the shared defaults. Mirrors
 *  getRecipe() in app/data/materialRecipes.js, including the nested merge —
 *  overriding one rough-in minute value must not blow away the others. */
export function getRewireCoefficients(overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return REWIRE_COEFFICIENTS;
  const merged = { ...REWIRE_COEFFICIENTS, ...overrides };
  for (const key of NESTED_COEFFICIENT_KEYS) {
    if (overrides[key]) {
      merged[key] = { ...REWIRE_COEFFICIENTS[key], ...overrides[key] };
    }
  }
  return merged;
}

/** The fields Settings would expose. Kept beside the coefficients so a new
 *  knob can't be added without deciding whether it is editable. */
export const REWIRE_EDITABLE_FIELDS = [
  { key: "practicalReceptacleRatio", label: "Receptacles vs code minimum (×)", type: "number", step: 0.05 },
  { key: "residentialProductivityFactor", label: "Crew speed vs NECA units (×)", type: "number", step: 0.01 },
  { key: "trimShareOfRoughIn", label: "Trim-out as share of rough-in", type: "number", step: 0.05 },
  { key: "panelSwapHours", label: "Panel swap hours", type: "number", step: 0.5 },
  { key: "storeyLabourUplift", label: "Labour uplift per extra storey", type: "number", step: 0.01 },
  { key: "deviceHopFt", label: "Cable per device hop (ft)", type: "number", step: 1 },
  { key: "wasteFactor", label: "Cable waste allowance", type: "number", step: 0.01 },
  { key: "materialMarkup", label: "Material markup (×)", type: "number", step: 0.05 },
  { key: "labourRatePerHour", label: "Billed labour rate ($/hr)", type: "number", step: 1 },
  { key: "dedicatedApplianceCount", label: "Dedicated appliance circuits", type: "number", step: 1 },
];

// ── Intake gate ─────────────────────────────────────────────────────────────

/** The four facts that must be known before a single price may be shown, and
 *  what each one is worth. Rendering a number without these is not a rounding
 *  error — the spread between best and worst case is 2.9×, which is the
 *  difference between winning the job and working it at a loss. */
export const REQUIRED_INTAKE = [
  { key: "wallAccess", question: "Are the walls open (or being gutted), partially open, or finished?", swing: "up to 1.75×" },
  { key: "wallConstruction", question: "Drywall, or plaster and lath?", swing: "1.34× on top of fished" },
  { key: "existingWiring", question: "Knob & tube, cloth-braid, aluminium, or modern NM cable?", swing: "up to 1.66× on top of fished" },
  { key: "storeys", question: "How many storeys?", swing: "+17% per extra storey" },
];

/** Variables the model genuinely cannot know, surfaced on every result so the
 *  estimator sees what the number is blind to. These are not intake-blocking —
 *  they are the reasons the range is a range. */
export const KNOWN_UNKNOWNS = [
  { key: "asbestosOrLead", note: "Pre-1980 homes may need abatement — a separate trade, not in this number." },
  { key: "atticAccess", note: "Full-height / crawl-only / none changes the cable path. Crawl-only ≈ +15%, none ≈ +30%." },
  { key: "floorAccess", note: "Slab-on-grade removes the easiest cable path ≈ +20% vs basement or crawl." },
  { key: "panelLocation", note: "A relocating meter or mast runs $4,000–8,500 and is not included unless the service line is enabled." },
  { key: "wallRepair", note: "Drywall repair adds 20–30% of project cost; plaster/lath repair is 2–4× drywall. Excluded here." },
  { key: "historicDesignation", note: "Listed or conservation-district properties carry approval delay and surface-mount restrictions. Not quotable without a site visit." },
  { key: "occupancy", note: "Occupied during work adds 10–15% for protection, furniture and phasing." },
];

const ACCESS_CLASS_ORDER = [
  "open_walls", "light_reno", "fished_drywall", "plaster_lath", "knob_tube_historic",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Hostile-input gate. Anything not a finite positive number becomes the
 *  fallback rather than propagating NaN into a price. */
function positive(value, fallback = 0) {
  const n = safeNumber(value, fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function roundMoney(n) {
  return Math.round(n);
}

/** Perimeter of a room of a given area, at the assumed aspect ratio. Exact for
 *  a rectangle; rooms are close enough to rectangular that measuring real ones
 *  would not pay for the intake burden. */
export function roomPerimeter(areaSqft, aspectRatio = ROOM_ASPECT_RATIO) {
  const a = positive(areaSqft);
  const r = positive(aspectRatio, ROOM_ASPECT_RATIO);
  if (!a) return 0;
  return 2 * (Math.sqrt(a * r) + Math.sqrt(a / r));
}

/** Code-minimum receptacles for one room, straight from the 12 ft rule.
 *  Habitable rooms floor at 2 — a room with one receptacle fails the 6 ft
 *  rule on any wall longer than 12 ft, which is every habitable room. */
export function receptaclesForRoom({ areaSqft, doors = 1, breaksFt = 0, minimum = 2, aspectRatio }) {
  const wall = Math.max(0, roomPerimeter(areaSqft, aspectRatio) - positive(doors) * DOOR_BREAK_FT - positive(breaksFt));
  return Math.max(minimum, Math.ceil(wall / NEC_RECEPTACLE_SPACING_FT));
}

/** Derive the access class from the four intake facts. Kept separate from the
 *  multiplier lookup so callers can ask "what class is this?" without pricing,
 *  and so the mapping is testable on its own. */
export function deriveAccessClass({ wallAccess, wallConstruction, existingWiring }) {
  if (wallAccess === "open") return "open_walls";
  if (wallAccess === "partial") return "light_reno";
  // Finished walls from here down. Worst condition wins — a knob & tube house
  // with plaster is not the average of the two, it is the harder of them.
  if (existingWiring === "knob_tube") return "knob_tube_historic";
  if (wallConstruction === "plaster_lath") return "plaster_lath";
  return "fished_drywall";
}

/** Which of the four required facts are missing. Returns the intake entries
 *  themselves so a caller can render the questions without a second lookup. */
export function missingIntake(input = {}) {
  const missing = [];
  const valid = {
    wallAccess: ["open", "partial", "finished"],
    wallConstruction: ["drywall", "plaster_lath"],
    existingWiring: ["modern_nm", "cloth_braid", "aluminium", "knob_tube"],
  };
  for (const entry of REQUIRED_INTAKE) {
    const value = input[entry.key];
    if (entry.key === "storeys") {
      if (!positive(value)) missing.push(entry);
    } else if (!valid[entry.key].includes(value)) {
      missing.push(entry);
    }
  }
  return missing;
}

// ── Room schedule ───────────────────────────────────────────────────────────

/** The rooms a house of a given size and bed/bath count is assumed to contain.
 *  Areas are fractions of floor area with a cap, because rooms stop growing
 *  well before houses do — a 3,000 sqft home has more rooms, not a 500 ft²
 *  living room.
 *
 *  The caps are NOT what makes device count sub-linear — mutation-testing the
 *  check script proved sub-linearity survives without them (exponent 0.78
 *  uncapped vs 0.71 capped). The primary mechanism is that a room's perimeter
 *  grows as √area while its floor grows as area, so receptacles per square
 *  foot fall on their own. The caps deepen the effect by roughly 0.07 of
 *  exponent; they don't create it. Both are pinned by the check script. */
export function buildRoomSchedule({ sqft, bedrooms, baths }) {
  const rooms = [];
  const add = (name, areaSqft, doors, breaksFt, switches, lighting, fixedReceptacles) =>
    rooms.push({ name, areaSqft, doors, breaksFt, switches, lighting, fixedReceptacles });

  add("Kitchen", Math.min(220, 0.11 * sqft), 2, KITCHEN_CABINET_BREAK_FT, 3, 4);
  add("Living", Math.min(360, 0.18 * sqft), 2, 0, 3, 2);
  if (sqft >= 1200) add("Dining", Math.min(170, 0.09 * sqft), 2, 0, 2, 1);
  add("Laundry", 48, 1, 0, 1, 1, 1); // [NEC 210.52(F)] one receptacle, that's the rule

  for (let i = 0; i < bedrooms; i++) {
    const area = i === 0 ? Math.min(260, 0.14 * sqft) : Math.min(150, 0.085 * sqft);
    add(i === 0 ? "Primary bedroom" : `Bedroom ${i + 1}`, area, 1, CLOSET_BREAK_FT, i === 0 ? 3 : 2, i === 0 ? 2 : 1);
  }
  // [NEC 210.52(D)] one receptacle within 36" of each basin. A primary bath is
  // assumed to have two basins; the rest one. Not driven by the 12 ft rule.
  for (let i = 0; i < baths; i++) {
    add(i === 0 ? "Primary bath" : `Bath ${i + 1}`, 45, 1, 0, 2, 2, i === 0 ? 2 : 1);
  }
  // [NEC 210.52(H)] hallways 10 ft or longer need one. Counting halls by floor
  // area rather than measuring them is a [GUESS].
  const halls = Math.max(1, Math.round(sqft / 900));
  for (let i = 0; i < halls; i++) add(`Hall ${i + 1}`, 60, 0, 0, 2, 2, 1);
  // Offices, dens, family and bonus rooms appear as houses grow. [GUESS].
  const extras = Math.max(0, Math.round((sqft - 1200) / 700));
  for (let i = 0; i < extras; i++) add(`Additional room ${i + 1}`, Math.min(220, 0.10 * sqft), 1, 0, 2, 1);

  return rooms;
}

// ── Openings ────────────────────────────────────────────────────────────────

/** Device and opening counts. "Opening" is the unit electricians actually bid
 *  in — every receptacle, switch, fixture, detector and appliance connection
 *  is one — which is why the total is returned alongside the breakdown. */
export function estimateOpenings({ sqft, bedrooms, baths, storeys = 1, garage, coefficients } = {}) {
  const c = coefficients || REWIRE_COEFFICIENTS;
  const area = positive(sqft);
  if (!area) return null;

  const bd = Math.max(0, Math.round(positive(bedrooms, 0)));
  const ba = Math.max(0, Math.round(positive(baths, 0)));
  const st = Math.max(1, Math.round(positive(storeys, 1)));
  const hasGarage = garage === undefined ? area >= 1200 : Boolean(garage);

  const rooms = buildRoomSchedule({ sqft: area, bedrooms: bd, baths: ba });

  let receptaclesCode = 0;
  let switches = 0;
  let lighting = 0;
  const byRoom = [];

  for (const room of rooms) {
    const code = room.fixedReceptacles
      ?? receptaclesForRoom({
        areaSqft: room.areaSqft, doors: room.doors, breaksFt: room.breaksFt,
        aspectRatio: c.roomAspectRatio,
      });
    const practical = Math.round(code * c.practicalReceptacleRatio);
    receptaclesCode += code;
    switches += room.switches;
    lighting += room.lighting;
    byRoom.push({
      name: room.name,
      areaSqft: Math.round(room.areaSqft),
      perimeterFt: Math.round(roomPerimeter(room.areaSqft, c.roomAspectRatio)),
      receptaclesCode: code,
      receptaclesPractical: practical,
      switches: room.switches,
      lighting: room.lighting,
      openings: practical + room.switches + room.lighting,
    });
  }

  // [NEC 210.52(C)] counter receptacles. Counter area as a fraction of floor
  // area is a [GUESS] with a 24 ft² floor — every kitchen has at least that.
  const counterSqft = Math.max(24, 0.020 * area);
  const counterReceptacles = 1 + Math.ceil((counterSqft - NEC_COUNTER_FIRST_SQFT) / NEC_COUNTER_ADDITIONAL_SQFT);
  const exteriorReceptacles = NEC_EXTERIOR_RECEPTACLES_MIN + (area >= 2000 ? 1 : 0);
  const carSpaces = area >= 2200 ? 2 : 1;
  const garageReceptacles = hasGarage ? carSpaces + 1 : 0;

  receptaclesCode += counterReceptacles + exteriorReceptacles + garageReceptacles;
  if (hasGarage) { switches += 2; lighting += 2; }
  lighting += 2; // exterior fixtures front and back

  const receptaclesPractical = Math.round(receptaclesCode * c.practicalReceptacleRatio);
  // One per bedroom, one per storey, one outside the sleeping area — the rule
  // nearly every AHJ applies. [READ] in shape, the arithmetic is ours.
  const smokeCo = bd + st + 1;
  const dedicated = Math.max(0, Math.round(positive(c.dedicatedApplianceCount, DEDICATED_APPLIANCES.length)));

  const openingsCode = receptaclesCode + switches + lighting + smokeCo + dedicated;
  const openings = receptaclesPractical + switches + lighting + smokeCo + dedicated;

  return {
    sqft: area, bedrooms: bd, baths: ba, storeys: st, garage: hasGarage,
    receptaclesCode, receptaclesPractical, switches, lighting, smokeCo, dedicated,
    counterReceptacles, exteriorReceptacles, garageReceptacles,
    openingsCode, openings,
    openingsPer100Sqft: round1((openings / area) * 100),
    byRoom,
  };
}

// ── Circuits ────────────────────────────────────────────────────────────────

/** Circuit count and the panel it implies. The general-lighting portion is a
 *  real NEC 220.12 calculation; the mandatory circuits are counted on top
 *  rather than inside it, because 210.11(C) requires them regardless of what
 *  the load calculation says. */
export function estimateCircuits({ sqft, garage, dedicated, coefficients } = {}) {
  const c = coefficients || REWIRE_COEFFICIENTS;
  const area = positive(sqft);
  if (!area) return null;

  const hasGarage = garage === undefined ? area >= 1200 : Boolean(garage);
  const dedicatedCount = dedicated === undefined
    ? Math.max(0, Math.round(positive(c.dedicatedApplianceCount, DEDICATED_APPLIANCES.length)))
    : Math.max(0, Math.round(positive(dedicated, 0)));

  const generalLighting = Math.ceil((area * NEC_GENERAL_LIGHTING_VA_PER_SQFT / 120) / 15);
  const mandatory = NEC_MANDATORY_CIRCUITS.smallAppliance
    + NEC_MANDATORY_CIRCUITS.laundry
    + NEC_MANDATORY_CIRCUITS.bathroom
    + (hasGarage ? NEC_MANDATORY_CIRCUITS.garage : 0);
  const spares = Math.max(2, Math.round(area / SPARE_CIRCUITS_PER_SQFT));

  const circuits = generalLighting + mandatory + dedicatedCount + spares;
  const poles = circuits + DOUBLE_POLE_LOADS;

  // Panel sized on pole count, then floored at 200 A for anything but the
  // smallest home. The load calculation frequently says 100 A is adequate
  // (a 1,461 sqft NEC 220.82 run comes out at 96 A) but nobody installs a
  // 100 A panel on a rewire in 2026 — it fails the client's next EV charger.
  let panel;
  if (poles <= 20) panel = { amps: 100, spaces: 24 };
  else if (poles <= 24) panel = { amps: 150, spaces: 30 };
  else if (poles <= 32) panel = { amps: 200, spaces: 40 };
  else panel = { amps: 200, spaces: 42, subpanel: true };

  return {
    generalLighting, mandatory, dedicated: dedicatedCount, spares,
    circuits, poles, panel,
    panelLabel: `${panel.amps} A / ${panel.spaces} space${panel.subpanel ? " + subpanel" : ""}`,
  };
}

// ── Cable ───────────────────────────────────────────────────────────────────

/** Total cable footage and the per-gauge split, waste included. Footage is
 *  built from devices and home runs rather than from floor area, which is what
 *  makes it sub-linear. */
export function estimateWire({ openings, circuits, sqft, storeys = 1, wallAccess, coefficients } = {}) {
  const c = coefficients || REWIRE_COEFFICIENTS;
  const area = positive(sqft);
  if (!area || !openings || !circuits) return null;

  const st = Math.max(1, Math.round(positive(storeys, 1)));
  const homeRunAvgFt = HOME_RUN_SQRT_COEFF * Math.sqrt(area) + HOME_RUN_BASE_FT + (st - 1) * HOME_RUN_PER_STOREY_FT;

  const branchDevices = openings.receptaclesPractical + openings.switches + openings.lighting + openings.smokeCo;
  const daisyChainFt = branchDevices * positive(c.deviceHopFt, DEVICE_HOP_FT);
  const homeRunFt = circuits.circuits * homeRunAvgFt;
  const dedicatedFt = circuits.dedicated * homeRunAvgFt * DEDICATED_RUN_FACTOR;

  const waste = wallAccess === "open"
    ? WASTE_FACTOR.open
    : wallAccess === "finished"
      ? WASTE_FACTOR.fished
      : positive(c.wasteFactor, WASTE_FACTOR.default);

  const rawFt = daisyChainFt + homeRunFt + dedicatedFt;
  const totalFt = Math.round(rawFt * (1 + waste));

  const splitKey = c.cableSplit === "B" ? "splitB" : "splitA";
  let cost = 0;
  const byType = Object.entries(CABLE_TYPES).map(([type, spec]) => {
    const feet = Math.round(totalFt * spec[splitKey]);
    const lineCost = feet * spec.costPerFt;
    cost += lineCost;
    return { type, share: spec[splitKey], feet, costPerFt: spec.costPerFt, cost: roundMoney(lineCost) };
  });

  return {
    totalFt,
    rawFt: Math.round(rawFt),
    wasteFactor: waste,
    homeRunAvgFt: round1(homeRunAvgFt),
    feetPerSqft: Math.round((totalFt / area) * 100) / 100,
    split: c.cableSplit === "B" ? "B" : "A",
    byType,
    cost: roundMoney(cost),
  };
}

// ── Labour ──────────────────────────────────────────────────────────────────

/** Crew-hours, split rough-in vs trim-out. accessClass is required — there is
 *  no default, because defaulting it would let a caller price a plaster-and-
 *  lath rewire at open-wall rates and never notice. */
export function estimateLabourHours({ openings, circuits, accessClass, storeys = 1, coefficients } = {}) {
  const c = coefficients || REWIRE_COEFFICIENTS;
  if (!openings || !circuits) return null;
  const multiplier = c.accessMultipliers?.[accessClass];
  if (!Number.isFinite(multiplier)) return null;

  const m = c.roughInMinutes || NECA_ROUGH_IN_MINUTES;
  const rawMinutes =
    openings.receptaclesPractical * positive(m.receptacle, NECA_ROUGH_IN_MINUTES.receptacle)
    + openings.switches * positive(m.switch, NECA_ROUGH_IN_MINUTES.switch)
    + openings.lighting * positive(m.fixture, NECA_ROUGH_IN_MINUTES.fixture)
    + openings.smokeCo * positive(m.smokeCo, NECA_ROUGH_IN_MINUTES.smokeCo)
    + openings.dedicated * positive(m.dedicated, NECA_ROUGH_IN_MINUTES.dedicated)
    + circuits.circuits * positive(m.circuit, NECA_ROUGH_IN_MINUTES.circuit);

  const st = Math.max(1, Math.round(positive(storeys, 1)));
  const storeyFactor = 1 + (st - 1) * positive(c.storeyLabourUplift, STOREY_LABOUR_UPLIFT);
  const trimShare = positive(c.trimShareOfRoughIn, TRIM_SHARE_OF_ROUGH_IN);

  const baseHours = (rawMinutes / 60) * positive(c.residentialProductivityFactor, RESIDENTIAL_PRODUCTIVITY_FACTOR);
  const roughInHours = baseHours * multiplier * storeyFactor;
  const trimOutHours = roughInHours * trimShare;
  const panelHours = positive(c.panelSwapHours, PANEL_SWAP_HOURS);
  const totalHours = roughInHours + trimOutHours + panelHours;

  return {
    accessClass, accessMultiplier: multiplier, storeyFactor: Math.round(storeyFactor * 100) / 100,
    roughInHours: round1(roughInHours),
    trimOutHours: round1(trimOutHours),
    panelHours: round1(panelHours),
    totalHours: round1(totalHours),
    hoursPerOpening: Math.round((totalHours / openings.openings) * 100) / 100,
  };
}

// ── Material ────────────────────────────────────────────────────────────────

/** Material at cost, before markup. Panel and permit are included; the service
 *  entrance is not — see SERVICE_ENTRANCE_COST. */
export function estimateMaterialCost({ openings, circuits, wire } = {}) {
  if (!openings || !circuits || !wire) return null;

  const deviceCost = openings.receptaclesPractical * (MATERIAL_COSTS.receptacle + MATERIAL_COSTS.box + MATERIAL_COSTS.plate)
    + openings.switches * (MATERIAL_COSTS.switchDevice + MATERIAL_COSTS.box + MATERIAL_COSTS.plate)
    + openings.lighting * (MATERIAL_COSTS.fixture * CONTRACTOR_SUPPLIED_FIXTURE_SHARE + MATERIAL_COSTS.box)
    + openings.smokeCo * MATERIAL_COSTS.smokeCoDetector;
  const gfciUplift = Math.round(openings.receptaclesPractical * GFCI_RECEPTACLE_SHARE)
    * (MATERIAL_COSTS.gfciReceptacle - MATERIAL_COSTS.receptacle);
  const breakers = circuits.circuits * MATERIAL_COSTS.afciBreaker;

  const lines = [
    { label: "Cable", cost: wire.cost },
    { label: "Devices, boxes & plates", cost: roundMoney(deviceCost) },
    { label: "GFCI device uplift", cost: roundMoney(gfciUplift) },
    { label: "AFCI/GFCI breakers", cost: roundMoney(breakers) },
    { label: "Panel", cost: MATERIAL_COSTS.panel },
    { label: "Permit & inspection", cost: MATERIAL_COSTS.permit },
  ];
  return { lines, total: roundMoney(lines.reduce((s, l) => s + l.cost, 0)) };
}

// ── Composed estimate ───────────────────────────────────────────────────────

/**
 * The whole model, composed.
 *
 * Returns a RANGE, always — `{ low, typical, high }`. When any of the four
 * required intake facts is missing, `typical` is null and `needsIntake` lists
 * what to ask. That is structural, not advisory: there is no single number in
 * the object for a caller to render, so a UI cannot accidentally show one. The
 * spread with all four unknown is 2.9×, and AGENTS.md forbids shipping a
 * control that appears to work — a confident-looking price derived from square
 * footage alone is exactly that.
 */
export function estimateRewire(input = {}) {
  const {
    sqft, bedrooms, baths, garage,
    wallAccess, wallConstruction, existingWiring, storeys,
    includeServiceEntrance = false,
    labourRatePerHour, materialMarkup,
    overrides,
  } = input;

  const c = getRewireCoefficients(overrides);
  const area = positive(sqft);

  if (!area || area < MIN_SQFT || area > MAX_SQFT) {
    return {
      ok: false,
      reason: area
        ? `Floor area ${Math.round(area)} sqft is outside the ${MIN_SQFT}–${MAX_SQFT} sqft range this model is calibrated for.`
        : "Floor area is required.",
      low: null, typical: null, high: null,
      needsIntake: REQUIRED_INTAKE, assumptions: [], unknowns: KNOWN_UNKNOWNS,
    };
  }

  const assumptions = [];
  // Bedrooms and baths shape the room schedule but are not among the four
  // gating facts, so they are inferred rather than blocking — and the
  // inference is stated, because an unstated default is how a 5-bed house
  // gets quoted as a 3-bed one.
  let bd = Math.round(positive(bedrooms, 0));
  let ba = Math.round(positive(baths, 0));
  if (!bd) {
    bd = area < 900 ? 2 : area < 1800 ? 3 : area < 2600 ? 4 : 5;
    assumptions.push(`Bedrooms not supplied — assumed ${bd} for ${Math.round(area)} sqft.`);
  }
  if (!ba) {
    ba = area < 1100 ? 1 : area < 2200 ? 2 : 3;
    assumptions.push(`Bathrooms not supplied — assumed ${ba} for ${Math.round(area)} sqft.`);
  }

  const needsIntake = missingIntake({ wallAccess, wallConstruction, existingWiring, storeys });
  const st = Math.max(1, Math.round(positive(storeys, 1)));
  if (needsIntake.some((e) => e.key === "storeys")) {
    assumptions.push("Storeys not supplied — device and cable counts assume single storey.");
  }

  const rate = positive(labourRatePerHour, positive(c.labourRatePerHour, DEFAULT_LABOUR_RATE));
  const markup = positive(materialMarkup, positive(c.materialMarkup, DEFAULT_MATERIAL_MARKUP));

  const openings = estimateOpenings({ sqft: area, bedrooms: bd, baths: ba, storeys: st, garage, coefficients: c });
  const circuits = estimateCircuits({ sqft: area, garage: openings.garage, coefficients: c });
  const wire = estimateWire({ openings, circuits, sqft: area, storeys: st, wallAccess, coefficients: c });
  const material = estimateMaterialCost({ openings, circuits, wire });
  const materialSell = material.total * markup;

  const serviceEntrance = includeServiceEntrance ? SERVICE_ENTRANCE_COST : null;
  if (!includeServiceEntrance) {
    assumptions.push("Existing service entrance reused — mast, meter, service conductors and utility coordination are NOT included. Enable the service-entrance line if any of those are in scope ($3,000–6,000).");
  }

  // Price one access class end to end.
  const priceFor = (accessClass) => {
    const labour = estimateLabourHours({ openings, circuits, accessClass, storeys: st, coefficients: c });
    if (!labour) return null;
    const labourCost = labour.totalHours * rate;
    const base = labourCost + materialSell;
    return {
      accessClass,
      hours: labour.totalHours,
      labourCost: roundMoney(labourCost),
      materialCost: roundMoney(materialSell),
      total: roundMoney(base),
      perOpening: roundMoney(base / openings.openings),
      perSqft: Math.round((base / area) * 100) / 100,
      labour,
    };
  };

  const withService = (total) => total + (serviceEntrance ? serviceEntrance.typical : 0);

  if (needsIntake.length > 0) {
    // Bracket the full spread across every access class. No `typical` — there
    // is not enough information for one to exist, and inventing it is the
    // failure this whole gate is here to prevent.
    const cheapest = priceFor(ACCESS_CLASS_ORDER[0]);
    const dearest = priceFor(ACCESS_CLASS_ORDER[ACCESS_CLASS_ORDER.length - 1]);
    const low = roundMoney(withService(cheapest.total) * RANGE_LOW_FACTOR
      + (serviceEntrance ? serviceEntrance.low - serviceEntrance.typical : 0));
    const high = roundMoney(withService(dearest.total) * RANGE_HIGH_FACTOR
      + (serviceEntrance ? serviceEntrance.high - serviceEntrance.typical : 0));
    return {
      ok: true,
      low, typical: null, high,
      spread: Math.round((high / low) * 100) / 100,
      needsIntake,
      assumptions,
      unknowns: KNOWN_UNKNOWNS,
      openings, circuits, wire, material, serviceEntrance,
      accessClass: null,
      byAccessClass: ACCESS_CLASS_ORDER.map(priceFor),
      labourRatePerHour: rate, materialMarkup: markup,
    };
  }

  const accessClass = deriveAccessClass({ wallAccess, wallConstruction, existingWiring });
  const priced = priceFor(accessClass);
  const typicalTotal = withService(priced.total);

  return {
    ok: true,
    low: roundMoney(typicalTotal * RANGE_LOW_FACTOR),
    typical: roundMoney(typicalTotal),
    high: roundMoney(typicalTotal * RANGE_HIGH_FACTOR),
    spread: Math.round((RANGE_HIGH_FACTOR / RANGE_LOW_FACTOR) * 100) / 100,
    needsIntake: [],
    assumptions,
    unknowns: KNOWN_UNKNOWNS,
    accessClass,
    openings, circuits, wire, material, serviceEntrance,
    labour: priced.labour,
    perOpening: roundMoney(typicalTotal / openings.openings),
    perSqft: Math.round((typicalTotal / area) * 100) / 100,
    labourRatePerHour: rate, materialMarkup: markup,
  };
}
