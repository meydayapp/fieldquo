// app/data/priceBooks/systems.js
//
// The SYSTEMS trades: HVAC, solar PV, fire sprinkler — and the cost side of
// gutters and garage doors, which sell fine today and cost nothing.
//
// ══ What this file is NOT ═══════════════════════════════════════════════════
//
// It is not a second copy of anything already shipped. The brief that started
// it said "16 price books and 14 are empty"; that is false, and finding out it
// was false is most of what shaped this file. What actually exists today:
//
//   app/data/tradePriceBooks.js   16 books, ALL populated. roofing_service,
//                                 siding, gutter_services and garage_door are
//                                 among the richest in the product.
//   app/data/defaultLineItems.js  13 trades of un-priced chips, including
//                                 roofing_service's seven.
//   lib/pricing/roofLabour.js     roofing crew-hours, calibrated.
//   lib/pricing/insulation.js     insulation crew-hours.
//   app/data/materialRecipes.js   exactly two recipes: cabinets and exterior
//                                 painting.
//
// So the real hole is not "no sell price". It is:
//
//   1. Four system trades that nothing in the product can price at all —
//      hvac_install and hvac_repair are catalogue keys with no book and no
//      TRADE_DEFAULT_RATES entry, and solar and fire sprinkler are not
//      catalogue keys at all.
//   2. The COST side. Gutters says so about itself, in its own comment:
//      "no coil, guard or downspout supplier was read, so there is no cost
//      side to this book yet". Garage doors never had one either.
//
// This file fills those two and deliberately fills nothing else. roofing_service
// and siding are covered end to end already — sell rate, crew-hours, retail
// material cost, waste factor — and SYSTEMS_COVERAGE below records where each
// of those numbers lives plus the two genuine gaps found while checking, rather
// than restating them here as the copy that rots.
//
// ══ Nothing here is merged. That is the caller's job ════════════════════════
//
// Every export is a standalone map keyed by ServiceCategory.key. Splicing them
// into TRADE_PRICE_BOOKS / PRICE_BOOK_FIELDS / MATERIAL_RECIPES / STANDARD_ADDONS
// / DEFAULT_LINE_ITEMS is a separate, deliberate edit — see MERGE_NOTES at the
// bottom, which says exactly what has to happen for each one and what breaks if
// it does not.
//
// ══ Two currencies, never one converted into the other ═════════════════════
//
// Every COST in this file carries an explicit `usd` and an explicit `cad`, and
// each has its own basis string. This is the same rule electricalMaterials.js
// and electricalBenchmarks.js already state and for the same measured reason:
// Canadian shelf prices are NOT the US price times the spot rate, and a figure
// produced that way is a guess with a decimal point on it. `costIn()` below
// reads one or the other and will not convert; there is no rate in this file to
// convert with, on purpose.
//
// SELL rates are a single number and are US-market, stated per book in
// `rateBasis`. That is not laziness — the price-book helpers in
// tradePriceBooks.js read `complexity[level][priceType]` as a scalar and the
// rate-card renderer edits it as a scalar, so a {usd, cad} pair there would be
// a control that appears to work and doesn't. A Canadian contractor edits the
// grid; the book says so out loud instead of pretending the number travels.
//
// ══ The hard limit: these trades are ENGINEERED ════════════════════════════
//
// HVAC equipment is sized by a Manual J load calculation. A sprinkler system is
// hydraulically calculated and stamped. A PV array's structural loading and its
// utility interconnection are engineered and permitted. NONE of that happens
// here and none of it may ever happen here.
//
// What this file prices is the COST OF INSTALLING WHAT SOMEBODY ELSE SPECIFIED.
// You type in the tonnage from the load calc, the head count off the stamped
// drawing, the array size off the interconnection application — and this prices
// fitting it. A price book that appears to size equipment is worse than no
// price book, because the number it produces looks like an answer.
//
// The limit is DATA, not a comment: every book carries `engineeringLimit` with
// a `quoteBanner` a renderer must show, and
// scripts/check-pricebook-systems.mjs walks every key path and every string in
// every export and fails on sizing vocabulary. See FORBIDDEN_SIZING_TERMS there.

/* ── Money ─────────────────────────────────────────────────────────────── */

/**
 * A cost, in both currencies, reasoned separately.
 *
 * `usd` and `cad` are two independent observations of the same item in two
 * markets. Neither is derived from the other and there is no exchange rate in
 * this file to derive one with.
 */
const money = (usd, cad) => ({ usd, cad });

/**
 * A cost nobody has a defensible figure for.
 *
 * BOTH currencies are null together, never one of them, for the same reason
 * electricalBenchmarks.js nulls a band rather than half of one: a half-present
 * cost silently prices as zero in whichever market lost its number. `reason`
 * is mandatory and is shown to the contractor in place of a value.
 */
const noCost = (reason) => ({ usd: null, cad: null, blankReason: reason });

/**
 * Read one currency out of a cost. Never converts.
 *
 * Returns null when that market has no figure, which the caller must render as
 * "set your own" — NOT as zero, and NOT by falling back to the other currency.
 * Falling back is the whole failure this shape exists to prevent: a US roll of
 * aluminium coil is not what a Canadian roofer pays for one, and a margin
 * computed across the two is arithmetic in two units.
 */
export function costIn(cost, currency) {
  if (!cost || typeof cost !== "object") return null;
  const key = String(currency || "").toLowerCase();
  if (key !== "usd" && key !== "cad") return null;
  const value = cost[key];
  return Number.isFinite(value) ? value : null;
}

/* ── The engineering limit, as data ────────────────────────────────────── */

/**
 * What an engineer decides, what FieldQuo does instead, and the sentence a
 * client-facing surface must carry when it prices one of these trades.
 *
 * `blocking: true` means the quote builder should refuse to produce a total
 * until `inputSource` has been answered — not because the arithmetic fails
 * without it, but because a total with no stated design behind it reads as
 * FieldQuo's opinion about what the building needs.
 */
export const SYSTEMS_ENGINEERING_LIMITS = {
  hvac_install: {
    engineeredBy: "A licensed mechanical designer or engineer",
    decidesWhat:
      "Equipment capacity, duct sizing and static pressure, refrigerant line sizing, combustion air and venting.",
    method: "ACCA Manual J load calculation, Manual S selection, Manual D duct design",
    fieldquoDoesNot:
      "calculate a heating or cooling load, choose a tonnage, select equipment, or size a duct",
    inputSource:
      "Tonnage, furnace input and duct lengths are entered from the load calculation or the existing equipment's data plate.",
    quoteBanner:
      "Capacities in this quote are the ones supplied to us. They are priced, not calculated — a load calculation is a separate engineered document.",
    blocking: true,
  },
  hvac_repair: {
    engineeredBy: "Not engineered — but the refrigerant side is regulated",
    decidesWhat:
      "Refrigerant handling, recovery and leak repair are certification-controlled work (US EPA 608, Canada ODS/HFC regulations).",
    method: null,
    fieldquoDoesNot:
      "diagnose a fault, or state that a repair will restore rated capacity",
    inputSource:
      "The fault and the parts are entered by the technician after attending.",
    quoteBanner:
      "Priced from the fault found on site. Refrigerant work is carried out by certified technicians.",
    blocking: false,
  },
  solar_pv_install: {
    engineeredBy:
      "A licensed structural engineer and a licensed electrical engineer or master electrician",
    decidesWhat:
      "Roof structural capacity and attachment spacing, array layout, string sizing and conductor sizing, rapid shutdown, point of interconnection and any service upgrade.",
    method:
      "Stamped structural letter, electrical design to NEC 690 / CEC Section 64, utility interconnection approval",
    fieldquoDoesNot:
      "lay out an array, choose a system capacity, size a conductor or an inverter, or state a production figure",
    inputSource:
      "Array watts, module count, roof planes and battery capacity are entered from the approved design and the interconnection application.",
    quoteBanner:
      "This prices the installation of an approved design. Array size, structural attachment and interconnection are engineered separately and permitted before work starts.",
    blocking: true,
  },
  fire_sprinkler: {
    engineeredBy:
      "A licensed fire protection engineer or NICET-certified designer",
    decidesWhat:
      "Hazard classification, design density and area of operation, head type, spacing and coverage, pipe schedule or hydraulic calculation, water supply adequacy.",
    method:
      "NFPA 13 / 13R / 13D hydraulic calculation, stamped drawings, authority-having-jurisdiction plan review",
    fieldquoDoesNot:
      "classify a hazard, space a head, calculate a demand, or judge whether a water supply is adequate",
    inputSource:
      "Head count, pipe lengths and device counts are taken off the stamped shop drawing.",
    quoteBanner:
      "Quantities are taken off approved drawings. FieldQuo prices the installation of a design; it does not produce or check one.",
    blocking: true,
  },
  // The two cost-only trades below are not engineered, and saying so plainly is
  // worth as much as the four above: it tells a renderer not to put a banner on
  // a gutter quote, which would train contractors to click past the ones that
  // matter.
  gutter_services: {
    engineeredBy: null,
    decidesWhat: null,
    method: null,
    fieldquoDoesNot: "size a downspout for a roof's drainage area",
    inputSource: "Measured on site or off the roof takeoff.",
    quoteBanner: null,
    blocking: false,
  },
  garage_door: {
    engineeredBy: null,
    decidesWhat:
      "Wind-load rating where a code requires one is a manufactured-product rating, chosen from a schedule, not calculated here.",
    method: null,
    fieldquoDoesNot: "select a wind-load rating or size a spring",
    inputSource: "Opening size measured on site; door model chosen by the client.",
    quoteBanner: null,
    blocking: false,
  },
};

export function engineeringLimitFor(categoryKey) {
  return Object.prototype.hasOwnProperty.call(
    SYSTEMS_ENGINEERING_LIMITS,
    categoryKey,
  )
    ? SYSTEMS_ENGINEERING_LIMITS[categoryKey]
    : null;
}

/* ── Industry and category mapping ─────────────────────────────────────── */
//
// `industries` are slugs from app/data/industries.js. `categoryExists` says
// whether lib/trades/catalog.js already knows the key — two of these four do
// not, and the merge cannot happen without adding them there first.
//
// TWO OF THE FOUR MAP TO NO INDUSTRY THIS PRODUCT SHIPS, and that is recorded
// rather than forced. INDUSTRIES has twelve slugs and none of them is solar or
// fire protection. Filing solar under "electrical" would put a PV array in
// front of every electrician who signs up and would put an electrician's
// service-call book in front of a solar company; filing sprinklers under
// "plumbing" is the same mistake with a life-safety system attached. A trade
// with `industries: []` is still reachable — categoriesWithoutIndustry() in
// lib/trades/catalog.js exists for exactly this — it just is not offered by a
// signup preset. That is the honest state until the owner decides whether
// FieldQuo sells to those two markets.
export const SYSTEMS_TRADES = {
  hvac_install: {
    label: "HVAC Installation",
    industries: ["hvac"],
    categoryExists: true,
    note: "Catalogue key exists (sortOrder 27) with no price book and no TRADE_DEFAULT_RATES entry — tradeIsPricedByDefault() is false for it today.",
  },
  hvac_repair: {
    label: "HVAC Repair & Service",
    industries: ["hvac"],
    categoryExists: true,
    note: "Catalogue key exists (sortOrder 28), same gap.",
  },
  solar_pv_install: {
    label: "Solar PV Installation",
    industries: [],
    categoryExists: false,
    note: "NEW key. No industry in app/data/industries.js fits. Closest neighbours are `electrical` and `construction-contracting`, and both are wrong in a way that shows up on a signup preset — see the comment above.",
  },
  fire_sprinkler: {
    label: "Fire Sprinkler Installation & Service",
    industries: [],
    categoryExists: false,
    note: "NEW key. No industry fits; fire protection is its own trade with its own licensing. Do not file it under plumbing.",
  },
  gutter_services: {
    label: "Gutters & Eavestroughs",
    industries: ["cleaning", "construction-contracting", "handyman", "roofing"],
    categoryExists: true,
    note: "Sell book already complete. This file adds ONLY the cost side the book itself names as missing.",
  },
  garage_door: {
    label: "Garage Door Services",
    industries: ["construction-contracting", "handyman"],
    categoryExists: true,
    note: "Sell book already complete. This file adds ONLY the cost side.",
  },
  roofing_service: {
    label: "Roofing",
    industries: ["roofing"],
    categoryExists: true,
    note: "Nothing added. Covered end to end — see SYSTEMS_COVERAGE.",
  },
  siding: {
    label: "Siding",
    industries: ["roofing"],
    categoryExists: true,
    note: "Nothing added. Covered end to end — see SYSTEMS_COVERAGE.",
  },
};

