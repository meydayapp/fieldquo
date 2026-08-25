// app/data/tradePriceBooks.js
//
// What each trade CHARGES, per quote type.
//
// CompanyServiceCategory could only express one number — a flat rate, a
// per-unit rate, or an hourly rate. Real trades don't price that way. A stair
// job is treads at one rate, risers at another, balusters at a third, and the
// whole grid moves when the staircase is ornate. A countertop is a supplier's
// invoice with a margin on it. Quoting either from a single `defaultRate`
// means doing the arithmetic in your head and typing a total, which is how
// estimates drift and how the quote stops explaining itself to the client.
//
// Structure mirrors app/data/materialRecipes.js on purpose: code defaults here,
// a per-company override merged over the top (CompanyServiceCategory.rates).
// A company that never opens the rates screen keeps inheriting improvements to
// these numbers; one that has edited theirs is never overwritten by them.
//
// PROVENANCE: these are TrueFinish Cabinets' live 2026 Ottawa rates, ported so
// a new tenant starts from numbers that won a real job rather than from zeros.
// They are one contractor's market. Every field is editable, and anything a
// tenant edits stops tracking these defaults.

// The roofing labour constants live in lib/pricing/roofLabour.js beside the
// engine that reads them, and are spread into the roofing book below so the
// rate card can edit them. One set of numbers, two consumers.
import { ROOF_LABOUR_DEFAULTS } from "@/lib/pricing/roofLabour";
import { PAVER_LABOUR_DEFAULTS } from "@/lib/pricing/paverLabour";
import { INSULATION_LABOUR_DEFAULTS } from "@/lib/pricing/insulation";

/* ── Shared vocabulary ─────────────────────────────────────────────────── */

export const COMPLEXITY_LEVELS = [
  { value: "standard", label: "Standard", color: "#10b981" },
  { value: "moderate", label: "Moderate", color: "#f59e0b" },
  { value: "high", label: "High", color: "#ef4444" },
];

/* ── The books ─────────────────────────────────────────────────────────── */

