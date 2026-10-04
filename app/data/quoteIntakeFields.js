// app/data/quoteIntakeFields.js
//
// Structured intake fields per service category — replaces free-text line items
// with real data that can drive formulas (roof pitch multiplier, paint deduction,
// concrete volume, etc.). Stored per quote in Quote.scopeDetails (Json), keyed by
// categoryId, so a single quote spanning multiple categories keeps each one's
// structured data separate.
//
// Three categories in the original 26-industry research list are NOT included
// here: elevator_services, well_water, mechanical_contracting. These are
// licensed commercial/industrial specialty trades quoted through direct site
// engineering assessment in virtually every real case — not a self-serve
// software quote builder. They're left as generic flat/hourly categories with
// no structured fields below. If a real customer needs one of these, that's
// the trigger to research and add it properly, not before.
//
// Categories using TIERED PACKAGE pricing (junk removal, auto detailing,
// chimney sweep) are NOT defined here — see tieredPackages.js. That's a
// genuinely different UI pattern (a fixed menu, not a formula), and mixing
// the two schemas in one file would blur a real distinction.

import {
  FINISH_LEVELS,
  FINISH_LEVEL_LABELS,
  LEGACY_FINISH_LEVELS,
  DEFAULT_FINISH_LEVEL,
  DRYWALL_TIERS,
  DRYWALL_TIER_LABELS,
} from "./drywallFinishLevels";

// One definition for both drywall quote types, so the two selects cannot drift
// apart the way two copies of the old option list could have.
//
// Keys only the drywall fields carry, all STAFF-SIDE — publicIntakeFields
// below strips them (and drops a `staffOnly` field entirely), so the public
// form receives the plain definition it always did:
//   optionLabels  the English line under each value (the app catalogue's
//                 app.intake.finishLevel.<value> translates it)
//   legacyValues  stored values from before 2026-10-03, displayed as the level
//                 they meant rather than as a blank select
//   default       what a NEW scope group opens on (newScopeGroup), visible in
//                 the select and changeable — never written over an answer a
//                 caller gave, and never into an existing group
const FINISH_LEVEL_FIELD = Object.freeze({
  key: "finishLevel",
  label: "Finish Level",
  type: "select",
  options: FINISH_LEVELS,
  optionLabels: FINISH_LEVEL_LABELS,
  legacyValues: LEGACY_FINISH_LEVELS,
  default: DEFAULT_FINISH_LEVEL,
});

