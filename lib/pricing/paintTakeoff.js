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

  /* — Premium upgrades. UNPRICED until the company prices them. — */
  //
  // These exist so a "Premium paint upgrade" option on an area has a product
  // to swap to (see `premium_paint` in areaOptions()). The cost is NULL, not a
  // guess: the owner's jobs never bought a premium line, and a made-up $70/gal
  // would put an invented number on a homeowner's option. Coverage stays at
  // the recovered 350 — a premium label quotes 350–400 and the lower bound is
  // the one that cannot under-buy. `premiumFor` names the paint it upgrades.
  wall_interior_premium: {
    label: "Premium interior wall",
    costPerGal: null,
    coverageSqftPerGal: 350,
    surface: "interior",
    premiumFor: "wall_interior",
  },
  trim_enamel_premium: {
    label: "Premium trim enamel",
    costPerGal: null,
    coverageSqftPerGal: 350,
    surface: "interior",
    premiumFor: "trim_enamel",
  },
  exterior_body_premium: {
    label: "Premium exterior",
    costPerGal: null,
    coverageSqftPerGal: 300,
    surface: "exterior",
    premiumFor: "exterior_body",
  },

  /* — Staining. ILLUSTRATIVE coverage, UNPRICED cost. — */
  //
  // No staining job of the owner's has been recovered, so there is no price
  // with provenance and none is invented. Coverage is the manufacturer's
  // label figure (an oil stain and a water-based clear both quote 350–500
  // sqft/gal on smooth wood; a sanding sealer a little more) and is marked
  // illustrative on the rate card, where it is editable. Until a cost is set
  // a staining line reports its gallons and no money, flagged unpriced —
  // exactly as primer does.
  stain_oil: {
    label: "Penetrating oil stain",
    costPerGal: null,
    coverageSqftPerGal: 400,
    surface: "staining",
    provenance: "illustrative",
  },
  clear_water: {
    label: "Water-based clear coat",
    costPerGal: null,
    coverageSqftPerGal: 400,
    surface: "staining",
    provenance: "illustrative",
  },
  sanding_sealer: {
    label: "Sanding sealer",
    costPerGal: null,
    coverageSqftPerGal: 450,
    surface: "staining",
    provenance: "illustrative",
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

  /* — Wallpaper, EXAMPLE. Not his numbers. — */
  //
  // Neither of his jobs touched wallpaper. The two rates are the ones the
  // approved mockup lists and they are examples, marked so on the card. No
  // product: stripping uses steam, hanging uses paper bought by the roll —
  // neither is a gallon of anything, so the line is labour only unless the
  // estimator picks a product (a sizing primer, say).

  wallpaper_strip: {
    label: "Strip wallpaper",
    unit: "sqft",
    surface: "interior",
    driver: "wallSqft",
    rateBasis: "production",
    productionRate: 50, // EXAMPLE: steam and scrape, skim where needed
    sqftPerUnit: 1,
    productKey: null,
    coats: 1,
    provenance: "example",
  },
  wallpaper_install: {
    label: "Install wallpaper",
    unit: "sqft",
    surface: "interior",
    driver: "wallSqft",
    rateBasis: "production",
    productionRate: 35, // EXAMPLE: paste-the-wall, pattern match
    sqftPerUnit: 1,
    productKey: null,
    coats: 1,
    provenance: "example",
  },

  /* — Cabinets & millwork, painted. DERIVED from the owner's cabinet timing. — */
  //
  // The hours per piece come from CABINET_LABOUR_DEFAULTS in
  // lib/pricing/cabinetLabour.js — the owner timing his own crew: sand 6 min
  // a door (4 a drawer front), degrease 3, tack 2.5, paint 3 per coat. Two
  // coats of enamel: (6 + 3 + 2.5 + 2 × 3) ÷ 60 = 0.292 h a door, 0.258 h a
  // drawer front. Masking, box sanding and reinstall are job-level in that
  // module and are the area's "extra prep hours" here. The paintable face is
  // ILLUSTRATIVE: a 15 × 30 door, both faces (6.25 sqft); a 15 × 12 front
  // (2.5 sqft). The refinishing rate card's $150 a door is offered beside
  // these as a FLAT rate — see PAINT_RATE_SET_DEFAULTS.cabinets.

  cab_door: {
    label: "Cabinet door (both faces)",
    unit: "each",
    surface: "cabinets",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 17.5 / 60,
    sqftPerUnit: 6.25,
    productKey: "trim_enamel",
    coats: 2,
    provenance: "derived",
  },
  cab_drawer: {
    label: "Drawer front",
    unit: "each",
    surface: "cabinets",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 15.5 / 60,
    sqftPerUnit: 2.5,
    productKey: "trim_enamel",
    coats: 2,
    provenance: "derived",
  },
  cab_box: {
    label: "Cabinet boxes (face frames & ends)",
    unit: "lnft",
    surface: "cabinets",
    driver: null,
    rateBasis: "production",
    // ILLUSTRATIVE: a run of face frame, brushed, with the exposed end panels.
    productionRate: 6,
    sqftPerUnit: 3,
    productKey: "trim_enamel",
    coats: 2,
    provenance: "illustrative",
  },
  cab_builtin: {
    label: "Built-ins & shelving",
    unit: "sqft",
    surface: "cabinets",
    driver: null,
    rateBasis: "production",
    // ILLUSTRATIVE: the recovered 40 lnft/hr baseboard rate read as square
    // feet of shelf face — flat, but every edge is cut in.
    productionRate: 40,
    sqftPerUnit: 1,
    productKey: "trim_enamel",
    coats: 2,
    provenance: "illustrative",
  },

  /* — Staining. ILLUSTRATIVE. No recovered job behind any of these. — */
  //
  // Each carries TWO products — a stain and a clear coat — so gallons roll up
  // per product for both. The cabinet hours are DERIVED the same way as the
  // painted cabinets above, with one stain coat and two clear coats:
  // (6 + 3 + 2.5 + 3 × 3) ÷ 60 = 0.342 h a door, 0.308 h a drawer front. The
  // vanity lines carry the same rates and exist so the quote reads "Vanity".
  // Stairs, railings, decks, fences and the front door are analogues of the
  // painted substrates above with the same face areas, and they say so.
  // Edit every one of them on the rate card before quoting off it.

  stain_cab_door: {
    label: "Kitchen cabinets — doors",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 20.5 / 60,
    sqftPerUnit: 6.25,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "derived",
  },
  stain_cab_drawer: {
    label: "Kitchen cabinets — drawer fronts",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 18.5 / 60,
    sqftPerUnit: 2.5,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "derived",
  },
  stain_vanity_door: {
    label: "Vanity — doors",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 20.5 / 60,
    sqftPerUnit: 6.25,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "derived",
  },
  stain_vanity_drawer: {
    label: "Vanity — drawer fronts",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 18.5 / 60,
    sqftPerUnit: 2.5,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "derived",
  },
  stain_tread: {
    label: "Stair treads",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.5, // ILLUSTRATIVE: the recovered door side, sanded and stained
    sqftPerUnit: 3.5, // ILLUSTRATIVE: a 36 × 11 tread with its nosing
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "illustrative",
  },
  stain_riser: {
    label: "Stair risers",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.25, // ILLUSTRATIVE: the recovered door frame
    sqftPerUnit: 2, // ILLUSTRATIVE: 36 × 7.5
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "illustrative",
  },
  stain_spindle: {
    label: "Spindles",
    unit: "each",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0.15, // ILLUSTRATIVE: nine minutes a spindle, all faces by hand
    sqftPerUnit: 1,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "illustrative",
  },
  stain_railing: {
    label: "Railings",
    unit: "lnft",
    surface: "staining",
    driver: null,
    rateBasis: "production",
    productionRate: 8, // ILLUSTRATIVE: the painted railing analogue
    sqftPerUnit: 4,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "illustrative",
  },
  stain_deck: {
    label: "Deck",
    unit: "sqft",
    surface: "staining",
    driver: "floorSqft",
    rateBasis: "production",
    productionRate: 150, // ILLUSTRATIVE: boards with a pad, rails by brush
    sqftPerUnit: 1,
    products: [{ productKey: "stain_oil", coats: 2 }],
    productKey: "stain_oil",
    coats: 2,
    provenance: "illustrative",
  },
  stain_fence: {
    label: "Fence",
    unit: "sqft",
    surface: "staining",
    driver: "wallSqft",
    rateBasis: "production",
    // ILLUSTRATIVE. One face; both faces is twice the quantity, and the
    // quick pick says so rather than hiding a ×2 in the rate.
    productionRate: 120,
    sqftPerUnit: 1,
    products: [{ productKey: "stain_oil", coats: 2 }],
    productKey: "stain_oil",
    coats: 2,
    provenance: "illustrative",
  },
  stain_front_door: {
    label: "Front door",
    unit: "side",
    surface: "staining",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 1, // ILLUSTRATIVE: between the flat door (0.5) and the French door (1.5)
    sqftPerUnit: 21,
    products: [
      { productKey: "stain_oil", coats: 1 },
      { productKey: "clear_water", coats: 2 },
    ],
    productKey: "stain_oil",
    coats: 1,
    provenance: "illustrative",
  },

  /* — A custom line. Numbers come from the line's own rate, never from here. — */
  //
  // "+ custom line" on an area. It has no rate of its own on purpose: a row
  // with key "custom" prices only through the inline rate the estimator wrote
  // (row.rate) or a custom rate saved to the set (row.rateKey). With neither
  // it measures nothing and produces no line — a $0 row is not a promise.
  custom: {
    label: "Custom line",
    unit: "each",
    surface: "any",
    driver: null,
    rateBasis: "item",
    hoursPerUnit: 0,
    sqftPerUnit: 0,
    productKey: null,
    coats: 1,
    provenance: "custom",
  },
};