/* ── New units ─────────────────────────────────────────────────────────── */
//
// allPriceBookUnits() derives the unit vocabulary from PRICE_BOOK_FIELDS
// suffixes, so a unit only exists once a book uses it. These are the ones the
// systems trades add. Each is listed with why no existing word would do,
// because a synonym is worse than a new word: "linear foot" alongside the
// existing "linear ft" would split one concept in two and the check below
// fails on exactly that.
export const SYSTEMS_NEW_UNITS = {
  ton: "Nominal tons of cooling, 12,000 BTU/h each. The unit the whole HVAC trade quotes and orders in. Taken from the load calculation, never computed here.",
  head: "One sprinkler head, and one ductless indoor head. Both trades say 'head' and both mean 'the terminal device plus the branch that feeds it'.",
  watt: "Watts DC of module capacity. Residential PV is quoted per watt everywhere; per kW would put every sell rate three decimal places away from the number a contractor recognises.",
  kWh: "Usable kilowatt-hours of battery storage, which is how batteries are sold and warrantied.",
  kW: "Kilowatts, for the ground-mount adder only — racking and trenching scale with array capacity, not with module count.",
  panel: "One PV module, for remove-and-refit during roof work. Counted, not measured.",
  lb: "Pounds of refrigerant. Charged and recovered by weight, and regulated by weight.",
  visit: "One attendance. Maintenance and annual inspections are sold per visit, not per hour — the hours are the cost side.",
  hour: "Billed labour. Already appended by callers of allPriceBookUnits(); declared here because hvac_repair is the first book to actually price by it.",
  day: "A hired machine's day. A crane, a boom lift and a scissor lift are all billed by the day with a minimum, and re-billed to the client the same way — 'per job' would hide the second and third day of a hire.",
};

/* ── Sell-side books ───────────────────────────────────────────────────── */
//
// Shape is exactly app/data/tradePriceBooks.js `exterior_painting`: a
// `complexity` grid with a `desc` per tier and a rate per priceType, and an
// `items[]` where each item is either priceType-driven or `priceType: "flat"`
// with a `flatPrice`. That is what PRICE_BOOK_FIELDS, priceBookBasis,
// priceBookComplexity and allPriceBookUnits already know how to read.
//
// A `flatPrice: 0` is not a price. It is the book saying "nobody has told us
// what this company charges", the same call garage_door.installPricePerDoor
// already makes, and every one of them carries a `blankReason` that the rate
// card must render instead of a dollar sign.

const US_SELL = (note) => ({
  region: "US",
  currency: "USD",
  note,
  warning:
    "These are US-market figures in US dollars. A Canadian company must edit the grid — there is no conversion applied and none is correct.",
});

export const SYSTEMS_PRICE_BOOKS = {
  // ── HVAC installation and replacement ─────────────────────────────────
  //
  // Priced per TON of cooling and per unit of equipment, because that is what
  // is ordered and what the load calculation hands you. Everything in the grid
  // moves with access, not with brand: a 3-ton changeout in a walk-in basement
  // and the same 3 tons in a 4-foot attic are the same equipment and a
  // different job, and access is the only thing an estimator can see from the
  // driveway.
  hvac_install: {
    label: "HVAC Installation",
    rateBasis: US_SELL(
      "Per-ton figures back-calculated from whole-system installed prices, which is the only form this market publishes: a 3-ton central AC changeout commonly quotes $5,000-$8,500 installed ($1,650-$2,800/ton), and a 3-ton ducted air-source heat pump $8,000-$12,500 ($2,650-$4,150/ton). The tiers sit at the low, middle and high of each observed band rather than at a midpoint plus invented spread.",
    ),
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.hvac_install,

    complexity: {
      standard: {
        desc: "Like-for-like changeout. Ground-floor or garage mechanical room, existing pad and lineset reusable, existing ductwork unchanged, no electrical work, one storey.",
        splitAcPerTon: 1700,
        heatPumpPerTon: 2600,
        furnaceEach: 5200,
        miniSplitHeadEach: 1900,
        ductLinearFt: 28,
        registerEach: 65,
      },
      moderate: {
        desc: "Attic or crawlspace air handler, new refrigerant lineset, minor duct modification or a condensate pump, mechanical permit and one inspection.",
        splitAcPerTon: 2150,
        heatPumpPerTon: 3200,
        furnaceEach: 6600,
        miniSplitHeadEach: 2400,
        ductLinearFt: 38,
        registerEach: 95,
      },
      high: {
        desc: "System or fuel changeover, lineset routed through finished walls, rooftop or crane-set equipment, service upgrade required from others, or pre-1990 duct insulation that has to be handled as hazardous.",
        splitAcPerTon: 2800,
        heatPumpPerTon: 4100,
        furnaceEach: 8500,
        miniSplitHeadEach: 3200,
        ductLinearFt: 55,
        registerEach: 140,
      },
    },

    items: [
      {
        id: "split_ac",
        label: "Central air conditioner — supply & install",
        unit: "ton",
        priceType: "splitAcPerTon",
      },
      {
        id: "heat_pump",
        label: "Air-source heat pump — supply & install",
        unit: "ton",
        priceType: "heatPumpPerTon",
      },
      {
        id: "furnace",
        label: "Gas furnace — supply & install",
        unit: "each",
        priceType: "furnaceEach",
      },
      {
        id: "mini_split_head",
        label: "Ductless indoor head — supply & install",
        unit: "head",
        priceType: "miniSplitHeadEach",
      },
      {
        id: "mini_split_outdoor",
        label: "Ductless outdoor unit — supply & install",
        unit: "each",
        priceType: "flat",
        flatPrice: 2600,
      },
      {
        id: "duct_run",
        label: "Duct trunk or branch — new",
        unit: "linear ft",
        priceType: "ductLinearFt",
      },
      {
        id: "register",
        label: "Register or grille — cut in and fit",
        unit: "each",
        priceType: "registerEach",
      },
      {
        id: "lineset",
        label: "Refrigerant lineset — replace",
        unit: "each",
        priceType: "flat",
        flatPrice: 900,
      },
      {
        id: "thermostat",
        label: "Thermostat — supply & install",
        unit: "each",
        priceType: "flat",
        flatPrice: 320,
      },
      {
        id: "condensate_pump",
        label: "Condensate pump and line",
        unit: "each",
        priceType: "flat",
        flatPrice: 350,
      },
      {
        id: "startup",
        label: "Startup, charge verification and commissioning",
        unit: "each",
        priceType: "flat",
        flatPrice: 250,
      },
      {
        id: "permit",
        label: "Mechanical permit and inspection",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "Permit fees are set per jurisdiction and range from nothing to several hundred. There is no national figure and a plausible one would be billed for real.",
      },
      {
        id: "crane",
        label: "Crane or boom placement",
        unit: "day",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "A crane is subcontracted and re-billed at what the crane company charged. See SYSTEMS_RECIPES for the day-rate cost default the margin panel uses.",
      },
    ],

    extras: {
      // Hauling the old equipment. Scrap value on a copper-coil condenser
      // sometimes covers it and sometimes does not, so this is a charge, not a
      // credit, and the estimator zeroes it when the scrap paid for the trip.
      oldEquipmentRemovalPrice: 175,
    },
  },

  // ── HVAC service and repair ───────────────────────────────────────────
  //
  // Priced by the hour and by the visit, which is what this half of the trade
  // actually sells. Refrigerant is per pound because that is how it is bought,
  // charged and — in both countries — regulated.
  //
  // After-hours is deliberately NOT in the grid. §2D.1 of the plumbing research
  // already in this repo found the reliable form is a MULTIPLIER, not an
  // amount, and the same is true here; it lives in `extras` as a multiplier and
  // the check asserts it never turns into a dollar figure.
  hvac_repair: {
    label: "HVAC Repair & Service",
    rateBasis: US_SELL(
      "Residential HVAC billed labour runs about $100-$200/hr across US markets, with diagnostic fees clustering near $90-$150 — the plumbing benchmark file in this repo cites HVAC diagnostics at ~$89 against electrical's $125-175. Maintenance visits are sold at $120-$300 depending on whether they are one-off or part of a plan.",
    ),
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.hvac_repair,

    complexity: {
      standard: {
        desc: "Accessible equipment in a basement, garage or on a ground-level pad. Daytime, single system, no confined space.",
        labourHour: 125,
        refrigerantPerLb: 95,
        maintenanceVisitEach: 149,
      },
      moderate: {
        desc: "Attic, crawlspace or roof-mounted equipment, or a second system on the same visit. Ladders or staging required.",
        labourHour: 150,
        refrigerantPerLb: 135,
        maintenanceVisitEach: 219,
      },
      high: {
        desc: "Confined or hazardous access, commercial rooftop unit, or a system on a refrigerant in short supply where recovery and reclaim add a second trip.",
        labourHour: 195,
        refrigerantPerLb: 190,
        maintenanceVisitEach: 299,
      },
    },

    items: [
      {
        id: "diagnostic",
        label: "Diagnostic and system check — first hour",
        unit: "each",
        priceType: "flat",
        flatPrice: 149,
      },
      {
        id: "labour",
        label: "Repair labour",
        unit: "hour",
        priceType: "labourHour",
      },
      {
        id: "refrigerant",
        label: "Refrigerant — recover, weigh in and leak-test",
        unit: "lb",
        priceType: "refrigerantPerLb",
      },
      {
        id: "maintenance",
        label: "Seasonal maintenance visit",
        unit: "visit",
        priceType: "maintenanceVisitEach",
      },
      {
        id: "coil_clean",
        label: "Evaporator or condenser coil — deep clean",
        unit: "each",
        priceType: "flat",
        flatPrice: 285,
      },
      {
        id: "duct_seal",
        label: "Accessible duct sealing",
        unit: "linear ft",
        priceType: "flat",
        flatPrice: 9,
      },
      {
        id: "trip",
        label: "Trip charge — outside the standard service area",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "A service area is a company's own decision and so is whether the trip is credited back on approval. Both are live practice; neither is a default.",
      },
    ],

    extras: {
      // A multiplier, not a price. Written as the multiple itself (1.5 == one
      // and a half times) so it can never be read as dollars by a renderer
      // that finds it.
      afterHoursMultiplier: { weeknight: 1.5, weekend: 2.0, holiday: 2.5 },
      // The floor on a small call. Below this the minimum IS the price: a
      // twenty-minute capacitor swap does not cost twenty minutes of labour to
      // put a certified technician in a van and get him there.
      minimumCallPrice: 189,
    },
  },

  // ── Solar PV installation ─────────────────────────────────────────────
  //
  // Priced per WATT DC, which is how every residential PV quote in North
  // America is written and compared. The watts come off the approved design.
  //
  // The tiers are ROOF and ELECTRICAL difficulty, and nothing else. They are
  // not "system size" tiers: a 4 kW array on a slate roof is harder than a
  // 12 kW array on a walkable comp-shingle ranch, and pricing by size would get
  // that backwards.
  solar_pv_install: {
    label: "Solar PV Installation",
    rateBasis: US_SELL(
      "US residential PV is quoted per watt DC and commonly lands between $2.50 and $4.00/W installed before incentives, with modelled benchmark system costs at the low end of that and retail quotes above it. Battery storage installed runs roughly $12,000-$18,000 for a ~13.5 kWh unit, which is $890-$1,330 per usable kWh.",
    ),
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.solar_pv_install,

    complexity: {
      standard: {
        desc: "Single-storey asphalt shingle at a walkable pitch, one contiguous array plane, main panel with spare breaker capacity, inverter mounted at ground level beside the meter.",
        pvPerWatt: 2.6,
        batteryPerKwh: 900,
        groundMountPerKw: 450,
        modulesRefitEach: 95,
      },
      moderate: {
        desc: "Two storeys or a steeper walkable pitch, two or three roof planes, main-panel derate or a line-side tap, or a trenched run under 100 ft to a detached structure.",
        pvPerWatt: 3.1,
        batteryPerKwh: 1150,
        groundMountPerKw: 600,
        modulesRefitEach: 130,
      },
      high: {
        desc: "Tile, slate or standing-seam roof, ballasted flat roof, four or more planes, a service upgrade in scope, or a ground mount.",
        pvPerWatt: 3.85,
        batteryPerKwh: 1450,
        groundMountPerKw: 850,
        modulesRefitEach: 180,
      },
    },

    items: [
      {
        id: "pv_array",
        label: "Solar PV array — supply & install",
        unit: "watt",
        priceType: "pvPerWatt",
      },
      {
        id: "battery",
        label: "Battery storage — supply & install",
        unit: "kWh",
        priceType: "batteryPerKwh",
      },
      {
        id: "ground_mount",
        label: "Ground-mount racking, footings and trenched run",
        unit: "kW",
        priceType: "groundMountPerKw",
      },
      {
        id: "modules_refit",
        label: "Remove and refit modules for roof work",
        unit: "panel",
        priceType: "modulesRefitEach",
      },
      {
        id: "critter_guard",
        label: "Critter guard to the array perimeter",
        unit: "linear ft",
        priceType: "flat",
        flatPrice: 9,
      },
      {
        id: "engineering",
        label: "Structural and electrical engineering — stamped",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "Bought from the engineer and passed through at what the engineer charged. FieldQuo will not produce, price or imply a stamp.",
      },
      {
        id: "interconnection",
        label: "Utility interconnection application and fees",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "Set by the utility. They range from nothing to four figures within one state and there is no defensible default.",
      },
      {
        id: "permit",
        label: "Building and electrical permit",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason: "Jurisdictional. Same reason as the HVAC permit line.",
      },
      {
        id: "service_upgrade",
        label: "Main service or panel upgrade",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "This is electrical scope and app/data/electricalCatalog.js already carries `service_upgrade_200a`. Pricing it twice in two books is how the two answers start to disagree; the line exists here only so it cannot be forgotten.",
      },
    ],

    extras: {
      // Snow and leaf season, and the only recurring revenue in this trade.
      // A cleaning visit, not a performance promise: nothing in FieldQuo may
      // state a production figure before or after.
      arrayCleaningVisitPrice: 350,
    },
  },

  // ── Fire sprinkler ────────────────────────────────────────────────────
  //
  // Priced per HEAD and per foot of main, off a stamped drawing. Every quantity
  // in this book is COUNTED, never derived: a head count comes from the
  // drawing, and nothing here spaces a head, sets a density or judges a supply.
  //
  // The per-head rate carries the branch pipe, fittings and hangers back to the
  // cross main, because that is how the trade estimates and how the drawing
  // reads. Mains are separate, per foot, since a long run to a remote wing is
  // pipe and hangers with no heads on it.
  fire_sprinkler: {
    label: "Fire Sprinkler Installation & Service",
    rateBasis: US_SELL(
      "US residential NFPA 13D work is commonly cited at $1.00-$2.50/sqft in new construction and $2-$7/sqft as a retrofit into finished space; commercial NFPA 13 work runs higher again. At the ~130-200 sqft of coverage a residential head is listed for, those areas reconcile to roughly $200-$500 per head installed, which is the band the tiers sit across. Reconciling an area rate to a head rate is a DERIVATION and is flagged as one — a company should expect to move this first.",
    ),
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.fire_sprinkler,

    complexity: {
      standard: {
        desc: "NFPA 13D residential, new construction, open framing, CPVC on the domestic supply, single storey. Pipe is run before the ceilings go on.",
        headEach: 210,
        pipePerFt: 14,
        inspectionVisitEach: 350,
      },
      moderate: {
        desc: "13D or 13R retrofit into finished ceilings, or new 13R multi-family with a dedicated riser and backflow. Access is cut and made good.",
        headEach: 320,
        pipePerFt: 22,
        inspectionVisitEach: 500,
      },
      high: {
        desc: "NFPA 13 commercial in black steel, above light hazard, or any of: fire pump, standpipe, seismic bracing, or phased work in an occupied building.",
        headEach: 520,
        pipePerFt: 38,
        inspectionVisitEach: 850,
      },
    },

    items: [
      {
        id: "head",
        label: "Sprinkler head — supply and install, including branch pipe and hangers",
        unit: "head",
        priceType: "headEach",
      },
      {
        id: "main_pipe",
        label: "Main and cross main — supply and install",
        unit: "linear ft",
        priceType: "pipePerFt",
      },
      {
        id: "inspection",
        label: "Annual inspection and test",
        unit: "visit",
        priceType: "inspectionVisitEach",
      },
      {
        id: "riser",
        label: "Riser assembly, control valve and gauges",
        unit: "each",
        priceType: "flat",
        flatPrice: 3200,
      },
      {
        id: "backflow",
        label: "Backflow preventer — supply and install",
        unit: "each",
        priceType: "flat",
        flatPrice: 2800,
      },
      {
        id: "fdc",
        label: "Fire department connection",
        unit: "each",
        priceType: "flat",
        flatPrice: 1900,
      },
      {
        id: "switches",
        label: "Flow switch and tamper switch",
        unit: "each",
        priceType: "flat",
        flatPrice: 650,
      },
      {
        id: "head_replacement",
        label: "Replace a fused, painted or corroded head",
        unit: "head",
        priceType: "flat",
        flatPrice: 185,
      },
      {
        id: "hydro_test",
        label: "Hydrostatic test and certification",
        unit: "each",
        priceType: "flat",
        flatPrice: 750,
      },
      {
        id: "design",
        label: "Hydraulically calculated design drawings — by others",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason:
          "The design is bought from a licensed engineer or NICET designer and passed through at cost. FieldQuo does not produce it, price it, or imply that a quote containing this line includes one.",
      },
      {
        id: "plan_review",
        label: "Plan review and permit — authority having jurisdiction",
        unit: "each",
        priceType: "flat",
        flatPrice: 0,
        blankReason: "Set by the AHJ. Jurisdictional, like every permit line.",
      },
    ],

    extras: {
      // A sprinkler crew that has to come back because the AHJ failed the
      // rough-in is a real, forgettable cost. Priced as a visit.
      reinspectionVisitPrice: 450,
    },
  },
};