export const TRADE_PRICE_BOOKS = {
  // ── Cabinets ──────────────────────────────────────────────────────────
  // Priced per face — a door and a drawer front are each one unit. TrueFinish
  // charges one blended rate for both; split here because a shop that builds
  // drawer boxes differently needs to say so, and equal defaults reproduce the
  // blended behaviour exactly.
  cabinet_refinishing: {
    label: "Cabinet Refinishing",
    perDoor: 150,
    perDrawer: 150,
    // DOLLARS added to the unit price, not a percentage — an ornate kitchen
    // costs a fixed amount more per face to prep, regardless of the base rate.
    complexityUpchargePerUnit: { standard: 0, moderate: 20, high: 40 },
    addOns: {
      handleHolesPerDoor: 12,
      softCloseHingesPerDoor: 35,
      // No TrueFinish rate exists for this one — it is the hinge rate as the
      // nearest analogue. Check it before quoting off it.
      drawerSlidesPerDrawer: 35,
      twoToneFlat: 600,
      twoTonePerUnit: 15,
      threeToneFlat: 1000,
      threeTonePerUnit: 25,
    },
    // TrueFinish's "Essential" package floor. A small kitchen still needs a
    // full spray booth setup, so per-unit pricing alone under-recovers.
    minimumTotal: 3800,
  },

  // Refacing is priced per door exactly like refinishing — the difference is
  // that you are BUYING the door, so the material you pick moves both the sell
  // rate and the cost. The costs below come from real supplier quotes; they
  // feed the internal cost/margin panel and never appear on the client's copy.
  cabinet_refacing: {
    label: "Cabinet Refacing",
    perDoor: 550,
    perDrawer: 350,
    complexityUpchargePerUnit: { standard: 0, moderate: 20, high: 40 },

    // Selecting a material seeds perDoor/perDrawer and supplies the cost basis.
    // costPerSqft is what the door costs YOU, per square foot of face.
    defaultMaterial: "painted_mdf",
    doorMaterials: {
      thermofoil: {
        label: "Thermofoil",
        sellPerDoor: 450,
        sellPerDrawer: 280,
        costPerSqft: 18.0, // owner's figure
      },
      painted_mdf: {
        label: "Painted MDF",
        sellPerDoor: 550,
        sellPerDrawer: 350,
        // Raw MDF 10.50 (RTI) + supplier finishing 6.75 front and back (Caron).
        // Finish it in-house and the cost is the raw 10.50 instead.
        costPerSqft: 17.25,
        rawCostPerSqft: 10.5,
      },
      red_oak: {
        label: "Wood — red oak",
        sellPerDoor: 650,
        sellPerDrawer: 400,
        // Caron quote SX0845: flat panel door 24x16 (2.67 sf) at $74.85.
        costPerSqft: 28.04,
      },
      white_oak: {
        label: "Wood — white oak",
        sellPerDoor: 700,
        sellPerDrawer: 430,
        // Caron quote SX1089: solid raised square 76x49.2cm (4.02 sf) at $184.14.
        costPerSqft: 45.8,
      },
    },
    // A 24x18 door is exactly 3.0 sq ft; the Caron drawer front was 1.5 sq ft.
    // Used only to turn $/sq ft into a per-door cost for the margin estimate.
    avgDoorSqft: 3.0,
    avgDrawerSqft: 1.5,
    // Caron charges this per sq ft to spray front and back. Kept separate so a
    // shop that finishes in-house can zero it and use rawCostPerSqft instead.
    supplierFinishingPerSqft: 6.75,
    // Free with 20 doors at Caron, otherwise roughly this per order.
    freightPerOrder: 55,

    addOns: {
      handleHolesPerDoor: 12,
      softCloseHingesPerDoor: 35,
      drawerSlidesPerDrawer: 35,
      twoToneFlat: 600,
      twoTonePerUnit: 15,
      threeToneFlat: 1000,
      threeTonePerUnit: 25,
    },
    minimumTotal: 0,
  },

  // ── Stairs ────────────────────────────────────────────────────────────
  // Every element is counted and priced separately, and the whole grid shifts
  // with complexity. Risers, balusters and posts are opt-in: plenty of jobs
  // refinish treads and handrail only.
  stairs: {
    label: "Stair Refinishing",
    complexity: {
      standard: {
        desc: "Simple open staircase, good condition, standard profile",
        treadPrice: 150,
        riserPrice: 25,
        balusterPrice: 25,
        postPrice: 150,
        handrailPricePerFt: 15,
        landingPricePerSqft: 5,
        twoToneSurcharge: 800,
      },
      moderate: {
        desc: "Some repairs needed, curved sections, or intricate profile",
        treadPrice: 200,
        riserPrice: 30,
        balusterPrice: 32,
        postPrice: 200,
        handrailPricePerFt: 20,
        landingPricePerSqft: 6,
        twoToneSurcharge: 1100,
      },
      high: {
        desc: "Ornate details, heavy damage, or painted-over surfaces to strip",
        treadPrice: 275,
        riserPrice: 40,
        balusterPrice: 40,
        postPrice: 250,
        handrailPricePerFt: 28,
        landingPricePerSqft: 7,
        twoToneSurcharge: 1500,
      },
    },
    basementTreadPrice: 110,
  },

  // ── Hardwood flooring ─────────────────────────────────────────────────
  flooring: {
    label: "Hardwood Floor Refinishing",
    complexity: {
      standard: {
        desc: "Good-condition hardwood, standard refinish, one coat stain",
        pricePerSqft: 7.5,
        stainChangePricePerSqft: 0.75,
        waterDamagePrice: 350,
        gapFillingPricePerSqft: 0.5,
        furnitureMovingPrice: 150,
        stairBlendingPrice: 200,
      },
      moderate: {
        desc: "Minor repairs, some discoloration, moderate sanding required",
        pricePerSqft: 8.5,
        stainChangePricePerSqft: 1.0,
        waterDamagePrice: 500,
        gapFillingPricePerSqft: 0.75,
        furnitureMovingPrice: 200,
        stairBlendingPrice: 275,
      },
      high: {
        desc: "Significant damage, heavy sanding, board replacement likely",
        pricePerSqft: 10.5,
        stainChangePricePerSqft: 1.5,
        waterDamagePrice: 750,
        gapFillingPricePerSqft: 1.0,
        furnitureMovingPrice: 275,
        stairBlendingPrice: 375,
      },
    },
  },

  // ── Countertop ────────────────────────────────────────────────────────
  // The one trade priced from a supplier's invoice rather than from a rate
  // card: you get a number from the stone shop and sell it on. Installation is
  // bundled into the slab price by the installer, so it is NOT a separate
  // line. Every item carries a cost the client never sees — see
  // lib/pricing/tradeScope.js for how markup is applied and withheld.
  countertop: {
    label: "Countertop Supply & Installation",
    defaultMarkupPct: 30,
    materials: [
      "Quartz",
      "Granite",
      "Marble",
      "Quartzite",
      "Porcelain",
      "Dekton",
      "Butcher Block",
      "Laminate",
      "Concrete",
      "Other",
    ],
    // defaultCost is a starting figure, not a rate — the estimator replaces it
    // with the supplier's actual number. Zero means "no sensible default,
    // you must enter it", which is honest for stone that is priced per slab.
    items: [
      {
        id: "countertop",
        label: "Countertop Supply & Installation",
        kind: "supply",
        defaultCost: 0,
      },
      {
        id: "backsplash",
        label: "Backsplash",
        kind: "supply",
        defaultCost: 0,
        heightOption: "4in",
      },
      {
        id: "sink",
        label: "Sink / Undermount Cutout",
        kind: "supply",
        defaultCost: 0,
      },
      {
        id: "waterfall",
        label: "Waterfall Edge",
        kind: "supply",
        defaultCost: 0,
      },
      {
        id: "removal",
        label: "Countertop Removal",
        kind: "labour",
        defaultCost: 0,
      },
      // The one fee with a real default, per the owner: disposal is a known
      // cost, not a per-job quotation.
      { id: "disposal", label: "Disposal Fee", kind: "fee", defaultCost: 900 },
      { id: "travel", label: "Travel Fee", kind: "fee", defaultCost: 0 },
    ],
    backsplashHeights: {
      "3in": '3" Backsplash',
      "4in": '4" Backsplash',
      "6in": '6" Backsplash',
      full: "Full-Height Backsplash",
    },
  },

  // ── Interior painting ─────────────────────────────────────────────────
  // Priced room by room: walls by area, everything else per room or per item.
  interior_painting: {
    label: "Interior Painting",
    complexity: {
      standard: {
        desc: "Similar colour, good wall condition, standard 8–9 ft ceilings",
        wallPricePerSqft: 2.5,
        ceilingPrice: 175,
        trimPrice: 175,
        doorPrice: 45,
        closetPrice: 150,
        colorChangeSurcharge: 75,
        drywallPrepPrice: 200,
      },
      moderate: {
        desc: "Colour change, minor repairs, 9–10 ft ceilings, furnished home",
        wallPricePerSqft: 3.25,
        ceilingPrice: 225,
        trimPrice: 225,
        doorPrice: 60,
        closetPrice: 200,
        colorChangeSurcharge: 100,
        drywallPrepPrice: 300,
      },
      high: {
        desc: "Vaulted ceilings, extensive repairs, dark-to-light colour conversion",
        wallPricePerSqft: 4.5,
        ceilingPrice: 300,
        trimPrice: 300,
        doorPrice: 85,
        closetPrice: 275,
        colorChangeSurcharge: 150,
        drywallPrepPrice: 450,
      },
    },
    // Whole-job extras, not per room.
    global: {
      popcornRemovalPricePerSqft: 3.5,
      furnitureMovingPrice: 250,
    },
    roomTypes: [
      { value: "living_room", label: "Living Room", defaultSqft: 300 },
      { value: "dining_room", label: "Dining Room", defaultSqft: 180 },
      { value: "kitchen", label: "Kitchen", defaultSqft: 200 },
      { value: "master_bedroom", label: "Master Bedroom", defaultSqft: 250 },
      { value: "bedroom", label: "Bedroom", defaultSqft: 150 },
      { value: "bathroom", label: "Bathroom", defaultSqft: 60 },
      { value: "master_bathroom", label: "Master Bathroom", defaultSqft: 100 },
      { value: "hallway", label: "Hallway / Corridor", defaultSqft: 100 },
      { value: "stairwell", label: "Stairwell", defaultSqft: 120 },
      { value: "office", label: "Home Office", defaultSqft: 150 },
      { value: "laundry", label: "Laundry Room", defaultSqft: 80 },
      { value: "basement", label: "Basement / Rec Room", defaultSqft: 400 },
      { value: "other", label: "Other Room", defaultSqft: 150 },
    ],
  },

  // ── Exterior painting ─────────────────────────────────────────────────
  // Surfaces are measured and priced from the complexity grid; fixtures are
  // flat per item and don't move with complexity (a garage door is a garage
  // door whether the house is one storey or three).
  exterior_painting: {
    label: "Exterior Painting",
    complexity: {
      standard: {
        desc: "Single-story, good condition, straightforward prep and access",
        siding: 3.0,
        trim: 1.5,
        fascia: 4.0,
        deck: 2.5,
        fence: 2.0,
      },
      moderate: {
        desc: "Two-story, some peeling, moderate prep and caulking needed",
        siding: 4.0,
        trim: 2.25,
        fascia: 5.5,
        deck: 3.25,
        fence: 2.75,
      },
      high: {
        desc: "Multi-story, extensive scraping, significant prep or lead paint",
        siding: 5.5,
        trim: 3.0,
        fascia: 7.0,
        deck: 4.5,
        fence: 3.5,
      },
    },
    items: [
      {
        id: "siding",
        label: "Siding / Cladding",
        unit: "sqft",
        priceType: "siding",
      },
      { id: "trim", label: "Trim & Soffit", unit: "sqft", priceType: "trim" },
      { id: "fascia", label: "Fascia Boards", unit: "lf", priceType: "fascia" },
      {
        id: "front_door",
        label: "Front Door(s)",
        unit: "door",
        priceType: "flat",
        flatPrice: 200,
      },
      {
        id: "garage_door",
        label: "Garage Door",
        unit: "door",
        priceType: "flat",
        flatPrice: 350,
      },
      {
        id: "shutters",
        label: "Shutters",
        unit: "pair",
        priceType: "flat",
        flatPrice: 75,
      },
      { id: "deck", label: "Deck / Porch", unit: "sqft", priceType: "deck" },
      { id: "fence", label: "Fence", unit: "lf", priceType: "fence" },
    ],
    extras: {
      pressureWashingPrice: 350,
      primePricePerSqft: 0.5,
    },
  },

  // ── Garage doors (supply and install) ─────────────────────────────────
  // A different trade from the `garage_door` painting item above: that one
  // repaints the door you have, this one sells you a new one. The category
  // already existed (Garage Door Services, seed.js) with intake fields for
  // repair / install / spring replacement, but no book — so an install could
  // only be quoted by typing a total.
  //
  // Doors are priced per unit, not per square foot: a homeowner chooses a
  // model, not an area. The window options are separate models rather than an
  // upcharge because that is how they are ordered and how the client shops.
  //
  // Installation is included in the door price by default, which is how most
  // of this trade sells. A company that quotes supply-only unticks it, and the
  // door price drops by `installPricePerDoor` while a separate Installation
  // line appears — so the client sees what they are paying for either way.
  // That price ships as 0 on purpose: nobody has told us what this company
  // charges to hang a door, and a made-up default would be billed for real.
  // ── Snow removal ──────────────────────────────────────────────────────
  // Ottawa 2022–23, CAD, from a real signed seasonal contract (J.R. Lawn
  // Maintenance & Snow Removal, 1569 Michael St, Ottawa): a two-car
  // side-by-side driveway at $575.00 for the season, a $117.00 season overage
  // fee, and a $75.00 new-client discount, subtotal $617.00 before HST.
  //
  // Seasonal, not per-visit, because that is how the contract is written and
  // how the trade sells in this market. The season and the limit are part of
  // the price and print on the quote: "up to 250 cm as recorded by Environment
  // Canada OR 23 snow events of 4 cm+, whichever comes first" is the whole
  // difference between two numbers a homeowner is comparing.
  //
  // The 2022–23 prices are carried forward at 15% for 2026 — three seasons of
  // Canadian inflation. That uplift is the number in here most worth checking
  // against a current invoice.
  snow_removal: {
    label: "Snow Removal",

    // Two real Ottawa seasonal contracts, and they disagree in a way worth
    // recording rather than averaging away:
    //
    //   J.R. Lawn & Snow, 2022–23 — "Driveway Clearing" $575.00, plus a
    //   $117.00 season overage fee and a $75.00 new-client discount. Covers
    //   up to 250 cm OR 23 events of 4 cm+, whichever comes first.
    //
    //   SkyHigh Enterprises, 2025–26, Orleans — Basic snowblowing $440.00,
    //   Premium $528.00; shovelling $350.00 basic, $490.00 premium. Season
    //   ends at 250 cm or April 1.
    //
    // The CURRENT season is cheaper than the one three years older. This book
    // originally carried $660 for a double, from inflating the 2022–23 figure
    // by 15% — an assumption the 2025–26 contract contradicts. Seasonal snow
    // pricing is set by competition for a fixed number of driveways on a
    // route, not by input costs, and it has not tracked inflation. SkyHigh's
    // current numbers are the anchor; the 15% uplift is gone.
    //
    // Only the DOUBLE is a read figure. Single and triple are scaled from it
    // and say so — no source states a size ladder.
    plans: {
      basic: {
        label: "Basic — service at 5 cm and above",
        driveways: {
          single: 375, // scaled from the double, unverified
          double: 440, // SkyHigh 2025–26, read
          triple: 570, // scaled, unverified
          commercial: 0, // quoted per site; no rate to invent
        },
        shovelling: 350, // SkyHigh basic shovel service
      },
      premium: {
        label: "Premium — service from 2.5 cm, plow ridges unlimited",
        driveways: {
          single: 450, // scaled, unverified
          double: 528, // SkyHigh 2025–26, read
          triple: 685, // scaled, unverified
          commercial: 0,
        },
        shovelling: 490, // SkyHigh premium shovel service
      },
    },

    // "Shovel services are not available unless snowblowing service is
    // chosen" — SkyHigh's own contract. A real business rule, so the takeoff
    // enforces it rather than letting someone sell a walkway-only season the
    // company will not staff.
    shovellingRequiresDriveway: true,

    // Charged when the season runs past its limit, not quoted up front.
    // J.R.'s $117 from 2022–23, carried at the same 15% the driveway rate has
    // now lost — kept because nothing more recent contradicts it, and flagged
    // as the weakest number here.
    overageFee: 135,
    newClientDiscount: 85,

    extras: {
      saltPerApplication: 45,
      // For anyone selling per storm rather than by the season. Not in either
      // contract, so 0 — and the takeoff says so rather than billing nothing.
      perVisitPrice: 0,
    },

    season: {
      startsLabel: "November 1",
      endsLabel: "April 15",
      snowfallLimitCm: 250,
      eventLimit: 23,
      eventThresholdCm: 4,
    },
  },

  // ── Interlock and paving ──────────────────────────────────────────────
  // Ontario 2026, CAD, from ~30 contractors' own published rates rather than
  // cost-guide articles. The tiers ARE the published spread, not three
  // invented steps: patio $18–$40, walkway $18–$30, driveway $20–$40.
  //
  // These are INSTALLED rates. Almost every Ontario contractor who itemises
  // includes excavation, compacted granular base, bedding sand, edge restraint
  // and polymeric sand at the headline number — so a per-square-foot figure
  // means nothing without that scope, and it is stated here.
  //
  // A US source quotes labour at $4–$11/sqft. That is the LAYING step alone
  // against a base somebody else built; Ontario contractors put excavation and
  // base prep at $7–$13/sqft on their own. Building on the lower figure would
  // under-price by roughly half, so it is not used.
  paving: {
    label: "Interlock & Paving",
    complexity: {
      // Anchored to two REAL Ottawa jobs rather than to the endpoints of a
      // province-wide published range. Both are historical, so both are
      // escalated — see ESCALATION below.
      //
      //   standard  INTERLO-KING / INW, 636 Mikinak Rd, May 2020. A 262 sqft
      //             back-of-house patio, itemised: excavation $877.70,
      //             aggregates and base $872.46, Melville 60 slabs installed
      //             $2,332.80 = $4,082.96, or $15.58/sqft in 2020 money.
      //             ×1.32 → $20.57. Shipped at $21.
      //
      //   moderate  Custom Interlocking, 636 Mikinak Rd, Feb 2021. A 1,220
      //             sqft patio at $30,679.34 after a $550 quarry discount =
      //             $25.15/sqft in 2021 money. That job carried 12" of base in
      //             3 lifts, Techo-Bloc Blu 60 mm, snap edge, Gator G2,
      //             geotextile, fence-panel removal, disposal, grading, soil
      //             and seed, and a 3-year warranty — which is what "moderate"
      //             should mean. ×1.29 → $32.44. Shipped at $32.
      //
      //   high      No real job in evidence, so this stays at the top of the
      //             published Ontario range rather than being extrapolated.
      //
      // ESCALATION. Not estimates any more — Statistics Canada, table
      // 18-10-0289-01, Building construction price indexes, Ottawa–Gatineau
      // (Ontario part), residential, 2026 Q2:
      //
      //   Earthwork (excavation)        80.8 → 113.6   ×1.406 from 2020 Q2
      //   Exterior improvements         88.3 → 108.4   ×1.228 from 2020 Q2
      //
      // Those two divisions ARE this scope, and they are installed-price
      // indexes: labour, material, equipment, overhead and profit are already
      // inside them, so no weighting is needed. Blended across a paving mix
      // they give ×1.32 from May 2020 and ×1.29 from February 2021, which a
      // wholly independent bottom-up blend (Canada-wide IPPI/RMPI for concrete
      // and aggregates against Ontario construction wage indexes) reproduces
      // at 1.30–1.33 and 1.28–1.30.
      //
      // ×1.40 was too high by about 6%. The larger error was the GAP between
      // the two factors: 1.40/1.30 asserts 7.7% escalation between May 2020
      // and February 2021, and Ottawa BCPI says exterior improvements moved
      // 1.6% and earthwork 3.0% over that window. The hardscaping run-up came
      // in 2022 — after both base dates — so the 2020 figure was carrying
      // inflation that had not happened yet.
      //
      // Do NOT reach for the headline residential composite (×1.64). It is
      // dominated by framing, finishes and mechanical trades that took the
      // 2021 lumber shock; hardscaping did not. Ontario-wide runs hotter than
      // Ottawa on every division because it is Toronto-weighted.
      //
      // These are re-pullable quarterly rather than re-estimated. 2026 Q2 is
      // the latest published quarter and is subject to revision.
      standard: {
        desc: "Simple shape, good access, level ground, existing surface already gone",
        patioPricePerSqft: 21,
        walkwayPricePerSqft: 21,
        drivewayPricePerSqft: 24,
      },
      moderate: {
        desc: "Curves or cuts, a slope, deeper base, premium stone, or full grading and seed",
        patioPricePerSqft: 32,
        walkwayPricePerSqft: 29,
        drivewayPricePerSqft: 34,
      },
      high: {
        desc: "Heavy cutting, tight access, significant grading or clay excavation",
        patioPricePerSqft: 42,
        walkwayPricePerSqft: 36,
        drivewayPricePerSqft: 45,
      },
    },

    // Retaining and garden walls, with steps built into them.
    //
    // No published source priced these at all — I said so when the paving book
    // shipped, and left them out rather than inventing them. The INW invoice
    // supplies them: its Steps / Garden / Retaining Walls section totals
    // $2,751.77 over 75 sqft of Melville Tandem veneer face — base prep
    // $464.52, structural units $943.16, veneer $842.25, starter units
    // $159.12, capping $342.72 — which is $36.69 per square foot of wall FACE
    // in 2020. ×1.32 → $48.43.
    //
    // Steps are not separable from that total: the invoice bundles "step
    // include veneer" into the same section. So there is no per-step price
    // here, because the source does not contain one — a wall with steps in it
    // is quoted by its face area, which is how the invoice quoted it.
    wallPricePerFaceSqft: 48,
    // The single most useful sentence in the research, encoded: the published
    // installed rates assume the paver itself does not exceed $7/sqft. Choose
    // a premium stone and only the DIFFERENCE is added, because the allowance
    // is already inside the rate above — adding the full paver price would
    // charge for it twice.
    paverAllowancePerSqft: 7,
    // Canadian retail, read Aug 2026 across Home Depot's 124-SKU and Rona's
    // 72-SKU paver categories. Budget grey slabs $1.82–$4.49/sqft; standard
    // interlock $4.45–$9.94 split by thickness — 50 mm patio-only $4.45–$4.94,
    // 60 mm driveway-rated $5.43–$9.94; premium/architectural $4.57–$9.94.
    // Natural stone is quoted rather than shelf-priced, so it sits at the
    // allowance for a company to overwrite with its own supplier number.
    //
    // `minThicknessMm` is what decides whether a paver may go on a driveway.
    // NOT the retailer's own "for use on driveway" field: the identical
    // 203×102×50.8 mm Oldcastle block reads "No" in Charcoal and "Yes" in Barn
    // Red on the same site. Thickness is consistent; the flag is not.
    paverOptions: {
      budget: {
        label: "Budget concrete slab",
        costPerSqft: 3,
        minThicknessMm: 50,
      },
      standard: {
        label: "Standard interlock (60 mm)",
        costPerSqft: 6,
        minThicknessMm: 60,
      },
      premium: {
        label: "Premium / architectural",
        costPerSqft: 9,
        minThicknessMm: 60,
      },
      natural: { label: "Natural stone", costPerSqft: 7, minThicknessMm: 60 },
    },
    // A driveway needs 60 mm minimum. Neither big-box retailer sells 80 mm at
    // all — 60 mm is the thickest either carries — so an 80 mm spec means a
    // hardscape supplier and a price this book does not have.
    drivewayMinThicknessMm: 60,
    extras: {
      // Every figure below is the midpoint of a range a contractor published,
      // never a guess at a number nobody stated.
      poorAccessPerSqft: 5.5, // $3–$8
      curvesCutsPerSqft: 4, // $3–$5
      removeExistingPerSqft: 5.5, // $3–$8
      // "Up to $2/sqft" for a thicker driveway paver over a 50 mm patio one —
      // a stated maximum, so it ships at the maximum.
      drivewayPaverUpchargePerSqft: 2,
      permeableUpliftPct: 15, // +10%–20%
      sealingPerSqft: 3, // $2–$4
    },
    // Not published by ANY of the thirty-odd sources: a dollar minimum charge,
    // a per-sqft slope premium, a per-sqft clay premium, steps, retaining
    // walls, seat walls or fire pits. They are absent rather than invented.
    // The published rates assume at least 500 sqft and 3 ft of machine access;
    // below that every contractor says the rate goes up, and the takeoff says
    // so on screen.
    assumesMinSqft: 500,
    minimumTotal: 0,

    // Man-hours per square foot, for the internal cost estimate and for telling
    // a client how long the crew will be on site. No Ontario source publishes a
    // productivity figure, so this comes from two real jobs — and they disagree
    // in a way that matters.
    //
    //   Welandscaping, 2023 — 7 days, 3 crew, ~161 man-hours over roughly 960
    //   sqft of interlock. That is 0.168 h/sqft, BUT the same seven days also
    //   built a deck with railings, a porch concrete overlay, river rock beds
    //   and lighting. So 0.168 is an upper bound on interlock, not a
    //   measurement of it.
    //
    //   Custom Interlocking, 2021 — 1,220 sqft, "6 Days to complete", and pure
    //   interlock: 12" excavation, three compacted lifts, snap edge, polymeric
    //   sand, grading and seed, nothing else. At a 3-person crew on 8-hour days
    //   that is 144 man-hours, or 0.118 h/sqft.
    //
    // The crew size on the second job is NOT stated — that is the assumption
    // this number rests on, and it is the thing to check first. At two crew it
    // would be 0.079, at four 0.157.
    //
    // 0.12 is the second job's figure, which the first corroborates as an upper
    // bound. The 0.175 this shipped with was measured on a job that was only
    // partly paving and ran ~45% long as a result.
    // Kept as the sanity check the component model is measured against, and
    // as the fallback for anything that has not been taught to call
    // lib/pricing/paverLabour.js. It is no longer what the cost panel uses:
    // a flat rate has no fixed component and cannot see how deep the hole is.
    // See that file for why, and for how the anchor job reproduces at 148
    // crew-hours against the invoice's stated six days.
    labourHoursPerSqft: 0.12,

    // How long it takes, as opposed to what it sells for. Spread rather than
    // restated so the engine, the rate card and the cost panel read one set of
    // numbers.
    labour: { ...PAVER_LABOUR_DEFAULTS },

    // What the materials COST, as opposed to what the job sells for. Internal
    // only — this drives the margin panel and the job's sourcing list, and
    // never appears on anything a client reads.
    //
    // ── Two Ottawa suppliers, read August 2026, and they agree ──────────────
    //
    // Greely Sand & Gravel publishes a delivered ladder rather than a rate.
    // Fitting it gives a marginal cost and a fixed delivery, and the fit is
    // exact at every published quantity from 1 to 16 cubic yards:
    //
    //   Granular A   $33.50/cu yd + $190 delivery   (1 cy $223.50 … 16 cy $726.08)
    //   Stonedust    $30.25/cu yd + $190 delivery
    //
    // At a full 16-yard load that is $45.38/cu yd all in. Manotick Gardens,
    // independently, lists Granular "A" at $45.00/cu yd and screened sand at
    // $43.00. Two suppliers, two pricing models, 0.8% apart.
    //
    // Delivery is carried SEPARATELY rather than smeared into the yardage,
    // because $190 on an 11-yard patio is $17/yd and on a 60-yard driveway is
    // $3 — the same fixed-cost lesson the labour engines needed, arriving this
    // time in the material.
    materialCosts: {
      gravelPerCuYd: 45,
      sandPerCuYd: 43,
      deliveryPerLoad: 190,
      cuYdPerLoad: 16,
      // No source read for these three, so they ship unset rather than
      // invented. The bill of materials still lists them with a quantity, and
      // the cost panel says how many lines have no price on them.
      polySandPerBag: null,
      edgeRestraintPerLength: null,
      geotextilePerRoll: null,
    },
  },

  // ── Driveway sealing ──────────────────────────────────────────────────
  // Ontario 2026, CAD. Six sources; the per-square-foot rate clusters hard at
  // $0.35–$0.55 (D&D Home Services, Kitchener–Waterloo) with Wolf ($0.35–0.40)
  // and Project Landscaping ($0.15–0.50) agreeing. One Canadian domain quotes
  // $1.75–$2.10 — that is verbatim US HomeAdvisor data and is NOT used here.
  //
  // The tiers follow the spread the sources describe rather than three
  // invented steps: the cheap end is a plain rectangle in good condition, the
  // expensive end is what every source says pushes the rate up — cracking,
  // curves, slope, tight corners.
  driveway_sealing: {
    label: "Driveway Sealing",
    complexity: {
      standard: {
        desc: "Good condition, straight rectangular drive, easy access",
        sealPricePerSqft: 0.35,
      },
      moderate: {
        desc: "Some cracking, a curve or a slope, tighter access",
        sealPricePerSqft: 0.45,
      },
      high: {
        desc: "Heavy cracking, irregular shape, steep slope or difficult access",
        sealPricePerSqft: 0.55,
      },
    },
    // A second coat is charged at the same rate as the first. Action Home
    // Services sells a two-coat package at $0.80/sqft against a single-coat
    // market of $0.35–$0.55, which is the only stated two-coat price in the
    // research — no source prices a second coat as its own line, so this is
    // derived from that pair and is the number most worth checking.
    secondCoatMultiplier: 1,
    extras: {
      // $1–$3 per linear foot (D&D); hot rubber specifically $1.00–$1.15
      // (Wolf, Calgary), so the top of the range covers wide or difficult
      // cracks rather than a hot-vs-cold premium. Midpoint of a stated range,
      // not a guess at an unstated one.
      crackFillPerFt: 2.0,
      // Action Home Services includes the first 20 linear feet per day.
      crackFillIncludedFt: 20,
      // $50–$150 by severity (Project Landscaping).
      stainTreatmentPrice: 100,
      // Sold separately at $0.30–$0.55/sqft (Project Landscaping).
      pressureWashPerSqft: 0.4,
      // Material-only upgrade, $0.05–$0.15/sqft (D&D).
      premiumSealerPerSqft: 0.1,
      // $50–$100 beyond 30 km (Project Landscaping).
      travelSurchargePrice: 75,
    },
    // No source states a minimum job charge, so this ships at 0 rather than
    // invented. At $0.35/sqft a 200 sqft drive quotes at $70, which is below
    // what anyone will drive out for — set it before quoting small jobs.
    minimumTotal: 0,
    // Sealcoating is fast: a two-person crew does a typical driveway inside a
    // morning. No source publishes a rate, so this is a working figure to
    // replace with your own, and it is small enough that getting it wrong
    // moves a quote by tens of dollars rather than thousands.
    labourHoursPerSqft: 0.004,
  },

  // ── Home inspection ───────────────────────────────────────────────────
  //
  // PROVENANCE. Exactly ONE number here is read from a document:
  //
  //   Avelar Home Inspection Inc. (Ottawa), invoice 1898, 2025-06-07
  //     FHI06  "Full Home Inspection - 3000-3499 sqft" .... $625.00
  //     HIC-04 "Construction Performance Guideline
  //             Inspection (30-day, 6-Month, Year End)" ... $150.00
  //     subtotal $775.00, HST (ON) 13% $100.75, total $875.75
  //
  // Everything else is either read from an Ontario inspector's OWN published
  // price page (marked "own page" with the firm and city) or derived from the
  // $625 anchor by a stated rule (marked DERIVED). Nothing is a guess, and
  // where no Ontario firm publishes a figure the field ships at 0 with a note
  // the takeoff screen shows — cost-guide articles and US aggregator ranges
  // were found and deliberately not used.
  //
  // THE BAND STRUCTURE is inferred from the SKU. FHI06 is the 3000–3499 band;
  // five 500-wide bands below it land FHI01 exactly on "up to 999", which is
  // the only band layout consistent with the code. Consistent is not the same
  // as confirmed — Avelar's ladder is behind their booking widget and only the
  // one band was ever seen.
  //
  // THE STEP is $50 per 500 sq ft band, DERIVED. It is the modal step across
  // seven Ontario ladders: Cherry Home Inspections (Brantford, own page) runs
  // a flat $50 per 500 sq ft; Artech Home Inspection (Ottawa, own page) and
  // Homestar (GTA, own page) both state "$100 per 1,000 sq ft" for area above
  // their top band; Crooker Hancox (Kitchener, own page) charges $10 per 100
  // sq ft — the same slope reached three different ways.
  //
  // WHERE THE LADDER IS WEAKEST: the bottom. Nearly every published Ontario
  // ladder FLATTENS below about 2,000 sq ft into one wide base band, so a
  // straight-line extrapolation five bands down from $625 under-prices small
  // homes against the market (Inspectionly's floor is $499, iInspect360's
  // $475, Cherry's $525). Avelar's own SKU numbering argues they do band the
  // bottom finely — but the two smallest bands here are the first two numbers
  // an inspector should overwrite.
  //
  // The $625 sits mid-market for Ottawa: Artech (Ottawa, own page) quotes
  // $625+ for the same class of home, Armada (Kingston, own page) $650, Cherry
  // (Brantford, own page) $675.
  home_inspection: {
    label: "Home Inspection",
    // Keyed map, not an array — `mergeDeep` replaces arrays wholesale, so a
    // company editing one band price on the rate card would silently discard
    // the other eight. Same reasoning as the garage door catalogue.
    //
    // `maxSqft` is the band's inclusive ceiling. Order is enforced by that
    // number at read time (see inspectionBandFor), not by insertion order.
    bands: {
      b01: { label: "Up to 999 sq ft", maxSqft: 999, price: 375 },
      b02: { label: "1,000–1,499 sq ft", maxSqft: 1499, price: 425 },
      b03: { label: "1,500–1,999 sq ft", maxSqft: 1999, price: 475 },
      b04: { label: "2,000–2,499 sq ft", maxSqft: 2499, price: 525 },
      b05: { label: "2,500–2,999 sq ft", maxSqft: 2999, price: 575 },
      // ── The one read figure in this book ──
      b06: { label: "3,000–3,499 sq ft", maxSqft: 3499, price: 625 },
      b07: { label: "3,500–3,999 sq ft", maxSqft: 3999, price: 675 },
      b08: { label: "4,000–4,499 sq ft", maxSqft: 4499, price: 725 },
      b09: { label: "4,500–4,999 sq ft", maxSqft: 4999, price: 775 },
    },
    // Above the top band the ladder would otherwise stop, and a 9,000 sq ft
    // house would quote at the 4,500 price with nobody noticing until the
    // inspector had spent a day in it. Artech (Ottawa) and Homestar (GTA) both
    // publish this rule in almost identical words — "$100 for additional
    // square footage, per 1,000 sq ft or portion thereof" — so it is read, not
    // invented, and it is the same slope as the band step above.
    oversize: {
      label: "Additional square footage beyond the largest band",
      pricePer1000Sqft: 100,
    },
    // The invoice's second line. $150 per visit reproduces it exactly at
    // quantity 1. Avelar's own booking page describes the CPG inspection as
    // "an additional fee of $150.00 beyond the Standard Home Inspection",
    // which is why it is priced per visit rather than as a package: the
    // invoice sold one, and the three milestones are months apart.
    //
    // Corroboration: Ottawa Home Inspections (own page) sells warranty phases
    // at $499–$699 for the first and $145–$175 for each subsequent one. $150
    // sits inside that subsequent-phase band.
    //
    // The label repeats the invoice's own wording. Note that Tarion has no
    // official 6-month milestone — the Year-End form merely OPENS for
    // additions on day 183 — so "6-month" is the trade's name for a real and
    // useful visit, not a statutory one. Left as the invoice says it because
    // that is what an Ontario client will have been told to ask for.
    warrantyInspection: {
      label:
        "Construction Performance Guideline inspection — 30-day, 6-month or year-end",
      price: 150,
      note: "Charged per milestone visit, in addition to a standard inspection",
    },
    // Ancillary services and surcharges. Same keyed-map reasoning as the
    // bands. `countable` means the estimator types a number rather than just
    // ticking a box — two wood stoves is two WETT inspections, and travel is
    // charged by the kilometre.
    ancillary: {
      radon_short: {
        label: "Radon test — 48-hour short-term device",
        price: 100,
        note: "Barrhaven Home Inspectors (Ottawa, own page): $100 booked with the inspection",
      },
      radon_long: {
        label: "Radon test — 3-month long-term device",
        price: 150,
        note: "Barrhaven Home Inspectors (Ottawa, own page)",
      },
      wett: {
        label: "WETT inspection — wood-burning appliance",
        price: 250,
        unit: "appliance",
        countable: true,
        note: "Parish (own page) $250 bundled Level 1; Cherry (Brantford, own page) $275",
      },
      septic: {
        label: "Septic system inspection",
        price: 350,
        note: "Parish and Cherry publish the identical $350 bundled rate — the strongest ancillary figure found",
      },
      // Every specific well / potability figure found was American
      // (Thumbtack, HomeAdvisor). Twin Peaks states a $400–$700 Ontario
      // market range but explicitly not as their own rate. A number is not
      // shipped here for that reason; the takeoff says so on the row.
      well_water: {
        label: "Well inspection and water sampling",
        price: 0,
        note: "No Ontario inspector publishes a rate — every figure found was US. Set your own.",
      },
      air_quality: {
        label: "Mould / air quality sampling",
        price: 195,
        unit: "sample",
        countable: true,
        note: "iInspect360 (own page) $195 per sample, three-sample minimum is common",
      },
      thermal: {
        label: "Thermal imaging scan",
        price: 250,
        note: "Standalone price (iInspect360, own page). Most Ontario inspectors now include thermal imaging in the inspection at no charge — check before adding this.",
      },
      // The only re-inspection figure in the whole survey was one firm's WETT
      // revisit. One data point for a different service is not a rate.
      reinspection: {
        label: "Re-inspection of completed repairs",
        price: 0,
        note: "No Ontario inspector publishes a general re-inspection fee. Set your own.",
      },
      age_surcharge: {
        label: "Home built 1950 or earlier — additional inspection time",
        price: 70,
        note: "Avelar's own booking page. Ontario firms range $25–$70; Avelar sits at the top with the strictest trigger.",
      },
      travel_km: {
        label: "Travel beyond an 80 km round trip",
        price: 0.82,
        unit: "km",
        countable: true,
        note: "Avelar's own booking page: $0.82 per additional kilometre",
      },
    },
    // No Ontario source states a minimum call-out for an inspector, and the
    // smallest band is already an effective floor for a full inspection. It
    // ships at 0 rather than invented — but an ancillary-only sale (a $100
    // radon test on its own) has no floor at all until this is set.
    minimumTotal: 0,
    // Deliberately no `labourHoursPerSqft`. An inspection takes two to four
    // hours and nobody publishes a production rate per square foot; a made-up
    // one would feed the margin panel and the schedule with fiction.
    // tradeLabourHours() returns 0 for a book that states none.
  },

  garage_door: {
    label: "Garage Door Installation",
    // Keyed maps rather than arrays, and not for taste: `mergeDeep` replaces
    // arrays wholesale, so a company editing one door price through the rate
    // card would write `doors: {0: {price: …}}` over an array and the merge
    // would silently discard it. Keys merge; indices don't. Insertion order is
    // the display order.
    doors: {
      d8x7_no_window: { label: "8×7 garage door — no window", price: 1150 },
      d8x7_top_window: { label: "8×7 garage door — top window", price: 1400 },
      d8x7_side_window: { label: "8×7 garage door — side window", price: 1600 },
      // $1,999 in 2025, $2,049 for 2026 — the owner's number, confirmed, not
      // an inflation guess to redo next year.
      d16x7_black_flush: { label: "16×7 black flush garage door", price: 2049 },
    },
    capping: {
      cap_8x7: { label: "Aluminum capping frame — 8×7", price: 350 },
      cap_16x7: { label: "Aluminum capping frame — 16×7", price: 499 },
    },
    installIncluded: true,
    installPricePerDoor: 0,
    // Said on the door's own line rather than as a "what's included" bullet on
    // the whole category. The same category also covers spring replacements
    // and repairs, and "fully insulated for maximum comfort" printed on a
    // broken-spring callout is a claim about nothing that was sold.
    doorSpec: "Fully insulated for maximum comfort · custom framing",
    installNote: "Professional installation included",
    warrantyNote: "Made in Canada · 5-year manufacturer warranty",
  },

  roofing_service: {
    label: "Roofing",

    // Keyed map, not an array — mergeDeep replaces arrays wholesale, so a
    // company editing one shingle rate on the rate card would silently discard
    // the other six. Same reasoning as the garage door catalogue.
    //
    // The starting rates are deliberately IDENTICAL to
    // INSTANT_ESTIMATE_DEFAULTS.roofing in lib/estimate/instantEstimate.js.
    // They are two tables for two different jobs — that one is the public
    // ballpark a stranger gets from an address, this one is the estimator's
    // builder — stored and overridden separately. What they must never do is
    // disagree on day one, because a company that tunes one and not the other
    // ends up with a website quoting a price its own office doesn't recognise.
    //
    // `labourFactor` rides with the rate rather than living in a second table:
    // a company that adds standing seam sets what it sells for and how much
    // slower it is to lay in the same place, instead of having to remember
    // that a separate labour map exists.
    materials: {
      asphalt_3tab: {
        label: "3-tab asphalt shingles",
        pricePerSquare: 400,
        labourFactor: 0.95,
        // GAF Marquis WeatherMax Autumn Brown 3-Tab, 33.3 sqft per bundle,
        // Home Depot Canada (Gatineau), read 25 Aug 2026. Three to a square
        // is $99.54 of shingle against a $400 sell. BP Dakota 3-tab (32.3
        // sqft, $38.76) and BP Yukon ($39.76) bracket it from above.
        materialCostPerBundle: 33.18,
      },
      asphalt_arch: {
        label: "Architectural shingles",
        pricePerSquare: 550,
        labourFactor: 1,
        // GAF Timberline HDZ Charcoal, 33.3 sqft per bundle, $41.93 — Home
        // Depot Canada (Gatineau), read 25 Aug 2026. $125.79 a square.
        // Cross-check: Owens Corning TruDefinition Duration is 32.8 sqft at
        // $47.20, or $143.90 a square. Same market, different brand.
        materialCostPerBundle: 41.93,
      },
      asphalt_premium: {
        label: "Premium / designer shingles",
        pricePerSquare: 700,
        labourFactor: 1.15,
        // GAF Slateline Royal Slate Designer Laminated, 33.3 sqft per bundle,
        // $69.67 — Home Depot Canada, read 25 Aug 2026. Chosen over Camelot II
        // (25 sqft, $32.45) and Grand Sequoia (20 sqft, $60.49) because it is
        // the one designer line that still packs three to a square, so the
        // default packaging holds. A company laying Camelot sets 4 below.
        materialCostPerBundle: 69.67,
      },
      metal_corrugated: {
        label: "Corrugated / ribbed metal",
        pricePerSquare: 850,
        labourFactor: 1.5,
        // Vicwest Cladding UltraVic, 36" x 93" 28-gauge steel, $72.28 — Home
        // Depot Canada, read 25 Aug 2026. The product page states 36" of net
        // coverage per sheet (the side lap is outside the 36"), so one panel
        // is 23.25 sqft and 100/23.25 = 4.3 panels to a square.
        bundlesPerSquare: 4.3,
        materialCostPerBundle: 72.28,
      },
      metal_standing_seam: {
        label: "Standing seam metal",
        pricePerSquare: 1300,
        labourFactor: 1.9,
        // Home Depot Canada does not sell standing seam panel — the closest
        // thing on the shelf is a metal SHINGLE (Vicwest True Nature, 50 sqft
        // per box, $266.00), which is a different product and would be a
        // dishonest stand-in. Stays unpriced until a real supplier is read.
        materialCostPerBundle: null,
      },
      cedar_shake: {
        label: "Cedar shake",
        pricePerSquare: 1150,
        labourFactor: 2.2,
        // Coverage IS known — IRVING 16" Eastern White Cedar states 25 sqft
        // per bundle at 5" exposure, so four bundles to a square — but the
        // only cedar Home Depot Canada stocks is WALLGRADE ($143.98), which
        // is a siding shingle and must not be sold as a roof. The quantity is
        // right; the price stays null until a roof-grade supplier is read.
        bundlesPerSquare: 4,
        materialCostPerBundle: null,
      },
      membrane_flat: {
        label: "EPDM / modified bitumen (low slope)",
        pricePerSquare: 750,
        labourFactor: 1.3,
        // GAF Liberty SBS Self-Adhering Cap Sheet, 3 ft x 34 ft = 100 sqft,
        // $146.00 — Home Depot Canada, read 25 Aug 2026. One roll to a square.
        // This is the CAP sheet only; a two-ply system also needs a base sheet
        // (GAF #75 Tri-Ply, 300 sqft, $99.96), which this bill does not yet
        // carry — so a two-ply job is under-costed by about $33 a square and
        // an estimator should say so rather than trust this line alone.
        bundlesPerSquare: 1,
        materialCostPerBundle: 146,
      },
    },
    defaultMaterial: "asphalt_arch",

    // Split first/additional rather than the flat per-layer the public
    // estimator uses. The first layer carries the setup of the strip; the
    // second comes off an already-opened roof. A flat rate overcharges the
    // three-layer job and undercharges the one-layer one, and the estimator is
    // standing in front of the roof and can see which it is.
    tearOff: { firstLayerPerSquare: 65, additionalLayerPerSquare: 45 },

    // Sell-side steepness, keyed to PITCH_BANDS in lib/pricing/roofLabour.js.
    //
    // These are NOT the steepnessTier() names the public instant estimator uses
    // (standard/moderate/steep/very_steep). That tier has four bands and no
    // discount band; this one has five, because a 3/12 and a 16/12 are off the
    // walkable default in opposite directions — a distinction a quote needs and
    // a ballpark can live without.
    steepnessSurcharge: {
      low_slope: 0,
      walkable: 0,
      moderate: 0.1,
      steep: 0.22,
      very_steep: 0.4,
    },

    // Linear details, per foot. This is where a cut-up roof stops resembling a
    // simple one of the same area, and pricing by the foot is how the quote
    // shows the client why.
    details: {
      iceWaterPerLf: 3.5,
      dripEdgePerLf: 3,
      starterPerLf: 2.5,
      valleyPerLf: 12,
      ridgeCapPerLf: 9,
      ridgeVentPerLf: 14,
      stepFlashingPerLf: 11,
    },

    penetrations: {
      vent_boot: { label: "Plumbing vent boot", price: 65 },
      box_vent: { label: "Roof vent", price: 95 },
      skylight: { label: "Skylight flashing", price: 450 },
      chimney: { label: "Chimney flashing", price: 550 },
    },

    // Sheathing is quoted as an allowance and reconciled on the invoice: nobody
    // knows how much of a deck is rotten until the shingles are off it. Priced
    // per 4x8 sheet, supplied and fitted.
    deckSheetPrice: 95,

    // How long it takes, as opposed to what it sells for.
    //
    // Spread rather than restated so there is one set of numbers: the engine in
    // lib/pricing/roofLabour.js reads them, the rate card edits them, and a
    // company that changes its tear-off productivity changes the figure the
    // cost panel uses. See that file for how each constant was calibrated
    // against real production rates.
    labour: { ...ROOF_LABOUR_DEFAULTS },

    // How much MORE material to buy than the roof measures.
    //
    // 10% is the owner's number, and it is a QUANTITY factor, not a price one —
    // lib/costing/tradeMaterials.js multiplies the squares and the linear feet
    // by it, and never touches a unit cost. Burying the same 10% in the dollar
    // figures would make the sourcing list and the cost panel disagree about
    // how many bundles to buy, and the yard loads the truck from the list.
    //
    // It is on the rate card because a plain gable and a cut-up hip roof waste
    // very different amounts, and the company knows which it does.
    wastePct: 0.1,

    // What the materials COST. Internal only — this drives the margin panel
    // and the job's sourcing list, and never appears on anything a client
    // reads.
    //
    // ── Home Depot Canada, Gatineau store, read 25 August 2026 ─────────────
    //
    // Retail, not a contractor account. That is the point of stating the SKU:
    // a roofer with a supplier account will be under these, and can see by how
    // much rather than being handed an anonymous number to trust. Two lines
    // are still null and say why.
    materialCosts: {
      // GAF FeltBuster, 1,000 sqft synthetic roll. OC ProArmor is the same
      // 1,000 sqft at $105.00 and OC RhinoRoof U20 works out to $79.28 per
      // 1,000 — this is the top of a $79–$151 band, deliberately, because
      // FeltBuster is the one an estimator is most likely to actually buy.
      underlaymentPerRoll: 151,
      // GAF WeatherWatch mineral-surfaced leak barrier, 200 sqft. GAF
      // StormGuard ($119.00) and OC WeatherLock G ($118.00) are the same
      // 200 sqft, so the band is $98–$119 and this is the bottom of it.
      iceWaterPerRoll: 97.96,
      // Peak Gutters 2" x 1-3/4" x 3/8" 29-gauge steel drip edge, black
      // (model 8553). The listing does not state the length; the product
      // page's own Q&A does — 10 feet — which is why the constant stands.
      dripEdgePerLength: 14.06,
      // GAF Pro-Start, 120 linear feet. See ROOF_PACKAGING: this is what moved
      // starterFtPerBundle off 100.
      starterPerBundle: 57.6,
      // GAF Seal-A-Ridge Charcoal, 25 linear feet per bundle (45 pieces).
      ridgeCapPerBundle: 63.82,
      // GAF Snow Country Advanced filtered ridge exhaust vent, 11.5" x 48".
      ridgeVentPerSection: 26.24,
      // Peak Gutters step flashing, 3" x 4" x 10.5", galvanized — sold ONE AT
      // A TIME, which is why the packaging constant is now pieces per foot
      // rather than a box of 100 that nobody sells.
      stepFlashingEach: 3.29,
      // Perma-Boot 3", the size that suits a standard 3" plumbing stack.
      ventBootEach: 29.69,
      // GAF Master Flow 50 sq. in. NFA aluminum square-top roof vent.
      boxVentEach: 30.54,
      // VELUX EDL engineered step flashing kit for deck-mount skylights,
      // C01–C06. The curb-mount ECL kit is $164.00.
      skylightKitEach: 188,
      // NULL on purpose. Home Depot Canada sells no chimney flashing kit —
      // chimney work here is bent from coil stock and counter-flashed into the
      // masonry, which is a labour line, not a part number. The quote already
      // prices it at penetrations.chimney; this is only the material half, and
      // inventing a figure for it would be worse than leaving the line
      // uncosted and counted.
      chimneyFlashingEach: null,
      // 1/2" x 4 ft x 8 ft standard spruce plywood — the usual re-sheet over
      // rotten deck. 5/8" is $50.98 if the framing is 24" o.c.
      deckSheetEach: 39.98,
      // Everbilt 1-1/4" x .120 electro-galvanized coil roofing nails, 7,200
      // pieces. DEWALT's identical 7,200 count is $79.98. At the 6-nail
      // high-wind pattern a box is 15 squares, which is squaresPerNailBox.
      nailBoxEach: 55.98,
    },
  },

  siding: {
    label: "Siding",

    // Installed $/sqft of WALL, cladding and labour together.
    //
    // Source figures: This Old House puts a full replacement on a typical
    // 2,000 sqft home at roughly $8,000-$30,000, averaging near $19,000, with
    // installed rates of about $6 vinyl, $7 aluminum, $9 fibre cement, $12
    // cedar and $14-$20 stone or brick veneer.
    //
    // Two things about that "2,000 sqft home" worth stating, because getting
    // them wrong is the whole estimate:
    //
    //   It is the FLOOR area of the house, not the wall area. A 2,000 sqft
    //   two-storey clads out at roughly 1,800-2,400 sqft of wall. This book is
    //   priced per square foot of WALL, which is what a sider measures, and the
    //   takeoff asks for wall area for that reason.
    //
    //   $6/sqft x 2,000 = $12,000, inside the $8k-$30k band and below the
    //   $19,000 average — which is right, because the average includes the
    //   fibre cement and cedar jobs and the tear-off and trim below.
    //
    // Stone veneer ships at $17, the midpoint of the published $14-$20. A
    // midpoint is stated as a midpoint rather than dressed up as a rate: it is
    // the one line here a company should expect to edit first.
    materials: {
      vinyl: {
        label: "Vinyl siding",
        pricePerSqft: 6,
        labourFactor: 1,
        // ABTCO Cedar Creek (D4D) Double Dutchlap, 4" x 150" panel — Home
        // Depot Canada (Gatineau), read 25 Aug 2026, listed at $1.31 / sq. ft.
        // ($10.94 a piece). x 200 sqft to the box = $262.
        //
        // The x200 is packaging, not a guess: ABTCO TimberCrest Plus D4.5D
        // ships 22 panels of 4.5" double x 145.5", which is 200.1 sqft, at
        // $625.00 a box. So the real vinyl band here is $262–$625 a box, or
        // $1.31–$3.13 a square foot, and builder-grade is what a $6/sqft
        // installed rate assumes. A company selling the premium line edits
        // this first.
        materialCostPerBox: 262,
      },
      aluminum: {
        label: "Aluminum siding",
        pricePerSqft: 7,
        labourFactor: 1.1,
        // NULL: Home Depot Canada's "Metal Siding" category holds exactly one
        // product, a starter strip. There is no aluminum cladding to price.
        materialCostPerBox: null,
      },
      fiber_cement: {
        label: "Fibre cement",
        pricePerSqft: 9,
        labourFactor: 1.6,
        // NULL: no fibre cement plank is stocked at Home Depot Canada. It is
        // a lumberyard order here, and no lumberyard was read.
        materialCostPerBox: null,
      },
      cedar: {
        label: "Cedar",
        pricePerSqft: 12,
        labourFactor: 1.7,
        // IRVING 16" Wallgrade Eastern White Cedar Shingles, $143.98 — Home
        // Depot Canada, read 25 Aug 2026. The product page states each bundle
        // covers 25 sqft at 5" exposure, so the box here is 25, not 200.
        sqftPerBox: 25,
        materialCostPerBox: 143.98,
      },
      engineered_wood: {
        label: "Engineered wood",
        pricePerSqft: 8,
        labourFactor: 1.3,
        // LP SmartSide 38 Series Cedar Texture, 8" o.c. panel, 4 ft x 8 ft,
        // $64.88 — Home Depot Canada, read 25 Aug 2026. A sheet is 32 sqft.
        sqftPerBox: 32,
        materialCostPerBox: 64.88,
      },
      stone_veneer: {
        label: "Stone or brick veneer",
        pricePerSqft: 17,
        labourFactor: 2.4,
        // Novik NovikStone SK Stacked Stone in Onyx, 10 panels per box,
        // 49.32 sqft per box, $298.00 — Home Depot Canada, read 25 Aug 2026,
        // i.e. $6.04/sqft. The same range runs to $8.66/sqft (NovikStone DS,
        // 25.18 sqft at $218.00), so the cheap end is the default and the
        // spread is the profile, not the supplier.
        sqftPerBox: 49.32,
        materialCostPerBox: 298,
      },
    },
    defaultMaterial: "vinyl",

    // The source's own sentence, encoded: "tear-off, rot repair and trim often
    // swing the total more than the cladding brand". If that is true — and it
    // is — then a book that prices only the cladding is pricing the part that
    // matters least. Each of these is its own line on the quote.
    tearOffPerSqft: 1.5,
    housewrapPerSqft: 0.85,
    rotRepairPerSqft: 6.5,
    trimPerLf: 7,
    soffitPerSqft: 9,
    fasciaPerLf: 9,
    // Access, the way a sider actually prices it: not a complexity word, but
    // the storey the wall is on, because that is what decides ladders vs
    // scaffold and it is not a judgement call.
    storeySurcharge: { one: 0, two: 0.12, three_plus: 0.28 },

    // Crew-hours per square foot of wall, before the material factor. Two
    // installers hang roughly 500 sqft of vinyl in a day: 16 crew-hours over
    // 500 sqft is 0.032. Fibre cement and cedar are slower, and that is what
    // each material's labourFactor above is for — it is read by
    // tradeLabourHours(), not decoration.
    labourHoursPerSqft: 0.032,

    // What the materials COST. Internal only. Home Depot Canada, Gatineau
    // store, read 25 August 2026 — same caveat as roofing: this is retail, and
    // a sider with an account will be under it.
    materialCosts: {
      // DuPont Tyvek HomeWrap, 9 ft x 100 ft = 900 sqft. This is what moved
      // SIDING_PACKAGING.housewrapSqftPerRoll off an invented 1,350: the roll
      // that constant described is not sold here. The house-brand 10 x 100
      // (1,000 sqft) is $139.00, so the two agree to within 2% per square foot.
      housewrapPerRoll: 137,
      // ABTCO J-Channel, 5/8" x 150" white — 12.5 ft, which is what moved
      // trimFtPerLength off 12.
      trimPerLength: 9.78,
      // Peak Gutters aluminum fascia cover, 10 ft x 6" x 1", white. The 8"
      // profile is $32.59. Fascia used to borrow the trim length; it is a
      // 10 ft piece and now has its own constant.
      fasciaPerLength: 28.23,
      // ABTCO Perforated Soffit, 16" x 144" = 16 sqft at $22.96, so $1.44/sqft.
      // Vented rather than solid on purpose — a soffit that does not breathe
      // is how the attic job above it fails. Solid (ABTCO D5) is listed
      // directly at $1.30/sqft, and the 12-piece box works out to $1.48.
      soffitPerSqft: 1.44,
      // Same 1/2" 4x8 spruce plywood as the roofing book, and deliberately the
      // same number: it is the same sheet off the same rack.
      deckSheetEach: 39.98,
      // NULL: no siding-nail SKU was read. Home Depot Canada's roofing coil
      // nail is the wrong fastener for cladding and would be a stand-in, not
      // a source.
      fastenersPerSquare: null,
    },
  },

  // ── Gutters and eavestroughs ──────────────────────────────────────────
  //
  // Ottawa / Ontario 2026, CAD. Researched by the owner from contractors' OWN
  // published rates rather than from cost-guide articles, and the structure
  // below follows the distinctions those sources actually make.
  //
  // ── Why NEW and REPLACEMENT are two rates, not one rate plus a removal ──
  //
  // Only Eavestroughs (London ON) publishes $10-$15/ft for 5" and $20-$25 for
  // 6", and states explicitly that removal AND disposal of the old gutters is
  // INCLUDED at that number. HomeStars Ottawa reports $5-$15/ft across the
  // market; Can-Mar Aluminum (Ontario) publishes $9-$16/ft for 5" and $18-$22
  // for 6". Against a new-construction 5" rate of $8-$12/ft, the ~$2-$3/ft gap
  // IS the removal, and contractors bundle it rather than itemising it. So a
  // replacement is one line at a higher rate, which is how the client will see
  // it quoted by everyone else they ask.
  //
  // Where a source gives ONE undifferentiated rate — 6" and copper — there is
  // no bundled replacement figure to ship, so `replacementPricePerFt` is null
  // and the builder prices those as the install rate PLUS the published
  // removal-only rate. That reconstructs the bundle from two read numbers
  // instead of inventing a third, and the removal appears on its own line so
  // nobody has to wonder whether it was in there.
  //
  // ── The two minimums are per WORK TYPE, and never stack ─────────────────
  //
  // A cleaning minimum and a repair minimum are two different published rules
  // for two different jobs, not a floor and a second floor on the same one.
  // buildGutters applies exactly one, chosen by the work type, and emits it as
  // its own line — see lib/pricing/tradeScope.js.
  gutter_services: {
    label: "Gutters & Eavestroughs",

    // Keyed map, not an array — mergeDeep replaces arrays wholesale, so a
    // company editing one profile's rate on the rate card would silently
    // discard the other two. Same reasoning as the garage door catalogue.
    materials: {
      alum_5: {
        label: '5" seamless aluminium',
        // $8-$12/ft new (market range); $10-$15/ft replacement (Only
        // Eavestroughs, London ON, removal and disposal stated as included).
        // Can-Mar's $9-$16 spans both and corroborates the pair.
        pricePerFt: 10,
        replacementPricePerFt: 12,
      },
      alum_6: {
        label: '6" seamless aluminium',
        // Can-Mar $18-$22, Only Eavestroughs $20-$25. Both quote ONE rate for
        // the profile without splitting new from replacement, so there is no
        // bundled figure to ship and the null below is the honest answer.
        pricePerFt: 20,
        replacementPricePerFt: null,
      },
      copper: {
        label: "Copper",
        // $25-$45/ft, the widest band in the research because copper is priced
        // off the metal and the fabricator, not off a published rate card.
        // The single most useful number here to overwrite with a real quote.
        pricePerFt: 35,
        replacementPricePerFt: null,
      },
    },
    defaultMaterial: "alum_5",

    // Taking a run down and disposing of it with nothing going back up. Also
    // what reconstructs the replacement bundle for the two profiles above that
    // have no bundled rate — see the header.
    removalPerFt: 2.5,

    // ── Cleaning ────────────────────────────────────────────────────────
    //
    // These are published Ottawa figures by STOREY, not one rate multiplied by
    // an invented height factor: $1.00-$1.25 at one storey, $1.25-$1.75 at
    // two, $1.75-$2.50 at three. The height is already inside them, which is
    // why heightSurcharge below must never touch a cleaning line.
    //
    // Sanity check against the same company's published whole-house ranges —
    // small 1-storey $120-150, medium 2-storey $180-250, large 3-storey
    // $300-395: a 150 ft two-storey lands at $225, mid-band.
    cleaning: {
      perFt: { one: 1.1, two: 1.5, three_plus: 2.0 },
      // A real published rule — "$100-$150 minimum applies to all gutter
      // cleaning jobs" — shipped at the top of the stated band, which is also
      // where the small-home whole-house range ends. It is a floor on the
      // JOB, not on the per-foot line, and the quote shows the top-up.
      minimumCharge: 150,
    },

    // ── Guards ──────────────────────────────────────────────────────────
    // Basic screen $8/ft, micro-mesh $15/ft, premium branded $25/ft and up.
    // True Vision (Ottawa) advertises $15/ft, which lands exactly on the
    // micro-mesh figure — the strongest number in this book after the 5"
    // aluminium pair.
    guards: {
      screen: { label: "Basic screen", pricePerFt: 8 },
      micro_mesh: { label: "Micro-mesh", pricePerFt: 15 },
      premium: { label: "Premium branded system", pricePerFt: 25 },
    },

    downspouts: {
      // $100-$300 typical, up to $400 where the run is long or the routing is
      // awkward. $200 is the middle of the ordinary band, not of the extreme.
      installEach: 200,
      // $20-$40. Flushed through and watched, which is the only way to know a
      // clear trough is actually draining.
      flushEach: 30,
    },

    repairs: {
      // $10-$50 per section for a reseal or a refasten done ALONGSIDE other
      // work — the midpoint, because the source states a band and no mode.
      perSectionPrice: 25,
      // A repair visit on its own is $150-$400 typical with $150 the stated
      // minimum. Applied only when the work type IS repair: the same sections
      // added to a cleaning job are the cheap add-on above, which is exactly
      // what the source distinguishes.
      minimumPerJob: 150,
    },

    extras: {
      // $25-$30/ft, midpoint of a stated band.
      heatCablePerFt: 27.5,
      // The source states a $100-$150 MINIMUM for this, not a rate, and no
      // per-foot figure exists anywhere in the research. 125 is the middle of
      // that stated minimum and behaves as a small-house price; a large house
      // is more and the estimator overrides on the line. Flagged because it is
      // the one figure here that is a floor wearing a price's clothes.
      soffitFasciaRinsePrice: 125,
    },

    // ── Height, on INSTALL work only ────────────────────────────────────
    //
    // 1 storey 1.00x, 2 storey 1.15-1.25x, 3 storey 1.35-1.50x. Stored as the
    // surcharge rather than the multiplier (0.20 == 1.20x) for the same reason
    // siding does: it comes out as a line the client can see instead of
    // silently inflating every rate above it.
    //
    // Applied to the install-side subtotal ONLY. The cleaning rates above are
    // published per storey and already contain the height; charging both would
    // bill a three-storey clean for the ladders twice.
    heightSurcharge: { one: 0, two: 0.2, three_plus: 0.425 },

    // Deliberately no `labourHoursPerSqft` — and none per linear foot either.
    // This trade is not priced by area, and no production rate for gutter work
    // was researched: the owner named it as the next research step rather than
    // something to fill in. tradeLabourHours() returns 0 for a book that states
    // none, which is the honest answer; a guessed rate would feed the margin
    // panel and the schedule with fiction and would look sourced sitting
    // beside the figures above. Same call as home_inspection, for the same
    // reason.
    //
    // No `materialCosts` either. Every price above is what the work SELLS for;
    // no coil, guard or downspout supplier was read, so there is no cost side
    // to this book yet and lib/costing/tradeMaterials.js has no builder for it.
  },

  insulation: {
    label: "Insulation",

    // Priced per square foot PER POINT OF R ADDED, not per square foot.
    //
    // The published figures are a band four numbers wide — blown-in $1.65-$3.80
    // per sqft, spray foam $2.75-$7.50 — because they are quietly averaging
    // over DEPTH. An attic with four inches already in it and a bare one of the
    // same area are not the same job, and a $/sqft rate cannot tell them apart.
    // Per point of R, the band collapses and the existing insulation becomes
    // visible on the quote. See lib/pricing/insulation.js.
    //
    // Checked against the sources at both ends:
    //
    //   1,200 sqft bare attic to R60 in blown fibreglass
    //     1,200 x 60 x $0.034 = $2,448, or $2.04/sqft — inside the $1.65-$3.80
    //     blown-in band and inside the $1,750-$5,500 attic band.
    //
    //   900 sqft of wall to R20 in closed-cell
    //     900 x 20 x $0.15 = $2,700, or $3.00/sqft — inside the $2.75-$7.50
    //     spray band, near the bottom, which is right for a 3" wall lift.
    //
    //   Whole home, 2,000 sqft
    //     Attic 1,000 sqft to R60 blown ($2,040) + 1,600 sqft of wall to R20 in
    //     batt ($1,440) + air sealing ($750) = $4,230, against Fixr's January
    //     2026 average of roughly $4,700 for 2,000 sqft.
    //
    // R per inch is the standard published value for each product, and it is
    // what decides the depth — so it is the one field here that is physics
    // rather than a market. A company should edit the money and leave it alone.
    //
    // ── The spray foam rates are TORONTO; the rest are not ──────────────────
    //
    // Both spray foams shipped at a US-derived figure and both were low.
    // Konstruction Group (Toronto) publishes EIGHT separate spray-foam figures,
    // and the useful thing about that is they can be cross-checked against each
    // other. Converted to dollars per square foot per point of R, they imply:
    //
    //   closed-cell  $1.50–$3.50 per board foot ..................  0.222–0.519
    //                $4.50–$7.50 /sqft at 3" ....................... 0.222–0.370
    //                1,000 sqft basement to OBC R20, $4.5k–$8k ..... 0.225–0.400
    //                20x20 garage, 1,120 sqft at 2", $4.5k–$8.5k ... 0.298–0.562
    //                2,000 sqft home at 2", $8k–$18k ............... 0.269–0.606
    //   open-cell    $0.80–$1.50 per board foot ................... 0.213–0.400
    //                $2.50–$5.00 /sqft at 3.5" ..................... 0.190–0.381
    //                20x20 garage at 3.5", $2.5k–$5k ............... 0.170–0.340
    //
    // Five independent figures for closed cell and three for open, and each set
    // OVERLAPS — which is not something a made-up price does. The intersections
    // are 0.298–0.370 and 0.213–0.340, and this book ships their midpoints:
    // 0.33 and 0.28. scripts/check-trade-labour.mjs asserts every one of the
    // eight rows above, so a future edit that drifts outside any of them fails.
    //
    // A board foot IS a square foot one inch thick, so a trade that has always
    // quoted spray foam by the board foot has always been pricing per
    // square-foot-per-inch. This book's per-R model is that same unit divided
    // by the material's R per inch. The convergence above is the evidence.
    //
    // The old 0.15 and 0.09 quoted a Toronto wall at roughly half the local
    // floor. The other five materials are still the US-derived Fixr figures, so
    // this book now sits on two anchors. That is worth knowing before quoting
    // in Ontario: the spray foams are local, the blown-in and batt rates are
    // not, and the first thing an Ontario company should do on this rate card
    // is check the batt and blown-in numbers against their own supplier.
    materials: {
      blown_fiberglass: {
        label: "Blown fibreglass",
        rPerInch: 2.5,
        // Coverage is printed on the bag as square feet at a stated R. Divided
        // by the R per inch that is square-foot-inches, which is the unit the
        // depth engine already works in. Editable because it is the bag's
        // number and it varies by product — check the bag.
        //
        // WAS 400. Owens Corning AttiCat prints TWO coverage points on the
        // bag — "R-40 (14.6") = 47.4 ft² / R-80 (28.5") = 22.3 ft²" — which
        // are 692 and 636 square-foot-inches. They disagree by 8% because
        // blown fibreglass settles differently at depth; 692 is the shallower
        // and therefore the conservative one for an attic top-up.
        //
        // Note AttiCat's own numbers imply 2.74–2.81 R per inch against the
        // 2.5 kept above. Leaving 2.5 makes the depth engine ask for ~10%
        // more inches than OC would, which over-orders slightly. That is the
        // right direction to be wrong on a cost panel, and rPerInch stays a
        // published generic figure rather than one brand's.
        sqftInchesPerBag: 692,
        // Owens Corning AttiCat Expanding PINK FIBERGLAS, $93.20 a bag —
        // Home Depot Canada (Gatineau), read 25 Aug 2026. Blower rental is
        // extra and is not in this bill.
        //
        // READ THIS BEFORE "FIXING" IT: at $93.20 a bag, a 1,200 sqft attic to
        // R60 costs about $3,900 in material against an installed sell of
        // $2,448 at the rate above. The cost panel will show that job losing
        // money, and it is RIGHT to: AttiCat is a DIY bag, and no insulator
        // buys blowing wool at Home Depot retail — they buy it by the pallet
        // from an insulation supplier at a fraction of this. This number is a
        // real, traceable ceiling, not a working cost, and it is the first
        // line an insulation contractor should replace with their own invoice.
        materialCostPerBag: 93.2,
        installedPerSqftPerR: 0.034,
        hoursPerSqft: 0.002,
        hoursPerSqftPerInch: 0.0004,
      },
      blown_cellulose: {
        label: "Blown cellulose",
        rPerInch: 3.5,
        // WAS 300. Greenfiber SANCTUARY states "Covers 14 sq. ft. per 25 lbs
        // bag at recommended R-50 (18.6 sq ft @ R40)". At the product's own
        // 3.7 R per inch those are 13.5" over 14 sqft (189 sqft-inches) and
        // 10.8" over 18.6 sqft (201). 195 is the midpoint of the bag's own
        // two statements, not a round number picked between them.
        sqftInchesPerBag: 195,
        // Greenfiber SANCTUARY Cellulose Blown-In, $17.96 a bag — Home Depot
        // Canada, read 25 Aug 2026. Soprema Sopra-Cellulose is $16.40.
        materialCostPerBag: 17.96,
        installedPerSqftPerR: 0.04,
        hoursPerSqft: 0.002,
        hoursPerSqftPerInch: 0.0004,
      },
      batt_fiberglass: {
        label: "Fibreglass batt",
        rPerInch: 3.2,
        // A bundle covers less as it gets thicker. One figure per material is
        // the simplification here, and it is the first thing to correct against
        // the product actually being installed.
        //
        // WAS 60. Owens Corning R-20 PINK NEXT GEN, 15" x 47" x 6", is 78.3
        // sqft — the standard 2x6 wall batt at 16" o.c., which is what an
        // Ontario sider or renovator is putting in. The range across the shelf
        // is wide (R-12 at 15x47 is 97.9 sqft, R-24 is 33.7), which is exactly
        // the simplification the comment above warns about.
        sqftPerBundle: 78.3,
        // $57.83 a bundle — Home Depot Canada, read 25 Aug 2026, for that same
        // R-20 15x47x6 bag. $0.74 per square foot.
        materialCostPerBundle: 57.83,
        needsVapourBarrier: true,
        installedPerSqftPerR: 0.045,
        hoursPerSqft: 0.012,
        hoursPerSqftPerInch: 0.0006,
      },
      batt_stone_wool: {
        label: "Stone wool batt",
        rPerInch: 4.1,
        // WAS 50. ROCKWOOL R22 Comfortbatt for 2x6 wood stud at 16" o.c. is
        // 39.8 sqft a bundle (15.25" x 47" x 5.5"). The 24" o.c. bundle is
        // 37.5 and R14 for 2x4 is 59.7 — same caveat as fibreglass above.
        sqftPerBundle: 39.8,
        // $115.91 a bundle — Home Depot Canada, read 25 Aug 2026. $2.91 per
        // square foot, four times the fibreglass, which is the real reason
        // stone wool loses jobs it deserves to win.
        materialCostPerBundle: 115.91,
        needsVapourBarrier: true,
        installedPerSqftPerR: 0.062,
        hoursPerSqft: 0.014,
        hoursPerSqftPerInch: 0.0006,
      },
      spray_open_cell: {
        label: "Open-cell spray foam",
        rPerInch: 3.7,
        // Sold as a set, measured in board feet. A board foot IS a square foot
        // one inch thick, so the depth engine and the purchase order already
        // speak the same unit.
        boardFeetPerSet: 16000,
        // NULL. Home Depot Canada's spray foam aisle is single cans — the
        // largest is a 30 oz Boom at $18.60, which is a gap filler, not the
        // rig a 16,000 board-foot set describes. Pricing a set off a can would
        // be a unit conversion between two different products.
        materialCostPerSet: null,
        // CANADIAN, and Toronto-anchored. See the note below.
        installedPerSqftPerR: 0.28,
        // Open cell is vapour-permeable and needs a separate barrier. Closed
        // cell at these thicknesses is its own, which is why only this one
        // carries the flag.
        needsVapourBarrier: true,
        hoursPerSqft: 0.004,
        hoursPerSqftPerInch: 0.0008,
        sprayRig: true,
      },
      spray_closed_cell: {
        label: "Closed-cell spray foam",
        rPerInch: 6.5,
        boardFeetPerSet: 4000,
        // NULL, for the same reason as open cell above.
        materialCostPerSet: null,
        // CANADIAN, and Toronto-anchored. See the note below.
        installedPerSqftPerR: 0.33,
        hoursPerSqft: 0.004,
        hoursPerSqftPerInch: 0.0012,
        sprayRig: true,
      },
      rigid_board: {
        label: "Rigid board — XPS or polyiso",
        rPerInch: 5,
        // A 4x8 sheet is 32 sqft — confirmed against Owens Corning FOAMULAR
        // NGX CodeBord XPS 1" x 48" x 96" R-5. Unchanged.
        sqftPerSheet: 32,
        // $62.40 a sheet — Home Depot Canada, read 25 Aug 2026. Note this is
        // an R-5 (1") sheet against the rPerInch 5 above, so one sheet is one
        // inch: a company using 2" board (R-10, $125.00) buys half as many
        // sheets at twice the price and should edit both.
        materialCostPerSheet: 62.4,
        installedPerSqftPerR: 0.09,
        hoursPerSqft: 0.018,
        hoursPerSqftPerInch: 0.0008,
      },
      // No rPerInch, deliberately. Foil resists radiant heat by emissivity and
      // its effective R depends on the air gap and the assembly around it; any
      // single "R per inch" for foil is marketing. Sold by the square foot,
      // with no depth calculation and no R claim on the quote.
      radiant_barrier: {
        label: "Foil radiant barrier",
        rPerInch: 0,
        // NULL: Home Depot Canada shelves foil under a different category and
        // none was read. Left unsourced rather than borrowed from the sell
        // price above it.
        materialCostPerSqft: null,
        pricePerSqft: 1.2,
        hoursPerSqft: 0.01,
        hoursPerSqftPerInch: 0,
      },
    },
    defaultMaterial: "blown_fiberglass",

    extras: {
      // The single most common way an attic job fails to perform is being
      // blown over the leaks instead of sealed first. Priced so it can be sold
      // rather than absorbed and skipped.
      airSealPerSqft: 0.75,
      // Open cell and unfaced batt are vapour-permeable and need one; closed
      // cell is its own. Priced so the assembly can be quoted complete rather
      // than quoted cheap and finished at somebody else's expense.
      vapourBarrierPerSqft: 0.65,
      baffleEach: 12,
      removalPerSqft: 1.25,
      housewrapPerSqft: 0.85,
    },

    labour: { ...INSULATION_LABOUR_DEFAULTS },

    // Confirmed: Everbilt 6 mil vapour barrier is stocked as 10' x 100'.
    packaging: { vapourBarrierSqftPerRoll: 1000 },

    // What the materials COST. Internal only. Home Depot Canada, Gatineau
    // store, read 25 August 2026.
    materialCosts: {
      // Everbilt 10' x 100' (1,000 sqft) CCMC-evaluated 6 mil vapour barrier.
      vapourBarrierPerRoll: 92.96,
      // Owens Corning Raft-R-Mate rigid XPS attic rafter vent, 22.5" x 48".
      bafflePerUnit: 2.3,
      // NULL. The bill asks for a CASE per 500 sqft of air sealing; Home Depot
      // Canada sells single cans (GREAT STUFF Pro at $16.80–$21.92) and a
      // two-pack, never a case. Multiplying a can by twelve would be inventing
      // a pack size, so this stays uncosted and counted.
      airSealCasePerUnit: null,
    },
  },
};

