// app/data/priceBooks/structural.js
//
// The seven structural trades: concrete, asphalt paving, masonry, stucco/EIFS,
// framing, demolition and deck building — plus a cost recipe for sealcoating,
// which already has a sell book and did not need a second one.
//
// This file is a STAGING file. Nothing imports it yet. It exports the three
// catalogues in the shape the live ones use so they can be spread in:
//
//   STRUCTURAL_PRICE_BOOKS   → app/data/tradePriceBooks.js  TRADE_PRICE_BOOKS
//   STRUCTURAL_RECIPES       → app/data/materialRecipes.js  MATERIAL_RECIPES
//   STRUCTURAL_ADD_ONS       → app/data/standardAddOns.js   STANDARD_ADDONS
//
// and four supporting exports the merge also needs, because a book without
// them is a rate card nobody can edit:
//
//   STRUCTURAL_PRICE_BOOK_FIELDS   → PRICE_BOOK_FIELDS
//   STRUCTURAL_PRICE_BOOK_GROUPS   → PRICE_BOOK_GROUPS
//   STRUCTURAL_RECIPE_FIELDS       → RECIPE_EDITABLE_FIELDS
//   STRUCTURAL_CONSUMABLE_FIELDS   → CONSUMABLE_EDITABLE_FIELDS
//
// scripts/check-pricebook-structural.mjs performs that merge against the real
// modules and runs the real helpers over the result, so what the merge will do
// is asserted rather than hoped for.
//
// ── Where these numbers come from, and what they are not ────────────────────
//
// The paving and snow-removal books in tradePriceBooks.js are anchored to real
// signed invoices from one Ottawa contractor. Nothing here is. These are
// published-range midpoints for North American residential work, read against
// the trade's own productivity conventions, at 2025 price levels. That is a
// weaker provenance and it is stated on every entry rather than glossed: the
// `basis` string says what a figure assumes and `confidence` says how it was
// arrived at, using the same three-tag register as app/data/electricalBenchmarks.js:
//
//   read     A published band or a standing trade constant (6.75 modular brick
//            per square foot, 145 lb/cu ft compacted asphalt). Reproducible by
//            anybody who looks it up.
//   derived  Computed from `read` inputs — a crew-day divided into an area, a
//            density turned into a coverage. `basis` says from what.
//   guess    Not used. An entry with no evidence is ABSENT and named in the
//            book's own `notPriced` array instead. A guessed default is the
//            control that appears to work and doesn't, and it lands on a
//            document a homeowner signs.
//
// Every one of these is a starting point a contractor is expected to edit in
// the first week. Where a genuine range exists the mid-to-conservative point of
// it was taken and the band is printed in `basis` so the direction to move is
// visible.
//
// ── Two currencies, reasoned twice, never converted ─────────────────────────
//
// Every money value is `{ usd, cad }` — two independent figures, each read
// against its own market. There is no exchange rate in this file and there must
// never be one. app/data/electricalMaterials.js already argues this at length
// and measured the trap: Canadian shelf prices sit at 1.24–1.31× US list while
// the live FX rate runs 1.35–1.40, so `USD × FX` overprices Canadian materials
// by 5–10%. The trades here make it worse in both directions — Canadian cedar
// and SPF framing lumber are cheaper relative to US prices because the mills
// are here, and Canadian composite decking is dearer because it is imported in
// smaller volumes. A single ratio cannot be right for both, and the pairs below
// deliberately do not share one.
//
// ── Why the pair, and not a single number like every shipped book ───────────
//
// The shipped books hold plain numbers and Settings > Services renders them
// through PRICE_BOOK_FIELDS with `readField(book, path)` straight into a number
// input. A `{ usd, cad }` object rendered into that input reads "[object
// Object]", so the merge MUST flatten before the rate card sees a book:
//
//   flattenPriceBook(getPriceBook(key, overrides), currencyForCountry(country))
//
// That one call site is the whole cost of the pair, and it buys a US contractor
// US defaults instead of Ottawa ones. lib/currency.js already resolves a
// company's currency from its country, so the input exists.
//
// The flattener takes a plain number as already-flat. That is what makes a
// company override work untouched: RateCard writes a bare number, mergeDeep
// replaces the whole pair with it, and the flattener passes it through. A
// company's own price is in a company's own currency by definition, so there is
// nothing to choose between.
//
// ── Flat prices live in `flats`, not on the item ────────────────────────────
//
// The shipped books put a flat item's price on the item itself
// (`items[].flatPrice`). Two reasons not to copy that:
//
//   Nothing reads it. `flatPrice` appears in tradePriceBooks.js and in no
//   other file in the repo — the rate card cannot show it and the quote builder
//   does not consume it.
//
//   It cannot be made editable where it sits. PRICE_BOOK_FIELDS paths are
//   dot-notation and `items.3.flatPrice` produces the patch `{items:{3:{...}}}`,
//   which mergeDeep discards silently: `Array.isArray(base)` is true, so it
//   returns the base array and the edit vanishes. A rate-card row that saves
//   and changes nothing is the exact failure AGENTS.md opens with.
//
// So flat prices sit in `flats`, a plain object mergeDeep handles, and an item
// points at one with `flatKey`. `itemFlatPrice()` below is the reader.
//
// ── The category keys, and the four that do not exist yet ───────────────────
//
// concrete, masonry and demolition are live keys in lib/trades/catalog.js.
// framing, asphalt_paving, stucco and deck_building are NOT, and each carries a
// `proposedCatalogEntry` for the owner to paste in. Until that happens those
// four books are unreachable — a book with no ServiceCategory row behind it is
// a rate card nobody can open. The check asserts the status of all seven
// against the real catalogue, so a proposal left in place after it has been
// merged fails rather than rotting.

/* ── Vocabulary ────────────────────────────────────────────────────────── */

/**
 * One money default: two markets, the evidence, and how it was arrived at.
 *
 * `basis` is mandatory and is not decoration — it is the only thing that tells
 * a contractor which way to move a number that is wrong for their city.
 */
const cost = (usd, cad, basis, confidence = "derived") => ({
  usd,
  cad,
  basis,
  confidence,
});

/** A count, ratio, coverage or hour figure: one number, no currency. */
const spec = (value, basis, confidence = "derived") => ({
  value,
  basis,
  confidence,
});

export const MONEY_KEYS = ["usd", "cad"];
export const CONFIDENCE_TAGS = ["read", "derived"];

/** True for a `{ usd, cad }` pair produced by cost(). */
export function isMoneyPair(v) {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    MONEY_KEYS.every((k) => typeof v[k] === "number")
  );
}

/** True for a `{ value }` produced by spec(). */
export function isSpec(v) {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof v.value === "number" &&
    !isMoneyPair(v)
  );
}

/**
 * Resolve one field to a plain number for a currency.
 *
 * A bare number passes straight through, which is what makes a company's saved
 * override survive: they wrote one number, in their own currency, and there is
 * nothing left to choose.
 */
export function money(v, currency = "CAD") {
  if (typeof v === "number") return v;
  if (isMoneyPair(v)) {
    const key = String(currency).toLowerCase();
    return MONEY_KEYS.includes(key) ? v[key] : v.cad;
  }
  if (isSpec(v)) return v.value;
  return undefined;
}

/** Depth-first flatten of every pair/spec in a book or recipe. */
function flattenNode(node, currency) {
  if (Array.isArray(node)) return node.map((n) => flattenNode(n, currency));
  if (node === null || typeof node !== "object") return node;
  if (isMoneyPair(node) || isSpec(node)) return money(node, currency);
  const out = {};
  for (const key of Object.keys(node)) out[key] = flattenNode(node[key], currency);
  return out;
}

/**
 * Turn a two-currency book into the single-number shape every shipped book
 * already has, so PRICE_BOOK_FIELDS and RateCard work unmodified.
 *
 * Call it AFTER getPriceBook merges a company's overrides, never before: the
 * override is a plain number and flattening is idempotent on numbers, so the
 * order is safe either way, but merging first is the order that keeps
 * getPriceBook's array and prototype guards in play.
 */
export function flattenPriceBook(book, currency = "CAD") {
  return book ? flattenNode(book, currency) : book;
}

/** Same, for a recipe out of getRecipe(). */
export function flattenRecipe(recipe, currency = "CAD") {
  return recipe ? flattenNode(recipe, currency) : recipe;
}

/** Same, for one trade's add-on list. */
export function flattenAddOns(list, currency = "CAD") {
  return Array.isArray(list) ? flattenNode(list, currency) : [];
}

/** The price of a flat-priced item, read out of the book's `flats` block. */
export function itemFlatPrice(book, item, currency = "CAD") {
  if (!book || !item || !item.flatKey) return undefined;
  const flats = book.flats;
  if (!flats || !Object.prototype.hasOwnProperty.call(flats, item.flatKey))
    return undefined;
  return money(flats[item.flatKey], currency);
}

/**
 * Complexity rate rows, once per level — the local twin of complexityFields()
 * in tradePriceBooks.js.
 *
 * That function is private to its module and this file may not edit it. At
 * merge time these calls should be swapped for the real one and this helper
 * deleted; keeping a permanent second copy is the duplication AGENTS.md names,
 * and it is only tolerable here because the file it duplicates is one another
 * agent is holding open right now.
 */
function cxFields(rows) {
  const out = [];
  for (const level of ["standard", "moderate", "high"]) {
    for (const [key, label, suffix] of rows) {
      out.push({
        path: `complexity.${level}.${key}`,
        label,
        suffix,
        level,
        step: suffix.includes("sqft") || suffix.includes("linear") ? 0.25 : 5,
      });
    }
  }
  return out;
}

/* ══ CONCRETE ═══════════════════════════════════════════════════════════════
 *
 * Flatwork, footings and slabs. Priced per square foot because that is what a
 * homeowner is shown and what every published band is quoted in; the cost side
 * converts to cubic yards, because that is what the truck sells and what
 * decides both the material bill and the short-load fee.
 *
 * The sell bands: US residential plain 4" broom-finish flatwork runs $6–$12/sqft
 * with driveways at the top of it and stamped work $12–$25. Canadian equivalents
 * run $9–$16 CAD plain, $18–$30 CAD stamped — a wider gap than FX explains,
 * because the pour season is short and a crew has to earn a year in seven months.
 */

const CONCRETE = {
  label: "Concrete",

  meta: {
    categoryKey: "concrete",
    catalogStatus: "existing",
    industries: ["construction-contracting"],
  },

  // One unit per priceType, declared once. The item list and the rate card are
  // both checked against this rather than against each other — two lists that
  // must agree and have no arbiter is how "lf" on an item ends up beside
  // "$ / linear ft" on the rate card, which is already true of the shipped
  // exterior_painting book.
  priceTypeUnits: {
    slab: "sqft",
    driveway: "sqft",
    walkway: "sqft",
    footing: "linear ft",
    wall: "sqft of wall",
  },

  complexity: {
    standard: {
      desc: "Open site a truck can chute directly, level grade, a 4-inch slab on prepared subgrade with fibre or mesh, broom finish, poured in one visit",
      slab: cost(8, 11, "US $6–$12/sqft plain 4-inch flatwork; CA $9–$16. Low-mid of both — an open pour with no forming complications.", "read"),
      driveway: cost(9, 13, "US driveways sit at the top of the flatwork band ($8–$12) for the 5-inch pour and thickened edges; CA $11–$18.", "read"),
      walkway: cost(9, 12, "Narrow pours cost more per foot than open slabs: same crew, same setup, a quarter of the area. Priced a dollar over slab.", "derived"),
      footing: cost(22, 30, "16x8 strip footing, formed and poured, excavation by others. US $18–$28/lf; CA $25–$38.", "read"),
      wall: cost(28, 38, "8-inch formed foundation wall, per square foot of wall FACE. Back-checked: a 30x40 house is 140 lf x 8 ft = 1,120 sqft face, which at $28 is $31,400 — inside the $25k–$45k band a poured residential foundation is quoted at.", "derived"),
    },
    moderate: {
      desc: "A 5 or 6 inch slab, thickened edges, curves or steps to form, an integral colour or exposed-aggregate finish, or a pour the truck cannot reach and a buggy has to carry",
      slab: cost(11, 15, "Mid of the US band and above it for the extra depth; CA mid.", "derived"),
      driveway: cost(12, 17, "Top of the US driveway band.", "derived"),
      walkway: cost(12, 16, "Tracks slab plus the same narrow-pour premium.", "derived"),
      footing: cost(28, 38, "Stepped footings and hand-dug returns, roughly +27% on the standard rate — the ratio the depth and forming add.", "derived"),
      wall: cost(34, 46, "Taller walls, more ties, more strip time.", "derived"),
    },
    high: {
      desc: "Structural pour with a rebar mat and an engineered mix, placement by pump, tight or no machine access, a stamped or polished finish, or a winter pour needing blankets and heat",
      slab: cost(15, 21, "US stamped and structural flatwork is $12–$25/sqft; this is the low-mid of it, because the stamping upcharge below is charged separately and double-counting it would price the same decision twice.", "read"),
      driveway: cost(17, 24, "Same reasoning as the slab, one tier up for depth.", "derived"),
      walkway: cost(16, 22, "Tracks the high slab rate plus the same narrow-pour premium the standard tier carries.", "derived"),
      footing: cost(36, 48, "Engineered footings with a rebar cage.", "derived"),
      wall: cost(44, 58, "Pumped, formed to an engineer's drawing, snap-tied and stripped.", "derived"),
    },
  },

  items: [
    { id: "slab", label: "Slab / patio / garage floor", unit: "sqft", priceType: "slab" },
    { id: "driveway", label: "Driveway", unit: "sqft", priceType: "driveway" },
    { id: "walkway", label: "Walkway / sidewalk", unit: "sqft", priceType: "walkway" },
    { id: "footing", label: "Strip footing", unit: "linear ft", priceType: "footing" },
    { id: "wall", label: "Formed foundation wall", unit: "sqft of wall", priceType: "wall" },
    { id: "steps", label: "Poured steps", unit: "each", priceType: "flat", flatKey: "stepEach" },
    { id: "pier", label: "Sonotube pier", unit: "each", priceType: "flat", flatKey: "pierEach" },
  ],

  flats: {
    stepEach: cost(300, 400, "One poured step roughly 4 ft wide, formed and finished. US published $300–$500 per step; CA $400–$650.", "read"),
    pierEach: cost(250, 340, "10-inch sonotube to 48 inches, dug, set, poured and levelled. US deck-footing band $200–$400.", "read"),
  },

  extras: {
    stampedUpchargePerSqft: cost(6, 8, "The DIFFERENCE between a broom finish and a stamped one, not the stamped rate — the tier rate above already covers the pour. US stamped $12–$25 against plain $6–$12 puts the delta at $5–$8.", "derived"),
    exposedAggregatePerSqft: cost(3, 4, "Wash-and-expose adds a return visit and a retarder; US $2–$4.", "read"),
    integralColourPerSqft: cost(1.5, 2, "Colour dosed at the plant, roughly $12–$18 per cubic yard spread over a 4-inch slab (81 sqft/cu yd).", "derived"),
    sealerPerSqft: cost(0.6, 0.8, "One coat of acrylic cure-and-seal, US $0.50–$0.75/sqft applied.", "read"),
    removeExistingPerSqft: cost(3, 4, "Break out and haul a 4-inch slab. US $2–$6/sqft including tipping; low-mid because the dumpster is charged separately in the recipe.", "read"),
    rebarUpgradePerSqft: cost(0.6, 0.8, "Swapping mesh for a #4 mat at 16 inches on centre: material plus tying.", "derived"),
    sawCutJointPerLf: cost(1.5, 2, "Soff-cut control joints within 12 hours of the pour, US $1–$2/lf.", "read"),
    winterProtectionPerSqft: cost(1.2, 1.6, "Blankets, hoarding and a hot-water mix. Charged in Canada far more often than in the US, which is why the CAD figure is not simply the larger of the two but the more used.", "derived"),
    pumpTruckFlat: cost(900, 1200, "What the client is charged when a pump is needed. The equipment day rate in the recipe is what it costs.", "derived"),
  },

  // Concrete has a hard floor: a truck, a crew and a finishing window do not
  // scale down. Below this the per-foot rate under-recovers and every source
  // says the same.
  minimumTotal: cost(1500, 2000, "US contractor minimums for a small pour cluster at $1,000–$2,000; CA $1,800–$2,800.", "read"),

  // Named absences. The check asserts none of these appears as a priced field.
  notPriced: [
    "permitFee — a municipal charge that varies by city and is passed through, not marked up. A default here would put an invented figure on a public fee.",
    "engineeredDesign — a stamped structural drawing is an engineer's invoice, not a rate this trade sets.",
    "soilRemediation — unsuitable subgrade is discovered, not quoted. Nothing to average.",
  ],
};

/* ══ ASPHALT PAVING ═════════════════════════════════════════════════════════
 *
 * Deliberately NOT folded into the existing `paving` book. That one is
 * interlock: priced per square foot of paver, costed per cubic yard of base and
 * per square foot of stone. Asphalt is priced per square foot of surface and
 * bought by the TON of hot mix, and the tonnage is a function of compacted
 * thickness. One rate card cannot answer both questions, which is the same
 * argument the catalogue already makes for keeping sealcoating out of paving.
 */