/** Which substrate keys are the owner's RECOVERED rates, for the card's tag. */
export const PAINT_SUBSTRATE_PROVENANCE = Object.freeze({
  ceiling: "recovered",
  walls: "recovered",
  baseboard: "recovered",
  door: "recovered",
  door_frame: "recovered",
  window_sill: "recovered",
  closet_small: "recovered",
  wall_two_storey: "analogue",
  french_door: "analogue",
  ornate_frame: "analogue",
  bay_window: "analogue",
  railing_spindles: "analogue",
  crown_moulding: "analogue",
  siding_trim: "recovered",
  soffit_fascia: "recovered",
  garage_door: "recovered",
});

/** A substrate's provenance tag: its own field, else the recovered/analogue table. */
export function substrateProvenance(key, def) {
  return (
    (def && typeof def.provenance === "string" && def.provenance) ||
    own(PAINT_SUBSTRATE_PROVENANCE, key) ||
    "example"
  );
}

/* ── Area types ────────────────────────────────────────────────────────── */
//
// KEYED MAP, and LABELS ONLY. There is deliberately no `defaultSqft` here, and
// the existing `interior_painting.roomTypes` array — which carries one — is the
// reason to say so out loud: a default square footage is absent data wearing a
// measurement's clothes. Picking "Living Room" must never put 300 sqft into a
// price. This model measures L × W × H, which is both strictly better and the
// thing the estimator is standing in the room to do.

//
// `surfaces` is which ESTIMATE TYPES the room belongs to (see
// PAINT_ESTIMATE_TYPES — a kitchen is painted, has cabinets, and has cabinets
// that get stained); `surface` is what a new area of that type starts as.

export const PAINT_AREA_TYPE_DEFAULTS = {
  den: { label: "Den", surface: "interior" },
  living_room: { label: "Living room", surface: "interior" },
  kitchen: {
    label: "Kitchen",
    surface: "interior",
    surfaces: ["interior", "cabinets", "staining"],
  },
  dining_room: { label: "Dining room", surface: "interior" },
  guest_room: { label: "Guest room", surface: "interior" },
  guest_bathroom: {
    label: "Guest bathroom",
    surface: "interior",
    surfaces: ["interior", "cabinets", "staining"],
  },
  master_bedroom: { label: "Master bedroom", surface: "interior" },
  bedroom: { label: "Bedroom", surface: "interior" },
  bathroom: {
    label: "Bathroom",
    surface: "interior",
    surfaces: ["interior", "cabinets", "staining"],
  },
  office: { label: "Office", surface: "interior" },
  laundry: {
    label: "Laundry room",
    surface: "interior",
    surfaces: ["interior", "cabinets"],
  },
  basement: { label: "Basement", surface: "interior" },
  foyer: { label: "Foyer", surface: "interior" },
  hallway: { label: "Hallway", surface: "interior" },
  stairwell: {
    label: "Stairwell",
    surface: "interior",
    surfaces: ["interior", "staining"],
  },
  closet: { label: "Closet", surface: "interior" },
  accent_wall: { label: "Accent wall", surface: "interior" },
  garage: { label: "Garage", surface: "interior" },
  whole_house: { label: "Whole house", surface: "interior" },
  exterior: { label: "Exterior", surface: "exterior" },
  front_entry: {
    label: "Front entry",
    surface: "exterior",
    surfaces: ["exterior", "staining"],
  },
  deck: { label: "Deck", surface: "staining" },
  fence: { label: "Fence", surface: "staining" },
  built_ins: { label: "Built-ins", surface: "cabinets" },
  commercial_unit: {
    label: "Commercial unit",
    surface: "interior",
    surfaces: ["interior", "exterior"],
  },
};

/** The estimate types an area type belongs to. */
export function areaTypeSurfaces(def) {
  if (!def) return [];
  if (Array.isArray(def.surfaces) && def.surfaces.length) return def.surfaces;
  return def.surface ? [def.surface] : [];
}

/* ── Estimate types ────────────────────────────────────────────────────── */
//
// The first question on a painting quote — Interior, Exterior, Cabinets &
// millwork, Staining, Commercial — stored on the takeoff as `estimateType`.
// The pick filters the area types and substrates that follow and chooses the
// RATE SET (below). A takeoff with no type — every quote written before this
// landed — prices exactly as it did: substrate rates off the book, $85
// interior and $80 exterior by the area's surface. Nothing reprices.
//
// `surfaces` are the substrate surfaces the type offers. Commercial is the
// interior and exterior catalogue under its own rate set — the owner's
// definition: "same substrates, its own rates and hourly". The cards carry NO
// hourly rate (owner note, 2026-09-21): the sell rate is internal and lives on
// the rate set.

export const PAINT_ESTIMATE_TYPES = {
  interior: {
    label: "Interior",
    hint: "Rooms, walls, ceilings, trim",
    surfaces: ["interior"],
    defaultSurface: "interior",
    defaultAreaType: "living_room",
  },
  exterior: {
    label: "Exterior",
    hint: "Siding, soffit, doors",
    surfaces: ["exterior"],
    defaultSurface: "exterior",
    defaultAreaType: "exterior",
  },
  cabinets: {
    label: "Cabinets & millwork",
    hint: "Doors, drawer fronts, built-ins",
    surfaces: ["cabinets"],
    defaultSurface: "cabinets",
    defaultAreaType: "kitchen",
  },
  staining: {
    label: "Staining",
    hint: "Cabinets, stairs, decks, fences",
    surfaces: ["staining"],
    defaultSurface: "staining",
    defaultAreaType: "kitchen",
  },
  commercial: {
    label: "Commercial",
    hint: "Same surfaces · its own rate set",
    surfaces: ["interior", "exterior"],
    defaultSurface: "interior",
    defaultAreaType: "commercial_unit",
  },
};

