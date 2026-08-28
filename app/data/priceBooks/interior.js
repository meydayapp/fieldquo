// app/data/priceBooks/interior.js
//
// Six interior/finishing trades that had no way to price themselves, plus the
// COST side for two that could already price and could not cost.
//
// Staged here rather than written straight into app/data/tradePriceBooks.js,
// app/data/materialRecipes.js and app/data/standardAddOns.js because five other
// agents are in those files this session. Every export below is keyed to be
// spread into its destination unchanged. Nothing here is imported by product
// code yet — see "Wiring" at the bottom for the four one-line merges and the
// two integration points that are NOT one-liners.
//
// ══ What was actually missing, which is not what the brief said ════════════
//
// The brief said fourteen of sixteen books are empty and tradeIsPricedByDefault
// returns true for all of them. Neither is true of this tree. All sixteen books
// are populated, and tradeIsPricedByDefault is FALSE for the 48 catalogue
// trades with no book — it is derived from hasPriceBook, so it cannot claim a
// book that isn't there. The blank-screen failure it describes does not exist.
//
// What does exist, measured against lib/trades/catalog.js:
//
//   16 of 68 trades have a price book. 4 more have an opening hourly rate.
//   48 have neither, and this file closes six of them.
//   2 material recipes exist in the entire product. This file adds eight.
//
// So the six trades below are genuinely unpriced, and the recipes are the
// bigger of the two contributions.
//
// ══ Three trades in the brief that must NOT be rewritten ═══════════════════
//
//   interior_painting  Has a book (complexity grid + roomTypes), shares
//                      PAINT_TAKEOFF_DEFAULTS with exterior_painting, and has
//                      seven DEFAULT_LINE_ITEMS. It cannot cost a job, because
//                      MATERIAL_RECIPES has no `interior_painting` key. That
//                      gap is closed below and NOTHING in the book is touched.
//   flooring           Same shape: "Hardwood Floor Refinishing", a full
//                      complexity grid, six line items, no recipe. Recipe only.
//                      The brief's "LVP, laminate, hardwood, tile" is INSTALL
//                      work, which is `flooring_install` and `tiling` — two
//                      different catalogue keys that really are empty.
//   insulation         Untouched, entirely. Its book already carries R-values,
//                      per-point-of-R rates cross-checked against eight
//                      published Toronto figures, materialCosts read off Home
//                      Depot Canada, and INSULATION_LABOUR_DEFAULTS. There is
//                      no gap to fill and a second opinion on it would be a
//                      contradiction, not an improvement.
//
// ══ TRADE_PRICE_BOOKS.items vs DEFAULT_LINE_ITEMS ══════════════════════════
//
// Asked directly: two deliberately separate layers, and they should stay that
// way — but only one of them is allowed to carry a rate.
//
//   `items[]` on a book is the SCOPE the estimator measures. Each entry names a
//   `priceType` that indexes into the complexity grid, so its number moves when
//   the tier moves. It is an input to arithmetic.
//
//   DEFAULT_LINE_ITEMS is a list of CHIPS. defaultLineItems.js states the rule
//   in its header — "prices are deliberately absent", `rate: null` on almost
//   everything, because a plausible default lands on a document a homeowner
//   signs. It is a reminder of what to bill, not a calculation.
//
// They overlap in wording (both painting layers say "Fascia boards") and they
// must not be merged, because merging means one of two regressions: either the
// chips gain rates and defaultLineItems.js's rule is broken, or the book's
// items lose their priceType and the complexity grid stops reaching them.
//
// The convergence that IS right is the one electricalCatalog.js already found:
// point at a line by a stable key, never by its description string. This file
// does the interim version — `lineItemCosts` keyed by the EXACT description
// text now in DEFAULT_LINE_ITEMS, asserted character-for-character by
// scripts/check-pricebook-interior.mjs so a reworded chip fails the check
// instead of silently orphaning its costing. The permanent fix is to give the
// painting and flooring chips a `key` the way the electrical ones have one; see
// "Wiring" below. That is a product decision on someone else's file, so it is
// reported rather than taken.
//
// ══ Currency ═══════════════════════════════════════════════════════════════
//
//   SELL rates (the books) are CAD, single scalar. Two reasons, both hard.
//   PRICE_BOOK_FIELDS/readField/the rates screen all read a NUMBER at a
//   dot-path; a {usd, cad} object there is unreadable and unrenderable. And
//   every one of the sixteen books this merges beside is CAD (TrueFinish
//   Ottawa; the insulation costs are Home Depot Canada) — a currency-mixed
//   TRADE_PRICE_BOOKS is a silent five-figure error waiting on the first US
//   tenant. One currency per map, declared, is the safe shape.
//
//   COST figures (the recipes) carry BOTH, as separate explicit numbers,
//   reasoned per market. Never converted, in either direction.
//   app/data/electricalMaterials.js §3.10 is the precedent and the warning:
//   it measured CAD ≈ 1.24–1.31 × USD on two matched SKUs, then refused to
//   export the ratio, because at a live rate of 1.35–1.40 a naive `USD × FX`
//   overprices Canadian materials by 5–10%. The check script asserts that no
//   single ratio explains this file's pairs, which is what a converted set
//   would look like.
//
//   Where only one market has a figure I can stand behind, the other is null
//   with a `gap` string saying why. Same contract as `unpriced` in
//   electricalMaterials.js: a missing key reads as "we forgot", an empty price
//   reads as "nobody has this number".
//
// ══ PROVENANCE, stated once and plainly ════════════════════════════════════
//
// These are NOT retail reads. electricalMaterials.js can name a store, a city
// and a date; this file cannot, and pretending otherwise by writing $18.47
// where I mean "about eighteen dollars" would be the more dangerous lie.
//
// So every cost is a BAND — {low, typical, high} — at trade-typical precision,
// and every entry carries a `source` naming what kind of figure it is. A band
// says "this is a market, go check yours"; a point to the cent says "I read
// this off a shelf". Round numbers here are a signal, not laziness.
//
// The two exceptions, and they are the strongest numbers in the file: the
// interior paint costs are IMPORTED from lib/pricing/paintTakeoff.js rather
// than restated, because those were recovered to the cent from invoices the
// owner was paid on. The check reproduces one of his invoice lines — $122.71 of
// wall paint over 414 sqft — through this recipe. See PAINT_COST_CAD below.

import { PAINT_PRODUCT_DEFAULTS } from "@/lib/pricing/paintTakeoff";

/* ── Shapes ────────────────────────────────────────────────────────────── */

/**
 * A cost node. ALWAYS both keys. Each side is a {low, typical, high} band in
 * that market's own currency, or null beside a `gap` explaining the absence.
 *
 *   cost: { usd: { low, typical, high }, cad: { low, typical, high } }
 *   cost: { usd: { ... }, cad: null }, gap: "why the CAD side is empty"
 *
 * `typical` is what a cost engine should use. `low`/`high` are what a company
 * comparing its own invoice should expect to sit between.
 */
const band = (low, typical, high) => ({ low, typical, high });

/** A figure recovered to the cent: a point, not a range. Same idiom as
 *  electricalMaterials.js `breaker_1p_30a` — "One listing found." */
const point = (v) => ({ low: v, typical: v, high: v });

const SOURCE = {
  // What most of this file is. Named honestly rather than dressed up.
  TRADE: "Trade-typical band, Ontario/US residential 2026. NOT a retail read — no store, no date. Replace with your own supplier invoice.",
  RECOVERED:
    "RECOVERED from the owner's paid invoices via lib/pricing/paintTakeoff.js. Imported, not restated, so it cannot drift.",
  RENTAL:
    "Trade-typical day rate at a general tool-rental counter. A company that owns the machine should zero this and carry it as overhead instead.",
};

/* ── Paint: imported, never restated ───────────────────────────────────── */
//
// The owner's instruction was "for the paint use the current prices", and the
// current prices are three figures in PAINT_PRODUCT_DEFAULTS that reconcile his
// den invoice exactly: wall $51.87/gal, ceiling $30.61/gal, trim $47.83/gal.
// Reading them through the import is stronger than copying them: a copy is the
// thing that rots, and this one would rot silently into a margin panel.
//
// They are CAD (Ottawa). The USD bands beside them are a separate reasoning
// about a separate market — US big-box interior latex, contractor-grade
// through premium — and no arithmetic connects the two.
const PAINT_COST_CAD = {
  wall: PAINT_PRODUCT_DEFAULTS.wall_interior.costPerGal,
  ceiling: PAINT_PRODUCT_DEFAULTS.ceiling_flat.costPerGal,
  trim: PAINT_PRODUCT_DEFAULTS.trim_enamel.costPerGal,
};

/* ══ THE BOOKS ═════════════════════════════════════════════════════════════
 *
 * Spread into TRADE_PRICE_BOOKS. Shape matches exterior_painting exactly:
 * `label`, a `complexity` grid keyed by the three COMPLEXITY_LEVELS with a
 * `desc` that says what puts a job in that tier, and `items[]` whose
 * `priceType` indexes the grid (or "flat" + `flatPrice` for something a tier
 * does not move). Extras live under `extras.` so priceBookBasis excludes them
 * from what the trade is quoted BY.
 *
 * Every unit used below already exists in allPriceBookUnits() before this file
 * merges — sqft, linear ft, each, sheet. A trade that invents a synonym for a
 * unit another trade already has is the copy that rots; the check asserts it.
 */