/* ── Access ────────────────────────────────────────────────────────────── */

// Category keys come from the database, so a lookup must be an OWN-property
// lookup: TRADE_PRICE_BOOKS["__proto__"] and ["constructor"] are truthy on any
// plain object, which made hasPriceBook("constructor") true and handed
// getPriceBook a book that is really Object.prototype. Same reasoning as the
// prototype guard in mergeDeep below — inherited keys are never a trade.
function ownEntry(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

export function hasPriceBook(categoryKey) {
  return Boolean(ownEntry(TRADE_PRICE_BOOKS, categoryKey));
}

/**
 * Deep-merge a company's saved overrides over the code defaults.
 *
 * Plain objects merge key by key so a company that changed one tread price
 * doesn't detach from every other default. Arrays REPLACE rather than merge:
 * an item list is an ordered whole, and index-wise merging turns "I deleted
 * the travel fee" into "I renamed the travel fee to the next item down".
 */
export function getPriceBook(categoryKey, overrides) {
  const base = ownEntry(TRADE_PRICE_BOOKS, categoryKey);
  if (!base) return null;
  if (!overrides || typeof overrides !== "object") return base;
  return mergeDeep(base, overrides);
}

function mergeDeep(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) {
    return Array.isArray(patch) ? patch : base;
  }
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch;
  }
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    // Guard the prototype: overrides are company-supplied JSON that has been
    // round-tripped through the database, and a "__proto__" key here would
    // otherwise poison every object in the process.
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    out[key] = mergeDeep(base[key], patch[key]);
  }
  return out;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/* ── Trades priced by the hour ─────────────────────────────────────────── */
