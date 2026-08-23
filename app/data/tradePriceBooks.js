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
      //             ×1.40 → $21.81. Shipped at $22.
      //
      //   moderate  Custom Interlocking, 636 Mikinak Rd, Feb 2021. A 1,220
      //             sqft patio at $30,679.34 after a $550 quarry discount =
      //             $25.15/sqft in 2021 money. That job carried 12" of base in
      //             3 lifts, Techo-Bloc Blu 60 mm, snap edge, Gator G2,
      //             geotextile, fence-panel removal, disposal, grading, soil
      //             and seed, and a 3-year warranty — which is what "moderate"
      //             should mean. ×1.30 → $32.70. Shipped at $33.
      //
      //   high      No real job in evidence, so this stays at the top of the
      //             published Ontario range rather than being extrapolated.
      //
      // ESCALATION. These are construction-cost factors, not CPI: residential
      // construction inputs in Ontario rose far faster than the consumer index
      // across 2021–22. ×1.40 for 2020, ×1.30 for 2021, ×1.15 for 2022. They
      // are estimates and they are the numbers here most worth replacing the
      // moment you have a current invoice of your own.
      standard: {
        desc: "Simple shape, good access, level ground, existing surface already gone",
        patioPricePerSqft: 22,
        walkwayPricePerSqft: 22,
        drivewayPricePerSqft: 25,
      },
      moderate: {
        desc: "Curves or cuts, a slope, deeper base, premium stone, or full grading and seed",
        patioPricePerSqft: 33,
        walkwayPricePerSqft: 30,
        drivewayPricePerSqft: 35,
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
    // in 2020. ×1.40 → $51.37.
    //
    // Steps are not separable from that total: the invoice bundles "step
    // include veneer" into the same section. So there is no per-step price
    // here, because the source does not contain one — a wall with steps in it
    // is quoted by its face area, which is how the invoice quoted it.
    wallPricePerFaceSqft: 51,
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

    // Man-hours per square foot, for the internal cost estimate and for
    // telling the client how long the crew will be on site.
    //
    // From a real Ottawa job rather than a published productivity table (no
    // Ontario source publishes one): 7 days, 3 crew full time — 21 crew-days,
    // about 168 man-hours at 8-hour days — on roughly 960 sqft of interlock.
    // 168 ÷ 960 = 0.175.
    //
    // That job ALSO built a deck, a concrete porch overlay, river rock beds
    // and lighting, so some of those hours were not paving. 0.175 is therefore
    // an upper bound on pure interlock and the figure most worth replacing
    // with your own crew's numbers. The published Ontario timeline anchor —
    // a 200–400 sqft patio in 2–4 days — works out to a similar 0.15–0.18 at
    // a three-person crew, which is the only corroboration available.
    labourHoursPerSqft: 0.175,
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
