// app/data/materialRecipes.js
//
// A "recipe" turns Layer-1 quote intake (doors, drawers, wood species) into
// estimated material quantities and labour hours for the INTERNAL cost
// estimate — see docs/job-costing-and-materials-design.md. These are default
// starting numbers (cabinet refinishing seeded from TrueFinish). Companies can
// override any of these via Settings > Material Costs — see
// MaterialRecipeSetting in schema.prisma and getRecipe() below, which merges
// a company's saved overrides on top of these defaults.
//
// Nothing here is client-facing. It only feeds the Cost & Margin panel.

export const MATERIAL_RECIPES = {
  cabinet_refinishing: {
    model: "cabinet_unit",
    label: "Cabinet Refinishing",

    // Finished area per piece (both faces + edges), square feet.
    sqftPerDoor: 12,
    sqftPerDrawer: 3,

    // Primer coats decided by the door material. Porous / never-painted woods
    // (oak, ash, hickory, pine) bleed tannins and grain, and thermofoil needs
    // an adhesion-bonding primer — all default to 3 coats. Everything else
    // (maple, MDF, pre-finished) defaults to 2. Both counts, and this list,
    // are overridable in Settings > Material Costs and per-quote.
    threeCoatSpecies: ["oak", "ash", "hickory", "pine", "thermofoil"],
    primerCoatsPorous: 3,
    primerCoatsDefault: 2,
    topCoats: 2,

    // Coverage (sqft per gallon) and unit costs ($/gal). Shellac primer (BIN)
    // covers less than a top coat. Costs are editable defaults.
    primerCoverageSqftPerGal: 300,
    primerCostPerGal: 55,
    topCoatCoverageSqftPerGal: 350,
    topCoatCostPerGal: 90,
    hardenerPctOfTopCoat: 0.05, // 5% catalyst, TrueFinish 2K system
    hardenerCostPerGal: 120,

    // Consumables — ratio-based, with a per-job minimum.
    consumables: {
      tape: { perUnits: 8, costPerRoll: 8, label: "Painter's tape" },
      maskingFilm: {
        perJob: 1,
        perUnits: 15,
        costPerRoll: 25,
        label: "Masking film",
      },
      sandpaper: { perUnit: 2, label: "Sandpaper / abrasives" }, // $ per door+drawer unit
    },

    // Labour minutes: prep + spray + reinstall per piece, plus fixed
    // setup/teardown for the whole job.
    labourMinutesPerDoor: 45,
    labourMinutesPerDrawer: 20,
    setupHours: 3,
  },

  // Production-rate model (PaintBidNinja-style): labour hours = area ÷
  // production rate, plus fixed prep, trim, and per-door hours. Reproduces the
  // worked example: ~11h walls + 7h prep + 4h trim + ~2h doors ≈ 24h.
  exterior_painting: {
    model: "production_rate",
    label: "Exterior Painting",

    // Walls
    wallProductionRateSqftPerHour: 160, // painter output; interior is lower/harder
    wallCoverageSqftPerGal: 250,
    defaultCoats: 2,

    // Paint cost per gallon by tier (brand/quality). Trim paint priced separately.
    paintTiers: { economy: 35, standard: 55, premium: 85 },
    trimPaintCostPerGal: 60,

    // Prep (the example's 7 hours = 3 wash + 2 setup + 2 surface prep)
    washingHours: 3, // only when pressure-wash/prep-wash selected
    setupHours: 2,
    surfacePrepBaseHours: 2,
    maskingHoursPerExtraColor: 1, // each colour beyond the first adds masking

    // Trim — window/door frames + fascia, priced by linear foot (≈4h typical)
    trimProductionRateLfPerHour: 30,
    trimCoverageLfPerGal: 400,

    // Doors painted separately (often a third colour)
    hoursPerDoor: 1.5,
  },
};

// Fields that are themselves keyed objects (gallon costs per consumable,
// paint cost per tier) need a nested merge — a company overriding just
// `tape.costPerRoll` shouldn't blow away `tape.perUnits`, and overriding just
// `paintTiers.premium` shouldn't blow away `economy`/`standard`.
const NESTED_KEYS = ["consumables", "paintTiers"];