const ASPHALT_PAVING = {
  label: "Asphalt Paving",

  meta: {
    categoryKey: "asphalt_paving",
    catalogStatus: "proposed",
    industries: ["construction-contracting", "landscaping"],
    proposedCatalogEntry: {
      label: "Asphalt Paving",
      icon: "Square",
      sortOrder: 39.5,
      industries: ["construction-contracting", "landscaping"],
    },
  },

  priceTypeUnits: {
    newDriveway: "sqft",
    overlay: "sqft",
    patch: "sqft",
  },

  complexity: {
    standard: {
      desc: "A straight rectangular drive on a base that is already there and sound, paver and roller both fit through the gate, one 2-inch compacted lift, no drainage work",
      newDriveway: cost(4.0, 6.0, "US new asphalt driveway $3–$7/sqft installed; CA $5–$9. Low-mid of each — this tier assumes the base survives.", "read"),
      overlay: cost(2.5, 3.75, "US resurface $2–$4/sqft; CA $3.50–$6.", "read"),
      patch: cost(8, 11, "Patching is expensive per foot and always has been: the same mobilisation over a fraction of the area. US $5–$12/sqft for a saw-cut patch.", "read"),
    },
    moderate: {
      desc: "Full-depth rebuild — dig out, granular base and two lifts — or a curved and sloped drive where a good share of the surface is raked and rolled by hand",
      newDriveway: cost(5.5, 8.0, "Mid-to-upper of both bands; the base rebuild is the difference.", "derived"),
      overlay: cost(3.25, 4.75, "Milling at the garage and the apron, plus levelling course.", "derived"),
      patch: cost(10, 14, "Deeper cut, more edge per square foot.", "derived"),
    },
    high: {
      desc: "Tight or terraced access, drainage structures or catch basins, heavy grade correction, geogrid over soft subgrade, or a commercial lot laid at night",
      newDriveway: cost(7.5, 11.0, "Top of the US band and above it in CA, where the season compresses the schedule.", "derived"),
      overlay: cost(4.25, 6.25, "Top of both published overlay bands — heavy levelling course and hand work at every edge.", "derived"),
      patch: cost(13, 18, "Hand work throughout.", "derived"),
    },
  },

  items: [
    { id: "new_driveway", label: "New asphalt — full depth", unit: "sqft", priceType: "newDriveway" },
    { id: "overlay", label: "Overlay / resurface", unit: "sqft", priceType: "overlay" },
    { id: "patch", label: "Saw-cut patch", unit: "sqft", priceType: "patch" },
    { id: "speed_bump", label: "Speed bump", unit: "each", priceType: "flat", flatKey: "speedBumpEach" },
    { id: "apron", label: "Road apron / culvert tie-in", unit: "each", priceType: "flat", flatKey: "apronEach" },
  ],

  flats: {
    speedBumpEach: cost(900, 1200, "Formed asphalt speed bump across a two-lane width. US published $500–$1,500 installed.", "read"),
    apronEach: cost(1100, 1450, "Tie-in to the municipal road edge, saw-cut and matched. US $800–$1,800 depending on what the municipality specifies.", "read"),
  },

  extras: {
    removeExistingPerSqft: cost(1.5, 2.0, "Rip and haul existing asphalt. US $1–$3/sqft; millings are usually accepted free at a recycler, which is why this is below the concrete equivalent.", "read"),
    baseRebuildPerSqft: cost(1.75, 2.4, "6 inches of granular A, placed and compacted in two lifts. Derived from 0.0185 cu yd/sqft at the recipe's stone cost plus the placement hours.", "derived"),
    geogridPerSqft: cost(0.65, 0.85, "Biaxial geogrid over soft subgrade, supplied and laid. US material $0.35–$0.55/sqft plus placing.", "read"),
    catchBasinEach: cost(1200, 1600, "Precast basin, frame, grate and tie-in to an existing lead. US $900–$1,800.", "read"),
    tackCoatPerSqft: cost(0.15, 0.2, "Emulsion at 0.05 gal/sq yd over an existing surface, plus the sprayer pass.", "derived"),
    mobilisationFlat: cost(750, 950, "Floating a paver and a roller in and out. Charged as a line because on a small driveway it IS the job — the same fixed-cost lesson lib/pricing/paverLabour.js documents.", "derived"),
    lineStripingPerStall: cost(6, 8, "US $4–$8 per stall for a single line on a fresh surface.", "read"),
  },

  minimumTotal: cost(2000, 2600, "Below this a paver and roller float costs more than the paving. US contractor minimums $1,500–$2,500.", "read"),

  notPriced: [
    "permitFee — a municipal charge set by the road authority and passed through at cost, not marked up.",
    "culvertSupply — a culvert's diameter and length are specified by the municipality, not chosen by the paver; there is no average.",
    "commercialNightPremium — a shift differential, not a rate. It is a multiplier on labour and this book has no place to hold one.",
  ],
};

/* ══ MASONRY ════════════════════════════════════════════════════════════════
 *
 * Brick, block and stone, priced per square foot of wall FACE — which is what a
 * mason measures and what every published band quotes. The cost side converts
 * to units (6.75 modular brick per square foot, 1.125 block) because that is
 * what the yard sells and what the waste factor applies to.
 *
 * The two currency bands here are genuinely far apart and the reason is not FX:
 * Canadian masonry carries a shorter season and a thinner labour pool, and the
 * published Canadian brick-veneer band ($20–$35 CAD/sqft) starts above where
 * the US one ($10–$20) ends. Each figure below sits inside its own band.
 */

const MASONRY = {
  label: "Masonry",

  meta: {
    categoryKey: "masonry",
    catalogStatus: "existing",
    industries: ["construction-contracting"],
  },

  priceTypeUnits: {
    brick: "sqft of wall",
    block: "sqft of wall",
    stoneNatural: "sqft of wall",
    stoneManufactured: "sqft of wall",
    repoint: "sqft of wall",
    chimney: "vertical ft",
  },

  complexity: {
    standard: {
      desc: "Straight runs at ground level off a single lift of ground-standing scaffold, common brick or standard block in running bond, no cutting to speak of, mortar colour chosen not matched",
      brick: cost(16, 24, "US brick veneer $10–$20/sqft installed; CA $20–$35. Mid of the US band, low-mid of the Canadian one.", "read"),
      block: cost(13, 20, "US CMU wall $10–$20/sqft; CA $16–$28. Block lays faster than brick per square foot, which is why it sits below it.", "read"),
      stoneNatural: cost(34, 52, "US natural stone veneer $25–$50/sqft; CA $40–$70.", "read"),
      stoneManufactured: cost(19, 29, "US manufactured stone veneer $15–$25/sqft; CA $26–$40.", "read"),
      repoint: cost(11, 17, "US tuckpointing $8–$20/sqft; CA $15–$30. Low end, because this tier is sound brick at ground level.", "read"),
      chimney: cost(90, 130, "Rebuild above the roof line, per vertical foot of a chimney around 32x20 inches. US $60–$150/vertical ft.", "read"),
    },
    moderate: {
      desc: "Two lifts of scaffold, returns and openings needing cut brick, soldier courses, arches or a bond pattern, or an existing mortar colour and joint profile that has to be matched",
      brick: cost(21, 32, "Upper half of both bands.", "derived"),
      block: cost(17, 26, "Upper half of both block bands: cut units at returns and openings, and a second scaffold lift.", "derived"),
      stoneNatural: cost(46, 70, "Upper half; sorting and cutting is most of the extra.", "derived"),
      stoneManufactured: cost(25, 38, "Top of the US manufactured-stone band, where corner pieces and a pattern layout are involved.", "derived"),
      repoint: cost(15, 23, "Mid of both bands: grinding out to depth rather than raking.", "derived"),
      chimney: cost(120, 175, "Above roof line with staging.", "derived"),
    },
    high: {
      desc: "Heritage or hand-cut stone, full-height staging or a swing stage, structural rebuild, chimney work well above the roof line, or lime mortar on a designated building",
      brick: cost(28, 42, "Above both published bands, which is correct: neither band covers heritage work and every source says so.", "derived"),
      block: cost(22, 34, "Above both published block bands, which do not cover structural rebuild or full-height staging.", "derived"),
      stoneNatural: cost(62, 94, "Above band. Hand-cut stone has no published rate; this is the natural-stone top end plus the cutting hours in the recipe.", "derived"),
      stoneManufactured: cost(33, 50, "Above the published band — heritage detailing and swing-stage access have no published rate.", "derived"),
      repoint: cost(21, 32, "Top of both bands — lime mortar and a matched profile.", "read"),
      chimney: cost(160, 230, "Top of the US band and above it in CA.", "derived"),
    },
  },

  items: [
    { id: "brick_veneer", label: "Brick veneer", unit: "sqft of wall", priceType: "brick" },
    { id: "block_wall", label: "Concrete block wall", unit: "sqft of wall", priceType: "block" },
    { id: "stone_natural", label: "Natural stone veneer", unit: "sqft of wall", priceType: "stoneNatural" },
    { id: "stone_manufactured", label: "Manufactured stone veneer", unit: "sqft of wall", priceType: "stoneManufactured" },
    { id: "repointing", label: "Repointing / tuckpointing", unit: "sqft of wall", priceType: "repoint" },
    { id: "chimney", label: "Chimney rebuild above roof line", unit: "vertical ft", priceType: "chimney" },
    { id: "sill", label: "Window sill", unit: "linear ft", priceType: "flat", flatKey: "sillPerLf" },
    { id: "cap", label: "Wall cap", unit: "linear ft", priceType: "flat", flatKey: "capPerLf" },
    { id: "lintel", label: "Lintel replacement", unit: "each", priceType: "flat", flatKey: "lintelEach" },
    { id: "pier", label: "Masonry pier / column", unit: "each", priceType: "flat", flatKey: "pierEach" },
  ],

  flats: {
    sillPerLf: cost(45, 60, "Precast or stone sill, supplied and bedded. US $35–$60/lf.", "read"),
    capPerLf: cost(28, 38, "Precast wall cap, supplied and bedded. US $22–$40/lf.", "read"),
    lintelEach: cost(650, 875, "Needle, shore, cut out and replace a steel angle lintel over a standard opening. US $450–$900.", "read"),
    pierEach: cost(850, 1150, "A freestanding brick pier around 8 ft, footing by others.", "derived"),
  },

  extras: {
    scaffoldPerDay: cost(120, 160, "Frame scaffold for a typical residential elevation, rented and charged on. The per-section week rate is in the recipe.", "derived"),
    liftRentalPerDay: cost(350, 450, "Towable boom lift where scaffold will not stand. US day rate $280–$420.", "read"),
    mortarColourMatchFlat: cost(250, 325, "Sampling, lab match and test panels. A fixed piece of work, not a rate.", "derived"),
    removeExistingPerSqft: cost(5, 7, "Take down existing masonry and dispose. US $4–$8/sqft.", "read"),
    cleaningSealingPerSqft: cost(1.6, 2.2, "Acid wash and a breathable siloxane sealer. US $1.20–$2.20/sqft.", "read"),
    weepAndFlashingPerLf: cost(9, 12, "Through-wall flashing and weep vents at a shelf angle, per linear foot.", "derived"),
  },

  minimumTotal: cost(1800, 2400, "A mason and a tender for a day plus a mixer and a scaffold lift. Below this the setup is the job.", "derived"),

  notPriced: [
    "structuralAssessment — an engineer's report on a bulging or cracked wall. Not a mason's rate.",
    "heritageDesignationCompliance — the scope is written by a conservation authority case by case; nothing averages.",
    "chimneyLinerSupply — a liner is sized to the appliance by a WETT or NFI inspection, and pricing it here would have a mason quoting a certification he may not hold.",
  ],
};

/* ══ STUCCO & EIFS ══════════════════════════════════════════════════════════
 *
 * Deliberately separate from `parging`, which already exists as a key with an
 * instant estimator. Parging is a thin cementitious coat on an exposed
 * foundation; stucco and EIFS are wall assemblies with a drainage plane, a
 * lath or board layer and a warranty. Sharing a rate card would mean one number
 * answering "what does it cost to tidy a foundation" and "what does it cost to
 * clad a house".
 *
 * Traditional and EIFS are held apart for the same reason: EIFS carries a board
 * and a mesh layer traditional stucco does not, and its failure mode — trapped
 * moisture — is what the drainage-mat extra exists for.
 */

const STUCCO = {
  label: "Stucco & EIFS",

  meta: {
    categoryKey: "stucco",
    catalogStatus: "proposed",
    industries: ["construction-contracting"],
    proposedCatalogEntry: {
      label: "Stucco & EIFS",
      icon: "Layers",
      sortOrder: 44.5,
      industries: ["construction-contracting"],
    },
    // Acrylic recoat is also sold by exterior painters. Adding "painting" here
    // is a product decision with a real consequence — it would put a stucco
    // rate card in front of every painter at signup, which is the exact
    // complaint lib/trades/catalog.js was written to answer — so it is left for
    // the owner rather than decided here.
    industryQuestion:
      "Should `painting` also surface this trade? Acrylic recoat is a painter's line; full three-coat stucco is not.",
  },

  priceTypeUnits: {
    traditional: "sqft of wall",
    oneCoat: "sqft of wall",
    eifs: "sqft of wall",
    recoat: "sqft of wall",
    repair: "sqft of wall",
  },

  complexity: {
    standard: {
      desc: "New wall, one or two storeys off ground-standing scaffold, flat elevations, one texture and one colour, sheathing already sound and dry",
      traditional: cost(9, 14, "US three-coat stucco $7–$13/sqft installed; CA $10–$18. Mid of the US band.", "read"),
      oneCoat: cost(7, 11, "US one-coat system $6–$9/sqft; CA $9–$14.", "read"),
      eifs: cost(11, 17, "US EIFS $9–$16/sqft; CA $13–$22.", "read"),
      recoat: cost(4, 6, "Acrylic finish over sound existing stucco. US $3–$6/sqft.", "read"),
      repair: cost(14, 21, "Patching into an existing finish. US $10–$25/sqft — it is priced high because matching texture and colour over a small area is most of the labour.", "read"),
    },
    moderate: {
      desc: "Three storeys or a swing stage, bands, reveals and trim details, more than one colour or texture, or patching into an existing finish that has to be matched",
      traditional: cost(12, 18, "Upper half of both bands.", "derived"),
      oneCoat: cost(9.5, 15, "Top of the US one-coat band, where trim details and a second texture are in the scope.", "derived"),
      eifs: cost(14, 22, "Upper half; the detail work is the difference.", "derived"),
      recoat: cost(5.5, 8.5, "Top of band, plus staging.", "derived"),
      repair: cost(19, 29, "Mid-upper of a wide band.", "derived"),
    },
    high: {
      desc: "Full tear-off of a failed system with sheathing and framing repair behind it, heritage or curved work, hand-carved detail, or a building carrying a moisture claim",
      traditional: cost(16, 24, "Above the published band, which does not cover heritage or curved work.", "derived"),
      oneCoat: cost(13, 20, "Above the published one-coat band, which assumes a new flat wall and nothing to match into.", "derived"),
      eifs: cost(19, 29, "Above band. A failed-EIFS tear-off and rebuild is the single most expensive form of this work.", "derived"),
      recoat: cost(7.5, 11, "Above band — full prep of a chalked or crazed surface.", "derived"),
      repair: cost(26, 39, "Top of the US band and above it.", "derived"),
    },
  },

  items: [
    { id: "traditional", label: "Traditional three-coat stucco", unit: "sqft of wall", priceType: "traditional" },
    { id: "one_coat", label: "One-coat stucco system", unit: "sqft of wall", priceType: "oneCoat" },
    { id: "eifs", label: "EIFS", unit: "sqft of wall", priceType: "eifs" },
    { id: "recoat", label: "Acrylic recoat over existing", unit: "sqft of wall", priceType: "recoat" },
    { id: "repair", label: "Patch and match repair", unit: "sqft of wall", priceType: "repair" },
    { id: "band", label: "Foam band / reveal", unit: "linear ft", priceType: "flat", flatKey: "bandPerLf" },
    { id: "quoin", label: "Quoin", unit: "each", priceType: "flat", flatKey: "quoinEach" },
    { id: "surround", label: "Window surround", unit: "each", priceType: "flat", flatKey: "surroundEach" },
  ],

  flats: {
    bandPerLf: cost(22, 30, "Shaped EPS band, meshed, based and finished. US $16–$28/lf.", "read"),
    quoinEach: cost(45, 60, "One shaped quoin, cut and finished.", "derived"),
    surroundEach: cost(250, 330, "Sill, head and jambs around one standard window.", "derived"),
  },

  extras: {
    removeExistingPerSqft: cost(3.5, 4.75, "Strip failed stucco or EIFS back to sheathing and dispose. US $2.50–$5/sqft.", "read"),
    sheathingRepairPerSqft: cost(4.5, 6, "Cut out and replace rotted sheathing found behind a failed system, per square foot actually replaced — not per square foot of wall.", "derived"),
    drainageMatPerSqft: cost(1.6, 2.2, "Rainscreen drainage mat behind the lath. This is the extra that stops the failure mode the `high` tier describes and should be sold, not buried.", "derived"),
    scaffoldPerDay: cost(120, 160, "Same basis as masonry.", "derived"),
    swingStagePerDay: cost(450, 580, "Suspended stage with rigging, per day. US $380–$550.", "read"),
    extraColourFlat: cost(400, 525, "A second finish colour: separate mix, separate masking, separate visit.", "derived"),
    sealantPerLf: cost(4, 5.5, "Backer rod and a low-modulus sealant at every transition. US $3–$6/lf.", "read"),
  },

  minimumTotal: cost(2500, 3300, "A plaster crew, a mixer and three coat days. The multi-visit cure schedule is what makes this floor higher than masonry's.", "derived"),

  notPriced: [
    "moistureIntrusionRemediation — the scope is written by whoever opens the wall, and pricing it blind is how a repair quote doubles on day two.",
    "asbestosInOldStucco — regulated abatement. Never a default, and see the demolition book for why.",
    "engineeredDrainagePlaneDesign — a building envelope consultant's fee.",
  ],
};