//
// The books above are for trades that price by counting things. Most of the
// ~50-category catalog doesn't: an electrician quotes by the hour, and
// CompanyServiceCategory.defaultRate + unit is where that lives.
//
// It started as null for every company, so a new tenant's first quote seeded a
// line item at $0.00 and they had to know their own number before the software
// was any use. These are opening positions, not claims about a market — one
// city's going rate, editable at onboarding and in Settings > Services.
//
// Read-time fallback ONLY. Nothing writes these into a row, for two reasons:
// a company that never opens the rates screen keeps inheriting improvements
// here (same contract as the books), and lib/pricing/benchmarkData.js builds
// its peer comparisons from rates companies actually set — seeding the column
// would feed it FieldQuo's own defaults back as though they were market data.
//
// A trade with a price book is deliberately absent: it is priced BY something
// (per door, per sq ft), the settings screen hides the single-rate box for
// exactly that reason, and a second contradictory number is worse than none.
export const TRADE_DEFAULT_RATES = {
  electrical: { rate: 80, unit: "hour" },
  plumbing: { rate: 95, unit: "hour" },
  lawn_care: { rate: 82, unit: "hour" },
  residential_cleaning: { rate: 65, unit: "hour" },
};

/** The opening rate for a trade with no price book, or null. */
export function defaultTradeRate(categoryKey) {
  if (hasPriceBook(categoryKey)) return null;
  return ownEntry(TRADE_DEFAULT_RATES, categoryKey) || null;
}