/* ── Settings UI descriptors ───────────────────────────────────────────── */
//
// These splice into PRICE_BOOK_GROUPS and PRICE_BOOK_FIELDS in
// tradePriceBooks.js. Without them the rates screen renders nothing for these
// four trades AND priceBookBasis()/allPriceBookUnits() return empty for them —
// which is the failure mode the whole brief was about, arriving one layer up.
// scripts/check-pricebook-systems.mjs asserts every field path resolves and
// every priceType is covered.

export const SYSTEMS_PRICE_BOOK_GROUPS = {
  hvacEquipment: "Equipment — supplied and installed",
  hvacDistribution: "Ductwork and distribution",
  hvacExtras: "Startup, permits and removal",
  hvacService: "Service labour and refrigerant",
  hvacServiceExtras: "Minimums and after-hours",
  solarArray: "Array, storage and mounting",
  solarPassThrough: "Engineering, permits and utility — passed through at cost",
  sprinklerInstall: "Heads, pipe and devices",
  sprinklerService: "Inspection, test and repair",
  sprinklerPassThrough: "Design and plan review — by others",
};

// Same generator shape as complexityFields() in tradePriceBooks.js. Duplicated
// here rather than imported because this file must stay importable by the seed
// scripts, which run without the `@/` alias loader — the same constraint
// lib/trades/catalog.js states about itself. On merge, the caller may drop this
// and use the original; the check asserts the two produce identical output.
function complexityFields(rows, group) {
  const out = [];
  for (const level of ["standard", "moderate", "high"]) {
    for (const [key, label, suffix] of rows) {
      out.push({
        path: `complexity.${level}.${key}`,
        label,
        suffix,
        level,
        group,
        step: suffix.includes("sqft") || suffix.includes("linear") ? 0.25 : 5,
      });
    }
  }
  return out;
}

export const SYSTEMS_PRICE_BOOK_FIELDS = {
  hvac_install: [
    ...complexityFields(
      [
        ["splitAcPerTon", "Central air conditioner", "$ / ton"],
        ["heatPumpPerTon", "Air-source heat pump", "$ / ton"],
        ["furnaceEach", "Gas furnace", "$ / each"],
        ["miniSplitHeadEach", "Ductless indoor head", "$ / head"],
        ["ductLinearFt", "Duct trunk or branch", "$ / linear ft"],
        ["registerEach", "Register or grille", "$ / each"],
      ],
      "hvacEquipment",
    ),
    {
      path: "extras.oldEquipmentRemovalPrice",
      label: "Remove and haul old equipment",
      suffix: "$ flat",
      step: 25,
      group: "hvacExtras",
    },
  ],

  hvac_repair: [
    ...complexityFields(
      [
        ["labourHour", "Repair labour", "$ / hour"],
        ["refrigerantPerLb", "Refrigerant", "$ / lb"],
        ["maintenanceVisitEach", "Seasonal maintenance visit", "$ / visit"],
      ],
      "hvacService",
    ),
    {
      path: "extras.minimumCallPrice",
      label: "Minimum charge for a service call",
      suffix: "$ flat",
      step: 5,
      group: "hvacServiceExtras",
    },
    // Multipliers, and rendered as multipliers. A "$" suffix here would make
    // the settings screen offer to charge one and a half dollars for a Tuesday
    // evening, and priceBookBasis() would report "per weeknight" as a unit this
    // trade charges by.
    {
      path: "extras.afterHoursMultiplier.weeknight",
      label: "After hours — weeknight",
      suffix: "×",
      step: 0.1,
      group: "hvacServiceExtras",
    },
    {
      path: "extras.afterHoursMultiplier.weekend",
      label: "After hours — weekend",
      suffix: "×",
      step: 0.1,
      group: "hvacServiceExtras",
    },
    {
      path: "extras.afterHoursMultiplier.holiday",
      label: "After hours — statutory holiday",
      suffix: "×",
      step: 0.1,
      group: "hvacServiceExtras",
    },
  ],

  solar_pv_install: [
    ...complexityFields(
      [
        ["pvPerWatt", "Solar PV array", "$ / watt"],
        ["batteryPerKwh", "Battery storage", "$ / kWh"],
        ["groundMountPerKw", "Ground-mount racking and trenching", "$ / kW"],
        ["modulesRefitEach", "Remove and refit modules", "$ / panel"],
      ],
      "solarArray",
    ),
    {
      path: "extras.arrayCleaningVisitPrice",
      label: "Array cleaning visit",
      suffix: "$ flat",
      step: 25,
      group: "solarArray",
    },
  ],

  fire_sprinkler: [
    ...complexityFields(
      [
        ["headEach", "Sprinkler head, with branch pipe", "$ / head"],
        ["pipePerFt", "Main and cross main", "$ / linear ft"],
        ["inspectionVisitEach", "Annual inspection and test", "$ / visit"],
      ],
      "sprinklerInstall",
    ),
    {
      path: "extras.reinspectionVisitPrice",
      label: "Re-inspection after a failed test",
      suffix: "$ flat",
      step: 25,
      group: "sprinklerService",
    },
  ],
};

/* ── Cost recipes ──────────────────────────────────────────────────────── */
//
// The internal half. Nothing here reaches a client surface — same boundary
// app/data/materialRecipes.js, electricalMaterials.js and the `materialCosts`
// blocks in tradePriceBooks.js all sit behind, and non-negotiable #4.
//
// Three parts to every recipe, and the middle one is the rule that matters:
//
//   materials   consumption × unit cost. `pack` is what you BUY, `cost` is
//               what ONE pack costs in each market, and `perUnit` derives the
//               rate rather than restating it — so a roll size can never
//               disagree with the number it was divided by.
//   labourHours HOURS. Never a dollar rate. Hours are a prediction about work
//               and the rate is a fact about payroll; they have different
//               owners and different reasons to change, which is why
//               roofLabour.js, paverLabour.js, cabinetLabour.js and
//               insulation.js all return bare hours and let
//               lib/costing/quoteCosting.js apply the crew's burdened cost.
//   equipment   day rates and haulage. `ownedByMostCrews` marks the ones a
//               settled company already has on the trailer — they should show
//               as zero for that company, and the flag is how a renderer knows
//               to ask instead of silently charging rent on an owned brake.
//
// CONFIDENCE, on every material, using the same three-value register as
// electricalBenchmarks.js:
//
//   read            a specific published or observed figure
//   derived         computed from read inputs; `basis` says from what
//   market_typical  the mid of a range this trade publishes widely, with no
//                   single source behind the exact number. Weaker than `read`
//                   and labelled so nobody mistakes it for stronger.
//
// There is no `guess`. Where there was nothing, there is noCost().

const HOURS_NOTE =
  "Crew-hours, not man-days and not dollars. Multiply by the crew's burdened cost in lib/costing/quoteCosting.js.";