export const INTAKE_FIELDS = {
  // ── Cabinets / original TrueFinish categories ──
  cabinet_refinishing: [
    { key: "doorCount", label: "Cabinet Doors", type: "number" },
    { key: "drawerCount", label: "Drawer Fronts", type: "number" },
    {
      // Drives the automatic primer-coat rule in the cost estimate: porous /
      // never-painted species (oak, ash, hickory, pine) default to 3 primer
      // coats for tannin/grain bleed-through; others default to fewer.
      key: "woodSpecies",
      label: "Wood / Door Material",
      type: "select",
      options: [
        "oak",
        "ash",
        "hickory",
        "pine",
        "maple",
        "mdf_prefinished",
        "thermofoil",
        "other",
      ],
    },
    // ── The three answers the labour estimate cannot guess ────────────────
    //
    // Added because lib/pricing/cabinetLabour.js reads them and NOTHING could
    // set them — an input the model consults and no form can write is the dead
    // control with the polarity reversed, and every quote would have silently
    // taken the default forever.
    //
    // Each one is a judgement made standing in the kitchen, and each moves the
    // hours by an amount worth asking about: degreasing doubles, reinstall
    // gains an hour, a coat adds spraying AND an hour of drying.
    {
      // 3 minutes a piece in normal condition, 6 with real build-up — on 32
      // pieces that is an hour and a half of difference.
      key: "condition",
      label: "Cabinet condition",
      type: "select",
      options: ["normal", "heavy"],
    },
    {
      // Frame-mounted hinges are aligned by hand; an IKEA-style clip locks in.
      key: "hingeType",
      label: "Hinge type",
      type: "select",
      options: ["clip", "legacy"],
    },
    // Coats are NOT asked here. The wood species above already decides them —
    // porous species get 3 primer coats automatically — and asking a second
    // time invites the two to disagree on the same quote. The per-quote
    // override lives in the cost panel, where the estimator can see what it
    // does to the hours and the paint at once.

    // There is deliberately no "new hardware" question here. Hardware is
    // SOLD, not merely recorded: handleHoles, softCloseHinges and
    // drawerSlides are flags on the scope group itself, priced per door or
    // drawer from the trade price book by cabinetAddOnLines() and ticked in
    // the builder's "Add-ons & upgrades" panel, which shows each rate and
    // the money it adds. Supplying the handles themselves is a seeded
    // Product ("New Handles — supply & install", app/data/standardAddOns.js).
    // An intake checkbox beside all that was a second way of saying the
    // same thing that moved no price and produced no line.
  ],
  cabinet_refacing: [
    { key: "doorCount", label: "Cabinet Doors", type: "number" },
    { key: "drawerCount", label: "Drawer Fronts", type: "number" },
    {
      key: "boxLinearFt",
      label: "Cabinet Box Veneer (linear ft)",
      type: "number",
    },
  ],
  countertop: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "material",
      label: "Material",
      type: "select",
      options: ["laminate", "quartz", "granite", "butcher_block"],
    },
    { key: "sinkCutouts", label: "Sink Cutouts", type: "number" },
  ],
  flooring: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "material",
      label: "Material",
      type: "select",
      options: ["laminate", "hardwood", "lvp", "engineered"],
    },
    {
      key: "removeExisting",
      label: "Remove Existing Flooring",
      type: "boolean",
    },
  ],
  flooring_install: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "removeExisting",
      label: "Remove Existing Flooring",
      type: "boolean",
    },
    { key: "subfloorRepair", label: "Subfloor Repair Needed", type: "boolean" },
  ],
  stairs: [
    { key: "stepCount", label: "Number of Steps", type: "number" },
    {
      key: "material",
      label: "Material",
      type: "select",
      options: ["hardwood", "carpet", "laminate"],
    },
  ],

  // ── Painting ── (formulas: wall area = perimeter × height; deduct ~20 sqft/door, ~15 sqft/window)
  interior_painting: [
    { key: "roomLength", label: "Room Length (ft)", type: "number" },
    { key: "roomWidth", label: "Room Width (ft)", type: "number" },
    { key: "ceilingHeight", label: "Ceiling Height (ft)", type: "number" },
    { key: "doorCount", label: "Doors", type: "number" },
    { key: "windowCount", label: "Windows", type: "number" },
    { key: "trimLinearFt", label: "Trim (linear ft)", type: "number" },
    {
      key: "moldingLinearFt",
      label: "Crown Molding (linear ft)",
      type: "number",
    },
    {
      key: "baseboardLinearFt",
      label: "Baseboards (linear ft)",
      type: "number",
    },
    { key: "coats", label: "Coats", type: "select", options: ["1", "2", "3"] },
    { key: "includeCeiling", label: "Include Ceiling", type: "boolean" },
  ],
  exterior_painting: [
    // Dimension-first: enter length × height and the estimate computes wall
    // area; or fill wallSquareFootage directly to override. The production-
    // rate cost model (materialRecipes.js) turns area into labour hours.
    { key: "wallLengthFt", label: "Total Wall Length (ft)", type: "number" },
    { key: "wallHeightFt", label: "Wall Height (ft)", type: "number" },
    {
      key: "wallSquareFootage",
      label: "Wall Area (sqft) — optional, overrides L×H",
      type: "number",
    },
    { key: "stories", label: "Stories", type: "number" },
    { key: "coats", label: "Coats", type: "select", options: ["1", "2", "3"] },
    {
      key: "paintTier",
      label: "Paint Tier",
      type: "select",
      options: ["economy", "standard", "premium"],
    },
    { key: "colorCount", label: "Number of Colors", type: "number" },
    {
      key: "trimLinearFt",
      label: "Trim — window/door frames, fascia (linear ft)",
      type: "number",
    },
    { key: "doorCount", label: "Doors to Paint", type: "number" },
    { key: "pressureWashPrep", label: "Pressure Wash / Prep Wash", type: "boolean" },
  ],

  // ── Drywall ── (three-phase: hang / tape+mud / sand+finish, each priced separately)
  //
  // The finish level is the six GA-214 levels — app/data/drywallFinishLevels.js
  // says what each one is, maps the three values this select used to offer,
  // and is the one place either list is written. The answer is READ: it names
  // the level on the client's document (lib/documents/serviceContent.js) and
  // puts that level's finishing line on the quote when the price book has a
  // rate for it (lib/quotes/drywallFinishLine.js).
  //
  // Plain `drywall` is the REPAIR quote type (owner, 2026-10-03): repairs are
  // fixed-price items from the repair book — small patch to full sheet,
  // lib/quotes/drywallRepairs.js — so it no longer asks Square Footage or
  // Ceiling Height. Neither moved a repair price: a repair line is the book's
  // rate × 1 whatever the room (check:estimate-kind-routing pins it), the
  // repair book bills no board so drywallQuantity() writes no line from the
  // square feet (bookBillsBoard), no cost recipe or production rate reads
  // either key for this trade, and nothing anywhere read ceilingHeight on a
  // drywall group. A stored group that answered them keeps its answers in
  // intakeValues (still read as a measurement by a template line keyed to
  // squareFootage); the builder just stops asking. drywall_install — where
  // the square feet ARE the hang and finishing quantity — keeps its box.
  drywall: [
    FINISH_LEVEL_FIELD,
    { key: "demoExisting", label: "Demo Existing Drywall", type: "boolean" },
  ],
  drywall_install: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    FINISH_LEVEL_FIELD,
    // The price book's tier (live 2026-10-03) — which column of the rate card
    // the hang and finishing lines price from. `staffOnly`: a homeowner on the
    // public form is not asked to grade their own job's difficulty.
    {
      key: "complexityLevel",
      label: "Complexity",
      type: "select",
      options: DRYWALL_TIERS,
      optionLabels: DRYWALL_TIER_LABELS,
      default: "standard",
      staffOnly: true,
    },
  ],

  // ── General construction / renovation ──
  demolition: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "debrisHauling",
      label: "Debris Hauling & Disposal",
      type: "boolean",
    },
  ],
  general_contracting: [
    { key: "squareFootage", label: "Project Square Footage", type: "number" },
    { key: "permitsRequired", label: "Permits Required", type: "boolean" },
  ],
  construction: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    { key: "costPerSqft", label: "Target Cost per Sqft", type: "number" },
  ],
  general_contracting_reno: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    { key: "permitsRequired", label: "Permits Required", type: "boolean" },
  ],
  remodeling: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "roomType",
      label: "Room Type",
      type: "select",
      options: ["kitchen", "bathroom", "basement", "whole_home"],
    },
  ],
  carpentry: [
    {
      key: "specialty",
      label: "Carpentry Type",
      type: "select",
      options: ["framing_rough", "finish_trim", "master_custom"],
    },
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
  ],
  tiling: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "material",
      label: "Tile Material",
      type: "select",
      options: ["ceramic", "porcelain", "natural_stone", "glass"],
    },
    { key: "removeExisting", label: "Remove Old Tile", type: "boolean" },
    { key: "subfloorRepair", label: "Subfloor Repair Needed", type: "boolean" },
  ],

  // ── Trades (diagnostic-fee-plus-hourly-or-flat) ──
  plumbing: [
    {
      key: "jobType",
      label: "Job Type",
      type: "select",
      options: ["defined_repair", "diagnostic_unknown"],
    },
    { key: "isEmergency", label: "Emergency/After-Hours", type: "boolean" },
  ],

  //done
  electrical: [
    {
      key: "jobCategory",
      label: "Job Category",
      type: "select",
      options: [
        "receptacles_switches",
        "lighting_fixtures",
        "panel_breaker",
        "wiring_rewiring",
        "ev_charger",
        "troubleshooting_repair",
        "other",
      ],
    },
    {
      key: "pricingMethod",
      label: "Pricing Method",
      type: "select",
      options: ["fixed_price", "time_and_materials"],
    },
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
    { key: "laborRatePerHour", label: "Labor Rate per Hour", type: "number" },
    { key: "materialCost", label: "Material Cost", type: "number" },
    {
      key: "miscCost",
      label: "Misc. Cost (permits, disposal, etc.)",
      type: "number",
    },
    { key: "isEmergency", label: "Emergency/After-Hours", type: "boolean" },
  ],

  //done
  hvac_install: [
    // Section 1 — Type of Work
    {
      key: "workType",
      label: "Type of Work",
      type: "select",
      options: ["gas_to_gas", "gas_to_electric", "clim_conversion", "other"],
    },

    // Section 2 — New Equipment (a job can include more than one)
    {
      key: "equipmentTypes",
      label: "New Equipment",
      type: "multiselect",
      options: ["furnace", "ac", "water_heater", "humidifier", "other"],
    },

    // Existing conditions
    { key: "existingAC", label: "Existing AC", type: "boolean" },
    { key: "existingHeatPump", label: "Existing Heat Pump", type: "boolean" },
    {
      key: "ownOrRent",
      label: "Existing Equipment — Owned or Rented",
      type: "select",
      options: ["owned", "rented", "n/a"],
    },
    { key: "rentalDetails", label: "Rental Details", type: "text" },

    // Gas / venting
    { key: "gasPipeLengthFt", label: "Gas Pipe Length (ft)", type: "number" },
    { key: "gasPipeDiameter", label: "Gas Pipe Diameter", type: "text" },
    { key: "ventingLengthFt", label: "Venting Length (ft)", type: "number" },
    { key: "ventingDetails", label: "Venting Details", type: "text" },
    { key: "airIntake", label: "Air Intake", type: "text" },
    { key: "linerSize", label: "Liner Size (ft/in)", type: "text" },
    { key: "freshAir", label: "Fresh Air", type: "text" },
    {
      key: "extraGasUtilityCharge",
      label: "Extra Gas Utility Charge",
      type: "boolean",
    },

    // Refrigerant / drainage
    { key: "lineSet", label: "Line Set", type: "text" },
    { key: "drainage", label: "Drainage", type: "text" },
    { key: "condensationPump", label: "Condensation Pump", type: "boolean" },
    { key: "waterHeaterPan", label: "Water Heater Drip Pan", type: "boolean" },

    // Site / mounting
    { key: "patioStone", label: "Patio Stone Pad", type: "boolean" },
    {
      key: "foundationInches",
      label: "Foundation Height (in)",
      type: "number",
    },
    {
      key: "supportType",
      label: "Support Type",
      type: "select",
      options: ["metal", "aluminum", "snow_stand"],
    },

    // Panel / thermostat
    {
      key: "panelManufacturer",
      label: "Electrical Panel Manufacturer",
      type: "text",
    },
    {
      key: "thermostatType",
      label: "Thermostat Type",
      type: "select",
      options: ["standard", "programmable", "ecobee", "other"],
    },

    // Free-form
    { key: "otherDetails", label: "Other Details", type: "text" },
    { key: "siteSketchPhotoUrl", label: "Site Sketch Photo", type: "photo" },
    {
      key: "diagramNotes",
      label:
        "Diagram Notes (equipment locations, e.g. A-Furnace, B-Water Heater, C-Fireplace, D-Meter, E-A/C, F-Panel, G-Thermostat)",
      type: "textarea",
    },
  ],
  hvac_repair: [
    {
      key: "systemType",
      label: "System Type",
      type: "select",
      options: ["furnace", "ac", "heat_pump", "water_heater", "other"],
    },
    { key: "systemAge", label: "System Age (years)", type: "number" },
    {
      key: "pricingMethod",
      label: "Pricing Method",
      type: "select",
      options: ["diagnostic_only", "flat_repair", "time_and_materials"],
    },
    {
      key: "diagnosticFeeWaivedIfRepaired",
      label: "Diagnostic Fee Waived If Repaired",
      type: "boolean",
    },
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
    { key: "laborRatePerHour", label: "Labor Rate per Hour", type: "number" },
    { key: "partsCost", label: "Parts Cost", type: "number" },
    { key: "isEmergency", label: "Emergency/After-Hours", type: "boolean" },
  ],
  appliance_repair: [
    {
      key: "applianceType",
      label: "Appliance Type",
      type: "select",
      options: [
        "refrigerator",
        "washer",
        "dryer",
        "dishwasher",
        "oven_range",
        "other",
      ],
    },
    {
      key: "brandTier",
      label: "Brand Tier",
      type: "select",
      options: ["standard", "foreign_high_end"],
    },
    {
      key: "diagnosticFeeWaivedIfRepaired",
      label: "Diagnostic Fee Waived If Repaired",
      type: "boolean",
    },
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
    { key: "laborRatePerHour", label: "Labor Rate per Hour", type: "number" },
    { key: "partsCost", label: "Parts Cost", type: "number" },
  ],
  locksmith: [
    {
      key: "jobType",
      label: "Job Type",
      type: "select",
      options: [
        "lockout",
        "lock_repair",
        "lock_replacement",
        "smart_lock_install",
      ],
    },
    { key: "isEmergency", label: "Emergency/After-Hours", type: "boolean" },
  ],
  garage_door: [
    {
      key: "jobType",
      label: "Job Type",
      type: "select",
      options: ["repair", "install", "spring_replacement"],
    },
    {
      key: "doorType",
      label: "Door Type",
      type: "select",
      options: ["standard", "insulated", "commercial"],
    },
  ],

  // ── Structural / exterior (aerial-measurable — see Solar API note) ──
  concrete: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "thicknessInches",
      label: "Thickness (in)",
      type: "select",
      options: ["4", "5", "6"],
    },
    {
      key: "pourType",
      label: "Pour Type",
      type: "select",
      options: [
        "slab_on_grade",
        "elevated_slab",
        "foundation_structural",
        "driveway",
        "patio",
      ],
    },
    {
      key: "reinforcement",
      label: "Reinforcement",
      type: "select",
      options: ["wire_mesh", "rebar_grid", "post_tension"],
    },
    {
      key: "finish",
      label: "Finish",
      type: "select",
      options: ["broom", "stamped", "exposed_aggregate", "colored"],
    },
    {
      key: "complexityFactors",
      label: "Complexity Factors",
      type: "multiselect",
      options: [
        "irregular_forms",
        "poor_site_access",
        "hand_placement_required",
        "pump_truck_needed",
        "existing_concrete_removal",
      ],
    },
    { key: "wasteFactorPercent", label: "Waste Factor (%)", type: "number" },
  ],
  masonry: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "workType",
      label: "Work Type",
      type: "select",
      options: [
        "brick_veneer",
        "stone_veneer",
        "new_wall",
        "repointing",
        "chimney_rebuild",
        "repair",
      ],
    },
    {
      key: "complexityFactors",
      label: "Complexity Factors",
      type: "multiselect",
      options: [
        "custom_pattern",
        "requires_scaffolding",
        "repair_unpredictable_scope",
        "difficult_access",
        "existing_material_removal",
      ],
    },
    { key: "wasteFactorPercent", label: "Waste Factor (%)", type: "number" },
    {
      key: "crewSize",
      label: "Crew Size",
      type: "select",
      options: ["mason_solo", "mason_plus_laborer"],
    },
  ],
  excavation: [
    { key: "cubicYards", label: "Estimated Cubic Yards", type: "number" },
    {
      key: "workType",
      label: "Work Type",
      type: "select",
      options: ["cut_fill", "full_removal", "rock_removal"],
    },
  ],
  demolition_contractor: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "debrisHauling",
      label: "Debris Hauling & Disposal",
      type: "boolean",
    },
  ],
  paving: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "removeExisting",
      label: "Remove Existing Pavement",
      type: "boolean",
    },
  ],
  // app/data/quoteIntakeFields.js — fence_services (new install)
  fence_services: [
    { key: "linearFeet", label: "Linear Feet", type: "number" },
    {
      key: "material",
      label: "Material",
      type: "select",
      options: [
        "wood_pressure_treated",
        "wood_cedar",
        "vinyl",
        "composite",
        "chain_link",
        "aluminum",
        "farm_wire",
      ],
    },
    { key: "gateCount", label: "Standard Walk Gates", type: "number" },
    { key: "driveGateCount", label: "Double/Driveway Gates", type: "number" },
    { key: "cornerCount", label: "Corner Posts", type: "number" },
    { key: "removeExisting", label: "Old Fence Removal", type: "boolean" },
    {
      key: "complexityFactors",
      label: "Complexity Factors",
      type: "multiselect",
      options: [
        "rocky_or_heavy_clay_soil",
        "buried_concrete_or_footings",
        "hand_digging_required",
        "material_carry_through_house",
        "sloped_or_stepped_layout",
        "custom_pattern_or_lattice",
        "pool_compliant_hardware",
        "tree_root_conflicts",
        "utility_conflicts",
        "staining_or_painting_included",
      ],
    },
  ],
  fence_repair: [
    {
      key: "material",
      label: "Material Being Repaired",
      type: "select",
      options: ["wood", "vinyl", "chain_link", "aluminum", "mixed"],
    },
    {
      key: "repairType",
      label: "Repair Type",
      type: "select",
      options: [
        "refasten_loose_boards",
        "replace_board",
        "replace_rail",
        "replace_post",
        "reinforce_post",
        "reset_leaning_post",
        "replace_panel",
        "gate_adjustment",
        "gate_hinge_latch",
        "gate_rebuild",
        "chain_link_fabric_patch",
        "chain_link_post",
        "chain_link_tension_wire",
      ],
    },
    {
      key: "leaningPostCause",
      label: "If Leaning: Likely Cause",
      type: "select",
      options: [
        "broken_post",
        "rotten_post_at_grade",
        "shifted_footing",
        "unknown_requires_inspection",
      ],
    },
    {
      key: "serviceCallMinimum",
      label: "Service Call / Assessment Minimum",
      type: "number",
    },
    {
      key: "isEmergencyOrStormDamage",
      label: "Emergency/Storm Damage",
      type: "boolean",
    },
  ],
  fence_restoration: [
    { key: "linearFeet", label: "Linear Feet", type: "number" },
    {
      key: "serviceType",
      label: "Service",
      type: "multiselect",
      options: ["pressure_washing", "staining", "sealing"],
    },
    {
      key: "material",
      label: "Fence Material",
      type: "select",
      options: ["wood_pressure_treated", "wood_cedar", "composite"],
    },
  ],
  roofing_service: [
    { key: "footprintLength", label: "Footprint Length (ft)", type: "number" },
    { key: "footprintWidth", label: "Footprint Width (ft)", type: "number" },
    {
      key: "pitch",
      label: "Pitch (rise/12)",
      type: "select",
      options: ["3", "4", "5", "6", "8", "10", "12"],
    },
    { key: "valleys", label: "Number of Valleys", type: "number" },
    {
      key: "tearOffLayers",
      label: "Existing Layers to Remove",
      type: "number",
    },
  ],
  siding: [
    {
      key: "wallSquareFootage",
      label: "Exterior Wall Area (sqft)",
      type: "number",
    },
    {
      key: "material",
      label: "Material",
      type: "select",
      options: ["vinyl", "fiber_cement", "wood", "stucco", "stone"],
    },
    { key: "removeExisting", label: "Remove Existing Siding", type: "boolean" },
  ],
  restoration: [
    { key: "squareFootage", label: "Affected Square Footage", type: "number" },
    {
      key: "waterCategory",
      label: "Water Category",
      type: "select",
      options: ["clean", "gray", "black"],
    },
    {
      key: "phase",
      label: "Phase",
      type: "select",
      options: ["mitigation_only", "mitigation_and_rebuild"],
    },
  ],

  // ── Coatings / concrete ──
  // Field keys line up with the instant estimator's surcharge inputs in
  // lib/estimate/instantEstimate.js (surfaceCondition, access, condition), so
  // the same intake drives both the internal builder and the public estimate.
  epoxy: [
    { key: "squareFootage", label: "Floor Area (sqft)", type: "number" },
    {
      // Drives grinding/patching effort — the estimator's prepSurcharge.
      key: "surfaceCondition",
      label: "Surface Condition",
      type: "select",
      options: ["good", "fair", "poor"],
    },
    {
      key: "system",
      label: "Coating System",
      type: "select",
      options: ["epoxy_solid", "epoxy_flake", "metallic", "quartz", "polyaspartic"],
    },
  ],
  parging: [
    { key: "squareFootage", label: "Wall Area (sqft)", type: "number" },
    {
      // Ladders vs scaffold — the estimator's accessSurcharge.
      key: "access",
      label: "Height / Access",
      type: "select",
      options: ["ground", "second_storey", "scaffold"],
    },
    {
      // New over sound masonry vs patch-and-repair — conditionSurcharge.
      key: "condition",
      label: "Surface Condition",
      type: "select",
      options: ["new_or_sound", "minor_repair", "major_repair"],
    },
  ],

  // ── Landscaping / outdoor ──
  landscaping_design: [
    { key: "lotSize", label: "Lot Size (sqft)", type: "number" },
    // Filled by the outline of the area traced on the aerial photo
    // (lib/measure/lotTakeoff.js), or typed. Bed and lawn edging is bought by
    // the linear foot, and the trace already knows the length.
    { key: "edgingFt", label: "Edging / Border (linear ft)", type: "number" },
    {
      key: "terrain",
      label: "Terrain",
      type: "select",
      options: ["flat", "sloped", "wooded"],
    },
    { key: "hardscape", label: "Includes Hardscape", type: "boolean" },
    { key: "mulchDepthInches", label: "Mulch Depth (in)", type: "number" },
  ],
  lawn_care: [
    { key: "lotSize", label: "Lot Size (sqft)", type: "number" },
    { key: "edgingFt", label: "Edging (linear ft)", type: "number" },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["one_time", "weekly", "biweekly", "monthly"],
    },
  ],
  lawn_mowing: [
    { key: "lotSize", label: "Lot Size (sqft)", type: "number" },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["weekly", "biweekly"],
    },
  ],
  irrigation: [
    { key: "lotSize", label: "Yard Size (sqft)", type: "number" },
    {
      key: "systemType",
      label: "System Type",
      type: "select",
      options: ["above_ground", "in_ground"],
    },
    {
      key: "backflowPreventer",
      label: "Backflow Preventer Needed",
      type: "boolean",
    },
  ],
  tree_care_service: [
    { key: "treeHeight", label: "Tree Height (ft)", type: "number" },
    {
      key: "workType",
      label: "Work Type",
      type: "select",
      options: ["trim", "full_removal", "stump_grinding"],
    },
    { key: "debrisHauling", label: "Debris Hauling", type: "boolean" },
  ],
  pest_control: [
    { key: "squareFootage", label: "Home Square Footage", type: "number" },
    {
      key: "pestType",
      label: "Pest Type",
      type: "select",
      options: [
        "ants_spiders_roaches",
        "rodents",
        "termites",
        "bed_bugs",
        "wasps_hornets",
      ],
    },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["one_time", "monthly", "quarterly"],
    },
  ],
  pool_spa: [
    {
      key: "poolGallons",
      label: "Pool Size (gallons)",
      type: "select",
      options: ["under_10000", "10000_20000", "over_20000"],
    },
    {
      key: "material",
      label: "Pool Material",
      type: "select",
      options: ["concrete", "fiberglass", "vinyl"],
    },
    {
      key: "frequency",
      label: "Service Frequency",
      type: "select",
      options: ["weekly", "biweekly", "monthly"],
    },
  ],
  property_maintenance: [
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
  ],
  pressure_washing_house: [
    {
      key: "squareFootage",
      label: "Exterior Wall Area (sqft)",
      type: "number",
    },
    { key: "softWash", label: "Soft Wash (siding-safe)", type: "boolean" },
  ],
  pressure_washing_driveway: [
    { key: "squareFootage", label: "Surface Area (sqft)", type: "number" },
    {
      key: "stainTreatment",
      label: "Stain/Oil Spot Treatment",
      type: "boolean",
    },
  ],

  // ── Cleaning ──
  // ── Cleaning ────────────────────────────────────────────────────────────
  //
  // These five used to be asked and then IGNORED — bedrooms, bathrooms and
  // isFirstClean were read by nothing, so an estimator answered them and then
  // typed a price in by hand anyway. lib/cleaning/pricing.js now reads every
  // one, and the three added here are the ones the trade actually prices on:
  //
  //   cleaningType  a move-out is nearly twice a standard clean
  //   condition     the single biggest driver of how long a house takes, and
  //                 the one most often discovered on arrival
  //   pets          hair is time, and it's the most under-charged factor there is
  residential_cleaning: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    { key: "bedrooms", label: "Bedrooms", type: "number" },
    { key: "bathrooms", label: "Bathrooms", type: "number" },
    {
      key: "cleaningType",
      label: "Type of Clean",
      type: "select",
      options: ["standard", "deep", "move_out", "post_construction"],
    },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      options: ["well_kept", "normal", "needs_work", "neglected"],
    },
    { key: "pets", label: "Pets in the Home", type: "number" },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["one_time", "weekly", "biweekly", "monthly"],
    },
    { key: "isFirstClean", label: "First-Time Clean", type: "boolean" },
  ],
  deep_cleaning: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    { key: "bedrooms", label: "Bedrooms", type: "number" },
    { key: "bathrooms", label: "Bathrooms", type: "number" },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      options: ["well_kept", "normal", "needs_work", "neglected"],
    },
    { key: "pets", label: "Pets in the Home", type: "number" },
  ],
  commercial_cleaning: [
    { key: "squareFootage", label: "Facility Square Footage", type: "number" },
    {
      key: "businessType",
      label: "Business Type",
      type: "select",
      options: ["office", "retail", "medical", "restaurant", "warehouse"],
    },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["daily", "weekly", "biweekly", "monthly"],
    },
  ],
  janitorial: [
    { key: "squareFootage", label: "Facility Square Footage", type: "number" },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["daily", "weekly"],
    },
  ],
  carpet_cleaning: [
    { key: "squareFootage", label: "Carpeted Area (sqft)", type: "number" },
    { key: "roomCount", label: "Number of Rooms", type: "number" },
  ],
  window_cleaning: [
    { key: "windowCount", label: "Number of Windows", type: "number" },
    {
      key: "isDividedLight",
      label: "Divided-Light/Grid Panes",
      type: "boolean",
    },
    { key: "stories", label: "Stories", type: "number" },
  ],
  handyman: [
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
  ],
  installation_services: [
    { key: "estimatedHours", label: "Estimated Hours", type: "number" },
  ],
  dog_walking: [
    {
      key: "durationMinutes",
      label: "Duration (min)",
      type: "select",
      options: ["30", "60"],
    },
  ],
  pooper_scooper: [
    { key: "lotSize", label: "Yard Size (sqft)", type: "number" },
    {
      key: "frequency",
      label: "Frequency",
      type: "select",
      options: ["one_time", "weekly", "biweekly"],
    },
  ],
  // Home inspection has a structured takeoff (TradeTakeoff.js), and the quote
  // builder shows the takeoff INSTEAD of these fields — see the
  // `!hasTakeoff(...)` guard in
  // app/components/quotes/builder/QuoteBuilder.js. So this entry
  // exists for the PUBLIC self-quote form, which has no takeoff and shows the
  // first three number/select fields. Those three are ordered deliberately:
  // square footage is the only thing that moves the price, and the other two
  // decide whether the inspector is even the right person to call.
  home_inspection: [
    { key: "squareFootage", label: "Square Footage", type: "number" },
    {
      key: "inspectionType",
      label: "Inspection Type",
      type: "select",
      options: [
        "buyer_pre_purchase",
        "pre_listing",
        "new_build_pdi",
        "warranty_milestone",
        "maintenance_review",
      ],
    },
    {
      key: "propertyType",
      label: "Property Type",
      type: "select",
      options: [
        "detached",
        "semi_detached",
        "townhouse",
        "condo_apartment",
        "multi_unit",
        "rural_acreage",
      ],
    },
    // Booleans never reach the public form (publicIntakeFields filters to
    // number/select), so these are the internal builder's fallback only.
    { key: "radonTest", label: "Radon Test", type: "boolean" },
    {
      key: "wettInspection",
      label: "WETT Inspection (wood stove)",
      type: "boolean",
    },
    { key: "wellAndSeptic", label: "Well and Septic", type: "boolean" },
  ],
  snow_removal: [
    {
      key: "pricingMethod",
      label: "Pricing Method",
      type: "select",
      options: ["per_visit", "per_inch", "hourly", "seasonal_contract"],
    },
    {
      key: "drivewaySize",
      label: "Driveway Size",
      type: "select",
      options: ["1_car", "2_car", "3_car_plus"],
    },
    { key: "saltingIncluded", label: "Salting/De-Icing", type: "boolean" },
  ],
  // app/data/quoteIntakeFields.js — add these three, replacing the NO_INTAKE_FIELDS note

  well_water: [
    {
      key: "jobType",
      label: "Job Type",
      type: "select",
      options: ["new_well_drilling", "pump_repair", "maintenance_contract"],
    },
    {
      key: "estimatedDepthFt",
      label: "Estimated Well Depth (ft)",
      type: "number",
    },
  ],

  mechanical_contracting: [
    { key: "tonnage", label: "Cooling Capacity (tons)", type: "number" },
    {
      key: "buildingType",
      label: "Building Type",
      type: "select",
      options: [
        "office",
        "retail",
        "restaurant_kitchen",
        "medical",
        "warehouse",
      ],
    },
    {
      key: "systemType",
      label: "System Type",
      type: "select",
      options: ["rooftop_packaged", "split_system", "chiller"],
    },
  ],
};

