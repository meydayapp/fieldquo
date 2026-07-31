// lib/junk/pricing.js
//
// Pricing a junk-removal / dumping job.
//
// ══ Volume, with a discount that grows as the truck fills ══════════════════
//
// The thing a flat per-item price gets WRONG, and the thing the trade actually
// does: one item is a whole trip — the truck, the fuel, the dump run, two
// people — so it's expensive per item. The seventeenth item shares all of that,
// so it's nearly free. Price must fall per item as volume rises.
//
// So the model is volume, not count. Every item carries a VOLUME (a couch is
// bigger than a microwave), the volumes sum, and the total maps onto the truck-
// load fractions the trade quotes in — minimum (1/8), quarter, half, full. Those
// tier prices are already sub-linear (a full load isn't four times a quarter),
// so the per-item price falls out of the volume automatically, the way it does
// on the real invoice. A single small item floors to the minimum charge: the
// trip costs what the trip costs.
//
// ══ The fees a naive quote misses, and the items it must refuse ════════════
//
//   refrigerant  a fridge/AC owes its Freon reclaim fee AND usually a SEPARATE
//                TRUCK — the city's own rules say a different truck takes these.
//   e-waste      a TV/computer is a recycling fee, and a separate truck too.
//   mattress / tire   their own recycling/disposal fees.
//   heavy        concrete/dirt priced by the truck-bed, because the dump bills
//                by the tonne, not the truckload.
//   hazards      propane, gas appliances, paint, asbestos are NEVER priced —
//                they come back as warnings so the crew isn't sent to refuse
//                them on the doorstep.
//
// ══ The job the customer describes ═════════════════════════════════════════
//
// Single items, a full house / estate, a rental turnover, or a renovation site
// — the same items, but a reno full of construction debris is dirtier and
// heavier than a living-room clear-out, so the job type carries a small
// multiplier. Access (stairs, no elevator, long carry, disassembly, small
// demolition) and being outside the free service area add on top.
//
// Pure. Company rates in, an itemised quote out. No database.

/** Every rate a company can set. Starting points — a company edits its own. */
export const DEFAULT_JUNK_RATES = {
  // How many volume "units" a full truck holds. Items are sized against this.
  fullLoadUnits: 30,

  // Truck-load fraction prices, cents. Mid-points of the 2026 market ranges.
  // Sub-linear on purpose — that IS the volume discount.
  loadCents: {
    minimum: 13500, // 1/8 load ($100–175)
    quarter: 22500, // ($150–300)
    half: 40000, //    ($250–550)
    full: 77500, //    full truck ($550–1,000)
  },

  // Below this a stop doesn't cover the drive and the dump run.
  minimumCents: 9000,

  // Special-handling surcharges, ADDED on top of the volume price.
  refrigerantFeeCents: 4500, // Freon reclaim
  ewasteFeeCents: 3000,
  mattressFeeCents: 1500,
  tirePerUnitCents: 800,
  heavyPerLoadCents: 17500, // concrete / dirt / masonry, per truck-bed

  // Access surcharges (flat, per job).
  stairsPerFlightCents: 2500,
  disassemblyCents: 4000, // taking a bed / shed / play structure apart
  demolitionCents: 12000, // small demolition (a deck, a partition wall)
  longCarryCents: 3500, // a long haul from door to truck
  noElevatorCents: 4000, // upper-floor unit with no lift

  // Outside the company's free service area — a travel surcharge. The company's
  // free radius lives elsewhere; here we just apply the fee when it's flagged.
  outOfAreaCents: 6000,
};

/**
 * The item taxonomy — informed by the City of Gatineau bulky-collection list
 * and the trade's own categories. `volume` is in truck-units (see
 * fullLoadUnits). `special` marks a surcharge/handling rule; `notAccepted`
 * marks an item a standard run WON'T take (warned, never priced).
 */