export const SYSTEMS_RECIPES = {
  // ── HVAC installation ─────────────────────────────────────────────────
  hvac_install: {
    model: "systems_assembly",
    label: "HVAC Installation",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.hvac_install,

    materials: {
      ac_condenser_per_ton: {
        label: "Split AC condenser + matched indoor coil",
        per: "ton",
        pack: { size: 1, unit: "ton of nominal capacity" },
        cost: money(700, 980),
        usdBasis:
          "Mid-efficiency (14.3-15 SEER2) matched split at US distributor pricing works out near $600-$900 per ton for the outdoor unit and coil together.",
        cadBasis:
          "Canadian HVAC distribution runs materially above US list on split equipment; $980/ton is the same mid-efficiency tier priced into the Canadian channel, not the US figure moved across.",
        confidence: "market_typical",
      },
      heat_pump_per_ton: {
        label: "Ducted air-source heat pump + matched coil",
        per: "ton",
        pack: { size: 1, unit: "ton of nominal capacity" },
        cost: money(1150, 1600),
        usdBasis:
          "A ducted heat pump carries roughly a 1.6x equipment premium over the same tonnage in cooling-only at the same efficiency tier.",
        cadBasis:
          "Same tier, Canadian channel. Cold-climate models — the ones actually specified in most of Canada — sit above this and should be entered as their own figure.",
        confidence: "market_typical",
      },
      furnace_95_afue: {
        label: "Condensing gas furnace, 80-100 kBTU input",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(1450, 2000),
        usdBasis: "95%+ AFUE two-stage residential furnace at distributor pricing.",
        cadBasis: "Same class, Canadian channel.",
        confidence: "market_typical",
      },
      mini_split_head: {
        label: "Ductless indoor head, wall-mount",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(480, 660),
        usdBasis: "9k-12k BTU wall cassette, mainstream brand, distributor.",
        cadBasis: "Same class, Canadian channel.",
        confidence: "market_typical",
      },
      mini_split_outdoor_2zone: {
        label: "Ductless outdoor unit, two-zone",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(1450, 1980),
        usdBasis: "Two-zone multi outdoor unit, mainstream brand, distributor.",
        cadBasis:
          "Cold-climate multi-zone outdoor units are the norm in Canada and cost more than the US baseline model; this is the Canadian mainstream, not a converted US price.",
        confidence: "market_typical",
      },
      lineset_3_8_x_3_4: {
        label: 'Insulated refrigerant lineset, 3/8" x 3/4"',
        per: "linear ft",
        pack: { size: 50, unit: "ft coil" },
        cost: money(195, 275),
        usdBasis: "50 ft pre-insulated lineset coil, US supply house.",
        cadBasis: "Same coil, Canadian supply house.",
        confidence: "market_typical",
        wastePct: 0.1,
      },
      flex_duct_r8: {
        label: "Insulated flexible duct, R-8",
        per: "linear ft",
        pack: { size: 25, unit: "ft box" },
        cost: money(62, 88),
        usdBasis: '25 ft box of 8" R-8 flex.',
        cadBasis: "Same box, Canadian supply.",
        confidence: "market_typical",
        wastePct: 0.12,
      },
      sheet_metal_trunk: {
        label: "Galvanised trunk duct and fittings",
        per: "linear ft",
        pack: { size: 1, unit: "linear ft, fabricated" },
        cost: money(14, 19),
        usdBasis: "Fabricated rectangular trunk with take-offs, per foot.",
        cadBasis: "Same, Canadian sheet metal shop rates.",
        confidence: "market_typical",
        wastePct: 0.08,
      },
      register_boot_grille: {
        label: "Register boot and grille",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(26, 36),
        usdBasis: "Boot, collar and a painted steel grille.",
        cadBasis: "Same assembly, Canadian retail/supply.",
        confidence: "market_typical",
      },
      refrigerant_r410a: {
        label: "R-410A refrigerant",
        per: "lb",
        pack: { size: 25, unit: "lb cylinder" },
        cost: money(340, 470),
        usdBasis: "25 lb cylinder, US wholesale.",
        cadBasis: "25 lb cylinder, Canadian wholesale.",
        confidence: "market_typical",
        note: "The A2L transition (R-454B, R-32) moves this and moves it upward while supply settles. It is the single figure in this recipe most likely to be stale, in both currencies at once.",
      },
      condensate_pump: {
        label: "Condensate pump and tubing",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(62, 88),
        usdBasis: "Mini condensate pump plus vinyl tubing.",
        cadBasis: "Same, Canadian supply.",
        confidence: "market_typical",
      },
      equipment_pad_and_stand: {
        label: "Composite pad or wall stand",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(48, 68),
        usdBasis: "Composite condenser pad.",
        cadBasis:
          "Canada more often needs a raised stand for snow clearance rather than a ground pad, which is the more expensive of the two and is what this figure buys.",
        confidence: "market_typical",
      },
      misc_fittings_per_system: {
        label: "Fittings, whips, disconnect, tape, mastic and hangers",
        per: "system",
        pack: { size: 1, unit: "system" },
        cost: money(120, 165),
        usdBasis:
          "The bag of small parts a changeout consumes. Derived by adding the individually trivial items that never get counted and always get bought.",
        cadBasis: "Same list, Canadian supply.",
        confidence: "derived",
      },
      thermostat: {
        label: "Thermostat",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: noCost(
          "Homeowner choice, and the spread is taste rather than trade: a builder-grade programmable and a top-of-line smart stat are an order of magnitude apart. Carry it as a client allowance line, not as a cost default.",
        ),
        confidence: "read",
        type: "allowance",
      },
    },

    // Two techs on a residential changeout is the industry norm and every
    // figure below is CREW-hours for that pair, not per person.
    labourHours: {
      note: HOURS_NOTE,
      // Load the van, drive, protect the floors, walk the job, clean up.
      // A one-day changeout does not amortise this away.
      mobilisationHours: 1.5,
      // A like-for-like split changeout is a one-day two-person job:
      // 2 techs x 6 h = 12 crew-hours, which is the middle of what this trade
      // schedules at one job per crew per day.
      changeoutHoursSplitSystem: 12,
      furnaceChangeoutHours: 8,
      // A single-head ductless is a long day for two: core drill, mount the
      // bracket, hang the head, set the pad, run and flare the lineset,
      // evacuate, commission.
      miniSplitFirstHeadHours: 9,
      miniSplitAdditionalHeadHours: 4.5,
      // Rigid trunk in an open basement. Attic and crawl are the accessFactor
      // below, not a second rate.
      ductHoursPerFt: 0.35,
      registerHoursEach: 0.75,
      linesetHoursPer10Ft: 0.6,
      // Triple evacuation to 500 microns is mostly waiting, and it is waiting
      // you pay a technician to stand through. Skipping it is the single most
      // common cause of a compressor failure inside warranty, so it is a line,
      // not an optimisation.
      evacuationHoursPerSystem: 1.0,
      startupCommissioningHours: 1.5,
      // Where the equipment sits. This is not a judgement call — an estimator
      // can see it from the driveway — which is why it is a factor and not a
      // complexity tier.
      accessFactor: {
        basement_or_garage: 1.0,
        crawlspace: 1.25,
        attic: 1.35,
        rooftop: 1.5,
      },
    },

    // How much of each material one unit of work eats. Separate from the unit
    // costs above for the same reason roofing keeps `wastePct` out of its
    // dollar figures: the sourcing list and the cost panel must agree about how
    // many of a thing to buy, and the yard loads the truck from the list.
    consumption: {
      linesetFtPerSystem: 30,
      // Factory charge covers the first 15-25 ft of line set. Beyond that the
      // system is topped up by weight, at roughly 0.6 oz per foot of 3/8"
      // liquid line — 0.0375 lb, rounded to 0.04.
      refrigerantLbPerAdditionalLinesetFt: 0.04,
      // A brand-new lineset is evacuated and charged from empty.
      refrigerantLbPerTonOnNewLineset: 2.5,
      padPerSystem: 1,
      miscFittingsPerSystem: 1,
    },

    // Defaults this file will NOT ship, and why. The check asserts none of
    // these keys ever appears in `consumption` — a refusal that can be quietly
    // overturned by a later edit is not a refusal.
    refusedDefaults: [
      {
        key: "tonsPerSqft",
        why: "That is a load calculation. Equipment capacity comes from Manual J, done by somebody licensed to do it, and a rule of thumb here would be FieldQuo sizing a system from a floor area — the exact thing the trade spent thirty years learning not to do.",
      },
      {
        key: "ductSizeForCfm",
        why: "Manual D. Duct size against airflow and static pressure is design, and this file prices duct by the foot at whatever size the design says.",
      },
    ],

    equipment: {
      crane_or_boom_day: {
        label: "Crane or boom truck with operator",
        basis: "day",
        cost: money(1250, 1700),
        usdBasis:
          "Small crane with operator at roughly $200-$350/hr against a four-hour minimum, which is what a rooftop set actually books.",
        cadBasis: "Same four-hour minimum, Canadian rates.",
        confidence: "market_typical",
        ownedByMostCrews: false,
      },
      old_equipment_haul: {
        label: "Haul and dispose of the removed equipment",
        basis: "each system",
        cost: money(95, 130),
        usdBasis:
          "Trip to the scrap yard or transfer station. Copper recovery sometimes covers it; a cost that is sometimes covered is still a cost.",
        cadBasis: "Same trip, Canadian transfer station rates.",
        confidence: "derived",
        ownedByMostCrews: false,
      },
      vacuum_pump_and_gauges: {
        label: "Vacuum pump, micron gauge, recovery machine, scale",
        basis: "day",
        cost: noCost(
          "Owned tooling on every HVAC van in the trade. It belongs in overhead — see Settings > Overhead — not on a job's material list, and putting a rental rate here would double-charge it.",
        ),
        confidence: "read",
        ownedByMostCrews: true,
      },
    },
  },

  // ── HVAC service and repair ───────────────────────────────────────────
  //
  // A parts list, because that is what a service recipe is. The parts below are
  // the ones a residential van carries because they are the ones that fail.
  hvac_repair: {
    model: "systems_service",
    label: "HVAC Repair & Service",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.hvac_repair,

    materials: {
      run_capacitor: {
        label: "Dual run capacitor",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(18, 26),
        usdBasis: "45/5 uF dual round, US supply house.",
        cadBasis: "Same part, Canadian supply house.",
        confidence: "market_typical",
      },
      contactor_2p_30a: {
        label: "Contactor, 2-pole 30 A",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(22, 31),
        usdBasis: "24 V coil, 2-pole 30 A definite-purpose contactor.",
        cadBasis: "Same part, Canadian supply house.",
        confidence: "market_typical",
      },
      condenser_fan_motor: {
        label: "Condenser fan motor",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(165, 230),
        usdBasis: "1/4 hp PSC replacement motor.",
        cadBasis: "Same class, Canadian supply.",
        confidence: "market_typical",
      },
      blower_motor_ecm: {
        label: "ECM blower motor",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(520, 720),
        usdBasis: "Variable-speed ECM replacement with module.",
        cadBasis: "Same class, Canadian supply.",
        confidence: "market_typical",
      },
      igniter_hot_surface: {
        label: "Hot surface igniter",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(34, 48),
        usdBasis: "Silicon nitride universal igniter.",
        cadBasis: "Same part, Canadian supply.",
        confidence: "market_typical",
      },
      flame_sensor: {
        label: "Flame sensor",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(14, 20),
        usdBasis: "Universal flame rod.",
        cadBasis: "Same part, Canadian supply.",
        confidence: "market_typical",
      },
      filter_media_merv13: {
        label: "Media filter, MERV 13",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(22, 31),
        usdBasis: "4-5 inch pleated media cabinet filter.",
        cadBasis: "Same filter, Canadian retail.",
        confidence: "market_typical",
      },
      r410a_topup: {
        label: "R-410A, charged by weight",
        per: "lb",
        pack: { size: 25, unit: "lb cylinder" },
        cost: money(340, 470),
        usdBasis:
          "Same 25 lb cylinder as the install recipe, deliberately the same number: it is the same cylinder off the same shelf, and two figures for one item is how they start to disagree.",
        cadBasis: "Same cylinder, Canadian wholesale.",
        confidence: "market_typical",
      },
    },

    labourHours: {
      note: HOURS_NOTE,
      // One technician, not two — this half of the trade runs solo.
      travelHoursPerCall: 0.5,
      diagnosticHours: 1.0,
      capacitorSwapHours: 0.5,
      contactorSwapHours: 0.6,
      condenserFanMotorHours: 1.5,
      blowerMotorHours: 2.5,
      igniterOrSensorHours: 0.75,
      // Electronic leak search plus dye where the leak is not obvious. This is
      // the repair most often quoted at half what it takes.
      leakSearchHours: 2.0,
      // Recovery is slow and is regulated; it cannot be vented to save the
      // hour.
      recoveryHoursPerSystem: 1.0,
      maintenanceVisitHours: 1.25,
    },

    consumption: {
      // One filter goes in on every maintenance visit. It is the cheapest line
      // on the ticket and the one most often given away and never counted.
      filtersPerMaintenanceVisit: 1,
    },

    refusedDefaults: [
      {
        key: "expectedRefrigerantLbPerCall",
        why: "A charge is weighed in against a measured deficit, not an average. Shipping an average is how a system gets overcharged, and an overcharged system fails in a way that looks like the technician's fault.",
      },
    ],

    equipment: {
      leak_detector_and_recovery: {
        label: "Electronic leak detector, recovery machine, recovery cylinder",
        basis: "day",
        cost: noCost(
          "Owned tooling. Overhead, not a job cost — same call as the install recipe's vacuum pump.",
        ),
        confidence: "read",
        ownedByMostCrews: true,
      },
    },
  },

  // ── Solar PV ──────────────────────────────────────────────────────────
  solar_pv_install: {
    model: "systems_assembly",
    label: "Solar PV Installation",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.solar_pv_install,

    materials: {
      module_per_watt: {
        label: "PV module, Tier-1 monocrystalline 400-450 W",
        per: "watt",
        pack: { size: 1, unit: "watt DC" },
        cost: money(0.34, 0.48),
        usdBasis:
          "US module pricing for mainstream residential Tier-1 mono has run in the $0.27-$0.40/W band at distributor level.",
        cadBasis:
          "Canadian distribution carries smaller volumes and a longer freight leg; $0.48/W is the Canadian residential distributor band, reasoned independently rather than converted.",
        confidence: "market_typical",
      },
      microinverter_each: {
        label: "Microinverter, one per module",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(155, 215),
        usdBasis: "Mainstream residential microinverter, distributor.",
        cadBasis: "Same unit, Canadian distributor.",
        confidence: "market_typical",
      },
      string_inverter_per_watt: {
        label: "String inverter with rapid shutdown",
        per: "watt",
        pack: { size: 1, unit: "watt DC" },
        cost: money(0.13, 0.19),
        usdBasis: "Residential string inverter, per watt of rated capacity.",
        cadBasis: "Same class, Canadian distributor.",
        confidence: "market_typical",
      },
      racking_per_module: {
        label: "Rail, clamps and mid/end hardware",
        per: "panel",
        pack: { size: 1, unit: "module's share" },
        cost: money(48, 68),
        usdBasis: "Rail-based residential racking, per module.",
        cadBasis: "Same system, Canadian distributor.",
        confidence: "market_typical",
        wastePct: 0.05,
      },
      flashing_per_attachment: {
        label: "Flashed roof attachment",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(11, 15),
        usdBasis: "Aluminium flashing with a lag or a butyl-sealed standoff.",
        cadBasis: "Same part, Canadian distributor.",
        confidence: "market_typical",
        note: "Attachment COUNT comes off the stamped structural letter. This file supplies a cost per attachment and never a spacing.",
      },
      dc_bos_per_watt: {
        label: "DC wire, connectors, conduit and grounding",
        per: "watt",
        pack: { size: 1, unit: "watt DC" },
        cost: money(0.11, 0.16),
        usdBasis: "Balance-of-system consumables per watt on a residential array.",
        cadBasis: "Same list, Canadian distributor.",
        confidence: "derived",
      },
      ac_disconnect: {
        label: "AC disconnect and labelling",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(95, 135),
        usdBasis: "Fused AC disconnect plus the required placarding.",
        cadBasis: "Same, Canadian supply.",
        confidence: "market_typical",
      },
      production_meter_socket: {
        label: "Production meter socket",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(78, 110),
        usdBasis: "Where the utility requires one. Many do not.",
        cadBasis: "Same, Canadian supply.",
        confidence: "market_typical",
      },
      battery_per_kwh: {
        label: "LFP home battery",
        per: "kWh",
        pack: { size: 1, unit: "kWh usable" },
        cost: money(420, 590),
        usdBasis:
          "Derived: a ~13.5 kWh residential LFP unit at distributor level lands near $5,500-$6,000, which is $410-$445 per usable kWh.",
        cadBasis: "Same unit, Canadian distributor.",
        confidence: "derived",
      },
      critter_guard_per_ft: {
        label: "Critter guard mesh and clips",
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(2.1, 3.0),
        usdBasis: "Coated mesh with clips, per foot of array perimeter.",
        cadBasis: "Same, Canadian distributor.",
        confidence: "market_typical",
        wastePct: 0.1,
      },
    },

    labourHours: {
      note: HOURS_NOTE,
      // A three-person residential crew.
      mobilisationHours: 3,
      // Racking, module, module-level electronics and DC wiring, per module,
      // on walkable comp shingle. A 20-module array is ~17 crew-hours of array
      // work plus the fixed items below, which is the one-and-a-bit-day job
      // this trade schedules.
      hoursPerModule: 0.85,
      // Each roof plane after the first is its own layout, its own rail run and
      // its own penetration set. The single biggest thing the per-watt rate
      // cannot see.
      additionalRoofPlaneHours: 1.5,
      inverterHours: 3,
      batteryHours: 8,
      // Point of interconnection: disconnect, conduit, breaker or tap, labels,
      // and the utility's witness if they want one.
      interconnectHours: 4,
      trenchHoursPerFt: 0.09,
      commissioningAndMonitoringHours: 2,
      // Roof covering, because it decides how a module gets attached.
      // Standing seam is BELOW 1.0 on purpose: seam clamps need no penetration
      // and no flashing, which is genuinely faster than comp shingle.
      roofFactor: {
        comp_shingle: 1.0,
        standing_seam: 0.9,
        tile: 1.45,
        slate: 1.7,
        flat_ballasted: 1.15,
      },
      pitchFactor: { low_slope: 1.0, walkable: 1.0, moderate: 1.12, steep: 1.3 },
    },

    consumption: {
      racksPerModule: 1,
      microinvertersPerModule: 1,
      acDisconnectsPerSystem: 1,
    },

    refusedDefaults: [
      {
        key: "attachmentsPerModule",
        why: "Attachment count and spacing come off the stamped structural letter. A default here would be FieldQuo deciding how much of a roof carries the array — a structural judgement, made by a file, about a building nobody looked at.",
      },
      {
        key: "arrayWattsPerRoofSqft",
        why: "That is array layout. It depends on obstruction, shading, plane orientation and setback rules that vary by jurisdiction, and every one of those is on the approved design.",
      },
      {
        key: "conductorSizeForCurrent",
        why: "Conductor sizing is NEC 690 / CEC Section 64 work. Priced per watt here as installed balance-of-system; never selected.",
      },
    ],

    equipment: {
      ladder_hoist_day: {
        label: "Ladder hoist for module lift",
        basis: "day",
        cost: money(110, 150),
        usdBasis: "Rental day rate for a panel-carrying ladder hoist.",
        cadBasis: "Same rental, Canadian rates.",
        confidence: "market_typical",
        ownedByMostCrews: true,
      },
      boom_lift_day: {
        label: "Towable boom lift",
        basis: "day",
        cost: money(380, 500),
        usdBasis: "Towable articulating boom, day rate plus delivery amortised.",
        cadBasis: "Same class of machine, Canadian rental rates.",
        confidence: "market_typical",
        ownedByMostCrews: false,
      },
      trencher_day: {
        label: "Walk-behind trencher",
        basis: "day",
        cost: money(260, 340),
        usdBasis: "Walk-behind trencher day rate.",
        cadBasis: "Same machine, Canadian rental rates.",
        confidence: "market_typical",
        ownedByMostCrews: false,
      },
      engineering_and_interconnection: {
        label: "Engineering stamp, permit and utility fees",
        basis: "pass-through",
        cost: noCost(
          "Bought from an engineer and from a utility, at their price. Passed through at cost with the invoice attached; a default here would be FieldQuo inventing the price of somebody else's professional service.",
        ),
        confidence: "read",
        ownedByMostCrews: false,
      },
    },
  },

  // ── Fire sprinkler ────────────────────────────────────────────────────
  fire_sprinkler: {
    model: "systems_assembly",
    label: "Fire Sprinkler Installation & Service",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.fire_sprinkler,

    materials: {
      cpvc_1in_per_ft: {
        label: 'Listed CPVC sprinkler pipe, 1"',
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(3.1, 4.4),
        usdBasis: "Listed orange CPVC, US fire-protection supply.",
        cadBasis: "Same listed pipe, Canadian fire-protection supply.",
        confidence: "market_typical",
        wastePct: 0.1,
      },
      cpvc_fittings_per_head: {
        label: "CPVC fittings and drops, per head",
        per: "head",
        pack: { size: 1, unit: "head's share" },
        cost: money(14, 20),
        usdBasis:
          "Derived: the tees, elbows, reducers and drop nipple a single head consumes on a branch line.",
        cadBasis: "Same list, Canadian supply.",
        confidence: "derived",
      },
      steel_sch40_1in_per_ft: {
        label: 'Schedule 40 black steel pipe, 1"',
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(5.4, 7.6),
        usdBasis: "Black steel, US supply, cut and threaded or grooved on site.",
        cadBasis: "Same pipe, Canadian supply.",
        confidence: "market_typical",
        wastePct: 0.08,
      },
      groove_fitting_each: {
        label: "Grooved coupling or fitting",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(22, 31),
        usdBasis: "Rigid grooved coupling with gasket.",
        cadBasis: "Same fitting, Canadian supply.",
        confidence: "market_typical",
      },
      head_concealed_residential: {
        label: "Concealed residential pendent head with cover plate",
        per: "head",
        pack: { size: 1, unit: "each" },
        cost: money(26, 37),
        usdBasis: "Listed residential concealed pendent plus its cover plate.",
        cadBasis: "Same listed head, Canadian supply.",
        confidence: "market_typical",
      },
      head_upright_commercial: {
        label: "Upright or pendent commercial head",
        per: "head",
        pack: { size: 1, unit: "each" },
        cost: money(11, 16),
        usdBasis: "Standard-response brass upright.",
        cadBasis: "Same head, Canadian supply.",
        confidence: "market_typical",
      },
      hanger_each: {
        label: "Listed hanger with rod and fastener",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(4.2, 6.0),
        usdBasis: "Listed sprinkler hanger assembly.",
        cadBasis: "Same assembly, Canadian supply.",
        confidence: "market_typical",
        note: "Hanger SPACING is on the drawing and in the standard. This file supplies a cost per hanger and never a spacing.",
      },
      riser_assembly: {
        label: "Riser: control valve, check, gauges, drain and test",
        per: "each",
        pack: { size: 1, unit: "assembly" },
        cost: money(850, 1180),
        usdBasis: "Residential/light-commercial riser components.",
        cadBasis: "Same components, Canadian fire-protection supply.",
        confidence: "market_typical",
      },
      backflow_rpz_2in: {
        label: 'Reduced-pressure backflow preventer, 2"',
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(1650, 2300),
        usdBasis: '2" RPZ assembly, US supply.',
        cadBasis: "Same assembly, Canadian supply.",
        confidence: "market_typical",
      },
      flow_switch: {
        label: "Waterflow switch",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(185, 260),
        usdBasis: "Vane-type flow switch with retard.",
        cadBasis: "Same device, Canadian supply.",
        confidence: "market_typical",
      },
      tamper_switch: {
        label: "Valve tamper switch",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(140, 195),
        usdBasis: "Supervisory tamper switch.",
        cadBasis: "Same device, Canadian supply.",
        confidence: "market_typical",
      },
      fdc: {
        label: "Fire department connection",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(520, 720),
        usdBasis: "Two-way FDC with check and plugs.",
        cadBasis: "Same assembly, Canadian supply.",
        confidence: "market_typical",
      },
      cpvc_solvent_cement: {
        label: "Listed CPVC solvent cement",
        per: "quart",
        pack: { size: 1, unit: "quart" },
        cost: money(32, 45),
        usdBasis: "One-step listed sprinkler cement, one quart.",
        cadBasis: "Same product, Canadian supply.",
        confidence: "market_typical",
      },
    },

    labourHours: {
      note: HOURS_NOTE,
      mobilisationHours: 2.5,
      // Rough-in and trim of one head, including its branch pipe back to the
      // cross main and its hangers. Open framing, before ceilings.
      headHoursNewConstruction: 1.1,
      // The same head into a finished ceiling: access opened, pipe fished,
      // access made good. Two and a bit times the work, which is the whole
      // reason retrofit prices per square foot at two to three times new.
      headHoursRetrofitFinished: 2.6,
      pipeHoursPerFtCpvc: 0.09,
      // Steel is cut, threaded or grooved, and hung heavier.
      pipeHoursPerFtSteel: 0.16,
      riserHours: 10,
      backflowHours: 6,
      // Fill, pressurise, hold, and stand there while the AHJ watches it.
      hydroTestHours: 4,
      inspectionBaseHours: 1.5,
      inspectionHoursPerHead: 0.04,
      // Occupied buildings are worked in phases with the system back in
      // service each night. It is not a harder job per foot; it is more trips.
      occupiedBuildingFactor: 1.35,
    },

    consumption: {
      fittingSetsPerHead: 1,
      // One quart of listed cement per 100 ft of CPVC is what a crew actually
      // opens. It is a consumable, not a design quantity.
      cementQuartsPerHundredFtCpvc: 0.5,
    },

    // The longest refusal list in the file, and it should be. Every quantity a
    // sprinkler system is built from is on a stamped drawing, and every one of
    // them is a life-safety decision made by somebody with a licence.
    refusedDefaults: [
      {
        key: "headsPerSqft",
        why: "Head spacing and coverage area ARE the design. They follow from the hazard classification and the design density, and they are counted off the drawing — never derived from a floor area by this or any other file.",
      },
      {
        key: "hangersPerFt",
        why: "Hanger spacing is prescribed by NFPA 13 and shown on the drawing. Counted, not defaulted.",
      },
      {
        key: "pipeFtPerHead",
        why: "Pipe length follows the routing on the drawing. Two systems with the same head count and different routing are different jobs.",
      },
      {
        key: "pipeSizeForDemand",
        why: "Pipe size comes out of the hydraulic calculation. There is no circumstance in which this product should hold an opinion about it.",
      },
    ],

    equipment: {
      scissor_lift_day: {
        label: "Scissor lift",
        basis: "day",
        cost: money(220, 290),
        usdBasis: "Electric scissor lift day rate, delivery amortised.",
        cadBasis: "Same machine, Canadian rental rates.",
        confidence: "market_typical",
        ownedByMostCrews: false,
      },
      pipe_threader_day: {
        label: "Power pipe threader",
        basis: "day",
        cost: money(95, 130),
        usdBasis: "Rental day rate; a steel shop owns one.",
        cadBasis: "Same rental, Canadian rates.",
        confidence: "market_typical",
        ownedByMostCrews: true,
      },
      hydro_test_pump_day: {
        label: "Hydrostatic test pump",
        basis: "day",
        cost: money(60, 85),
        usdBasis: "Rental day rate.",
        cadBasis: "Same rental, Canadian rates.",
        confidence: "market_typical",
        ownedByMostCrews: true,
      },
      design_and_plan_review: {
        label: "Hydraulic calculation, stamped drawings and AHJ plan review",
        basis: "pass-through",
        cost: noCost(
          "This is the engineered document the whole system is built from, and it is bought from a licensed engineer or NICET designer at their price. FieldQuo must never carry a default for it: a number here would read as FieldQuo pricing a design, one step from appearing to produce one.",
        ),
        confidence: "read",
        ownedByMostCrews: false,
      },
    },
  },

  // ── Gutters ───────────────────────────────────────────────────────────
  //
  // The gap the gutter book names about ITSELF, filled. Its own comment:
  // "no coil, guard or downspout supplier was read, so there is no cost side to
  // this book yet", and "the owner named [a production rate] as the next
  // research step rather than something to fill in".
  //
  // So this is the next research step. Every figure is labelled with what it
  // assumes, and the production rate — the one the owner asked for — is derived
  // out loud from a crew-day rather than asserted.
  //
  // The SELL side stays exactly where it is. Nothing in here is a price.
  gutter_services: {
    model: "systems_linear",
    label: "Gutters & Eavestroughs",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.gutter_services,

    materials: {
      alum_coil_5in: {
        label: '5" seamless aluminium coil, 0.027"',
        per: "linear ft of trough",
        pack: { size: 50, unit: 'ft (11.75" x 50 ft coil)' },
        cost: money(132, 185),
        usdBasis: 'One 11.75" x 50 ft painted 0.027" coil, US supply.',
        cadBasis: "Same coil, Canadian supply. 0.027 is the Canadian norm too.",
        confidence: "market_typical",
        wastePct: 0.08,
      },
      alum_coil_6in: {
        label: '6" seamless aluminium coil, 0.032"',
        per: "linear ft of trough",
        pack: { size: 50, unit: 'ft (15" x 50 ft coil)' },
        cost: money(205, 285),
        usdBasis: 'One 15" x 50 ft painted 0.032" coil, US supply.',
        cadBasis: "Same coil, Canadian supply.",
        confidence: "market_typical",
        wastePct: 0.08,
      },
      copper_coil: {
        label: "Copper coil",
        per: "linear ft of trough",
        pack: { size: 50, unit: "ft coil" },
        cost: noCost(
          "The book already says copper is 'priced off the metal and the fabricator, not off a published rate card'. That is as true of the coil as of the finished foot, and a stale copper number is worse than a blank one because it looks current.",
        ),
        confidence: "read",
      },
      hidden_hanger: {
        label: "Hidden hanger with screw",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(3.1, 4.3),
        usdBasis: "Hidden hanger with a self-drilling screw, US supply.",
        cadBasis: "Same hanger, Canadian supply.",
        confidence: "market_typical",
      },
      end_cap_pair: {
        label: "End caps, pair",
        per: "pair",
        pack: { size: 1, unit: "pair" },
        cost: money(6.4, 9.0),
        usdBasis: "Left and right painted aluminium caps.",
        cadBasis: "Same pair, Canadian supply.",
        confidence: "market_typical",
      },
      downspout_2x3: {
        label: '2" x 3" downspout',
        per: "linear ft",
        pack: { size: 10, unit: "ft section" },
        cost: money(13.5, 19.0),
        usdBasis: "One 10 ft painted aluminium section.",
        cadBasis: "Same section, Canadian supply.",
        confidence: "market_typical",
      },
      downspout_elbow: {
        label: "Downspout elbow",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(4.9, 6.9),
        usdBasis: "Painted aluminium A or B elbow.",
        cadBasis: "Same part, Canadian supply.",
        confidence: "market_typical",
      },
      downspout_bracket: {
        label: "Downspout bracket",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(3.4, 4.8),
        usdBasis: "Painted band bracket with fastener.",
        cadBasis: "Same part, Canadian supply.",
        confidence: "market_typical",
      },
      gutter_sealant: {
        label: "Gutter sealant",
        per: "tube",
        pack: { size: 1, unit: "tube" },
        cost: money(9.5, 13.0),
        usdBasis: "Butyl or tripolymer gutter sealant, one cartridge.",
        cadBasis: "Same cartridge, Canadian retail.",
        confidence: "market_typical",
      },
      zip_screws: {
        label: "Zip screws",
        per: "box",
        pack: { size: 250, unit: "screws" },
        cost: money(14.0, 19.5),
        usdBasis: "Box of 250 painted hex-head zip screws.",
        cadBasis: "Same box, Canadian retail.",
        confidence: "market_typical",
      },
      micro_mesh_guard: {
        label: "Micro-mesh gutter guard",
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(4.2, 5.9),
        usdBasis:
          "Contractor-grade stainless micro-mesh in bulk, per foot. Consumer retail systems are several times this and are a different product.",
        cadBasis: "Same product, Canadian supply.",
        confidence: "market_typical",
        wastePct: 0.05,
      },
      screen_guard: {
        label: "Basic screen guard",
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(1.6, 2.3),
        usdBasis: "Snap-in aluminium or plastic screen, per foot.",
        cadBasis: "Same product, Canadian retail.",
        confidence: "market_typical",
        wastePct: 0.05,
      },
      heat_cable: {
        label: "Self-regulating heat cable",
        per: "linear ft",
        pack: { size: 1, unit: "linear ft" },
        cost: money(4.8, 6.7),
        usdBasis: "Self-regulating roof and gutter cable, cut to length.",
        cadBasis:
          "Canada buys far more of this than the US does and buys the heavier 5-6 W/ft product; this is that product's Canadian price, not the US figure adjusted.",
        confidence: "market_typical",
        note: "Heat cable needs a dedicated GFCI circuit. That is electrical scope and lives in app/data/electricalCatalog.js — it is not in this cost.",
      },
    },

    // ── The production rate the owner asked for ─────────────────────────
    //
    // Derived, out loud, so it can be argued with: a two-person crew hangs
    // roughly 175 linear feet of seamless trough in an eight-hour day on a
    // single-storey house, running the machine on site. That is 16 crew-hours
    // over 175 ft = 0.091, rounded to 0.09.
    //
    // It is deliberately the SLOW end of what this trade claims. A crew on a
    // straight bungalow run with no corners does better; a crew on a cut-up
    // roof with eight inside corners does worse, and the corners are where the
    // day goes.
    labourHours: {
      note: HOURS_NOTE,
      mobilisationHours: 1.25,
      runHoursPerFt: 0.09,
      removalHoursPerFt: 0.022,
      downspoutHoursEach: 0.65,
      guardHoursPerFt: 0.035,
      // Hand-cleaning from a ladder, one person, moving the ladder every eight
      // feet. 0.018 h/ft is ~2.7 hours for 150 ft, which is a morning.
      cleaningHoursPerFt: 0.018,
      heatCableHoursPerFt: 0.05,
      repairHoursPerSection: 0.4,
      // INSTALL WORK ONLY. The book is explicit that its cleaning rates are
      // published per storey and already contain the height, and that charging
      // the height twice bills a three-storey clean for the ladders twice. The
      // same trap exists on the cost side and this is the same fix.
      storeyFactor: { one: 1.0, two: 1.25, three_plus: 1.55 },
      storeyFactorAppliesTo: ["run", "removal", "downspout", "guard", "heatCable"],
    },

    // The quantities a foot of gutter and a downspout actually eat. Every one
    // is a spacing a gutter crew works to, not a code requirement — which is
    // why these ship as defaults and the sprinkler ones above do not.
    consumption: {
      hangersPerFt: 0.5, // 24" on centre, the residential norm
      endCapPairsPerRun: 1,
      // One tube of sealant per 40 ft covers the end caps, the outside miters
      // and the downspout outlets on an ordinary run.
      sealantTubesPerFt: 0.025,
      // Hanger screws, seam screws and downspout strap screws.
      zipScrewsPerFt: 0.6,
      elbowsPerDownspout: 3,
      bracketsPerDownspout: 2,
      // One 10 ft section plus the offset at the top. A second storey is more
      // and the estimator says so; this is the single-storey default.
      downspoutFtPerDownspout: 12,
    },

    refusedDefaults: [
      {
        key: "downspoutsPerRoofArea",
        why: "How many downspouts a given drainage area needs is a sizing calculation against rainfall intensity. Counted on site, or taken off the roof measurement — never defaulted from an area.",
      },
    ],

    equipment: {
      gutter_machine_and_trailer_day: {
        label: "Portable roll-forming machine and trailer",
        basis: "day",
        cost: money(155, 210),
        usdBasis: "Rental day rate for a portable seamless gutter machine.",
        cadBasis: "Same machine, Canadian rental rates.",
        confidence: "market_typical",
        ownedByMostCrews: true,
        note: "Most established gutter crews own the machine — it is what makes them a gutter company. A company that owns it should mark it owned so the cost lands in overhead once rather than on every job twice.",
      },
      boom_lift_day: {
        label: "Towable boom lift",
        basis: "day",
        cost: money(380, 500),
        usdBasis:
          "Third-storey work and anything over a conservatory or a deck. Deliberately the same figure as the solar recipe: it is the same machine from the same yard.",
        cadBasis: "Same machine, Canadian rental rates.",
        confidence: "market_typical",
        ownedByMostCrews: false,
      },
      debris_disposal: {
        label: "Haul and dispose of removed trough and debris",
        basis: "per job",
        cost: money(45, 62),
        usdBasis:
          "A trip to the transfer station. Aluminium scrap sometimes covers it, the same way HVAC copper sometimes covers that trip; sometimes-covered is still a cost.",
        cadBasis: "Same trip, Canadian transfer station rates.",
        confidence: "derived",
        ownedByMostCrews: false,
      },
    },
  },

  // ── Garage doors ──────────────────────────────────────────────────────
  //
  // The book prices four doors and two capping frames and knows nothing about
  // what any of it costs. It also ships `installPricePerDoor: 0` because,
  // in its own words, "nobody has told us what this company charges to hang a
  // door". This recipe answers the other half of that: what it COSTS to hang
  // one, in hours, which is the input a company needs to work out what to
  // charge.
  garage_door: {
    model: "systems_assembly",
    label: "Garage Door Services",
    engineeringLimit: SYSTEMS_ENGINEERING_LIMITS.garage_door,

    materials: {
      door_8x7_insulated_steel: {
        label: "8 x 7 insulated steel sectional door",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(620, 860),
        usdBasis:
          "Two-layer insulated steel sectional at dealer cost, no windows.",
        cadBasis:
          "Same door from a Canadian manufacturer. The book's own sell prices are Canadian and note the 16x7 as the owner's confirmed number; this is the cost side of that market.",
        confidence: "market_typical",
      },
      door_16x7_insulated_steel: {
        label: "16 x 7 insulated steel sectional door",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(1180, 1620),
        usdBasis: "Two-layer insulated steel double, dealer cost, no windows.",
        cadBasis: "Same door, Canadian manufacturer.",
        confidence: "market_typical",
      },
      window_insert_set: {
        label: "Window insert section",
        per: "each",
        pack: { size: 1, unit: "section set" },
        cost: noCost(
          "The book prices windows as separate DOOR MODELS, not as an upcharge, because that is how they are ordered and how a client shops. So there is no standalone insert to cost — the cost is inside whichever door was ordered.",
        ),
        confidence: "read",
      },
      torsion_spring_pair: {
        label: "Torsion spring pair",
        per: "pair",
        pack: { size: 1, unit: "pair" },
        cost: money(68, 95),
        usdBasis: "Matched torsion pair, standard cycle life.",
        cadBasis: "Same pair, Canadian supply.",
        confidence: "market_typical",
        note: "Spring SIZING is a manufacturer's chart against door weight and drum. Cost only, here.",
      },
      track_hardware_kit: {
        label: "Track, rollers, hinges and brackets",
        per: "each",
        pack: { size: 1, unit: "door's set" },
        cost: money(115, 160),
        usdBasis: "Standard-lift track set with nylon rollers.",
        cadBasis: "Same set, Canadian supply.",
        confidence: "market_typical",
      },
      opener_belt_075hp: {
        label: "Belt-drive opener, 3/4 hp",
        per: "each",
        pack: { size: 1, unit: "each" },
        cost: money(255, 350),
        usdBasis: "Mainstream belt-drive opener with rail and safety sensors.",
        cadBasis: "Same opener, Canadian retail/dealer.",
        confidence: "market_typical",
      },
      weatherstrip_bottom_seal: {
        label: "Bottom seal and retainer",
        per: "each",
        pack: { size: 1, unit: "door's length" },
        cost: money(24, 34),
        usdBasis: "Vinyl bottom seal with aluminium retainer.",
        cadBasis:
          "Canada fits the cold-flexible compound as standard; that is the product costed here, not the cheaper US baseline seal.",
        confidence: "market_typical",
      },
      perimeter_stop_moulding: {
        label: "Perimeter stop moulding with seal",
        per: "opening",
        pack: { size: 1, unit: "opening" },
        cost: money(31, 44),
        usdBasis: "Three sides of vinyl-backed stop.",
        cadBasis: "Same, Canadian supply.",
        confidence: "market_typical",
      },
      alum_capping_coil: {
        label: "Aluminium capping coil for the frame",
        per: "opening",
        pack: { size: 1, unit: "opening's share of a coil" },
        cost: money(46, 64),
        usdBasis:
          "Derived from the same painted aluminium coil the gutter recipe buys, at the share one opening's jambs and header consume.",
        cadBasis: "Same coil, Canadian supply, same share.",
        confidence: "derived",
        wastePct: 0.12,
      },
      fasteners_and_sealant: {
        label: "Fasteners, shims, sealant and lubricant",
        per: "opening",
        pack: { size: 1, unit: "opening" },
        cost: money(19, 27),
        usdBasis: "The bag of small parts one opening consumes.",
        cadBasis: "Same list, Canadian supply.",
        confidence: "derived",
      },
    },

    labourHours: {
      note: HOURS_NOTE,
      // Two installers. A single door is a half day for the pair; a double
      // takes longer to lift, square and spring, not twice as long.
      mobilisationHours: 0.75,
      removeExistingHoursPerDoor: 1.0,
      installHoursSingleDoor: 3.5,
      installHoursDoubleDoor: 5.0,
      openerHours: 1.5,
      // A spring change on its own is a short, dangerous, one-visit job. It is
      // most of the callouts this category gets and it is the one that gets
      // under-quoted, because the wind-up is fast and the travel is not.
      springReplaceHours: 1.0,
      cappingHoursPerOpening: 1.25,
      // Framing that is out of square, rotten, or the wrong opening size is
      // discovered when the old door comes off, never before. Carried as an
      // allowance a company can zero, not folded into the install hours where
      // it would inflate every straightforward job.
      framingRemedialAllowanceHours: 1.5,
    },

    consumption: {
      springPairsPerDoor: 1,
      trackKitsPerDoor: 1,
      bottomSealsPerDoor: 1,
      stopMouldingPerOpening: 1,
      cappingPerOpening: 1,
      fastenerSetsPerOpening: 1,
    },

    refusedDefaults: [
      {
        key: "springSizeForDoorWeight",
        why: "Spring wire, inside diameter and length are read off the manufacturer's chart against the door's actual weight and the drum fitted. Getting it wrong is how a door comes down on somebody. This file costs a spring pair; it does not choose one.",
      },
      {
        key: "windLoadRating",
        why: "Where a code requires a wind-load rating it is a rating on a manufactured product, selected from a schedule against a design pressure. Not calculated here.",
      },
    ],

    equipment: {
      brake_and_trailer_day: {
        label: "Sheet metal brake and trailer for capping",
        basis: "day",
        cost: money(95, 130),
        usdBasis: "Rental day rate for a 10 ft portable brake.",
        cadBasis: "Same rental, Canadian rates.",
        confidence: "market_typical",
        ownedByMostCrews: true,
      },
      old_door_disposal: {
        label: "Haul and dispose of the removed door",
        basis: "each door",
        cost: money(45, 62),
        usdBasis: "Transfer station trip with a stripped sectional door.",
        cadBasis: "Same trip, Canadian transfer station rates.",
        confidence: "derived",
        ownedByMostCrews: false,
      },
    },
  },
};

