// lib/junk/pricing.js
//
// Pricing a junk-removal / dumping job.
//
// ══ Two ways the trade quotes, and this does both ══════════════════════════
//
//   by load    a fraction of the truck — minimum (1/8), quarter, half, full.
//              Volume wins because it's fair and explainable: a couch takes the
//              same truck space whether it weighs 100 lb or 300. This is the
//              default, and matches how 1-800-GOT-JUNK and most operators price.
//   by item    a flat price per named item, for the "just this couch" call.
//
// ══ The money the trade leaves on the table ════════════════════════════════
//
// The disposal fee at the transfer station is what turns a profitable haul into
// a loss, and it's the thing a naive quote misses:
//
//   refrigerant  a fridge/freezer/AC needs the Freon reclaimed, a fee AND — as
//                the city's own rules say — usually a SEPARATE TRUCK. Quoting it
//                like a regular item under-prices it and promises one trip that
//                can't happen.
//   e-waste      a TV or computer is a recycling fee, not a favour.
//   mattress     its own recycling fee in many regions.
//   tire         a per-tire disposal fee; rims are separate.
//   heavy        concrete, dirt, wood — priced by weight/volume because the dump
//                charges by the tonne, not the truckload.
//
// ══ What it REFUSES to price ═══════════════════════════════════════════════
//
// Propane tanks, gasoline appliances, and other hazards aren't a line item —
// they're a warning. The quote flags them so the customer knows they're not
// collected, rather than silently pricing a haul the crew will refuse on the
// doorstep.
//
// Pure. Company rates in, an itemised quote out. No database.

/** Every rate a company can set. Starting points — a company edits its own. */
export const DEFAULT_JUNK_RATES = {
  // Truck-load fractions, cents. Mid-points of the 2026 market ranges.
  loadCents: {
    minimum: 13500, // 1/8 load ($100–175)
    quarter: 22500, // ($150–300)
    half: 40000, //    ($250–550)
    full: 77500, //    full truck ($550–1,000)
  },

  // Below this a stop doesn't cover the drive and the dump run.
  minimumCents: 9000,

  // Flat per-item, for a single-item call that skips the load tiers.
  itemCents: {
    couch: 12000,
    mattress: 9500,
    appliance: 11000, // washer, dryer, dishwasher (non-refrigerant)
    furniture: 6000, // table, dresser, chair
    tv: 6500,
    hot_tub: 45000, // heavy, awkward, often needs cutting
    exercise_equipment: 9000,
    bbq: 5000,
  },

  // Special-handling surcharges, ADDED on top of the item/load price.
  refrigerantFeeCents: 4500, // Freon reclaim
  ewasteFeeCents: 3000,
  mattressFeeCents: 1500,
  tirePerUnitCents: 800,
  heavyPerLoadCents: 17500, // concrete / dirt / masonry, per truck-bed

  // Access.
  stairsPerFlightCents: 2500,
};

/**
 * The item taxonomy — informed by the City of Gatineau bulky-collection list and
 * the trade's own categories.
 *
 * `special` marks items that carry a surcharge and/or handling rule.
 * `notAccepted` marks items a standard junk run WON'T take — the quote warns
 * rather than prices them.
 */