export const JUNK_ITEMS = [
  // Everyday furniture
  { key: "couch", label: "Sofa / couch", volume: 4 },
  { key: "recliner", label: "Armchair / recliner", volume: 2.5 },
  { key: "bed_frame", label: "Bed frame / base", volume: 2 },
  { key: "table", label: "Table", volume: 2 },
  { key: "desk", label: "Desk", volume: 2.5 },
  { key: "dresser", label: "Dresser / wardrobe", volume: 3 },
  { key: "chair", label: "Chair", volume: 1 },
  { key: "furniture", label: "Other furniture", volume: 2 },
  { key: "mattress", label: "Mattress / box spring", volume: 3, special: "mattress" },
  { key: "carpet", label: "Carpet (rolled & tied)", volume: 1.5 },
  { key: "exercise_equipment", label: "Exercise equipment", volume: 3 },
  { key: "bbq", label: "BBQ (propane tank removed)", volume: 2 },

  // Appliances — the refrigerant split matters
  { key: "appliance", label: "Washer / dryer / dishwasher / stove", volume: 3 },
  { key: "microwave", label: "Microwave", volume: 0.5 },
  { key: "refrigerator", label: "Refrigerator / freezer", volume: 4, special: "refrigerant" },
  { key: "air_conditioner", label: "Air conditioner / dehumidifier", volume: 1.5, special: "refrigerant" },
  { key: "water_cooler", label: "Water cooler", volume: 1, special: "refrigerant" },

  // Electronics
  { key: "tv", label: "TV / monitor", volume: 1, special: "ewaste" },
  { key: "computer", label: "Computer / electronics", volume: 0.5, special: "ewaste" },

  // Tires & metal
  { key: "tire", label: "Tire (with or without rim)", volume: 0.5, special: "tire" },
  { key: "metal", label: "Metal item (sink, heater, gate)", volume: 1.5 },

  // Heavy / construction
  { key: "concrete", label: "Concrete / brick / masonry", volume: 2, special: "heavy" },
  { key: "dirt", label: "Dirt / soil / sod", volume: 2, special: "heavy" },
  { key: "wood_debris", label: "Lumber / renovation wood", volume: 1.5, special: "heavy" },
  { key: "construction_debris", label: "Construction debris (mixed)", volume: 2, special: "heavy" },
  { key: "shed", label: "Dismantled shed / gazebo panels", volume: 3 },

  // Outdoors / large plastic / yard
  { key: "hot_tub", label: "Hot tub / above-ground pool", volume: 10 },
  { key: "large_plastic", label: "Large plastic (furniture, toys, stroller)", volume: 2 },
  { key: "swing_set", label: "Swing set / play structure", volume: 4 },
  { key: "yard_waste", label: "Branches / yard waste (bundled)", volume: 1 },

  // NOT accepted on a standard run — flagged, never priced
  { key: "propane", label: "Propane tank", notAccepted: true },
  { key: "gas_appliance", label: "Gasoline appliance (mower, blower)", notAccepted: true },
  { key: "paint_chemicals", label: "Paint / solvents / chemicals", notAccepted: true },
  { key: "asbestos", label: "Asbestos / hazardous material", notAccepted: true },
];

const ITEM_BY_KEY = new Map(JUNK_ITEMS.map((i) => [i.key, i]));

/** What kind of job it is — the same items, a different context. */
export const JOB_TYPES = {
  single_items: { key: "single_items", label: "A few items", multiplier: 1.0 },
  house_cleanout: { key: "house_cleanout", label: "Full house / estate", multiplier: 1.0 },
  rental_turnover: { key: "rental_turnover", label: "Rental / property turnover", multiplier: 1.0 },
  // Reno debris is dirtier, heavier and slower to load than a living room.
  construction: { key: "construction", label: "Construction / renovation", multiplier: 1.15 },
  other: { key: "other", label: "Other", multiplier: 1.0 },
};

export const LOAD_TIERS = ["minimum", "quarter", "half", "full"];

// Fraction-of-truck thresholds the tiers sit at.
const TIER_FRACTION = { minimum: 0.125, quarter: 0.25, half: 0.5, full: 1.0 };

