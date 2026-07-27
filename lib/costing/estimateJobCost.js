// lib/costing/estimateJobCost.js
//
// Pure cost estimation — no I/O, no React, unit-testable. Turns a scope
// group's intake (doors, drawers, wood species) plus a recipe and a labour
// rate into an itemized material + labour cost estimate. See
// docs/job-costing-and-materials-design.md.

import { getRecipe } from "@/app/data/materialRecipes";

function ceil(n) {
  return Math.ceil(Number(n) || 0);
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
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
    return estimateProductionRate({ categoryKey, recipe, intake, labourRatePerHour });
  }
  return estimateCabinetUnit({
    categoryKey,
    recipe,
    intake,
    labourRatePerHour,
    overrides,
  });
}

function finalize({ categoryKey, summaryParts, materials, labourBreakdown, rate }) {
  const materialTotal = round2(materials.reduce((s, m) => s + m.cost, 0));
  const labourHours = round2(labourBreakdown.reduce((s, l) => s + l.hours, 0));
  const withCost = labourBreakdown.map((l) => ({
    ...l,
    cost: round2(l.hours * (Number(rate) || 0)),
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
function estimateCabinetUnit({ categoryKey, recipe, intake, labourRatePerHour, overrides }) {
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
  const primerGal = ceil((totalSqft * primerCoats) / recipe.primerCoverageSqftPerGal);
  materials.push({
    name: `Primer (${primerCoats} coat${primerCoats === 1 ? "" : "s"}${needsThreeCoats ? ", extra prep" : ""})`,
    qty: primerGal, unit: "gal", unitCost: recipe.primerCostPerGal,
    cost: round2(primerGal * recipe.primerCostPerGal),
  });
  const topGal = ceil((totalSqft * recipe.topCoats) / recipe.topCoatCoverageSqftPerGal);
  materials.push({
    name: `Top coat (${recipe.topCoats} coats)`,
    qty: topGal, unit: "gal", unitCost: recipe.topCoatCostPerGal,
    cost: round2(topGal * recipe.topCoatCostPerGal),
  });
  const hardenerGal = round2(topGal * recipe.hardenerPctOfTopCoat);
  if (hardenerGal > 0) {
    materials.push({
      name: "Hardener / catalyst", qty: hardenerGal, unit: "gal",
      unitCost: recipe.hardenerCostPerGal, cost: round2(hardenerGal * recipe.hardenerCostPerGal),
    });
  }
  const c = recipe.consumables;
  if (c?.tape) {
    const rolls = ceil(units / c.tape.perUnits);
    materials.push({ name: c.tape.label, qty: rolls, unit: "roll", unitCost: c.tape.costPerRoll, cost: round2(rolls * c.tape.costPerRoll) });
  }
  if (c?.maskingFilm) {
    const rolls = (c.maskingFilm.perJob || 0) + ceil(units / c.maskingFilm.perUnits);
    materials.push({ name: c.maskingFilm.label, qty: rolls, unit: "roll", unitCost: c.maskingFilm.costPerRoll, cost: round2(rolls * c.maskingFilm.costPerRoll) });
  }
  if (c?.sandpaper) {
    materials.push({ name: c.sandpaper.label, qty: units, unit: "unit", unitCost: c.sandpaper.perUnit, cost: round2(units * c.sandpaper.perUnit) });
  }

  const labourMinutes = doors * recipe.labourMinutesPerDoor + drawers * recipe.labourMinutesPerDrawer;
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
function estimateProductionRate({ categoryKey, recipe, intake, labourRatePerHour }) {
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
  const tierCost = recipe.paintTiers[intake.paintTier] ?? recipe.paintTiers.standard;
  if (area > 0) {
    const gal = ceil((area * coats) / recipe.wallCoverageSqftPerGal);
    materials.push({
      name: `Wall paint — ${intake.paintTier || "standard"} (${coats} coats)`,
      qty: gal, unit: "gal", unitCost: tierCost, cost: round2(gal * tierCost),
    });
  }
  if (trimLf > 0) {
    const gal = Math.max(1, ceil(trimLf / recipe.trimCoverageLfPerGal));
    materials.push({
      name: "Trim paint", qty: gal, unit: "gal",
      unitCost: recipe.trimPaintCostPerGal, cost: round2(gal * recipe.trimPaintCostPerGal),
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
  labourBreakdown.push({ name: "Prep, wash, setup & masking", hours: round2(prepHours) });
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
export function estimateQuoteCost({
  scopeGroups = [],
  labourRatePerHour = 0,
  price = 0,
  overheadPctOfPrice = 0,
  marginTargetPct = 30,
  overridesByGroup = {},
  recipeOverridesByCategory = {},
}) {
  const groups = [];
  for (const g of scopeGroups) {
    const est = estimateScopeGroupCost({
      categoryKey: g.categoryKey,
      intake: g.intakeValues || {},
      labourRatePerHour,
      overrides: overridesByGroup[g.tempId] || {},
      recipeOverrides: recipeOverridesByCategory[g.categoryKey] || {},
    });
    if (est) groups.push({ tempId: g.tempId, label: g.label, ...est });
  }

  const materialTotal = round2(
    groups.reduce((s, g) => s + g.materialTotal, 0),
  );
  const labourCost = round2(groups.reduce((s, g) => s + g.labourCost, 0));
  const overhead = round2((Number(price) || 0) * (Number(overheadPctOfPrice) || 0) / 100);
  const estimatedCost = round2(materialTotal + labourCost + overhead);

  const priceNum = Number(price) || 0;
  const marginPct =
    priceNum > 0 ? round2(((priceNum - estimatedCost) / priceNum) * 100) : null;

  // Signal: green >= target, amber within (target-15 .. target), red below.
  let signal = "none";
  if (marginPct != null) {
    if (marginPct >= marginTargetPct) signal = "green";
    else if (marginPct >= marginTargetPct - 15) signal = "amber";
    else signal = "red";
  }

  return {
    groups,
    materialTotal,
    labourCost,
    overhead,
    estimatedCost,
    marginPct,
    marginTargetPct,
    signal,
    hasEstimable: groups.length > 0,
  };
}