export const JUNK_ITEMS = [
  // Everyday
  { key: "couch", label: "Sofa / couch / armchair" },
  { key: "furniture", label: "Furniture (table, dresser, desk, chair)" },
  { key: "mattress", label: "Mattress / box spring", special: "mattress" },
  { key: "exercise_equipment", label: "Exercise equipment" },
  { key: "bbq", label: "BBQ (propane tank removed)" },
  { key: "carpet", label: "Carpet (rolled & tied)" },

  // Appliances — the refrigerant split matters
  { key: "appliance", label: "Washer / dryer / dishwasher / stove" },
  { key: "refrigerator", label: "Refrigerator / freezer", special: "refrigerant" },
  { key: "air_conditioner", label: "Air conditioner / dehumidifier", special: "refrigerant" },
  { key: "water_cooler", label: "Water cooler", special: "refrigerant" },

  // Electronics
  { key: "tv", label: "TV / monitor", special: "ewaste" },
  { key: "computer", label: "Computer / electronics", special: "ewaste" },

  // Tires & metal
  { key: "tire", label: "Tire (with or without rim)", special: "tire" },
  { key: "metal", label: "Metal item (sink, heater, gate)" },

  // Heavy / construction
  { key: "concrete", label: "Concrete / brick / masonry", special: "heavy" },
  { key: "dirt", label: "Dirt / soil / sod", special: "heavy" },
  { key: "wood_debris", label: "Lumber / renovation wood", special: "heavy" },
  { key: "shed", label: "Dismantled shed / gazebo panels" },

  // Outdoors / large plastic
  { key: "hot_tub", label: "Hot tub / above-ground pool" },
  { key: "large_plastic", label: "Large plastic (furniture, toys, stroller)" },
  { key: "swing_set", label: "Swing set / play structure (disassembled)" },

  // NOT accepted on a standard run — flagged, never priced
  { key: "propane", label: "Propane tank", notAccepted: true },
  { key: "gas_appliance", label: "Gasoline appliance (mower, blower)", notAccepted: true },
  { key: "paint_chemicals", label: "Paint / solvents / chemicals", notAccepted: true },
  { key: "asbestos", label: "Asbestos / hazardous material", notAccepted: true },
];

const ITEM_BY_KEY = new Map(JUNK_ITEMS.map((i) => [i.key, i]));

export const LOAD_TIERS = ["minimum", "quarter", "half", "full"];

function num(v, fallback = 0, min = 0, max = 1e7) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Fill every rate with a finite number; a saved blob missing a key still works. */
export function normaliseJunkRates(input) {
  const r = input && typeof input === "object" ? input : {};
  const load = { ...DEFAULT_JUNK_RATES.loadCents, ...(r.loadCents || {}) };
  const item = { ...DEFAULT_JUNK_RATES.itemCents, ...(r.itemCents || {}) };
  const out = {
    loadCents: {},
    itemCents: {},
    minimumCents: num(r.minimumCents, DEFAULT_JUNK_RATES.minimumCents, 0),
    refrigerantFeeCents: num(r.refrigerantFeeCents, DEFAULT_JUNK_RATES.refrigerantFeeCents, 0),
    ewasteFeeCents: num(r.ewasteFeeCents, DEFAULT_JUNK_RATES.ewasteFeeCents, 0),
    mattressFeeCents: num(r.mattressFeeCents, DEFAULT_JUNK_RATES.mattressFeeCents, 0),
    tirePerUnitCents: num(r.tirePerUnitCents, DEFAULT_JUNK_RATES.tirePerUnitCents, 0),
    heavyPerLoadCents: num(r.heavyPerLoadCents, DEFAULT_JUNK_RATES.heavyPerLoadCents, 0),
    stairsPerFlightCents: num(r.stairsPerFlightCents, DEFAULT_JUNK_RATES.stairsPerFlightCents, 0),
  };
  for (const k of LOAD_TIERS) out.loadCents[k] = num(load[k], DEFAULT_JUNK_RATES.loadCents[k], 0);
  for (const k of Object.keys(item)) out.itemCents[k] = num(item[k], DEFAULT_JUNK_RATES.itemCents[k] ?? 0, 0);
  return out;
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
 *   mode: "load" | "items",
 *   tier: "minimum"|"quarter"|"half"|"full",  // when mode = load
 *   items: [{ key, quantity }],               // always allowed — special items
 *                                              // and their fees apply in BOTH modes
 *   stairsFlights: number,
 *   heavyLoads: number,                        // truck-beds of concrete/dirt
 * }
 * @param ratesInput  the company's rate card (or nothing → defaults)
 * @returns {
 *   total,               // cents, after the minimum floor
 *   lines: [{ key, label, cents, quantity? }],
 *   warnings: {
 *     notAccepted: [{ key, label }],   // hazards to tell the customer about
 *     separateTruck: [{ key, label }], // refrigerant/e-waste needing another run
 *   },
 * }
 */