// Categories with NO structured fields — either genuinely too variable to
// formula-ize (masonry repair scope, restoration edge cases) or the three
// deliberately-unresearched niche B2B trades noted at the top of this file.
export const NO_INTAKE_FIELDS = [];

export function getIntakeFields(categoryKey) {
  return INTAKE_FIELDS[categoryKey] || [];
}

/**
 * The fields for ONE category row, custom types included.
 *
 * A custom quote type carries its own fields on the ServiceCategory record
 * (`customFields`); a system category looks itself up in the map above. The
 * quote builder had this rule inline and the call-to-quote draft needed the
 * same one — two copies would have agreed only until someone added a third
 * kind of category, and the copy that rots is the one nobody looks at.
 *
 * @param category { key, customFields } — a ServiceCategory-shaped object.
 */
export function fieldsForCategory(category) {
  const custom = category?.customFields;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return getIntakeFields(category?.key);
}

// The internal quote builder asks everything the pricing formula needs. A
// stranger on a phone will abandon that, so the PUBLIC self-quote form shows at
// most this many number/select fields per category: enough that the contractor
// arrives at the callback already knowing roughly the size of the job, not so
// many that nobody finishes the form.
const MAX_PUBLIC_FIELDS = 3;

/**
 * The subset of a category's intake fields the public form is allowed to show.
 *
 * One function rather than the same filter-and-slice in each route: the GET
 * that renders the form and the POST that reads the answers back have to agree
 * on which fields were public, and two copies of a rule agree only until one is
 * edited.
 */
