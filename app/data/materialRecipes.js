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
    // The owner's real shelf price, replacing placeholders of 55 and 90 that
    // were never anybody's. Both the same because he buys both at the same
    // rate; the two keys stay separate so a company whose primer and top coat
    // differ can say so.
    primerCostPerGal: 150,
    topCoatCoverageSqftPerGal: 350,
    topCoatCostPerGal: 150,
    hardenerPctOfTopCoat: 0.05, // 5% catalyst, TrueFinish 2K system
    // ── Priced and bought by the QUART ──────────────────────────────────────
    //
    // It was $120 a gallon and the quote printed "0.15 gal", which is not a
    // thing anybody buys. Catalyst comes in quarts, and a job needing 0.6 of
    // one costs a whole one — the remainder has a working life measured in
    // hours once mixed, so it is not stock, it is spent.
    //
    // $30 a quart is the same $120 a gallon the recipe already carried; the
    // unit changed, not the rate. What DOES change is the total, because
    // rounding up to the quart you actually pay for is the honest number:
    // roughly $18 became $30 on a small kitchen. That is a cost the shop was
    // already bearing and the estimate was not showing.
    hardenerQuartsPerGal: 4,
    hardenerCostPerQuart: 30,

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

// ── The keys a zero would turn into Infinity ───────────────────────────────
//
// Every one of these is a DIVISOR in lib/costing/estimateJobCost.js:
//
//   gallons     = (area × coats) ÷ primerCoverageSqftPerGal          (L161)
//   gallons     = (area × coats) ÷ topCoatCoverageSqftPerGal         (L171)
//   tape rolls  = ceil(units ÷ consumables.tape.perUnits)            (L212)
//   film rolls  = base + ceil(units ÷ consumables.maskingFilm.perUnits) (L223)
//   $/quart     = hardenerCostPerGal ÷ hardenerQuartsPerGal          (L~197)
//   gallons     = (area × coats) ÷ wallCoverageSqftPerGal            (L316)
//   gallons     = trimLf ÷ trimCoverageLfPerGal                      (L326)
//   hours       = area ÷ wallProductionRateSqftPerHour               (L341)
//   hours       = trimLf ÷ trimProductionRateLfPerHour               (L357)
//
// A number input cleared to "" arrives as `Number("") === 0` — see
// updateField in app/app/settings/material-costs/page.js — and the settings
// screen said "Saved".
//
// ── The symptom is quiet, which is what makes it expensive ────────────────
//
// The arithmetic yields Infinity, but estimateJobCost.js was hardened against
// Infinity a while back: round2() returns 0 for anything non-finite. So the
// panel does NOT read "$Infinity" and nothing throws. The primer line comes
// back `qty: null, cost: 0` — a material the job certainly consumes, priced at
// nothing — and unpricedCount stays 0, so no warning fires either. Measured on
// a 24-door, 8-drawer kitchen with the coverage and tape fields cleared:
// materials fell from $1,126 to $494. The shop then quotes off a cost basis
// 56% too low and the margin signal agrees with it.
//
// Zero is not "free" for any of these; it is "this quantity is undefined",
// which is a different thing and has to be refused at the edge rather than
// absorbed downstream. Everything NOT in this set may legitimately be zero: a
// shop that does no pressure washing sets washingHours to 0, and a company
// that gets its masking film free sets costPerRoll to 0.
const DIVISOR_KEYS = new Set([
  "primerCoverageSqftPerGal",
  "topCoatCoverageSqftPerGal",
  "hardenerQuartsPerGal",
  "wallCoverageSqftPerGal",
  "trimCoverageLfPerGal",
  "wallProductionRateSqftPerHour",
  "trimProductionRateLfPerHour",
  // Nested under `consumables`; matched on the leaf key, which is unique to
  // the two roll-based consumables. `sandpaper.perUnit` is a multiplier and
  // is deliberately absent.
  "perUnits",
]);

/**
 * The boundary between "what a browser sent" and the cost brain.
 *
 * MaterialRecipeSetting.overrides was written straight through: whatever JSON
 * the PUT carried became the row, and getRecipe() merged it over the shipped
 * defaults on every cost estimate. Two things followed.
 *
 *   1. A cleared coverage field stored 0 and made every subsequent job cost
 *      Infinity — silently, because the number lands in an internal Cost &
 *      Margin panel rather than anywhere that would throw.
 *   2. Any key at all was accepted. `{ label: "…", sqftPerDoor: -999 }` merged
 *      cleanly, so a value that has no control on the screen and no business
 *      being overridden could still end up shadowing the default forever.
 *
 * RECIPE_EDITABLE_FIELDS above already claims to decide "which keys are legal
 * to save as overrides", and the settings page's own comment says the field
 * configs live here "so the API route and this page can't drift apart". Both
 * were aspirational — the route never imported either. This makes them true.
 *
 * ── Why unknown keys are dropped but known ones are refused ────────────────
 *
 * A key absent from the base recipe cannot be read by anything, so dropping it
 * changes no behaviour and needs no error. A key that IS read and arrives
 * unusable is different: the contractor typed something, and silently clamping
 * it to a number they did not choose would be the same lie as storing the zero.
 * They get told which field, by name.
 *
 * Keys whose default is not a number (label, model, threeCoatSpecies) pass
 * through only when the type matches, so an override can never change the
 * SHAPE the estimator iterates.
 *
 * @returns {{overrides: object, errors: string[]}}
 */