/* ══ FRAMING & ROUGH CARPENTRY ══════════════════════════════════════════════
 *
 * Not filed under the existing `carpentry` key. That key is the whole trade
 * including trim and finish work, and a finish carpenter offered a framing rate
 * card is the same defect as a painter offered a roofing one — the complaint
 * lib/trades/catalog.js opens with.
 *
 * Walls are priced per linear foot and floors and roofs per square foot,
 * because that is what a framer takes off. A single "$/sqft of house" figure
 * exists in the published bands but hides the thing that actually moves the
 * price, which is how much wall there is per square foot of floor.
 *
 * ── Lumber is the volatile input in this file ───────────────────────────────
 *
 * Every other trade here rests on materials that move a few percent a year.
 * Framing lumber moved 3x and back inside 2020–2022. The material figures in
 * the recipe are 2025 levels and are the first thing to re-read, and the SPF
 * pairs below are the clearest case in the file of why a conversion would be
 * wrong: the mills are in Canada, and Canadian SPF sits well under US retail
 * once you stop multiplying.
 */

const FRAMING = {
  label: "Framing & Rough Carpentry",

  meta: {
    categoryKey: "framing",
    catalogStatus: "proposed",
    industries: ["construction-contracting"],
    proposedCatalogEntry: {
      label: "Framing & Rough Carpentry",
      icon: "Hammer",
      sortOrder: 21.5,
      industries: ["construction-contracting"],
    },
  },

  priceTypeUnits: {
    wallFrame: "linear ft",
    partition: "linear ft",
    floorFrame: "sqft",
    roofFrame: "sqft",
    sheathing: "sqft",
  },

  complexity: {
    standard: {
      desc: "Single storey, roof trusses, 8-foot walls, an open lot a delivery truck can reach the deck from, engineered drawings already in hand",
      wallFrame: cost(26, 36, "Exterior 2x6 wall at 16 inches on centre, 8 ft, supplied and stood, sheathing charged separately. US framing labour-and-material bands put a wall at $22–$34/lf.", "read"),
      partition: cost(19, 26, "Interior 2x4 partition, no header load.", "derived"),
      floorFrame: cost(11, 15, "Joists, rim, hangers and subfloor, supplied and installed. US $9–$16/sqft.", "read"),
      roofFrame: cost(9, 13, "Trusses supplied and set, per square foot of floor covered. US $7–$12/sqft.", "read"),
      sheathing: cost(3.2, 4.4, "7/16 OSB supplied and fitted; material is roughly $0.65/sqft US and the rest is labour and fasteners.", "derived"),
    },
    moderate: {
      desc: "Two storeys, nine-foot walls or a raised-heel truss, a stick-framed roof with valleys, some engineered beams, or a lot the truck cannot back into",
      wallFrame: cost(34, 47, "Top of the band plus the staging a second storey needs.", "derived"),
      partition: cost(24, 33, "Top of the partition band: nine-foot plates, more blocking, and stock carried up a storey.", "derived"),
      floorFrame: cost(14, 19, "Top of the US floor-framing band — deeper joists, engineered rim, and a crane-free lift by hand.", "derived"),
      roofFrame: cost(13, 18, "A cut roof is roughly 2.5x the crew-hours of a truss roof (see the recipe); the price moves less than the hours because the material is similar.", "derived"),
      sheathing: cost(4.0, 5.5, "More cuts, more edges, more staging.", "derived"),
    },
    high: {
      desc: "Cathedral or complex roof geometry, steel or LVL beams needing a crane, cut-in work inside an occupied house, or a heritage structure being shored and re-framed",
      wallFrame: cost(46, 63, "Above the published band. Cut-in framing inside a finished house has no published rate and is the reason this tier exists.", "derived"),
      partition: cost(32, 44, "Above the published band, because cut-in partitions inside a finished house have no published rate.", "derived"),
      floorFrame: cost(19, 26, "Above band — sistering and levelling into existing structure.", "derived"),
      roofFrame: cost(19, 26, "Above the published band: cathedral and complex geometry is cut on site, not delivered as trusses.", "derived"),
      sheathing: cost(5.2, 7.1, "Above the published band — sheathing worked off staging around an existing structure.", "derived"),
    },
  },

  items: [
    { id: "wall_framing", label: "Exterior wall framing", unit: "linear ft", priceType: "wallFrame" },
    { id: "partition", label: "Interior partition", unit: "linear ft", priceType: "partition" },
    { id: "floor_framing", label: "Floor framing & subfloor", unit: "sqft", priceType: "floorFrame" },
    { id: "roof_framing", label: "Roof framing", unit: "sqft", priceType: "roofFrame" },
    { id: "sheathing", label: "Wall / roof sheathing", unit: "sqft", priceType: "sheathing" },
    { id: "header", label: "Header over an opening", unit: "each", priceType: "flat", flatKey: "headerEach" },
    { id: "beam", label: "Engineered beam, supplied and set", unit: "linear ft", priceType: "flat", flatKey: "beamPerLf" },
    { id: "post", label: "Post / column", unit: "each", priceType: "flat", flatKey: "postEach" },
    { id: "rough_stair", label: "Rough stair carcass", unit: "each", priceType: "flat", flatKey: "roughStairEach" },
  ],

  flats: {
    headerEach: cost(180, 245, "Doubled LVL or built-up header, jacks and cripples, over a standard opening.", "derived"),
    beamPerLf: cost(55, 75, "1-3/4 x 11-7/8 LVL, plied and set. Material is roughly $12/lf US; the rest is lifting and bearing.", "derived"),
    postEach: cost(220, 300, "Built-up or engineered post with a bearing plate.", "derived"),
    roughStairEach: cost(900, 1200, "One flight of cut stringers, rough treads and risers. Finish stair is another trade.", "derived"),
  },

  extras: {
    craneHalfDay: cost(1100, 1450, "Boom truck with operator to set trusses or a steel beam. US $900–$1,400 for a half day with travel.", "read"),
    temporaryShoringPerLf: cost(30, 40, "Temporary bearing wall while a beam goes in, per linear foot, up and down.", "derived"),
    winterHoardingPerSqft: cost(2.5, 3.3, "Poly hoarding and heat over an open deck. Charged in Canada far more often, which is why the CAD figure is the more used of the two rather than merely the larger.", "derived"),
  },

  minimumTotal: cost(2500, 3300, "A two-framer crew for two days plus a lumber delivery.", "derived"),

  notPriced: [
    "engineeredDrawings — a stamped structural drawing is an engineer's invoice. It is passed through and it varies by an order of magnitude with the span.",
    "permitFee — a municipal building-permit charge, usually a percentage of declared construction value, which is not a rate this trade sets.",
    "steelBeamSupply — a steel beam is priced per pound by section and length off a mill list; there is no per-foot average that survives the span.",
  ],
};

/* ══ DEMOLITION ═════════════════════════════════════════════════════════════
 *
 * Priced per square foot of what is being taken out, but COSTED per cubic yard
 * of what comes out — and the gap between those two is where this trade loses
 * money. Load-out hours and tipping weight are the two numbers routinely left
 * off a demolition quote, so both are first-class in the recipe.
 *
 * ── What this book will not price, and why it is the important part ─────────
 *
 * There is no asbestos, lead or mould line and there must not be one. That work
 * is done under licence to a regulated scope by an abatement contractor, and a
 * default in a demolition rate card would put a plausible number in front of a
 * contractor for work he may not legally perform. The check asserts the absence.
 */

const DEMOLITION = {
  label: "Demolition",

  meta: {
    categoryKey: "demolition",
    catalogStatus: "existing",
    industries: ["construction-contracting"],
    // `demolition_contractor` (sortOrder 38) is a second live key for the same
    // trade with the same industry. This book is keyed to `demolition` because
    // it is the lower sortOrder and the one the construction preset shows
    // first. Merging or aliasing the two is the owner's call; seeding both from
    // one object would be the copy that rots.
    duplicateCatalogKey: "demolition_contractor",
  },

  priceTypeUnits: {
    interiorStrip: "sqft",
    fullStructure: "sqft",
    concreteRemoval: "sqft",
    deckRemoval: "sqft",
    wallRemoval: "linear ft",
  },

  complexity: {
    standard: {
      desc: "An empty structure or a room going back to studs, ground floor, a dumpster on the driveway, nothing adjacent that has to be protected and nothing that has to survive",
      interiorStrip: cost(3.5, 5.0, "US interior demolition $2–$7/sqft; CA $5–$12. Low-mid of both.", "read"),
      fullStructure: cost(6, 9, "US teardown $4–$15/sqft of floor area; CA $8–$18. Low end — this tier is a clear site.", "read"),
      concreteRemoval: cost(3.5, 4.75, "Break out and haul a 4-inch slab. US $2–$6/sqft.", "read"),
      deckRemoval: cost(4, 5.5, "Dismantle and dispose of a wood deck. US $3–$7/sqft.", "read"),
      wallRemoval: cost(22, 30, "Non-load-bearing partition, per linear foot, taken out and hauled.", "derived"),
    },
    moderate: {
      desc: "An occupied house needing dust walls and floor protection, an upper storey or a basement with a long carry, selective demolition where something has to survive, or a load-bearing element coming out under temporary shoring",
      interiorStrip: cost(5.5, 8.0, "Mid-upper of both bands; containment and carry are the difference and both are charged again as extras only when they exceed the tier.", "derived"),
      fullStructure: cost(9, 13, "Mid of the US teardown band, where salvage, protection and a neighbouring structure are involved.", "derived"),
      concreteRemoval: cost(5, 6.75, "Reinforced slab, hand-breaking at the edges.", "derived"),
      deckRemoval: cost(5.5, 7.5, "Elevated deck, footings out.", "derived"),
      wallRemoval: cost(34, 46, "Load-bearing, under temporary shoring. Shoring is charged separately when it stands for more than the day.", "derived"),
    },
    high: {
      desc: "Hazardous material abatement by others on the same site, structural or heritage work, hand demolition where no machine reaches, or a site where debris leaves by chute or by hand",
      interiorStrip: cost(8.5, 12, "Top of the US band and above it; hand-only work runs 1.6x the crew-hours (see the recipe).", "read"),
      fullStructure: cost(14, 20, "Top of the US teardown band, which is where every source puts heritage and hand-demolition work.", "read"),
      concreteRemoval: cost(7.5, 10, "Top of band — hand breakers and a chute.", "derived"),
      deckRemoval: cost(8, 11, "Above the published band: an elevated or rooftop deck coming down by hand and out by chute.", "derived"),
      wallRemoval: cost(52, 70, "Structural, staged, in an occupied house.", "derived"),
    },
  },

  items: [
    { id: "interior_strip", label: "Interior strip-out to studs", unit: "sqft", priceType: "interiorStrip" },
    { id: "full_structure", label: "Full structure demolition", unit: "sqft", priceType: "fullStructure" },
    { id: "concrete_removal", label: "Concrete removal", unit: "sqft", priceType: "concreteRemoval" },
    { id: "deck_removal", label: "Deck removal", unit: "sqft", priceType: "deckRemoval" },
    { id: "wall_removal", label: "Wall removal", unit: "linear ft", priceType: "wallRemoval" },
    { id: "kitchen_gut", label: "Kitchen gut", unit: "each", priceType: "flat", flatKey: "kitchenGutEach" },
    { id: "bathroom_gut", label: "Bathroom gut", unit: "each", priceType: "flat", flatKey: "bathroomGutEach" },
    { id: "chimney_removal", label: "Chimney removal", unit: "each", priceType: "flat", flatKey: "chimneyRemovalEach" },
    { id: "shed_removal", label: "Shed removal", unit: "each", priceType: "flat", flatKey: "shedRemovalEach" },
    { id: "hot_tub_removal", label: "Hot tub removal", unit: "each", priceType: "flat", flatKey: "hotTubRemovalEach" },
  ],

  flats: {
    kitchenGutEach: cost(1200, 1600, "Cabinets, tops, appliances out and disposed, services capped by others. US $1,000–$3,000.", "read"),
    bathroomGutEach: cost(850, 1150, "Fixtures, tile and substrate out. US $600–$2,000.", "read"),
    chimneyRemovalEach: cost(2200, 2900, "Take down above the roof line, cap and patch by others. US $1,500–$4,000.", "read"),
    shedRemovalEach: cost(650, 875, "Dismantle and dispose of a garden shed on a slab or skids. US $500–$1,200.", "read"),
    hotTubRemovalEach: cost(600, 800, "Cut down, carry out and dispose. US $400–$900.", "read"),
  },

  extras: {
    dumpsterPerHaul: cost(550, 700, "20-yard construction can, delivered and hauled, roughly 3 tons included. What the client is charged; the cost is in the recipe.", "derived"),
    overweightPerTon: cost(85, 110, "Over the included tonnage. US tipping $50–$120/ton for mixed C&D.", "read"),
    dustContainmentPerSqft: cost(1.1, 1.5, "Poly walls, zippers and negative air, per square foot of the area sealed off — not of the area demolished.", "derived"),
    floorProtectionPerSqft: cost(0.85, 1.15, "Board and tape over floors that stay, per square foot protected.", "derived"),
    shoringPerLf: cost(32, 43, "Temporary bearing wall standing more than the day it goes up.", "derived"),
    chuteSectionPerWeek: cost(30, 40, "Debris chute, per section per week.", "derived"),
  },

  minimumTotal: cost(800, 1050, "A three-person crew for half a day and one can. US small-job minimums $500–$1,200.", "read"),

  notPriced: [
    "asbestosAbatement — REGULATED. Licensed abatement to a scope written by a designated-substances survey. A default here would put a plausible price in front of a contractor for work he may not legally perform, and in front of a homeowner who would believe it.",
    "leadPaintAbatement — REGULATED, for the same reason and under the same kind of licence. A pre-1978 house is presumed positive until tested.",
    "mouldRemediation — same, and the scope is set by an air-clearance test nobody has run yet.",
    "designatedSubstanceSurvey — a consultant's fee, and the thing that must happen BEFORE any of the above can be quoted at all.",
    "permitFee — municipal, and demolition permits vary more than most.",
    "utilityDisconnects — performed by the utility or by a licensed trade under their own tariff.",
  ],
};

/* ══ DECK BUILDING ══════════════════════════════════════════════════════════
 *
 * Priced per square foot of deck by decking material, with railing per linear
 * foot and stairs per step — which is how the whole trade quotes and how every
 * published band is stated.
 *
 * ── The clearest case in this file against converting currencies ────────────
 *
 * Three materials, three different USD:CAD relationships, all real:
 *
 *   Pressure-treated SPF   Canada is where it is milled. The Canadian band sits
 *                          only ~1.45x the US one and the gap is labour, not
 *                          material.
 *   Western red cedar      Also milled here, and the Canadian premium over
 *                          treated is smaller than the US one.
 *   Composite and PVC      Imported into Canada in smaller volumes with a
 *                          thinner dealer network. ~1.55x, and the material is
 *                          most of it.
 *
 * A single exchange rate applied to the treated band would overprice Canadian
 * cedar and underprice Canadian composite in the same book.
 */