export function publicIntakeFields(categoryKey) {
  return getIntakeFields(categoryKey)
    .filter((f) => (f.type === "number" || f.type === "select") && !f.staffOnly)
    .slice(0, MAX_PUBLIC_FIELDS)
    .map(publicShape);
}

// The keys a public field may carry — the same list scripts/check-self-quote.mjs
// holds the endpoint to. Projected rather than trusted: the staff-side keys a
// definition grows (the finish level's labels, legacy map and default) are for
// the builder, and a field handed to a stranger's browser carries the question
// and its choices, nothing else. A field with no extra keys comes out with
// exactly the keys and values it went in with.
const PUBLIC_FIELD_KEYS = ["key", "label", "type", "options", "unit", "placeholder", "help"];

function publicShape(field) {
  const out = {};
  for (const k of PUBLIC_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(field, k)) {
      out[k] = Array.isArray(field[k]) ? [...field[k]] : field[k];
    }
  }
  return out;
}

/**
 * The option a select shows for a stored value: the value itself, or — for a
 * value the field no longer offers but used to — the option it meant. Anything
 * else comes back unchanged, so nothing stored is hidden or invented.
 */
export function shownSelectValue(field, value) {
  if (typeof value !== "string" || !value) return value;
  if (Array.isArray(field?.options) && field.options.includes(value)) return value;
  const legacy = field?.legacyValues;
  if (legacy && Object.prototype.hasOwnProperty.call(legacy, value)) return legacy[value];
  return value;
}

/**
 * The answers a NEW scope group opens with: the caller's own, plus each
 * field's `default` where the caller left that key out entirely. Only the
 * finish level declares one. An answer the caller did give — even "" — wins.
 */
export function withFieldDefaults(fields, intakeValues = {}) {
  const out = { ...(intakeValues || {}) };
  for (const f of Array.isArray(fields) ? fields : []) {
    if (
      f &&
      typeof f.key === "string" &&
      f.default !== undefined &&
      !Object.prototype.hasOwnProperty.call(out, f.key)
    ) {
      out[f.key] = f.default;
    }
  }
  return out;
}
