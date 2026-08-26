// lib/pricing/paintTakeoff.js
//
// Painting, estimated the way a painting estimator estimates: by AREA (a room,
// an elevation) and then by SUBSTRATE inside that area, with man-hours from
// production rates and gallons from coverage.
//
// Pure arithmetic — no rates hardcoded in the logic, no I/O, no React — so it
// runs against the owner's completed job, and against hostile input, in
// scripts/check-paint-takeoff.mjs. That is where the arithmetic bugs surface.
//
// ── Why this is not app/data/tradePriceBooks.js `interior_painting` ─────────
//
// That book prices a room from a complexity tier: wallPricePerSqft 2.50,
// ceilingPrice 175, doorPrice 45. It is a rate card, and it works, but it
// cannot answer the two questions an estimator actually has to answer:
//
//   1. HOW LONG. A price per square foot schedules nothing and costs nothing.
//      The complexity tier has no hours in it at all, which is why
//      tradeLabourHours("interior_painting", …) returned 0 for every painting
//      job in the system: the trade contributed no predicted hours to the cost
//      panel, so its margin figure was labour-blind.
//
//   2. HOW MUCH PAINT. Coverage × coats × area is the only way to know, and it
//      is also the only way to know whether you are buying three gallons or
//      five for a whole house.
//
// Both fall out of production rates, and production rates are how the trade
// already thinks. The complexity book stays where it is and keeps pricing
// every quote written against it — see the `model` discriminator in
// lib/pricing/tradeScope.js. Nothing here reprices an existing quote.
//
// ── PROVENANCE ─────────────────────────────────────────────────────────────
//
// Every rate marked RECOVERED below was recovered from the owner's own
// completed jobs — one interior (a 10 × 13 × 9 den) and one exterior — by
// solving his line totals backwards. That is the strongest provenance in this
// codebase: these are not a market survey, they are the numbers that produced
// an invoice he was paid on. scripts/check-paint-takeoff.mjs asserts every one
// of his figures to the cent, so a change to any of them fails the build.
//
// Rates marked ANALOGUE are NOT his. They are a stated multiple of a recovered
// rate, for the substrates his dropdown lists but his two jobs never used.
// They are opening positions and they say so, in the same house style as the
// cabinet drawer-slide rate in app/data/tradePriceBooks.js.
//
// ── The one figure of his that does not reconcile ───────────────────────────
//
// Written up beside `productionRate` on `soffit_fascia`. Read it before
// "fixing" any of the arithmetic here to match it.

/* ── Numeric guards ────────────────────────────────────────────────────── */
//
// `Number(v) || 0` is not enough anywhere in this file. Number("1e400") is
// Infinity, which is neither NaN nor negative, so it survives that idiom and
// turns every downstream figure — and the client's total — into Infinity. Two
// finite dimensions can also multiply to Infinity (1e200 × 1e200), so products
// are re-checked, not just inputs.

const finite = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** A measurement or a count: finite, never negative. A negative wall is 0. */
const positive = (v) => {
  const n = finite(v);
  return n > 0 ? n : 0;
};

/** Multiply, and refuse to hand on an overflow. */
const mul = (...xs) => finite(xs.reduce((a, b) => a * b, 1));