/** The stored type, or null for a takeoff written before types existed. */
export function estimateTypeOf(config) {
  const t = config?.estimateType;
  return typeof t === "string" && own(PAINT_ESTIMATE_TYPES, t) ? t : null;
}

/** Does this substrate belong on an area of this surface, under this type? */
export function substrateFits(def, { estimateType = null, surface = null } = {}) {
  if (!def) return false;
  const s = def.surface || "any";
  if (s === "any") return true;
  if (surface) return s === surface;
  const type = estimateType ? own(PAINT_ESTIMATE_TYPES, estimateType) : null;
  if (type) return type.surfaces.includes(s);
  return s === "interior" || s === "exterior";
}

/* ── Quick picks: "tick what's painted" ────────────────────────────────── */
//
// After picking a room the estimator ticks what gets painted (owner, 2026-09-21):
// walls, ceiling, doors (one side / both sides), trim, windows, closets. Each
// tick adds the substrate row with the type's default rate. `count` asks how
// many; `sides` asks one or both, and the quantity is count × sides because
// the door substrate is priced PER SIDE (see `door`). Substrate labels are
// the book's; the screen translates the pick labels.

export const PAINT_QUICK_PICKS = {
  interior: [
    { key: "walls" },
    { key: "ceiling" },
    { key: "door", count: true, sides: true },
    { key: "baseboard", pick: "trim" },
    { key: "window_sill", pick: "windows", count: true },
    { key: "closet_small", pick: "closets", count: true },
  ],
  exterior: [
    { key: "siding_trim" },
    { key: "soffit_fascia", count: true },
    { key: "garage_door", count: true },
  ],
  cabinets: [
    { key: "cab_door", count: true },
    { key: "cab_drawer", count: true },
    { key: "cab_box", count: true },
    { key: "cab_builtin", count: true },
  ],
  staining: [
    { key: "stain_cab_door", count: true },
    { key: "stain_cab_drawer", count: true },
    { key: "stain_vanity_door", count: true },
    { key: "stain_vanity_drawer", count: true },
    { key: "stain_tread", count: true },
    { key: "stain_riser", count: true },
    { key: "stain_spindle", count: true },
    { key: "stain_railing", count: true },
    { key: "stain_deck" },
    { key: "stain_fence", count: true, faces: true },
    { key: "stain_front_door", count: true, sides: true },
  ],
  commercial: [
    { key: "walls" },
    { key: "ceiling" },
    { key: "door", count: true, sides: true },
    { key: "baseboard", pick: "trim" },
    { key: "window_sill", pick: "windows", count: true },
    { key: "siding_trim" },
  ],
};

/* ── Rate sets ─────────────────────────────────────────────────────────── */
//
// A rate set per estimate type: an hourly SELL rate and a keyed map of rates
// named by the SITUATION the painter is looking at — "8 ft walls", "16 ft
// walls", "8 ft walls, lots of cutting" — each pointing at the substrate it
// prices and carrying ONE of two bases:
//
//   production  units per hour (or hours per counted unit) × the set's hourly
//               sell rate. The recovered model; hours fall out for scheduling
//               and costing.
//   flat        a sell price per unit of the substrate — $/sqft, $/lnft,
//               $/each. The trade price book's model. Hours for scheduling
//               still come from the rate's own productionRate/hoursPerUnit
//               when it states one, else from the substrate's rate-card
//               figure, so a flat-priced wall is never labour-blind.
//
// Both coexist because the owner said both must (2026-09-21): "each rate in
// that set can be priced as production rate × hourly, flat $/sqft, or $/each".
//
// ── Defaults are SEEDED from the substrates above ──────────────────────────
//
// Every substrate contributes its rate-card figure as the set's default rate
// under its own key, so a company that never opens the rate card gets exactly
// the numbers it had before rate sets existed. The situation-named variants
// beside them are the approved mockup's EXAMPLES — 80, 75, $1.50 — and carry
// `provenance: "example"` so the picker says so. Commercial is the interior
// and exterior cards copied under `analogue`: an opening position the company
// is expected to replace, not a claim about commercial pricing.
//
// KEYED MAPS at every level, for the reason on PAINT_SUBSTRATE_DEFAULTS: a
// company's overrides merge key by key, so editing one rate keeps the rest.

const seededRate = (key, def, patch = {}) => ({
  label: def.label,
  situation: "Rate card",
  substrate: key,
  basis: "production",
  ...(def.rateBasis === "item"
    ? { hoursPerUnit: def.hoursPerUnit }
    : { productionRate: def.productionRate }),
  provenance: substrateProvenance(key, def),
  ...patch,
});

function seededRates(surfaces, patches = {}, provenance = null) {
  const out = {};
  for (const key of Object.keys(PAINT_SUBSTRATE_DEFAULTS)) {
    const def = PAINT_SUBSTRATE_DEFAULTS[key];
    if (key === "custom" || !surfaces.includes(def.surface)) continue;
    out[key] = seededRate(key, def, {
      ...(provenance ? { provenance } : {}),
      ...(own(patches, key) || {}),
    });
  }
  return out;
}

export const PAINT_RATE_SET_DEFAULTS = {
  interior: {
    label: "Interior",
    hourlySellRate: 85, // RECOVERED — the den
    exteriorHourlySellRate: 80, // RECOVERED — an exterior area on an interior quote
    rates: {
      ...seededRates(["interior"], {
        walls: { label: "8 ft walls", situation: "Standard room, 2 coats" },
        wall_two_storey: { situation: "Stairwell, planks and staging" },
        wallpaper_strip: { situation: "Steam and scrape, skim where needed" },
        wallpaper_install: { situation: "Paste-the-wall, pattern match" },
      }),
      walls_16ft: {
        label: "16 ft walls",
        situation: "Ladder work, repositioning",
        substrate: "walls",
        basis: "production",
        productionRate: 80,
        provenance: "example",
      },
      walls_cutting: {
        label: "8 ft walls, lots of cutting",
        situation: "Many openings, built-ins, dark trim",
        substrate: "walls",
        basis: "production",
        productionRate: 75,
        provenance: "example",
      },
      walls_bad_condition: {
        label: "Walls, bad condition",
        situation: "Priced per square foot, prep included",
        substrate: "walls",
        basis: "flat",
        sellPerUnit: 1.5,
        provenance: "example",
      },
    },
  },
  exterior: {
    label: "Exterior",
    hourlySellRate: 80, // RECOVERED — the exterior job
    rates: seededRates(["exterior"]),
  },
  cabinets: {
    label: "Cabinets & millwork",
    // The interior rate as the opening position — no cabinet-painting job of
    // his has been recovered at an hourly figure.
    hourlySellRate: 85,
    rates: {
      ...seededRates(["cabinets"]),
      // The cabinet refinishing rate card's per-face price, as a FLAT rate.
      // 150 is TRADE_PRICE_BOOKS.cabinet_refinishing.perDoor / perDrawer
      // (TrueFinish's own number); scripts/check-paint-rate-sets.mjs asserts
      // the two stay equal, since this file cannot import that one.
      cab_door_flat: {
        label: "Cabinet door — refinishing card",
        situation: "$150 a door, the cabinet refinishing rate",
        substrate: "cab_door",
        basis: "flat",
        sellPerUnit: 150,
        provenance: "recovered",
      },
      cab_drawer_flat: {
        label: "Drawer front — refinishing card",
        situation: "$150 a front, the cabinet refinishing rate",
        substrate: "cab_drawer",
        basis: "flat",
        sellPerUnit: 150,
        provenance: "recovered",
      },
    },
  },
  staining: {
    label: "Staining",
    hourlySellRate: 85, // the interior rate as the opening position
    rates: seededRates(["staining"]),
  },
  commercial: {
    label: "Commercial",
    hourlySellRate: 85,
    exteriorHourlySellRate: 80,
    rates: seededRates(
      ["interior", "exterior"],
      { walls: { label: "8 ft walls", situation: "Residential card — set your commercial rate" } },
      "analogue",
    ),
  },
};