export function sanitiseRecipeOverrides(categoryKey, overrides) {
  const base = MATERIAL_RECIPES[categoryKey];
  if (!base) return { overrides: {}, errors: ["Unknown categoryKey"] };
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return { overrides: {}, errors: [] };
  }

  const errors = [];

  // Labels for the error sentences come from the same field configs the form
  // renders, so the message names the field the way the screen does.
  const labelFor = (key, parentKey) => {
    const list = parentKey
      ? CONSUMABLE_EDITABLE_FIELDS[parentKey] || []
      : Object.values(RECIPE_EDITABLE_FIELDS).flat();
    return list.find((f) => f.key === key)?.label || key;
  };

  const clean = (input, baseline, parentKey) => {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      const def = baseline?.[key];
      // Not in the shipped recipe → nothing reads it. Drop, no complaint.
      if (def === undefined) continue;

      if (def !== null && typeof def === "object" && !Array.isArray(def)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          out[key] = clean(value, def, NESTED_KEYS.includes(key) ? null : key);
        }
        continue;
      }

      if (typeof def === "number") {
        const n = typeof value === "number" ? value : Number(value);
        if (value === null || value === "" || !Number.isFinite(n)) {
          errors.push(`${labelFor(key, parentKey)} needs a number.`);
          continue;
        }
        if (n < 0) {
          errors.push(`${labelFor(key, parentKey)} can't be negative.`);
          continue;
        }
        if (DIVISOR_KEYS.has(key) && n === 0) {
          errors.push(`${labelFor(key, parentKey)} has to be more than zero.`);
          continue;
        }
        out[key] = n;
        continue;
      }

      // Non-numeric default: pass through only on an exact type match, so the
      // estimator never finds a string where it iterates an array.
      if (Array.isArray(def)) {
        if (Array.isArray(value)) out[key] = value.filter((v) => typeof v === "string");
        continue;
      }
      if (typeof value === typeof def) out[key] = value;
    }
    return out;
  };

  return { overrides: clean(overrides, base, null), errors };
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
    // Per QUART, because that is the unit it is sold in and the unit a job
    // consumes — see estimateJobCost, which rounds up to whole quarts. The old
    // per-gallon key is deliberately NOT offered here any more: leaving both
    // editable would let a company set two figures that disagree, and the
    // fallback in the estimator would then silently pick one of them.
    { key: "hardenerCostPerQuart", label: "Hardener cost ($/quart)", type: "number", step: 0.01 },
    // labourMinutesPerDoor / labourMinutesPerDrawer are deliberately NOT
    // editable. estimateJobCost stopped reading them when cabinet labour was
    // itemised into cabinetRunLabour() — its own comment there says they are
    // "now UNUSED by this path" — but they still rendered here as two number
    // inputs identical to the eleven live ones above. A shop retuned its labour
    // minutes, pressed Save, saw "Saved", and its cost estimate did not move by
    // a cent.
    //
    // The keys stay in the recipe and in any override a company already saved,
    // for the reason the estimator gives: silently dropping a number somebody
    // set is worse than leaving it inert. Not being able to EDIT an inert
    // number is the honest half — nothing is deleted, and nothing pretends to
    // work. They go for good when that comment's "next thing to remove" lands.
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
// Labels rewritten 2026-08-30 after the owner asked, of tape and masking
// film: "is the units per roll? is how many tapes are in one roll? and the
// cost of a pack of tapes in a roll?" — reasonable questions, because "Units
// per roll" was ambiguous between "how many rolls come in a pack" and what it
// actually means, which is neither: `perUnits` is how many DOORS+DRAWERS one
// roll covers before the estimate reaches for a second one. There is no
// "tapes per roll" concept anywhere in the calculation — a roll is the unit
// that gets bought and used, never subdivided.
//
// The math these numbers drive (lib/costing/estimateJobCost.js): for a job
// with `units` = doors + drawers,
//   tape rolls needed        = ceil(units / tape.perUnits)
//   masking film rolls needed = maskingFilm.perJob + ceil(units / maskingFilm.perUnits)
// and each is billed at its own cost-per-roll. MaterialCostsEditor renders a
// worked example from the company's OWN current numbers right under these
// fields (see consumableExample() in the page) rather than a canned one that
// could drift from what's actually saved.
export const CONSUMABLE_EDITABLE_FIELDS = {
  tape: [
    {
      key: "perUnits",
      label: "Doors + drawers covered by one roll",
      hint: "Not how many tapes come in a roll — there's no such thing here. A roll is the unit. This is how many doors and drawers one roll gets you through before the job needs another.",
      type: "number",
      step: 1,
    },
    { key: "costPerRoll", label: "Cost per roll ($)", hint: "What you pay for one whole roll — not per door, per tape, or per foot.", type: "number", step: 0.01 },
  ],
  maskingFilm: [
    {
      key: "perJob",
      label: "Rolls every job uses no matter how small",
      hint: "A base allowance — even a 2-door job masks off the counters and floor, so this many rolls are charged before the per-piece count below even starts.",
      type: "number",
      step: 1,
    },
    {
      key: "perUnits",
      label: "Doors + drawers covered by each additional roll",
      hint: "Same idea as tape's field above: once the base allowance is used, one more roll gets charged for every this-many doors+drawers.",
      type: "number",
      step: 1,
    },
    { key: "costPerRoll", label: "Cost per roll ($)", hint: "What you pay for one whole roll.", type: "number", step: 0.01 },
  ],
  sandpaper: [
    {
      key: "perUnit",
      label: "Cost per door or drawer ($)",
      hint: "Sandpaper scales straight with piece count, not by the roll — this is charged once per door and once per drawer.",
      type: "number",
      step: 0.01,
    },
  ],
};
