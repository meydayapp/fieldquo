// lib/ai/deepReadEvidence.js
//
// The TRADE-SPECIFIC half of the paid deep photo read (lib/ai/visionPass.js),
// and the photo-vs-quote mismatch check. Pure: no database, no model, no
// React — so every rule below is executed against hostile input by
// scripts/check-deep-read-evidence.mjs rather than reasoned about.
//
// ══ What the owner asked for (2026-09-22) ══════════════════════════════════
//
// The deep read returned a list of prose notes and nothing else. The owner
// asked for two things on the SAME call:
//
//   1. Evidence an estimator can use, in each trade's own terms — a junk
//      pile's size in truck-bed loads and what is in it (appliances,
//      mattresses, e-waste all carry fees), a roof's pitch cues, layers and
//      damage, how many cabinet doors are actually in the pictures, how many
//      treads on the staircase, the gutter run and its downspouts.
//   2. A warning when the photographs are not of the job at all — "a
//      picture of a roof on a quote for stairs" — shown on the review, never
//      blocking anything.
//
// ══ One call, not two ══════════════════════════════════════════════════════
//
// Both ride the one vision call the read already makes (VISION_PASS_CENTS,
// metered exactly as before). The schema is built PER QUOTE: only the
// evidence families of the trades the quote actually carries are requested,
// so a plumbing quote pays for no roofing fields and a stairs quote is not
// asked about junk. See familiesForTrades().
//
// ══ The rule the numbers live under ════════════════════════════════════════
//
// lib/ai/jsonSchema.js's header warns that a number-typed field in a schema
// "is a claim that a model's guess is good enough to show a contractor as a
// fact". That warning is why this file is shaped the way it is, not ignored:
//
//   - The model is asked for what a picture CAN carry: a count of things it
//     can actually see ("12 treads visible"), or a size in a unit you can
//     judge by eye (pickup-truck beds, not cubic yards), always with a
//     sentence saying HOW it judged it and a confidence.
//   - Conversions happen HERE, in code, with the constant written down
//     (PICKUP_BED_CU_YD). The model never does the arithmetic.
//   - Every quantity is rendered with an "estimate" label, and beside the
//     quote's own measured figure when there is one — measuredBeside() — never
//     instead of it. Nothing in this file, visionPass.js or either route writes
//     to a scope group, a takeoff, an intake value or a line. The measured
//     quantity is the estimator's; a photograph can only disagree with it.
//
// ══ Trade keys ═════════════════════════════════════════════════════════════
//
// Every trade here is a lib/trades/catalog.js key — the ServiceCategory.key a
// quote's scope group carries. No second vocabulary: the mismatch check
// compares the model's reading of each photo against the quote's own keys.

import { TRADE_CATALOG, tradeKeys } from "@/lib/trades/catalog";

/* ── Shared vocabulary ─────────────────────────────────────────────────────── */

export const CONFIDENCE = ["low", "medium", "high"];

/**
 * One full-size pickup bed, level full, in cubic yards.
 *
 * An 8-ft bed is roughly 8 × 5.3 × 1.7 ft ≈ 72 cu ft ≈ 2.7 cu yd; a 6.5-ft
 * bed is nearer 2.2. 2.5 is the round figure the junk trade itself quotes
 * ("a pickup load is about two and a half yards"), and it sits between the
 * two. The model is asked for BEDS because that is what a pile can be judged
 * against by eye; this constant is the only thing that turns it into yards.
 */
export const PICKUP_BED_CU_YD = 2.5;
export const CU_YD_TO_M3 = 0.764555;
export const FT_TO_M = 0.3048;

const clip = (s, max = 200) => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

const oneOf = (values, v, fallback = "unclear") => (values.includes(v) ? v : fallback);

const listOf = (values, v) => {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) if (values.includes(x) && !out.includes(x)) out.push(x);
  return out;
};

/** A count of things SEEN: a whole number, 0..max, or null. 0 is a real count. */
const seenCount = (v, max = 200) =>
  Number.isInteger(v) && v >= 0 && v <= max ? v : null;

/** A positive finite size within a plausible ceiling, or null. */
const size = (v, max) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);