export const INTERIOR_PRICE_BOOKS = {
  // ── Drywall — repair and finishing ────────────────────────────────────
  //
  // Two catalogue keys exist, `drywall` ("Drywall") and `drywall_install`
  // ("Drywall Installation"). Splitting them repair/new-work is the only
  // reading under which both earn their place, and it is how the trade sells:
  // a patch call and a basement board-out are different crews, different
  // minimums and different failure modes. FLAGGED as a product decision — if
  // the owner meant `drywall` as the umbrella, these two books collapse into
  // one and the repair rows become items on it.
  //
  // The number that decides whether this book is honest is not any rate, it is
  // `returnVisitHours` in the recipe. A patch is two visits, because the mud
  // has to dry overnight, and a repair quote that prices one visit loses the
  // second one every time.
  drywall: {
    label: "Drywall Repair & Finishing",
    complexity: {
      standard: {
        desc: "Empty or easily cleared room, flat 8–9 ft ceiling, paint-ready flat finish, one accessible work area",
        // A patch is priced by the size of the hole because that is what
        // decides whether it needs backing, a butt joint or a whole sheet.
        // Bands cross-checked against an Ottawa small-repair call at
        // $250–$450 all-in; standard sits at the bottom of that.
        smallPatchPrice: 225, // up to 6" — no backing, mesh and two coats
        mediumPatchPrice: 425, // 6" to 2 ft — wood backing, tape, three coats
        largePatchPrice: 750, // 2 ft to half a sheet — cut back to studs
        skimCoatPricePerSqft: 2.2, // full Level 5 skim over sound board
        textureMatchPricePerSqft: 3.0, // knockdown/orange peel blended to match
        // MATCHED DELIBERATELY to interior_painting.global
        // .popcornRemovalPricePerSqft, which is 3.50. Two books quoting the
        // same scrape at two prices is how a painter who also does drywall
        // ends up with two numbers on one job.
        popcornRemovalPricePerSqft: 3.5,
        callOutMinimum: 350,
      },
      moderate: {
        desc: "Occupied and furnished home, 9–10 ft or sloped ceiling, several rooms, texture or a sheen that shows every flaw",
        smallPatchPrice: 285,
        mediumPatchPrice: 525,
        largePatchPrice: 950,
        skimCoatPricePerSqft: 2.85,
        textureMatchPricePerSqft: 3.75,
        popcornRemovalPricePerSqft: 4.75,
        callOutMinimum: 425,
      },
      high: {
        desc: "Vaulted or over 12 ft needing staging, water or smoke damage of unknown extent, plaster rather than board, or a Level 5 under raking light",
        smallPatchPrice: 375,
        mediumPatchPrice: 700,
        largePatchPrice: 1250,
        skimCoatPricePerSqft: 3.75,
        textureMatchPricePerSqft: 4.75,
        popcornRemovalPricePerSqft: 6.5,
        callOutMinimum: 550,
      },
    },
    items: [
      {
        id: "small_patch",
        label: 'Patch — up to 6"',
        unit: "each",
        priceType: "smallPatchPrice",
      },
      {
        id: "medium_patch",
        label: 'Patch — 6" to 2 ft',
        unit: "each",
        priceType: "mediumPatchPrice",
      },
      {
        id: "large_patch",
        label: "Patch — 2 ft to half a sheet",
        unit: "each",
        priceType: "largePatchPrice",
      },
      {
        id: "skim_coat",
        label: "Skim coat — Level 5",
        unit: "sqft",
        priceType: "skimCoatPricePerSqft",
      },
      {
        id: "texture_match",
        label: "Texture match",
        unit: "sqft",
        priceType: "textureMatchPricePerSqft",
      },
      {
        id: "popcorn_removal",
        label: "Popcorn / stipple ceiling removal",
        unit: "sqft",
        priceType: "popcornRemovalPricePerSqft",
      },
      // Flat because a corner is a corner: the tier moves how hard it is to
      // reach, and reaching is already in the per-sqft rows.
      {
        id: "corner_repair",
        label: "Corner bead replacement",
        unit: "linear ft",
        priceType: "flat",
        flatPrice: 14,
      },
      {
        id: "nail_pops",
        label: "Nail / screw pops — refasten and refinish",
        unit: "each",
        priceType: "flat",
        flatPrice: 18,
      },
    ],
    extras: {
      // Dust containment is sold, not absorbed. A poly wall and a negative-air
      // machine is the difference between a repair and a whole-house clean.
      dustContainmentPrice: 275,
      // The second visit. Priced as its own line because the client can then
      // see why a $225 patch is not a one-hour job — see returnVisitHours.
      returnVisitPrice: 165,
      furnitureMovingPrice: 175,
    },
  },

  // ── Drywall — hang, tape and finish ───────────────────────────────────
  //
  // Priced per square foot OF BOARD, which is what the trade measures: sheets
  // are 4x8, 4x10 and 4x12 in the same house and a per-sheet rate cannot tell
  // them apart. Hanging and finishing are separate rows because they are
  // separately subcontracted — a GC routinely buys one without the other.
  //
  // ── The finish levels are GA-214, and they are the point of this book ────
  //
  // The Gypsum Association's levels are a real published standard, they are
  // what a spec calls out, and a contractor who is quoted "drywall finishing"
  // with no level named is being quoted nothing. What each level actually is:
  //
  //   Level 0  No taping, finishing or accessories. Temporary construction.
  //            NOT PRICED HERE — it is hung board, so it is the hang row with
  //            no finish row. A rate for "level 0 finishing" would be a rate
  //            for doing nothing, which is why the grid starts at 1.
  //   Level 1  Tape set in compound at joints and interior angles. Tool marks
  //            and ridges acceptable. Plenums, attics, service corridors.
  //   Level 2  Level 1 plus one separate coat over joints, angles, fasteners
  //            and accessories. Substrate for tile; garages, warehouses.
  //   Level 3  Tape plus two separate coats on joints and angles, one over
  //            fasteners. Under medium/heavy texture or heavy wall covering.
  //            Not for flat paint.
  //   Level 4  Tape plus three coats on joints, two over fasteners, sanded
  //            smooth. Flat paints, light texture, lightweight wall covering.
  //            THE RESIDENTIAL DEFAULT — this is what "paint ready" means.
  //   Level 5  Level 4 plus a skim coat of compound over the ENTIRE surface.
  //            Required for gloss, semi-gloss and enamel, and for severe
  //            lighting. The one level that is about light, not about paint.
  //
  // Rates: hang + Level 4 at standard is $2.65/sqft of board, or $85 per 4x8
  // sheet supplied and finished — inside the $70–$100/sheet an Ottawa
  // supply-and-install job lands at, and inside the $2.50–$3.50/sqft band for
  // the same work. Level 5 at $2.20 is a $0.75 premium over Level 4's $1.45,
  // a little over 50%; published L5 premiums run 40–70% of the finishing line.
  //
  // Assumes: two-hand crew, 8–9 ft flat ceilings, 4x12 board where it fits,
  // board delivered and stocked in the room, and the tier's own access. Not a
  // boxed production taper — see hoursPerSqft in the recipe, which says so.
  drywall_install: {
    label: "Drywall — Hang, Tape & Finish",
    complexity: {
      standard: {
        desc: "New construction or a gutted room, 8–9 ft flat ceilings, 4x12 board fits, board stocked in the room, no stairwell or lid over a stair",
        hangPricePerSqft: 1.2,
        finishLevel1PricePerSqft: 0.45,
        finishLevel2PricePerSqft: 0.75,
        finishLevel3PricePerSqft: 1.1,
        finishLevel4PricePerSqft: 1.45,
        finishLevel5PricePerSqft: 2.2,
        // Overhead work is slower and is a second pair of hands or a lift.
        // 0.45 on a $2.65 wall rate is ~17%; the trade's own rule of thumb is
        // that lids run 25–40% slower, and part of that is already in the
        // hang rate, which assumes some ceiling.
        ceilingUpchargePerSqft: 0.45,
        cornerBeadPricePerLf: 4.0,
      },
      moderate: {
        desc: "Occupied home needing protection, 9–10 ft or sloped ceilings, cut-up rooms and short walls, board carried up a flight",
        hangPricePerSqft: 1.55,
        finishLevel1PricePerSqft: 0.55,
        finishLevel2PricePerSqft: 0.95,
        finishLevel3PricePerSqft: 1.4,
        finishLevel4PricePerSqft: 1.85,
        finishLevel5PricePerSqft: 2.8,
        ceilingUpchargePerSqft: 0.65,
        cornerBeadPricePerLf: 5.25,
      },
      high: {
        desc: "Vaulted, coffered or over 12 ft needing staging or a lift, curved walls, fire-rated assemblies with inspected joints, or Level 5 under a wall of glass",
        hangPricePerSqft: 2.05,
        finishLevel1PricePerSqft: 0.7,
        finishLevel2PricePerSqft: 1.2,
        finishLevel3PricePerSqft: 1.8,
        finishLevel4PricePerSqft: 2.45,
        finishLevel5PricePerSqft: 3.7,
        ceilingUpchargePerSqft: 0.95,
        cornerBeadPricePerLf: 6.75,
      },
    },
    items: [
      {
        id: "hang",
        label: "Hang board",
        unit: "sqft",
        priceType: "hangPricePerSqft",
      },
      {
        id: "finish_l1",
        label: "Finish — Level 1 (tape only)",
        unit: "sqft",
        priceType: "finishLevel1PricePerSqft",
      },
      {
        id: "finish_l2",
        label: "Finish — Level 2 (tile substrate, garages)",
        unit: "sqft",
        priceType: "finishLevel2PricePerSqft",
      },
      {
        id: "finish_l3",
        label: "Finish — Level 3 (under texture)",
        unit: "sqft",
        priceType: "finishLevel3PricePerSqft",
      },
      {
        id: "finish_l4",
        label: "Finish — Level 4 (paint ready)",
        unit: "sqft",
        priceType: "finishLevel4PricePerSqft",
      },
      {
        id: "finish_l5",
        label: "Finish — Level 5 (skim coat, gloss or critical light)",
        unit: "sqft",
        priceType: "finishLevel5PricePerSqft",
      },
      {
        id: "ceiling_upcharge",
        label: "Ceiling / lid surcharge",
        unit: "sqft",
        priceType: "ceilingUpchargePerSqft",
      },
      {
        id: "corner_bead",
        label: "Corner bead",
        unit: "linear ft",
        priceType: "cornerBeadPricePerLf",
      },
      // Flat: the board type changes what you BUY, not how hard it is to hang.
      // These are the delta over 1/2" regular, per square foot of that board.
      {
        id: "board_type_x",
        label: 'Upgrade — 5/8" Type X fire-rated board',
        unit: "sqft",
        priceType: "flat",
        flatPrice: 0.35,
      },
      {
        id: "board_moisture",
        label: "Upgrade — moisture / mould-resistant board",
        unit: "sqft",
        priceType: "flat",
        flatPrice: 0.4,
      },
      {
        id: "board_soundproof",
        label: "Upgrade — sound-damping board",
        unit: "sqft",
        priceType: "flat",
        flatPrice: 2.6,
      },
    ],
    extras: {
      dustContainmentPrice: 275,
      // A board-out generates a skip's worth of offcuts. Sold, not absorbed.
      debrisRemovalPrice: 550,
      resilientChannelPricePerSqft: 1.35,
    },
  },

  // ── Epoxy and resinous flooring ───────────────────────────────────────
  //
  // The catalogue gives `epoxy` NO industry on purpose — lib/trades/catalog.js
  // says so in as many words: epoxy is sold by painters, by flooring installers
  // and by concrete contractors, and picking one publishes an answer nobody
  // chose. That decision is left standing here. See INTERIOR_TRADE_FILING.
  //
  // ── Prep is a separate line because prep is the job ──────────────────────
  //
  // Every coating failure this trade has is an adhesion failure, and adhesion
  // is decided before the first kit is opened. Grinding, coating removal and
  // moisture barriers are their own rows so they can be sold rather than
  // absorbed and then skipped — the same argument insulation's `airSealPerSqft`
  // makes about blowing over the leaks.
  //
  // Rates: a 480 sqft two-car garage in the standard tier, ground and coated
  // with a flake-and-polyaspartic system, is 480 × (1.75 + 9.00) = $5,160.
  // Canadian published range for that job is $2,800–$5,500 and the per-foot
  // band is $7–$12 for flake systems; this sits at the top of the job band and
  // mid-range per foot, which is right for a system that includes the grind.
  // Assumes: bare sound slab, single open bay, power and water on site, crew
  // of two, two visits (base coat cures overnight before the topcoat).
  epoxy: {
    label: "Epoxy & Resinous Flooring",
    complexity: {
      standard: {
        desc: "Bare, sound, dry concrete — a garage or basement slab in one open bay, no previous coating, hairline cracks only",
        grindPricePerSqft: 1.75,
        sealCoatPricePerSqft: 4.5,
        solidColourPricePerSqft: 6.5,
        flakeSystemPricePerSqft: 9.0,
        fullFlakeSystemPricePerSqft: 11.5,
        quartzSystemPricePerSqft: 14.0,
        metallicSystemPricePerSqft: 16.0,
        coatingRemovalPricePerSqft: 3.25,
        moistureBarrierPricePerSqft: 3.0,
        crackRepairPricePerLf: 14.0,
        coveBasePricePerLf: 22.0,
      },
      moderate: {
        desc: "Old sealer or a failed coating to take off, pitting and open cracks to fill, several rooms or a slab cut by control joints and columns",
        grindPricePerSqft: 2.25,
        sealCoatPricePerSqft: 5.5,
        solidColourPricePerSqft: 8.0,
        flakeSystemPricePerSqft: 11.0,
        fullFlakeSystemPricePerSqft: 14.0,
        quartzSystemPricePerSqft: 17.0,
        metallicSystemPricePerSqft: 19.5,
        coatingRemovalPricePerSqft: 4.25,
        moistureBarrierPricePerSqft: 3.75,
        crackRepairPricePerLf: 18.0,
        coveBasePricePerLf: 27.0,
      },
      high: {
        desc: "Slab failing a moisture test and needing a vapour barrier primer, heavy spalling to rebuild, occupied commercial hours, or a food-safe urethane cement spec",
        grindPricePerSqft: 3.0,
        sealCoatPricePerSqft: 7.0,
        solidColourPricePerSqft: 10.0,
        flakeSystemPricePerSqft: 13.5,
        fullFlakeSystemPricePerSqft: 17.0,
        quartzSystemPricePerSqft: 21.0,
        metallicSystemPricePerSqft: 24.0,
        coatingRemovalPricePerSqft: 5.75,
        moistureBarrierPricePerSqft: 4.75,
        crackRepairPricePerLf: 24.0,
        coveBasePricePerLf: 34.0,
      },
    },
    items: [
      {
        id: "grind",
        label: "Diamond grind & profile",
        unit: "sqft",
        priceType: "grindPricePerSqft",
      },
      {
        id: "coating_removal",
        label: "Remove existing coating or sealer",
        unit: "sqft",
        priceType: "coatingRemovalPricePerSqft",
      },
      {
        id: "moisture_barrier",
        label: "Moisture vapour barrier primer",
        unit: "sqft",
        priceType: "moistureBarrierPricePerSqft",
      },
      {
        id: "crack_repair",
        label: "Crack chase & fill",
        unit: "linear ft",
        priceType: "crackRepairPricePerLf",
      },
      {
        id: "seal_coat",
        label: "Clear seal — single coat",
        unit: "sqft",
        priceType: "sealCoatPricePerSqft",
      },
      {
        id: "solid_colour",
        label: "Solid colour epoxy — primer + build coat",
        unit: "sqft",
        priceType: "solidColourPricePerSqft",
      },
      {
        id: "flake_system",
        label: "Flake system — partial broadcast + polyaspartic",
        unit: "sqft",
        priceType: "flakeSystemPricePerSqft",
      },
      {
        id: "full_flake_system",
        label: "Full flake — broadcast to rejection + two topcoats",
        unit: "sqft",
        priceType: "fullFlakeSystemPricePerSqft",
      },
      {
        id: "quartz_system",
        label: "Quartz broadcast — commercial / wet areas",
        unit: "sqft",
        priceType: "quartzSystemPricePerSqft",
      },
      {
        id: "metallic_system",
        label: "Metallic epoxy",
        unit: "sqft",
        priceType: "metallicSystemPricePerSqft",
      },
      {
        id: "cove_base",
        label: "Integral cove base",
        unit: "linear ft",
        priceType: "coveBasePricePerLf",
      },
      // Flat: an anti-slip additive costs the same to broadcast whatever the
      // slab underneath is like.
      {
        id: "anti_slip",
        label: "Anti-slip aggregate in topcoat",
        unit: "sqft",
        priceType: "flat",
        flatPrice: 0.85,
      },
      {
        id: "joint_fill",
        label: "Control joint fill — semi-rigid",
        unit: "linear ft",
        priceType: "flat",
        flatPrice: 9.0,
      },
    ],
    extras: {
      // Moisture is the single most common reason a garage floor delaminates,
      // and a calcium chloride or RH probe test is cheap next to redoing it.
      // Priced so it is sold BEFORE the quote is committed, not after.
      moistureTestPrice: 285,
      // Emptying a garage is real work and it is nearly always assumed free.
      contentsClearingPrice: 250,
      mobilizationPrice: 350,
    },
  },

  // ── Flooring installation — LVP, laminate, hardwood ────────────────────
  //
  // NOT `flooring`, which is Hardwood Floor Refinishing and already has a book.
  // This is `flooring_install`: new material going down. Tile is its own trade
  // and its own key below, because a tile setter and a hardwood installer are
  // not the same person and their day rates are not the same number.
  //
  // Rates are SUPPLY AND INSTALL at a mid-grade material — the way a homeowner
  // asks for it. `labourOnlyPricePerSqft` is the row a company uses when the
  // client has already bought the floor, which happens constantly and is
  // otherwise unquotable. Ottawa supply-and-install bands: LVP $7–$11,
  // engineered $12–$18, solid $14–$20 per square foot. Standard sits low-mid
  // in each, which is right for a tier that assumes an empty rectangular room.
  //
  // Assumes: flat sound subfloor, material acclimatised on site (see
  // `acclimationDays` in the recipe — it is a schedule fact, not an hour), one
  // installer plus a helper, straight lay parallel to the longest wall.
  flooring_install: {
    label: "Flooring Installation",
    complexity: {
      standard: {
        desc: "Empty rectangular rooms, flat and sound subfloor, straight lay, ground floor, one material throughout",
        lvpPricePerSqft: 8.5,
        laminatePricePerSqft: 7.0,
        engineeredPricePerSqft: 14.5,
        solidHardwoodPricePerSqft: 16.0,
        labourOnlyPricePerSqft: 4.0,
        tearOutCarpetPricePerSqft: 1.5,
        tearOutHardSurfacePricePerSqft: 2.75,
        subfloorLevellingPricePerSqft: 4.5,
        underlaymentPricePerSqft: 1.25,
        transitionPrice: 65,
        shoeMouldingPricePerLf: 6.5,
        stairTreadPrice: 165,
      },
      moderate: {
        desc: "Furnished home, cut-up rooms and closets, minor levelling, a diagonal lay, or hardwood carried to a second floor",
        lvpPricePerSqft: 10.0,
        laminatePricePerSqft: 8.25,
        engineeredPricePerSqft: 16.5,
        solidHardwoodPricePerSqft: 18.5,
        labourOnlyPricePerSqft: 4.75,
        tearOutCarpetPricePerSqft: 1.85,
        tearOutHardSurfacePricePerSqft: 3.5,
        subfloorLevellingPricePerSqft: 5.75,
        underlaymentPricePerSqft: 1.5,
        transitionPrice: 80,
        shoeMouldingPricePerLf: 8.0,
        stairTreadPrice: 200,
      },
      high: {
        desc: "Herringbone or chevron, borders and inlays, a subfloor needing structural correction, tile tear-out, or an occupied home worked around room by room",
        lvpPricePerSqft: 12.0,
        laminatePricePerSqft: 10.0,
        engineeredPricePerSqft: 19.5,
        solidHardwoodPricePerSqft: 22.0,
        labourOnlyPricePerSqft: 6.0,
        tearOutCarpetPricePerSqft: 2.4,
        tearOutHardSurfacePricePerSqft: 4.75,
        subfloorLevellingPricePerSqft: 7.5,
        underlaymentPricePerSqft: 1.9,
        transitionPrice: 100,
        shoeMouldingPricePerLf: 10.0,
        stairTreadPrice: 250,
      },
    },
    items: [
      {
        id: "lvp",
        label: "Luxury vinyl plank — supply & install",
        unit: "sqft",
        priceType: "lvpPricePerSqft",
      },
      {
        id: "laminate",
        label: "Laminate — supply & install",
        unit: "sqft",
        priceType: "laminatePricePerSqft",
      },
      {
        id: "engineered",
        label: "Engineered hardwood — supply & install",
        unit: "sqft",
        priceType: "engineeredPricePerSqft",
      },
      {
        id: "solid_hardwood",
        label: "Solid hardwood — supply & install",
        unit: "sqft",
        priceType: "solidHardwoodPricePerSqft",
      },
      {
        id: "labour_only",
        label: "Installation only — client supplies the floor",
        unit: "sqft",
        priceType: "labourOnlyPricePerSqft",
      },
      {
        id: "tear_out_carpet",
        label: "Tear out carpet & underpad",
        unit: "sqft",
        priceType: "tearOutCarpetPricePerSqft",
      },
      {
        id: "tear_out_hard",
        label: "Tear out laminate, vinyl or tile",
        unit: "sqft",
        priceType: "tearOutHardSurfacePricePerSqft",
      },
      {
        id: "levelling",
        label: "Subfloor levelling",
        unit: "sqft",
        priceType: "subfloorLevellingPricePerSqft",
      },
      {
        id: "underlayment",
        label: "Underlayment / moisture barrier",
        unit: "sqft",
        priceType: "underlaymentPricePerSqft",
      },
      {
        id: "transition",
        label: "Transition strip / reducer",
        unit: "each",
        priceType: "transitionPrice",
      },
      {
        id: "shoe_moulding",
        label: "Quarter round / shoe moulding",
        unit: "linear ft",
        priceType: "shoeMouldingPricePerLf",
      },
      {
        id: "stair_tread",
        label: "Stair tread & riser — matching material",
        unit: "each",
        priceType: "stairTreadPrice",
      },
      // Flat: an appliance weighs the same in every tier.
      {
        id: "appliance_move",
        label: "Disconnect & move an appliance",
        unit: "each",
        priceType: "flat",
        flatPrice: 95,
      },
      {
        id: "door_undercut",
        label: "Undercut a door jamb / trim a door",
        unit: "each",
        priceType: "flat",
        flatPrice: 35,
      },
    ],
    extras: {
      furnitureMovingPrice: 275,
      disposalPrice: 425,
      // Nobody bills for this and everybody does it. It is not the tier's
      // problem; it is a fixed cost of getting the material into the house.
      deliveryAndStagingPrice: 165,
    },
  },

  // ── Tiling ────────────────────────────────────────────────────────────
  //
  // ── The tile itself is NOT priced, and that is the whole design ──────────
  //
  // Tile runs from $2 to $40 a square foot and the difference is homeowner
  // taste, not trade. This is exactly the countertop book's finding — "the one
  // trade priced from a supplier's invoice rather than from a rate card" — and
  // electricalBenchmarks.js's `allowance` type says the same thing about
  // ceiling fans. So every rate below is LABOUR PLUS SETTING MATERIALS: mortar,
  // grout, membrane, spacers, silicone. The tile is a separate supply line the
  // estimator prices from the client's selection, and `tile` in the recipe is
  // explicitly null rather than defaulted.
  //
  // Rates: an Ottawa backsplash at $20/sqft standard sits in the $18–$25 band;
  // a shower surround at $26 sits in the $25–$40 band, low, which is right for
  // a tier that assumes a square alcove and a standard tile size. Floor tile at
  // $14 is above the $10–$18 labour-only band because it includes the mortar
  // and grout, which labour-only quotes exclude.
  //
  // Assumes: one setter, substrate already sound and flat within 1/8" in 10 ft,
  // tile on site and inspected before the first day, and a return visit to
  // grout because thinset cures overnight — see `returnVisitHours`.
  tiling: {
    label: "Tiling",
    complexity: {
      standard: {
        desc: "Square rooms and alcoves, 12x12 to 12x24 tile, straight lay, sound flat substrate, tile on site",
        floorStandardPricePerSqft: 14.0,
        largeFormatPricePerSqft: 18.0,
        mosaicPricePerSqft: 26.0,
        wallTilePricePerSqft: 20.0,
        showerSurroundPricePerSqft: 26.0,
        waterproofingPricePerSqft: 6.5,
        uncouplingMembranePricePerSqft: 5.0,
        heatedFloorPricePerSqft: 13.0,
        patternAdderPricePerSqft: 4.0,
        edgeTrimPricePerLf: 22.0,
        nichePrice: 325,
        showerPanPrice: 950,
      },
      moderate: {
        desc: "Diagonal or offset patterns, large-format needing a levelling system, a substrate wanting self-leveller first, or an occupied bathroom on a deadline",
        floorStandardPricePerSqft: 17.0,
        largeFormatPricePerSqft: 22.0,
        mosaicPricePerSqft: 32.0,
        wallTilePricePerSqft: 24.0,
        showerSurroundPricePerSqft: 32.0,
        waterproofingPricePerSqft: 8.0,
        uncouplingMembranePricePerSqft: 6.0,
        heatedFloorPricePerSqft: 15.5,
        patternAdderPricePerSqft: 5.5,
        edgeTrimPricePerLf: 27.0,
        nichePrice: 400,
        showerPanPrice: 1200,
      },
      high: {
        desc: "Herringbone, book-matched slabs or gauged porcelain panels, curbless and linear-drain showers, mitred outside corners, heritage or out-of-square rooms",
        floorStandardPricePerSqft: 21.0,
        largeFormatPricePerSqft: 27.0,
        mosaicPricePerSqft: 40.0,
        wallTilePricePerSqft: 29.0,
        showerSurroundPricePerSqft: 40.0,
        waterproofingPricePerSqft: 10.0,
        uncouplingMembranePricePerSqft: 7.5,
        heatedFloorPricePerSqft: 19.0,
        patternAdderPricePerSqft: 7.5,
        edgeTrimPricePerLf: 34.0,
        nichePrice: 500,
        showerPanPrice: 1500,
      },
    },
    items: [
      {
        id: "floor_standard",
        label: 'Floor tile — 12x12 to 12x24',
        unit: "sqft",
        priceType: "floorStandardPricePerSqft",
      },
      {
        id: "large_format",
        label: "Floor tile — large format, 24x48 and up",
        unit: "sqft",
        priceType: "largeFormatPricePerSqft",
      },
      {
        id: "mosaic",
        label: "Mosaic, penny round or hex",
        unit: "sqft",
        priceType: "mosaicPricePerSqft",
      },
      {
        id: "wall_tile",
        label: "Wall tile / backsplash",
        unit: "sqft",
        priceType: "wallTilePricePerSqft",
      },
      {
        id: "shower_surround",
        label: "Shower surround",
        unit: "sqft",
        priceType: "showerSurroundPricePerSqft",
      },
      {
        id: "waterproofing",
        label: "Waterproofing membrane",
        unit: "sqft",
        priceType: "waterproofingPricePerSqft",
      },
      {
        id: "uncoupling",
        label: "Uncoupling / crack-isolation membrane",
        unit: "sqft",
        priceType: "uncouplingMembranePricePerSqft",
      },
      {
        id: "heated_floor",
        label: "Electric floor heating — mat & install",
        unit: "sqft",
        priceType: "heatedFloorPricePerSqft",
      },
      {
        id: "pattern_adder",
        label: "Pattern surcharge — diagonal, herringbone, basketweave",
        unit: "sqft",
        priceType: "patternAdderPricePerSqft",
      },
      {
        id: "edge_trim",
        label: "Metal edge trim / bullnose",
        unit: "linear ft",
        priceType: "edgeTrimPricePerLf",
      },
      { id: "niche", label: "Shower niche", unit: "each", priceType: "nichePrice" },
      {
        id: "shower_pan",
        label: "Shower pan — sloped bed & waterproofing",
        unit: "each",
        priceType: "showerPanPrice",
      },
      // Flat: a caulk joint is a caulk joint.
      {
        id: "grout_seal",
        label: "Grout sealing",
        unit: "sqft",
        priceType: "flat",
        flatPrice: 1.25,
      },
      {
        id: "silicone_joint",
        label: "Silicone movement joint",
        unit: "linear ft",
        priceType: "flat",
        flatPrice: 6.5,
      },
    ],
    extras: {
      // The heating cable's thermostat is an electrical connection and is
      // frequently someone else's trade. Priced as an extra so it can be
      // struck rather than assumed.
      heatingThermostatPrice: 285,
      demolitionAndDisposalPrice: 650,
      // The tile SUPPLY line. Zero on purpose, exactly like the countertop
      // book's `defaultCost: 0` rows: "no sensible default, you must enter it".
      tileSupplyPricePerSqft: 0,
    },
  },

  // ── Window and door installation ──────────────────────────────────────
  //
  // ── This trade has NO catalogue key, and one should not be invented here ──
  //
  // lib/trades/catalog.js has 68 keys and none of them is windows and doors.
  // The nearest are `installation_services` (label "Installation Services",
  // industry `handyman` — a generic mount-it-for-me row) and `carpentry`.
  // Filing window replacement under either mislabels it on every screen a
  // company sees, and the catalogue's own epoxy comment is explicit that
  // assigning a trade to an industry is a product decision, not a tidy-up.
  //
  // So `window_door_install` ships here as a PROPOSED key. It is declared in
  // INTERIOR_TRADE_FILING with `proposed: true` and the industries I would
  // argue for, and the check refuses to pretend it resolves. Adding it to
  // TRADE_CATALOG is a one-line decision for the owner; taking it myself would
  // put a trade in front of every construction company at signup.
  //
  // ── Rates are LABOUR AND INSTALL MATERIALS. The unit is not priced ───────
  //
  // A window is $400 to $4,000 depending on frame, glazing and size, chosen by
  // the homeowner from a supplier's book. Same argument as the tile above and
  // the countertop book before it. What is priced here is the install: pull the
  // old unit, prep and flash the opening, set and shim, foam, case and make
  // good. Ottawa install bands: insert $300–$600, full-frame $700–$1,200,
  // interior pre-hung $250–$400, entry door $800–$1,400. Standard sits inside
  // each.
  //
  // Assumes: crew of TWO on anything glazed — the hours in the recipe are
  // man-hours, so a 7-hour patio slider is three and a half hours on site with
  // two people, not a seven-hour day for one. Ground-floor access unless the
  // tier says otherwise. Sound, dry framing: rot found on opening is a change
  // order, and `rotRepairHourly` in the extras is what that conversation costs.
  window_door_install: {
    label: "Window & Door Installation",
    complexity: {
      standard: {
        desc: "Ground floor, insert replacement into a sound existing frame, standard sizes, ladder-free access, interior finish already there",
        insertWindowPrice: 425,
        fullFrameWindowPrice: 875,
        interiorPrehungPrice: 285,
        interiorSlabPrice: 195,
        exteriorEntryDoorPrice: 950,
        patioSliderPrice: 1150,
        stormDoorPrice: 385,
        exteriorCappingPricePerOpening: 145,
        casingPricePerOpening: 135,
        locksetPrice: 85,
        removalAndDisposalPrice: 95,
      },
      moderate: {
        desc: "Second storey needing ladders or a staging tower, full-frame brick-to-brick replacement, some sill rot, brick or stucco returns to make good",
        insertWindowPrice: 550,
        fullFrameWindowPrice: 1150,
        interiorPrehungPrice: 340,
        interiorSlabPrice: 235,
        exteriorEntryDoorPrice: 1250,
        patioSliderPrice: 1500,
        stormDoorPrice: 450,
        exteriorCappingPricePerOpening: 185,
        casingPricePerOpening: 165,
        locksetPrice: 95,
        removalAndDisposalPrice: 125,
      },
      high: {
        desc: "Above the second storey or lift access, structural rot or a header to rebuild, heritage sashes, or oversized and multi-panel units needing extra hands or a glazing crew",
        insertWindowPrice: 750,
        fullFrameWindowPrice: 1550,
        interiorPrehungPrice: 425,
        interiorSlabPrice: 290,
        exteriorEntryDoorPrice: 1650,
        patioSliderPrice: 1950,
        stormDoorPrice: 550,
        exteriorCappingPricePerOpening: 245,
        casingPricePerOpening: 210,
        locksetPrice: 110,
        removalAndDisposalPrice: 165,
      },
    },
    items: [
      {
        id: "insert_window",
        label: "Window — insert / pocket replacement",
        unit: "each",
        priceType: "insertWindowPrice",
      },
      {
        id: "full_frame_window",
        label: "Window — full-frame replacement",
        unit: "each",
        priceType: "fullFrameWindowPrice",
      },
      {
        id: "interior_prehung",
        label: "Interior door — pre-hung, cased both sides",
        unit: "each",
        priceType: "interiorPrehungPrice",
      },
      {
        id: "interior_slab",
        label: "Interior door — slab into an existing jamb",
        unit: "each",
        priceType: "interiorSlabPrice",
      },
      {
        id: "exterior_entry",
        label: "Exterior entry door — pre-hung, flashed & sill pan",
        unit: "each",
        priceType: "exteriorEntryDoorPrice",
      },
      {
        id: "patio_slider",
        label: "Patio slider / French door",
        unit: "each",
        priceType: "patioSliderPrice",
      },
      {
        id: "storm_door",
        label: "Storm / screen door",
        unit: "each",
        priceType: "stormDoorPrice",
      },
      {
        id: "capping",
        label: "Exterior aluminium capping",
        unit: "each",
        priceType: "exteriorCappingPricePerOpening",
      },
      {
        id: "casing",
        label: "Interior casing & make good",
        unit: "each",
        priceType: "casingPricePerOpening",
      },
      {
        id: "lockset",
        label: "Lockset / hardware — supply & fit",
        unit: "each",
        priceType: "locksetPrice",
      },
      {
        id: "removal",
        label: "Remove & dispose of the old unit",
        unit: "each",
        priceType: "removalAndDisposalPrice",
      },
      // Flat: a barn-door track is a wall-mounted job unaffected by the tier's
      // access story, and a low-E upgrade is a supplier line either way.
      {
        id: "barn_door_track",
        label: "Barn door track & hardware — fit",
        unit: "each",
        priceType: "flat",
        flatPrice: 275,
      },
      {
        id: "interior_stop_trim",
        label: "Window stool & apron",
        unit: "each",
        priceType: "flat",
        flatPrice: 145,
      },
    ],
    extras: {
      // Rot is the change order this trade lives on and the one most quotes
      // handle badly. An HOURLY rate on the quote up front, agreed before the
      // wall is open, is a better conversation than a number invented on the
      // day. It is deliberately not a per-opening figure: nobody knows.
      rotRepairHourlyRate: 95,
      // The unit SUPPLY line. Zero on purpose — see the countertop book.
      unitSupplyPrice: 0,
      // A site visit to measure every opening before ordering. Windows are
      // made to size and a wrong number is a six-week wait, so this gets sold.
      measureAndOrderPrice: 225,
      permitHandlingPrice: 275,
    },
  },
};

