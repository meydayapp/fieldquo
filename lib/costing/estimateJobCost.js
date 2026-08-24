// lib/costing/estimateJobCost.js
//
// Pure cost estimation — no I/O, no React, unit-testable. Turns a scope
// group's intake (doors, drawers, wood species) plus a recipe and a labour
// rate into an itemized material + labour cost estimate. See
// docs/job-costing-and-materials-design.md.

import { getRecipe } from "@/app/data/materialRecipes";
import { crewLabourCost } from "@/lib/costing/crew";

function ceil(n) {
  return Math.ceil(Number(n) || 0);
}
// Finite-safe both ways. `Number(n) || 0` catches NaN but not 1e308, which is
// a perfectly finite number until you multiply it by 100 for the rounding —
// and then every figure downstream of it is Infinity.
function round2(n) {
  const r = Math.round(finite(n) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
}

// A hand-typed cost, cleaned. `Math.max(0, Number(v) || 0)` looks like it does
// this and doesn't: Number("1e400") is Infinity, which is neither NaN nor
// negative, so it survives and turns the whole estimate — and the margin
// signal the estimator is trusting — into Infinity.
function positive(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Same trap, for the inputs where a negative is a legitimate answer (a price
// can be discounted below zero on a credit note) so `positive` would be too
// blunt. `Number(v) || 0` lets Infinity through: 1e400 typed into a rate box
// used to reach `price - cost` and come back as Infinity, or NaN once both
// sides were infinite, and a NaN margin renders as "NaN% margin".
function finite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Estimate one scope group. Dispatches on the recipe's `model`. Returns a
// common shape so callers/UI don't care which model produced it:
//   { categoryKey, summaryParts[], materials[], materialTotal,
//     labourBreakdown[]{name,hours,cost}, labourHours, labourCost, total }
export function estimateScopeGroupCost({
  categoryKey,
  intake = {},
  labourRatePerHour = 0,
  overrides = {},
  recipeOverrides = {},
}) {
  const recipe = getRecipe(categoryKey, recipeOverrides);
  if (!recipe) return null;

  if (recipe.model === "production_rate") {
    return estimateProductionRate({
      categoryKey,
      recipe,
      intake,
      labourRatePerHour,
    });
  }
  return estimateCabinetUnit({
    categoryKey,
    recipe,
    intake,
    labourRatePerHour,
    overrides,
  });
}

function finalize({
  categoryKey,
  summaryParts,
  materials,
  labourBreakdown,
  rate,
}) {
  const materialTotal = round2(materials.reduce((s, m) => s + m.cost, 0));
  const labourHours = round2(labourBreakdown.reduce((s, l) => s + l.hours, 0));
  const withCost = labourBreakdown.map((l) => ({
    ...l,
    cost: round2(l.hours * finite(rate)),
  }));
  const labourCost = round2(withCost.reduce((s, l) => s + l.cost, 0));
  return {
    categoryKey,
    summaryParts,
    materials,
    materialTotal,
    labourBreakdown: withCost,
    labourHours,
    labourCost,
    total: round2(materialTotal + labourCost),
  };
}

// ---- Cabinet (unit-based) ----
function estimateCabinetUnit({
  categoryKey,
  recipe,
  intake,
  labourRatePerHour,
  overrides,
}) {
  const doors = Number(intake.doorCount) || 0;
  const drawers = Number(intake.drawerCount) || 0;
  const units = doors + drawers;
  if (units === 0) return null;

  const totalSqft = doors * recipe.sqftPerDoor + drawers * recipe.sqftPerDrawer;

  const species = (intake.woodSpecies || "").toLowerCase();
  const needsThreeCoats = recipe.threeCoatSpecies.includes(species);
  const primerCoats =
    overrides.primerCoats != null
      ? Number(overrides.primerCoats)
      : needsThreeCoats
        ? recipe.primerCoatsPorous
        : recipe.primerCoatsDefault;

  const materials = [];
  const primerGal = ceil(
    (totalSqft * primerCoats) / recipe.primerCoverageSqftPerGal,
  );
  materials.push({
    name: `Primer (${primerCoats} coat${primerCoats === 1 ? "" : "s"}${needsThreeCoats ? ", extra prep" : ""})`,
    qty: primerGal,
    unit: "gal",
    unitCost: recipe.primerCostPerGal,
    cost: round2(primerGal * recipe.primerCostPerGal),
  });
  const topGal = ceil(
    (totalSqft * recipe.topCoats) / recipe.topCoatCoverageSqftPerGal,
  );
  materials.push({
    name: `Top coat (${recipe.topCoats} coats)`,
    qty: topGal,
    unit: "gal",
    unitCost: recipe.topCoatCostPerGal,
    cost: round2(topGal * recipe.topCoatCostPerGal),
  });
  const hardenerGal = round2(topGal * recipe.hardenerPctOfTopCoat);
  if (hardenerGal > 0) {
    materials.push({
      name: "Hardener / catalyst",
      qty: hardenerGal,
      unit: "gal",
      unitCost: recipe.hardenerCostPerGal,
      cost: round2(hardenerGal * recipe.hardenerCostPerGal),
    });
  }
  const c = recipe.consumables;
  if (c?.tape) {
    const rolls = ceil(units / c.tape.perUnits);
    materials.push({
      name: c.tape.label,
      qty: rolls,
      unit: "roll",
      unitCost: c.tape.costPerRoll,
      cost: round2(rolls * c.tape.costPerRoll),
    });
  }
  if (c?.maskingFilm) {
    const rolls =
      (c.maskingFilm.perJob || 0) + ceil(units / c.maskingFilm.perUnits);
    materials.push({
      name: c.maskingFilm.label,
      qty: rolls,
      unit: "roll",
      unitCost: c.maskingFilm.costPerRoll,
      cost: round2(rolls * c.maskingFilm.costPerRoll),
    });
  }
  if (c?.sandpaper) {
    materials.push({
      name: c.sandpaper.label,
      qty: units,
      unit: "unit",
      unitCost: c.sandpaper.perUnit,
      cost: round2(units * c.sandpaper.perUnit),
    });
  }

  const labourMinutes =
    doors * recipe.labourMinutesPerDoor +
    drawers * recipe.labourMinutesPerDrawer;
  const labourBreakdown = [
    { name: "Prep, spray & reinstall", hours: round2(labourMinutes / 60) },
    { name: "Setup / teardown", hours: recipe.setupHours },
  ];

  return finalize({
    categoryKey,
    summaryParts: [
      `${units} units`,
      `${totalSqft} sqft`,
      `${primerCoats} primer coat${primerCoats === 1 ? "" : "s"}${needsThreeCoats ? " (extra prep)" : ""}`,
    ],
    materials,
    labourBreakdown,
    rate: labourRatePerHour,
  });
}

// ---- Exterior painting (production-rate) ----
function estimateProductionRate({
  categoryKey,
  recipe,
  intake,
  labourRatePerHour,
}) {
  // Wall area: explicit sqft overrides, else length × height.
  const sqftDirect = Number(intake.wallSquareFootage) || 0;
  const area =
    sqftDirect > 0
      ? sqftDirect
      : (Number(intake.wallLengthFt) || 0) * (Number(intake.wallHeightFt) || 0);
  const coats = Number(intake.coats) || recipe.defaultCoats;
  const trimLf = Number(intake.trimLinearFt) || 0;
  const doors = Number(intake.doorCount) || 0;
  const colors = Math.max(1, Number(intake.colorCount) || 1);

  if (area === 0 && trimLf === 0 && doors === 0) return null;

  // ---- Materials ----
  const materials = [];
  const tierCost =
    recipe.paintTiers[intake.paintTier] ?? recipe.paintTiers.standard;
  if (area > 0) {
    const gal = ceil((area * coats) / recipe.wallCoverageSqftPerGal);
    materials.push({
      name: `Wall paint — ${intake.paintTier || "standard"} (${coats} coats)`,
      qty: gal,
      unit: "gal",
      unitCost: tierCost,
      cost: round2(gal * tierCost),
    });
  }
  if (trimLf > 0) {
    const gal = Math.max(1, ceil(trimLf / recipe.trimCoverageLfPerGal));
    materials.push({
      name: "Trim paint",
      qty: gal,
      unit: "gal",
      unitCost: recipe.trimPaintCostPerGal,
      cost: round2(gal * recipe.trimPaintCostPerGal),
    });
  }

  // ---- Labour ----
  const labourBreakdown = [];
  if (area > 0) {
    labourBreakdown.push({
      name: `Walls (${area} sqft @ ${recipe.wallProductionRateSqftPerHour} sqft/hr)`,
      hours: round2(area / recipe.wallProductionRateSqftPerHour),
    });
  }
  // Prep: setup + surface prep base + optional wash + masking for extra colours
  const prepHours =
    recipe.setupHours +
    recipe.surfacePrepBaseHours +
    (intake.pressureWashPrep ? recipe.washingHours : 0) +
    (colors - 1) * recipe.maskingHoursPerExtraColor;
  labourBreakdown.push({
    name: "Prep, wash, setup & masking",
    hours: round2(prepHours),
  });
  if (trimLf > 0) {
    labourBreakdown.push({
      name: `Trim (${trimLf} lf @ ${recipe.trimProductionRateLfPerHour} lf/hr)`,
      hours: round2(trimLf / recipe.trimProductionRateLfPerHour),
    });
  }
  if (doors > 0) {
    labourBreakdown.push({
      name: `Doors (${doors} @ ${recipe.hoursPerDoor}h)`,
      hours: round2(doors * recipe.hoursPerDoor),
    });
  }

  return finalize({
    categoryKey,
    summaryParts: [
      `${area} sqft walls`,
      `${coats} coats`,
      `${colors} color${colors === 1 ? "" : "s"}`,
      ...(trimLf ? [`${trimLf} lf trim`] : []),
      ...(doors ? [`${doors} doors`] : []),
    ],
    materials,
    labourBreakdown,
    rate: labourRatePerHour,
  });
}

// Estimate a whole quote across its scope groups, then compare to the quote
// price for a margin signal. `marginTargetPct` default 30.
/**
 * @param {object} p
 * @param {number|null} [p.overheadPerJob] the company's REAL overhead for one
 *   job — monthly fixed costs divided by job capacity, from
 *   lib/analytics/minimumPrice.js. When present it replaces overheadPctOfPrice,
 *   because a share of the price is not a cost: quoting the same job at two
 *   prices does not change what the rent and the truck payments were. The
 *   percentage remains the fallback for a company that hasn't told us its
 *   capacity, and `overheadBasis` in the result says which one was used so the
 *   UI can be honest about it rather than presenting a guess as a figure.
 * @param {number} [p.purchasedMaterialCost] goods BOUGHT for this job with a
 *   supplier invoice behind them (refacing doors, countertop slabs) as opposed
 *   to consumables a coverage rate predicts.
 */
export function estimateQuoteCost({
  scopeGroups = [],
  labourRatePerHour = 0,
  price = 0,
  overheadPctOfPrice = 0,
  overheadPerJob = null,
  purchasedMaterialCost = 0,
  marginTargetPct = 30,
  overridesByGroup = {},
  recipeOverridesByCategory = {},
  // What the estimator knows and the recipe doesn't.
  //
  // A recipe exists for two trades out of sixty-odd, so for everyone else this
  // panel had nothing to say and hid itself — a plumber could not tell whether
  // a price cleared their costs. And even where a recipe runs, it predicts an
  // average job: it cannot know that this kitchen has three coats of primer on
  // oak, or that the client wants a slab the supplier quoted at $800.
  //
  // These are additive on top of whatever the recipes produced, not a
  // replacement for them, so turning a prediction into a real number never
  // silently discards the prediction.
  manualLabourHours = 0,
  manualMaterialCost = 0,
  manualNote = "",
  // Who is actually doing the work. A job is rarely one person at one rate:
  // two labourers and a supervisor share the same pool of hours at different
  // money. Given a crew, its blended rate replaces the single rate above —
  // lib/costing/crew.js explains why neither multiplying by head count nor
  // ignoring the extra people is right.
  crew = [],
}) {
  const runGroups = (rate) => {
    const out = [];
    for (const g of scopeGroups) {
      const est = estimateScopeGroupCost({
        categoryKey: g.categoryKey,
        intake: g.intakeValues || {},
        labourRatePerHour: rate,
        overrides: overridesByGroup[g.tempId] || {},
        recipeOverrides: recipeOverridesByCategory[g.categoryKey] || {},
      });
      if (est) out.push({ tempId: g.tempId, label: g.label, ...est });
    }
    return out;
  };

  // Two passes, because the rate depends on the hours and the hours do not
  // depend on the rate. The first is read ONLY for its hours — a recipe
  // predicts labour time from doors and square feet, never from money — and
  // the second prices those hours at what the crew actually costs.
  const crewList = Array.isArray(crew) ? crew.filter(Boolean) : [];
  const hasCrew = crewList.length > 0;
  const probeHours = hasCrew
    ? runGroups(0).reduce((s2, g) => s2 + (Number(g.labourHours) || 0), 0)
    : 0;

  const crewPool = probeHours + positive(manualLabourHours);
  const crewCost = hasCrew ? crewLabourCost(crewPool, crewList) : null;
  const effectiveRate =
    crewCost && crewCost.blendedRate != null
      ? crewCost.blendedRate
      : positive(labourRatePerHour);

  const groups = runGroups(effectiveRate);

  // Consumables a recipe predicts (paint, abrasives) are separate from goods
  // bought against a supplier invoice — refacing doors are the first of these,
  // and no coverage rate can predict them.
  const recipeMaterialTotal = round2(
    groups.reduce((s, g) => s + g.materialTotal, 0),
  );
  const purchasedMaterial = round2(positive(purchasedMaterialCost));
  const addedMaterial = round2(positive(manualMaterialCost));
  const materialTotal = round2(
    recipeMaterialTotal + purchasedMaterial + addedMaterial,
  );

  const recipeLabourHours = round2(
    groups.reduce((s, g) => s + (Number(g.labourHours) || 0), 0),
  );
  const addedLabourHours = round2(positive(manualLabourHours));
  // Hours are the honest unit here: an estimator thinks in days on site, not
  // in dollars of labour, and the same number answers "how long will this
  // take" — which is what goes on the schedule.
  const labourHours = round2(recipeLabourHours + addedLabourHours);
  const addedLabourCost = round2(addedLabourHours * finite(effectiveRate));
  // With a crew, the crew's own total is the answer — NOT hours × blended
  // rate. The blended rate is rounded to the cent for display, and
  // re-deriving from it puts the headline 54¢ away from the sum of the rows
  // above it on a 161-hour job. A panel whose parts do not add up to its
  // total is a panel nobody trusts twice.
  const labourCost = crewCost
    ? crewCost.labourCost
    : round2(groups.reduce((s, g) => s + g.labourCost, 0) + addedLabourCost);

  const priceNum = finite(price);

  const hasRealOverhead =
    overheadPerJob != null && Number.isFinite(Number(overheadPerJob));
  const overhead = hasRealOverhead
    ? round2(Number(overheadPerJob))
    : round2((priceNum * positive(overheadPctOfPrice)) / 100);
  const overheadBasis = hasRealOverhead ? "per_job" : "pct_of_price";

  const estimatedCost = round2(materialTotal + labourCost + overhead);
  // The owner's formula: what's left after materials, labour, and this job's
  // share of keeping the business running.
  const profit = round2(priceNum - estimatedCost);
  const marginPct =
    priceNum > 0 ? round2(((priceNum - estimatedCost) / priceNum) * 100) : null;

  // Labour hours with no rate against them cost $0, which understates the job
  // and overstates the margin — a quote can read "34% margin" with twenty
  // hours of work costed at nothing. The figure isn't wrong so much as
  // unfinished, and the panel has to say which.
  const costIncomplete = labourHours > 0 && (Number(effectiveRate) || 0) <= 0;

  // Red means losing money, not "thin". A 12% margin is a decision; a negative
  // one is a mistake, and using the same colour for both taught people to
  // ignore red. Amber is everything profitable but under the target.
  let signal = "none";
  if (marginPct != null) {
    if (profit < 0) signal = "red";
    else if (marginPct >= marginTargetPct) signal = "green";
    else signal = "amber";
  }
  // An unfinished cost can't be called green, whatever the arithmetic says.
  //
  // `costIncomplete` only catches the case where NOBODY has a rate. A crew of
  // three where one person is unrated slips past it — the blended rate is
  // positive, so the figure looks finished — and the badge went green on a job
  // with ten hours costed at nothing. The panel warned about it in a paragraph
  // underneath while the headline said the opposite, and the headline is the
  // part people read. Partial is still unfinished.
  const anyUnrated = costIncomplete || (crewCost?.unratedCount || 0) > 0;
  if (anyUnrated && signal === "green") signal = "amber";

  return {
    groups,
    recipeMaterialTotal,
    purchasedMaterial,
    addedMaterial,
    materialTotal,
    recipeLabourHours,
    addedLabourHours,
    addedLabourCost,
    labourHours,
    labourCost,
    manualNote: String(manualNote || ""),
    overhead,
    overheadBasis,
    estimatedCost,
    profit,
    marginPct,
    marginTargetPct,
    signal,
    costIncomplete,
    // The crew, priced. `blendedRate` is what one hour of these people costs
    // on average — the single number this panel used to demand as an input
    // and now derives instead.
    crew: crewCost ? crewCost.members : [],
    blendedRate: crewCost ? crewCost.blendedRate : null,
    crewUnrated: crewCost ? crewCost.unratedCount : 0,
    effectiveRate: round2(effectiveRate),
    // True when there is a cost figure worth showing — a recipe produced one,
    // or the estimator typed one. Without the second half, every trade with no
    // recipe was told nothing at all, which is how you quote below cost.
    hasEstimable:
      groups.length > 0 || addedLabourHours > 0 || addedMaterial > 0,
    // Whether the figure rests on anything a recipe worked out. False means it
    // is entirely the estimator's own numbers, and the panel says so rather
    // than presenting a typed guess as a calculation.
    hasRecipeEstimate: groups.length > 0,
  };
}