const DECK_BUILDING = {
  label: "Deck Building",

  meta: {
    categoryKey: "deck_building",
    catalogStatus: "proposed",
    industries: ["construction-contracting", "landscaping"],
    proposedCatalogEntry: {
      label: "Deck Building",
      icon: "Square",
      sortOrder: 40.5,
      // Two presets for the same reason the catalogue already gives paving
      // two: a landscape design-build firm sells decks, and a deck builder who
      // signed up as a landscaper would otherwise find his own trade missing
      // from his own list.
      industries: ["construction-contracting", "landscaping"],
    },
  },

  priceTypeUnits: {
    pressureTreated: "sqft",
    cedar: "sqft",
    composite: "sqft",
    pvc: "sqft",
    framingOnly: "sqft",
    railing: "linear ft",
  },

  complexity: {
    standard: {
      desc: "A rectangular ground-level or single-storey deck on open ground, standard joist spans, one set of stairs, footings dug by machine in workable soil",
      pressureTreated: cost(22, 32, "US treated deck $15–$35/sqft installed; CA $25–$40. Low-mid of both.", "read"),
      cedar: cost(32, 44, "US cedar $25–$45/sqft; CA $36–$55. Canadian cedar carries a smaller premium over treated than US cedar does, because it is milled here.", "read"),
      composite: cost(42, 65, "US composite $30–$60/sqft; CA $55–$95. The Canadian band starts above where the US one sits because the boards are imported.", "read"),
      pvc: cost(52, 82, "US PVC $40–$70/sqft; CA $70–$115.", "read"),
      framingOnly: cost(14, 20, "Structure, no decking — the client is supplying boards. Roughly the framing share of the treated rate.", "derived"),
      railing: cost(68, 98, "Treated or aluminium picket railing to guard height, supplied and installed. US $50–$120/lf.", "read"),
    },
    moderate: {
      desc: "Multiple levels or a wraparound, an elevated deck needing guards to code, angled or picture-framed decking, a built-in bench or planters, or footings through rock or clay",
      pressureTreated: cost(29, 42, "Mid-upper of both bands.", "derived"),
      cedar: cost(41, 56, "Mid-upper of both cedar bands, where the deck is multi-level and the boards are picture-framed.", "derived"),
      composite: cost(54, 84, "Mid of both; picture-framing needs 12-inch joist spacing, which is real extra framing (see the recipe).", "derived"),
      pvc: cost(66, 104, "Mid of both PVC bands — the board cost dominates and moves less with complexity than the labour does.", "derived"),
      framingOnly: cost(18, 26, "Framing share of the moderate treated rate.", "derived"),
      railing: cost(88, 127, "Top of the US band — glass or cable infill and more posts.", "derived"),
    },
    high: {
      desc: "Rooftop or over water, structural steel or engineered beams, curved framing, hidden fasteners with a mitred border, a full permit and inspection cycle, or a site reachable only by hand",
      pressureTreated: cost(38, 55, "Above both published treated bands, which assume open ground and a rectangle at one level.", "derived"),
      cedar: cost(54, 74, "Above the published cedar band — curved framing and mitred borders are cut one board at a time.", "derived"),
      composite: cost(70, 109, "Top of the US band and above the Canadian one.", "derived"),
      pvc: cost(85, 134, "Above the published PVC band, where the structure below it is steel or engineered rather than treated.", "derived"),
      framingOnly: cost(24, 34, "Framing share of the high treated rate.", "derived"),
      railing: cost(115, 166, "Above the US band — frameless glass and structural posts have no published per-foot rate.", "derived"),
    },
  },

  items: [
    { id: "deck_pt", label: "Deck — pressure-treated", unit: "sqft", priceType: "pressureTreated" },
    { id: "deck_cedar", label: "Deck — cedar", unit: "sqft", priceType: "cedar" },
    { id: "deck_composite", label: "Deck — composite", unit: "sqft", priceType: "composite" },
    { id: "deck_pvc", label: "Deck — PVC", unit: "sqft", priceType: "pvc" },
    { id: "framing_only", label: "Deck framing only", unit: "sqft", priceType: "framingOnly" },
    { id: "railing", label: "Railing", unit: "linear ft", priceType: "railing" },
    { id: "stairs", label: "Stairs", unit: "each", priceType: "flat", flatKey: "stepEach" },
    { id: "footing", label: "Footing", unit: "each", priceType: "flat", flatKey: "footingEach" },
    { id: "bench", label: "Built-in bench", unit: "linear ft", priceType: "flat", flatKey: "benchPerLf" },
    { id: "skirting", label: "Skirting / lattice", unit: "linear ft", priceType: "flat", flatKey: "skirtingPerLf" },
    { id: "gate", label: "Gate", unit: "each", priceType: "flat", flatKey: "gateEach" },
  ],

  flats: {
    stepEach: cost(150, 210, "One step across a standard 4-foot stair: stringer share, tread, riser and rail. US $100–$200 per step.", "read"),
    footingEach: cost(275, 375, "Dug, tubed, poured and bracketed. Above the concrete book's bare pier because a deck footing carries a saddle and a layout to a string line.", "derived"),
    benchPerLf: cost(85, 115, "Built-in bench with a back, per linear foot.", "derived"),
    skirtingPerLf: cost(32, 44, "Framed lattice or board skirting with an access hatch.", "derived"),
    gateEach: cost(350, 480, "Self-closing gate with hardware to pool-code where it applies.", "derived"),
  },

  extras: {
    demoExistingDeckPerSqft: cost(4, 5.5, "Tear out and dispose of the deck that is there. Matches the demolition book's own deck-removal rate, which is the point — two books disagreeing about one task is how a client gets two prices.", "read"),
    hiddenFastenersPerSqft: cost(3, 4.25, "Clip system instead of face screws: the clips cost more and the install runs about 45% slower (see the recipe hours).", "derived"),
    pictureFrameBorderPerLf: cost(14, 19, "Mitred border with the extra blocking it needs underneath.", "derived"),
    deckLightingPerFixture: cost(65, 88, "Low-voltage riser or post light, supplied and wired to a transformer.", "derived"),
    stainSealPerSqft: cost(2.2, 3.0, "One coat on new treated or cedar once it has dried down. US $1.50–$3/sqft.", "read"),
    underDeckDrainagePerSqft: cost(9, 12.5, "Under-deck drainage ceiling on an elevated deck. US $7–$14/sqft.", "read"),
  },

  minimumTotal: cost(3000, 4000, "Footings, a frame and a delivery is three crew-days before any decking goes down.", "derived"),

  notPriced: [
    "permitFee — municipal, and deck permits differ more between neighbouring towns than almost any other.",
    "engineeredDrawings — required for rooftop and some elevated decks; an engineer's invoice.",
    "poolCodeInspection — a municipal inspection fee where a deck forms part of a pool enclosure.",
  ],
};

export const STRUCTURAL_PRICE_BOOKS = {
  concrete: CONCRETE,
  asphalt_paving: ASPHALT_PAVING,
  masonry: MASONRY,
  stucco: STUCCO,
  framing: FRAMING,
  demolition: DEMOLITION,
  deck_building: DECK_BUILDING,
};

/* ══ COST RECIPES ═══════════════════════════════════════════════════════════
 *
 * The other half: what the job COSTS, so the margin panel has something real to
 * subtract. Nothing here is client-facing.
 *
 * ── Shape: flat keys, and why that is not laziness ──────────────────────────
 *
 * getRecipe() in app/data/materialRecipes.js merges a company's overrides with
 * `{ ...base, ...overrides }` and deep-merges exactly two nested keys, listed in
 * a module-private `NESTED_KEYS`. Grouping these forty-odd fields under
 * `materials` / `labour` / `equipment` would read better and would silently
 * destroy a company's other forty fields the moment they edited one, because
 * that private list cannot be extended from here. So every field is flat and
 * prefixed, `consumables` is the one nesting (it is already registered), and
 * the file reads slightly worse in exchange for merging correctly today with no
 * edit to materialRecipes.js at all.
 *
 * ── Labour is HOURS, never dollars ──────────────────────────────────────────
 *
 * Every `labour*` key is crew-hours. The company's own labour rate multiplies
 * them, which is the whole reason a rate is not baked in: two companies with
 * the same productivity and different payroll must get different costs from the
 * same recipe. This follows lib/pricing/paverLabour.js, and where a figure here
 * matches one there it is because the same work is being done, not because it
 * was copied.
 *
 * Most hour figures are derived the same way: a stated crew-day output divided
 * into crew-hours. `basis` shows the division every time so it can be checked
 * against a real timesheet rather than believed.
 *
 * ── Equipment is a day rate or a move, never a percentage ───────────────────
 *
 * `equip*PerDay` is a rental day rate — what it costs whether you rent it or own
 * it, because an owned machine that is not earning its rental rate is losing
 * money. `equip*Move` is a float in and out, charged once. A dumpster is neither:
 * it is a delivery, an included tonnage and a per-ton overage, and modelling it
 * as a day rate is how a demolition job goes over on weight nobody counted.
 *
 * ── Waste and overage are separate from consumption, deliberately ───────────
 *
 * `waste*Pct` multiplies a computed quantity. It is not folded into the coverage
 * figure, because a contractor who buys better or cuts tighter should be able to
 * lower one without disturbing the other — and because a waste factor hidden
 * inside a coverage number is a waste factor nobody ever revisits.
 */

/* ── Concrete ───────────────────────────────────────────────────────────── */