/* ══ RATE-CARD DESCRIPTORS ═════════════════════════════════════════════════
 *
 * Spread into PRICE_BOOK_FIELDS and PRICE_BOOK_GROUPS.
 *
 * NOT optional, and not cosmetic. priceBookBasis() and allPriceBookUnits() are
 * DERIVED from PRICE_BOOK_FIELDS, not from the books — so a book with no field
 * list renders an empty rate card, reports no basis to Settings > Services, and
 * contributes no units to the shared vocabulary. That is AGENTS.md's "a control
 * that appears to work and doesn't", arriving as a rate card with no rates in
 * it. Shipping the books without these would be worse than shipping neither.
 *
 * `suffix` is load-bearing beyond display: unitFromSuffix() parses "$ / sqft"
 * into the unit "sqft", and "$ flat" into null. Getting a suffix wrong tells
 * Settings the trade is quoted by something it is not.
 */

// Local mirror of the private complexityFields() helper in tradePriceBooks.js.
// Deliberately a duplicate rather than an export request: that file belongs to
// other agents this session, and the check script asserts this produces
// output identical in shape to what the real helper produces for an existing
// book. At merge time this should be DELETED and the real helper called.
const tiers = (rows) =>
  ["standard", "moderate", "high"].flatMap((level) =>
    rows.map(([key, label, suffix]) => ({
      path: `complexity.${level}.${key}`,
      label,
      suffix,
      level,
      step: suffix.includes("sqft") || suffix.includes("linear") ? 0.25 : 5,
    })),
  );

export const INTERIOR_PRICE_BOOK_GROUPS = {
  drywallPatch: "Patching and repair",
  drywallFinish: "Finish levels — GA-214",
  drywallBoard: "Board upgrades",
  epoxyPrep: "Slab preparation",
  epoxySystems: "Coating systems — installed",
  floorMaterials: "Flooring — supplied and installed, per square foot",
  floorPrep: "Tear-out and subfloor",
  floorTrim: "Trim, transitions and stairs",
  tileSetting: "Tile setting — labour and setting materials",
  tileSubstrate: "Substrate, waterproofing and heat",
  tileDetails: "Details and features",
  openingsWindows: "Windows",
  openingsDoors: "Doors",
  openingsFinish: "Finishing the opening",
  site: "Site conditions and extras",
};