/** The values a rate's `provenance` may take, and what the card calls them. */
export const PAINT_RATE_PROVENANCE = Object.freeze([
  "recovered",
  "analogue",
  "derived",
  "example",
  "illustrative",
  "custom",
]);

/** The rate set a takeoff prices from, or null with no type (legacy). */
export function rateSetFor(book, estimateType) {
  if (!estimateType) return null;
  return own(book?.rateSets, estimateType) || null;
}

/**
 * The rates a picker lists for one substrate — the set's, minus hidden ones,
 * in the set's order with the substrate's own default first.
 */
export function ratesForSubstrate(rateSet, substrateKey) {
  const rates = rateSet?.rates;
  if (!rates || typeof rates !== "object") return [];
  const out = [];
  for (const key of Object.keys(rates)) {
    const r = own(rates, key);
    if (!r || typeof r !== "object" || r.hidden === true) continue;
    if (r.substrate !== substrateKey && r.substrate !== "any") continue;
    out.push({ key, ...r });
  }
  out.sort((a, b) => (a.key === substrateKey ? -1 : b.key === substrateKey ? 1 : 0));
  return out;
}

/** "100 sqft/hr", "$1.50/sqft", "0.5 h/side" — a rate's figure in words. */
export function rateFigure(rate, unit = "each", currency = "$") {
  if (!rate) return "";
  if (rate.basis === "flat") {
    return `${currency}${finite(rate.sellPerUnit).toFixed(2)}/${unit}`;
  }
  if (positive(rate.hoursPerUnit) > 0) return `${finite(rate.hoursPerUnit)} h/${unit}`;
  if (positive(rate.productionRate) > 0) return `${finite(rate.productionRate)} ${unit}/hr`;
  return "";
}

/* ── Measurement styles ────────────────────────────────────────────────── */
//
// Each style derives ONLY what its inputs can support. `wall` has no ceiling
// and no floor because a run of wall is not a closed room, and inventing one
// would be the same failure as defaultSqft. `surface` derives nothing at all:
// it is for a measured surface off a drawing or a wheel.

//
// The screen offers two words — Room (4 walls) and Surface (single wall) —
// which are `area` and `wall`. `surface` (a typed square footage) is kept for
// the takeoffs that already carry it: the instant-quote seed writes one
// (lib/estimate/instantQuoteCosting.js) and every stored quote keeps its own.
// On screen it draws under Surface; typing over the strip is the upgrade path.

export const PAINT_MEASUREMENT_STYLES = {
  area: { label: "Room (4 walls)", inputs: ["lengthFt", "widthFt", "heightFt"] },
  wall: { label: "Surface (single wall)", inputs: ["linearFt", "heightFt"] },
  surface: { label: "Surface (measured)", inputs: ["surfaceSqft", "linearFt"], legacy: true },
};

/** The four stored overrides, by the geometry field each replaces. */
export const PAINT_GEOMETRY_OVERRIDES = {
  linearFt: "linearFtOverride",
  wallSqft: "wallSqftOverride",
  ceilingSqft: "ceilingSqftOverride",
  floorSqft: "floorSqftOverride",
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

  // What an "Extra coat" option charges for LABOUR, as a share of the line's
  // work hours. ILLUSTRATIVE, and editable on the rate card. The rates above
  // already cover two coats (see the note on PAINT_SUBSTRATE_DEFAULTS), so a
  // third coat's hours are not in them; 50% is the even split of a two-coat
  // rate, and that same note says the second coat is the faster one, so this
  // is an upper bound a company will more likely lower than raise. The paint
  // for the extra coat is exact — one more coat through coverage.
  extraCoatHoursPct: 50,

  products: PAINT_PRODUCT_DEFAULTS,
  substrates: PAINT_SUBSTRATE_DEFAULTS,
  areaTypes: PAINT_AREA_TYPE_DEFAULTS,
  rateSets: PAINT_RATE_SET_DEFAULTS,
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
  return applyGeometryOverrides(area, derivedGeometry(area));
}