const CONCRETE_RECIPE = {
  model: "concrete_flatwork",
  label: "Concrete",

  // ── Geometry. The whole cost hangs off this conversion.
  cuFtPerCuYd: spec(27, "Definition.", "read"),
  sqftPerCuYdAtOneInch: spec(324, "27 cu ft x 12 = 324 sqft at 1 inch. A 4-inch slab is therefore 81 sqft per cubic yard, which is the number every dispatcher quotes.", "read"),
  defaultSlabThicknessIn: spec(4, "Residential flatwork standard. Driveways are commonly 5.", "read"),
  defaultBaseDepthIn: spec(6, "6 inches of compacted granular under residential flatwork. 8 in frost-heave country, which is what the field is for.", "read"),

  // ── Materials
  matReadyMixPerCuYd: cost(155, 235, "3,000–4,000 psi ready mix delivered, 2025. US national $145–$165/cu yd; CA $210–$260. The Canadian spread is wider because far more plants are single-supplier in their market.", "read"),
  matReadyMixDeliveryPerLoad: cost(90, 120, "Fuel and environmental surcharge per truck, charged by nearly every plant and left off nearly every estimate.", "read"),
  matShortLoadFeePerCuYdShort: cost(45, 60, "Charged per cubic yard BELOW the plant minimum. US $40–$60/yd short.", "read"),
  specShortLoadMinCuYd: spec(3, "Most plants set the minimum at 3 cubic yards. Below it the short-load fee starts.", "read"),
  matGravelPerCuYd: cost(30, 34, "Granular A / crushed base at the pit, material only — delivery is the next field. Ottawa reference: Greely Sand & Gravel publish $33.50/cu yd plus a flat $190 delivery, which is the same shape.", "read"),
  matAggregateDeliveryPerLoad: cost(150, 190, "One triaxle load. Carried separately from the yardage on purpose: $190 over an 11-yard patio is $17/yd and over a 60-yard driveway is $3.", "read"),
  specCuYdPerAggregateLoad: spec(16, "A standard triaxle load.", "read"),
  matRebar20ftStick: cost(12, 16, "#4 (10M) deformed bar, 20 ft / 6 m. US retail $11–$14; CA $15–$18.", "read"),
  matMeshPerSqft: cost(0.22, 0.3, "6x6 W1.4 welded wire mesh. A 5 ft x 150 ft roll is 750 sqft at roughly $165 US.", "read"),
  matFibrePerCuYd: cost(8, 11, "Polypropylene fibre dosed at the plant, per cubic yard. Replaces mesh on most residential flatwork.", "read"),
  matFormLumberPerLf: cost(1.3, 1.75, "2x8 SPF form stock, per linear foot, bought new.", "read"),
  specFormReuses: spec(4, "Form lumber survives roughly four pours before it is scrap. The per-job cost is the stock price divided by this — leaving it out charges every job for lumber four jobs share.", "derived"),
  matVapourBarrierPerSqft: cost(0.1, 0.13, "6-mil poly under an interior or garage slab.", "read"),
  matCuringCompoundPerSqft: cost(0.05, 0.07, "5 gallons covers roughly 1,500 sqft at about $70 US.", "derived"),
  matExpansionJointPerLf: cost(0.55, 0.75, "Half-inch fibre expansion joint at slab edges and columns.", "read"),
  matSealerPerSqft: cost(0.18, 0.24, "Acrylic cure-and-seal, material only. The applied rate is in the price book's extras.", "derived"),

  // ── Waste and overage
  wasteConcreteOverOrderPct: spec(0.08, "Subgrade is never as flat as the takeoff. Trade practice is 5–10% over on flatwork; 8% is the midpoint. Under-ordering costs a second truck and a cold joint, which is why this errs up.", "read"),
  wasteRebarPct: spec(0.1, "Cutting and lapping.", "read"),
  wasteMeshPct: spec(0.1, "Mesh is lapped one square at every seam.", "read"),
  wasteGravelPct: spec(0.1, "Compaction loss and spillage between the pile and the hole.", "derived"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(4, "Load, travel, set out, and put away. Half the paving book's 8 because no excavator is floated for flatwork. It does NOT scale with area, which is the whole reason it is separate.", "derived"),
  labourExcavationHoursPerCuYd: spec(0.35, "Machine digging with one hand trimming. Independently the same figure lib/pricing/paverLabour.js measured, because it is the same work.", "read"),
  labourBaseHoursPerCuYd: spec(0.3, "Spreading and compacting granular, lift by lift. Same source and same reasoning.", "read"),
  labourFormingHoursPerLf: spec(0.07, "Two hands form roughly 110 linear feet of edge form in a day: 16 crew-hours / 110 = 0.145 for one, 0.07 for the pair working a straight run.", "derived"),
  labourReinforcingHoursPerSqft: spec(0.006, "Rolling mesh or tying a mat: two hands cover roughly 1,300 sqft in a day. 8 / 1,300 = 0.006.", "derived"),
  labourPlaceFinishHoursPerSqft: spec(0.032, "The big one. A three-person finishing crew places and finishes 800–1,000 sqft of 4-inch broom slab in a day: 24 crew-hours / 850 = 0.028, taken at 0.032 because the last hour of a pour is never productive and it is always charged.", "derived"),
  labourStampHoursPerSqft: spec(0.035, "Stamping roughly doubles the finishing half of the pour. Added to place-and-finish, not replacing it.", "derived"),
  labourStripFormsHoursPerLf: spec(0.02, "A separate visit, which is why it is separate hours.", "derived"),
  labourSawCutHoursPerLf: spec(0.02, "Within 12 hours of the pour, usually a night call-out.", "derived"),
  labourRemoveExistingHoursPerSqft: spec(0.05, "Breaking out a reinforced 4-inch slab. Two and a half times the paving book's 0.02 for lifting pavers, because this is a breaker and rebar rather than a pry bar.", "derived"),
  labourSealHoursPerSqft: spec(0.004, "Roller or sprayer on a cured slab.", "derived"),
  labourCleanupHoursPerSqft: spec(0.004, "Wash-down and site tidy.", "derived"),

  // ── Equipment
  equipConcretePumpPerDay: cost(1100, 1450, "Boom pump with operator. US $1,000–$1,600/day including the operator and a minimum.", "read"),
  equipLinePumpPerHalfDay: cost(650, 850, "Trailer line pump, the residential answer where a boom will not fit. US $600–$900 for a half day.", "read"),
  equipPlateCompactorPerDay: cost(75, 95, "Reversible plate, rental day.", "read"),
  equipPowerTrowelPerDay: cost(90, 120, "36-inch walk-behind, rental day.", "read"),
  equipConcreteSawPerDay: cost(95, 125, "14-inch walk-behind, rental day, blade extra.", "read"),
  equipSkidSteerPerDay: cost(300, 390, "Rental day without operator.", "read"),
  equipMiniExcavatorPerDay: cost(350, 450, "3-ton class, rental day without operator.", "read"),
  equipMachineMove: cost(400, 520, "Float in and out, charged once per job however many days the machine stays.", "derived"),
  equipDumpsterConcretePerHaul: cost(480, 620, "A 10-yard clean-concrete can, delivered and hauled. Small on purpose — broken concrete is roughly 2 tons per cubic yard and a 20-yard can of it cannot legally be lifted.", "read"),
  // A tipping rate, NOT a day rate, so it is not named equip*: the check
  // asserts every equip* key ends in a period or a move, and a per-ton charge
  // that pretends to be a day rate is how a disposal cost gets multiplied by
  // the number of days a machine sat on site.
  matConcreteTipPerTon: cost(25, 35, "Clean concrete at a recycler, well below the $75–$110 mixed C&D rate. Sorting it out of the mixed can is worth real money and almost nobody does.", "read"),
  specBrokenConcreteTonsPerCuYd: spec(2.0, "Broken concrete runs about 4,000 lb per cubic yard. This is why a concrete can is 10 yards and a demolition can is 20.", "read"),

  consumables: {
    formStakesAndTies: {
      label: "Form stakes, ties and release",
      costPerLf: cost(0.55, 0.75, "Stakes, snap ties and form release, spread over the linear feet of form they serve.", "derived"),
    },
    blades: {
      label: "Saw and grinder blades",
      costPerSqft: cost(0.01, 0.014, "Diamond blade life over the area it cuts.", "derived"),
    },
    finishingTools: {
      label: "Floats, edgers and brushes, per job",
      costPerJob: cost(25, 33, "Consumed tooling amortised per pour.", "derived"),
    },
  },
};

/* ── Asphalt paving ─────────────────────────────────────────────────────── */

const ASPHALT_RECIPE = {
  model: "asphalt_paving",
  label: "Asphalt Paving",

  // ── The conversion that decides the whole material bill.
  //
  // Compacted hot mix runs about 145 lb per cubic foot. One ton is 2,000 / 145
  // = 13.79 cu ft, which spread one inch thick (1/12 ft) covers 165 sqft. The
  // trade's own rule of thumb — "a ton covers about 80 square feet at two
  // inches" — is this same number halved, which is the cross-check.
  specSqftPerTonAtOneInch: spec(165, "2,000 lb / 145 lb per cu ft = 13.79 cu ft; x 12 = 165 sqft at 1 inch. Reproduces the trade rule of 82 sqft at 2 inches.", "read"),
  specCompactedDensityLbPerCuFt: spec(145, "Standard compacted HMA density. Stated separately so a company using a different mix design can correct the coverage rather than guess at it.", "read"),
  defaultSurfaceLiftIn: spec(2, "One 2-inch compacted surface lift over a sound base.", "read"),
  defaultBinderLiftIn: spec(2, "A second lift on a full-depth rebuild.", "read"),
  defaultBaseDepthIn: spec(6, "6 inches of granular under a residential drive; 8 over soft subgrade.", "read"),

  // ── Materials
  matHotMixPerTon: cost(110, 155, "Superpave / HL3 surface mix, FOB plant, 2025. US $95–$130/ton; CA $130–$180. Both move with liquid asphalt cement quarterly and this is the field to re-read first.", "read"),
  matHotMixHaulPerTon: cost(12, 16, "Trucking from plant to site inside a normal service radius. Charged per ton because that is how the hauler bills.", "read"),
  matGravelPerCuYd: cost(30, 34, "Granular A at the pit, material only. Same source as the concrete recipe, and deliberately the same number: it is the same stone from the same pit.", "read"),
  matAggregateDeliveryPerLoad: cost(150, 190, "One triaxle load delivered inside a normal service radius, charged flat by the pit whatever the yardage.", "read"),
  specCuYdPerAggregateLoad: spec(16, "A standard triaxle load, which is what the flat delivery charge above is quoted against.", "read"),
  matTackCoatPerGal: cost(5, 7, "Asphalt emulsion, per gallon in bulk.", "read"),
  specTackCoatCoverageSqftPerGal: spec(180, "Applied at 0.05 gal per square yard, which is 0.0056 gal per square foot, which is 180 sqft to the gallon.", "derived"),
  matGeogridPerSqft: cost(0.42, 0.55, "Biaxial geogrid, material only. The installed rate is in the book's extras.", "read"),

  // ── Waste
  wasteMixOverOrderPct: spec(0.06, "Hot mix cannot be returned and cannot wait: you order the truck up, not down. 5–8% is the trade practice and this is the middle of it.", "read"),
  wasteGravelPct: spec(0.1, "Compaction loss and spillage.", "derived"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(6, "Float paver and roller, set out, sweep, and put away. Fixed — a 600 sqft driveway and a 6,000 sqft lot cost the same afternoon.", "derived"),
  labourPavingHoursPerSqft: spec(0.008, "A five-person crew behind a paver lays 1,000–1,500 sqft an hour on residential work: 5 crew-hours / 1,200 = 0.0042. Taken at 0.008 — nearly double — because residential paving is stop-start, and every hour of a driveway that is not under the paver is a hand-raked edge.", "derived"),
  labourHandLaidFactor: spec(2.0, "Areas a paver cannot reach are raked and rolled by hand at roughly half the rate. A multiplier rather than a second rate, so it moves when the base rate does.", "derived"),
  labourExcavationHoursPerCuYd: spec(0.35, "Same work, same figure, as the concrete and interlock books.", "read"),
  labourBaseHoursPerCuYd: spec(0.3, "Spreading and compacting granular lift by lift — the same work at the same rate as the other two books.", "read"),
  labourMillingHoursPerSqft: spec(0.012, "Walk-behind milling at the garage door and the apron so the new surface ties in flush.", "derived"),
  labourRemoveExistingHoursPerSqft: spec(0.01, "Ripping old asphalt is quicker than breaking concrete: it comes up in sheets.", "derived"),
  labourTackCoatHoursPerSqft: spec(0.001, "One sprayer pass.", "derived"),
  labourCleanupHoursPerSqft: spec(0.002, "Sweep, edge and shoulder.", "derived"),

  // ── Equipment
  equipPaverPerDay: cost(900, 1200, "8-foot commercial paver, rental day. Most residential contractors own one; the day rate is still the honest cost, because an owned paver that is not earning it is losing money.", "read"),
  equipRollerPerDay: cost(300, 390, "2–3 ton double-drum, rental day.", "read"),
  equipMillingMachinePerDay: cost(450, 580, "Walk-behind cold planer, rental day.", "read"),
  equipSkidSteerPerDay: cost(300, 390, "Rental day without operator, for moving granular and trimming grade.", "read"),
  equipPlateCompactorPerDay: cost(75, 95, "Rental day, for edges and around structures the roller cannot reach.", "read"),
  equipMachineMove: cost(600, 780, "Lowbed in and out for the paver and roller together.", "derived"),
  matAsphaltTipPerTon: cost(12, 16, "Reclaimed asphalt at a recycler. Often free or nearly so — it is a feedstock, not a waste — which is why this sits well under the mixed C&D rate.", "read"),
  specMilledAsphaltTonsPerCuYd: spec(1.6, "Broken and milled asphalt runs around 3,200 lb per cubic yard.", "read"),

  consumables: {
    releaseAgent: {
      label: "Release agent and truck-box wash",
      costPerSqft: cost(0.002, 0.003, "Non-stick release on the paver, the rakes and the truck box.", "derived"),
    },
    handTools: {
      label: "Rakes, lutes and shovels, per job",
      costPerJob: cost(30, 40, "Hand tools that do not survive a season of hot mix.", "derived"),
    },
    jointSealer: {
      label: "Joint sealer at cold joints",
      costPerLf: cost(0.35, 0.47, "Rubberised sealer at every cold joint and edge.", "derived"),
    },
  },
};

/* ── Sealcoating ────────────────────────────────────────────────────────────
 *
 * A recipe only. `driveway_sealing` already ships a sell book in
 * tradePriceBooks.js — complexity tiers, an Ontario source, six references —
 * and it did not need a second one. What it has never had is a cost side, so
 * the margin on a sealing job has been computed against nothing.
 *
 * Adding a `driveway_sealing` entry to STRUCTURAL_PRICE_BOOKS would have
 * OVERWRITTEN that book on the spread. The absence is the point.
 */

const SEALCOAT_RECIPE = {
  model: "sealcoat_area",
  label: "Driveway Sealing",

  // The Canadian figure is NOT the US one converted, and the reason is
  // regulatory rather than monetary: refined coal-tar sealer is restricted or
  // banned across a growing list of Canadian municipalities, so the Canadian
  // market runs on asphalt emulsion, which costs more per gallon and covers
  // slightly less. That is a different product at a different price, not the
  // same product at a different exchange rate.
  matSealerPerGal: cost(2.6, 3.9, "Sealer bought in bulk (275-gallon tote or drum). US $2.00–$2.75/gal for coal-tar emulsion bulk; CA $3.50–$4.40 for asphalt emulsion. A 5-gallon pail is $18–$25, which is $3.60–$5.00 a gallon and is what a small operator actually pays — the direction to move this if you are not buying bulk.", "read"),
  specCoverageSqftPerGalPerCoat: spec(70, "One coat covers 70–80 sqft per gallon on a previously sealed drive and as little as 55–60 on a rough or porous one. 70 is the conservative end of the normal case.", "read"),
  defaultCoats: spec(2, "Two coats is the standard residential specification. One coat is a touch-up, not a seal job.", "read"),
  matSandPerBag: cost(8, 10, "50 lb silica sand, added for traction and wear. A commodity that prices almost the same on both sides of the border, which is why this pair is the tightest in the recipe.", "read"),
  specSandLbPerGal: spec(3, "3 lb per gallon of sealer is the common additive rate; 2–5 depending on the manufacturer.", "read"),
  matCrackFillerPerBox: cost(45, 62, "30 lb box of hot-pour rubberised crack filler. US $38–$52; CA $55–$70.", "read"),
  specCrackFillerLfPerBox: spec(150, "Roughly 150 linear feet of a half-inch crack per 30 lb box.", "derived"),
  matOilSpotPrimerPerQuart: cost(12, 17, "Oil-spot primer. Skipping it is why sealer lifts in front of the garage door. Thinly stocked in Canada, which is most of the difference.", "read"),

  wasteSealerOverOrderPct: spec(0.1, "Mixed sealer left in the tank at the end of a driveway is spent, not stock.", "derived"),

  labourMobilisationHours: spec(1.5, "Load the rig, travel, set cones and signage, and put away.", "derived"),
  labourPrepHoursPerSqft: spec(0.003, "Blow, edge and wire-brush. A two-person crew preps a 1,000 sqft drive in about an hour and a half: 3 / 1,000 = 0.003.", "derived"),
  labourApplyHoursPerSqftPerCoat: spec(0.004, "Squeegee or spray, per coat. Two people cover a 1,000 sqft drive in a coat in about two hours: 4 / 1,000 = 0.004.", "derived"),
  labourCrackFillHoursPerLf: spec(0.02, "Rout, blow and pour, per linear foot of crack.", "derived"),
  labourCureWatchHours: spec(1, "Somebody stays until it is safe to leave unattended, on every job, and it is never in the estimate.", "derived"),

  equipSealRigPerDay: cost(150, 215, "Tank, agitator and spray unit, day rate. Nearly always owned, so the rate is what it costs to own it — and the Canadian figure is higher for a reason that has nothing to do with currency: the same rig earns its keep over a season roughly a third shorter.", "read"),
  equipBlowerPerDay: cost(40, 52, "Backpack or walk-behind blower, day rate. A commodity small engine sold through the same channels in both markets.", "read"),
  equipCrackMelterPerDay: cost(120, 155, "Hot-pour melter and wand, day rate. Widely rented in both markets, which keeps the two figures close.", "read"),

  consumables: {
    squeegeesAndBrushes: {
      label: "Squeegees and brushes, per job",
      costPerJob: cost(18, 25, "Squeegee blades and brushes, which do not survive many jobs in sealer.", "derived"),
    },
    barricadeTape: {
      label: "Barricade tape and cones, per job",
      costPerJob: cost(6, 9, "Tape and signage so nobody drives on it. Cheap, and the alternative is a re-coat.", "derived"),
    },
  },
};

/* ── Masonry ────────────────────────────────────────────────────────────── */

const MASONRY_RECIPE = {
  model: "masonry_unit",
  label: "Masonry",

  // ── The two standing constants of the trade.
  specBricksPerSqft: spec(6.75, "Modular brick with a 3/8-inch joint: 6.75 per square foot of wall face. This has been the figure for a century and every yard quotes against it.", "read"),
  specBlocksPerSqft: spec(1.125, "8x8x16 CMU with a 3/8-inch joint: 1.125 per square foot of wall face.", "read"),
  specSqftPerTonStone: spec(35, "Natural stone veneer at a 3-4 inch bed covers roughly 35 square feet to the ton. Thicker stone covers less and this is the field that says so.", "read"),

  // ── Materials
  matBrickPer1000: cost(620, 1050, "Standard modular face brick. US $500–$800 per thousand; CA $900–$1,300. The Canadian band starts above the US one because fewer plants serve a longer haul.", "read"),
  matBlockEach: cost(2.2, 3.4, "8x8x16 standard CMU.", "read"),
  matStoneManufacturedPerSqft: cost(8.5, 12, "Manufactured stone veneer flats, material only. US $6–$11/sqft.", "read"),
  matStoneManufacturedCornerPerLf: cost(12, 17, "Corner pieces, priced per linear foot and always short-ordered.", "read"),
  matStoneNaturalPerTon: cost(320, 430, "Natural thin-bed veneer, per ton. US $250–$400.", "read"),
  matMortarPerBag: cost(7, 9.5, "80 lb Type N or S premixed mortar.", "read"),
  specMortarBagsPerSqftBrick: spec(0.22, "One bag lays roughly 30 modular brick. 30 brick is 4.4 sqft at 6.75/sqft, so 1 / 4.4 = 0.22 bags per square foot.", "derived"),
  specMortarBagsPerSqftBlock: spec(0.045, "One bag lays roughly 25–30 block. 28 block is 24.9 sqft at 1.125/sqft, so 1 / 24.9 = 0.04. Taken at 0.045 for the head joints on a returns-heavy wall.", "derived"),
  matMasonrySandPerCuYd: cost(32, 40, "For shops that mix on site rather than buying premixed bags. Set one of the two to zero — carrying both as live costs double-counts the mortar.", "read"),
  matWallTiesPer500: cost(35, 48, "Corrugated or adjustable veneer ties, box of 500.", "read"),
  specTiesPerSqft: spec(0.375, "16 inches horizontally by 24 inches vertically is one tie per 2.67 sqft, which is 0.375 per square foot. Code minimum in most of North America; check your own.", "read"),
  matWeepVentEach: cost(0.6, 0.85, "One moulded weep vent. Cheap, and leaving them out is what turns a cavity wall into a tank.", "read"),
  specWeepsPerLf: spec(0.5, "One every 24 inches along the base course.", "read"),
  matFlashingPerLf: cost(2.2, 3.0, "Through-wall flashing membrane.", "read"),
  matRebar20ftStick: cost(12, 16, "#4 (10M) for filled block cores. Same stock as the concrete recipe.", "read"),
  matCoreFillGroutPerCuYd: cost(175, 250, "Fine grout for filling block cores. Above plain ready mix because of the aggregate size and the small load.", "read"),
  matLintelAnglePerLf: cost(14, 19, "Galvanised steel angle lintel, per linear foot.", "read"),

  // ── Waste
  wasteBrickPct: spec(0.05, "Cuts, breakage and colour culling. 5% is the trade standard and the yard expects the order to carry it.", "read"),
  wasteBlockPct: spec(0.05, "Cuts and breakage, same trade allowance as brick. Block breaks less and gets cut more.", "read"),
  wasteStoneNaturalPct: spec(0.1, "Natural stone is sorted and cut on site and 10% is normal. Ordering it flat is how a job runs out of stone with one elevation left and a dye lot that no longer exists.", "read"),
  wasteMortarPct: spec(0.08, "Board waste and a batch that goes off.", "derived"),

  // ── Labour, crew-hours (a mason plus a tender is 2 crew-hours per hour)
  labourBrickHoursPerSqft: spec(0.22, "A mason lays 400–600 brick a day on residential veneer. 500 brick is 74 sqft; with a tender that is 16 crew-hours, so 16 / 74 = 0.216.", "derived"),
  labourBlockHoursPerSqft: spec(0.11, "150–200 8-inch block a day. 175 block is 155 sqft; 16 crew-hours / 155 = 0.103, taken at 0.11 for cutting.", "derived"),
  labourStoneManufacturedHoursPerSqft: spec(0.2, "60 sqft per mason-day with partial tending: roughly 12 crew-hours / 60 = 0.20.", "derived"),
  labourStoneNaturalHoursPerSqft: spec(0.4, "25–40 sqft per mason-day. 32 sqft with a tender is about 13 crew-hours, so 13 / 32 = 0.40. Sorting and cutting is most of it.", "derived"),
  labourRepointHoursPerSqft: spec(0.3, "Grinding out to depth and repointing runs 30–50 sqft per mason-day. 40 sqft is 0.20 mason-hours per square foot, plus the grinding and the dust control on top.", "derived"),
  labourChimneyHoursPerVerticalFt: spec(2.6, "A mason and a tender rebuild roughly 6 vertical feet of a standard chimney in a day above the roof line: 16 / 6 = 2.6.", "derived"),
  labourScaffoldHoursPerLiftPer20Lf: spec(3, "Erect and strike one lift over a 20-foot elevation, both ends.", "derived"),
  labourMobilisationHours: spec(5, "Mixer, boards, banker and a stock delivery to place.", "derived"),
  labourCleanupHoursPerSqft: spec(0.01, "Wash-down, pointing up and site tidy.", "derived"),

  // ── Equipment
  equipScaffoldSectionPerWeek: cost(25, 35, "One frame section with braces and a plank, rented by the week.", "read"),
  equipMortarMixerPerDay: cost(70, 95, "Towable or portable mixer, rental day.", "read"),
  equipBrickSawPerDay: cost(90, 120, "Masonry wet saw, rental day, blade extra.", "read"),
  equipTelehandlerPerDay: cost(450, 580, "For setting stone pallets at height.", "read"),
  equipBoomLiftPerDay: cost(350, 450, "Towable boom where scaffold will not stand.", "read"),
  equipDumpsterPerHaul: cost(550, 700, "20-yard can for masonry rubble, delivered and hauled.", "read"),

  consumables: {
    blades: {
      label: "Diamond and grinder blades",
      costPerSqft: cost(0.03, 0.04, "Brick-saw and pointing-grinder blade life. Repointing burns several times this — grinding out a joint is what kills a blade.", "derived"),
    },
    jointingTools: {
      label: "Jointers, line pins and blocks, per job",
      costPerJob: cost(30, 40, "Jointers, line blocks, pins and a corner pole.", "derived"),
    },
    dustControl: {
      label: "Dust suppression and sheeting",
      costPerSqft: cost(0.02, 0.027, "Water, sheeting and filters on a grinding job.", "derived"),
    },
  },
};

/* ── Stucco & EIFS ──────────────────────────────────────────────────────── */

const STUCCO_RECIPE = {
  model: "stucco_coat",
  label: "Stucco & EIFS",

  // ── Traditional three-coat: 3/8 scratch + 3/8 brown + 1/8 finish.
  specBaseCoats: spec(2, "Scratch and brown. The finish coat is priced separately below because it is a different material bought in a different unit.", "read"),
  matBaseCoatPerBag: cost(11, 15, "80 lb bag of Portland-lime stucco base.", "read"),
  specBaseCoatSqftPerBag: spec(25, "One 80 lb bag covers about 25 sqft at 3/8 inch. Two base coats therefore need two bags per 25 sqft, which is where the total 7/8-inch build comes from.", "read"),
  matFinishCoatPerPail: cost(95, 130, "5-gallon pail of acrylic finish.", "read"),
  specFinishSqftPerPail: spec(115, "100–140 sqft per pail depending on texture; a heavy sand float is at the bottom of that. 115 is the conservative middle.", "read"),

  // ── EIFS
  matEifsBoardPerSheet: cost(22, 30, "1-inch EPS, 4x8 sheet.", "read"),
  specEifsBoardSqftPerSheet: spec(32, "A 4 x 8 sheet is 32 square feet. Definitional, and not offered as an editable field.", "read"),
  matEifsBasePerPail: cost(75, 100, "5-gallon pail of base coat / adhesive.", "read"),
  specEifsBaseSqftPerPail: spec(90, "One pail per 90 sqft at the specified base-coat thickness.", "read"),
  matMeshPerRoll: cost(90, 120, "38-inch by 150-foot roll of standard reinforcing mesh.", "read"),
  specMeshSqftPerRoll: spec(475, "38 inches x 150 feet is 475 square feet of roll.", "derived"),
  specMeshLapFactor: spec(1.15, "Mesh laps 2.5 inches at every seam. That is CONSUMPTION, not waste, and it is held apart from the waste factor because a contractor who cuts tighter can lower one and not the other.", "read"),

  // ── Common to both
  matLathPerSheet: cost(9, 12, "2.5 lb diamond mesh metal lath, 27 x 96 inches.", "read"),
  specLathSqftPerSheet: spec(18, "27 x 96 inches is 18 square feet.", "derived"),
  matBuildingPaperPerRoll: cost(40, 55, "Grade D building paper, 500 sqft roll.", "read"),
  specWrbLayers: spec(2, "Two layers of grade D behind traditional stucco is the standard drainage detail. One layer is where the callbacks come from.", "read"),
  matCasingBeadPer10ft: cost(9, 12, "Galvanised casing bead or weep screed, 10-foot length.", "read"),
  matSealantPerTube: cost(9, 12, "Low-modulus polyurethane sealant.", "read"),
  specSealantLfPerTube: spec(25, "About 25 linear feet of a 3/8 by 3/8 joint per tube.", "derived"),

  // ── Waste
  wasteLathPct: spec(0.1, "Cutting around openings.", "derived"),
  wasteMeshPct: spec(0.08, "Offcuts only — the lap is counted separately above.", "derived"),
  wasteMixPct: spec(0.08, "Board waste and material that goes off in the hawk.", "derived"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(6, "Mixer, scaffold, hoses, water and a stock drop.", "derived"),
  labourWrbAndLathHoursPerSqft: spec(0.035, "Paper and lath: a three-person crew covers roughly 700 sqft a day. 24 / 700 = 0.034.", "derived"),
  labourScratchCoatHoursPerSqft: spec(0.03, "A three-person crew scratches about 800 sqft a day: 24 / 800 = 0.030.", "derived"),
  labourBrownCoatHoursPerSqft: spec(0.03, "Same output; darbying to a plane is the slow part rather than the application.", "derived"),
  labourFinishCoatHoursPerSqft: spec(0.028, "Texture is slower per pass but thinner. Roughly 850 sqft per crew-day.", "derived"),
  labourEifsBoardHoursPerSqft: spec(0.03, "Cutting, rasping and adhering board.", "derived"),
  labourEifsBaseMeshHoursPerSqft: spec(0.035, "Embedding mesh is the slowest EIFS operation and the one that decides whether it fails.", "derived"),
  labourDetailHoursPerLf: spec(0.12, "Bands, reveals and quoins, per linear foot of detail.", "derived"),
  labourReturnTripHoursPerCoatDay: spec(2, "Every coat after the first is a separate visit with its own travel and set-up. Three-coat stucco is three of them and estimates routinely count one.", "derived"),
  labourScaffoldHoursPerLiftPer20Lf: spec(3, "Same as masonry.", "derived"),
  labourCleanupHoursPerSqft: spec(0.008, "Scrape, wash and protect below.", "derived"),

  // ── Equipment
  equipPlasterMixerPerDay: cost(70, 95, "Paddle or drum mixer, rental day.", "read"),
  equipHopperGunPerDay: cost(110, 145, "Hopper gun and compressor for spray application.", "read"),
  equipScaffoldSectionPerWeek: cost(25, 35, "One frame section per week.", "read"),
  equipSwingStagePerDay: cost(450, 580, "Suspended stage with rigging and an outrigger set.", "read"),
  equipDumpsterPerHaul: cost(550, 700, "20-yard can for a tear-off.", "read"),

  consumables: {
    masking: {
      label: "Masking film, paper and tape",
      costPerSqft: cost(0.03, 0.04, "Windows, doors and everything below the wall, masked once per coat day.", "derived"),
    },
    trowelsAndFloats: {
      label: "Trowels, floats and hawks, per job",
      costPerJob: cost(35, 46, "Plastering hand tools consumed per job.", "derived"),
    },
    waterAndPower: {
      label: "Site water and power, per job",
      costPerJob: cost(20, 27, "A mixer needs both and a new build has neither.", "derived"),
    },
  },
};

/* ── Framing & rough carpentry ──────────────────────────────────────────── */

const FRAMING_RECIPE = {
  model: "framing_component",
  label: "Framing & Rough Carpentry",

  // ── Layout constants
  specStudSpacingIn: spec(16, "16 inches on centre. 24 is common on a 2x6 wall under an engineered roof; changing this changes the stud count below.", "read"),
  specStudsPerLf: spec(0.75, "16 inches on centre is 0.75 studs per linear foot before corners and openings.", "read"),
  specExtraStudsPerOpening: spec(3, "King, jack and a cripple set per opening, on average across a house.", "derived"),
  specJoistSpacingIn: spec(16, "16 inches on centre for a residential floor.", "read"),

  // ── Materials. Lumber is the volatile line in this whole file.
  matStud2x4x8: cost(4.2, 5.6, "2x4x8 SPF stud, 2025 retail. Lumber moved 3x and back inside 2020-2022; this is the field to re-read before every season, not every year.", "read"),
  matStud2x6x8: cost(7.2, 9.5, "2x6x8 SPF stud, 2025 retail.", "read"),
  matJoist2x10x16: cost(26, 34, "2x10x16 SPF #2 joist stock, 2025 retail. Moves with the same lumber market as the studs above.", "read"),
  matOsbSheathingPerSheet: cost(20, 26, "7/16 OSB, 4x8 sheet, 2025 retail — roughly $0.63 a square foot in US dollars.", "read"),
  matSubfloorPerSheet: cost(34, 45, "5/8 tongue-and-groove subfloor, 4x8.", "read"),
  specSqftPerSheet: spec(32, "A 4 x 8 sheet is 32 square feet. Definitional, and not offered as an editable field.", "read"),
  matLvlPerLf: cost(12, 16, "1-3/4 x 11-7/8 LVL, per linear foot, one ply.", "read"),
  matTrussPerFootOfSpan: cost(5.4, 7.2, "A linear approximation for common trusses between 20 and 40 feet of span — a 24-foot common truss lands at about $130 US. It is a straight line through a curve and it is wrong outside that range, which is why the range is stated.", "derived"),
  matJoistHangerEach: cost(1.2, 1.6, "Galvanised face-mount hanger for a 2x10.", "read"),
  matFramingNailsPer5000: cost(55, 72, "Collated framing nails, 5,000 count.", "read"),
  matHouseWrapPerRoll: cost(145, 190, "9 ft x 100 ft roll. The siding book already carries this unit as 'roll (900 sqft)'.", "read"),
  specHouseWrapSqftPerRoll: spec(900, "A 9 ft x 100 ft roll is 900 square feet — the unit the siding book already carries.", "read"),
  matSubfloorAdhesivePerTube: cost(7, 9.5, "Construction adhesive.", "read"),
  specAdhesiveSheetsPerTube: spec(4, "About four sheets of subfloor per tube.", "derived"),

  // ── Waste
  wasteLumberPct: spec(0.1, "Cuts, crooks and culls. 10% is the standard framing allowance.", "read"),
  wasteSheathingPct: spec(0.12, "Higher than lumber because openings are cut out of full sheets and the offcut is rarely reusable.", "read"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(4, "Tools, saws, a stock drop and a set-out.", "derived"),
  labourWallFrameHoursPerLf: spec(0.16, "Two framers lay out, build and stand about 100 linear feet of 8-foot wall a day: 16 / 100 = 0.16.", "derived"),
  labourPartitionHoursPerLf: spec(0.11, "Interior partitions run faster: no sheathing, no headers, lighter stock.", "derived"),
  labourFloorFrameHoursPerSqft: spec(0.035, "Two framers set joists, rim and subfloor over about 450 sqft a day: 16 / 450 = 0.036.", "derived"),
  labourTrussSetHoursPerSqft: spec(0.028, "Three framers with a crane set and brace a 1,500 sqft truss roof in a day and a half: 36 / 1,500 = 0.024, taken at 0.028 for the bracing and the blocking.", "derived"),
  labourCutRoofFactor: spec(2.5, "A stick-framed roof against a truss roof. Not a separate rate: expressed as a multiplier so it moves when the truss figure is corrected.", "derived"),
  labourSheathingHoursPerSqft: spec(0.018, "Two framers sheathe about 900 sqft a day: 16 / 900 = 0.018.", "derived"),
  labourHouseWrapHoursPerSqft: spec(0.006, "Roll, staple and tape.", "derived"),
  labourBeamSetHoursPerLf: spec(0.25, "Plying, lifting and bearing an LVL. The lifting is most of it, and it is where the crane decision gets made.", "derived"),
  labourHeaderHoursPerOpening: spec(0.9, "Build, set, and pack out one header with its jacks and cripples.", "derived"),
  labourCleanupHoursPerSqft: spec(0.006, "Sweep, denail and load out.", "derived"),

  // ── Equipment
  equipCranePerHalfDay: cost(1000, 1300, "Boom truck with operator, half day including travel.", "read"),
  equipTelehandlerPerDay: cost(450, 580, "Rental day without operator, for lifting stock to a second-storey deck.", "read"),
  equipCompressorAndNailersPerDay: cost(90, 120, "Compressor, hoses and two framing nailers, rental day.", "read"),
  equipScaffoldSectionPerWeek: cost(25, 35, "One frame section per week.", "read"),
  equipGeneratorPerDay: cost(70, 95, "Portable generator where there is no service yet, which on a new build is always.", "read"),
  equipDumpsterPerHaul: cost(480, 620, "20-yard can for framing offcuts, delivered and hauled.", "read"),

  consumables: {
    blades: {
      label: "Saw blades",
      costPerSqft: cost(0.006, 0.008, "Circular and mitre blade life over floor area framed.", "derived"),
    },
    strappingAndBracing: {
      label: "Temporary bracing and strapping",
      costPerSqft: cost(0.02, 0.027, "Bracing that holds a wall up until the sheathing does, and is then scrap.", "derived"),
    },
    tapeAndSealant: {
      label: "Sheathing tape and sealant",
      costPerSqft: cost(0.015, 0.02, "Seam tape at sheathing joints and sealant at the sill.", "derived"),
    },
  },
};

/* ── Demolition ─────────────────────────────────────────────────────────── */

const DEMOLITION_RECIPE = {
  model: "demolition_volume",
  label: "Demolition",

  // ── Debris volume and weight. These decide the disposal bill, and disposal
  // is most of the cost of a demolition job that has no machine on it.
  specDebrisCuYdPer100SqftStrip: spec(5, "A full interior strip to studs produces roughly 4–6 cubic yards per 100 square feet of floor. 5 is the middle.", "read"),
  specDebrisCuYdPer100SqftStructure: spec(12, "A whole structure — frame, finishes and roof — runs 10–15 cubic yards per 100 square feet of floor area.", "read"),
  specMixedDebrisTonsPerCuYd: spec(0.25, "Mixed construction and demolition debris averages about 500 lb per cubic yard. Loose, bulky and light — which is why a 20-yard can fills before it weighs out.", "read"),
  specConcreteTonsPerCuYd: spec(2.0, "Broken concrete at about 4,000 lb per cubic yard: eight times the weight of mixed debris at the same volume. Putting it in a mixed can is the single most common way a demolition job loses money on overage.", "read"),
  specDumpsterCuYd: spec(20, "Standard construction can.", "read"),
  specDumpsterIncludedTons: spec(3, "Typical tonnage included before overage. Check your own hauler — 2 to 4 is the range and the difference is real money.", "read"),

  // ── Materials: almost none. This trade buys containment, not product.
  matPolySheetingPerRoll: cost(45, 60, "10 ft x 100 ft, 6-mil poly.", "read"),
  specPolySqftPerRoll: spec(1000, "A 10 ft x 100 ft roll is 1,000 square feet, before any overlap at the seams.", "read"),
  matZipPolePair: cost(55, 75, "Spring-loaded containment pole pair.", "read"),
  matFloorProtectionPerRoll: cost(95, 125, "38-inch by 100-foot board, about 315 sqft.", "read"),
  specFloorProtectionSqftPerRoll: spec(315, "38 inches x 100 feet.", "derived"),
  matShoringLumberPerLf: cost(14, 19, "Temporary bearing wall stock, per linear foot of wall, bought new. Reused across jobs the way form lumber is.", "derived"),
  specShoringReuses: spec(3, "Shoring stock survives about three jobs.", "derived"),
  matPpePerWorkerPerJob: cost(22, 30, "Respirator cartridges, coveralls, gloves and eye protection, per worker per job.", "read"),

  // ── Disposal
  equipDumpsterPerHaul: cost(480, 620, "20-yard construction can, delivered and hauled, tonnage allowance included. US $400–$650 in most markets.", "read"),
  matTipOveragePerTon: cost(75, 100, "Over the included tonnage. US mixed C&D tipping $50–$120/ton.", "read"),
  matConcreteTipPerTon: cost(25, 35, "Clean concrete at a recycler. Segregating it out of the mixed can is worth about $50 a ton and almost nobody does it.", "read"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(3, "Tools, protection, a walk-through and a can placement.", "derived"),
  labourStripHoursPerSqft: spec(0.055, "A three-person crew strips about 450 sqft of floor back to studs in a day: 24 / 450 = 0.053.", "derived"),
  labourLoadOutHoursPerCuYd: spec(0.55, "Carrying debris to the can by hand. This is where a demolition job's hours actually go and it is the line most routinely left off an estimate — a 40-yard interior strip is 22 crew-hours of carrying alone.", "derived"),
  labourMachineDemoHoursPerCuYd: spec(0.15, "Where a machine can reach, the same volume costs a quarter of the hours. The gap between this and the line above is the whole argument for machine access.", "derived"),
  labourConcreteBreakHoursPerSqft: spec(0.045, "Breaking a 4-inch slab with an electric breaker.", "derived"),
  labourWallRemovalHoursPerLf: spec(1.2, "Load-bearing wall out under temporary shoring, per linear foot, including putting the shoring up and taking it down.", "derived"),
  labourContainmentHoursPerSqft: spec(0.008, "Per square foot of the area SEALED OFF, not of the area demolished. The two are different and conflating them under-prices the containment on a small demolition inside a big house.", "derived"),
  labourFinalCleanHoursPerSqft: spec(0.004, "Broom clean to hand over.", "derived"),
  labourStairCarryFactor: spec(1.35, "Everything above or below grade. A multiplier on load-out, not on demolition — the swinging is the same, the carrying is not.", "derived"),
  labourHandOnlyFactor: spec(1.6, "Where no machine reaches at all.", "derived"),

  // ── Equipment
  equipMiniExcavatorPerDay: cost(350, 450, "3-ton class, rental day.", "read"),
  equipSkidSteerPerDay: cost(300, 390, "Rental day without operator, for load-out and site clearance.", "read"),
  equipExcavatorPerDay: cost(900, 1150, "20-ton class for structural demolition, rental day without operator.", "read"),
  equipBreakerAttachmentPerDay: cost(220, 285, "Hydraulic breaker attachment, rental day.", "read"),
  equipJackhammerPerDay: cost(85, 110, "Electric breaker, rental day.", "read"),
  equipMachineMove: cost(500, 650, "Float in and out, charged once per job however many days the machine stays on site.", "read"),
  equipChuteSectionPerWeek: cost(30, 40, "One debris chute section per week.", "read"),
  equipAirScrubberPerDay: cost(75, 100, "Negative-air machine with HEPA, rental day. For dust, NOT for regulated abatement — see the book's notPriced list.", "read"),
  equipDustExtractorPerDay: cost(65, 85, "HEPA extractor for cutting and grinding.", "read"),

  consumables: {
    bladesAndBits: {
      label: "Reciprocating blades and breaker bits",
      costPerSqft: cost(0.02, 0.027, "Demolition blades hit nails by design and are consumed fast.", "derived"),
    },
    tapeAndFasteners: {
      label: "Tape, staples and zip ties",
      costPerSqft: cost(0.01, 0.014, "Holding containment up, per square foot sealed off.", "derived"),
    },
    disposalBags: {
      label: "Rubble bags and bins",
      costPerCuYd: cost(0.5, 0.68, "Rubble sacks and tote bins for carrying debris out by hand.", "derived"),
    },
  },
};

/* ── Deck building ─────────────────────────────────────────────────────── */

const DECK_RECIPE = {
  model: "deck_component",
  label: "Deck Building",

  // ── Coverage. A 5/4x6 board is 5.5 inches wide and lays on a 5.6875-inch
  // pitch once the 3/16 gap is allowed for, so a 16-foot board covers 7.58
  // square feet. Using the bare 5.5 inches over-orders by 3%.
  specSqftPerBoard16ft: spec(7.5, "5.5-inch face plus a 3/16-inch gap is a 5.6875-inch pitch; x 16 feet = 7.58 sqft. Taken at 7.5 to leave the rounding on the safe side.", "derived"),
  specJoistSpacingIn: spec(16, "16 inches on centre for boards laid square to the joists.", "read"),
  specJoistSpacingDiagonalIn: spec(12, "12 inches on centre where boards run at 45 degrees, and required by most composite manufacturers' warranties. It is 33% more framing and it is the thing most often missed when a client asks for a diagonal deck.", "read"),

  // ── Decking. Three materials, three different currency relationships — see
  // the book's header for why none of them is an exchange rate.
  matDeckBoardPtPerBoard16ft: cost(15, 25, "5/4x6x16 pressure-treated. US $12–$18; CA $22–$30.", "read"),
  matDeckBoardCedarPerBoard16ft: cost(46, 62, "5/4x6x16 western red cedar. US $2.50–$3.50 per linear foot; CA $3.50–$4.50. Milled in BC, which is why the Canadian premium over treated is smaller than the US one.", "read"),
  matDeckBoardCompositePerBoard16ft: cost(55, 82, "Mid-tier capped composite, 16 ft. US $3.00–$4.00 per linear foot; CA $4.75–$6.00. Imported into Canada in smaller volumes through a thinner dealer network.", "read"),
  matDeckBoardPvcPerBoard16ft: cost(78, 112, "Cellular PVC, 16 ft.", "read"),

  // ── Structure
  matJoist2x8x16Pt: cost(26, 34, "2x8x16 pressure-treated joist.", "read"),
  matPost6x6x8Pt: cost(32, 44, "6x6x8 pressure-treated post.", "read"),
  matSonotube10inx4ft: cost(16, 22, "10-inch fibre form tube, 4 feet.", "read"),
  matBaggedConcretePerBag: cost(6.5, 8.5, "80 lb bagged concrete mix.", "read"),
  specBagsPerFooting: spec(5, "A 10-inch tube to 42 inches is about 2.3 cubic feet, and an 80 lb bag yields 0.6. 2.3 / 0.6 = 3.8 — taken at 5 because the bell at the bottom is never in the takeoff and always in the hole.", "derived"),
  matJoistHangerEach: cost(1.2, 1.6, "Galvanised face-mount hanger.", "read"),
  matStructuralScrewsPer100: cost(42, 56, "Structural ledger and post screws.", "read"),
  matDeckScrewsPerBox: cost(32, 43, "5 lb box, roughly 350 screws.", "read"),
  specDeckScrewsPerSqft: spec(4, "Two screws per joist crossing at 16 inches on centre works out at 3.5–4.5 per square foot.", "derived"),
  matHiddenFastenerKitPer50Sqft: cost(48, 65, "Clip kit covering about 50 square feet.", "read"),
  matJoistTapePerRoll: cost(22, 30, "75-foot roll of butyl joist tape. It is what stops the frame rotting before the boards do and it is left off most quotes.", "read"),
  matLedgerFlashingPer10ft: cost(14, 19, "10-foot length of ledger flashing.", "read"),
  matRailingPtPerLf: cost(18, 25, "Treated railing stock, material only, per linear foot.", "read"),
  matRailingCompositeKitPer6ft: cost(190, 265, "6-foot composite railing section with balusters and brackets.", "read"),
  matRailingAluminiumKitPer6ft: cost(150, 205, "6-foot aluminium picket section.", "read"),

  // ── Waste
  wasteDeckingPct: spec(0.1, "Square-laid boards on a rectangular deck.", "read"),
  wasteDeckingDiagonalPct: spec(0.18, "45-degree or picture-framed layouts. Nearly double, because every board has two mitres and the offcuts are triangles.", "read"),
  wasteFramingPct: spec(0.08, "Joists cut to a rim line.", "derived"),

  // ── Labour, crew-hours
  labourMobilisationHours: spec(4, "Tools, a stock drop and a layout to a string line.", "derived"),
  labourFootingHoursPerFooting: spec(1.6, "Locate, dig, tube, mix, pour, level and set the saddle. Machine-augered in workable soil; hand-dug is roughly double and clay or rock more than that.", "derived"),
  labourFrameHoursPerSqft: spec(0.09, "Two framers build about 180 sqft of deck frame a day: 16 / 180 = 0.089.", "derived"),
  labourDeckingHoursPerSqft: spec(0.075, "Face-screwed boards. Two hands lay about 210 sqft a day.", "derived"),
  labourHiddenFastenerHoursPerSqft: spec(0.11, "Clip systems run about 45% slower than face-screwing, which is the honest reason the sell upcharge exists.", "derived"),
  labourDiagonalFactor: spec(1.3, "45-degree layout: every board is cut twice and the offcut is scrap.", "derived"),
  labourRailingHoursPerLf: spec(0.35, "Posts, rails and infill to guard height, per linear foot.", "derived"),
  labourStairHoursPerStep: spec(1.1, "Cut stringers, treads, risers and the rail that goes with them, per step.", "derived"),
  labourLedgerHoursPerLf: spec(0.15, "Strip siding, flash, bolt and re-seal. The step that decides whether the deck falls off the house.", "derived"),
  labourSkirtingHoursPerLf: spec(0.2, "Frame and fit skirting with an access hatch.", "derived"),
  labourDemoExistingHoursPerSqft: spec(0.045, "Dismantle and load out an existing deck. Matches the demolition recipe's own strip rate for the same work.", "derived"),
  labourCleanupHoursPerSqft: spec(0.006, "Sweep, denail and load out.", "derived"),

  // ── Equipment
  equipAugerPerDay: cost(120, 160, "Two-man or skid-mounted auger, rental day.", "read"),
  equipMiniExcavatorPerDay: cost(350, 450, "Where footings are through rock or the site needs grading first.", "read"),
  equipMixerPerDay: cost(60, 80, "Portable mixer for bagged footings.", "read"),
  equipCompressorAndNailersPerDay: cost(90, 120, "Compressor, hoses and nailers.", "read"),
  equipScaffoldSectionPerWeek: cost(25, 35, "For an elevated deck's beam and ledger work.", "read"),
  equipDumpsterPerHaul: cost(420, 545, "15-yard can for a deck tear-out, delivered and hauled.", "read"),

  consumables: {
    blades: {
      label: "Saw and mitre blades",
      costPerSqft: cost(0.01, 0.014, "Composite dulls a blade far faster than treated softwood does.", "derived"),
    },
    stringAndLayout: {
      label: "String, stakes and layout, per job",
      costPerJob: cost(15, 20, "String, stakes, marking paint and batter boards.", "derived"),
    },
    sealantAndCaulk: {
      label: "Sealant at the ledger and posts",
      costPerLf: cost(0.4, 0.54, "Sealant at every ledger bolt and post penetration.", "derived"),
    },
  },
};

export const STRUCTURAL_RECIPES = {
  concrete: CONCRETE_RECIPE,
  asphalt_paving: ASPHALT_RECIPE,
  driveway_sealing: SEALCOAT_RECIPE,
  masonry: MASONRY_RECIPE,
  stucco: STUCCO_RECIPE,
  framing: FRAMING_RECIPE,
  demolition: DEMOLITION_RECIPE,
  deck_building: DECK_RECIPE,
};

/* ══ ADD-ONS ════════════════════════════════════════════════════════════════
 *
 * The extras that genuinely get sold with each trade, in the shape
 * app/data/standardAddOns.js seeds Products from: `{ name, unit, unitPrice,
 * type, description }`, with `unitPrice` carrying both currencies like
 * everything else here. `type` is "service" for labour and "product" for goods.
 *
 * These are the SELL prices, and several of them deliberately repeat a figure
 * from the book's `extras` block. That is not duplication of the kind AGENTS.md
 * warns about — it is the same decision reaching the estimator by two routes
 * (a rate on the card, a tickable line in the picker), and the check asserts
 * the two agree so they cannot drift apart silently.
 */

const STRUCTURAL_ADD_ONS = {
  concrete: [
    { name: "Stamped / decorative finish", unit: "sqft", type: "service", unitPrice: cost(6, 8, "The upcharge over a broom finish, matching extras.stampedUpchargePerSqft.", "derived"), description: "Stamped pattern and release, over and above the standard broom finish." },
    { name: "Exposed aggregate finish", unit: "sqft", type: "service", unitPrice: cost(3, 4, "Matches extras.exposedAggregatePerSqft.", "derived"), description: "Surface retarder and a wash-out return visit." },
    { name: "Integral colour", unit: "sqft", type: "product", unitPrice: cost(1.5, 2, "Matches extras.integralColourPerSqft.", "derived"), description: "Colour dosed into the mix at the plant." },
    { name: "Concrete sealing", unit: "sqft", type: "service", unitPrice: cost(0.6, 0.8, "Matches extras.sealerPerSqft.", "derived"), description: "One coat of acrylic cure-and-seal once the slab has cured." },
    { name: "Remove existing concrete", unit: "sqft", type: "service", unitPrice: cost(3, 4, "Matches extras.removeExistingPerSqft.", "derived"), description: "Break out, load and dispose of the existing slab." },
    { name: "Rebar mat upgrade", unit: "sqft", type: "product", unitPrice: cost(0.6, 0.8, "Matches extras.rebarUpgradePerSqft.", "derived"), description: "#4 bar at 16 inches on centre in place of welded mesh." },
    { name: "Saw-cut control joints", unit: "linear ft", type: "service", unitPrice: cost(1.5, 2, "Matches extras.sawCutJointPerLf.", "derived"), description: "Cut within 12 hours of the pour to control where it cracks." },
    { name: "Winter protection", unit: "sqft", type: "service", unitPrice: cost(1.2, 1.6, "Matches extras.winterProtectionPerSqft.", "derived"), description: "Blankets, hoarding and a hot-water mix for a cold-weather pour." },
    { name: "Concrete pump", unit: "flat", type: "service", unitPrice: cost(900, 1200, "Matches extras.pumpTruckFlat.", "derived"), description: "Pump placement where the truck cannot chute directly." },
    { name: "Poured steps", unit: "each", type: "service", unitPrice: cost(300, 400, "Matches flats.stepEach.", "derived"), description: "Formed and finished step, roughly 4 feet wide." },
  ],

  asphalt_paving: [
    { name: "Remove existing asphalt", unit: "sqft", type: "service", unitPrice: cost(1.5, 2.0, "Matches extras.removeExistingPerSqft.", "derived"), description: "Rip out the existing surface and haul it to a recycler." },
    { name: "Granular base rebuild", unit: "sqft", type: "service", unitPrice: cost(1.75, 2.4, "Matches extras.baseRebuildPerSqft.", "derived"), description: "Six inches of granular A, placed and compacted in two lifts." },
    { name: "Geogrid over soft subgrade", unit: "sqft", type: "product", unitPrice: cost(0.65, 0.85, "Matches extras.geogridPerSqft.", "derived"), description: "Biaxial geogrid where the subgrade will not hold." },
    { name: "Catch basin", unit: "each", type: "service", unitPrice: cost(1200, 1600, "Matches extras.catchBasinEach.", "derived"), description: "Precast basin, frame and grate tied into an existing lead." },
    { name: "Tack coat over existing surface", unit: "sqft", type: "service", unitPrice: cost(0.15, 0.2, "Matches extras.tackCoatPerSqft.", "derived"), description: "Emulsion bond coat before an overlay." },
    { name: "Line striping", unit: "each", type: "service", unitPrice: cost(6, 8, "Matches extras.lineStripingPerStall. Priced per stall.", "derived"), description: "Single-line stall marking on the finished surface." },
    { name: "Speed bump", unit: "each", type: "service", unitPrice: cost(900, 1200, "Matches flats.speedBumpEach.", "derived"), description: "Formed asphalt speed bump across the drive." },
    { name: "Sealcoating after cure", unit: "sqft", type: "service", unitPrice: cost(0.45, 0.6, "Mid of the Ontario $0.35–$0.55 band the driveway_sealing book already carries; US bands run lower.", "read"), description: "Two-coat seal, quoted for the following season once the new surface has cured." },
  ],

  driveway_sealing: [
    { name: "Crack filling", unit: "linear ft", type: "service", unitPrice: cost(2.2, 3.0, "US hot-pour crack filling $1.50–$3.00/lf. Sealing over an unfilled crack is why the seal fails first at the crack.", "read"), description: "Rout, blow out and hot-pour rubberised filler." },
    { name: "Oil spot primer", unit: "each", type: "service", unitPrice: cost(28, 38, "Per spot. It is the step that stops sealer lifting in front of the garage door.", "derived"), description: "Degrease and prime oil-stained areas so the sealer bonds." },
    { name: "Second coat", unit: "sqft", type: "service", unitPrice: cost(0.22, 0.3, "Roughly 60% of a first coat: the same material, a fraction of the prep.", "derived"), description: "An additional coat on a porous or heavily worn surface." },
    { name: "Sand additive for traction", unit: "sqft", type: "product", unitPrice: cost(0.05, 0.07, "3 lb of silica per gallon at the recipe's coverage." , "derived"), description: "Silica added to the sealer for grip and wear." },
    { name: "Edge trimming and weed removal", unit: "linear ft", type: "service", unitPrice: cost(1.1, 1.5, "Hand-edging along a grassed edge before sealing.", "derived"), description: "Cut back grass and weeds encroaching on the driveway edge." },
  ],

  masonry: [
    { name: "Remove existing masonry", unit: "sqft of wall", type: "service", unitPrice: cost(5, 7, "Matches extras.removeExistingPerSqft.", "derived"), description: "Take down and dispose of the existing brick, block or stone." },
    { name: "Mortar colour match", unit: "flat", type: "service", unitPrice: cost(250, 325, "Matches extras.mortarColourMatchFlat.", "derived"), description: "Sample, match and test-panel the existing mortar colour and joint profile." },
    { name: "Masonry cleaning and sealing", unit: "sqft of wall", type: "service", unitPrice: cost(1.6, 2.2, "Matches extras.cleaningSealingPerSqft.", "derived"), description: "Acid wash and a breathable siloxane sealer." },
    { name: "Through-wall flashing and weeps", unit: "linear ft", type: "service", unitPrice: cost(9, 12, "Matches extras.weepAndFlashingPerLf.", "derived"), description: "Flashing membrane and weep vents at the base and shelf angles." },
    { name: "Window sill", unit: "linear ft", type: "product", unitPrice: cost(45, 60, "Matches flats.sillPerLf.", "derived"), description: "Precast or stone sill, supplied and bedded." },
    { name: "Wall cap", unit: "linear ft", type: "product", unitPrice: cost(28, 38, "Matches flats.capPerLf.", "derived"), description: "Precast cap along a freestanding or garden wall." },
    { name: "Lintel replacement", unit: "each", type: "service", unitPrice: cost(650, 875, "Matches flats.lintelEach.", "derived"), description: "Needle, shore, cut out and replace a steel angle lintel." },
    { name: "Boom lift", unit: "flat", type: "service", unitPrice: cost(350, 450, "Matches extras.liftRentalPerDay. Priced per day on the quote.", "derived"), description: "Towable boom lift where scaffold will not stand." },
  ],

  stucco: [
    { name: "Strip existing stucco or EIFS", unit: "sqft of wall", type: "service", unitPrice: cost(3.5, 4.75, "Matches extras.removeExistingPerSqft.", "derived"), description: "Remove the failed system back to sheathing and dispose of it." },
    { name: "Sheathing repair", unit: "sqft", type: "service", unitPrice: cost(4.5, 6, "Matches extras.sheathingRepairPerSqft. Priced per square foot ACTUALLY replaced, not per square foot of wall.", "derived"), description: "Cut out and replace rotted sheathing found behind the cladding." },
    { name: "Rainscreen drainage mat", unit: "sqft of wall", type: "product", unitPrice: cost(1.6, 2.2, "Matches extras.drainageMatPerSqft.", "derived"), description: "Drainage mat behind the lath so water that gets in can get out." },
    { name: "Second finish colour", unit: "flat", type: "service", unitPrice: cost(400, 525, "Matches extras.extraColourFlat.", "derived"), description: "A second colour: its own mix, masking and visit." },
    { name: "Sealant at transitions", unit: "linear ft", type: "service", unitPrice: cost(4, 5.5, "Matches extras.sealantPerLf.", "derived"), description: "Backer rod and low-modulus sealant at every joint and penetration." },
    { name: "Foam band / reveal", unit: "linear ft", type: "product", unitPrice: cost(22, 30, "Matches flats.bandPerLf.", "derived"), description: "Shaped EPS band, meshed, based and finished." },
    { name: "Window surround", unit: "each", type: "product", unitPrice: cost(250, 330, "Matches flats.surroundEach.", "derived"), description: "Sill, head and jambs around one window." },
    { name: "Swing stage", unit: "flat", type: "service", unitPrice: cost(450, 580, "Matches extras.swingStagePerDay. Priced per day on the quote.", "derived"), description: "Suspended stage and rigging for elevations scaffold cannot reach." },
  ],

  framing: [
    { name: "Header over an opening", unit: "each", type: "service", unitPrice: cost(180, 245, "Matches flats.headerEach.", "derived"), description: "Built-up or LVL header with its jacks and cripples." },
    { name: "Engineered beam, supplied and set", unit: "linear ft", type: "product", unitPrice: cost(55, 75, "Matches flats.beamPerLf.", "derived"), description: "LVL beam, plied, lifted and bearing." },
    { name: "Post / column", unit: "each", type: "product", unitPrice: cost(220, 300, "Matches flats.postEach.", "derived"), description: "Built-up or engineered post with a bearing plate." },
    { name: "Rough stair carcass", unit: "each", type: "service", unitPrice: cost(900, 1200, "Matches flats.roughStairEach.", "derived"), description: "Cut stringers with rough treads and risers, per flight." },
    { name: "Crane for trusses or steel", unit: "flat", type: "service", unitPrice: cost(1100, 1450, "Matches extras.craneHalfDay.", "derived"), description: "Boom truck and operator for a half day." },
    { name: "Temporary shoring", unit: "linear ft", type: "service", unitPrice: cost(30, 40, "Matches extras.temporaryShoringPerLf.", "derived"), description: "Temporary bearing wall while a beam goes in, up and down." },
    { name: "Winter hoarding and heat", unit: "sqft", type: "service", unitPrice: cost(2.5, 3.3, "Matches extras.winterHoardingPerSqft.", "derived"), description: "Poly hoarding and heat so work continues below freezing." },
    { name: "House wrap", unit: "sqft", type: "product", unitPrice: cost(0.55, 0.75, "Material at the recipe's roll price plus the wrap hours at a typical crew rate.", "derived"), description: "Weather-resistive barrier, taped at every seam." },
  ],

  demolition: [
    { name: "Dumpster and haul", unit: "each", type: "service", unitPrice: cost(550, 700, "Matches extras.dumpsterPerHaul. One 20-yard can.", "derived"), description: "20-yard can delivered and hauled, with the standard tonnage allowance." },
    { name: "Overweight disposal", unit: "ton", type: "service", unitPrice: cost(85, 110, "Matches extras.overweightPerTon.", "derived"), description: "Tipping over the tonnage included with the can." },
    { name: "Dust containment", unit: "sqft", type: "service", unitPrice: cost(1.1, 1.5, "Matches extras.dustContainmentPerSqft. Per square foot SEALED OFF, not demolished.", "derived"), description: "Poly walls, zip doors and negative air on an occupied house." },
    { name: "Floor and surface protection", unit: "sqft", type: "service", unitPrice: cost(0.85, 1.15, "Matches extras.floorProtectionPerSqft.", "derived"), description: "Board and tape over floors and finishes that stay." },
    { name: "Temporary shoring", unit: "linear ft", type: "service", unitPrice: cost(32, 43, "Matches extras.shoringPerLf.", "derived"), description: "Temporary bearing wall while a load-bearing element comes out." },
    { name: "Debris chute", unit: "each", type: "service", unitPrice: cost(30, 40, "Matches extras.chuteSectionPerWeek. Per section per week.", "derived"), description: "Chute section so upper-storey debris does not come down the stairs." },
    { name: "Kitchen gut", unit: "each", type: "service", unitPrice: cost(1200, 1600, "Matches flats.kitchenGutEach.", "derived"), description: "Cabinets, tops and appliances out and disposed of." },
    { name: "Bathroom gut", unit: "each", type: "service", unitPrice: cost(850, 1150, "Matches flats.bathroomGutEach.", "derived"), description: "Fixtures, tile and substrate out." },
  ],

  deck_building: [
    { name: "Remove existing deck", unit: "sqft", type: "service", unitPrice: cost(4, 5.5, "Matches extras.demoExistingDeckPerSqft, and matches the demolition book's own deck-removal rate. Two books disagreeing about one task is how a client gets two prices.", "derived"), description: "Dismantle the existing deck, pull the footings and dispose." },
    { name: "Hidden fasteners", unit: "sqft", type: "service", unitPrice: cost(3, 4.25, "Matches extras.hiddenFastenersPerSqft; the recipe puts the labour at 45% slower, which is what the upcharge is for.", "derived"), description: "Clip system instead of face screws — no screw heads on the surface." },
    { name: "Picture-frame border", unit: "linear ft", type: "service", unitPrice: cost(14, 19, "Matches extras.pictureFrameBorderPerLf.", "derived"), description: "Mitred border board with the extra blocking underneath it." },
    { name: "Deck lighting", unit: "each", type: "product", unitPrice: cost(65, 88, "Matches extras.deckLightingPerFixture.", "derived"), description: "Low-voltage riser or post light, wired to a transformer." },
    { name: "Stain / seal", unit: "sqft", type: "service", unitPrice: cost(2.2, 3.0, "Matches extras.stainSealPerSqft.", "derived"), description: "One coat once the boards have dried down enough to take it." },
    { name: "Under-deck drainage ceiling", unit: "sqft", type: "product", unitPrice: cost(9, 12.5, "Matches extras.underDeckDrainagePerSqft.", "derived"), description: "Drainage ceiling that makes the space under an elevated deck usable." },
    { name: "Stairs", unit: "each", type: "service", unitPrice: cost(150, 210, "Matches flats.stepEach. Priced per step.", "derived"), description: "Cut stringers, treads, risers and the rail beside them." },
    { name: "Built-in bench", unit: "linear ft", type: "product", unitPrice: cost(85, 115, "Matches flats.benchPerLf.", "derived"), description: "Bench with a back, built into the deck frame." },
    { name: "Skirting / lattice", unit: "linear ft", type: "product", unitPrice: cost(32, 44, "Matches flats.skirtingPerLf.", "derived"), description: "Framed skirting with an access hatch." },
    { name: "Gate", unit: "each", type: "product", unitPrice: cost(350, 480, "Matches flats.gateEach.", "derived"), description: "Self-closing gate with hardware, to pool code where it applies." },
  ],
};

export { STRUCTURAL_ADD_ONS };

/* ══ SETTINGS DESCRIPTORS ═══════════════════════════════════════════════════
 *
 * Without these a book is a rate card nobody can open: RateCard.js returns null
 * when `PRICE_BOOK_FIELDS[key]` is empty, so shipping the seven books above and
 * not these would put seven trades' prices into the product with no way to
 * change them. Same rule as everything else — if you add a field, make something
 * read it.
 *
 * `suffix` is load-bearing, not cosmetic. priceBookBasis() parses the unit back
 * out of it, so "$ / sqft" on a row whose item says "sqft of wall" makes the
 * settings screen tell a mason he charges by the square foot of floor. The
 * check asserts every suffix against the book's own `priceTypeUnits`.
 */

/** Rate-card rows for a book: complexity grid, then extras, then flats. */
function bookFields(book, opts = {}) {
  const u = book.priceTypeUnits;
  const rows = Object.keys(u).map((type) => [
    type,
    (book.items.find((i) => i.priceType === type) || {}).label || type,
    `$ / ${u[type]}`,
  ]);
  const fields = cxFields(rows);

  for (const [key, label, suffix, step] of opts.extras || []) {
    fields.push({ path: `extras.${key}`, label, suffix, step, group: opts.extrasGroup });
  }
  // A flat item's price is looked up through `flatKey`, so the row's unit comes
  // from the ITEM rather than from a second declaration beside it.
  for (const item of book.items) {
    if (!item.flatKey) continue;
    fields.push({
      path: `flats.${item.flatKey}`,
      label: item.label,
      suffix: `$ / ${item.unit}`,
      step: item.unit === "each" ? 5 : 0.25,
      group: opts.flatsGroup,
    });
  }
  fields.push({ path: "minimumTotal", label: "Minimum charge", suffix: "$ flat", step: 50 });
  return fields;
}

export const STRUCTURAL_PRICE_BOOK_GROUPS = {
  concreteExtras: "Finishes, removal and site conditions",
  concreteFlats: "Priced per item",
  asphaltExtras: "Base, drainage and site conditions",
  asphaltFlats: "Priced per item",
  masonryExtras: "Access, removal and detailing",
  masonryFlats: "Priced per item",
  stuccoExtras: "Tear-off, repair and access",
  stuccoFlats: "Priced per item",
  framingExtras: "Access, shoring and season",
  framingFlats: "Priced per item",
  demolitionExtras: "Disposal, containment and access",
  demolitionFlats: "Priced per item",
  deckExtras: "Removal, finishes and upgrades",
  deckFlats: "Priced per item",
};

export const STRUCTURAL_PRICE_BOOK_FIELDS = {
  concrete: bookFields(CONCRETE, {
    extrasGroup: "concreteExtras",
    flatsGroup: "concreteFlats",
    extras: [
      ["stampedUpchargePerSqft", "Stamped finish — upcharge", "$ / sqft", 0.25],
      ["exposedAggregatePerSqft", "Exposed aggregate", "$ / sqft", 0.25],
      ["integralColourPerSqft", "Integral colour", "$ / sqft", 0.25],
      ["sealerPerSqft", "Sealing", "$ / sqft", 0.05],
      ["removeExistingPerSqft", "Remove existing concrete", "$ / sqft", 0.25],
      ["rebarUpgradePerSqft", "Rebar mat upgrade", "$ / sqft", 0.05],
      ["sawCutJointPerLf", "Saw-cut control joints", "$ / linear ft", 0.25],
      ["winterProtectionPerSqft", "Winter protection", "$ / sqft", 0.1],
      ["pumpTruckFlat", "Concrete pump", "$ flat", 25],
    ],
  }),

  asphalt_paving: bookFields(ASPHALT_PAVING, {
    extrasGroup: "asphaltExtras",
    flatsGroup: "asphaltFlats",
    extras: [
      ["removeExistingPerSqft", "Remove existing asphalt", "$ / sqft", 0.25],
      ["baseRebuildPerSqft", "Granular base rebuild", "$ / sqft", 0.25],
      ["geogridPerSqft", "Geogrid", "$ / sqft", 0.05],
      ["catchBasinEach", "Catch basin", "$ / each", 25],
      ["tackCoatPerSqft", "Tack coat", "$ / sqft", 0.05],
      ["mobilisationFlat", "Mobilisation — paver and roller float", "$ flat", 25],
      ["lineStripingPerStall", "Line striping", "$ / each", 1],
    ],
  }),

  masonry: bookFields(MASONRY, {
    extrasGroup: "masonryExtras",
    flatsGroup: "masonryFlats",
    extras: [
      ["scaffoldPerDay", "Scaffold", "$ / day", 5],
      ["liftRentalPerDay", "Boom lift", "$ / day", 10],
      ["mortarColourMatchFlat", "Mortar colour match", "$ flat", 25],
      ["removeExistingPerSqft", "Remove existing masonry", "$ / sqft", 0.25],
      ["cleaningSealingPerSqft", "Cleaning and sealing", "$ / sqft", 0.1],
      ["weepAndFlashingPerLf", "Flashing and weeps", "$ / linear ft", 0.25],
    ],
  }),

  stucco: bookFields(STUCCO, {
    extrasGroup: "stuccoExtras",
    flatsGroup: "stuccoFlats",
    extras: [
      ["removeExistingPerSqft", "Strip existing stucco or EIFS", "$ / sqft", 0.25],
      ["sheathingRepairPerSqft", "Sheathing repair", "$ / sqft", 0.25],
      ["drainageMatPerSqft", "Rainscreen drainage mat", "$ / sqft", 0.1],
      ["scaffoldPerDay", "Scaffold", "$ / day", 5],
      ["swingStagePerDay", "Swing stage", "$ / day", 10],
      ["extraColourFlat", "Second finish colour", "$ flat", 25],
      ["sealantPerLf", "Sealant at transitions", "$ / linear ft", 0.25],
    ],
  }),

  framing: bookFields(FRAMING, {
    extrasGroup: "framingExtras",
    flatsGroup: "framingFlats",
    extras: [
      ["craneHalfDay", "Crane — half day", "$ flat", 50],
      ["temporaryShoringPerLf", "Temporary shoring", "$ / linear ft", 1],
      ["winterHoardingPerSqft", "Winter hoarding and heat", "$ / sqft", 0.25],
    ],
  }),

  demolition: bookFields(DEMOLITION, {
    extrasGroup: "demolitionExtras",
    flatsGroup: "demolitionFlats",
    extras: [
      ["dumpsterPerHaul", "Dumpster and haul", "$ / each", 25],
      ["overweightPerTon", "Overweight disposal", "$ / ton", 5],
      ["dustContainmentPerSqft", "Dust containment", "$ / sqft", 0.1],
      ["floorProtectionPerSqft", "Floor protection", "$ / sqft", 0.05],
      ["shoringPerLf", "Temporary shoring", "$ / linear ft", 1],
      ["chuteSectionPerWeek", "Debris chute", "$ / each", 5],
    ],
  }),

  deck_building: bookFields(DECK_BUILDING, {
    extrasGroup: "deckExtras",
    flatsGroup: "deckFlats",
    extras: [
      ["demoExistingDeckPerSqft", "Remove existing deck", "$ / sqft", 0.25],
      ["hiddenFastenersPerSqft", "Hidden fasteners", "$ / sqft", 0.25],
      ["pictureFrameBorderPerLf", "Picture-frame border", "$ / linear ft", 0.5],
      ["deckLightingPerFixture", "Deck lighting", "$ / each", 5],
      ["stainSealPerSqft", "Stain / seal", "$ / sqft", 0.1],
      ["underDeckDrainagePerSqft", "Under-deck drainage ceiling", "$ / sqft", 0.5],
    ],
  }),
};

/* ── Recipe editable fields, DERIVED rather than typed a second time ────────
 *
 * RECIPE_EDITABLE_FIELDS in materialRecipes.js is hand-written, which works at
 * eleven fields per model and would not at forty. More to the point, a
 * hand-written list is the copy that rots: add a material to a recipe, forget
 * the list, and the field is written and never read — failure class #1.
 *
 * So the list is generated FROM the recipe. Every money pair and every spec
 * becomes exactly one editable row, and a field added later is editable with no
 * second edit. This is the same argument priceBookBasis() makes for deriving
 * units from the field declarations instead of listing them again.
 *
 * The labels are mechanical, and mechanical is the point: "Material — ready mix
 * per cu yd" is not as good as a hand-written label and it can never be wrong
 * about which field it is attached to.
 */

// Only these five head tokens become a "Section — " prefix. A key that starts
// with anything else (`cuFtPerCuYd`) is sentence-cased whole, because
// prefixing it produced "Cu — ft per cu yd", which is worse than no prefix.
const SECTION_WORDS = {
  mat: "Material",
  spec: "Spec",
  labour: "Labour",
  equip: "Equipment",
  waste: "Waste",
  default: "Default",
};

const TOKEN_WORDS = { pct: "", usd: "", cad: "", in: "(in)" };

/**
 * Definitional constants, deliberately NOT offered as editable fields.
 *
 * 27 cubic feet to the cubic yard and 32 square feet to a 4x8 sheet are facts
 * about arithmetic and about how plywood is sold, not opinions about a market.
 * A number input beside them is a control that appears to work and does — it
 * would silently break every quantity downstream of it.
 *
 * Everything else IS editable, including the ones that look fixed: sheet
 * coverage for lath (18 sqft) and roll coverage for mesh and poly are product
 * facts that differ by supplier, and a contractor who buys a different roll
 * must be able to say so.
 */
const FIXED_SPEC_KEYS = new Set([
  "cuFtPerCuYd",
  "sqftPerCuYdAtOneInch",
  "specSqftPerSheet",
  "specEifsBoardSqftPerSheet",
]);

function humaniseKey(key) {
  const parts = String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ");
  const section = SECTION_WORDS[parts[0]];
  if (section) parts.shift();
  const rest = parts
    .map((w) => {
      const lower = w.toLowerCase();
      return TOKEN_WORDS[lower] !== undefined ? TOKEN_WORDS[lower] : lower;
    })
    .filter(Boolean)
    .join(" ")
    .trim();
  const label = section ? `${section} — ${rest}` : rest;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fieldFor(key, value) {
  const isPct = /Pct$/.test(key);
  const isHours = /Hours/.test(key);
  const pair = isMoneyPair(value);
  const suffix = pair ? "($)" : isPct ? "(%)" : isHours ? "(hours)" : "";
  return {
    key,
    label: suffix ? `${humaniseKey(key)} ${suffix}` : humaniseKey(key),
    type: "number",
    step: isPct ? 0.01 : isHours ? 0.05 : pair ? 0.01 : 1,
  };
}

function recipeFields(recipe) {
  return Object.keys(recipe)
    .filter((k) => !FIXED_SPEC_KEYS.has(k))
    .filter((k) => isMoneyPair(recipe[k]) || isSpec(recipe[k]))
    .map((k) => fieldFor(k, recipe[k]));
}

/** The definitional constants, exported so the check can assert the exclusion. */
export const STRUCTURAL_FIXED_SPEC_KEYS = [...FIXED_SPEC_KEYS];

function consumableFields(recipe) {
  const out = {};
  for (const [name, entry] of Object.entries(recipe.consumables || {})) {
    out[name] = Object.keys(entry)
      .filter((k) => isMoneyPair(entry[k]))
      .map((k) => fieldFor(k, entry[k]));
  }
  return out;
}

/** Keyed by recipe MODEL, exactly like RECIPE_EDITABLE_FIELDS. */
export const STRUCTURAL_RECIPE_FIELDS = Object.fromEntries(
  Object.values(STRUCTURAL_RECIPES).map((r) => [r.model, recipeFields(r)]),
);

/**
 * Keyed by consumable name, exactly like CONSUMABLE_EDITABLE_FIELDS.
 *
 * Consumable names are namespaced with the model because that map is flat
 * across every trade and `blades` means a different thing, at a different
 * price, in four of these recipes. An unnamespaced collision would let a
 * mason's blade cost edit a framer's.
 */
export const STRUCTURAL_CONSUMABLE_FIELDS = Object.fromEntries(
  Object.values(STRUCTURAL_RECIPES).flatMap((r) =>
    Object.entries(consumableFields(r)).map(([name, fields]) => [
      `${r.model}.${name}`,
      fields,
    ]),
  ),
);

/* ══ ACCESSORS ══════════════════════════════════════════════════════════════ */

const own = (map, key) =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

/** The proposed TRADE_CATALOG entries for the four keys that do not exist yet. */
export const STRUCTURAL_CATALOG_PROPOSALS = Object.fromEntries(
  Object.entries(STRUCTURAL_PRICE_BOOKS)
    .filter(([, b]) => b.meta.catalogStatus === "proposed")
    .map(([key, b]) => [key, b.meta.proposedCatalogEntry]),
);

/** Which of the 12 marketing industries surfaces a trade. */
export function structuralIndustries(categoryKey) {
  const book = own(STRUCTURAL_PRICE_BOOKS, categoryKey);
  return book ? book.meta.industries : [];
}

/** Everything this file deliberately refuses to put a default on, by trade. */
export function structuralNotPriced(categoryKey) {
  const book = own(STRUCTURAL_PRICE_BOOKS, categoryKey);
  return book ? book.notPriced : [];
}