/** Low/high → an ordered pair, either end standing in for a missing other. */
function range(lo, hi, max) {
  let a = size(lo, max);
  let b = size(hi, max);
  if (a == null && b == null) return null;
  if (a == null) a = b;
  if (b == null) b = a;
  if (a > b) [a, b] = [b, a];
  return { low: a, high: b };
}

const roundTo = (n, step) => Math.round(n / step) * step;

/* ── The evidence families ─────────────────────────────────────────────────── */
//
// One family per KIND of evidence, several catalogue trades may share one
// (interior and exterior painting; the two cabinet trades; flooring and
// flooring installation). Each family declares:
//
//   trades     catalogue keys that ask for it
//   schema     the strict-subset properties the model fills (every property
//              required, nullable where "not visible" is a real answer)
//   sanitise   raw model object → the stored shape, with conversions done
//              here and anything out of range dropped rather than clamped
//
// The enums are the whole vocabulary; each value has a label in all nine app
// catalogues (app.deepRead.v.*), so nothing the model writes in a field is
// ever shown raw except the `…Basis` sentences, which are its own words about
// how it judged, and are labelled as such.

const CONF_PROP = {
  type: "string",
  enum: CONFIDENCE,
  description: "How sure you are of THIS trade's evidence, from these photos alone.",
};
const basisProp = (what) => ({
  type: ["string", "null"],
  description: `One short sentence: how you judged ${what} — what you compared it against, which photos. null when it isn't visible.`,
});
const seenProp = (what) => ({
  type: ["integer", "null"],
  description: `${what} you can actually COUNT in the photos. A minimum — say in the basis what may be out of frame. null when you can't count them.`,
});
const enumProp = (values, description) => ({ type: "string", enum: values, description });
const enumList = (values, description) => ({ type: "array", items: { type: "string", enum: values }, description });

export const CONDITION = ["good", "worn", "damaged", "unclear"];

export const JUNK_ITEMS = [
  "furniture",
  "mattresses",
  "appliances_refrigerant",
  "appliances_other",
  "e_waste",
  "tires",
  "metal",
  "construction_debris",
  "heavy_debris",
  "yard_waste",
  "bagged_household",
  "hazardous_suspect",
];

/**
 * Item category → the special-handling rule lib/junk/pricing.js already
 * prices (its `special` keys), plus `hazard` for what a standard run refuses.
 * Derived HERE from the categories the model saw — the model is never asked
 * "which fees apply", because that is the company's rate card, not a picture.
 */
export const JUNK_SURCHARGE_FOR = {
  mattresses: "mattress",
  appliances_refrigerant: "refrigerant",
  e_waste: "ewaste",
  tires: "tire",
  heavy_debris: "heavy",
  construction_debris: "heavy",
  hazardous_suspect: "hazard",
};

export const ROOF_PITCH = ["low_or_flat", "moderate", "steep", "very_steep", "unclear"];
export const ROOF_LAYERS = ["one", "more_than_one_suspected", "unclear"];
export const ROOF_DAMAGE = [
  "missing_or_lifted_shingles",
  "curling_or_cupping",
  "granule_loss",
  "moss_or_debris",
  "sagging",
  "flashing_or_vents",
  "hail_or_impact",
  "none_visible",
];
export const PEELING = ["none_visible", "isolated_spots", "widespread", "unclear"];
export const COLOUR_CHANGE = ["no_concern", "extra_coat_or_primer_likely", "unclear"];
export const DOOR_STYLE = ["shaker", "slab", "raised_panel", "glass_front", "beadboard", "mixed", "unclear"];
export const CABINET_FINISH = ["painted", "stained_or_natural_wood", "thermofoil_or_laminate", "melamine", "unclear"];
export const FLOOR_MATERIAL = [
  "hardwood",
  "engineered_wood",
  "laminate",
  "vinyl_plank",
  "sheet_vinyl",
  "tile",
  "carpet",
  "concrete",
  "unclear",
];
export const STAIR_SHAPE = ["straight", "l_shaped", "u_shaped", "winders", "curved", "unclear"];
export const STOREYS = ["one", "two", "three_plus", "unclear"];
export const GUTTER_ISSUES = ["sagging", "leaking_or_overflowing", "clogged", "detached", "rust_or_holes", "none_visible"];