/**
 * Merge a company's saved overrides over a systems recipe.
 *
 * Same contract as getRecipe() in app/data/materialRecipes.js — overrides carry
 * only what differs — but nested one level deeper, because a systems recipe's
 * top level is `materials` / `labourHours` / `equipment` rather than flat keys.
 * A company overriding one material's `cost.cad` must not lose that material's
 * `pack`, its `usdBasis` or the other currency.
 */
export function getSystemsRecipe(categoryKey, overrides) {
  const base = Object.prototype.hasOwnProperty.call(SYSTEMS_RECIPES, categoryKey)
    ? SYSTEMS_RECIPES[categoryKey]
    : null;
  if (!base) return null;
  if (!overrides || typeof overrides !== "object") return base;
  return mergePlain(base, overrides);
}

// Objects merge key by key; anything else replaces. Arrays replace wholesale,
// for the reason getPriceBook() states: index-wise merging turns "I deleted a
// row" into "I renamed a row to the next one down". The prototype guard is the
// same one, and for the same reason — overrides are company JSON that has been
// round-tripped through Postgres.
function mergePlain(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) {
    return Array.isArray(patch) ? patch : base;
  }
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch;
  }
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    out[key] = mergePlain(base[key], patch[key]);
  }
  return out;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/* ── What a contractor may edit ────────────────────────────────────────── */