export const INTERIOR_PRICE_BOOK_FIELDS = {
  drywall: [
    ...tiers([
      ["smallPatchPrice", 'Patch — up to 6"', "$ / each"],
      ["mediumPatchPrice", 'Patch — 6" to 2 ft', "$ / each"],
      ["largePatchPrice", "Patch — 2 ft to half a sheet", "$ / each"],
      ["skimCoatPricePerSqft", "Skim coat — Level 5", "$ / sqft"],
      ["textureMatchPricePerSqft", "Texture match", "$ / sqft"],
      ["popcornRemovalPricePerSqft", "Popcorn / stipple removal", "$ / sqft"],
      ["callOutMinimum", "Call-out minimum", "$ flat"],
    ]),
    {
      path: "extras.dustContainmentPrice",
      label: "Dust containment",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.returnVisitPrice",
      label: "Return visit — second coat",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.furnitureMovingPrice",
      label: "Furniture moving",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
  ],

  drywall_install: [
    ...tiers([
      ["hangPricePerSqft", "Hang board", "$ / sqft"],
      ["finishLevel1PricePerSqft", "Finish — Level 1", "$ / sqft"],
      ["finishLevel2PricePerSqft", "Finish — Level 2", "$ / sqft"],
      ["finishLevel3PricePerSqft", "Finish — Level 3", "$ / sqft"],
      ["finishLevel4PricePerSqft", "Finish — Level 4 (paint ready)", "$ / sqft"],
      ["finishLevel5PricePerSqft", "Finish — Level 5 (skim)", "$ / sqft"],
      ["ceilingUpchargePerSqft", "Ceiling / lid surcharge", "$ / sqft"],
      ["cornerBeadPricePerLf", "Corner bead", "$ / linear ft"],
    ]),
    {
      path: "extras.resilientChannelPricePerSqft",
      label: "Resilient channel",
      suffix: "$ / sqft",
      step: 0.25,
      group: "site",
    },
    {
      path: "extras.dustContainmentPrice",
      label: "Dust containment",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.debrisRemovalPrice",
      label: "Debris removal",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
  ],

  epoxy: [
    ...tiers([
      ["grindPricePerSqft", "Diamond grind & profile", "$ / sqft"],
      ["coatingRemovalPricePerSqft", "Remove existing coating", "$ / sqft"],
      ["moistureBarrierPricePerSqft", "Moisture vapour barrier", "$ / sqft"],
      ["crackRepairPricePerLf", "Crack chase & fill", "$ / linear ft"],
      ["sealCoatPricePerSqft", "Clear seal — single coat", "$ / sqft"],
      ["solidColourPricePerSqft", "Solid colour epoxy", "$ / sqft"],
      ["flakeSystemPricePerSqft", "Flake system", "$ / sqft"],
      ["fullFlakeSystemPricePerSqft", "Full flake — to rejection", "$ / sqft"],
      ["quartzSystemPricePerSqft", "Quartz broadcast", "$ / sqft"],
      ["metallicSystemPricePerSqft", "Metallic epoxy", "$ / sqft"],
      ["coveBasePricePerLf", "Integral cove base", "$ / linear ft"],
    ]),
    {
      path: "extras.moistureTestPrice",
      label: "Moisture test",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.contentsClearingPrice",
      label: "Clear the contents",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.mobilizationPrice",
      label: "Mobilization",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
  ],

  flooring_install: [
    ...tiers([
      ["lvpPricePerSqft", "Luxury vinyl plank", "$ / sqft"],
      ["laminatePricePerSqft", "Laminate", "$ / sqft"],
      ["engineeredPricePerSqft", "Engineered hardwood", "$ / sqft"],
      ["solidHardwoodPricePerSqft", "Solid hardwood", "$ / sqft"],
      ["labourOnlyPricePerSqft", "Installation only", "$ / sqft"],
      ["tearOutCarpetPricePerSqft", "Tear out carpet", "$ / sqft"],
      ["tearOutHardSurfacePricePerSqft", "Tear out hard surface", "$ / sqft"],
      ["subfloorLevellingPricePerSqft", "Subfloor levelling", "$ / sqft"],
      ["underlaymentPricePerSqft", "Underlayment", "$ / sqft"],
      ["transitionPrice", "Transition strip", "$ / each"],
      ["shoeMouldingPricePerLf", "Quarter round / shoe", "$ / linear ft"],
      ["stairTreadPrice", "Stair tread & riser", "$ / each"],
    ]),
    {
      path: "extras.furnitureMovingPrice",
      label: "Furniture moving",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.disposalPrice",
      label: "Disposal",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.deliveryAndStagingPrice",
      label: "Delivery & staging",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
  ],

  tiling: [
    ...tiers([
      ["floorStandardPricePerSqft", "Floor tile — standard", "$ / sqft"],
      ["largeFormatPricePerSqft", "Floor tile — large format", "$ / sqft"],
      ["mosaicPricePerSqft", "Mosaic / penny / hex", "$ / sqft"],
      ["wallTilePricePerSqft", "Wall tile / backsplash", "$ / sqft"],
      ["showerSurroundPricePerSqft", "Shower surround", "$ / sqft"],
      ["waterproofingPricePerSqft", "Waterproofing membrane", "$ / sqft"],
      ["uncouplingMembranePricePerSqft", "Uncoupling membrane", "$ / sqft"],
      ["heatedFloorPricePerSqft", "Electric floor heating", "$ / sqft"],
      ["patternAdderPricePerSqft", "Pattern surcharge", "$ / sqft"],
      ["edgeTrimPricePerLf", "Metal edge trim", "$ / linear ft"],
      ["nichePrice", "Shower niche", "$ / each"],
      ["showerPanPrice", "Shower pan", "$ / each"],
    ]),
    {
      path: "extras.heatingThermostatPrice",
      label: "Heating thermostat",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.demolitionAndDisposalPrice",
      label: "Demolition & disposal",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    // Internal-facing zero, same contract as the countertop book's rows: the
    // estimator types the client's actual tile price on the quote.
    {
      path: "extras.tileSupplyPricePerSqft",
      label: "Tile supply — enter the client's selection",
      suffix: "$ / sqft",
      step: 0.25,
      group: "site",
    },
  ],

  window_door_install: [
    ...tiers([
      ["insertWindowPrice", "Window — insert replacement", "$ / each"],
      ["fullFrameWindowPrice", "Window — full-frame", "$ / each"],
      ["interiorPrehungPrice", "Interior door — pre-hung", "$ / each"],
      ["interiorSlabPrice", "Interior door — slab", "$ / each"],
      ["exteriorEntryDoorPrice", "Exterior entry door", "$ / each"],
      ["patioSliderPrice", "Patio slider / French door", "$ / each"],
      ["stormDoorPrice", "Storm / screen door", "$ / each"],
      ["exteriorCappingPricePerOpening", "Exterior capping", "$ / each"],
      ["casingPricePerOpening", "Interior casing", "$ / each"],
      ["locksetPrice", "Lockset / hardware", "$ / each"],
      ["removalAndDisposalPrice", "Remove & dispose old unit", "$ / each"],
    ]),
    {
      path: "extras.rotRepairHourlyRate",
      label: "Rot repair — hourly",
      suffix: "$ flat",
      step: 5,
      group: "site",
    },
    {
      path: "extras.measureAndOrderPrice",
      label: "Measure & order visit",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.permitHandlingPrice",
      label: "Permit handling",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
    {
      path: "extras.unitSupplyPrice",
      label: "Unit supply — enter the client's selection",
      suffix: "$ flat",
      step: 25,
      group: "site",
    },
  ],
};

/* ══ THE COST SIDE ═════════════════════════════════════════════════════════
 *
 * Spread into MATERIAL_RECIPES. Nothing here is client-facing — same contract
 * as materialRecipes.js and electricalMaterials.js. It feeds the Cost & Margin
 * panel and must never reach /quote, /book, /q, /portal, /site or /embed.
 *
 * Shape, uniform across all eight recipes so one walker can check them all:
 *
 *   materials  { key: { label, pack, coverage?, cost, source, note?, gap? } }
 *   labour     { key: hours }  — HOURS, never a dollar rate. The company's own
 *              burdened crew cost multiplies these; see lib/costing/
 *              quoteCosting.js. Same contract as cabinetLabour.js and
 *              roofLabour.js: "hours are a prediction about work and the rate
 *              is a fact about payroll — the two have different owners".
 *   equipment  { key: { label, basis, cost, source, note? } }
 *   waste      { key: fraction }  — the overage that decides whether the job
 *              made money. Drywall cuts, tile breakage, flooring offcuts,
 *              paint held back for touch-up. Left out, it is a silent 8–15%
 *              under-order on the largest material line.
 *
 * `cost` is ALWAYS { usd, cad }. Either side may be null with a `gap`.
 */

export const INTERIOR_RECIPES = {
  // ── Interior painting ─────────────────────────────────────────────────
  //
  // ── The alignment with exterior_painting, stated exactly ────────────────
  //
  // model: "production_rate", and every key exterior_painting carries is
  // carried here with the same name and the same meaning. That is not
  // cosmetic: RECIPE_EDITABLE_FIELDS.production_rate in materialRecipes.js
  // already enumerates those eleven keys, so this recipe becomes editable in
  // Settings > Material Costs the moment it is spread in, with no form work.
  // A key invented under a new name would render nowhere.
  //
  // Where interior and exterior DIFFER, they differ on evidence, and every one
  // of the differences below is recovered from the owner's own paid jobs
  // through lib/pricing/paintTakeoff.js — not chosen to be different:
  //
  //   wallProductionRateSqftPerHour   100 vs exterior's 160. RECOVERED (414
  //     sqft ÷ 4.140 h). materialRecipes.js's own comment on the exterior
  //     figure predicted this: "interior is lower/harder".
  //   wallCoverageSqftPerGal          350 vs exterior's 250. Exterior substrate
  //     drinks more — paintTakeoff reconciles three exterior lines
  //     simultaneously only at 300, and the exterior recipe's 250 is more
  //     conservative still. Interior drywall is 350 on the can and in his job.
  //   trimProductionRateLfPerHour     40 vs exterior's 30. RECOVERED (46 lnft
  //     ÷ 1.150 h). Exterior trim is on a ladder.
  //   trimCoverageLfPerGal            500 vs exterior's 400. DERIVED from his
  //     own recovered figures, not chosen: 350 sqft/gal ÷ (0.35 sqft of
  //     paintable face per linear foot × 2 coats) = 500.
  //   hoursPerDoor                    1.0 vs exterior's 1.5. RECOVERED × 2 —
  //     paintTakeoff's `door` substrate is 0.5 h PER SIDE, and an interior door
  //     is painted both sides. Exterior doors carry a jamb and a threshold.
  //   maskingHoursPerExtraColor       1.5 vs exterior's 1. An interior colour
  //     change is cut in at the ceiling and the trim on both sides of every
  //     line; an exterior one is a different elevation. ASSUMPTION, not
  //     recovered, and marked as such.
  //   washingHours                    1.5 vs exterior's 3. Same conditional
  //     role — exterior means pressure-washing, interior means a TSP degrease
  //     of a kitchen, bath or a smoker's room. Charged only when selected.
  //
  // The three keys added beyond exterior's set are ceiling work, which an
  // exterior job does not have. They need rows adding to
  // RECIPE_EDITABLE_FIELDS.production_rate or they will not be editable — see
  // INTERIOR_RECIPE_EDITABLE_FIELDS at the bottom of this file.
  interior_painting: {
    model: "production_rate",
    label: "Interior Painting",

    // Walls — RECOVERED, see above.
    wallProductionRateSqftPerHour: 100,
    wallCoverageSqftPerGal: 350,
    defaultCoats: 2,

    // Ceilings — interior only.
    ceilingProductionRateSqftPerHour: 110, // RECOVERED: 130 sqft ÷ 1.1818 h
    ceilingCoverageSqftPerGal: 350,

    // Trim — RECOVERED, see above.
    trimProductionRateLfPerHour: 40,
    trimCoverageLfPerGal: 500,

    hoursPerDoor: 1.0,

    // Prep. setupHours matches exterior's 2 deliberately: floor protection and
    // drop cloths are the interior analogue of ladders and sheeting outside,
    // and furniture moving is already a separate SELL line on the interior book
    // (global.furnitureMovingPrice), so folding it in here would double-count.
    setupHours: 2,
    surfacePrepBaseHours: 2, // fill, caulk, spot-prime
    washingHours: 1.5, // conditional — degrease wash only
    maskingHoursPerExtraColor: 1.5, // ASSUMPTION

    // Popcorn removal, in hours. The scrape is the small half; the skim and
    // sand afterwards are the rest, and it is a two-visit job because the skim
    // dries overnight. 0.02 man-hours/sqft ⇒ 20 man-hours per 1,000 sqft of
    // ceiling. ASSUMPTION — wetted and scraped, ceiling under 9 ft, room
    // emptied first. A ceiling that has been painted over resists wetting and
    // can double this; that is the `high` tier on the sell side.
    popcornRemovalHoursPerSqft: 0.02,

    // ── Paint. IMPORTED, not restated. See PAINT_COST_CAD above ────────────
    //
    // The CAD figures are the owner's, recovered to the cent from invoices he
    // was paid on, and reading them through the import means an edit to
    // paintTakeoff.js moves this recipe too instead of leaving a stale copy in
    // a margin panel. They are POINTS, not bands, because that is what a
    // recovered figure is — the same idiom electricalMaterials.js uses on the
    // one breaker with a single listing.
    //
    // The USD side is a separate reasoning about a separate market: US big-box
    // interior latex, contractor-grade at the low end through premium at the
    // high. No arithmetic connects the two columns and none should.
    materials: {
      wall_paint: {
        label: "Interior wall paint",
        pack: "gallon",
        coverage: { sqftPerGal: 350 },
        cost: {
          cad: point(PAINT_COST_CAD.wall),
          usd: band(30, 42, 58),
        },
        source: SOURCE.RECOVERED + " USD side: " + SOURCE.TRADE,
        note: "CAD is PAINT_PRODUCT_DEFAULTS.wall_interior.costPerGal — the owner's own figure, imported. Do not restate it here.",
      },
      ceiling_paint: {
        label: "Ceiling flat",
        pack: "gallon",
        coverage: { sqftPerGal: 350 },
        cost: {
          cad: point(PAINT_COST_CAD.ceiling),
          usd: band(22, 28, 38),
        },
        source: SOURCE.RECOVERED + " USD side: " + SOURCE.TRADE,
        note: "CAD is PAINT_PRODUCT_DEFAULTS.ceiling_flat.costPerGal.",
      },
      trim_enamel: {
        label: "Trim enamel",
        pack: "gallon",
        coverage: { sqftPerGal: 350 },
        cost: {
          cad: point(PAINT_COST_CAD.trim),
          usd: band(32, 42, 58),
        },
        source: SOURCE.RECOVERED + " USD side: " + SOURCE.TRADE,
        note: "CAD is PAINT_PRODUCT_DEFAULTS.trim_enamel.costPerGal — solved across four of his lines at once.",
      },
      primer: {
        label: "Primer",
        pack: "gallon",
        coverage: { sqftPerGal: 300 },
        cost: { cad: null, usd: null },
        source: SOURCE.RECOVERED,
        // Not an oversight, and not mine to fill. paintTakeoff.js already
        // decided this: "No primer line appears on either of his jobs, so
        // there is no figure to recover and none is invented." Inventing one
        // HERE, in a second file, would be worse than the original gap —
        // it would look like the question had been answered.
        gap: "PAINT_PRODUCT_DEFAULTS.primer.costPerGal is deliberately null in the shipping product. A primed substrate reports its gallons and no cost, flagged unpriced. Pick your primer and set it on the rate card.",
      },
      caulk: {
        label: "Paintable acrylic caulk",
        pack: "tube (300 ml / 10 oz)",
        coverage: { linearFtPerTube: 30 },
        cost: { cad: band(8, 10.5, 14), usd: band(6, 8.5, 11) },
        source: SOURCE.TRADE,
      },
      filler: {
        label: "Lightweight filler / spackle",
        pack: "tub (1 gal)",
        cost: { cad: band(22, 29, 38), usd: band(17, 22, 30) },
        source: SOURCE.TRADE,
        note: "Consumption is condition-driven, not area-driven. Counted per job, not derived — see surfacePrepBaseHours.",
      },
    },

    // Consumables use the three keys CONSUMABLE_EDITABLE_FIELDS already
    // defines (tape / maskingFilm / sandpaper) so they are editable the day
    // this merges. A fourth key would render nowhere. `perUnits` counts ROOMS
    // here, where the cabinet recipe counts doors and drawers.
    consumables: {
      tape: {
        perUnits: 1,
        label: "Painter's tape",
        cost: { cad: band(6, 8, 11), usd: band(5, 6.5, 9) },
        source: SOURCE.TRADE,
        note: "A roll per room. Cut-in-heavy rooms — a kitchen, a stairwell — take two.",
      },
      maskingFilm: {
        perJob: 1,
        perUnits: 4,
        label: "Masking film & floor protection",
        cost: { cad: band(22, 28, 36), usd: band(18, 23, 30) },
        source: SOURCE.TRADE,
      },
      sandpaper: {
        perUnit: null,
        label: "Sandpaper / sanding sponges",
        cost: { cad: band(3, 4, 6), usd: band(2.5, 3.5, 5) },
        source: SOURCE.TRADE,
        note: "Per ROOM, unlike the cabinet recipe's per door+drawer unit. perUnit is null because the dollar figure lives in `cost` with both currencies; the cabinet recipe's bare number could not carry two.",
      },
    },

    equipment: {
      airless_sprayer: {
        label: "Airless sprayer",
        basis: "day",
        cost: { cad: band(95, 120, 150), usd: band(75, 95, 125) },
        source: SOURCE.RENTAL,
        note: "Only earns its rental on new construction, whole-house repaints and cabinets. A furnished occupied repaint is brush and roll — the masking costs more than the sprayer saves.",
      },
      hepa_vacuum: {
        label: "HEPA sander / vacuum",
        basis: "day",
        cost: { cad: band(45, 60, 80), usd: band(38, 50, 68) },
        source: SOURCE.RENTAL,
        note: "Popcorn removal and skim-coat sanding only.",
      },
    },

    waste: {
      // The touch-up quart the client keeps, plus what stays in the tray and
      // the roller. It is real and it is never ordered, which is how a
      // whole-house repaint comes up half a gallon short on the last wall.
      // NOT applied to the reconciliation in the check script — his invoice
      // carried no waste factor and the assertion reproduces his figure, not
      // an improved one.
      paintTouchUp: 0.05,
    },

    // ── Costing keyed to the chips already in DEFAULT_LINE_ITEMS ───────────
    //
    // Keys are the EXACT `description` strings from
    // DEFAULT_LINE_ITEMS.interior_painting, character for character, and the
    // check script asserts every one still resolves. This is the interim
    // linkage; the permanent one is a stable `key` on the chip, the way
    // electricalCatalog.js does it. See "Wiring".
    lineItemCosts: {
      Ceiling: {
        unit: "flat",
        driver: "ceilingSqft",
        labourHoursPerDriverUnit: 1 / 110, // RECOVERED production rate
        materialKey: "ceiling_paint",
        coats: 2,
        sqftPerDriverUnit: 1,
      },
      "Trim & baseboards": {
        unit: "flat",
        driver: "trimLinearFt",
        labourHoursPerDriverUnit: 1 / 40, // RECOVERED production rate
        materialKey: "trim_enamel",
        coats: 2,
        // RECOVERED: a nominal 4" baseboard plus its top edge.
        sqftPerDriverUnit: 0.35,
      },
      Doors: {
        unit: "each",
        labourHoursPerUnit: 1.0, // RECOVERED 0.5 h/side × 2 sides
        materialKey: "trim_enamel",
        coats: 2,
        sqftPerUnit: 42, // RECOVERED 21 sqft per 3'0" × 7'0" side × 2
      },
      "Closet interior": {
        unit: "each",
        labourHoursPerUnit: 1.75,
        materialKey: "wall_paint",
        coats: 2,
        sqftPerUnit: 90,
        note: "ASSUMPTION: a nominal 6 ft reach-in — back, two returns, ceiling and shelf face. A walk-in is a room, not this line.",
      },
      "Popcorn / stipple ceiling removal": {
        unit: "sqft",
        labourHoursPerUnit: 0.02,
        materialKey: null,
        note: "Skim compound is drywall material, not paint — see the drywall recipe's compound_allpurpose. Two visits: the skim dries overnight.",
      },
      "Drywall repair & prep": {
        unit: "flat",
        labourHoursPerUnit: null,
        gap: "Scope-dependent and genuinely unknowable from the chip alone — a nail pop and a water-stained ceiling are the same line. Cost it from INTERIOR_RECIPES.drywall's patch hours once the estimator has counted them. A default here would price the ceiling as a nail pop.",
      },
      "Furniture moving & protection": {
        unit: "flat",
        labourHoursPerRoom: 0.5,
        consumableKeys: ["maskingFilm", "tape"],
      },
    },
  },

  // ── Hardwood floor refinishing ────────────────────────────────────────
  //
  // The cost side for the EXISTING `flooring` book, which prices refinishing
  // and could not cost it. Nothing about that book is touched.
  //
  // The model is three cuts and three coats: drum sand, edge, buff; sealer
  // then two finish coats with a screen between. Everything below assumes an
  // emptied room, 3/4" solid oak with enough thickness left to sand, and one
  // operator on the drum with a second on the edger.
  flooring: {
    model: "production_rate",
    label: "Hardwood Floor Refinishing",

    materials: {
      sealer: {
        label: "Sanding sealer",
        pack: "gallon",
        coverage: { sqftPerGal: 500 },
        cost: { cad: band(55, 70, 92), usd: band(43, 55, 72) },
        source: SOURCE.TRADE,
      },
      oil_poly: {
        label: "Oil-based polyurethane",
        pack: "gallon",
        coverage: { sqftPerGal: 500 },
        cost: { cad: band(58, 72, 95), usd: band(45, 56, 74) },
        source: SOURCE.TRADE,
        note: "Cheaper per gallon than waterborne and far slower to cure — see cureDaysBeforeFurniture. The cost difference is in the schedule, not the can.",
      },
      waterborne_finish: {
        label: "Waterborne finish",
        pack: "gallon",
        coverage: { sqftPerGal: 500 },
        cost: { cad: band(85, 110, 145), usd: band(66, 85, 115) },
        source: SOURCE.TRADE,
      },
      stain: {
        label: "Wood stain",
        pack: "gallon",
        coverage: { sqftPerGal: 400 },
        cost: { cad: band(48, 62, 82), usd: band(38, 48, 64) },
        source: SOURCE.TRADE,
      },
      abrasives: {
        label: "Abrasives — belts, discs and screens",
        pack: "per 100 sqft, all three cuts",
        cost: { cad: band(9, 13, 18), usd: band(7, 10, 14) },
        source: SOURCE.TRADE,
        note: "Grit sequence 36/60/80 plus a 120 screen. An old floor with cupping or paint on it eats double — that is the book's `high` tier.",
      },
      wood_filler: {
        label: "Trowel filler",
        pack: "gallon",
        coverage: { sqftPerGal: 250 },
        cost: { cad: band(45, 58, 78), usd: band(35, 45, 60) },
        source: SOURCE.TRADE,
      },
      shoe_moulding: {
        label: "Quarter round / shoe moulding",
        pack: "8 ft length",
        cost: { cad: band(7, 9.5, 14), usd: band(5.5, 7.5, 11) },
        source: SOURCE.TRADE,
      },
    },

    labour: {
      // Three cuts including edging, per square foot. 1,000 sqft ⇒ 20
      // man-hours, which is a two-person day and a bit. ASSUMPTION.
      sandThreeCutsPerSqft: 0.02,
      screenBetweenCoatsPerSqft: 0.004,
      coatPerSqft: 0.005, // per coat
      stainApplyPerSqft: 0.01,
      gapFillPerSqft: 0.012,
      boardReplacePerBoard: 0.75,
      stairBlendPerTread: 0.6,
      furnitureMovingHoursPerRoom: 0.5,
      shoeMouldingPerLf: 0.05,
      setupAndContainmentHours: 1.5,
    },

    // A schedule fact, not an hour, and it is the one that decides whether the
    // client can move back in. Oil-based is walkable in 24 h and furniture-safe
    // in 3–5 days; waterborne in hours and 1–2 days. Priced nowhere, but it is
    // the reason a floor job blocks every other trade in the house.
    cureDaysBeforeFurniture: { oil: 4, waterborne: 2 },

    equipment: {
      drum_sander: {
        label: "Drum / belt sander",
        basis: "day",
        cost: { cad: band(95, 120, 155), usd: band(75, 95, 120) },
        source: SOURCE.RENTAL,
      },
      edger: {
        label: "Edger",
        basis: "day",
        cost: { cad: band(55, 70, 90), usd: band(43, 55, 70) },
        source: SOURCE.RENTAL,
      },
      buffer: {
        label: "Buffer / orbital",
        basis: "day",
        cost: { cad: band(60, 75, 98), usd: band(47, 58, 76) },
        source: SOURCE.RENTAL,
      },
      dust_containment: {
        label: "Dust containment vacuum",
        basis: "day",
        cost: { cad: band(70, 90, 115), usd: band(55, 70, 90) },
        source: SOURCE.RENTAL,
        note: "The difference between a refinish and a whole-house clean. Sold on the quote, not absorbed.",
      },
    },

    waste: {
      // Finish left in the tray and the applicator, plus the coat that gets
      // re-done where a lap line shows.
      finish: 0.05,
      abrasives: 0.1,
      shoeMoulding: 0.12, // mitres
    },

    // Keys are the EXACT descriptions in DEFAULT_LINE_ITEMS.flooring.
    lineItemCosts: {
      "Stain colour change": {
        unit: "sqft",
        labourHoursPerUnit: 0.01,
        materialKey: "stain",
        coats: 1,
        sqftPerUnit: 1,
      },
      "Water damage repair": {
        unit: "flat",
        labourHoursPerUnit: null,
        gap: "Unknowable from the chip. Cost it as boardReplacePerBoard × the boards counted, plus the sand and coat rows over the affected area. Whether the subfloor is wet is a site question, not a default.",
      },
      "Gap filling": {
        unit: "sqft",
        labourHoursPerUnit: 0.012,
        materialKey: "wood_filler",
        sqftPerUnit: 1,
      },
      "Furniture moving": {
        unit: "flat",
        labourHoursPerRoom: 0.5,
      },
      "Stair blending": {
        unit: "flat",
        labourHoursPerTread: 0.6,
        note: "Counted per tread, billed flat. Blending a staircase into a new floor colour is the hardest colour-match on the job — the treads are a different species and age from the field.",
      },
      "Quarter round / shoe moulding": {
        unit: "linear_ft",
        labourHoursPerUnit: 0.05,
        materialKey: "shoe_moulding",
        materialUnitsPerUnit: 1 / 8, // one 8 ft length per 8 linear feet
        wasteKey: "shoeMoulding",
      },
    },
  },

  // ── Drywall repair ────────────────────────────────────────────────────
  drywall: {
    model: "unit_count",
    label: "Drywall Repair & Finishing",
    materials: {
      board_half_4x8: {
        label: '1/2" regular gypsum board — 4x8',
        pack: "sheet (32 sqft)",
        cost: { cad: band(14.5, 17.5, 21), usd: band(12.5, 14.5, 17) },
        source: SOURCE.TRADE,
      },
      compound_allpurpose: {
        label: "All-purpose joint compound",
        pack: "box (4.5 gal / 17 L)",
        coverage: { sqftOfBoardPerBox: 475 },
        cost: { cad: band(19, 23.5, 28), usd: band(16, 19, 23) },
        source: SOURCE.TRADE,
        note: "475 sqft is a Level 4 figure — three coats on joints, two over fasteners. A Level 5 skim over the same area consumes roughly a second box.",
      },
      compound_setting: {
        label: "Setting-type compound (90 min)",
        pack: "bag (18 kg)",
        cost: { cad: band(17, 21, 26), usd: band(14, 17, 21) },
        source: SOURCE.TRADE,
        note: "What makes a same-day patch possible. Chemical set, not evaporation — it goes off wet and it is the reason returnVisitHours is 1.0 and not 2.",
      },
      tape_paper: {
        label: "Paper joint tape",
        pack: "roll (500 ft)",
        cost: { cad: band(6.5, 8.5, 11), usd: band(5, 6.5, 8.5) },
        source: SOURCE.TRADE,
      },
      tape_mesh: {
        label: "Self-adhesive mesh tape",
        pack: "roll (300 ft)",
        cost: { cad: band(8, 11, 14), usd: band(6.5, 9, 12) },
        source: SOURCE.TRADE,
      },
      texture_compound: {
        label: "Spray texture / knockdown compound",
        pack: "can (20 oz)",
        coverage: { sqftPerCan: 75 },
        cost: { cad: band(14, 18, 24), usd: band(11, 14, 19) },
        source: SOURCE.TRADE,
        note: "Matching an existing texture is trial and error on a scrap board first. Budget two cans for a one-can patch.",
      },
      poly_sheeting: {
        label: "6 mil poly sheeting",
        pack: "roll (10 ft x 100 ft)",
        cost: { cad: band(75, 95, 125), usd: band(58, 74, 98) },
        source: SOURCE.TRADE,
      },
    },
    labour: {
      // Both visits, added. The first is cut-and-fill, the second is the finish
      // coat and sand — because the mud has to dry, and a repair quote that
      // prices one visit gives the second one away every single time. This is
      // the number that decides whether this book is honest.
      smallPatchHours: 1.25,
      mediumPatchHours: 2.25,
      largePatchHours: 3.75,
      returnVisitHours: 1.0,
      skimCoatPerSqft: 0.022,
      textureMatchPerSqft: 0.02,
      popcornRemovalPerSqft: 0.02, // matches the painting recipe deliberately
      cornerBeadReplacePerLf: 0.06,
      nailPopEach: 0.15,
      containmentSetupHours: 0.75,
      furnitureMovingHoursPerRoom: 0.5,
    },
    equipment: {
      drywall_sander_vac: {
        label: "Pole sander with dust extraction",
        basis: "day",
        cost: { cad: band(70, 90, 115), usd: band(55, 72, 95) },
        source: SOURCE.RENTAL,
      },
      negative_air: {
        label: "Negative air machine",
        basis: "day",
        cost: { cad: band(85, 110, 145), usd: band(68, 88, 115) },
        source: SOURCE.RENTAL,
        note: "Occupied homes and any ceiling scrape. Not needed on an empty room with a closed door.",
      },
    },
    waste: {
      // A patch cuts a whole sheet to get a 10-inch square. The offcut is not
      // always reusable and this factor is high for that reason, not by error.
      board: 0.35,
      compound: 0.15,
    },
  },

  // ── Drywall hang, tape and finish ─────────────────────────────────────
  drywall_install: {
    model: "board_area",
    label: "Drywall — Hang, Tape & Finish",
    materials: {
      board_half_4x8: {
        label: '1/2" regular gypsum board — 4x8',
        pack: "sheet (32 sqft)",
        cost: { cad: band(14.5, 17.5, 21), usd: band(12.5, 14.5, 17) },
        source: SOURCE.TRADE,
      },
      board_half_4x12: {
        label: '1/2" regular gypsum board — 4x12',
        pack: "sheet (48 sqft)",
        cost: { cad: band(21, 25.5, 30), usd: band(18, 21, 25) },
        source: SOURCE.TRADE,
        note: "Cheaper per square foot AND fewer butt joints to finish, which is the larger saving. It does not fit up a tight stair — that is the `moderate` tier.",
      },
      board_type_x_5_8: {
        label: '5/8" Type X fire-rated board — 4x8',
        pack: "sheet (32 sqft)",
        cost: { cad: band(19, 23, 28), usd: band(16, 19, 23) },
        source: SOURCE.TRADE,
      },
      board_moisture: {
        label: "Moisture / mould-resistant board — 4x8",
        pack: "sheet (32 sqft)",
        cost: { cad: band(20, 24.5, 30), usd: band(17, 20.5, 25) },
        source: SOURCE.TRADE,
      },
      board_soundproof: {
        label: "Sound-damping board — 4x8",
        pack: "sheet (32 sqft)",
        cost: { cad: band(95, 125, 165), usd: band(75, 98, 130) },
        source: SOURCE.TRADE,
        note: "Five to seven times regular board. It is why the sell-side upgrade row is $2.60/sqft and not 40 cents.",
      },
      compound_allpurpose: {
        label: "All-purpose joint compound",
        pack: "box (4.5 gal / 17 L)",
        coverage: { sqftOfBoardPerBox: 475 },
        cost: { cad: band(19, 23.5, 28), usd: band(16, 19, 23) },
        source: SOURCE.TRADE,
        note: "475 sqft of board at Level 4. Level 5 roughly doubles it.",
      },
      tape_paper: {
        label: "Paper joint tape",
        pack: "roll (500 ft)",
        cost: { cad: band(6.5, 8.5, 11), usd: band(5, 6.5, 8.5) },
        source: SOURCE.TRADE,
      },
      screws: {
        label: 'Drywall screws — 1-1/4" coarse',
        pack: "box (5 lb, ≈1,300)",
        cost: { cad: band(24, 29, 36), usd: band(19, 23, 29) },
        source: SOURCE.TRADE,
      },
      corner_bead: {
        label: "Paper-faced metal corner bead",
        pack: "8 ft length",
        cost: { cad: band(4.5, 5.75, 7.5), usd: band(3.5, 4.5, 6) },
        source: SOURCE.TRADE,
      },
      resilient_channel: {
        label: "Resilient channel",
        pack: "12 ft length",
        cost: { cad: band(7.5, 9.5, 13), usd: band(6, 7.5, 10) },
        source: SOURCE.TRADE,
      },
    },

    // Derived quantities, per square foot of BOARD. These are geometry, not a
    // market, and they are the reason a materials list can be produced from an
    // area instead of typed.
    consumption: {
      // A 4x8 sheet in a field has two 8 ft edges and two 4 ft ends, each
      // shared with the neighbouring sheet: 12 lf of joint per 32 sqft =
      // 0.375 lf/sqft. Rounded to 0.40 for interior angles. The trade's own
      // rule of thumb — 370–400 ft of tape per 1,000 sqft — lands in the same
      // place from the other direction.
      tapeLfPerSqftBoard: 0.4,
      // 16" o.c. field and perimeter fastening ⇒ ~32 screws per 4x8 sheet.
      screwsPerSqftBoard: 1.0,
      compoundSqftOfBoardPerBoxLevel4: 475,
      // NOT derived. Corner bead is counted off the drawing — the number of
      // outside corners in a room has no relationship to its area, and a
      // per-sqft figure would be a guess with a decimal point on it.
      cornerBeadLfPerSqftBoard: null,
    },

    labour: {
      // Man-hours per square foot of board. 0.010 ⇒ 32 sqft (one 4x8) in
      // 0.32 man-hours, about 2.5 sheets per man-hour. ASSUMPTION: a two-hand
      // crew on 8–9 ft walls with the board stocked in the room. A boxed
      // production crew beats this by half; this is a small residential
      // contractor with a screw gun and a lift.
      hangPerSqft: 0.01,
      hangCeilingMultiplier: 1.35,

      // Finishing, by GA-214 level, per square foot of board. Includes the
      // sanding between coats. The ratios are the point: each level adds a
      // pass, and Level 5's full skim is 1.7× Level 4, which is the published
      // 40–70% premium on the finishing line.
      finishPerSqftByLevel: {
        1: 0.004, // tape set only
        2: 0.007, // + one coat over joints, angles, fasteners
        3: 0.01, // + a second coat on joints and angles
        4: 0.014, // + a third coat, two over fasteners, sanded smooth
        5: 0.024, // + a skim coat over the ENTIRE surface, sanded
      },
      cornerBeadPerLf: 0.05,
      resilientChannelPerSqft: 0.006,
      setupAndContainmentHours: 1.5,
      debrisHoursPer100SqftBoard: 0.15,
    },

    equipment: {
      panel_lift: {
        label: "Drywall panel lift",
        basis: "day",
        cost: { cad: band(45, 55, 70), usd: band(38, 45, 58) },
        source: SOURCE.RENTAL,
      },
      drywall_sander_vac: {
        label: "Drywall sander with vacuum",
        basis: "day",
        cost: { cad: band(70, 90, 115), usd: band(55, 72, 95) },
        source: SOURCE.RENTAL,
      },
      dumpster_10yd: {
        label: "10-yard dumpster",
        basis: "delivered and hauled",
        cost: { cad: band(450, 575, 750), usd: band(350, 450, 600) },
        source: SOURCE.TRADE,
        note: "Delivery plus haul, not a day rate. Drywall is heavy for its volume and some haulers price it by weight over a tonnage allowance — check the allowance, not the headline.",
      },
      stilts: {
        label: "Drywall stilts",
        basis: "owned",
        cost: { cad: null, usd: null },
        source: SOURCE.TRADE,
        gap: "Owned, not rented — nobody rents stilts by the day. A purchase is overhead, not a job cost, so it carries no per-job figure rather than a made-up one.",
      },
    },

    waste: {
      // Cuts around openings, damaged sheets, the last 18 inches of a run.
      // 10% is the trade's own ordering rule for simple rectangles; a cut-up
      // floor plan with lots of short walls runs 15%.
      board: 0.1,
      compound: 0.1, // what stays in the pan and the bucket
      tape: 0.05,
    },
  },

  // ── Epoxy and resinous flooring ───────────────────────────────────────
  //
  // Kits, not gallons, and this is the same lesson the cabinet recipe learned
  // the hard way about catalyst quarts: "a job needing 0.6 of one costs a whole
  // one — the remainder has a working life measured in hours once mixed, so it
  // is not stock, it is spent". Every resin below is a two-part kit with a pot
  // life. `kitSizeGal` exists so a cost engine can ceil to whole kits; costing
  // 3.2 kits is costing something nobody can buy.
  epoxy: {
    model: "coating_area",
    label: "Epoxy & Resinous Flooring",
    materials: {
      epoxy_100_solids: {
        label: "100% solids epoxy — pigmented build coat",
        pack: "3 gal kit (A+B)",
        kitSizeGal: 3,
        // 100% solids at 1 mil covers 1,604 sqft/gal, so 10 mil is 160.
        // That is arithmetic, not a market figure.
        coverage: { sqftPerGalAt10Mil: 160, sqftPerKit: 480 },
        cost: { cad: band(295, 375, 480), usd: band(230, 290, 375) },
        source: SOURCE.TRADE,
      },
      epoxy_primer: {
        label: "Water-based epoxy primer",
        pack: "2 gal kit",
        kitSizeGal: 2,
        coverage: { sqftPerGal: 225, sqftPerKit: 450 },
        cost: { cad: band(145, 185, 240), usd: band(115, 145, 190) },
        source: SOURCE.TRADE,
      },
      polyaspartic_topcoat: {
        label: "Polyaspartic topcoat",
        pack: "1.5 gal kit",
        kitSizeGal: 1.5,
        coverage: { sqftPerGal: 200, sqftPerKit: 300 },
        cost: { cad: band(255, 320, 415), usd: band(200, 250, 325) },
        source: SOURCE.TRADE,
        note: "Pot life is 20–45 minutes and it does not care whether you are finished. The waste factor below is about this product more than any other.",
      },
      colour_flake: {
        label: "Decorative colour flake",
        pack: "box (55 lb)",
        // Partial broadcast ≈ 1/4 lb per sqft; broadcast to rejection ≈ 1/2.
        coverage: { sqftPerBoxPartial: 220, sqftPerBoxFullRejection: 110 },
        cost: { cad: band(180, 230, 300), usd: band(140, 180, 235) },
        source: SOURCE.TRADE,
      },
      moisture_barrier: {
        label: "Moisture vapour barrier primer",
        pack: "3 gal kit",
        kitSizeGal: 3,
        coverage: { sqftPerGal: 150, sqftPerKit: 450 },
        cost: { cad: band(420, 530, 680), usd: band(330, 415, 530) },
        source: SOURCE.TRADE,
      },
      crack_repair: {
        label: "Polyurea crack filler",
        pack: "cartridge (600 ml)",
        coverage: { linearFtPerCartridge: 10 },
        cost: { cad: band(45, 58, 75), usd: band(35, 45, 58) },
        source: SOURCE.TRADE,
      },
      grinding_segments: {
        label: "Diamond grinding segments",
        pack: "per sqft ground",
        cost: { cad: band(0.1, 0.14, 0.2), usd: band(0.08, 0.11, 0.16) },
        source: SOURCE.TRADE,
        note: "Consumable, not equipment. Soft slabs eat segments; hard-troweled ones need a harder bond and go slower.",
      },
      metallic_pigment: {
        label: "Metallic pigment",
        pack: "bag",
        cost: { cad: null, usd: null },
        source: SOURCE.TRADE,
        gap: "Metallic systems are sold by the designer effect, not by a standard loading — pigment counts vary two or three to one across the same floor depending on the pattern. Sell-side is priced; the cost is per-supplier and per-design and is not defaultable.",
      },
    },
    labour: {
      grindPerSqft: 0.012, // walk-behind, ~700 sqft per operator-day
      shotBlastPerSqft: 0.008, // faster, but a machine most shops don't own
      coatingRemovalPerSqft: 0.03,
      crackChasePerLf: 0.15,
      primeCoatPerSqft: 0.004,
      baseCoatPerSqft: 0.008,
      flakeBroadcastPerSqft: 0.004,
      scrapeBackPerSqft: 0.008, // knocking down the flake before topcoat
      topCoatPerSqft: 0.005,
      coveBasePerLf: 0.3,
      maskingAndSetupHours: 2.0,
    },
    // Two mobilizations for an epoxy build coat: the base cures overnight
    // before the flake is scraped back and topcoated. Polyaspartic-only systems
    // are one day. It is a schedule fact and it is why a 480 sqft garage is a
    // two-day job that looks like a one-day job on paper.
    visitsBySystem: { epoxy_flake: 2, polyaspartic_only: 1, metallic: 2 },
    equipment: {
      concrete_grinder: {
        label: "Concrete grinder with HEPA extraction",
        basis: "day",
        cost: { cad: band(240, 300, 390), usd: band(190, 235, 305) },
        source: SOURCE.RENTAL,
        note: "The grinder and the dust extractor are two rentals at most counters. Renting the grinder alone and skipping the extractor is how a garage job coats the whole house in concrete dust.",
      },
      shot_blaster: {
        label: "Shot blaster",
        basis: "day",
        cost: { cad: band(390, 490, 640), usd: band(305, 385, 500) },
        source: SOURCE.RENTAL,
      },
    },
    waste: {
      // Mixing losses, what sets in the bucket, and the end of a kit that
      // cannot be saved. Lower than a tile or board waste factor because
      // nothing is cut, but it is never zero and the pot life guarantees it.
      resin: 0.05,
      flake: 0.15, // over-broadcast that is swept up and not reused
    },
  },

  // ── Flooring installation ─────────────────────────────────────────────
  flooring_install: {
    model: "area_material",
    label: "Flooring Installation",
    materials: {
      lvp_click: {
        label: "Luxury vinyl plank — click, with attached pad",
        pack: "per sqft",
        cost: { cad: band(3.2, 4.5, 7.0), usd: band(2.4, 3.4, 5.5) },
        source: SOURCE.TRADE,
      },
      laminate: {
        label: "Laminate — 12 mm AC4",
        pack: "per sqft",
        cost: { cad: band(2.0, 3.0, 4.5), usd: band(1.5, 2.2, 3.5) },
        source: SOURCE.TRADE,
      },
      engineered_hardwood: {
        label: "Engineered hardwood",
        pack: "per sqft",
        cost: { cad: band(5.5, 8.5, 13.0), usd: band(4.2, 6.5, 10.0) },
        source: SOURCE.TRADE,
      },
      solid_hardwood: {
        label: 'Solid hardwood — 3/4"',
        pack: "per sqft",
        cost: { cad: band(5.0, 7.5, 12.0), usd: band(3.8, 5.75, 9.5) },
        source: SOURCE.TRADE,
      },
      underlayment: {
        label: "Foam or cork underlayment",
        pack: "per sqft",
        cost: { cad: band(0.55, 0.85, 1.4), usd: band(0.4, 0.65, 1.1) },
        source: SOURCE.TRADE,
      },
      vapour_barrier: {
        label: "6 mil poly vapour barrier",
        pack: "per sqft",
        cost: { cad: band(0.1, 0.16, 0.24), usd: band(0.08, 0.12, 0.19) },
        source: SOURCE.TRADE,
      },
      urethane_adhesive: {
        label: "Urethane flooring adhesive",
        pack: "pail (4 gal)",
        coverage: { sqftPerPail: 200 },
        cost: { cad: band(155, 195, 250), usd: band(120, 150, 195) },
        source: SOURCE.TRADE,
      },
      cleats: {
        label: "Flooring cleats / staples",
        pack: "box (5,000)",
        coverage: { sqftPerBox: 1000 },
        cost: { cad: band(58, 72, 90), usd: band(45, 55, 72) },
        source: SOURCE.TRADE,
      },
      self_leveller: {
        label: "Self-levelling underlayment",
        pack: "bag (50 lb / 22.7 kg)",
        coverage: { sqftPerBagAtQuarterInch: 20 },
        cost: { cad: band(38, 48, 62), usd: band(30, 38, 50) },
        source: SOURCE.TRADE,
        note: "20 sqft a bag at 1/4\" is the number that shocks people. A 900 sqft floor needing a genuine 1/4\" lift is 45 bags, which is a pallet and a pump, not a mixing bucket.",
      },
      transition_strip: {
        label: "Transition strip / reducer",
        pack: "each",
        cost: { cad: band(28, 42, 65), usd: band(22, 32, 50) },
        source: SOURCE.TRADE,
      },
      shoe_moulding: {
        label: "Quarter round / shoe moulding",
        pack: "8 ft length",
        cost: { cad: band(7, 9.5, 14), usd: band(5.5, 7.5, 11) },
        source: SOURCE.TRADE,
      },
      stair_tread_retrofit: {
        label: "Retrofit stair tread & riser",
        pack: "each",
        cost: { cad: band(85, 130, 200), usd: band(65, 100, 155) },
        source: SOURCE.TRADE,
      },
    },
    labour: {
      // Per square foot, man-hours. LVP at 0.018 ⇒ ~440 sqft in an
      // eight-hour day, which is a competent installer in rooms with a
      // reasonable number of cuts. ASSUMPTION.
      lvpPerSqft: 0.018,
      laminatePerSqft: 0.016,
      engineeredNailPerSqft: 0.03,
      solidNailPerSqft: 0.035,
      glueDownAdderPerSqft: 0.01,
      tearOutCarpetPerSqft: 0.008,
      tearOutResilientPerSqft: 0.012,
      // Four to five times any other tear-out. Thinset does not let go, and
      // this single figure is the reason a tile-to-LVP conversion quoted off a
      // carpet-removal rate loses money.
      tearOutTilePerSqft: 0.045,
      levellingPerSqft: 0.02,
      transitionEach: 0.35,
      shoeMouldingPerLf: 0.05,
      stairTreadEach: 1.25,
      doorUndercutEach: 0.2,
      applianceMoveEach: 0.4,
      setupAndDeliveryHours: 1.0,
    },
    // Not hours. Wood and LVP move with the room they are going into, and a
    // floor laid the day it arrived is a floor that gaps or buckles. It is a
    // schedule constraint that blocks other trades and it belongs on the quote
    // as a date, not as a cost.
    acclimationDays: { lvp: 2, laminate: 2, engineered: 3, solid: 5 },
    equipment: {
      flooring_nailer: {
        label: "Pneumatic flooring nailer / stapler",
        basis: "day",
        cost: { cad: band(45, 58, 75), usd: band(35, 45, 60) },
        source: SOURCE.RENTAL,
      },
      floor_roller: {
        label: "100 lb floor roller",
        basis: "day",
        cost: { cad: band(35, 45, 60), usd: band(28, 35, 48) },
        source: SOURCE.RENTAL,
        note: "Glue-down only, and not optional on it — an unrolled glue-down floor telegraphs every trowel ridge.",
      },
      dumpster_10yd: {
        label: "10-yard dumpster",
        basis: "delivered and hauled",
        cost: { cad: band(450, 575, 750), usd: band(350, 450, 600) },
        source: SOURCE.TRADE,
      },
    },
    waste: {
      // Offcuts, and the first plank of every row that cannot be the last
      // plank of the row before it. Solid runs higher than click because
      // boards are graded and short pieces get culled at the rack.
      lvp: 0.08,
      laminate: 0.08,
      engineered: 0.1,
      solid: 0.12,
      // ADDED to the base, not multiplied by it. A diagonal LVP floor is
      // 0.08 + 0.05 = 13%.
      diagonalAdder: 0.05,
      herringboneAdder: 0.15,
      shoeMoulding: 0.12,
    },
  },

  // ── Tiling ────────────────────────────────────────────────────────────
  tiling: {
    model: "area_material",
    label: "Tiling",
    materials: {
      tile: {
        label: "Tile",
        pack: "per sqft",
        cost: { cad: null, usd: null },
        source: SOURCE.TRADE,
        // The countertop book's argument, applied to the other trade it is
        // true of. $2 porcelain and $40 marble are the same line item.
        gap: "Client-selected and spans 20:1 within one showroom. There is no default that is not a fiction — it is an allowance line the estimator fills from the client's actual selection. The sell-side book carries extras.tileSupplyPricePerSqft at 0 for the same reason.",
      },
      thinset_modified: {
        label: "Modified thinset mortar",
        pack: "bag (50 lb / 22.7 kg)",
        // Notch size decides coverage and nothing else does. A large-format
        // tile needs a 1/2" notch and gets HALF the coverage — which is why a
        // single "sqft per bag" figure would be wrong for half the jobs.
        coverage: { sqftPerBagQuarterNotch: 90, sqftPerBagHalfNotch: 45 },
        cost: { cad: band(19, 24, 32), usd: band(15, 19, 26) },
        source: SOURCE.TRADE,
      },
      grout_sanded: {
        label: "Sanded grout",
        pack: "bag (25 lb / 11 kg)",
        coverage: { sqftPerBag: 110 },
        cost: { cad: band(24, 31, 42), usd: band(19, 25, 34) },
        source: SOURCE.TRADE,
        note: '110 sqft assumes 12x24 tile with a 1/8" joint. Mosaic on the same bag covers a quarter of that — joint length per square foot is the driver, not area.',
      },
      uncoupling_membrane: {
        label: "Uncoupling / crack-isolation membrane",
        pack: "roll (54 sqft)",
        coverage: { sqftPerRoll: 54 },
        cost: { cad: band(125, 155, 195), usd: band(98, 120, 155) },
        source: SOURCE.TRADE,
      },
      waterproofing_liquid: {
        label: "Liquid waterproofing membrane",
        pack: "pail (3.5 gal)",
        coverage: { sqftPerPailTwoCoats: 55 },
        cost: { cad: band(110, 140, 180), usd: band(85, 108, 140) },
        source: SOURCE.TRADE,
        note: "55 sqft is the TWO-COAT figure for a shower. One coat over a floor goes twice as far and is not a shower assembly.",
      },
      backer_board: {
        label: '1/2" cement backer board',
        pack: "sheet (3 ft x 5 ft, 15 sqft)",
        cost: { cad: band(16, 20, 26), usd: band(13, 16, 21) },
        source: SOURCE.TRADE,
      },
      levelling_clips: {
        label: "Levelling clips and wedges",
        pack: "per sqft",
        cost: { cad: band(0.3, 0.45, 0.65), usd: band(0.24, 0.35, 0.52) },
        source: SOURCE.TRADE,
        note: "Clips are consumed — they snap off. Wedges are reused. Large format only; a 12x12 floor does not need them.",
      },
      silicone: {
        label: "Colour-matched silicone",
        pack: "tube (300 ml)",
        coverage: { linearFtPerTube: 25 },
        cost: { cad: band(11, 15, 20), usd: band(8.5, 11.5, 16) },
        source: SOURCE.TRADE,
      },
      edge_trim: {
        label: "Metal edge trim",
        pack: "8 ft length",
        cost: { cad: band(28, 42, 65), usd: band(22, 33, 50) },
        source: SOURCE.TRADE,
      },
      heating_mat: {
        label: "Electric floor heating mat",
        pack: "per sqft",
        cost: { cad: band(11, 14, 19), usd: band(8.5, 11, 15) },
        source: SOURCE.TRADE,
        note: "Mats are sold in fixed sizes and cannot be cut to fit. A 42 sqft room buys a 40 and a 10, or a 50 — order by the room, never by the square foot.",
      },
    },
    labour: {
      floorStandardPerSqft: 0.085, // ~95 sqft/day, 12x12 to 12x24 straight lay
      largeFormatPerSqft: 0.14, // levelling system, back-buttering, 24x48+
      mosaicPerSqft: 0.22,
      wallTilePerSqft: 0.13,
      showerSurroundPerSqft: 0.18,
      waterproofingPerSqft: 0.02,
      uncouplingPerSqft: 0.015,
      backerBoardPerSqft: 0.02,
      groutPerSqft: 0.02,
      patternAdderPerSqft: 0.03, // diagonal, herringbone, basketweave
      heatedFloorPerSqft: 0.035,
      edgeTrimPerLf: 0.08,
      nicheEach: 1.5,
      showerPanEach: 4.0,
      // Grouting is a SEPARATE DAY: thinset cures overnight and grouting into
      // green mortar is how a floor ends up hollow. This is the mobilization,
      // not the grouting itself, which is groutPerSqft above.
      returnVisitHours: 0.75,
      setupAndProtectionHours: 1.5,
    },
    equipment: {
      wet_saw: {
        label: "Rail wet saw",
        basis: "day",
        cost: { cad: band(65, 85, 110), usd: band(50, 66, 88) },
        source: SOURCE.RENTAL,
        note: "A 24x48 panel needs a rail saw with the travel to cross it. A table wet saw cannot make that cut and renting the wrong one loses a day.",
      },
      dumpster_10yd: {
        label: "10-yard dumpster",
        basis: "delivered and hauled",
        cost: { cad: band(450, 575, 750), usd: band(350, 450, 600) },
        source: SOURCE.TRADE,
        note: "Tile demolition is the heaviest debris in residential work. Weight allowance matters more than volume here.",
      },
    },
    waste: {
      // Breakage plus cuts. Large format is high not because it breaks more
      // but because every cut scraps a big piece.
      straightLay: 0.1,
      diagonal: 0.15,
      largeFormat: 0.15,
      herringbone: 0.2,
      mosaic: 0.1,
    },
    // NOT a waste fraction, and it lived in `waste` until the check refused it
    // for not being one — a square-foot count and a percentage cannot share a
    // block that something is going to multiply by. Ordering exactly the waste
    // factor and no more is how a job stops for three weeks waiting on a dye
    // lot that no longer exists; this is the attic stock left with the client,
    // and it is a real cost that is almost never quoted.
    atticStockSqft: 10,
  },

  // ── Window and door installation ──────────────────────────────────────
  window_door_install: {
    model: "unit_count",
    label: "Window & Door Installation",
    materials: {
      window_unit: {
        label: "Window unit",
        pack: "each",
        cost: { cad: null, usd: null },
        source: SOURCE.TRADE,
        gap: "Made to size, chosen by the homeowner, $400 to $4,000 depending on frame material, glazing package and size. An allowance line from the supplier's quote, never a default. The sell-side book carries extras.unitSupplyPrice at 0 for the same reason.",
      },
      exterior_door_unit: {
        label: "Exterior door unit",
        pack: "each",
        cost: { cad: null, usd: null },
        source: SOURCE.TRADE,
        gap: "Same as the window: a steel slab and a fibreglass door with sidelites are the same line item and a factor of eight apart.",
      },
      interior_prehung: {
        label: "Interior pre-hung door — hollow core, primed",
        pack: 'each (30" standard)',
        cost: { cad: band(130, 165, 220), usd: band(100, 128, 170) },
        source: SOURCE.TRADE,
        note: "Solid-core is roughly double and is what a client hears when they say the doors feel cheap.",
      },
      low_expansion_foam: {
        label: "Window & door low-expansion foam",
        pack: "can (20 oz)",
        coverage: { openingsPerCan: 2 },
        cost: { cad: band(10, 13, 17), usd: band(8, 10, 13.5) },
        source: SOURCE.TRADE,
        note: "LOW-EXPANSION specifically. Standard gap-filling foam bows a jamb and the door stops closing — a callback that costs more than the case.",
      },
      flashing_tape: {
        label: "Flexible flashing tape",
        pack: 'roll (4" x 75 ft)',
        coverage: { openingsPerRoll: 3.5 },
        cost: { cad: band(34, 44, 58), usd: band(26, 34, 45) },
        source: SOURCE.TRADE,
      },
      exterior_sealant: {
        label: "Exterior polyurethane sealant",
        pack: "tube (300 ml)",
        coverage: { openingsPerTube: 1.5 },
        cost: { cad: band(9.5, 12.5, 17), usd: band(7.5, 9.75, 13) },
        source: SOURCE.TRADE,
      },
      shims: {
        label: "Composite shims",
        pack: "bundle (42)",
        coverage: { openingsPerBundle: 4 },
        cost: { cad: band(9, 12, 16), usd: band(7, 9.5, 12.5) },
        source: SOURCE.TRADE,
      },
      casing: {
        label: "Interior casing — primed MDF",
        pack: "8 ft length",
        coverage: { lengthsPerWindowOpening: 3, lengthsPerDoorOpening: 5 },
        cost: { cad: band(8.5, 11.5, 16), usd: band(6.5, 9, 12.5) },
        source: SOURCE.TRADE,
        note: "Five lengths for a door because both sides get cased; a window gets one side plus a stool and apron.",
      },
      capping_coil: {
        label: "Aluminium capping coil",
        pack: 'roll (24" x 50 ft)',
        coverage: { openingsPerRoll: 10 },
        cost: { cad: band(175, 220, 290), usd: band(135, 170, 225) },
        source: SOURCE.TRADE,
      },
      sill_pan: {
        label: "Door sill pan",
        pack: "each",
        cost: { cad: band(38, 50, 68), usd: band(30, 39, 53) },
        source: SOURCE.TRADE,
        note: "The one part of an entry door install that is invisible and decides whether the subfloor rots. Skipped constantly.",
      },
    },
    labour: {
      // MAN-hours, and this trade is where that distinction bites: a glazed
      // unit needs two people to set it, so a 7-hour patio slider is three and
      // a half hours on site, not a day for one person. Scheduling off these
      // figures without halving them books twice the time.
      insertWindowEach: 2.5,
      fullFrameWindowEach: 5.0,
      interiorPrehungEach: 2.0,
      interiorSlabEach: 1.5,
      exteriorEntryDoorEach: 6.0,
      patioSliderEach: 7.0,
      stormDoorEach: 2.5,
      cappingPerOpening: 1.0,
      casingPerOpening: 0.75,
      locksetEach: 0.5,
      removalAndDisposalEach: 0.75,
      windowStoolAndApronEach: 1.0,
      barnDoorTrackEach: 2.0,
      // Ladders, staging, passing units up. ASSUMPTION, and it applies to the
      // install rows only — casing an upstairs window from the inside is a
      // ground-floor job.
      upperStoreyMultiplier: 1.4,
      setupHours: 1.0,
      // Rot is not estimated. It is billed at extras.rotRepairHourlyRate
      // against hours actually worked, agreed before the wall is opened.
      rotRepairHours: null,
    },
    equipment: {
      siding_brake: {
        label: "Siding / capping brake",
        basis: "day",
        cost: { cad: band(58, 72, 95), usd: band(45, 56, 74) },
        source: SOURCE.RENTAL,
      },
      scaffold_tower: {
        label: "Scaffold tower",
        basis: "day",
        cost: { cad: band(70, 90, 120), usd: band(55, 70, 95) },
        source: SOURCE.RENTAL,
        note: "Second storey and up. Working a window off a ladder is slower than the tower costs, before it is unsafe.",
      },
    },
    // Per opening, at a transfer station. Old windows are glass and metal and
    // are not curbside waste anywhere.
    disposalPerUnit: {
      label: "Transfer station fee per old unit",
      cost: { cad: band(20, 32, 48), usd: band(15, 25, 38) },
      source: SOURCE.TRADE,
    },
    waste: {
      casing: 0.15, // mitres
      capping: 0.2, // bends, scrap ends, a re-bend that does not fit
      flashing: 0.1,
    },
  },
};

/* ══ RECIPE EDITABLE FIELDS ════════════════════════════════════════════════
 *
 * Spread into RECIPE_EDITABLE_FIELDS in materialRecipes.js.
 *
 * The interior painting recipe reuses the `production_rate` model, so eleven
 * of its keys are ALREADY editable through the existing descriptor. These are
 * the four it adds that would otherwise be invisible in Settings > Material
 * Costs — a value written and never readable is the same failure as one read
 * and never written.
 */
export const INTERIOR_RECIPE_EDITABLE_FIELDS = {
  production_rate: [
    {
      key: "ceilingProductionRateSqftPerHour",
      label: "Ceiling production rate (sqft/hr)",
      type: "number",
      step: 1,
    },
    {
      key: "ceilingCoverageSqftPerGal",
      label: "Ceiling paint coverage (sqft/gal)",
      type: "number",
      step: 1,
    },
    {
      key: "popcornRemovalHoursPerSqft",
      label: "Popcorn removal (hours/sqft)",
      type: "number",
      step: 0.001,
    },
    {
      key: "defaultCoats",
      label: "Default coats",
      type: "number",
      step: 1,
    },
  ],
};

/* ══ ADD-ONS ═══════════════════════════════════════════════════════════════
 *
 * Spread into STANDARD_ADDONS. Shape is standardAddOns.js's exactly:
 * { name, unit, unitPrice, type, description }. These are seeded as Products,
 * so they appear in the quote builder's picker — which means a wrong price
 * here reaches a client document. Every price is the STANDARD-complexity rate
 * from the book above, so the two cannot disagree; the check asserts it.
 *
 * NOTE the deliberate asymmetry with DEFAULT_LINE_ITEMS, which ships prices
 * NULL. That file's rule is right for a suggestion chip typed onto a quote.
 * STANDARD_ADDONS is a different contract — it seeds an editable Product row a
 * company owns and reprices — and every existing entry in it carries a price.
 * Shipping these at null would make them the only priceless products in the
 * catalogue, which reads as broken rather than as careful.
 *
 * interior_painting and flooring get NO entries here: their extras are already
 * in DEFAULT_LINE_ITEMS and adding a second differently-worded copy is the
 * duplication AGENTS.md warns about. Their contribution from this file is the
 * COST recipe and the lineItemCosts linkage above.
 */
export const INTERIOR_ADD_ONS = {
  drywall: [
    {
      name: "Dust Containment",
      unit: "flat",
      unitPrice: 275,
      type: "service",
      description:
        "Poly walls, zipper door and negative air for the duration of the work.",
    },
    {
      name: "Return Visit — second coat",
      unit: "flat",
      unitPrice: 165,
      type: "service",
      description:
        "Compound has to dry before the finish coat. Most repairs are two visits.",
    },
    {
      name: "Texture Match",
      unit: "sqft",
      unitPrice: 3.0,
      type: "service",
      description:
        "Blend knockdown, orange peel or stipple into the surrounding surface.",
    },
    {
      name: "Corner Bead Replacement",
      unit: "linear ft",
      unitPrice: 14,
      type: "service",
      description: "Cut out damaged bead, refit and finish.",
    },
    {
      name: "Nail / Screw Pop Repair",
      unit: "each",
      unitPrice: 18,
      type: "service",
      description: "Refasten, fill and sand each pop.",
    },
    {
      name: "Furniture Moving & Protection",
      unit: "flat",
      unitPrice: 175,
      type: "service",
      description: "Move and sheet furniture, protect floors.",
    },
  ],

  drywall_install: [
    {
      name: "Level 5 Finish — skim coat",
      unit: "sqft",
      unitPrice: 2.2,
      type: "service",
      description:
        "A skim coat over the entire surface. Required for gloss and semi-gloss paint and for walls under critical light.",
    },
    {
      name: "Ceiling / Lid Surcharge",
      unit: "sqft",
      unitPrice: 0.45,
      type: "service",
      description: "Overhead hanging and finishing.",
    },
    {
      name: 'Upgrade — 5/8" Type X Fire-Rated Board',
      unit: "sqft",
      unitPrice: 0.35,
      type: "product",
      description:
        "Where the code calls for a rated assembly — garage ceilings, party walls, furnace rooms.",
    },
    {
      name: "Upgrade — Moisture-Resistant Board",
      unit: "sqft",
      unitPrice: 0.4,
      type: "product",
      description: "Bathrooms, laundry and basements.",
    },
    {
      name: "Upgrade — Sound-Damping Board",
      unit: "sqft",
      unitPrice: 2.6,
      type: "product",
      description: "Bedroom and media-room walls. The board itself is the cost.",
    },
    {
      name: "Resilient Channel",
      unit: "sqft",
      unitPrice: 1.35,
      type: "service",
      description: "Decouples the board from the framing for sound control.",
    },
    {
      name: "Debris Removal",
      unit: "flat",
      unitPrice: 550,
      type: "service",
      description: "Offcut removal and disposal.",
    },
  ],

  epoxy: [
    {
      name: "Moisture Test",
      unit: "flat",
      unitPrice: 285,
      type: "service",
      description:
        "Calcium chloride or relative-humidity probe test before committing to a system. A slab that fails needs a vapour barrier primer.",
    },
    {
      name: "Moisture Vapour Barrier Primer",
      unit: "sqft",
      unitPrice: 3.0,
      type: "service",
      description: "For slabs above the moisture limit of the coating.",
    },
    {
      name: "Crack Chase & Fill",
      unit: "linear ft",
      unitPrice: 14,
      type: "service",
      description: "Open, clean and fill cracks with polyurea before coating.",
    },
    {
      name: "Integral Cove Base",
      unit: "linear ft",
      unitPrice: 22,
      type: "service",
      description:
        "Coved transition from floor to wall — no seam for water to reach.",
    },
    {
      name: "Anti-Slip Aggregate",
      unit: "sqft",
      unitPrice: 0.85,
      type: "service",
      description: "Broadcast into the topcoat for wet areas and ramps.",
    },
    {
      name: "Control Joint Fill",
      unit: "linear ft",
      unitPrice: 9.0,
      type: "service",
      description: "Semi-rigid joint filler, applied before coating.",
    },
    {
      name: "Clear the Contents",
      unit: "flat",
      unitPrice: 250,
      type: "service",
      description: "Empty and return the contents of the garage or basement.",
    },
  ],

  flooring_install: [
    {
      name: "Tear Out Carpet & Underpad",
      unit: "sqft",
      unitPrice: 1.5,
      type: "service",
      description: "Lift, roll and remove carpet, underpad and tack strip.",
    },
    {
      name: "Tear Out Laminate, Vinyl or Tile",
      unit: "sqft",
      unitPrice: 2.75,
      type: "service",
      description: "Tile is the slowest of these by a wide margin.",
    },
    {
      name: "Subfloor Levelling",
      unit: "sqft",
      unitPrice: 4.5,
      type: "service",
      description:
        "Self-levelling underlayment. A floating floor over a wavy subfloor clicks apart.",
    },
    {
      name: "Underlayment / Moisture Barrier",
      unit: "sqft",
      unitPrice: 1.25,
      type: "product",
      description: "Foam or cork underlay, plus poly over a concrete slab.",
    },
    {
      name: "Transition Strip / Reducer",
      unit: "each",
      unitPrice: 65,
      type: "service",
      description: "Supply and fit at doorways and material changes.",
    },
    {
      name: "Quarter Round / Shoe Moulding",
      unit: "linear ft",
      unitPrice: 6.5,
      type: "service",
      description: "Supply, fit and finish.",
    },
    {
      name: "Stair Tread & Riser",
      unit: "each",
      unitPrice: 165,
      type: "service",
      description: "Matching retrofit tread and riser, per step.",
    },
    {
      name: "Disconnect & Move an Appliance",
      unit: "each",
      unitPrice: 95,
      type: "service",
      description: "Fridge, washer, dryer or stove moved out and back.",
    },
    {
      name: "Undercut Door Jamb",
      unit: "each",
      unitPrice: 35,
      type: "service",
      description: "Undercut jambs and trim doors for the new floor height.",
    },
    {
      name: "Furniture Moving",
      unit: "flat",
      unitPrice: 275,
      type: "service",
      description: "Move furniture out and back, room by room.",
    },
  ],

  tiling: [
    {
      name: "Waterproofing Membrane",
      unit: "sqft",
      unitPrice: 6.5,
      type: "service",
      description:
        "Liquid or sheet membrane. Not optional in a shower, whatever the tile is.",
    },
    {
      name: "Uncoupling / Crack-Isolation Membrane",
      unit: "sqft",
      unitPrice: 5.0,
      type: "service",
      description:
        "Over concrete or any substrate that moves. Stops a slab crack telegraphing through the tile.",
    },
    {
      name: "Shower Pan — sloped bed & waterproofing",
      unit: "each",
      unitPrice: 950,
      type: "service",
      description: "Sloped mortar bed, drain and full waterproofing.",
    },
    {
      name: "Shower Niche",
      unit: "each",
      unitPrice: 325,
      type: "service",
      description: "Frame, waterproof and tile a recessed niche.",
    },
    {
      name: "Metal Edge Trim / Bullnose",
      unit: "linear ft",
      unitPrice: 22,
      type: "service",
      description: "Finished edge where tile meets drywall or another material.",
    },
    {
      name: "Pattern Surcharge",
      unit: "sqft",
      unitPrice: 4.0,
      type: "service",
      description: "Diagonal, herringbone or basketweave — more cuts, more waste.",
    },
    {
      name: "Electric Floor Heating",
      unit: "sqft",
      unitPrice: 13,
      type: "product",
      description:
        "Heating mat supplied and set in the mortar bed. The thermostat connection is a separate electrical line.",
    },
    {
      name: "Heating Thermostat",
      unit: "flat",
      unitPrice: 285,
      type: "product",
      description: "Thermostat supplied and connected.",
    },
    {
      name: "Grout Sealing",
      unit: "sqft",
      unitPrice: 1.25,
      type: "service",
      description: "Penetrating sealer over cementitious grout.",
    },
    {
      name: "Demolition & Disposal",
      unit: "flat",
      unitPrice: 650,
      type: "service",
      description: "Remove existing tile and substrate, and dispose.",
    },
  ],

  window_door_install: [
    {
      name: "Remove & Dispose of Old Unit",
      unit: "each",
      unitPrice: 95,
      type: "service",
      description:
        "Old windows and doors are glass and metal and are not curbside waste.",
    },
    {
      name: "Exterior Aluminium Capping",
      unit: "each",
      unitPrice: 145,
      type: "service",
      description:
        "Bend and fit capping over the exterior frame, per opening. Maintenance-free finish.",
    },
    {
      name: "Interior Casing & Make Good",
      unit: "each",
      unitPrice: 135,
      type: "service",
      description: "Case the opening and make good to the surrounding wall.",
    },
    {
      name: "Window Stool & Apron",
      unit: "each",
      unitPrice: 145,
      type: "service",
      description: "Traditional sill and apron rather than a picture-framed jamb.",
    },
    {
      name: "Lockset / Hardware",
      unit: "each",
      unitPrice: 85,
      type: "product",
      description: "Supply and fit handle, deadbolt or passage set.",
    },
    {
      name: "Storm / Screen Door",
      unit: "each",
      unitPrice: 385,
      type: "service",
      description: "Fit a storm or screen door to an existing opening.",
    },
    {
      name: "Barn Door Track & Hardware",
      unit: "each",
      unitPrice: 275,
      type: "service",
      description: "Fit track, backing and hardware. Door supplied separately.",
    },
    {
      name: "Rot Repair — hourly",
      unit: "hour",
      unitPrice: 95,
      type: "service",
      description:
        "Framing repair found on opening the wall, billed against hours worked. Agreed before the wall is opened, not after.",
    },
    {
      name: "Measure & Order Visit",
      unit: "flat",
      unitPrice: 225,
      type: "service",
      description:
        "Site measure of every opening before ordering. Units are made to size and a wrong measurement is a six-week wait.",
    },
    {
      name: "Permit Handling",
      unit: "flat",
      unitPrice: 275,
      type: "service",
      description:
        "Prepare and submit the permit where an opening size changes or a bedroom egress is involved.",
    },
  ],
};

/* ══ WHERE EACH TRADE IS FILED ═════════════════════════════════════════════
 *
 * `industries` is the marketing industry slug list from app/data/industries.js,
 * declared on the trade in lib/trades/catalog.js. The check script resolves
 * every one against the real modules; it does not take these on trust.
 *
 * Four of the six already exist in TRADE_CATALOG with industries assigned, and
 * this file agrees with what is there rather than proposing a change. The two
 * that need a decision are called out.
 */
export const INTERIOR_TRADE_FILING = {
  drywall: {
    catalogKey: "drywall",
    proposed: false,
    industries: ["construction-contracting"],
    note: "Already in TRADE_CATALOG as 'Drywall', sortOrder 8. Unchanged. FLAG: whether `drywall` means repair and `drywall_install` means new work is my reading of the two-key split, not something the catalogue states.",
  },
  drywall_install: {
    catalogKey: "drywall_install",
    proposed: false,
    industries: ["construction-contracting"],
    note: "Already in TRADE_CATALOG as 'Drywall Installation', sortOrder 22. Unchanged.",
  },
  epoxy: {
    catalogKey: "epoxy",
    proposed: false,
    industries: [],
    // Not an oversight. lib/trades/catalog.js: "Giving them a slug is a product
    // decision (epoxy is sold by painters, by flooring installers and by
    // concrete contractors, and picking for them publishes an answer nobody
    // chose), so the gap is reported by scripts/check-trade-catalog.mjs rather
    // than papered over here." That decision is left exactly where it is.
    note: "Deliberately industry-less in the catalogue. Reachable through 'show other trades'. A price book does not change that and must not be used as a reason to pick one — the argument for painting is as good as the one for concrete.",
  },
  flooring_install: {
    catalogKey: "flooring_install",
    proposed: false,
    industries: ["construction-contracting"],
    note: "Already in TRADE_CATALOG as 'Flooring Installation', sortOrder 24. Unchanged. Note it sits under construction-contracting while `flooring` (refinishing) sits under painting — that is the catalogue's existing split, not one introduced here.",
  },
  tiling: {
    catalogKey: "tiling",
    proposed: false,
    industries: ["construction-contracting"],
    note: "Already in TRADE_CATALOG as 'Tiling', sortOrder 23. Unchanged.",
  },
  window_door_install: {
    catalogKey: "window_door_install",
    proposed: true,
    // What I would argue for, NOT what has been decided. Both slugs exist in
    // app/data/industries.js and the check verifies that much; whether the
    // trade is surfaced to either preset is the owner's call.
    industries: ["construction-contracting", "handyman"],
    note: "NO SUCH KEY IN TRADE_CATALOG. The nearest existing homes are `installation_services` (handyman; a generic mount-it row) and `carpentry`, and filing window replacement under either mislabels it everywhere a company looks. Adding the key is one line in lib/trades/catalog.js plus a seed; assigning the industries publishes this trade at signup and is a product decision. Until it is made, this book is unreachable and the check says so rather than pretending otherwise.",
  },
};

/* ── Readers ───────────────────────────────────────────────────────────── */
//
// Small, but present on purpose: every field above now has something that
// reads it, which is the difference between data and the written-never-read
// failure class in AGENTS.md. The check script uses all four.

/**
 * The cost figure for one market, or null when that market has no figure.
 *
 *   interiorCost(m.cost, "CAD")           -> 23.5   (the typical)
 *   interiorCost(m.cost, "USD", "low")    -> 16
 *
 * Returns null rather than falling back to the other currency. A CAD panel
 * showing a USD number without saying so is worse than showing nothing — it is
 * the same class of error electricalMaterials.js refuses to make by exporting
 * an FX ratio.
 */
export function interiorCost(cost, currency, edge = "typical") {
  if (!cost || typeof cost !== "object") return null;
  const side = cost[String(currency).toLowerCase()];
  if (!side || typeof side !== "object") return null;
  const v = side[edge];
  return Number.isFinite(v) ? v : null;
}

/** True when this file supplies a book for a category key. */
export function hasInteriorPriceBook(categoryKey) {
  return Object.prototype.hasOwnProperty.call(INTERIOR_PRICE_BOOKS, categoryKey);
}

/** The cost recipe for a category key, or null. */
export function getInteriorRecipe(categoryKey) {
  return Object.prototype.hasOwnProperty.call(INTERIOR_RECIPES, categoryKey)
    ? INTERIOR_RECIPES[categoryKey]
    : null;
}

/**
 * Every unit any book here charges by, derived from INTERIOR_PRICE_BOOK_FIELDS
 * the same way allPriceBookUnits() derives from PRICE_BOOK_FIELDS — so the
 * check can assert this file introduces no new unit vocabulary without
 * re-implementing the parse.
 */
export function interiorPriceBookUnits() {
  const units = new Set();
  for (const fields of Object.values(INTERIOR_PRICE_BOOK_FIELDS)) {
    for (const field of fields) {
      const match = /^\$\s*\/\s*(.+)$/.exec(String(field.suffix || "").trim());
      if (match) units.add(match[1].trim());
    }
  }
  return [...units];
}

/* ══ WIRING ════════════════════════════════════════════════════════════════
 *
 * Four spreads, and then two things that are not spreads.
 *
 *   app/data/tradePriceBooks.js
 *     TRADE_PRICE_BOOKS   ...INTERIOR_PRICE_BOOKS
 *     PRICE_BOOK_FIELDS   ...INTERIOR_PRICE_BOOK_FIELDS
 *     PRICE_BOOK_GROUPS   ...INTERIOR_PRICE_BOOK_GROUPS
 *     …and DELETE the local `tiers` helper above, calling the file's own
 *     private complexityFields() instead. It exists here only because that
 *     file is not mine to import from mid-session.
 *
 *   app/data/materialRecipes.js
 *     MATERIAL_RECIPES          ...INTERIOR_RECIPES
 *     RECIPE_EDITABLE_FIELDS    production_rate: [...existing,
 *                                 ...INTERIOR_RECIPE_EDITABLE_FIELDS
 *                                     .production_rate]
 *     NESTED_KEYS               add "materials", "labour", "equipment",
 *                               "waste", "lineItemCosts" — otherwise a company
 *                               overriding one material cost REPLACES the whole
 *                               materials map. This is the same trap the file
 *                               already documents for `consumables`/`paintTiers`
 *                               and the same one getPriceBook's array rule
 *                               guards against. It is the single most important
 *                               line in this section.
 *
 *   app/data/standardAddOns.js
 *     STANDARD_ADDONS     ...INTERIOR_ADD_ONS
 *
 *   lib/trades/catalog.js
 *     `window_door_install` needs a key, or these books are unreachable. See
 *     INTERIOR_TRADE_FILING — the industries are a product decision.
 *
 * NOT spreads, and both are real work:
 *
 *   1. Nothing reads a two-currency cost yet. Every existing consumer
 *      (lib/costing/tradeMaterials.js, quoteCosting.js) expects a bare number.
 *      They need to pick a side from the company's country — Company.country
 *      exists and scripts/backfill-company-country.mjs has populated it — and
 *      `interiorCost()` above is the accessor to route that through. Until
 *      that lands these recipes cost nothing, which is honest: they are data
 *      with no reader, and shipping them wired to a guessed currency would be
 *      worse than shipping them inert. Say so on the roadmap rather than
 *      letting a Canadian company price US drywall.
 *
 *   2. `lineItemCosts` is keyed by description STRING. That works today and
 *      the check asserts it, but electricalCatalog.js already found the better
 *      answer and wrote down why: "pointing by description string would
 *      silently break the moment somebody improves the wording — the
 *      written-never-read failure class, arriving as a benchmark nobody can
 *      reach." Giving the interior_painting and flooring chips a stable `key`
 *      the way the electrical ones have one is the permanent fix, and it is a
 *      change to somebody else's file.
 */