function num(v, fallback = 0, min = 0, max = 1e7) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Fill every rate with a finite number; a saved blob missing a key still works. */
export function normaliseJunkRates(input) {
  const r = input && typeof input === "object" ? input : {};
  const load = { ...DEFAULT_JUNK_RATES.loadCents, ...(r.loadCents || {}) };
  const out = { loadCents: {} };
  for (const [k, def] of Object.entries(DEFAULT_JUNK_RATES)) {
    if (k === "loadCents") continue;
    out[k] = num(r[k], def, 0);
  }
  for (const k of LOAD_TIERS) out.loadCents[k] = num(load[k], DEFAULT_JUNK_RATES.loadCents[k], 0);
  // A truck must hold something — guard the divisor.
  out.fullLoadUnits = num(r.fullLoadUnits, DEFAULT_JUNK_RATES.fullLoadUnits, 1);
  return out;
}

/**
 * The volume-discounted base price for a total volume, in cents.
 *
 * Below 1/8 of a truck → the minimum tier (a single item is a whole trip).
 * Between two tier thresholds → interpolate linearly between their prices, so
 * the curve is smooth rather than jumping at each fraction. Over a full truck →
 * full-load price per whole truck plus an interpolated remainder — a two-and-a-
 * bit-load job is priced as such, not capped.
 */
export function volumePriceCents(volumeUnits, rates) {
  const r = normaliseJunkRates(rates);
  const V = Math.max(0, Number(volumeUnits) || 0);
  if (V <= 0) return 0;

  const frac = V / r.fullLoadUnits;
  const c = r.loadCents;

  // Whole truckloads over a full one.
  const wholeTrucks = Math.floor(frac);
  const remainder = frac - wholeTrucks;

  const lerp = (fLo, fHi, cLo, cHi, f) =>
    cLo + ((cHi - cLo) * (f - fLo)) / (fHi - fLo || 1);

  const priceForFraction = (f) => {
    if (f <= 0) return 0;
    if (f <= TIER_FRACTION.minimum) return c.minimum;
    if (f <= TIER_FRACTION.quarter) return lerp(TIER_FRACTION.minimum, TIER_FRACTION.quarter, c.minimum, c.quarter, f);
    if (f <= TIER_FRACTION.half) return lerp(TIER_FRACTION.quarter, TIER_FRACTION.half, c.quarter, c.half, f);
    if (f <= TIER_FRACTION.full) return lerp(TIER_FRACTION.half, TIER_FRACTION.full, c.half, c.full, f);
    return c.full;
  };

  return Math.round(wholeTrucks * c.full + priceForFraction(remainder));
}

/** The surcharge an item's `special` flag adds, in cents, for one unit. */
function specialFee(special, rates) {
  switch (special) {
    case "refrigerant": return rates.refrigerantFeeCents;
    case "ewaste": return rates.ewasteFeeCents;
    case "mattress": return rates.mattressFeeCents;
    case "tire": return rates.tirePerUnitCents;
    default: return 0;
  }
}

/**
 * Price a junk-removal job.
 *
 * @param input {
 *   jobType: "single_items"|"house_cleanout"|"rental_turnover"|"construction"|"other",
 *   items: [{ key, quantity }],   // or bare "key" strings
 *   heavyLoads: number,           // truck-beds of concrete/dirt on top
 *   stairsFlights, disassembly, demolition, longCarry, noElevator, outOfArea,
 * }
 * @param ratesInput  the company's rate card (or nothing → defaults)
 * @returns {
 *   total, lines, volumeUnits, loadFraction,
 *   warnings: { notAccepted: [...], separateTruck: [...] },
 * }
 */