//
// Same role RECIPE_EDITABLE_FIELDS and CONSUMABLE_EDITABLE_FIELDS play in
// materialRecipes.js: this is both the edit form AND the allowlist of keys that
// are legal to save as an override. Anything not listed here is not editable,
// which is deliberate — `pack.size` and the two `*Basis` strings are the
// PROVENANCE of a number, and a company that edits the price without editing
// the provenance leaves a figure attributed to a source it never came from.
//
// The currency pair is editable, one currency at a time, and never together:
// a company works in one market. Editing `cost.usd` must leave `cost.cad`
// exactly where it was, which is what mergePlain above guarantees and what the
// check proves.
export const SYSTEMS_RECIPE_EDITABLE_FIELDS = {
  material: [
    { key: "cost.usd", label: "Unit cost (USD)", type: "number", step: 0.01 },
    { key: "cost.cad", label: "Unit cost (CAD)", type: "number", step: 0.01 },
    { key: "wastePct", label: "Waste factor", type: "number", step: 0.01 },
  ],
  equipment: [
    { key: "cost.usd", label: "Day / trip rate (USD)", type: "number", step: 1 },
    { key: "cost.cad", label: "Day / trip rate (CAD)", type: "number", step: 1 },
    {
      key: "ownedByMostCrews",
      label: "We own this — do not charge it to jobs",
      type: "boolean",
    },
  ],
  // Hours only. There is no dollar field in this list and there must never be
  // one: the moment a rate appears beside the hours, two places in the product
  // know what an hour costs and one of them is wrong.
  labourHours: [{ key: "*", label: "Crew-hours", type: "number", step: 0.05 }],
};