/** Money to cents. Guards a Decimal column against 0.1 + 0.2 dust. */
const money = (v) => {
  const n = finite(v);
  const r = Math.round(n * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

// Substrate, product and area-type keys all arrive from stored JSON, and
// MAP["__proto__"] is truthy on any plain object — which would hand the caller
// Object.prototype and price a room off it. Same guard, same reason, as the one
// in app/data/tradePriceBooks.js.
const own = (map, key) =>
  map &&
  typeof map === "object" &&
  typeof key === "string" &&
  Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;

const asArray = (v) => (Array.isArray(v) ? v : []);

/* ── Products ──────────────────────────────────────────────────────────── */
//
// A product is a paint: what it costs per gallon and how far a gallon goes.
// Keyed, never an array — see the note on PAINT_SUBSTRATE_DEFAULTS.
//
// `costPerGal` is what the contractor PAYS. It is not the client's price; see
// `materialMarkupPct` on PAINT_TAKEOFF_DEFAULTS, which is 0 by default because
// that is how the owner's job was priced (all the margin in the hourly rate).
//
// A null costPerGal is a product nobody has priced. It produces gallons with no
// money and is counted as unpriced, exactly as lib/costing/tradeMaterials.js
// does — costing a job's biggest input at $0 reports 100% margin on it, which
// is worse than reporting nothing.

export const PAINT_PRODUCT_DEFAULTS = {
  ceiling_flat: {
    label: "Ceiling flat",
    // RECOVERED. His den charged $22.74 of ceiling paint over 130 sqft at two
    // coats: 130 × 2 ÷ 350 = 0.742857 gal, so $30.61/gal.
    costPerGal: 30.61,
    coverageSqftPerGal: 350,
    surface: "interior",
  },
  wall_interior: {
    label: "Interior wall",
    // RECOVERED. 414 sqft of wall, two coats, $122.71 ⇒ 2.365714 gal at
    // $51.87/gal. The same paint reproduces his closet to the cent.
    costPerGal: 51.87,
    coverageSqftPerGal: 350,
    surface: "interior",
  },
  trim_enamel: {
    label: "Trim enamel",
    // RECOVERED. Solved across four of his lines at once — baseboard, door
    // sides, door frames and the window sill all land on $47.83/gal, and all
    // four totals reproduce exactly. One paint, four substrates.
    costPerGal: 47.83,
    coverageSqftPerGal: 350,
    surface: "interior",
  },
  exterior_body: {
    label: "Exterior body & trim",
    // RECOVERED, from the exterior job, and note the COVERAGE is not 350.
    // Exterior substrate drinks more: his siding ($720.02 over 2,340 sqft at
    // one coat), his soffit and fascia ($373.34) and his garage door ($80.77)
    // only reconcile simultaneously at 300 sqft/gal and $92.31/gal. Three
    // independent lines, one pair of numbers, all three exact.
    costPerGal: 92.31,
    coverageSqftPerGal: 300,
    surface: "exterior",
  },
  primer: {
    label: "Primer",
    // NULL. No primer line appears on either of his jobs, so there is no
    // figure to recover and none is invented. Pick the product and fill this
    // in on the rate card; until then a primed substrate reports its gallons
    // and no cost, flagged unpriced.
    costPerGal: null,
    coverageSqftPerGal: 300,
    surface: "any",
  },
};

/* ── Substrates ────────────────────────────────────────────────────────── */
//
// KEYED MAP, NOT AN ARRAY, and this is load-bearing. getPriceBook() in
// app/data/tradePriceBooks.js deep-merges a company's overrides with plain
// objects merging key by key and ARRAYS REPLACING WHOLESALE. As an array, a
// company that edited one substrate's production rate would silently discard
// every other substrate in the catalogue — which is exactly what the existing
// `interior_painting.roomTypes` array does today. A keyed map merges.
//
// ── Two rate bases, and why the rate is not per coat ────────────────────────
//
// `production` substrates are measured (sqft, linear ft) and carry a
// productionRate in units per hour. `item` substrates are counted and carry
// hoursPerUnit.
//
// EITHER WAY THE RATE COVERS ALL THE COATS. His field was labelled "man-hours
// per item per coat", but his own numbers are not per coat: 414 sqft of wall at
// two coats came to 4.140 h, which is 414 ÷ 100, not 414 ÷ 100 × 2. Three door
// sides at two coats came to 1.500 h, which is 3 × 0.50, not 3 × 0.50 × 2. So
// the label said per-coat and the arithmetic said per-job, and the arithmetic
// is the thing that got invoiced. Multiplying hours by coats here would double
// every labour line on the job he was actually paid for.
//
// Coats therefore drive GALLONS only. That is also the honest model: the second
// coat of a wall is much faster than the first, so a painter's "100 sqft/hr" is
// already a two-coat figure, whereas the second coat costs exactly as much
// paint as the first.
//
// `sqftPerUnit` is the paintable area behind one unit, and it is what turns a
// count into gallons. 1 for a substrate already measured in square feet.

export const PAINT_SUBSTRATE_DEFAULTS = {
  /* — Interior, RECOVERED from the den — */

  ceiling: {
    label: "Ceiling",
    unit: "sqft",
    surface: "interior",
    // The geometry field that fills the quantity in. Overridable per line:
    // half a ceiling is a typed number, not a different substrate.
    driver: "ceilingSqft",
    rateBasis: "production",
    productionRate: 110, // RECOVERED: 130 sqft ÷ 1.1818 h
    sqftPerUnit: 1,
    productKey: "ceiling_flat",
    coats: 2,
  },
  walls: {
    label: "Walls",
    unit: "sqft",
    surface: "interior",
    driver: "wallSqft",
    rateBasis: "production",
    productionRate: 100, // RECOVERED: 414 sqft ÷ 4.140 h
    sqftPerUnit: 1,
    productKey: "wall_interior",
    coats: 2,
  },
  baseboard: {
    label: "Baseboard",
    unit: "lnft",
    surface: "interior",
    driver: "linearFt",
    rateBasis: "production",
    productionRate: 40, // RECOVERED: 46 lnft ÷ 1.150 h
    // RECOVERED: his $4.40 over 46 lnft at two coats is 0.092 gal of trim
    // enamel, i.e. 0.35 sqft of paintable face per linear foot — a nominal
    // 4-inch baseboard plus its top edge.
    sqftPerUnit: 0.35,
    productKey: "trim_enamel",
    coats: 2,
  },
  door: {
    label: "Door",
    // Sides, not doors: one side of a door is one unit. A door painted both
    // sides is 2, and a door painted only where the client sees it is 1. His
    // den had three sides across two doors, which is unrepresentable if the
    // unit is a door.
    unit: "side",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.5, // RECOVERED: 3 sides ÷ 1.500 h
    sqftPerUnit: 21, // RECOVERED: 3'0" × 7'0" slab face
    productKey: "trim_enamel",
    coats: 2,
  },
  door_frame: {
    label: "Door frame",
    unit: "each",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.25, // RECOVERED: 2 frames ÷ 0.500 h
    sqftPerUnit: 12.6, // RECOVERED: jamb, stops and casing, both faces
    productKey: "trim_enamel",
    coats: 2,
  },
  window_sill: {
    label: "Window sill",
    unit: "each",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.25, // RECOVERED: 1 sill ÷ 0.250 h
    sqftPerUnit: 12.6, // RECOVERED: sill, apron and the surround he painted with it
    productKey: "trim_enamel",
    coats: 2,
  },
  closet_small: {
    label: "Small closet",
    unit: "each",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 1, // RECOVERED: 1 closet ÷ 1.000 h
    // RECOVERED: $25.19 of WALL paint (not trim) at two coats is 0.485714 gal,
    // i.e. 85 sqft — a 2 × 3 closet's four walls and ceiling.
    sqftPerUnit: 85,
    productKey: "wall_interior",
    coats: 2,
  },

  /* — Interior, ANALOGUE. Not his numbers. Check before quoting off them. — */

  wall_two_storey: {
    label: "Two-storey wall",
    unit: "sqft",
    surface: "interior",
    // Its own substrate rather than a multiplier on `walls`, because that is
    // what the owner asked for and because it is true: a stairwell wall is a
    // different job from a bedroom wall at the same square footage, and the
    // difference is staging, not area.
    driver: null,
    rateBasis: "production",
    // ANALOGUE: the recovered 100 sqft/hr wall rate at 0.7, for repositioning
    // planks and ladders. No completed job of his measures this. Check it.
    productionRate: 70,
    sqftPerUnit: 1,
    productKey: "wall_interior",
    coats: 2,
  },
  french_door: {
    label: "French door",
    unit: "side",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    // ANALOGUE: three times the recovered 0.50 h flat door side. Divided
    // lights are cut in by hand and that is where the hours go. Check it.
    hoursPerUnit: 1.5,
    // ANALOGUE: the 21 sqft slab less roughly a third for the glazing.
    sqftPerUnit: 14,
    productKey: "trim_enamel",
    coats: 2,
  },
  ornate_frame: {
    label: "Ornate frame (per side)",
    unit: "side",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    // ANALOGUE: twice the recovered 0.25 h plain frame, and per SIDE rather
    // than per frame because that is how the owner listed it. Check it.
    hoursPerUnit: 0.5,
    sqftPerUnit: 9, // ANALOGUE: the recovered 12.6 sqft frame, one side of it, with profile
    productKey: "trim_enamel",
    coats: 2,
  },
  bay_window: {
    label: "Bay window",
    unit: "each",
    surface: "interior",
    driver: null,
    rateBasis: "item",
    // ANALOGUE: the recovered 1.00 h small closet, as the nearest whole
    // assembly he has a figure for. Check it.
    hoursPerUnit: 1,
    sqftPerUnit: 30, // ANALOGUE: three sashes, sills and the surround
    productKey: "trim_enamel",
    coats: 2,
  },
  railing_spindles: {
    label: "Railing with spindles",
    unit: "lnft",
    surface: "interior",
    driver: null,
    rateBasis: "production",
    // ANALOGUE: a fifth of the recovered 40 lnft/hr baseboard rate. A spindle
    // run is the slowest brushwork in a house. Nothing of his measures it.
    productionRate: 8,
    sqftPerUnit: 4, // ANALOGUE: rail, shoe and spindles, all faces, per linear foot
    productKey: "trim_enamel",
    coats: 2,
  },
  crown_moulding: {
    label: "Crown moulding",
    unit: "lnft",
    surface: "interior",
    driver: "linearFt",
    rateBasis: "production",
    // ANALOGUE: the recovered 40 lnft/hr baseboard rate at 0.75, for cutting
    // in overhead against a finished ceiling. Check it.
    productionRate: 30,
    sqftPerUnit: 0.5, // ANALOGUE: a nominal 5" profile
    productKey: "trim_enamel",
    coats: 2,
  },

  /* — Exterior, RECOVERED from the exterior job — */

  siding_trim: {
    label: "Siding & trim",
    unit: "sqft",
    surface: "exterior",
    driver: "wallSqft",
    rateBasis: "production",
    productionRate: 100, // RECOVERED: 2,340 sqft ÷ 23.400 h
    sqftPerUnit: 1,
    productKey: "exterior_body",
    // ONE coat, deliberately, and that is his: 2,340 sqft came to $720.02,
    // which is 7.8 gal at 300 sqft/gal — one coat, not two. A repaint in the
    // same colour is a one-coat job and this is the substrate that says so.
    coats: 1,
  },
  soffit_fascia: {
    label: "Soffit & fascia",
    unit: "lnft",
    surface: "exterior",
    driver: null,
    rateBasis: "production",
    //
    // ── THE ONE FIGURE OF HIS THAT DOES NOT RECONCILE. Do not "fix" it. ─────
    //
    // 30 lnft/hr is his stated rate, and 260 lnft ÷ 30 = 8.6667 h, which at
    // $80/hr is $693.33. His sheet shows $693.60. The gap is exactly his own
    // displayed hours — 8.6667 shown as "8.67" — multiplied by $80. In other
    // words the $0.27 IS the round-then-multiply error, and every other figure
    // on both jobs proves he does not make it anywhere else: the den's ceiling
    // is 1.1818 h × $85 = $100.45, where rounding first would have given
    // $100.30. Money here uses exact hours. See `displayHours`.
    //
    // He separately wrote the wall formula as "464 sqft ÷ 100 sqft/hr × $80/hr
    // + prep $0 = $462". That arithmetic gives $371.20. It is the same family
    // of slip and it is likewise not reproduced: 464 ÷ 100 × 80 is $371.20 and
    // this engine returns $371.20. Both are asserted in
    // scripts/check-paint-takeoff.mjs so nobody later makes the working code
    // match the broken line.
    //
    productionRate: 30,
    // RECOVERED: $373.34 over 260 lnft at two coats is 4.044444 gal of
    // exterior body at 300 sqft/gal, i.e. 2.3333 sqft per linear foot — a
    // 24-inch soffit (2.0) plus a 4-inch fascia (0.333). It lands exactly.
    sqftPerUnit: 7 / 3,
    productKey: "exterior_body",
    coats: 2,
  },
  garage_door: {
    label: "Garage door",
    unit: "each",
    surface: "exterior",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 2, // RECOVERED: $160.00 per door at his $80/hr
    // RECOVERED: $80.77 is 0.875 gal at two coats over 300 sqft/gal, i.e.
    // 131.25 sqft of paintable face — a 16 × 7 double door with its frame,
    // stops and the panel returns that a flat 112 sqft misses.
    sqftPerUnit: 131.25,
    productKey: "exterior_body",
    coats: 2,
  },
};

/* ── Area types ────────────────────────────────────────────────────────── */
//
// KEYED MAP, and LABELS ONLY. There is deliberately no `defaultSqft` here, and
// the existing `interior_painting.roomTypes` array — which carries one — is the
// reason to say so out loud: a default square footage is absent data wearing a
// measurement's clothes. Picking "Living Room" must never put 300 sqft into a
// price. This model measures L × W × H, which is both strictly better and the
// thing the estimator is standing in the room to do.

export const PAINT_AREA_TYPE_DEFAULTS = {
  den: { label: "Den", surface: "interior" },
  living_room: { label: "Living room", surface: "interior" },
  kitchen: { label: "Kitchen", surface: "interior" },
  dining_room: { label: "Dining room", surface: "interior" },
  guest_room: { label: "Guest room", surface: "interior" },
  guest_bathroom: { label: "Guest bathroom", surface: "interior" },
  master_bedroom: { label: "Master bedroom", surface: "interior" },
  basement: { label: "Basement", surface: "interior" },
  foyer: { label: "Foyer", surface: "interior" },
  hallway: { label: "Hallway", surface: "interior" },
  closet: { label: "Closet", surface: "interior" },
  accent_wall: { label: "Accent wall", surface: "interior" },
  whole_house: { label: "Whole house", surface: "interior" },
  exterior: { label: "Exterior", surface: "exterior" },
};

/* ── Measurement styles ────────────────────────────────────────────────── */
//
// Each style derives ONLY what its inputs can support. `wall` has no ceiling
// and no floor because a run of wall is not a closed room, and inventing one
// would be the same failure as defaultSqft. `surface` derives nothing at all:
// it is for a measured surface off a drawing or a wheel.

export const PAINT_MEASUREMENT_STYLES = {
  area: { label: "Room (L × W × H)", inputs: ["lengthFt", "widthFt", "heightFt"] },
  wall: { label: "Wall run (linear ft × H)", inputs: ["linearFt", "heightFt"] },
  surface: { label: "Measured surface", inputs: ["surfaceSqft", "linearFt"] },
};

/** The geometry fields a substrate's quantity can be driven from. */
export const PAINT_QUANTITY_DRIVERS = {
  ceilingSqft: { label: "Ceiling area", unit: "sqft" },
  wallSqft: { label: "Wall area", unit: "sqft" },
  floorSqft: { label: "Floor area", unit: "sqft" },
  linearFt: { label: "Perimeter", unit: "lnft" },
};

/* ── The book's own settings ───────────────────────────────────────────── */

export const PAINT_TAKEOFF_DEFAULTS = {
  // The hourly SELL rate. This is a PRICE, not a cost, and the distinction is
  // the whole reason both exist:
  //
  //   • This rate × hours is what the client is charged. RECOVERED — every
  //     line of the owner's den reproduces at $85.00/hr and every line of his
  //     exterior job at $80.00/hr.
  //
  //   • lib/costing/ takes the SAME hours and multiplies them by the crew's
  //     burdened cost (FALLBACK_LABOUR_RATE = 35 in lib/costing/quoteCosting.js
  //     when no crew is assigned) to produce the margin figure.
  //
  // They must never be substituted for one another. Using the cost rate here
  // publishes what the job costs the contractor; using the sell rate there
  // reports every job at 0% margin. This engine emits HOURS precisely so that
  // one set of hours can answer both questions, and it multiplies by a rate
  // exactly once, here, for the client's side.
  hourlySellRate: 85,
  exteriorHourlySellRate: 80,

  // Materials at cost, which is how his job was priced: all of the margin is
  // in the hourly rate above. Kept as an explicit, editable number rather than
  // left implicit, because "is the paint marked up" is a question a contractor
  // must be able to answer about their own quote, and 0 is an answer.
  materialMarkupPct: 0,

  // Hours are DISPLAYED rounded and PRICED exact. See displayHours().
  //
  // Two precisions, because his sheet uses two: a line shows one decimal
  // (0.25 h prints as "0.3", 1.1818 h as "1.2") and a total shows two (9.7218
  // prints as "9.72"). That is not an inconsistency — a total is the number
  // somebody schedules a crew against, and a tenth of an hour of error per
  // line adds up across a house.
  hoursDisplayDecimals: 1,
  totalHoursDisplayDecimals: 2,

  // Gallons round up per substrate when on, and stay fractional and roll up
  // per product when off. Off by default — that is what his job did, and it is
  // the arithmetic that reproduces $202.59. See paintTakeoff() for why the
  // order matters more than the flag.
  roundGallonsUp: false,

  // How much of the accepted total is asked for up front. His den showed
  // $257.24 on $1,028.94, which is 25% to the cent.
  depositPct: 25,

  products: PAINT_PRODUCT_DEFAULTS,
  substrates: PAINT_SUBSTRATE_DEFAULTS,
  areaTypes: PAINT_AREA_TYPE_DEFAULTS,
};

/* ── Geometry ──────────────────────────────────────────────────────────── */

/**
 * The four measurements an area implies, from what was actually entered.
 *
 * OPENINGS ARE NOT DEDUCTED. 2 × (L + W) × H is GROSS wall area, and a 10 × 13
 * den with a door and two windows still measures 414 sqft here. That is
 * standard painting practice, not an oversight: cutting in around an opening
 * costs about what the missing area saves, and every production rate above was
 * recovered against gross area, so deducting would silently under-quote every
 * room by the amount of its own openings.
 *
 * @returns {{linearFt:number, wallSqft:number, ceilingSqft:number,
 *            floorSqft:number}} zeros for anything the style cannot support.
 */
export function areaGeometry(area) {
  const style = area?.measurement === "wall" || area?.measurement === "surface"
    ? area.measurement
    : "area";

  if (style === "wall") {
    const linearFt = positive(area?.linearFt);
    const heightFt = positive(area?.heightFt);
    // No ceiling, no floor. A wall run is not a closed room and inventing one
    // would put a ceiling on the client's quote that nobody is painting.
    return {
      linearFt,
      wallSqft: money(mul(linearFt, heightFt)),
      ceilingSqft: 0,
      floorSqft: 0,
    };
  }

  if (style === "surface") {
    // Nothing is derived: the estimator measured it.
    return {
      linearFt: positive(area?.linearFt),
      wallSqft: positive(area?.surfaceSqft),
      ceilingSqft: 0,
      floorSqft: 0,
    };
  }

  const L = positive(area?.lengthFt);
  const W = positive(area?.widthFt);
  const H = positive(area?.heightFt);
  const plan = mul(L, W);
  return {
    linearFt: money(mul(2, L + W)),
    wallSqft: money(mul(2, L + W, H)),
    ceilingSqft: money(plan),
    floorSqft: money(plan),
  };
}

/**
 * Hours as the SCREEN shows them — rounded — which is never what the money uses.
 *
 * The den's ceiling is 1.181818 h. It displays as "1.2" and it prices at
 * 1.181818 × $85 = $100.45. Rounding first gives 1.2 × $85 = $102.00, which is
 * $1.55 of invented money on one line of one room, and the error compounds with
 * every line. The owner's own exterior sheet contains exactly this slip once
 * (see `soffit_fascia`), which is the best possible argument for keeping the
 * two operations in separate functions.
 */
export function displayHours(hours, decimals = 1) {
  const h = finite(hours);
  const d = Math.min(4, Math.max(0, Math.trunc(finite(decimals))));
  const f = 10 ** d;
  const r = Math.round(h * f) / f;
  return Number.isFinite(r) ? r : 0;
}

/* ── Resolution ────────────────────────────────────────────────────────── */

/** The book's definition of a substrate, with the line's own edits over it. */
function resolveSubstrate(row, book) {
  const def = own(book?.substrates, row?.key);
  if (!def) return null;
  return {
    key: row.key,
    def,
    label: String(row?.label || def.label || row.key),
    unit: def.unit || "each",
    // Coats is a per-line choice (1/2/3) — the estimator's, over the book's.
    coats: clampCoats(row?.coats, def.coats),
    prepHours: positive(row?.prepHours),
    // A typed rate wins over the book's. Absence is not zero: a blank box
    // means "use the rate card", so only a positive number overrides.
    productionRate: positive(row?.productionRate) || positive(def.productionRate),
    hoursPerUnit: positive(row?.hoursPerUnit) || positive(def.hoursPerUnit),
    rateBasis: def.rateBasis === "item" ? "item" : "production",
    sqftPerUnit: positive(row?.sqftPerUnit) || positive(def.sqftPerUnit),
    driver: typeof row?.driver === "string" ? row.driver : def.driver,
    productKey:
      (typeof row?.productKey === "string" && row.productKey) || def.productKey,
    // "No product" HIDES the product and SKIPS the material cost. It does not
    // set it to zero. An absent material and a free material are different
    // claims — the first says nobody is supplying paint for this line (the
    // client's own paint, a substrate that only gets sanded), the second says
    // the paint is free. The totals report them separately for that reason.
    noProduct: row?.noProduct === true,
    optional: row?.optional === true,
    showFormula: row?.showFormula === true,
    // null (not false) means "inherit the area's setting". A per-substrate
    // override has to be able to say "no" against an area that says "yes".
    roundGallonsUp:
      row?.roundGallonsUp === true
        ? true
        : row?.roundGallonsUp === false
          ? false
          : null,
  };
}

function clampCoats(v, fallback) {
  const n = Math.trunc(finite(v));
  if (n >= 1 && n <= 3) return n;
  const f = Math.trunc(finite(fallback));
  return f >= 1 && f <= 3 ? f : 2;
}

/** The measured or counted quantity behind one substrate line. */
function resolveQuantity(sub, geometry, row) {
  // An explicitly entered quantity wins, INCLUDING zero. A 0-quantity
  // substrate is the estimator saying "none of these here", and it must price
  // at nothing rather than falling back to the geometry.
  const typed = row?.quantity;
  if (typed !== null && typed !== undefined && typed !== "") {
    return positive(typed);
  }
  if (sub.driver && own(PAINT_QUANTITY_DRIVERS, sub.driver)) {
    return positive(own(geometry, sub.driver));
  }
  return 0;
}

/* ── The engine ────────────────────────────────────────────────────────── */

/**
 * Price a painting takeoff, area by area and substrate by substrate.
 *
 * ── The gallon-rounding ORDER, which is the whole point of the flag ─────────
 *
 * Rounding then summing is not summing then rounding, and on a whole house the
 * difference is a trip to the store.
 *
 *   ROUND UP ON  — every substrate ceils its own gallons. Three bedrooms
 *                  needing 0.4 gal of ceiling paint each buy 1 + 1 + 1 = 3.
 *                  Correct when each room is a different colour, because you
 *                  genuinely cannot carry the remainder to the next one.
 *
 *   ROUND UP OFF — substrates stay fractional and roll up PER PRODUCT. The
 *                  same three bedrooms are 1.2 gal and buy 2. Correct when
 *                  they share a colour, which is most jobs.
 *
 * The MONEY always uses the substrate's own gallons, fractional unless that
 * substrate rounds. That is what reproduces the owner's job to the cent, and it
 * is also right: he charged for the paint the room consumed, not for the tin.
 * `purchase` below is the separate, ceiled answer to the separate question of
 * what to actually buy, and it is a work-order figure, never a price.
 *
 * Gallons roll up PER PRODUCT and never across products, because two gallons
 * of ceiling flat and three of trim enamel are five tins, not five gallons of
 * anything you can pour together.
 *
 * @param {object} config  the stored takeoff — { areas: [...] }
 * @param {object} book    PAINT_TAKEOFF_DEFAULTS, merged with company overrides
 * @param {object} [opts]
 * @param {number} [opts.hourlySellRate]  overrides the book's, per quote
 * @returns {object} areas, totals, purchase list, and what was left out
 */
export function paintTakeoff(config, book, opts = {}) {
  const b = book || PAINT_TAKEOFF_DEFAULTS;
  const markup = finite(b.materialMarkupPct);
  const decimals = b.hoursDisplayDecimals;
  const totalDecimals =
    b.totalHoursDisplayDecimals === undefined
      ? decimals
      : b.totalHoursDisplayDecimals;

  const areas = [];
  const optionalAreas = [];
  const optionalSubstrates = [];
  // Fractional gallons per product, for the buy list. Object.create(null) so a
  // product key of "__proto__" out of stored JSON lands in the map instead of
  // rewriting the prototype chain.
  const gallonsByProduct = Object.create(null);

  let includedLabour = 0;
  let includedMaterial = 0;
  let includedHours = 0;
  let unpricedCount = 0;

  const rawAreas = asArray(config?.areas);
  for (let areaIndex = 0; areaIndex < rawAreas.length; areaIndex += 1) {
    const rawArea = rawAreas[areaIndex];
    if (!rawArea || typeof rawArea !== "object") continue;

    const areaType = own(b.areaTypes, rawArea.areaType);
    const surface =
      rawArea.surface === "exterior" || rawArea.surface === "interior"
        ? rawArea.surface
        : areaType?.surface || "interior";

    // Exterior work is sold at its own rate. His two jobs are $85 interior and
    // $80 exterior, and an exterior area under an interior quote must still
    // carry the exterior rate.
    const rate =
      positive(opts.hourlySellRate) ||
      positive(rawArea.hourlySellRate) ||
      (surface === "exterior"
        ? positive(b.exteriorHourlySellRate) || positive(b.hourlySellRate)
        : positive(b.hourlySellRate));

    const geometry = areaGeometry(rawArea);
    const areaRoundsUp =
      rawArea.roundGallonsUp === true
        ? true
        : rawArea.roundGallonsUp === false
          ? false
          : b.roundGallonsUp === true;

    const label = String(rawArea.label || areaType?.label || "Area");
    const areaOptional = rawArea.optional === true;

    const lines = [];
    let areaLabour = 0;
    let areaMaterial = 0;
    let areaHours = 0;

    // The area's own extra prep — masking a furnished room, papering a floor —
    // is labour with no substrate and no paint behind it. It bills at the same
    // hourly sell rate, which is what the owner asked for.
    const areaPrepHours = positive(rawArea.prepHours);
    if (areaPrepHours > 0) {
      const amount = money(mul(areaPrepHours, rate));
      areaHours += areaPrepHours;
      areaLabour = money(areaLabour + amount);
      lines.push({
        kind: "prep",
        key: "__prep",
        label: `${label} — additional prep`,
        unit: "hour",
        quantity: areaPrepHours,
        hours: areaPrepHours,
        displayHours: displayHours(areaPrepHours, decimals),
        labour: amount,
        gallons: null,
        material: null,
        noProduct: true,
        optional: false,
        amount,
      });
    }

    const substrateRows = asArray(rawArea.substrates);
    for (let rowIndex = 0; rowIndex < substrateRows.length; rowIndex += 1) {
      const row = substrateRows[rowIndex];
      const sub = resolveSubstrate(row, b);
      if (!sub) continue;

      const quantity = resolveQuantity(sub, geometry, row);

      const workHours =
        sub.rateBasis === "item"
          ? mul(quantity, sub.hoursPerUnit)
          : sub.productionRate > 0
            ? finite(quantity / sub.productionRate)
            : 0;
      const hours = finite(workHours + sub.prepHours);

      // Nothing measured and nothing to prep is not a line. A $0.00 row on a
      // client's quote reads as a promise of free work.
      if (hours <= 0 && quantity <= 0) continue;

      const labour = money(mul(hours, rate));

      // ── Materials ──
      const product = sub.noProduct ? null : own(b.products, sub.productKey);
      let gallons = null;
      let material = null;
      let unpriced = false;

      if (product) {
        const coverage = positive(product.coverageSqftPerGal);
        const raw =
          coverage > 0
            ? finite(mul(quantity, sub.sqftPerUnit, sub.coats) / coverage)
            : 0;
        const roundsUp =
          sub.roundGallonsUp === null ? areaRoundsUp : sub.roundGallonsUp;
        gallons = roundsUp ? Math.ceil(raw) : raw;
        if (!Number.isFinite(gallons)) gallons = 0;

        if (product.costPerGal === null || product.costPerGal === undefined) {
          // Quantity known, price not. Counted, never costed at zero.
          unpriced = gallons > 0;
          if (unpriced) unpricedCount += 1;
        } else {
          const cost = mul(gallons, positive(product.costPerGal));
          material = money(mul(cost, 1 + Math.max(-100, markup) / 100));
        }

        if (gallons > 0 && !areaOptional && !sub.optional) {
          const pk = sub.productKey;
          gallonsByProduct[pk] = finite((gallonsByProduct[pk] || 0) + gallons);
        }
      }

      const amount = money(labour + finite(material));

      const item = {
        kind: "substrate",
        // Where this line sits in the stored substrates array. The takeoff form
        // pairs its rows with these by index, and matching by label instead
        // would mis-pair the moment two rooms both had a "Ceiling".
        rowIndex,
        key: sub.key,
        label: sub.label,
        unit: sub.unit,
        quantity,
        coats: sub.coats,
        hours,
        displayHours: displayHours(hours, decimals),
        labour,
        // null, not 0. "No product" and "an unpriced product" both mean
        // nobody has said what the paint costs; 0 would mean it is free.
        gallons,
        material,
        noProduct: sub.noProduct,
        unpriced,
        productKey: sub.noProduct ? null : sub.productKey,
        optional: sub.optional,
        // INTERNAL ONLY — see paintFormula(). Never reaches a client surface.
        showFormula: sub.showFormula,
        rateBasis: sub.rateBasis,
        rate: sub.rateBasis === "item" ? sub.hoursPerUnit : sub.productionRate,
        hourlySellRate: rate,
        prepHours: sub.prepHours,
        amount,
      };

      if (areaOptional || sub.optional) {
        if (!areaOptional) optionalSubstrates.push({ area: label, ...item });
      } else {
        areaHours = finite(areaHours + hours);
        areaLabour = money(areaLabour + labour);
        areaMaterial = money(areaMaterial + finite(material));
      }
      lines.push(item);
    }

    const areaTotal = money(areaLabour + areaMaterial);
    const record = {
      // Position in the stored areas array — see rowIndex above. `areas` and
      // `optionalAreas` are two lists over one array, so an index is the only
      // thing that identifies a row across both.
      index: areaIndex,
      label,
      areaType: rawArea.areaType || null,
      surface,
      measurement: rawArea.measurement || "area",
      geometry,
      hourlySellRate: rate,
      optional: areaOptional,
      roundGallonsUp: areaRoundsUp,
      // Internal, work-order only. Never rendered on a client surface —
      // ScopeGroupsSection and lib/email/quoteSections read `description` and
      // `amount` and nothing else.
      crewNote: String(rawArea.crewNote || ""),
      clientNote: String(rawArea.clientNote || ""),
      lines,
      hours: areaHours,
      displayHours: displayHours(areaHours, totalDecimals),
      labour: areaLabour,
      material: areaMaterial,
      total: areaTotal,
    };

    if (areaOptional) {
      // An optional AREA is priced whole — its own optional substrates included
      // — because it is offered to the client as one thing to add or drop.
      const whole = lines.reduce((s, l) => finite(s + l.amount), 0);
      optionalAreas.push({ ...record, total: money(whole) });
    } else {
      areas.push(record);
      includedHours = finite(includedHours + areaHours);
      includedLabour = money(includedLabour + areaLabour);
      includedMaterial = money(includedMaterial + areaMaterial);
    }
  }

  // What to buy. Fractional gallons summed per product, then ceiled ONCE. This
  // is the summing-then-rounding half of the pair described above, and it is
  // deliberately not the number any money is derived from.
  const purchase = Object.keys(gallonsByProduct)
    .map((key) => {
      const product = own(b.products, key);
      const raw = finite(gallonsByProduct[key]);
      return {
        productKey: key,
        label: product?.label || key,
        gallons: Math.ceil(raw),
        fractionalGallons: Math.round(raw * 1000) / 1000,
        costPerGal:
          product?.costPerGal === null || product?.costPerGal === undefined
            ? null
            : positive(product.costPerGal),
      };
    })
    .filter((p) => p.gallons > 0)
    .sort((a, b2) => a.productKey.localeCompare(b2.productKey));

  const total = money(includedLabour + includedMaterial);

  return {
    areas,
    // Priced, but NOT in the total. They only become money if the client ticks
    // them — see paintOptionalExtras() and the QuoteAddOn rows it feeds.
    optionalAreas,
    optionalSubstrates,
    purchase,
    hours: includedHours,
    displayHours: displayHours(includedHours, totalDecimals),
    labour: includedLabour,
    material: includedMaterial,
    total,
    deposit: money(mul(total, positive(b.depositPct) / 100)),
    // How many lines have a quantity of paint and no price for it. The caller
    // reports the count rather than letting a zero look like cheap paint.
    unpricedCount,
  };
}

/**
 * The rate formula behind one line, in words. INTERNAL — staff only.
 *
 * Non-negotiable #4: public endpoints never return prices. This string is a
 * production rate and an hourly SELL rate, which is the contractor's whole
 * pricing model in one sentence — the single worst thing to leak. It is
 * returned from this named function and from nowhere else so that a grep for
 * `paintFormula` is a complete audit of where it can reach. It is not built
 * into the line item, is not part of `description`, and the client-facing
 * surfaces (ScopeGroupsSection, lib/email/quoteSections, the public quote
 * route) render only `description` and `amount`, so it has no path to a
 * homeowner even if a caller misuses it.
 */
export function paintFormula(line) {
  if (!line || line.showFormula !== true) return null;
  const q = finite(line.quantity);
  const rate = finite(line.rate);
  const sell = finite(line.hourlySellRate);
  const prep = finite(line.prepHours);
  const basis =
    line.rateBasis === "item"
      ? `${q} × ${rate} h`
      : `${q} ${line.unit} ÷ ${rate} ${line.unit}/hr`;
  const prepPart = prep > 0 ? ` + ${prep} h prep` : "";
  return `${basis}${prepPart} = ${line.displayHours} h × $${sell.toFixed(2)}/hr = $${line.labour.toFixed(2)}`;
}

/**
 * The optional areas and substrates, as offers a client can tick.
 *
 * These are the ONLY thing that makes the "optional" checkboxes honest. An
 * optional line is left out of the group's priced scope entirely and comes back
 * as a QuoteAddOn row — the existing, server-repriced mechanism, where the
 * browser posts ids and the server reads the amount off its own rows (see
 * app/api/public/quotes/[token]/route.js). Ticking one changes the total on the
 * document the client signs, which is the only definition of "works" that
 * counts.
 *
 * Capped at 8 to match the add-ons editor's own limit; more than a handful of
 * extras is a second quote, not an upsell.
 */
export function paintOptionalExtras(config, book, opts = {}) {
  const result = paintTakeoff(config, book, opts);
  const extras = [];

  for (const area of result.optionalAreas) {
    if (area.total <= 0) continue;
    extras.push({
      description: area.label,
      detail: area.clientNote || null,
      amount: area.total,
    });
  }
  for (const sub of result.optionalSubstrates) {
    if (sub.amount <= 0) continue;
    extras.push({
      description: `${sub.area} — ${sub.label}`,
      detail: null,
      amount: sub.amount,
    });
  }
  return extras.slice(0, 8);
}

/* ── Blanks ────────────────────────────────────────────────────────────── */

/** A blank substrate line for an area. */
export function newPaintSubstrate(key, book = PAINT_TAKEOFF_DEFAULTS) {
  const def = own(book?.substrates, key);
  if (!def) return null;
  return {
    key,
    // Seeded from the book so the estimator can rename it for the client
    // ("Baseboard" → "Baseboards & casings") without editing the rate card.
    label: def.label,
    coats: def.coats ?? 2,
    prepHours: 0,
    // null, not 0. Null means "take it from the geometry"; 0 means "none of
    // these here". A blank box that meant zero would silently un-price every
    // ceiling the moment the form loaded.
    quantity: def.driver ? null : 0,
    driver: def.driver ?? null,
    productKey: def.productKey ?? null,
    noProduct: false,
    optional: false,
    showFormula: false,
    roundGallonsUp: null,
  };
}

/** A blank area. */
export function newPaintArea(areaType = "den", book = PAINT_TAKEOFF_DEFAULTS) {
  const def = own(book?.areaTypes, areaType);
  return {
    areaType: def ? areaType : "den",
    label: def?.label || "Area",
    surface: def?.surface || "interior",
    measurement: "area",
    // No seeded dimensions. See the note on PAINT_AREA_TYPE_DEFAULTS: a room
    // type is a name, not a measurement.
    lengthFt: 0,
    widthFt: 0,
    heightFt: 0,
    linearFt: 0,
    surfaceSqft: 0,
    prepHours: 0,
    optional: false,
    roundGallonsUp: null,
    crewNote: "",
    clientNote: "",
    substrates: [],
  };
}
