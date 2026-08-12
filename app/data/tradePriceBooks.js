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
      { id: "countertop", label: "Countertop Supply & Installation", kind: "supply", defaultCost: 0 },
      { id: "backsplash", label: "Backsplash", kind: "supply", defaultCost: 0, heightOption: "4in" },
      { id: "sink", label: "Sink / Undermount Cutout", kind: "supply", defaultCost: 0 },
      { id: "waterfall", label: "Waterfall Edge", kind: "supply", defaultCost: 0 },
      { id: "removal", label: "Countertop Removal", kind: "labour", defaultCost: 0 },
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
      { id: "siding", label: "Siding / Cladding", unit: "sqft", priceType: "siding" },
      { id: "trim", label: "Trim & Soffit", unit: "sqft", priceType: "trim" },
      { id: "fascia", label: "Fascia Boards", unit: "lf", priceType: "fascia" },
      { id: "front_door", label: "Front Door(s)", unit: "door", priceType: "flat", flatPrice: 200 },
      { id: "garage_door", label: "Garage Door", unit: "door", priceType: "flat", flatPrice: 350 },
      { id: "shutters", label: "Shutters", unit: "pair", priceType: "flat", flatPrice: 75 },
      { id: "deck", label: "Deck / Porch", unit: "sqft", priceType: "deck" },
      { id: "fence", label: "Fence", unit: "lf", priceType: "fence" },
    ],
    extras: {
      pressureWashingPrice: 350,
      primePricePerSqft: 0.5,
    },
  },
};

/* ── Access ────────────────────────────────────────────────────────────── */

export function hasPriceBook(categoryKey) {
  return Boolean(TRADE_PRICE_BOOKS[categoryKey]);
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
  const base = TRADE_PRICE_BOOKS[categoryKey];
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
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    out[key] = mergeDeep(base[key], patch[key]);
  }
  return out;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/* ── Settings UI descriptors ───────────────────────────────────────────── */
// Same shape as RECIPE_EDITABLE_FIELDS so the rates screen can render a book
// it has never seen. `path` is dot-notation into the book.

/** Human labels for the `group` key on a field, when it has one. */
export const PRICE_BOOK_GROUPS = {
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
      { path: `doorMaterials.${key}.sellPerDoor`, label: "Sell — per door", suffix: "$ / door", step: 10, group: key },
      { path: `doorMaterials.${key}.sellPerDrawer`, label: "Sell — per drawer", suffix: "$ / drawer", step: 10, group: key },
      { path: `doorMaterials.${key}.costPerSqft`, label: "Supplier cost", suffix: "$ / sq ft", step: 0.25, group: key, internal: true },
    ]),
    { path: "avgDoorSqft", label: "Average door area", suffix: "sq ft", step: 0.25, internal: true },
    { path: "avgDrawerSqft", label: "Average drawer front area", suffix: "sq ft", step: 0.25, internal: true },
    { path: "supplierFinishingPerSqft", label: "Supplier finishing", suffix: "$ / sq ft", step: 0.25, internal: true },
    { path: "freightPerOrder", label: "Freight per order (under 20 doors)", suffix: "$", step: 5, internal: true },
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
    { path: "basementTreadPrice", label: "Basement tread", suffix: "$ / tread", step: 1 },
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
    { path: "defaultMarkupPct", label: "Default markup on supplier cost", suffix: "%", step: 1 },
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
    { path: "global.popcornRemovalPricePerSqft", label: "Popcorn ceiling removal", suffix: "$ / sqft", step: 0.25 },
    { path: "global.furnitureMovingPrice", label: "Furniture moving", suffix: "$ flat", step: 10 },
  ],
  exterior_painting: [
    ...complexityFields("exterior_painting", [
      ["siding", "Siding / cladding", "$ / sqft"],
      ["trim", "Trim & soffit", "$ / sqft"],
      ["fascia", "Fascia", "$ / linear ft"],
      ["deck", "Deck / porch", "$ / sqft"],
      ["fence", "Fence", "$ / linear ft"],
    ]),
    { path: "extras.pressureWashingPrice", label: "Pressure washing", suffix: "$ flat", step: 10 },
    { path: "extras.primePricePerSqft", label: "Priming", suffix: "$ / sqft", step: 0.25 },
  ],
};

function cabinetFields() {
  return [
    { path: "perDoor", label: "Per door", suffix: "$ / door", step: 5 },
    { path: "perDrawer", label: "Per drawer front", suffix: "$ / drawer", step: 5 },
    { path: "complexityUpchargePerUnit.moderate", label: "Moderate complexity uplift", suffix: "$ / unit", step: 5 },
    { path: "complexityUpchargePerUnit.high", label: "High complexity uplift", suffix: "$ / unit", step: 5 },
    { path: "addOns.handleHolesPerDoor", label: "New handle holes", suffix: "$ / door", step: 1 },
    { path: "addOns.softCloseHingesPerDoor", label: "Soft-close hinges", suffix: "$ / door", step: 1 },
    { path: "addOns.drawerSlidesPerDrawer", label: "Drawer slides", suffix: "$ / drawer", step: 1 },
    { path: "addOns.twoToneFlat", label: "Two-tone base", suffix: "$ flat", step: 25 },
    { path: "addOns.twoTonePerUnit", label: "Two-tone per unit", suffix: "$ / unit", step: 1 },
    { path: "addOns.threeToneFlat", label: "Three-colour base", suffix: "$ flat", step: 25 },
    { path: "addOns.threeTonePerUnit", label: "Three-colour per unit", suffix: "$ / unit", step: 1 },
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