/** True when a trade prices itself out of the box — a book or an opening rate. */
export function tradeIsPricedByDefault(categoryKey) {
  return hasPriceBook(categoryKey) || Boolean(defaultTradeRate(categoryKey));
}

/* ── Settings UI descriptors ───────────────────────────────────────────── */
// Same shape as RECIPE_EDITABLE_FIELDS so the rates screen can render a book
// it has never seen. `path` is dot-notation into the book.

/** Human labels for the `group` key on a field, when it has one. */
export const PRICE_BOOK_GROUPS = {
  snowBasic: "Basic plan — service at 5 cm and above",
  snowPremium: "Premium plan — service from 2.5 cm",
  snowExtras: "Add-ons",
  snowSeason: "What the season includes",
  pavers: "Paver options",
  site: "Site conditions and extras",
  doors: "Doors",
  capping: "Capping frames",
  install: "Installation",
  wording: "What the quote says",
  thermofoil: "Thermofoil door",
  painted_mdf: "Painted MDF door",
  red_oak: "Wood door — red oak",
  white_oak: "Wood door — white oak",
  standard: "Standard complexity",
  moderate: "Moderate complexity",
  high: "High complexity",
  inspectionBands: "Full home inspection — by living area",
  inspectionWarranty: "New-build warranty inspections",
  inspectionAncillary: "Ancillary inspections and testing",
  inspectionSurcharges: "Surcharges",
  roofMaterials: "Roofing material — installed, per square",
  roofTearOff: "Tear-off and deck repair",
  roofDetails: "Linear details",
  roofPenetrations: "Penetrations and flashing",
  roofSteepness: "Steepness surcharge",
  roofLabour: "How long it takes — internal, never shown to a client",
  sidingMaterials: "Cladding — installed, per square foot of wall",
  sidingExtras: "Strip, repair and trim",
  sidingAccess: "Access",
  sidingLabour: "How long it takes — internal, never shown to a client",
  pavingLabour: "How long it takes — internal, never shown to a client",
  gutterMaterials: "Eavestrough — supplied and installed, per linear foot",
  gutterCleaning: "Cleaning — per linear foot, by storey",
  gutterGuards: "Gutter guard — supplied and fitted",
  gutterDownspouts: "Downspouts",
  gutterRepairs: "Repairs",
  gutterExtras: "Add-ons",
  gutterAccess: "Access — install work only, never cleaning",
  insulationMaterials: "Insulation — installed",
  insulationExtras: "Air sealing, baffles and removal",
  insulationLabour: "How long it takes — internal, never shown to a client",
  roofMaterialCost:
    "What the materials cost you — internal, never shown to a client",
  sidingMaterialCost:
    "What the materials cost you — internal, never shown to a client",
  insulationMaterialCost:
    "What the materials cost you — internal, never shown to a client",
  pavingMaterialCost:
    "What the materials cost you — internal, never shown to a client",
};