// Merge a company's saved overrides (Settings > Material Costs, see
// MaterialRecipeSetting) on top of the shared default recipe. `overrides`
// only needs to contain the keys that differ from the default — everything
// else falls through untouched. Safe to call with no overrides at all.
export function getRecipe(categoryKey, overrides) {
  const base = MATERIAL_RECIPES[categoryKey];
  if (!base) return null;
  if (!overrides || Object.keys(overrides).length === 0) return base;

  const merged = { ...base, ...overrides };
  for (const key of NESTED_KEYS) {
    if (overrides[key]) {
      merged[key] = { ...base[key] };
      for (const subKey of Object.keys(overrides[key])) {
        merged[key][subKey] =
          base[key]?.[subKey] && typeof overrides[key][subKey] === "object"
            ? { ...base[key][subKey], ...overrides[key][subKey] }
            : overrides[key][subKey];
      }
    }
  }
  return merged;
}

export function hasRecipe(categoryKey) {
  return Boolean(MATERIAL_RECIPES[categoryKey]);
}

// The fields Settings > Material Costs exposes for a given recipe model —
// drives both the edit form and which keys are legal to save as overrides.
export const RECIPE_EDITABLE_FIELDS = {
  cabinet_unit: [
    { key: "primerCoatsDefault", label: "Primer coats — standard species", type: "number", step: 1 },
    { key: "primerCoatsPorous", label: "Primer coats — oak/ash/hickory/pine/thermofoil", type: "number", step: 1 },
    { key: "topCoats", label: "Top coats", type: "number", step: 1 },
    { key: "primerCoverageSqftPerGal", label: "Primer coverage (sqft/gal)", type: "number", step: 1 },
    { key: "primerCostPerGal", label: "Primer cost ($/gal)", type: "number", step: 0.01 },
    { key: "topCoatCoverageSqftPerGal", label: "Top coat coverage (sqft/gal)", type: "number", step: 1 },
    { key: "topCoatCostPerGal", label: "Top coat cost ($/gal)", type: "number", step: 0.01 },
    { key: "hardenerPctOfTopCoat", label: "Hardener/catalyst (% of top coat)", type: "number", step: 0.01 },
    { key: "hardenerCostPerGal", label: "Hardener cost ($/gal)", type: "number", step: 0.01 },
    { key: "labourMinutesPerDoor", label: "Labour minutes / door", type: "number", step: 1 },
    { key: "labourMinutesPerDrawer", label: "Labour minutes / drawer", type: "number", step: 1 },
    { key: "setupHours", label: "Setup / teardown hours (per job)", type: "number", step: 0.5 },
  ],
  production_rate: [
    { key: "wallProductionRateSqftPerHour", label: "Wall production rate (sqft/hr)", type: "number", step: 1 },
    { key: "wallCoverageSqftPerGal", label: "Wall paint coverage (sqft/gal)", type: "number", step: 1 },
    { key: "defaultCoats", label: "Default coats", type: "number", step: 1 },
    { key: "trimPaintCostPerGal", label: "Trim paint cost ($/gal)", type: "number", step: 0.01 },
    { key: "trimProductionRateLfPerHour", label: "Trim production rate (linear ft/hr)", type: "number", step: 1 },
    { key: "trimCoverageLfPerGal", label: "Trim coverage (linear ft/gal)", type: "number", step: 1 },
    { key: "hoursPerDoor", label: "Hours per door", type: "number", step: 0.25 },
    { key: "setupHours", label: "Setup hours", type: "number", step: 0.5 },
    { key: "surfacePrepBaseHours", label: "Base surface-prep hours", type: "number", step: 0.5 },
    { key: "washingHours", label: "Pressure-wash hours", type: "number", step: 0.5 },
    { key: "maskingHoursPerExtraColor", label: "Masking hours / extra colour", type: "number", step: 0.5 },
  ],
};

// Consumables (tape/masking film/sandpaper) are nested, so they get their own
// small editable-field list per consumable key rather than living in
// RECIPE_EDITABLE_FIELDS above.
export const CONSUMABLE_EDITABLE_FIELDS = {
  tape: [
    { key: "perUnits", label: "Units per roll", type: "number", step: 1 },
    { key: "costPerRoll", label: "Cost per roll ($)", type: "number", step: 0.01 },
  ],
  maskingFilm: [
    { key: "perJob", label: "Rolls per job (base)", type: "number", step: 1 },
    { key: "perUnits", label: "Units per additional roll", type: "number", step: 1 },
    { key: "costPerRoll", label: "Cost per roll ($)", type: "number", step: 0.01 },
  ],
  sandpaper: [{ key: "perUnit", label: "Cost per unit ($)", type: "number", step: 0.01 }],
};