export const EVIDENCE_FAMILIES = {
  junk: {
    trades: ["junk_removal"],
    schema: {
      pickupBedsLow: {
        type: ["number", "null"],
        description:
          "Low end of the load's size, in full-size pickup-truck BEDS filled level (not cubic yards). null if the load isn't visible.",
      },
      pickupBedsHigh: { type: ["number", "null"], description: "High end of the same judgement, in pickup-truck beds." },
      volumeBasis: basisProp("the load's size"),
      items: enumList(JUNK_ITEMS, "Every category of item you can see in the load."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      const beds = range(raw.pickupBedsLow, raw.pickupBedsHigh, 60);
      const items = listOf(JUNK_ITEMS, raw.items);
      const surcharges = [];
      for (const it of items) {
        const s = JUNK_SURCHARGE_FOR[it];
        if (s && !surcharges.includes(s)) surcharges.push(s);
      }
      return {
        volume: beds
          ? {
              pickupBeds: { low: roundTo(beds.low, 0.5) || 0.5, high: roundTo(beds.high, 0.5) || 0.5 },
              cubicYards: {
                low: roundTo(beds.low * PICKUP_BED_CU_YD, 0.5) || 0.5,
                high: roundTo(beds.high * PICKUP_BED_CU_YD, 0.5) || 0.5,
              },
              cubicMetres: {
                low: roundTo(beds.low * PICKUP_BED_CU_YD * CU_YD_TO_M3, 0.5) || 0.5,
                high: roundTo(beds.high * PICKUP_BED_CU_YD * CU_YD_TO_M3, 0.5) || 0.5,
              },
              basis: clip(raw.volumeBasis),
              estimate: true,
            }
          : null,
        items,
        surcharges,
      };
    },
  },

  roofing: {
    trades: ["roofing_service"],
    schema: {
      pitch: enumProp(
        ROOF_PITCH,
        "Roof pitch from visible cues (how the rake reads from the ground, whether it's walkable): low_or_flat ≤3/12, moderate 4–6/12, steep 7–9/12, very_steep 10/12+.",
      ),
      pitchBasis: basisProp("the pitch"),
      layers: enumProp(ROOF_LAYERS, "More than one layer only when you see a cue: a thick or doubled edge at the rake or drip edge, lumpy telegraphing."),
      layersBasis: basisProp("the layers"),
      damage: enumList(ROOF_DAMAGE, "Damage you can see. ['none_visible'] only when the roof is clearly visible and sound."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      const damage = listOf(ROOF_DAMAGE, raw.damage);
      return {
        pitch: oneOf(ROOF_PITCH, raw.pitch),
        pitchBasis: clip(raw.pitchBasis),
        layers: oneOf(ROOF_LAYERS, raw.layers),
        layersBasis: clip(raw.layersBasis),
        // "none_visible" beside a real finding is a contradiction; the finding wins.
        damage: damage.length > 1 ? damage.filter((d) => d !== "none_visible") : damage,
      };
    },
  },

  painting: {
    trades: ["interior_painting", "exterior_painting"],
    schema: {
      condition: enumProp(CONDITION, "Condition of the surfaces to be painted."),
      peeling: enumProp(PEELING, "Peeling, flaking or blistering paint."),
      currentColour: {
        type: ["string", "null"],
        description: "The existing colour in two or three plain words (e.g. 'dark navy', 'off-white'). Never a brand or a paint code.",
      },
      colourChange: enumProp(
        COLOUR_CHANGE,
        "Whether the existing colour is dark or saturated enough that covering it likely needs an extra coat or a primer.",
      ),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      return {
        condition: oneOf(CONDITION, raw.condition),
        peeling: oneOf(PEELING, raw.peeling),
        currentColour: clip(raw.currentColour, 60),
        colourChange: oneOf(COLOUR_CHANGE, raw.colourChange),
      };
    },
  },

  cabinets: {
    trades: ["cabinet_refinishing", "cabinet_refacing"],
    schema: {
      doorsSeen: seenProp("Cabinet doors"),
      drawersSeen: seenProp("Drawer fronts"),
      countBasis: basisProp("the counts"),
      doorStyle: enumProp(DOOR_STYLE, "The door style."),
      finish: enumProp(CABINET_FINISH, "The existing finish. Never a brand."),
      condition: enumProp(CONDITION, "Condition of the doors and boxes."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      return {
        doorsSeen: seenCount(raw.doorsSeen),
        drawersSeen: seenCount(raw.drawersSeen),
        countBasis: clip(raw.countBasis),
        doorStyle: oneOf(DOOR_STYLE, raw.doorStyle),
        finish: oneOf(CABINET_FINISH, raw.finish),
        condition: oneOf(CONDITION, raw.condition),
      };
    },
  },

  flooring: {
    trades: ["flooring", "flooring_install"],
    schema: {
      currentMaterial: enumProp(FLOOR_MATERIAL, "What the existing floor looks like it is. Never a brand."),
      transitionsSeen: seenProp("Transitions — thresholds, reducers, doorways where the floor changes —"),
      transitionsBasis: basisProp("the transitions"),
      condition: enumProp(CONDITION, "Condition of the existing floor."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      return {
        currentMaterial: oneOf(FLOOR_MATERIAL, raw.currentMaterial),
        transitionsSeen: seenCount(raw.transitionsSeen, 60),
        transitionsBasis: clip(raw.transitionsBasis),
        condition: oneOf(CONDITION, raw.condition),
      };
    },
  },

  stairs: {
    trades: ["stairs"],
    schema: {
      treadsSeen: seenProp("Treads"),
      risersSeen: seenProp("Risers"),
      countBasis: basisProp("the counts"),
      shape: enumProp(STAIR_SHAPE, "The staircase's shape."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      return {
        treadsSeen: seenCount(raw.treadsSeen, 80),
        risersSeen: seenCount(raw.risersSeen, 80),
        countBasis: clip(raw.countBasis),
        shape: oneOf(STAIR_SHAPE, raw.shape),
      };
    },
  },

  gutters: {
    trades: ["gutter_services"],
    schema: {
      runFtLow: {
        type: ["number", "null"],
        description: "Low end of the visible gutter run in feet, judged against something of known size (a garage door is ~8 or ~16 ft wide). null if you can't judge it.",
      },
      runFtHigh: { type: ["number", "null"], description: "High end of the same judgement, in feet." },
      lengthBasis: basisProp("the length"),
      downspoutsSeen: seenProp("Downspouts"),
      storeys: enumProp(STOREYS, "Storeys at the eave line."),
      issues: enumList(GUTTER_ISSUES, "Problems you can see. ['none_visible'] only when the gutters are clearly visible and sound."),
      confidence: CONF_PROP,
    },
    sanitise(raw) {
      const run = range(raw.runFtLow, raw.runFtHigh, 2000);
      const issues = listOf(GUTTER_ISSUES, raw.issues);
      return {
        length: run
          ? {
              feet: { low: roundTo(run.low, 5) || 5, high: roundTo(run.high, 5) || 5 },
              metres: { low: Math.round(run.low * FT_TO_M) || 1, high: Math.round(run.high * FT_TO_M) || 1 },
              basis: clip(raw.lengthBasis),
              estimate: true,
            }
          : null,
        downspoutsSeen: seenCount(raw.downspoutsSeen, 40),
        storeys: oneOf(STOREYS, raw.storeys),
        issues: issues.length > 1 ? issues.filter((d) => d !== "none_visible") : issues,
      };
    },
  },
};

export const FAMILY_KEYS = Object.keys(EVIDENCE_FAMILIES);

/** The family a catalogue trade asks for, or null. */
export function familyForTrade(tradeKey) {
  for (const f of FAMILY_KEYS) if (EVIDENCE_FAMILIES[f].trades.includes(tradeKey)) return f;
  return null;
}

/**
 * The families a quote's trades ask for, de-duplicated, in the quote's order.
 * Capped at MAX_FAMILIES: a quote carrying five trades still gets one vision
 * call with a bounded schema, and the first services on the document — the
 * ones an estimator put first — are the ones read.
 */
export const MAX_FAMILIES = 3;
export function familiesForTrades(tradeKeys = []) {
  const out = [];
  for (const k of Array.isArray(tradeKeys) ? tradeKeys : []) {
    const f = familyForTrade(k);
    if (f && !out.includes(f)) out.push(f);
    if (out.length >= MAX_FAMILIES) break;
  }
  return out;
}

/** Catalogue keys a document's scope groups carry, in order, de-duplicated. */
export function tradeKeysOf(scopeGroups) {
  const out = [];
  for (const g of Array.isArray(scopeGroups) ? scopeGroups : []) {
    const k = g?.category?.key;
    if (typeof k === "string" && TRADE_CATALOG[k] && !out.includes(k)) out.push(k);
  }
  return out;
}

/* ── The schema of the one call ────────────────────────────────────────────── */

/**
 * The per-photo scene reading. `trades` is an enum of every catalogue key —
 * the ONLY vocabulary the mismatch check compares, so it cannot drift from
 * what a scope group carries.
 */
function photosProp() {
  return {
    type: "array",
    description:
      "One entry per photo, in the order given. Judge each from the picture ALONE, as if you had not read the quote.",
    items: {
      type: "object",
      properties: {
        photo: { type: "integer", description: "1-based position of the photo in the order given." },
        trades: {
          type: "array",
          items: { type: "string", enum: tradeKeys() },
          description: "Every trade whose work area this photo plausibly shows. Empty when you can't tell.",
        },
        shows: { type: ["string", "null"], description: "Five to ten plain words: what the photo shows." },
        confidence: { type: "string", enum: CONFIDENCE, description: "How clearly the photo shows a work area." },
      },
      required: ["photo", "trades", "shows", "confidence"],
      additionalProperties: false,
    },
  };
}

/**
 * The whole schema for one deep read. `notes` is exactly the field the read
 * always returned; `photos` is new on every read; `evidence` is present only
 * when the quote carries a trade with a family.
 */
export function deepReadSchema(families = []) {
  const fams = families.filter((f) => EVIDENCE_FAMILIES[f]);
  const properties = {
    notes: {
      type: "array",
      description: "Short lines about things an estimator may have missed. Empty is a real answer.",
      items: { type: "string" },
    },
    photos: photosProp(),
  };
  const required = ["notes", "photos"];
  if (fams.length) {
    const evProps = {};
    for (const f of fams) {
      evProps[f] = {
        type: "object",
        properties: EVIDENCE_FAMILIES[f].schema,
        required: Object.keys(EVIDENCE_FAMILIES[f].schema),
        additionalProperties: false,
      };
    }
    properties.evidence = {
      type: "object",
      description: "Trade-specific evidence, one object per trade family listed. Visual estimates only.",
      properties: evProps,
      required: fams,
      additionalProperties: false,
    };
    required.push("evidence");
  }
  return { type: "object", properties, required, additionalProperties: false };
}

/* ── Turning the model's answer into what is stored ────────────────────────── */

/**
 * The per-photo reading, cleaned: photo numbers must name a photo that was
 * sent (1..photosRead), a number named twice keeps its first reading, and a
 * trade outside the catalogue is dropped. An unusable entry is dropped, not
 * repaired — a photo with no reading is "unclear", which is a real answer.
 */
export function sanitisePhotos(raw, photosRead) {
  const out = [];
  const seen = new Set();
  for (const p of Array.isArray(raw) ? raw : []) {
    if (!p || typeof p !== "object") continue;
    const n = p.photo;
    if (!Number.isInteger(n) || n < 1 || n > photosRead || seen.has(n)) continue;
    seen.add(n);
    const trades = [];
    for (const k of Array.isArray(p.trades) ? p.trades : []) {
      if (typeof k === "string" && TRADE_CATALOG[k] && !trades.includes(k)) trades.push(k);
    }
    out.push({
      photo: n,
      trades: trades.slice(0, 4),
      shows: clip(p.shows, 120),
      confidence: oneOf(CONFIDENCE, p.confidence, "low"),
    });
  }
  return out.sort((a, b) => a.photo - b.photo);
}

/**
 * Evidence per family, sanitised, with its confidence kept alongside. Only the
 * families that were ASKED for survive — a model volunteering roofing
 * evidence on a stairs quote is not evidence the estimator paid to have read.
 */
export function sanitiseEvidence(raw, families = []) {
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const f of families) {
    const def = EVIDENCE_FAMILIES[f];
    const r = src[f];
    if (!def || !r || typeof r !== "object") continue;
    out[f] = { ...def.sanitise(r), confidence: oneOf(CONFIDENCE, r.confidence, "low") };
  }
  return out;
}

/* ── Photo vs quote: the mismatch check ────────────────────────────────────── */
//
// Computed at READ time against the document's CURRENT trades, never stored:
// an estimator who fixes the scope from Stairs to Roofing after seeing the
// warning must see it go away, and a stored verdict would keep accusing the
// quote of a mistake it no longer makes.
//
// Two trades are compatible when they are the same key, when either is a
// generalist (a renovation or a handyman quote can legitimately show any
// room), or when they share a WORK AREA below. Areas, not the marketing
// industries: TrueFinish's industry puts cabinets and stairs together, and a
// kitchen photo on a stairs quote is exactly the thing worth flagging —
// while a roof photo on a gutter quote is not, because a gutter hangs off the
// roof edge.

export const GENERALIST_TRADES = new Set([
  "handyman",
  "general_contracting",
  "general_contracting_reno",
  "remodeling",
  "construction",
  "carpentry",
  "demolition",
  "demolition_contractor",
  "restoration",
  "home_inspection",
  "property_maintenance",
  "installation_services",
  "residential_cleaning",
  "deep_cleaning",
  "commercial_cleaning",
  "janitorial",
  "pest_control",
  "wildlife_control",
  "baby_proofing",
  "dog_walking",
]);

export const WORK_AREAS = {
  cabinet_refinishing: ["kitchen_bath"],
  cabinet_refacing: ["kitchen_bath"],
  countertop: ["kitchen_bath"],
  kitchen_design: ["kitchen_bath"],
  flooring: ["floor", "stairs"],
  flooring_install: ["floor", "stairs"],
  tiling: ["floor", "kitchen_bath", "interior_wall"],
  carpet_cleaning: ["floor", "stairs"],
  epoxy: ["floor", "hardscape"],
  stairs: ["stairs"],
  interior_painting: ["interior_wall"],
  drywall: ["interior_wall"],
  drywall_install: ["interior_wall"],
  insulation: ["attic", "interior_wall"],
  exterior_painting: ["exterior_wall", "eaves", "fence_deck", "door_window"],
  siding: ["exterior_wall", "eaves"],
  pressure_washing_house: ["exterior_wall", "eaves", "fence_deck", "hardscape"],
  window_cleaning: ["door_window", "exterior_wall"],
  caulking_sealants: ["door_window", "kitchen_bath", "exterior_wall"],
  doors_windows: ["door_window", "exterior_wall"],
  glass: ["door_window"],
  locksmith: ["door_window"],
  garage_door: ["door_window", "exterior_wall"],
  roofing_service: ["roof", "eaves", "chimney"],
  gutter_services: ["eaves", "roof", "exterior_wall"],
  chimney_sweep: ["chimney", "roof"],
  solar_energy: ["roof", "electrical"],
  concrete: ["hardscape", "foundation"],
  masonry: ["hardscape", "exterior_wall", "foundation", "chimney"],
  parging: ["foundation", "exterior_wall"],
  excavation: ["yard", "foundation"],
  paving: ["hardscape"],
  driveway_sealing: ["hardscape"],
  pressure_washing_driveway: ["hardscape", "fence_deck"],
  snow_removal: ["hardscape", "yard", "roof"],
  fence_services: ["fence_deck", "yard"],
  fence_repair: ["fence_deck", "yard"],
  fence_restoration: ["fence_deck", "yard"],
  deck_patio: ["fence_deck", "hardscape", "yard"],
  landscaping_design: ["yard", "hardscape"],
  lawn_care: ["yard"],
  lawn_mowing: ["yard"],
  irrigation: ["yard"],
  tree_care_service: ["yard", "roof"],
  pooper_scooper: ["yard"],
  pool_spa: ["pool", "yard"],
  sewer_septic: ["yard", "plumbing"],
  well_water: ["yard", "plumbing", "mechanical"],
  plumbing: ["plumbing", "kitchen_bath"],
  electrical: ["electrical"],
  lighting: ["electrical", "interior_wall", "exterior_wall"],
  security_systems: ["electrical", "door_window", "exterior_wall"],
  smart_home: ["electrical", "interior_wall"],
  hvac_install: ["mechanical"],
  hvac_repair: ["mechanical"],
  air_duct_cleaning: ["mechanical"],
  mechanical_contracting: ["mechanical", "plumbing"],
  elevator_services: ["mechanical"],
  appliance_repair: ["appliance", "kitchen_bath"],
  junk_removal: ["items"],
  moving: ["items"],
  furniture_upholstery: ["items"],
  home_organization: ["items", "interior_wall"],
  auto_detailing: ["vehicle"],
  marine_services: ["vehicle"],
};

/** Whether a photo read as trade `b` can belong to a document for trade `a`. */
export function tradesCompatible(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (GENERALIST_TRADES.has(a) || GENERALIST_TRADES.has(b)) return true;
  const A = WORK_AREAS[a];
  const B = WORK_AREAS[b];
  if (!A || !B) return false;
  return A.some((x) => B.includes(x));
}

/**
 * The verdict for one stored pass against the document's current trades.
 *
 *   unknown    no trade on the document to compare with, or a pass from before
 *              photos were read per picture — no statement either way
 *   unclear    every photo was low-confidence or unreadable — ambiguous
 *              photos never raise a warning
 *   match      every photo that could be judged fits at least one trade
 *   mismatch   at least one clearly-read photo fits none of them; the photos
 *              are listed with what they looked like
 *
 * A generalist trade on the document (renovation, handyman…) is a match for
 * anything: a general contractor's photos can show any room of the house.
 */
export function deepReadMismatch({ photos, documentTrades }) {
  const quoteTrades = (Array.isArray(documentTrades) ? documentTrades : []).filter(
    (k, i, a) => typeof k === "string" && TRADE_CATALOG[k] && a.indexOf(k) === i,
  );
  const base = { quoteTrades, photos: [], judged: 0, unclear: 0 };
  if (!quoteTrades.length) return { ...base, verdict: "unknown" };
  if (!Array.isArray(photos) || !photos.length) return { ...base, verdict: "unknown" };

  const judged = photos.filter((p) => p && p.confidence !== "low" && Array.isArray(p.trades) && p.trades.length);
  const unclear = photos.length - judged.length;
  if (!judged.length) return { ...base, unclear, verdict: "unclear" };
  if (quoteTrades.some((k) => GENERALIST_TRADES.has(k))) return { ...base, judged: judged.length, unclear, verdict: "match" };

  const off = judged.filter((p) => !p.trades.some((d) => quoteTrades.some((q) => tradesCompatible(q, d))));
  return {
    quoteTrades,
    judged: judged.length,
    unclear,
    photos: off.map((p) => ({ photo: p.photo, trades: p.trades, shows: p.shows || null })),
    verdict: off.length ? "mismatch" : "match",
  };
}

/* ── Beside the measured figure, never instead of it ───────────────────────── */

const pos = (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

const sumSections = (takeoff, key) => {
  const secs = Array.isArray(takeoff?.sections) ? takeoff.sections : [];
  let total = 0;
  for (const s of secs) total += pos(s?.[key]) || 0;
  return total > 0 ? total : null;
};

/** 4/12 → the same bands the pitch enum is described in. */
export function pitchBand(rise) {
  const r = pos(rise);
  if (r == null) return null;
  if (r <= 3) return "low_or_flat";
  if (r <= 6) return "moderate";
  if (r <= 9) return "steep";
  return "very_steep";
}

/**
 * What the document already MEASURED, per family, from its scope groups —
 * the takeoff first (the builder's own figures), the intake values second
 * (what an instant estimate or the intake form recorded). Summed across the
 * groups of that family's trades.
 */
function measuredFor(family, groups) {
  const mine = groups.filter((g) => EVIDENCE_FAMILIES[family].trades.includes(g?.category?.key));
  if (!mine.length) return {};
  const t = (g) => (g?.takeoff && typeof g.takeoff === "object" ? g.takeoff : {});
  const iv = (g) => (g?.intakeValues && typeof g.intakeValues === "object" ? g.intakeValues : {});
  const total = (pick) => {
    let sum = 0;
    let any = false;
    for (const g of mine) {
      const v = pick(g);
      if (v != null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  };
  switch (family) {
    case "stairs":
      return {
        treads: total((g) => sumSections(t(g), "treads") ?? pos(iv(g).treads) ?? pos(iv(g).stepCount)),
        risers: total((g) => sumSections(t(g), "risers")),
      };
    case "cabinets":
      return {
        doors: total((g) => pos(t(g).doors) ?? pos(iv(g).doorCount)),
        drawers: total((g) => pos(t(g).drawers) ?? pos(iv(g).drawerCount)),
      };
    case "gutters":
      return {
        gutterFt: total((g) => pos(t(g).gutterFt)),
        downspouts: total((g) => pos(t(g).downspoutsInstalled)),
      };
    case "roofing": {
      const g = mine.find((x) => pos(t(x).pitchRise) != null || pos(t(x).layers) != null);
      return g ? { pitchRise: pos(t(g).pitchRise), layers: pos(t(g).layers) } : {};
    }
    default:
      return {};
  }
}

/**
 * Rows pairing a photo estimate with the document's measured figure.
 *
 * The measured figure is returned UNCHANGED and marked `kept`; the estimate
 * is beside it and marked `estimate`. `differs` is the one judgement made
 * here, and it is asymmetric for counts on purpose: a photo sees a MINIMUM
 * (a tread can be out of frame), so seeing fewer than the quote counts is
 * normal and silent — seeing MORE than the quote counts is the finding.
 */
export function measuredBeside({ evidence, scopeGroups }) {
  const rows = [];
  const groups = Array.isArray(scopeGroups) ? scopeGroups : [];
  const ev = evidence && typeof evidence === "object" ? evidence : {};
  const count = (family, field, measured, seen, unit) => {
    if (measured == null || seen == null) return;
    rows.push({ family, field, unit, measured: { value: measured, kept: true }, estimate: { low: seen, high: seen, seen: true }, differs: seen > measured });
  };
  const span = (family, field, measured, est, unit) => {
    if (measured == null || !est) return;
    rows.push({ family, field, unit, measured: { value: measured, kept: true }, estimate: { ...est }, differs: measured < est.low * 0.75 || measured > est.high * 1.25 });
  };

  if (ev.stairs) {
    const m = measuredFor("stairs", groups);
    count("stairs", "treads", m.treads, ev.stairs.treadsSeen, "tread");
    count("stairs", "risers", m.risers, ev.stairs.risersSeen, "riser");
  }
  if (ev.cabinets) {
    const m = measuredFor("cabinets", groups);
    count("cabinets", "doors", m.doors, ev.cabinets.doorsSeen, "door");
    count("cabinets", "drawers", m.drawers, ev.cabinets.drawersSeen, "drawer");
  }
  if (ev.gutters) {
    const m = measuredFor("gutters", groups);
    span("gutters", "length", m.gutterFt, ev.gutters.length?.feet, "ft");
    count("gutters", "downspouts", m.downspouts, ev.gutters.downspoutsSeen, "downspout");
  }
  if (ev.roofing) {
    const m = measuredFor("roofing", groups);
    const order = ROOF_PITCH.slice(0, 4);
    const band = pitchBand(m.pitchRise);
    if (band && ev.roofing.pitch !== "unclear") {
      rows.push({
        family: "roofing",
        field: "pitch",
        unit: "pitch",
        measured: { value: m.pitchRise, kept: true },
        estimate: { band: ev.roofing.pitch },
        // One band either side is the resolution of a photograph.
        differs: Math.abs(order.indexOf(band) - order.indexOf(ev.roofing.pitch)) >= 2,
      });
    }
    if (m.layers != null && ev.roofing.layers !== "unclear") {
      rows.push({
        family: "roofing",
        field: "layers",
        unit: "layer",
        measured: { value: m.layers, kept: true },
        estimate: { band: ev.roofing.layers },
        differs: (m.layers > 1) !== (ev.roofing.layers === "more_than_one_suspected"),
      });
    }
  }
  return rows;
}