export const PRICE_BOOK_FIELDS = {
  cabinet_refinishing: cabinetFields(),
  cabinet_refacing: [
    ...cabinetFields(),
    // Door specs: what you charge for each, and what each costs you. The cost
    // side is internal — it drives the margin panel, never the client's copy.
    ...["thermofoil", "painted_mdf", "red_oak", "white_oak"].flatMap((key) => [
      {
        path: `doorMaterials.${key}.sellPerDoor`,
        label: "Sell — per door",
        suffix: "$ / door",
        step: 10,
        group: key,
      },
      {
        path: `doorMaterials.${key}.sellPerDrawer`,
        label: "Sell — per drawer",
        suffix: "$ / drawer",
        step: 10,
        group: key,
      },
      {
        path: `doorMaterials.${key}.costPerSqft`,
        label: "Supplier cost",
        suffix: "$ / sq ft",
        step: 0.25,
        group: key,
        internal: true,
      },
    ]),
    {
      path: "avgDoorSqft",
      label: "Average door area",
      suffix: "sq ft",
      step: 0.25,
      internal: true,
    },
    {
      path: "avgDrawerSqft",
      label: "Average drawer front area",
      suffix: "sq ft",
      step: 0.25,
      internal: true,
    },
    {
      path: "supplierFinishingPerSqft",
      label: "Supplier finishing",
      suffix: "$ / sq ft",
      step: 0.25,
      internal: true,
    },
    {
      path: "freightPerOrder",
      label: "Freight per order (under 20 doors)",
      suffix: "$",
      step: 5,
      internal: true,
    },
  ],
  stairs: [
    ...complexityFields("stairs", [
      ["treadPrice", "Tread", "$ / tread"],
      ["riserPrice", "Riser", "$ / riser"],
      ["balusterPrice", "Baluster", "$ / each"],
      ["postPrice", "Newel post", "$ / each"],
      ["handrailPricePerFt", "Handrail", "$ / linear ft"],
      ["landingPricePerSqft", "Landing / hallway", "$ / sqft"],
      ["twoToneSurcharge", "Two-tone surcharge", "$ flat"],
    ]),
    {
      path: "basementTreadPrice",
      label: "Basement tread",
      suffix: "$ / tread",
      step: 1,
    },
  ],
  flooring: complexityFields("flooring", [
    ["pricePerSqft", "Refinishing", "$ / sqft"],
    ["stainChangePricePerSqft", "Stain colour change", "$ / sqft"],
    ["waterDamagePrice", "Water damage repair", "$ flat"],
    ["gapFillingPricePerSqft", "Gap filling", "$ / sqft"],
    ["furnitureMovingPrice", "Furniture moving", "$ flat"],
    ["stairBlendingPrice", "Stair blending", "$ flat"],
  ]),
  countertop: [
    {
      path: "defaultMarkupPct",
      label: "Default markup on supplier cost",
      suffix: "%",
      step: 1,
    },
  ],
  interior_painting: [
    ...complexityFields("interior_painting", [
      ["wallPricePerSqft", "Walls", "$ / sqft"],
      ["ceilingPrice", "Ceiling", "$ / room"],
      ["trimPrice", "Trim", "$ / room"],
      ["doorPrice", "Door", "$ / each"],
      ["closetPrice", "Closet", "$ / each"],
      ["colorChangeSurcharge", "Colour change", "$ / room"],
      ["drywallPrepPrice", "Drywall prep", "$ / room"],
    ]),
    {
      path: "global.popcornRemovalPricePerSqft",
      label: "Popcorn ceiling removal",
      suffix: "$ / sqft",
      step: 0.25,
    },
    {
      path: "global.furnitureMovingPrice",
      label: "Furniture moving",
      suffix: "$ flat",
      step: 10,
    },
  ],
  exterior_painting: [
    ...complexityFields("exterior_painting", [
      ["siding", "Siding / cladding", "$ / sqft"],
      ["trim", "Trim & soffit", "$ / sqft"],
      ["fascia", "Fascia", "$ / linear ft"],
      ["deck", "Deck / porch", "$ / sqft"],
      ["fence", "Fence", "$ / linear ft"],
    ]),
    {
      path: "extras.pressureWashingPrice",
      label: "Pressure washing",
      suffix: "$ flat",
      step: 10,
    },
    {
      path: "extras.primePricePerSqft",
      label: "Priming",
      suffix: "$ / sqft",
      step: 0.25,
    },
  ],
  snow_removal: [
    {
      path: "plans.basic.driveways.single",
      label: "Single driveway (1 car)",
      suffix: "$ / season",
      step: 25,
      group: "snowBasic",
    },
    {
      path: "plans.basic.driveways.double",
      label: "Double driveway (2 cars)",
      suffix: "$ / season",
      step: 25,
      group: "snowBasic",
    },
    {
      path: "plans.basic.driveways.triple",
      label: "Triple or extended",
      suffix: "$ / season",
      step: 25,
      group: "snowBasic",
    },
    {
      path: "plans.basic.driveways.commercial",
      label: "Commercial lot",
      suffix: "$ / season",
      step: 50,
      group: "snowBasic",
    },
    {
      path: "plans.basic.shovelling",
      label: "Walkway and steps",
      suffix: "$ / season",
      step: 10,
      group: "snowBasic",
    },
    {
      path: "plans.premium.driveways.single",
      label: "Single driveway (1 car)",
      suffix: "$ / season",
      step: 25,
      group: "snowPremium",
    },
    {
      path: "plans.premium.driveways.double",
      label: "Double driveway (2 cars)",
      suffix: "$ / season",
      step: 25,
      group: "snowPremium",
    },
    {
      path: "plans.premium.driveways.triple",
      label: "Triple or extended",
      suffix: "$ / season",
      step: 25,
      group: "snowPremium",
    },
    {
      path: "plans.premium.driveways.commercial",
      label: "Commercial lot",
      suffix: "$ / season",
      step: 50,
      group: "snowPremium",
    },
    {
      path: "plans.premium.shovelling",
      label: "Walkway and steps",
      suffix: "$ / season",
      step: 10,
      group: "snowPremium",
    },
    {
      path: "extras.saltPerApplication",
      label: "Salting",
      suffix: "$ / application",
      step: 5,
      group: "snowExtras",
    },
    {
      path: "extras.perVisitPrice",
      label: "Per-visit rate, if not sold by the season",
      suffix: "$ / visit",
      step: 5,
      group: "snowExtras",
    },
    { path: "overageFee", label: "Season overage fee", suffix: "$", step: 5 },
    {
      path: "newClientDiscount",
      label: "New client discount",
      suffix: "$",
      step: 5,
    },
    {
      path: "season.snowfallLimitCm",
      label: "Snowfall included",
      suffix: "cm",
      step: 10,
      group: "snowSeason",
    },
    {
      path: "season.eventLimit",
      label: "Snow events included",
      suffix: "events",
      step: 1,
      group: "snowSeason",
    },
    {
      path: "season.eventThresholdCm",
      label: "Counts as an event at",
      suffix: "cm",
      step: 1,
      group: "snowSeason",
    },
  ],
  paving: [
    ...complexityFields("paving", [
      ["patioPricePerSqft", "Patio, installed", "$ / sqft"],
      ["walkwayPricePerSqft", "Walkway, installed", "$ / sqft"],
      ["drivewayPricePerSqft", "Driveway, installed", "$ / sqft"],
    ]),
    {
      path: "labour.mobilisationHours",
      label: "Mobilise and demobilise, per job",
      suffix: "crew-hours",
      step: 0.5,
      group: "pavingLabour",
    },
    {
      path: "labour.excavationHoursPerCuYd",
      label: "Excavate",
      suffix: "crew-hours / cu yd",
      step: 0.05,
      group: "pavingLabour",
    },
    {
      path: "labour.baseHoursPerCuYd",
      label: "Place granular base",
      suffix: "crew-hours / cu yd",
      step: 0.05,
      group: "pavingLabour",
    },
    {
      path: "labour.layHoursPerSqft",
      label: "Lay and cut in pavers",
      suffix: "crew-hours / sqft",
      step: 0.005,
      group: "pavingLabour",
    },
    {
      path: "labour.wallHoursPerFaceSqft",
      label: "Build walls and steps",
      suffix: "crew-hours / face sqft",
      step: 0.02,
      group: "pavingLabour",
    },
    {
      path: "labour.haulHoursPerLoad",
      label: "One round trip to the pit",
      suffix: "crew-hours",
      step: 0.25,
      group: "pavingLabour",
    },
    {
      path: "labour.cuYdPerLoad",
      label: "Spoil a truck holds",
      suffix: "cu yd",
      step: 1,
      group: "pavingLabour",
    },
    {
      path: "labour.poorAccessFactor",
      label: "Poor access — everything barrowed",
      suffix: "x on-site hours",
      step: 0.05,
      group: "pavingLabour",
    },
    {
      path: "labour.productiveHoursPerDay",
      label: "Hours a crew gets on site in a day",
      suffix: "hours",
      step: 0.5,
      group: "pavingLabour",
    },
    {
      path: "materialCosts.gravelPerCuYd",
      label: "Granular base",
      suffix: "$ / cu yd",
      step: 1,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.sandPerCuYd",
      label: "Bedding sand",
      suffix: "$ / cu yd",
      step: 1,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.deliveryPerLoad",
      label: "Aggregate delivery",
      suffix: "$ / load",
      step: 5,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.cuYdPerLoad",
      label: "What a truck holds",
      suffix: "cu yd",
      step: 1,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.polySandPerBag",
      label: "Polymeric sand",
      suffix: "$ / bag",
      step: 1,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.edgeRestraintPerLength",
      label: "Edge restraint",
      suffix: "$ / 8 ft length",
      step: 1,
      group: "pavingMaterialCost",
    },
    {
      path: "materialCosts.geotextilePerRoll",
      label: "Geotextile",
      suffix: "$ / roll",
      step: 5,
      group: "pavingMaterialCost",
    },
    {
      path: "paverAllowancePerSqft",
      label: "Paver allowance already inside the installed rate",
      suffix: "$ / sqft",
      step: 0.5,
    },
    {
      path: "paverOptions.budget.costPerSqft",
      label: "Budget concrete slab",
      suffix: "$ / sqft",
      step: 0.5,
      group: "pavers",
    },
    {
      path: "paverOptions.standard.costPerSqft",
      label: "Standard interlock",
      suffix: "$ / sqft",
      step: 0.5,
      group: "pavers",
    },
    {
      path: "paverOptions.premium.costPerSqft",
      label: "Premium / architectural",
      suffix: "$ / sqft",
      step: 0.5,
      group: "pavers",
    },
    {
      path: "paverOptions.natural.costPerSqft",
      label: "Natural stone",
      suffix: "$ / sqft",
      step: 0.5,
      group: "pavers",
    },
    {
      path: "extras.removeExistingPerSqft",
      label: "Remove existing surface",
      suffix: "$ / sqft",
      step: 0.5,
      group: "site",
    },
    {
      path: "extras.poorAccessPerSqft",
      label: "Restricted access",
      suffix: "$ / sqft",
      step: 0.5,
      group: "site",
    },
    {
      path: "extras.curvesCutsPerSqft",
      label: "Curves, borders and cutting",
      suffix: "$ / sqft",
      step: 0.5,
      group: "site",
    },
    {
      path: "extras.drivewayPaverUpchargePerSqft",
      label: "80 mm driveway paver uplift",
      suffix: "$ / sqft",
      step: 0.25,
      group: "site",
    },
    {
      path: "extras.sealingPerSqft",
      label: "Sealing",
      suffix: "$ / sqft",
      step: 0.5,
      group: "site",
    },
    {
      path: "extras.permeableUpliftPct",
      label: "Permeable system",
      suffix: "%",
      step: 1,
      group: "site",
    },
    { path: "minimumTotal", label: "Job minimum", suffix: "$", step: 100 },
  ],
  // Derived from the book rather than typed out a second time: the band rows
  // and the ancillary rows ARE the book's own keys, so a company that adds a
  // band or a service to its overrides gets an editable row for it without an
  // edit here, and a band deleted from the book cannot leave an orphan field
  // pointing at nothing.
  home_inspection: [
    ...Object.entries(TRADE_PRICE_BOOKS.home_inspection.bands).map(
      ([id, band]) => ({
        path: `bands.${id}.price`,
        label: band.label,
        suffix: "$ flat",
        step: 25,
        group: "inspectionBands",
      }),
    ),
    {
      path: "oversize.pricePer1000Sqft",
      label: "Area above the largest band",
      suffix: "$ per 1,000 sqft",
      step: 25,
      group: "inspectionBands",
    },
    {
      path: "warrantyInspection.price",
      label: "Per milestone visit",
      suffix: "$ / visit",
      step: 25,
      group: "inspectionWarranty",
    },
    ...Object.entries(TRADE_PRICE_BOOKS.home_inspection.ancillary).map(
      ([id, entry]) => ({
        path: `ancillary.${id}.price`,
        label: entry.label,
        suffix: entry.unit ? `$ / ${entry.unit}` : "$ each",
        // Travel is charged in cents per kilometre; a step of 25 would make
        // the only way to edit it typing over the box.
        step: entry.unit === "km" ? 0.01 : 25,
        group:
          id === "age_surcharge" || id === "travel_km"
            ? "inspectionSurcharges"
            : "inspectionAncillary",
      }),
    ),
    { path: "minimumTotal", label: "Job minimum", suffix: "$", step: 25 },
  ],
  driveway_sealing: [
    ...complexityFields("driveway_sealing", [
      ["sealPricePerSqft", "Sealing", "$ / sqft"],
    ]),
    {
      path: "secondCoatMultiplier",
      label: "Second coat, as a multiple of the first",
      suffix: "×",
      step: 0.1,
    },
    {
      path: "extras.crackFillPerFt",
      label: "Crack filling",
      suffix: "$ / linear ft",
      step: 0.25,
    },
    {
      path: "extras.crackFillIncludedFt",
      label: "Crack filling included before charging",
      suffix: "linear ft",
      step: 5,
    },
    {
      path: "extras.stainTreatmentPrice",
      label: "Oil / grease stain treatment",
      suffix: "$ flat",
      step: 10,
    },
    {
      path: "extras.pressureWashPerSqft",
      label: "Pressure wash",
      suffix: "$ / sqft",
      step: 0.05,
    },
    {
      path: "extras.premiumSealerPerSqft",
      label: "Premium sealer upgrade",
      suffix: "$ / sqft",
      step: 0.05,
    },
    {
      path: "extras.travelSurchargePrice",
      label: "Travel beyond 30 km",
      suffix: "$ flat",
      step: 25,
    },
    { path: "minimumTotal", label: "Job minimum", suffix: "$", step: 25 },
  ],
  garage_door: [
    {
      path: "doors.d8x7_no_window.price",
      label: "8×7 door — no window",
      suffix: "$ / door",
      step: 25,
      group: "doors",
    },
    {
      path: "doors.d8x7_top_window.price",
      label: "8×7 door — top window",
      suffix: "$ / door",
      step: 25,
      group: "doors",
    },
    {
      path: "doors.d8x7_side_window.price",
      label: "8×7 door — side window",
      suffix: "$ / door",
      step: 25,
      group: "doors",
    },
    {
      path: "doors.d16x7_black_flush.price",
      label: "16×7 door — black flush",
      suffix: "$ / door",
      step: 25,
      group: "doors",
    },
    {
      path: "capping.cap_8x7.price",
      label: "Aluminum capping — 8×7",
      suffix: "$ each",
      step: 25,
      group: "capping",
    },
    {
      path: "capping.cap_16x7.price",
      label: "Aluminum capping — 16×7",
      suffix: "$ each",
      step: 25,
      group: "capping",
    },
    {
      path: "installPricePerDoor",
      label: "Installation, when charged separately per door",
      suffix: "$ / door",
      step: 25,
      group: "install",
    },
    // Wording, not money. The rate card renders these as text because the
    // owner asked for the warranty line to be a default a company can change,
    // and a default it cannot change is not one.
    {
      path: "doorSpec",
      label: "Door specification",
      type: "text",
      group: "wording",
    },
    {
      path: "installNote",
      label: "Installation line wording",
      type: "text",
      group: "wording",
    },
    {
      path: "warrantyNote",
      label: "Warranty wording",
      type: "text",
      group: "wording",
    },
  ],

  roofing_service: [
    ...Object.entries(TRADE_PRICE_BOOKS.roofing_service.materials).map(
      ([id, m]) => ({
        path: `materials.${id}.pricePerSquare`,
        label: m.label,
        suffix: "$ / square",
        step: 25,
        group: "roofMaterials",
      }),
    ),
    {
      path: "tearOff.firstLayerPerSquare",
      label: "Tear off — first layer",
      suffix: "$ / square",
      step: 5,
      group: "roofTearOff",
    },
    {
      path: "tearOff.additionalLayerPerSquare",
      label: "Tear off — each further layer",
      suffix: "$ / square",
      step: 5,
      group: "roofTearOff",
    },
    {
      path: "deckSheetPrice",
      label: "Replace sheathing, supplied and fitted",
      suffix: "$ / 4x8 sheet",
      step: 5,
      group: "roofTearOff",
    },
    {
      path: "details.iceWaterPerLf",
      label: "Ice & water membrane",
      suffix: "$ / linear ft",
      step: 0.25,
      group: "roofDetails",
    },
    {
      path: "details.dripEdgePerLf",
      label: "Drip edge",
      suffix: "$ / linear ft",
      step: 0.25,
      group: "roofDetails",
    },
    {
      path: "details.starterPerLf",
      label: "Starter course",
      suffix: "$ / linear ft",
      step: 0.25,
      group: "roofDetails",
    },
    {
      path: "details.valleyPerLf",
      label: "Valleys",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "roofDetails",
    },
    {
      path: "details.ridgeCapPerLf",
      label: "Ridge & hip cap",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "roofDetails",
    },
    {
      path: "details.ridgeVentPerLf",
      label: "Ridge vent",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "roofDetails",
    },
    {
      path: "details.stepFlashingPerLf",
      label: "Step flashing",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "roofDetails",
    },
    ...Object.entries(TRADE_PRICE_BOOKS.roofing_service.penetrations).map(
      ([id, pen]) => ({
        path: `penetrations.${id}.price`,
        label: pen.label,
        suffix: "$ each",
        step: 5,
        group: "roofPenetrations",
      }),
    ),
    {
      path: "steepnessSurcharge.moderate",
      label: "Steepness surcharge — 6-8/12",
      suffix: "x subtotal",
      step: 0.02,
      group: "roofSteepness",
    },
    {
      path: "steepnessSurcharge.steep",
      label: "Steepness surcharge — 9-12/12",
      suffix: "x subtotal",
      step: 0.02,
      group: "roofSteepness",
    },
    {
      path: "steepnessSurcharge.very_steep",
      label: "Steepness surcharge — over 12/12",
      suffix: "x subtotal",
      step: 0.02,
      group: "roofSteepness",
    },
    // Hours, not dollars. These drive the internal cost panel and the
    // production-time figure; they never reach a client-facing surface. Shown
    // on the rate card because a company's crew is faster or slower than the
    // default and the estimator is the only person who knows which.
    {
      path: "labour.installPerSquare",
      label: "Install",
      suffix: "crew-hours / square",
      step: 0.1,
      group: "roofLabour",
    },
    {
      path: "labour.tearOffFirstLayerPerSquare",
      label: "Strip — first layer",
      suffix: "crew-hours / square",
      step: 0.05,
      group: "roofLabour",
    },
    {
      path: "labour.tearOffAdditionalLayerPerSquare",
      label: "Strip — each further layer",
      suffix: "crew-hours / square",
      step: 0.05,
      group: "roofLabour",
    },
    {
      path: "labour.underlaymentPerSquare",
      label: "Underlayment",
      suffix: "crew-hours / square",
      step: 0.05,
      group: "roofLabour",
    },
    {
      path: "labour.mobilisationHours",
      label: "Set up & break down, per job",
      suffix: "crew-hours",
      step: 0.5,
      group: "roofLabour",
    },
    {
      path: "labour.cleanupPerSquare",
      label: "Debris & magnet sweep",
      suffix: "crew-hours / square",
      step: 0.05,
      group: "roofLabour",
    },
    {
      path: "labour.dumpRunHours",
      label: "One dump run",
      suffix: "crew-hours",
      step: 0.25,
      group: "roofLabour",
    },
    {
      path: "labour.squaresPerDumpRun",
      label: "Squares of debris a trailer holds",
      suffix: "squares",
      step: 1,
      group: "roofLabour",
    },
    {
      path: "labour.productiveHoursPerDay",
      label: "Hours a crew gets on the roof in a day",
      suffix: "hours",
      step: 0.5,
      group: "roofLabour",
    },
    {
      path: "materials.asphalt_3tab.materialCostPerBundle",
      label: "3-tab asphalt shingles",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.asphalt_arch.materialCostPerBundle",
      label: "Architectural shingles",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.asphalt_premium.materialCostPerBundle",
      label: "Premium / designer shingles",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.metal_corrugated.materialCostPerBundle",
      label: "Corrugated / ribbed metal",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.metal_standing_seam.materialCostPerBundle",
      label: "Standing seam metal",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.cedar_shake.materialCostPerBundle",
      label: "Cedar shake",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materials.membrane_flat.materialCostPerBundle",
      label: "EPDM / modified bitumen",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.underlaymentPerRoll",
      label: "Synthetic underlayment",
      suffix: "$ / roll (10 squares)",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.iceWaterPerRoll",
      label: "Ice & water membrane",
      suffix: "$ / roll (200 sqft)",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.dripEdgePerLength",
      label: "Drip edge",
      suffix: "$ / 10 ft length",
      step: 1,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.starterPerBundle",
      label: "Starter strip",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.ridgeCapPerBundle",
      label: "Hip & ridge cap",
      suffix: "$ / bundle",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.ridgeVentPerSection",
      label: "Ridge vent",
      suffix: "$ / 4 ft section",
      step: 1,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.stepFlashingEach",
      label: "Step flashing",
      suffix: "$ each",
      step: 0.5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.ventBootEach",
      label: "Plumbing vent boot",
      suffix: "$ each",
      step: 1,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.boxVentEach",
      label: "Roof vent",
      suffix: "$ each",
      step: 1,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.skylightKitEach",
      label: "Skylight flashing kit",
      suffix: "$ each",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.chimneyFlashingEach",
      label: "Chimney flashing",
      suffix: "$ each",
      step: 5,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.deckSheetEach",
      label: "Sheathing",
      suffix: "$ / sheet",
      step: 1,
      group: "roofMaterialCost",
    },
    {
      path: "materialCosts.nailBoxEach",
      label: "Roofing nails",
      suffix: "$ / box",
      step: 5,
      group: "roofMaterialCost",
    },
    // Editable on purpose: it moves the QUANTITY on every measured line, which
    // is a different lever from any of the prices above it.
    {
      path: "wastePct",
      label: "Waste — extra material ordered over the measured roof",
      suffix: "share of the takeoff",
      step: 0.01,
      group: "roofMaterialCost",
    },
  ],

  siding: [
    ...Object.entries(TRADE_PRICE_BOOKS.siding.materials).map(([id, m]) => ({
      path: `materials.${id}.pricePerSqft`,
      label: m.label,
      suffix: "$ / sqft of wall",
      step: 0.5,
      group: "sidingMaterials",
    })),
    {
      path: "tearOffPerSqft",
      label: "Strip existing cladding",
      suffix: "$ / sqft",
      step: 0.25,
      group: "sidingExtras",
    },
    {
      path: "housewrapPerSqft",
      label: "House wrap / weather barrier",
      suffix: "$ / sqft",
      step: 0.05,
      group: "sidingExtras",
    },
    {
      path: "rotRepairPerSqft",
      label: "Sheathing and rot repair",
      suffix: "$ / sqft",
      step: 0.5,
      group: "sidingExtras",
    },
    {
      path: "trimPerLf",
      label: "Trim — corners, windows, doors",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "sidingExtras",
    },
    {
      path: "soffitPerSqft",
      label: "Soffit",
      suffix: "$ / sqft",
      step: 0.5,
      group: "sidingExtras",
    },
    {
      path: "fasciaPerLf",
      label: "Fascia",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "sidingExtras",
    },
    {
      path: "storeySurcharge.two",
      label: "Two storeys",
      suffix: "x subtotal",
      step: 0.02,
      group: "sidingAccess",
    },
    {
      path: "storeySurcharge.three_plus",
      label: "Three or more storeys",
      suffix: "x subtotal",
      step: 0.02,
      group: "sidingAccess",
    },
    {
      path: "labourHoursPerSqft",
      label: "Crew-hours per square foot of wall",
      suffix: "hours / sqft",
      step: 0.005,
      group: "sidingLabour",
    },
    {
      path: "materials.vinyl.materialCostPerBox",
      label: "Vinyl siding",
      suffix: "$ / box (200 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materials.aluminum.materialCostPerBox",
      label: "Aluminum siding",
      suffix: "$ / box (200 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materials.fiber_cement.materialCostPerBox",
      label: "Fibre cement",
      suffix: "$ / box (200 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materials.cedar.materialCostPerBox",
      label: "Cedar",
      suffix: "$ / bundle (25 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materials.engineered_wood.materialCostPerBox",
      label: "Engineered wood",
      suffix: "$ / 4x8 panel (32 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materials.stone_veneer.materialCostPerBox",
      label: "Stone or brick veneer",
      suffix: "$ / box (49 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.housewrapPerRoll",
      label: "House wrap",
      suffix: "$ / roll (900 sqft)",
      step: 5,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.trimPerLength",
      label: "Trim",
      suffix: "$ / 12.5 ft length",
      step: 1,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.fasciaPerLength",
      label: "Fascia",
      suffix: "$ / 10 ft length",
      step: 1,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.soffitPerSqft",
      label: "Soffit",
      suffix: "$ / sqft",
      step: 0.25,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.deckSheetEach",
      label: "Sheathing",
      suffix: "$ / sheet",
      step: 1,
      group: "sidingMaterialCost",
    },
    {
      path: "materialCosts.fastenersPerSquare",
      label: "Fasteners",
      suffix: "$ / square",
      step: 1,
      group: "sidingMaterialCost",
    },
  ],

  gutter_services: [
    // Both rates per profile, side by side, because the pair IS the pricing
    // model: the gap between them is the removal, and a company that edits one
    // and not the other has quietly decided a replacement is free to strip.
    ...Object.entries(TRADE_PRICE_BOOKS.gutter_services.materials).flatMap(
      ([id, m]) => [
        {
          path: `materials.${id}.pricePerFt`,
          label: `${m.label} — new`,
          suffix: "$ / linear ft",
          step: 0.5,
          group: "gutterMaterials",
        },
        {
          path: `materials.${id}.replacementPricePerFt`,
          label: `${m.label} — replacement, removal included`,
          suffix: "$ / linear ft",
          step: 0.5,
          group: "gutterMaterials",
        },
      ],
    ),
    {
      path: "removalPerFt",
      label: "Remove and dispose, no new gutter",
      suffix: "$ / linear ft",
      step: 0.25,
      group: "gutterMaterials",
    },
    {
      path: "cleaning.perFt.one",
      label: "Cleaning — one storey",
      suffix: "$ / linear ft",
      step: 0.05,
      group: "gutterCleaning",
    },
    {
      path: "cleaning.perFt.two",
      label: "Cleaning — two storeys",
      suffix: "$ / linear ft",
      step: 0.05,
      group: "gutterCleaning",
    },
    {
      path: "cleaning.perFt.three_plus",
      label: "Cleaning — three or more storeys",
      suffix: "$ / linear ft",
      step: 0.05,
      group: "gutterCleaning",
    },
    {
      path: "cleaning.minimumCharge",
      label: "Minimum charge on a cleaning job",
      suffix: "$ flat",
      step: 10,
      group: "gutterCleaning",
    },
    ...Object.entries(TRADE_PRICE_BOOKS.gutter_services.guards).map(
      ([id, g]) => ({
        path: `guards.${id}.pricePerFt`,
        label: g.label,
        suffix: "$ / linear ft",
        step: 1,
        group: "gutterGuards",
      }),
    ),
    {
      path: "downspouts.installEach",
      label: "Supply and install a downspout",
      suffix: "$ each",
      step: 10,
      group: "gutterDownspouts",
    },
    {
      path: "downspouts.flushEach",
      label: "Flush and flow test",
      suffix: "$ each",
      step: 5,
      group: "gutterDownspouts",
    },
    {
      path: "repairs.perSectionPrice",
      label: "Reseal or refasten a section",
      suffix: "$ / section",
      step: 5,
      group: "gutterRepairs",
    },
    {
      path: "repairs.minimumPerJob",
      label: "Minimum charge on a repair-only visit",
      suffix: "$ flat",
      step: 10,
      group: "gutterRepairs",
    },
    {
      path: "extras.heatCablePerFt",
      label: "Heated de-icing cable",
      suffix: "$ / linear ft",
      step: 0.5,
      group: "gutterExtras",
    },
    {
      path: "extras.soffitFasciaRinsePrice",
      label: "Soffit and fascia rinse",
      suffix: "$ flat",
      step: 5,
      group: "gutterExtras",
    },
    {
      path: "heightSurcharge.two",
      label: "Two storeys",
      suffix: "x install subtotal",
      step: 0.05,
      group: "gutterAccess",
    },
    {
      path: "heightSurcharge.three_plus",
      label: "Three or more storeys",
      suffix: "x install subtotal",
      step: 0.05,
      group: "gutterAccess",
    },
  ],

  insulation: [
    ...Object.entries(TRADE_PRICE_BOOKS.insulation.materials)
      .filter(([, m]) => m.installedPerSqftPerR > 0)
      .map(([id, m]) => ({
        path: `materials.${id}.installedPerSqftPerR`,
        label: m.label,
        suffix: "$ / sqft per point of R",
        step: 0.005,
        group: "insulationMaterials",
      })),
    {
      path: "materials.radiant_barrier.pricePerSqft",
      label: "Foil radiant barrier",
      suffix: "$ / sqft",
      step: 0.1,
      group: "insulationMaterials",
    },
    {
      path: "extras.airSealPerSqft",
      label: "Air sealing",
      suffix: "$ / sqft",
      step: 0.05,
      group: "insulationExtras",
    },
    {
      path: "extras.baffleEach",
      label: "Soffit baffle",
      suffix: "$ each",
      step: 1,
      group: "insulationExtras",
    },
    {
      path: "extras.removalPerSqft",
      label: "Remove existing insulation",
      suffix: "$ / sqft",
      step: 0.05,
      group: "insulationExtras",
    },
    {
      path: "labour.mobilisationHours",
      label: "Set up and protect, per job",
      suffix: "crew-hours",
      step: 0.5,
      group: "insulationLabour",
    },
    {
      path: "labour.sprayRigSetupHours",
      label: "Spray rig set-up and flush",
      suffix: "crew-hours",
      step: 0.5,
      group: "insulationLabour",
    },
    {
      path: "labour.airSealHoursPerSqft",
      label: "Air sealing",
      suffix: "crew-hours / sqft",
      step: 0.001,
      group: "insulationLabour",
    },
    {
      path: "labour.productiveHoursPerDay",
      label: "Hours a crew gets on site in a day",
      suffix: "hours",
      step: 0.5,
      group: "insulationLabour",
    },
    {
      path: "materials.blown_fiberglass.materialCostPerBag",
      label: "Blown fibreglass",
      suffix: "$ / bag",
      step: 1,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.blown_cellulose.materialCostPerBag",
      label: "Blown cellulose",
      suffix: "$ / bag",
      step: 1,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.batt_fiberglass.materialCostPerBundle",
      label: "Fibreglass batt",
      suffix: "$ / bundle",
      step: 1,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.batt_stone_wool.materialCostPerBundle",
      label: "Stone wool batt",
      suffix: "$ / bundle",
      step: 1,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.spray_open_cell.materialCostPerSet",
      label: "Open-cell spray foam",
      suffix: "$ / set",
      step: 50,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.spray_closed_cell.materialCostPerSet",
      label: "Closed-cell spray foam",
      suffix: "$ / set",
      step: 50,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.rigid_board.materialCostPerSheet",
      label: "Rigid board",
      suffix: "$ / 4x8 sheet",
      step: 1,
      group: "insulationMaterialCost",
    },
    {
      path: "materials.radiant_barrier.materialCostPerSqft",
      label: "Foil radiant barrier",
      suffix: "$ / sqft",
      step: 0.05,
      group: "insulationMaterialCost",
    },
    {
      path: "materialCosts.vapourBarrierPerRoll",
      label: "Vapour barrier — 6 mil poly",
      suffix: "$ / roll (1,000 sqft)",
      step: 5,
      group: "insulationMaterialCost",
    },
    {
      path: "materialCosts.bafflePerUnit",
      label: "Soffit baffle",
      suffix: "$ each",
      step: 0.5,
      group: "insulationMaterialCost",
    },
    {
      path: "materialCosts.airSealCasePerUnit",
      label: "Air sealing foam & caulk",
      suffix: "$ / case",
      step: 5,
      group: "insulationMaterialCost",
    },
  ],
};