/* ── Line items ────────────────────────────────────────────────────────── */
//
// New entries for app/data/defaultLineItems.js. Prices are ABSENT, exactly as
// that file requires and for the reason it gives: "a wrong number on a document
// a client signs is worse than a blank one the contractor fills in".
//
// Only the trades that are NOT already in that file are here. roofing_service
// already has its seven and they are not restated — see SYSTEMS_COVERAGE.
//
// `key` is carried for the same reason electricalCatalog.js carries one: the
// cost recipes above and the coverage map below have to point at a line, and
// pointing by description string breaks the moment somebody improves the
// wording. It is inert in DEFAULT_LINE_ITEMS, which reads only description and
// unit.
const FLAT = "flat";
const EACH = "each";
const LF = "linear_ft";
const HOUR = "hour";

export const SYSTEMS_LINE_ITEMS = {
  hvac_install: [
    { key: "equipment_removal", description: "Remove and dispose of existing equipment", unit: FLAT },
    { key: "lineset_replace", description: "Refrigerant lineset — replace", unit: EACH },
    { key: "duct_modification", description: "Duct modification and transitions", unit: LF },
    { key: "register_cut_in", description: "Register or grille — cut in and fit", unit: EACH },
    { key: "condensate", description: "Condensate pump and drain line", unit: EACH },
    { key: "thermostat", description: "Thermostat — supply and install", unit: EACH },
    { key: "electrical_by_others", description: "Electrical circuit and disconnect — by others", unit: FLAT },
    { key: "startup", description: "Startup, charge verification and commissioning", unit: EACH },
    { key: "permit", description: "Mechanical permit and inspection", unit: FLAT },
    { key: "crane", description: "Crane or boom placement", unit: FLAT },
    // A $0 clause line, the pattern electricalCatalog.js took from real
    // estimates: an exclusion read inside the price table is accepted with the
    // quote, where one buried in a terms paragraph is not.
    { key: "load_calc_clause", description: "Load calculation and equipment sizing — not included", unit: FLAT },
    { key: "asbestos_clause", description: "Asbestos-containing duct insulation — not included", unit: FLAT },
  ],

  hvac_repair: [
    { key: "diagnostic", description: "Diagnostic and system check", unit: FLAT },
    { key: "labour_hourly", description: "Repair labour", unit: HOUR },
    { key: "refrigerant", description: "Refrigerant — recover, weigh in and leak-test", unit: EACH },
    { key: "leak_search", description: "Electronic leak search", unit: FLAT },
    { key: "coil_clean", description: "Evaporator or condenser coil — deep clean", unit: EACH },
    { key: "maintenance", description: "Seasonal maintenance visit", unit: EACH },
    { key: "duct_seal", description: "Accessible duct sealing", unit: LF },
    { key: "after_hours", description: "After-hours or emergency premium", unit: FLAT },
    { key: "trip_fee", description: "Trip charge — outside the standard service area", unit: FLAT },
    { key: "parts_clause", description: "Parts found faulty on arrival — billed separately", unit: FLAT },
  ],

  solar_pv_install: [
    { key: "array", description: "Solar PV array — supply and install", unit: EACH },
    { key: "battery", description: "Battery storage — supply and install", unit: EACH },
    { key: "ground_mount", description: "Ground-mount racking, footings and trenched run", unit: LF },
    { key: "modules_refit", description: "Remove and refit modules for roof work", unit: EACH },
    { key: "critter_guard", description: "Critter guard to the array perimeter", unit: LF },
    { key: "service_upgrade", description: "Main service or panel upgrade", unit: FLAT },
    { key: "engineering", description: "Structural and electrical engineering — stamped, by others", unit: FLAT },
    { key: "interconnection", description: "Utility interconnection application and fees", unit: FLAT },
    { key: "permit", description: "Building and electrical permit", unit: FLAT },
    { key: "roof_condition_clause", description: "Roof covering condition and remaining life — not assessed", unit: FLAT },
    { key: "production_clause", description: "Energy production and savings — not warranted by the installer", unit: FLAT },
  ],

  fire_sprinkler: [
    { key: "head", description: "Sprinkler head — supply and install, with branch pipe", unit: EACH },
    { key: "main_pipe", description: "Main and cross main — supply and install", unit: LF },
    { key: "riser", description: "Riser assembly, control valve and gauges", unit: EACH },
    { key: "backflow", description: "Backflow preventer — supply and install", unit: EACH },
    { key: "fdc", description: "Fire department connection", unit: EACH },
    { key: "switches", description: "Flow switch and tamper switch", unit: EACH },
    { key: "hydro_test", description: "Hydrostatic test and certification", unit: FLAT },
    { key: "inspection", description: "Annual inspection and test", unit: FLAT },
    { key: "head_replacement", description: "Replace a fused, painted or corroded head", unit: EACH },
    { key: "access_make_good", description: "Cut and make good ceiling access", unit: EACH },
    { key: "design", description: "Hydraulically calculated design drawings — by others", unit: FLAT },
    { key: "plan_review", description: "Plan review and permit — authority having jurisdiction", unit: FLAT },
    { key: "design_clause", description: "System design, hydraulic calculation and head layout — not included", unit: FLAT },
    { key: "water_supply_clause", description: "Adequacy of the water supply — not assessed", unit: FLAT },
  ],

  gutter_services: [
    { key: "trough_install", description: "Seamless eavestrough — supply and install", unit: LF },
    { key: "trough_removal", description: "Remove and dispose of existing eavestrough", unit: LF },
    { key: "downspout", description: "Downspout — supply and install", unit: EACH },
    { key: "downspout_extension", description: "Downspout extension or underground tie-in", unit: EACH },
    { key: "guard", description: "Gutter guard — supply and fit", unit: LF },
    { key: "cleaning", description: "Gutter cleaning and flush", unit: LF },
    { key: "repair_section", description: "Reseal or refasten a section", unit: EACH },
    { key: "heat_cable", description: "Heat cable — supply and install", unit: LF },
    { key: "fascia_repair", description: "Rotten fascia repair before hanging", unit: LF },
    { key: "lift_hire", description: "Lift hire for third-storey access", unit: FLAT },
    { key: "electrical_clause", description: "Dedicated circuit for heat cable — by others", unit: FLAT },
  ],

  garage_door: [
    { key: "door_supply_install", description: "Garage door — supply and install", unit: EACH },
    { key: "door_removal", description: "Remove and dispose of the existing door", unit: EACH },
    { key: "opener", description: "Opener — supply and install", unit: EACH },
    { key: "spring_replace", description: "Torsion spring replacement", unit: EACH },
    { key: "track_hardware", description: "Track, rollers and hardware — replace", unit: EACH },
    { key: "capping", description: "Aluminium capping to the frame", unit: EACH },
    { key: "weatherseal", description: "Bottom seal and perimeter weatherstrip", unit: EACH },
    { key: "framing_repair", description: "Frame repair or re-squaring before fitting", unit: FLAT },
    { key: "keypad_remote", description: "Keypad or additional remote", unit: EACH },
    { key: "electrical_clause", description: "Ceiling receptacle for the opener — by others", unit: FLAT },
  ],
};