export function priceJunk(input, ratesInput) {
  if (!input || typeof input !== "object") input = {};
  const rates = normaliseJunkRates(ratesInput);

  const lines = [];
  const notAccepted = [];
  const separateTruck = [];
  let subtotal = 0;

  // ── Base: a load fraction, or nothing (item-only job) ──────────────────────
  if (input.mode === "load" && rates.loadCents[input.tier] != null) {
    const c = rates.loadCents[input.tier];
    subtotal += c;
    lines.push({ key: `load_${input.tier}`, label: loadLabel(input.tier), cents: c });
  }

  // ── Items: flat price (item mode) + special fees (either mode) ─────────────
  const items = Array.isArray(input.items) ? input.items : [];
  for (const raw of items) {
    const key = typeof raw === "string" ? raw : raw?.key;
    const spec = ITEM_BY_KEY.get(key);
    if (!spec) continue; // an item we don't recognise is dropped, never priced
    const qty = Math.max(1, Math.floor(num(raw?.quantity, 1, 1, 500)));

    if (spec.notAccepted) {
      notAccepted.push({ key: spec.key, label: spec.label });
      continue; // NEVER priced — it's a warning, not a line
    }

    // Flat item price only in item mode; in load mode the load covers the bulk
    // and only the special surcharge is added (a fridge in a half-load still
    // owes its Freon fee).
    if (input.mode === "items") {
      const flat = rates.itemCents[key];
      if (flat != null) {
        const c = flat * qty;
        subtotal += c;
        lines.push({ key: `item_${key}`, label: spec.label, cents: c, quantity: qty });
      }
    }

    // Special-handling surcharge, in BOTH modes.
    if (spec.special && spec.special !== "heavy") {
      const fee = specialFee(spec.special, rates) * qty;
      if (fee > 0) {
        subtotal += fee;
        lines.push({ key: `fee_${key}`, label: `${spec.label} — handling`, cents: fee, quantity: qty });
      }
      if (spec.special === "refrigerant" || spec.special === "ewaste") {
        separateTruck.push({ key: spec.key, label: spec.label });
      }
    }
  }

  // ── Heavy debris, per truck-bed ────────────────────────────────────────────
  const heavyLoads = Math.floor(num(input.heavyLoads, 0, 0, 50));
  if (heavyLoads > 0) {
    const c = heavyLoads * rates.heavyPerLoadCents;
    subtotal += c;
    lines.push({ key: "heavy", label: `Heavy debris — ${heavyLoads} load${heavyLoads > 1 ? "s" : ""}`, cents: c });
  }

  // ── Stairs ─────────────────────────────────────────────────────────────────
  const flights = Math.floor(num(input.stairsFlights, 0, 0, 20));
  if (flights > 0) {
    const c = flights * rates.stairsPerFlightCents;
    subtotal += c;
    lines.push({ key: "stairs", label: `Stairs — ${flights} flight${flights > 1 ? "s" : ""}`, cents: c });
  }

  // ── Minimum floor, last ────────────────────────────────────────────────────
  let total = Math.round(subtotal);
  if (total > 0 && total < rates.minimumCents) {
    lines.push({ key: "minimum", label: "Minimum charge", cents: rates.minimumCents - total });
    total = rates.minimumCents;
  }

  return { total, lines, warnings: { notAccepted, separateTruck } };
}

function loadLabel(tier) {
  return {
    minimum: "Minimum load (about 1/8 of a truck)",
    quarter: "Quarter truckload",
    half: "Half truckload",
    full: "Full truckload",
  }[tier] || "Load";
}