function cabinetFields() {
  return [
    { path: "perDoor", label: "Per door", suffix: "$ / door", step: 5 },
    {
      path: "perDrawer",
      label: "Per drawer front",
      suffix: "$ / drawer",
      step: 5,
    },
    {
      path: "complexityUpchargePerUnit.moderate",
      label: "Moderate complexity uplift",
      suffix: "$ / unit",
      step: 5,
    },
    {
      path: "complexityUpchargePerUnit.high",
      label: "High complexity uplift",
      suffix: "$ / unit",
      step: 5,
    },
    {
      path: "addOns.handleHolesPerDoor",
      label: "New handle holes",
      suffix: "$ / door",
      step: 1,
    },
    {
      path: "addOns.softCloseHingesPerDoor",
      label: "Soft-close hinges",
      suffix: "$ / door",
      step: 1,
    },
    {
      path: "addOns.drawerSlidesPerDrawer",
      label: "Drawer slides",
      suffix: "$ / drawer",
      step: 1,
    },
    {
      path: "addOns.twoToneFlat",
      label: "Two-tone base",
      suffix: "$ flat",
      step: 25,
    },
    {
      path: "addOns.twoTonePerUnit",
      label: "Two-tone per unit",
      suffix: "$ / unit",
      step: 1,
    },
    {
      path: "addOns.threeToneFlat",
      label: "Three-colour base",
      suffix: "$ flat",
      step: 25,
    },
    {
      path: "addOns.threeTonePerUnit",
      label: "Three-colour per unit",
      suffix: "$ / unit",
      step: 1,
    },
    { path: "minimumTotal", label: "Job minimum", suffix: "$", step: 100 },
  ];
}