/* ── Add-ons ───────────────────────────────────────────────────────────── */
//
// Seeded as Products against the category, the same way STANDARD_ADDONS works.
// Prices here ARE present, unlike the line items above, because a Product is a
// company's own saved price and the seed is a starting point it edits — that is
// the contract standardAddOns.js already states.
//
// US dollars, same caveat as every sell figure in this file. A `unitPrice: 0`
// carries a `description` that says why rather than pretending to be free.
export const SYSTEMS_ADD_ONS = {
  hvac_install: [
    { name: "Smart Thermostat — supply & install", unit: "each", unitPrice: 320, type: "product", description: "Supply and install a programmable or smart thermostat, and pair it to the system." },
    { name: "Whole-Home Humidifier", unit: "each", unitPrice: 750, type: "product", description: "Bypass or steam humidifier on the supply plenum, with its own control." },
    { name: "Media Air Cleaner Cabinet", unit: "each", unitPrice: 550, type: "product", description: "Deep-media filter cabinet fitted into the return, plus the first filter." },
    { name: "UV Coil Light", unit: "each", unitPrice: 425, type: "product", description: "UV lamp over the evaporator coil, wired and mounted." },
    { name: "Zone Damper & Control", unit: "each", unitPrice: 680, type: "product", description: "Motorised zone damper with its thermostat and panel share." },
    { name: "Condensate Pump & Drain Line", unit: "each", unitPrice: 350, type: "service", description: "Condensate pump, tubing and safety switch." },
    { name: "Remove & Haul Old Equipment", unit: "each", unitPrice: 175, type: "service", description: "Strip out and dispose of the equipment being replaced." },
    { name: "Extended Labour Warranty", unit: "each", unitPrice: 0, type: "service", description: "Set your own price — the term and what it covers are your decision, and both change what it is worth." },
  ],

  hvac_repair: [
    { name: "Seasonal Maintenance Visit", unit: "visit", unitPrice: 149, type: "service", description: "Clean, test, tighten and report on one system." },
    { name: "Maintenance Plan — two visits a year", unit: "year", unitPrice: 269, type: "service", description: "Spring and autumn visits with priority booking." },
    { name: "Condenser Coil — deep clean", unit: "each", unitPrice: 285, type: "service", description: "Chemical clean and rinse of the outdoor coil." },
    { name: "Electronic Leak Search", unit: "each", unitPrice: 275, type: "service", description: "Locate a refrigerant leak with a detector and dye." },
    { name: "Filter Subscription — four a year", unit: "year", unitPrice: 120, type: "product", description: "Four media filters, delivered or fitted on the maintenance visit." },
    { name: "Surge Protector for Outdoor Unit", unit: "each", unitPrice: 295, type: "product", description: "Hard-wired surge protection at the disconnect." },
    { name: "After-Hours Attendance", unit: "each", unitPrice: 0, type: "service", description: "Priced as a multiple of your normal rate, not as a flat fee — see the rate card. Left at zero on purpose so it is not billed as an amount." },
  ],

  solar_pv_install: [
    { name: "Battery Storage — supply & install", unit: "kWh", unitPrice: 900, type: "product", description: "Per usable kilowatt-hour of LFP storage, installed and commissioned." },
    { name: "Critter Guard", unit: "linear ft", unitPrice: 9, type: "service", description: "Mesh clipped to the array perimeter to keep birds and squirrels out." },
    { name: "Array Cleaning Visit", unit: "visit", unitPrice: 350, type: "service", description: "Wash the array and clear debris. A cleaning visit, not a production guarantee." },
    { name: "EV Charger — install alongside", unit: "each", unitPrice: 0, type: "service", description: "Electrical scope. Price it from your electrical rate card so the two books cannot disagree." },
    { name: "Remove & Refit Modules for Roof Work", unit: "panel", unitPrice: 95, type: "service", description: "Take the array down and put it back for a re-roof, per module." },
    { name: "Monitoring Hardware — cellular gateway", unit: "each", unitPrice: 285, type: "product", description: "Cellular gateway where there is no usable Wi-Fi at the inverter." },
    { name: "Engineering & Permits — passed through", unit: "each", unitPrice: 0, type: "service", description: "Billed at what the engineer and the authority charged, with the invoice attached." },
  ],

  fire_sprinkler: [
    { name: "Annual Inspection & Test", unit: "visit", unitPrice: 350, type: "service", description: "Inspect, test and certify the system for the year." },
    { name: "Backflow Preventer Test", unit: "each", unitPrice: 195, type: "service", description: "Annual backflow test and the certificate the authority wants." },
    { name: "Spare Head Cabinet", unit: "each", unitPrice: 165, type: "product", description: "Wall cabinet with the spare heads and the wrench the standard requires." },
    { name: "Head Guard", unit: "each", unitPrice: 38, type: "product", description: "Cage over a head in a garage, gym or store room." },
    { name: "Antifreeze Loop Service", unit: "each", unitPrice: 450, type: "service", description: "Test and top up an antifreeze loop serving an unheated area." },
    { name: "Cut & Make Good Ceiling Access", unit: "each", unitPrice: 145, type: "service", description: "Open, patch and finish an access point in a finished ceiling." },
    { name: "Design & Plan Review — passed through", unit: "each", unitPrice: 0, type: "service", description: "Bought from the engineer or designer and billed at their price. We install the design; we do not produce it." },
  ],

  gutter_services: [
    { name: "Gutter Guard — micro-mesh", unit: "linear ft", unitPrice: 15, type: "product", description: "Stainless micro-mesh fitted over the trough." },
    { name: "Downspout Extension", unit: "each", unitPrice: 65, type: "product", description: "Extension to carry water away from the foundation." },
    { name: "Underground Downspout Tie-In", unit: "each", unitPrice: 385, type: "service", description: "Connect a downspout to a buried drain and pop-up." },
    { name: "Heat Cable", unit: "linear ft", unitPrice: 27.5, type: "product", description: "Self-regulating cable in the trough and downspout. Needs its own circuit." },
    { name: "Rotten Fascia Repair", unit: "linear ft", unitPrice: 22, type: "service", description: "Replace soft fascia before anything is hung on it." },
    { name: "Rain Chain or Decorative Downspout", unit: "each", unitPrice: 0, type: "product", description: "Client's choice of product, at their price plus your fitting time." },
    { name: "Third-Storey Lift Hire", unit: "day", unitPrice: 0, type: "service", description: "Re-billed at the yard's day rate — see the cost recipe for the default the margin panel uses." },
  ],

  garage_door: [
    { name: "Opener — supply & install", unit: "each", unitPrice: 650, type: "product", description: "Belt-drive opener with rail, safety sensors and one remote." },
    { name: "Additional Remote", unit: "each", unitPrice: 65, type: "product", description: "Extra hand remote, paired." },
    { name: "Wireless Keypad", unit: "each", unitPrice: 125, type: "product", description: "Exterior keypad, fitted and paired." },
    { name: "Torsion Spring Replacement", unit: "each", unitPrice: 285, type: "service", description: "Replace a matched torsion spring pair and rebalance the door." },
    { name: "Track, Rollers & Hardware — replace", unit: "each", unitPrice: 340, type: "service", description: "New track set with nylon rollers and hinges." },
    { name: "Bottom Seal & Perimeter Weatherstrip", unit: "each", unitPrice: 165, type: "service", description: "New bottom seal and three-sided perimeter stop." },
    { name: "Remove & Dispose of Old Door", unit: "each", unitPrice: 145, type: "service", description: "Strip out the existing door and take it away." },
    { name: "Frame Repair Before Fitting", unit: "each", unitPrice: 0, type: "service", description: "Nobody knows what the framing looks like until the old door is off. Priced when it is." },
  ],
};

/* ── What is already covered, and where ────────────────────────────────── */
//
// roofing_service and siding are two of my seven trades and NOTHING was added
// for either. This is the evidence for that decision, written down so the next
// person does not have to re-derive it — and so the two real gaps found while
// checking do not get lost in a "nothing to do here".
//
// Every entry names the file and the field. A `gap` is a genuine hole.
export const SYSTEMS_COVERAGE = {
  roofing_service: {
    verdict: "covered",
    sell: "app/data/tradePriceBooks.js roofing_service — materials{} per square with labourFactor, tearOff{}, details{} per linear foot, penetrations{}, deckSheetPrice, steepnessSurcharge{}.",
    labour:
      "lib/pricing/roofLabour.js ROOF_LABOUR_DEFAULTS, spread into the book as `labour` so the rate card edits the same constants the engine reads.",
    materialCost:
      "tradePriceBooks.js roofing_service.materialCosts — eleven SKUs read off Home Depot Canada, Gatineau, 25 August 2026, plus wastePct 0.1.",
    lineItems:
      "app/data/defaultLineItems.js roofing_service — seven chips. Every one of them resolves to a sell rate AND a cost AND crew-hours in the fields above; the mapping is `lineItemMap` below and scripts/check-pricebook-systems.mjs asserts it against the live file.",
    // The seven chips, mapped to where each one is already priced and costed.
    // Keyed by the EXACT description string in defaultLineItems.js. If somebody
    // rewords one, the check fails rather than the mapping quietly rotting —
    // which is the whole reason to assert on the string instead of eyeballing it.
    lineItemMap: {
      "Tear-off & disposal": {
        unit: "sqft",
        sell: "roofing_service.tearOff.firstLayerPerSquare / additionalLayerPerSquare",
        hours:
          "ROOF_LABOUR_DEFAULTS.tearOffFirstLayerPerSquare / tearOffAdditionalLayerPerSquare, plus dumpRunHours and squaresPerDumpRun",
        cost: "GAP — see gaps.tippingFee",
      },
      "Decking replacement": {
        unit: "sqft",
        sell: "roofing_service.deckSheetPrice",
        hours: "ROOF_LABOUR_DEFAULTS.deckSheetHours",
        cost: "roofing_service.materialCosts.deckSheetEach",
      },
      "Ice & water shield": {
        unit: "linear_ft",
        sell: "roofing_service.details.iceWaterPerLf",
        hours: "ROOF_LABOUR_DEFAULTS.iceWaterPerLf",
        cost: "roofing_service.materialCosts.iceWaterPerRoll",
      },
      "Drip edge": {
        unit: "linear_ft",
        sell: "roofing_service.details.dripEdgePerLf",
        hours: "ROOF_LABOUR_DEFAULTS.dripEdgePerLf",
        cost: "roofing_service.materialCosts.dripEdgePerLength",
      },
      "Ridge vent": {
        unit: "linear_ft",
        sell: "roofing_service.details.ridgeVentPerLf",
        hours: "ROOF_LABOUR_DEFAULTS.ridgeVentPerLf",
        cost: "roofing_service.materialCosts.ridgeVentPerSection",
      },
      "Chimney flashing": {
        unit: "each",
        sell: "roofing_service.penetrations.chimney.price",
        hours: "ROOF_LABOUR_DEFAULTS.chimneyEach",
        cost: "roofing_service.materialCosts.chimneyFlashingEach is NULL, deliberately and correctly — chimney counter-flashing is bent from coil stock, not bought as a kit.",
      },
      "Skylight flashing": {
        unit: "each",
        sell: "roofing_service.penetrations.skylight.price",
        hours: "ROOF_LABOUR_DEFAULTS.skylightEach",
        cost: "roofing_service.materialCosts.skylightKitEach",
      },
    },
    gaps: {
      tippingFee: {
        what: "The DUMP FEE. ROOF_LABOUR_DEFAULTS has dumpRunHours (1.5) and squaresPerDumpRun (20), so the product knows how long a dump run takes and never what it costs to tip the load. On a 25-square tear-off that is a real three-figure cost the margin panel cannot see.",
        why_not_filled_here:
          "It belongs in roofing_service.materialCosts beside the other eleven, in the same currency, read off the same kind of source. Adding it from this file would put roofing costs in two places, which is the duplication this file exists to avoid. Flagged, not fixed.",
      },
    },
  },

  siding: {
    verdict: "covered",
    sell: "app/data/tradePriceBooks.js siding — materials{} installed $/sqft of wall with labourFactor, tearOffPerSqft, housewrapPerSqft, rotRepairPerSqft, trimPerLf, soffitPerSqft, fasciaPerLf, storeySurcharge{}.",
    labour:
      "siding.labourHoursPerSqft = 0.032, derived in place from two installers hanging ~500 sqft of vinyl a day, with each material's labourFactor applied on top.",
    materialCost:
      "siding.materialCosts — five SKUs read off Home Depot Canada, plus a deliberate null on fastenersPerSquare with its reason stated.",
    lineItems: "None in defaultLineItems.js. Not a gap: the book itself is item-shaped and prices every element on its own line.",
    gaps: {
      liftAndDisposal: {
        what: "No equipment cost and no disposal cost. A three-storey siding job hires a lift, and a tear-off fills a bin; storeySurcharge charges the client for the height but nothing tells the margin panel what the height COST.",
        why_not_filled_here:
          "Same reason as roofing: it belongs in the siding book beside its own material costs. The gutter recipe above carries a boom lift day rate that is deliberately the same figure — it is the same machine from the same yard — and can be lifted straight across when somebody does it properly.",
      },
    },
  },
};

/* ── Merge notes ───────────────────────────────────────────────────────── */
//
// Nothing in this file is wired into anything. Each export needs a deliberate
// edit somewhere else, and each one breaks something specific if it is skipped.
export const MERGE_NOTES = [
  {
    target: "lib/trades/catalog.js",
    action:
      "Add `solar_pv_install` and `fire_sprinkler` to TRADE_CATALOG with `industries: []`. MUST HAPPEN FIRST — every other merge is keyed on ServiceCategory.key, and a book for a key no category has is a book nothing can reach.",
    ifSkipped:
      "The two new books are unreachable. The two HVAC books work regardless: hvac_install and hvac_repair are already catalogue keys.",
  },
  {
    target: "app/data/tradePriceBooks.js",
    action:
      "Spread SYSTEMS_PRICE_BOOKS into TRADE_PRICE_BOOKS, SYSTEMS_PRICE_BOOK_FIELDS into PRICE_BOOK_FIELDS and SYSTEMS_PRICE_BOOK_GROUPS into PRICE_BOOK_GROUPS. All three, together.",
    ifSkipped:
      "Books without fields render an empty rate card and return [] from priceBookBasis(), which is the exact 'trade says it is priced and shows a blank screen' failure the brief described. Fields without groups render ungrouped rows — survivable, ugly.",
  },
  {
    target: "app/data/materialRecipes.js",
    action:
      "Spread SYSTEMS_RECIPES into MATERIAL_RECIPES and add the `systems_assembly`, `systems_service` and `systems_linear` models to RECIPE_EDITABLE_FIELDS — or point that screen at SYSTEMS_RECIPE_EDITABLE_FIELDS, which is shaped for the nested layout these recipes use.",
    ifSkipped:
      "getRecipe() returns null for these keys and the Cost & Margin panel costs them at zero — a 100% margin on every HVAC job, which is worse than no number because it looks like good news.",
  },
  {
    target: "app/data/defaultLineItems.js",
    action:
      "Spread SYSTEMS_LINE_ITEMS into DEFAULT_LINE_ITEMS. Strip nothing — the `key` field is inert there and is what the cost recipes point at.",
    ifSkipped: "No suggestion chips for six trades. Degrades, does not break.",
  },
  {
    target: "app/data/standardAddOns.js",
    action: "Spread SYSTEMS_ADD_ONS into STANDARD_ADDONS.",
    ifSkipped: "No seeded Products for these categories. Degrades, does not break.",
  },
  {
    target: "package.json",
    action:
      'Add "check:pricebook-systems": "node --import ./scripts/alias-loader.mjs scripts/check-pricebook-systems.mjs". The script imports from @/app/data/tradePriceBooks, so it needs the alias loader like every other check that touches app data.',
    ifSkipped: "The check still runs by hand; it just is not discoverable.",
  },
  {
    target: "The renderer, wherever a systems quote is shown",
    action:
      "Read engineeringLimitFor(categoryKey) and show `quoteBanner` when it is non-null. Refuse to total when `blocking` is true and the design source has not been stated.",
    ifSkipped:
      "The one that actually matters. Without it FieldQuo prints a fire sprinkler total with nothing on the document saying whose design it is — a number that reads as an engineering opinion.",
  },
];