export function priceJunk(input, ratesInput) {
  if (!input || typeof input !== "object") input = {};
  const rates = normaliseJunkRates(ratesInput);

  const lines = [];
  const notAccepted = [];
  const separateTruck = [];
  let volumeUnits = 0;
  let feeTotal = 0;

  const items = Array.isArray(input.items) ? input.items : [];
  for (const raw of items) {
    const key = typeof raw === "string" ? raw : raw?.key;
    const spec = ITEM_BY_KEY.get(key);
    if (!spec) continue; // an item we don't recognise is dropped, never priced
    const qty = Math.max(1, Math.floor(num(raw?.quantity, 1, 1, 500)));

    if (spec.notAccepted) {
      notAccepted.push({ key: spec.key, label: spec.label });
      continue; // never priced — a warning, not a line
    }

    volumeUnits += (Number(spec.volume) || 0) * qty;

    // Special-handling surcharge (heavy is charged per truck-bed below, so it's
    // excluded here — its volume still counts toward the base).
    if (spec.special && spec.special !== "heavy") {
      const fee = specialFee(spec.special, rates) * qty;
      if (fee > 0) {
        feeTotal += fee;
        lines.push({ key: `fee_${key}`, label: `${spec.label} — handling`, cents: fee, quantity: qty });
      }
      if (spec.special === "refrigerant" || spec.special === "ewaste") {
        separateTruck.push({ key: spec.key, label: spec.label });
      }
    }
  }

  // ── Volume-discounted base, then the job-type multiplier ───────────────────
  const jobType = JOB_TYPES[input.jobType] ? input.jobType : "single_items";
  const mult = JOB_TYPES[jobType].multiplier;
  let base = Math.round(volumePriceCents(volumeUnits, rates) * mult);
  if (base > 0) {
    lines.push({
      key: "base",
      label: `Removal — about ${loadDescription(volumeUnits, rates)}`,
      cents: base,
    });
  }

  let subtotal = base + feeTotal;

  // ── Heavy debris, per truck-bed ────────────────────────────────────────────
  const heavyLoads = Math.floor(num(input.heavyLoads, 0, 0, 50));
  if (heavyLoads > 0) {
    const c = heavyLoads * rates.heavyPerLoadCents;
    subtotal += c;
    lines.push({ key: "heavy", label: `Heavy debris — ${heavyLoads} load${heavyLoads > 1 ? "s" : ""}`, cents: c });
  }

  // ── Access surcharges ──────────────────────────────────────────────────────
  const flights = Math.floor(num(input.stairsFlights, 0, 0, 20));
  if (flights > 0) addLine(lines, "stairs", `Stairs — ${flights} flight${flights > 1 ? "s" : ""}`, flights * rates.stairsPerFlightCents, (c) => (subtotal += c));
  if (input.disassembly) addLine(lines, "disassembly", "Disassembly required", rates.disassemblyCents, (c) => (subtotal += c));
  if (input.demolition) addLine(lines, "demolition", "Small demolition", rates.demolitionCents, (c) => (subtotal += c));
  if (input.longCarry) addLine(lines, "long_carry", "Long carry to truck", rates.longCarryCents, (c) => (subtotal += c));
  if (input.noElevator) addLine(lines, "no_elevator", "No elevator", rates.noElevatorCents, (c) => (subtotal += c));
  if (input.outOfArea) addLine(lines, "out_of_area", "Outside free service area", rates.outOfAreaCents, (c) => (subtotal += c));

  // ── Minimum floor, last ────────────────────────────────────────────────────
  let total = Math.round(subtotal);
  if (total > 0 && total < rates.minimumCents) {
    lines.push({ key: "minimum", label: "Minimum charge", cents: rates.minimumCents - total });
    total = rates.minimumCents;
  }

  return {
    total,
    lines,
    volumeUnits: Math.round(volumeUnits * 10) / 10,
    loadFraction: Math.round((volumeUnits / rates.fullLoadUnits) * 100) / 100,
    warnings: { notAccepted, separateTruck },
  };
}

function addLine(lines, key, label, cents, add) {
  if (cents > 0) {
    add(cents);
    lines.push({ key, label, cents });
  }
}

/** A human phrase for how much truck a volume takes. */
function loadDescription(volumeUnits, rates) {
  const frac = volumeUnits / rates.fullLoadUnits;
  if (frac <= 0.125) return "a minimum load";
  if (frac <= 0.25) return "a quarter truck";
  if (frac <= 0.5) return "a half truck";
  if (frac <= 1) return "most of a truck";
  return `${Math.round(frac * 10) / 10} truckloads`;
}