/** The geometry from the dimensions alone — what the strip shows as "calculated". */
export function derivedGeometry(area) {
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
 * Is this stored override a number the estimator typed? Null, undefined and
 * "" are "not overridden"; 0 IS an override — "no ceiling in this room" is a
 * statement, and the same rule resolveQuantity applies to a typed 0.
 */
export function isGeometryOverride(v) {
  return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
}

/**
 * The strip's edits over the derived figures.
 *
 * A vaulted ceiling, a wall of glass, a room the wheel measured differently
 * from the tape: the estimator types over the figure and every substrate that
 * reads it follows. A single wall (`wall` / `surface`) still refuses a ceiling
 * or a floor — an override there is ignored, not honoured, because there is
 * no room for it to be the ceiling of.
 */
export function applyGeometryOverrides(area, geometry) {
  const closed = !(area?.measurement === "wall" || area?.measurement === "surface");
  const out = { ...geometry };
  for (const field of Object.keys(PAINT_GEOMETRY_OVERRIDES)) {
    if (!closed && (field === "ceilingSqft" || field === "floorSqft")) continue;
    const v = area?.[PAINT_GEOMETRY_OVERRIDES[field]];
    if (isGeometryOverride(v)) out[field] = money(positive(v));
  }
  return out;
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

/**
 * The rate a line prices at: from the set by `rateKey`, or the line's own
 * inline `rate` (a custom rate the estimator wrote and did not — or could
 * not — save to the set). A rate that names a different substrate is
 * ignored rather than applied: "16 ft walls" on a ceiling row is a stored
 * mistake, and the substrate's own figure is the honest fallback.
 */
function resolveRate(row, def, rateSet) {
  const fromSet = own(rateSet?.rates, row?.rateKey);
  if (fromSet && typeof fromSet === "object" && fromSet.hidden !== true) {
    if (fromSet.substrate === row.key || fromSet.substrate === "any" || row.key === "custom") {
      return { key: row.rateKey, ...fromSet };
    }
  }
  const inline = row?.rate;
  if (inline && typeof inline === "object" && !Array.isArray(inline)) {
    return { key: null, ...inline, inline: true };
  }
  return null;
}

/** The products a line consumes — one for paint, two for stain + clear. */
function resolveProducts(row, def) {
  if (row?.noProduct === true) return [];
  const rowList = Array.isArray(row?.products) ? row.products : null;
  const defList = Array.isArray(def.products) ? def.products : null;
  const source = rowList && rowList.length ? rowList : defList;
  if (source) {
    const out = [];
    for (const entry of source) {
      if (!entry || typeof entry !== "object") continue;
      if (typeof entry.productKey !== "string" || !entry.productKey) continue;
      out.push({
        productKey: entry.productKey,
        coats: clampCoats(entry.coats, def.coats),
      });
    }
    // The row's `coats` and `productKey` still steer the FIRST product, so
    // a takeoff written before multi-product lines existed reads the same.
    if (out.length && !rowList) {
      if (typeof row?.productKey === "string" && row.productKey) {
        out[0] = { ...out[0], productKey: row.productKey };
      }
      if (row?.coats !== undefined && row?.coats !== null) {
        out[0] = { ...out[0], coats: clampCoats(row.coats, out[0].coats) };
      }
    }
    return out;
  }
  const productKey =
    (typeof row?.productKey === "string" && row.productKey) || def.productKey;
  if (!productKey) return [];
  return [{ productKey, coats: clampCoats(row?.coats, def.coats) }];
}

/** The book's definition of a substrate, with the line's own edits over it. */
function resolveSubstrate(row, book, rateSet = null) {
  const def = own(book?.substrates, row?.key);
  if (!def) return null;
  const rate = resolveRate(row, def, rateSet);
  const flat = rate?.basis === "flat";
  const products = resolveProducts(row, def);
  return {
    key: row.key,
    def,
    label: String(row?.label || def.label || row.key),
    // A custom line names its own unit; every other substrate's is the book's.
    unit:
      row.key === "custom" && typeof row?.unit === "string" && row.unit
        ? row.unit
        : def.unit || "each",
    // Coats is a per-line choice (1/2/3) — the estimator's, over the book's.
    // For a multi-product line it is the FIRST product's; see `products`.
    coats: products.length ? products[0].coats : clampCoats(row?.coats, def.coats),
    products,
    prepHours: positive(row?.prepHours),
    // The rate wins over the book's figure; absence is not zero. A flat rate
    // with no hours of its own schedules at the substrate's rate-card hours,
    // so a per-square-foot wall still reaches the crew calendar and the cost
    // panel with a duration on it.
    productionRate: positive(rate?.productionRate) || positive(def.productionRate),
    hoursPerUnit: positive(rate?.hoursPerUnit) || positive(def.hoursPerUnit),
    rateBasis: def.rateBasis === "item" ? "item" : "production",
    basis: flat ? "flat" : "production",
    sellPerUnit: flat ? positive(rate?.sellPerUnit) : 0,
    rateKey: rate?.key || null,
    rateLabel: rate ? String(rate.label || "") : null,
    rateInline: rate?.inline === true,
    sqftPerUnit: positive(def.sqftPerUnit),
    driver: typeof row?.driver === "string" ? row.driver : def.driver,
    // "No product" HIDES the product and SKIPS the material cost. It does not
    // set it to zero. An absent material and a free material are different
    // claims — the first says nobody is supplying paint for this line (the
    // client's own paint, a substrate that only gets sanded), the second says
    // the paint is free. The totals report them separately for that reason.
    noProduct: row?.noProduct === true || products.length === 0,
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
 * The paint one line consumes: per product, gallons and money.
 *
 * `products` is a list because a stained door drinks stain AND clear coat.
 * Each product's gallons are quantity × sqftPerUnit × ITS coats ÷ ITS
 * coverage — the second coat costs exactly as much paint as the first (see
 * the note on PAINT_SUBSTRATE_DEFAULTS), and two products never pool.
 */
function priceMaterials({ quantity, sqftPerUnit, products, book, roundsUp, markup }) {
  const materials = [];
  let material = null;
  let unpriced = false;
  let unpricedCount = 0;
  for (const entry of products) {
    const product = own(book.products, entry.productKey);
    if (!product) continue;
    const coverage = positive(product.coverageSqftPerGal);
    const coatingSqft = mul(quantity, sqftPerUnit, entry.coats);
    const raw = coverage > 0 ? finite(coatingSqft / coverage) : 0;
    let gallons = roundsUp ? Math.ceil(raw) : raw;
    if (!Number.isFinite(gallons)) gallons = 0;
    let cost = null;
    let thisUnpriced = false;
    if (product.costPerGal === null || product.costPerGal === undefined) {
      // Quantity known, price not. Counted, never costed at zero.
      thisUnpriced = gallons > 0;
      if (thisUnpriced) {
        unpriced = true;
        unpricedCount += 1;
      }
    } else {
      const c = mul(gallons, positive(product.costPerGal));
      cost = money(mul(c, 1 + Math.max(-100, markup) / 100));
      material = money(finite(material) + cost);
    }
    materials.push({
      productKey: entry.productKey,
      label: product.label || entry.productKey,
      coats: entry.coats,
      gallons,
      coatingSqft,
      material: cost,
      unpriced: thisUnpriced,
    });
  }
  return { materials, material, unpriced, unpricedCount };
}

/**
 * The hourly SELL rate an area bills at.
 *
 * Per quote, then per area, then the estimate type's rate set — its exterior
 * figure for an exterior area when it states one — and, with no type (a
 * takeoff from before types existed), the book's $85 / $80 by surface. His
 * two jobs are $85 interior and $80 exterior, and an exterior area under an
 * interior quote must still carry the exterior rate.
 */
function areaHourlyRate(rawArea, surface, book, rateSet, opts) {
  const fromSet =
    surface === "exterior"
      ? positive(rateSet?.exteriorHourlySellRate) || positive(rateSet?.hourlySellRate)
      : positive(rateSet?.hourlySellRate);
  return (
    positive(opts.hourlySellRate) ||
    positive(rawArea.hourlySellRate) ||
    fromSet ||
    (surface === "exterior"
      ? positive(book.exteriorHourlySellRate) || positive(book.hourlySellRate)
      : positive(book.hourlySellRate))
  );
}

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
 * ── Per-area OPTIONS ────────────────────────────────────────────────────────
 *
 * `area.options[]` are offers the homeowner can tick that are not a whole
 * substrate: an extra coat (repriced here — one more coat of paint through
 * coverage, plus `extraCoatHoursPct` of the line's hours), a premium paint
 * (the product swapped, the delta in paint cost) or a custom line the
 * estimator priced by hand. A typed `amount` on any of them wins over the
 * computed figure. They join the optional areas and substrates in
 * paintOptionalExtras() and reach the client through the same QuoteAddOn
 * rows, so the browser still posts ids only (non-negotiable #5).
 *
 * @param {object} config  the stored takeoff — { estimateType, areas: [...] }
 * @param {object} book    PAINT_TAKEOFF_DEFAULTS, merged with company overrides
 * @param {object} [opts]
 * @param {number} [opts.hourlySellRate]  overrides the book's, per quote
 * @returns {object} areas, totals, purchase list, options, and what was left out
 */
export function paintTakeoff(config, book, opts = {}) {
  const b = book || PAINT_TAKEOFF_DEFAULTS;
  const markup = finite(b.materialMarkupPct);
  const decimals = b.hoursDisplayDecimals;
  const totalDecimals =
    b.totalHoursDisplayDecimals === undefined
      ? decimals
      : b.totalHoursDisplayDecimals;
  const estimateType = estimateTypeOf(config);
  const rateSet = rateSetFor(b, estimateType);
  const extraCoatPct = Math.min(500, positive(b.extraCoatHoursPct));

  const areas = [];
  const optionalAreas = [];
  const optionalSubstrates = [];
  const options = [];
  // Fractional gallons per product, for the buy list. Object.create(null) so a
  // product key of "__proto__" out of stored JSON lands in the map instead of
  // rewriting the prototype chain.
  const gallonsByProduct = Object.create(null);
  // Square feet of COATING per product — quantity × sqftPerUnit × coats,
  // before coverage divides it. The purchase list carries it so a job can be
  // asked afterwards "the book said 350 sqft a gallon; what did this one
  // actually get?" — lib/costing/materialCalibration.js needs the numerator
  // the gallons came from, and nothing else preserves it.
  const coatingSqftByProduct = Object.create(null);

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
      typeof rawArea.surface === "string" &&
      ["interior", "exterior", "cabinets", "staining"].includes(rawArea.surface)
        ? rawArea.surface
        : areaType?.surface || "interior";

    const rate = areaHourlyRate(rawArea, surface, b, rateSet, opts);

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
    let areaPrep = 0;

    // The area's own extra prep — masking a furnished room, papering a floor —
    // is labour with no substrate and no paint behind it. It bills at the same
    // hourly sell rate, which is what the owner asked for.
    const areaPrepHours = positive(rawArea.prepHours);
    if (areaPrepHours > 0) {
      const amount = money(mul(areaPrepHours, rate));
      areaHours += areaPrepHours;
      areaPrep += areaPrepHours;
      areaLabour = money(areaLabour + amount);
      lines.push({
        kind: "prep",
        key: "__prep",
        label: `${label} — additional prep`,
        unit: "hour",
        quantity: areaPrepHours,
        hours: areaPrepHours,
        workHours: 0,
        prepHours: areaPrepHours,
        displayHours: displayHours(areaPrepHours, decimals),
        labour: amount,
        gallons: null,
        material: null,
        materials: [],
        noProduct: true,
        optional: false,
        amount,
      });
    }

    const substrateRows = asArray(rawArea.substrates);
    for (let rowIndex = 0; rowIndex < substrateRows.length; rowIndex += 1) {
      const row = substrateRows[rowIndex];
      const sub = resolveSubstrate(row, b, rateSet);
      if (!sub) continue;

      const quantity = resolveQuantity(sub, geometry, row);

      const workHours =
        sub.rateBasis === "item"
          ? mul(quantity, sub.hoursPerUnit)
          : sub.productionRate > 0
            ? finite(quantity / sub.productionRate)
            : 0;
      const hours = finite(workHours + sub.prepHours);

      // A flat rate sells the quantity at its own price and the prep at the
      // hourly rate; a production rate sells the hours. Either way the hours
      // are kept for the crew calendar and the cost panel.
      const labour =
        sub.basis === "flat"
          ? money(mul(quantity, sub.sellPerUnit) + mul(sub.prepHours, rate))
          : money(mul(hours, rate));

      // Nothing measured and nothing to prep is not a line. A $0.00 row on a
      // client's quote reads as a promise of free work.
      if (hours <= 0 && quantity <= 0) continue;
      if (sub.key === "custom" && labour <= 0 && sub.products.length === 0) continue;

      // ── Materials ──
      const roundsUp =
        sub.roundGallonsUp === null ? areaRoundsUp : sub.roundGallonsUp;
      const priced = priceMaterials({
        quantity,
        sqftPerUnit: sub.sqftPerUnit,
        products: sub.products,
        book: b,
        roundsUp,
        markup,
      });
      // Counted per LINE, not per product: a stained door with an unpriced
      // stain and an unpriced clear coat is one line the warning names.
      if (priced.unpriced) unpricedCount += 1;

      if (!areaOptional && !sub.optional) {
        for (const m of priced.materials) {
          if (m.gallons <= 0) continue;
          gallonsByProduct[m.productKey] = finite(
            (gallonsByProduct[m.productKey] || 0) + m.gallons,
          );
          coatingSqftByProduct[m.productKey] = finite(
            (coatingSqftByProduct[m.productKey] || 0) + m.coatingSqft,
          );
        }
      }

      const primary = priced.materials[0] || null;
      const amount = money(labour + finite(priced.material));

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
        workHours,
        displayHours: displayHours(hours, decimals),
        labour,
        // null, not 0. "No product" and "an unpriced product" both mean
        // nobody has said what the paint costs; 0 would mean it is free.
        // `gallons` and `productKey` are the FIRST product's, for every
        // reader written when a line had one; `materials` has them all.
        gallons: primary ? primary.gallons : null,
        material: priced.material,
        materials: priced.materials,
        noProduct: sub.noProduct,
        unpriced: priced.unpriced,
        productKey: primary ? primary.productKey : null,
        optional: sub.optional,
        // INTERNAL ONLY — see paintFormula(). Never reaches a client surface.
        showFormula: sub.showFormula,
        rateBasis: sub.rateBasis,
        basis: sub.basis,
        rate: sub.rateBasis === "item" ? sub.hoursPerUnit : sub.productionRate,
        sellPerUnit: sub.sellPerUnit,
        rateKey: sub.rateKey,
        rateLabel: sub.rateLabel,
        rateInline: sub.rateInline,
        hourlySellRate: rate,
        prepHours: sub.prepHours,
        sqftPerUnit: sub.sqftPerUnit,
        amount,
      };

      if (areaOptional || sub.optional) {
        if (!areaOptional)
          optionalSubstrates.push({ area: label, areaIndex, ...item });
      } else {
        areaHours = finite(areaHours + hours);
        areaPrep = finite(areaPrep + sub.prepHours);
        areaLabour = money(areaLabour + labour);
        areaMaterial = money(areaMaterial + finite(priced.material));
      }
      lines.push(item);
    }

    // ── The area's options ──
    const areaOptions = [];
    const rawOptions = asArray(rawArea.options);
    for (let optionIndex = 0; optionIndex < rawOptions.length; optionIndex += 1) {
      const priced = priceOption(rawOptions[optionIndex], {
        lines,
        substrateRows,
        book: b,
        rateSet,
        rate,
        geometry,
        areaRoundsUp,
        markup,
        extraCoatPct,
      });
      if (!priced) continue;
      const record = { index: optionIndex, area: label, areaIndex, ...priced };
      areaOptions.push(record);
      if (!areaOptional) options.push(record);
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
      derived: derivedGeometry(rawArea),
      hourlySellRate: rate,
      optional: areaOptional,
      roundGallonsUp: areaRoundsUp,
      // Internal, work-order only. Never rendered on a client surface —
      // ScopeGroupsSection and lib/email/quoteSections read `description` and
      // `amount` and nothing else.
      crewNote: String(rawArea.crewNote || ""),
      // Printed under the area's first line on the document (buildPaintAreas
      // in lib/pricing/tradeScope.js), and the detail of the offer when the
      // area is optional.
      clientNote: String(rawArea.clientNote || ""),
      media: asArray(rawArea.media).filter((m) => m && typeof m === "object"),
      lines,
      options: areaOptions,
      hours: areaHours,
      prepHours: areaPrep,
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
        // The numerator and the divisor behind `gallons`, for calibration.
        coatingSqft: Math.round(finite(coatingSqftByProduct[key]) * 100) / 100,
        coverageSqftPerGal: positive(product?.coverageSqftPerGal),
      };
    })
    .filter((p) => p.gallons > 0)
    .sort((a, b2) => a.productKey.localeCompare(b2.productKey));

  const total = money(includedLabour + includedMaterial);

  return {
    estimateType,
    rateSet: rateSet
      ? { label: String(rateSet.label || estimateType), hourlySellRate: positive(rateSet.hourlySellRate) }
      : null,
    areas,
    // Priced, but NOT in the total. They only become money if the client ticks
    // them — see paintOptionalExtras() and the QuoteAddOn rows it feeds.
    optionalAreas,
    optionalSubstrates,
    options,
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

/** The option kinds an area can carry. */
export const PAINT_OPTION_KINDS = Object.freeze(["extra_coat", "premium_paint", "custom"]);

/**
 * One option on an area, priced.
 *
 * Returns null for an option that cannot be understood (an unknown kind, an
 * extra coat on a row that no longer exists). Returns `amount: null` for one
 * that is understood but has no price yet — a premium paint nobody has priced
 * — so the screen can say so; paintOptionalExtras() leaves those out, since
 * an offer with no price is not an offer.
 */
function priceOption(raw, ctx) {
  if (!raw || typeof raw !== "object") return null;
  const kind = PAINT_OPTION_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  const typed = raw.amount;
  const custom =
    typed !== null && typed !== undefined && typed !== "" && Number.isFinite(Number(typed));
  const detail = typeof raw.detail === "string" && raw.detail.trim() ? raw.detail.trim() : null;

  if (kind === "custom") {
    const amount = custom ? money(positive(typed)) : null;
    return {
      kind,
      label: String(raw.label || "Option"),
      detail,
      amount,
      computedAmount: null,
      custom: amount !== null,
      unpriced: amount === null,
      hours: 0,
    };
  }

  // The line this option modifies — by stored row index, the same pairing
  // the form uses. A line that produced no price (nothing measured) has no
  // option either.
  const rowIndex = Math.trunc(finite(raw.substrateIndex));
  const line = ctx.lines.find((l) => l.kind === "substrate" && l.rowIndex === rowIndex);
  if (!line || line.optional) return null;
  const row = ctx.substrateRows[rowIndex];
  const sub = resolveSubstrate(row, ctx.book, ctx.rateSet);
  if (!sub) return null;
  const roundsUp = sub.roundGallonsUp === null ? ctx.areaRoundsUp : sub.roundGallonsUp;

  if (kind === "extra_coat") {
    // One more coat of the line's FIRST product through coverage, plus the
    // set share of the line's work hours at the area's hourly rate.
    const primary = sub.products[0] || null;
    const paint = primary
      ? priceMaterials({
          quantity: line.quantity,
          sqftPerUnit: sub.sqftPerUnit,
          products: [{ productKey: primary.productKey, coats: 1 }],
          book: ctx.book,
          roundsUp,
          markup: ctx.markup,
        })
      : { material: null, unpriced: false, materials: [] };
    const hours = finite(mul(line.workHours, ctx.extraCoatPct / 100));
    const labour = money(mul(hours, ctx.rate));
    const computed = money(labour + finite(paint.material));
    const amount = custom ? money(positive(typed)) : computed;
    return {
      kind,
      label: String(raw.label || `Extra coat on ${line.label.toLowerCase()}`),
      detail,
      substrateIndex: rowIndex,
      amount,
      computedAmount: computed,
      custom,
      unpriced: !custom && paint.unpriced,
      hours,
      labour,
      material: paint.material,
      gallons: paint.materials[0]?.gallons ?? null,
    };
  }

  // premium_paint: the product swapped, the delta in paint money. No labour —
  // a better paint goes on at the same rate.
  const productKey = typeof raw.productKey === "string" ? raw.productKey : null;
  const product = own(ctx.book.products, productKey);
  if (!product) return null;
  const primary = sub.products[0] || null;
  const swapped = primary
    ? priceMaterials({
        quantity: line.quantity,
        sqftPerUnit: sub.sqftPerUnit,
        products: [{ productKey, coats: primary.coats }],
        book: ctx.book,
        roundsUp,
        markup: ctx.markup,
      })
    : null;
  const unpriced = !swapped || swapped.unpriced || swapped.material === null;
  const delta = unpriced ? null : money(swapped.material - finite(line.materials[0]?.material));
  const computed = delta === null ? null : Math.max(0, delta);
  const amount = custom ? money(positive(typed)) : computed;
  return {
    kind,
    label: String(raw.label || `Premium paint upgrade (${product.label || productKey})`),
    detail,
    substrateIndex: rowIndex,
    productKey,
    amount,
    computedAmount: computed,
    custom,
    unpriced: !custom && unpriced,
    hours: 0,
    gallons: swapped?.materials[0]?.gallons ?? null,
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
  if (line.basis === "flat") {
    const prepPart = prep > 0 ? ` + ${prep} h prep × $${sell.toFixed(2)}/hr` : "";
    return `${q} ${line.unit} × $${finite(line.sellPerUnit).toFixed(2)}/${line.unit}${prepPart} = $${finite(line.labour).toFixed(2)} (${line.displayHours} h)`;
  }
  const basis =
    line.rateBasis === "item"
      ? `${q} × ${rate} h`
      : `${q} ${line.unit} ÷ ${rate} ${line.unit}/hr`;
  const prepPart = prep > 0 ? ` + ${prep} h prep` : "";
  return `${basis}${prepPart} = ${line.displayHours} h × $${sell.toFixed(2)}/hr = $${line.labour.toFixed(2)}`;
}

/**
 * How many offers a takeoff may put in front of a client.
 *
 * The add-ons editor caps its own list at 8 because a foot-of-quote shopping
 * list longer than that is a second quote. Per-area options are not that
 * list: they draw UNDER the room they belong to (areaLabel below), three or
 * four to a room, and a six-room house with an extra coat and a ceiling on
 * offer in each is a normal quote, not a shopping list. 40 is the point past
 * which it is one again.
 */
export const PAINT_OPTIONAL_EXTRAS_CAP = 40;

/**
 * The optional areas, substrates and per-area options, as offers a client can tick.
 *
 * These are the ONLY thing that makes the "optional" checkboxes honest. An
 * optional line is left out of the group's priced scope entirely and comes back
 * as a QuoteAddOn row — the existing, server-repriced mechanism, where the
 * browser posts ids and the server reads the amount off its own rows (see
 * app/api/public/quotes/[token]/route.js). Ticking one changes the total on the
 * document the client signs, which is the only definition of "works" that
 * counts.
 *
 * `areaLabel` and `areaIndex` say which room an offer belongs under, so the
 * client's page can draw it beside the room rather than in one list at the
 * foot. `kind` says what it is. Neither carries a rate.
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
      areaLabel: area.label,
      areaIndex: area.index,
      kind: "area",
    });
  }
  for (const sub of result.optionalSubstrates) {
    if (sub.amount <= 0) continue;
    extras.push({
      description: `${sub.area} — ${sub.label}`,
      detail: null,
      amount: sub.amount,
      areaLabel: sub.area,
      areaIndex: sub.areaIndex,
      kind: "substrate",
    });
  }
  for (const o of result.options) {
    if (o.amount === null || o.amount <= 0) continue;
    extras.push({
      description: `${o.area} — ${o.label}`,
      detail: o.detail,
      amount: o.amount,
      areaLabel: o.area,
      areaIndex: o.areaIndex,
      kind: o.kind,
    });
  }
  return extras.slice(0, PAINT_OPTIONAL_EXTRAS_CAP);
}

/* ── Blanks ────────────────────────────────────────────────────────────── */

/**
 * A blank substrate line for an area.
 *
 * `rateKey` is the substrate's own default rate in the type's set when the
 * set has one — the row then says which situation it is priced at, and the
 * picker opens on it. With no type there is no set and no key, and the row
 * prices off the substrate exactly as it always did.
 */
export function newPaintSubstrate(key, book = PAINT_TAKEOFF_DEFAULTS, { estimateType = null } = {}) {
  const def = own(book?.substrates, key);
  if (!def) return null;
  const rateSet = rateSetFor(book, estimateType);
  const defaultRate = own(rateSet?.rates, key);
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
    ...(Array.isArray(def.products)
      ? { products: def.products.map((p) => ({ ...p })) }
      : {}),
    noProduct: !def.productKey && !Array.isArray(def.products),
    optional: false,
    showFormula: false,
    roundGallonsUp: null,
    rateKey: defaultRate && defaultRate.hidden !== true ? key : null,
    rate: null,
  };
}

/** A blank area. */
export function newPaintArea(areaType = "den", book = PAINT_TAKEOFF_DEFAULTS, { estimateType = null } = {}) {
  const def = own(book?.areaTypes, areaType);
  const type = estimateType ? own(PAINT_ESTIMATE_TYPES, estimateType) : null;
  // The area's surface follows the estimate type, not the room: a kitchen
  // under Staining is a staining area. With no type it is the room's.
  const surface =
    type && def && areaTypeSurfaces(def).includes(type.defaultSurface)
      ? type.defaultSurface
      : type?.defaultSurface || def?.surface || "interior";
  return {
    areaType: def ? areaType : "den",
    label: def?.label || "Area",
    surface,
    measurement: "area",
    // No seeded dimensions. See the note on PAINT_AREA_TYPE_DEFAULTS: a room
    // type is a name, not a measurement.
    lengthFt: 0,
    widthFt: 0,
    heightFt: 0,
    linearFt: 0,
    surfaceSqft: 0,
    linearFtOverride: null,
    wallSqftOverride: null,
    ceilingSqftOverride: null,
    floorSqftOverride: null,
    prepHours: 0,
    optional: false,
    roundGallonsUp: null,
    crewNote: "",
    clientNote: "",
    substrates: [],
    options: [],
    media: [],
  };
}

/** A blank per-area option. */
export function newPaintOption(kind, patch = {}) {
  const k = PAINT_OPTION_KINDS.includes(kind) ? kind : "custom";
  return {
    kind: k,
    label: "",
    detail: "",
    substrateIndex: null,
    productKey: null,
    amount: null,
    ...patch,
  };
}

/* ── The rate card's boundary ──────────────────────────────────────────── */
//
// A company's painting overrides ride on CompanyServiceCategory.rates under
// `takeoff` (getPriceBook deep-merges them over PAINT_TAKEOFF_DEFAULTS), and
// they arrive from a browser. lib/pricing/sanitiseRates.js keeps only the
// numeric paths PRICE_BOOK_FIELDS declares; a rate set is a structure, not a
// number, so it comes through here instead. Everything not listed is dropped;
// every key is checked against a pattern before it can become a property on
// the pricing model, for the reason on `own` at the top of this file.

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const SURFACES = ["interior", "exterior", "cabinets", "staining", "any"];

const cleanText = (v, max) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const cleanNumber = (v, max = 1e6) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(max, n);
};

/**
 * One rate, as the card or the builder's "Create custom rate" sends it.
 * Returns null when it is not a rate. `hidden: true` alone is a valid
 * override — it retires a default rate from the picker without deleting
 * anything.
 */
export function sanitisePaintRate(input, substrates = PAINT_SUBSTRATE_DEFAULTS) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (input.hidden === true) return { hidden: true };
  const substrate = cleanText(input.substrate, 48);
  if (substrate !== "any" && !own(substrates, substrate)) return null;
  const basis = input.basis === "flat" ? "flat" : "production";
  const out = {
    label: cleanText(input.label, 80),
    situation: cleanText(input.situation, 160),
    substrate,
    basis,
    provenance: "custom",
  };
  if (!out.label) return null;
  // A rate's figure must be POSITIVE. 0 sqft/hr is not a rate, and $0 per
  // square foot is free work with a name on it; either would fall through to
  // the substrate's figure in the engine and price at a number the card does
  // not show. Rejected here so it never reaches storage.
  const figure = (v, max) => {
    const n = cleanNumber(v, max);
    return n === undefined || n <= 0 ? undefined : n;
  };
  const productionRate = figure(input.productionRate);
  const hoursPerUnit = figure(input.hoursPerUnit, 1000);
  const sellPerUnit = figure(input.sellPerUnit);
  if (productionRate !== undefined) out.productionRate = productionRate;
  if (hoursPerUnit !== undefined) out.hoursPerUnit = hoursPerUnit;
  if (basis === "flat") {
    if (sellPerUnit === undefined) return null;
    out.sellPerUnit = sellPerUnit;
  } else if (productionRate === undefined && hoursPerUnit === undefined) {
    return null;
  }
  if (input.hidden === false) out.hidden = false;
  return out;
}

/**
 * The whole `takeoff` override subtree, sanitised. Returns null when nothing
 * survives, which stores as "this company has not customised anything".
 */
export function sanitisePaintTakeoffOverrides(input, defaults = PAINT_TAKEOFF_DEFAULTS) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};

  for (const field of ["materialMarkupPct", "extraCoatHoursPct", "depositPct"]) {
    const n = cleanNumber(input[field], field === "depositPct" ? 100 : 500);
    if (n !== undefined) out[field] = n;
  }
  if (input.roundGallonsUp === true || input.roundGallonsUp === false) {
    out.roundGallonsUp = input.roundGallonsUp;
  }

  const sets = input.rateSets;
  if (sets && typeof sets === "object" && !Array.isArray(sets)) {
    const rateSets = {};
    for (const type of Object.keys(PAINT_ESTIMATE_TYPES)) {
      const set = own(sets, type);
      if (!set || typeof set !== "object" || Array.isArray(set)) continue;
      const cleaned = {};
      const hourly = cleanNumber(set.hourlySellRate, 10000);
      const exteriorHourly = cleanNumber(set.exteriorHourlySellRate, 10000);
      if (hourly !== undefined) cleaned.hourlySellRate = hourly;
      if (exteriorHourly !== undefined) cleaned.exteriorHourlySellRate = exteriorHourly;
      const rates = set.rates;
      if (rates && typeof rates === "object" && !Array.isArray(rates)) {
        const cleanRates = {};
        for (const key of Object.keys(rates)) {
          if (!KEY_RE.test(key)) continue;
          const rate = sanitisePaintRate(own(rates, key), defaults.substrates);
          if (rate) cleanRates[key] = rate;
        }
        if (Object.keys(cleanRates).length) cleaned.rates = cleanRates;
      }
      if (Object.keys(cleaned).length) rateSets[type] = cleaned;
    }
    if (Object.keys(rateSets).length) out.rateSets = rateSets;
  }

  const products = input.products;
  if (products && typeof products === "object" && !Array.isArray(products)) {
    const cleanProducts = {};
    for (const key of Object.keys(products)) {
      if (!KEY_RE.test(key)) continue;
      const p = own(products, key);
      if (!p || typeof p !== "object" || Array.isArray(p)) continue;
      const known = own(defaults.products, key);
      const cleaned = {};
      const cost = cleanNumber(p.costPerGal, 10000);
      const coverage = cleanNumber(p.coverageSqftPerGal, 100000);
      const label = cleanText(p.label, 80);
      if (cost !== undefined) cleaned.costPerGal = cost;
      if (coverage !== undefined && coverage > 0) cleaned.coverageSqftPerGal = coverage;
      if (label && (!known || label !== known.label)) cleaned.label = label;
      if (!known) {
        // A product the company added. It needs a name and a coverage to
        // produce gallons at all; a cost may follow later.
        if (!label || cleaned.coverageSqftPerGal === undefined) continue;
        cleaned.surface = SURFACES.includes(p.surface) ? p.surface : "any";
        cleaned.provenance = "custom";
        if (cleaned.costPerGal === undefined) cleaned.costPerGal = null;
        const premiumFor = cleanText(p.premiumFor, 48);
        if (premiumFor && own(defaults.products, premiumFor)) cleaned.premiumFor = premiumFor;
      }
      if (Object.keys(cleaned).length) cleanProducts[key] = cleaned;
    }
    if (Object.keys(cleanProducts).length) out.products = cleanProducts;
  }

  return Object.keys(out).length ? out : null;
}