function complexityFields(categoryKey, rows) {
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

/** Read a dot-path out of a book. */
export function readField(book, path) {
  return String(path)
    .split(".")
    .reduce((node, part) => (node == null ? undefined : node[part]), book);
}

/* ── What a trade is priced BY ─────────────────────────────────────────── */
//
// Settings > Services used to offer a generic "flat rate / per unit / hourly"
// choice for every trade. None of those is how a cabinet shop prices (per door
// and per drawer), or a stair refinisher (per tread, riser, baluster, newel
// post), or a painter (per sq ft) — and nothing downstream ever read the
// stored choice, so picking one changed no price anywhere.
//
// The units below are DERIVED from the field declarations above rather than
// listed a second time. A second list is the copy that rots: it would be the
// one nobody looks at when a trade's rates change. A trade added to the book
// later describes itself here with no edit.

// Path prefixes that price an EXTRA rather than the main scope. A soft-close
// hinge is charged per door, but "per door" is not what the job is quoted by.
const EXTRA_PREFIXES = [
  "addOns.",
  "extras.",
  "global.",
  "doorMaterials.",
  "complexityUpchargePerUnit.",
  // A home inspection is priced by the BAND the house falls in, not by the
  // kilometre or the sample. Without these, priceBookBasis would read the
  // travel and warranty rows and tell the settings screen that inspectors
  // charge "per km" and "per visit" — true of the extras, false of the trade.
  // The bands themselves are excluded already by their "$ flat" suffix.
  "ancillary.",
  "warrantyInspection.",
  "oversize.",
];

// "$ / tread" -> "tread". "$ flat", "$" and "%" name a whole-job price or a
// margin, not a unit of work, so they return null and drop out.
function unitFromSuffix(suffix) {
  const match = /^\$\s*\/\s*(.+)$/.exec(String(suffix || "").trim());
  return match ? match[1].trim() : null;
}

/**
 * The units this trade actually charges by, in the order the book declares
 * them — [{ label: "Per door", unit: "door" }, ...].
 *
 * Complexity tiers repeat the same rows once per level; the first occurrence
 * of a label wins, because a tier moves the NUMBER, not the unit. A trade
 * priced from a supplier's invoice (countertop) has no per-unit basis at all
 * and correctly returns [] — that absence is a fact about the trade, not a
 * gap to pad with a default.
 */
export function priceBookBasis(categoryKey) {
  const fields = ownEntry(PRICE_BOOK_FIELDS, categoryKey) || [];
  const seen = new Set();
  const basis = [];
  for (const field of fields) {
    if (field.internal) continue;
    if (EXTRA_PREFIXES.some((prefix) => field.path.startsWith(prefix)))
      continue;
    const unit = unitFromSuffix(field.suffix);
    if (!unit || seen.has(field.label)) continue;
    seen.add(field.label);
    basis.push({ label: field.label, unit });
  }
  return basis;
}

/**
 * The complexity tiers this trade's rates move with, or null when they don't.
 *
 * Two shapes exist: a full grid keyed by level (stairs, flooring, painting)
 * and a per-unit dollar uplift (cabinets). Both mean "the estimator picks a
 * tier and the rates change", which is the only thing a settings screen needs
 * to say, so both collapse to the same answer here.
 */
export function priceBookComplexity(categoryKey) {
  const book = ownEntry(TRADE_PRICE_BOOKS, categoryKey);
  if (!book) return null;
  const grid = book.complexity || book.complexityUpchargePerUnit;
  if (!grid) return null;
  const levels = COMPLEXITY_LEVELS.filter(
    (level) => grid[level.value] !== undefined,
  );
  return levels.length ? levels : null;
}

/**
 * Every unit any trade in the book charges by.
 *
 * Offered as suggestions on the ~50 catalog trades that have no book of their
 * own yet, so a tiler typing a unit reaches for the same word a flooring
 * installer already uses. "hour" and "job" are appended by the caller: no
 * trade in the book is time-priced, so neither can be derived from it.
 */
export function allPriceBookUnits() {
  const units = new Set();
  for (const key of Object.keys(PRICE_BOOK_FIELDS)) {
    for (const { unit } of priceBookBasis(key)) units.add(unit);
  }
  return [...units];
}
