// lib/costing/calibrationInputs.js
//
// Everything a calibration needs to know about a quote's cost basis, resolved
// once: the company's rates as they stand today, the estimate lines those
// rates produced (frozen with the quote, or derived now), and the labour
// denominators per group.
//
// Lifted out of GET /api/jobs/[id]/costing/calibration on 2026-09-19 because
// the AI quote review asks the identical question at a different moment —
// before the job, from the company's history, rather than after it, from the
// job's own timesheets. The calibration RULES (lib/costing/labourCalibration
// .js, materialCalibration.js) were already shared; the block that fed them
// was not, and a second copy in lib/ai/quoteReview.js would have been the
// one that quietly stopped reading the frozen groups.
//
// Nothing here decides anything. It reads, resolves and shapes; the two
// calibration modules decide, and they keep their rules: never apply, never
// invent an actual, never offer a button for a rate that has nowhere to go.

import { resolveCostingGroups, recipeOverridesFor } from "@/app/api/quotes/costingWrite";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { getRecipe, hasRecipe } from "@/app/data/materialRecipes";
import { getPriceBook, hasPriceBook } from "@/app/data/tradePriceBooks";
import { pickEstimateGroups } from "@/lib/costing/materialCalibration";
import { labourBasisFor } from "@/lib/costing/labourCalibration";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {object} p
 * @param {string} p.companyId
 * @param {Array}  p.scopeGroups   the quote's stored groups — QUOTE_COST_SELECT's
 *                                 shape: { id, categoryId, label, takeoff, intakeValues }
 * @param {Array|null} p.frozenGroups  QuoteCosting.groups when the quote was
 *                                 costed, else null/undefined
 * @returns {Promise<{
 *   resolvedGroups: Array, recipeOverrides: object, keyToCategoryId: Map,
 *   currentRates: { recipes: object, books: object },
 *   groups: Array, source: "frozen"|"derived",
 *   labourGroups: Array<{ categoryKey, label, labourHours, basis }>,
 * }>}
 */
export async function calibrationInputs({ companyId, scopeGroups, frozenGroups }) {
  const stored = Array.isArray(scopeGroups) ? scopeGroups : [];
  const [resolvedGroups, recipeOverrides] = await Promise.all([
    resolveCostingGroups(companyId, stored),
    recipeOverridesFor(companyId),
  ]);
  const keyToCategoryId = new Map(
    stored.map((g, i) => [resolvedGroups[i]?.categoryKey, g.categoryId]),
  );

  // The company's rates as they stand today — the thing a suggestion would
  // change. Resolved server-side with the same helpers the quote's own cost
  // panel uses, so this cannot disagree with it about what the rate is.
  const currentRates = { recipes: {}, books: {} };
  for (const g of resolvedGroups) {
    if (!g.categoryKey) continue;
    if (hasRecipe(g.categoryKey) && !currentRates.recipes[g.categoryKey]) {
      currentRates.recipes[g.categoryKey] = getRecipe(
        g.categoryKey,
        recipeOverrides[g.categoryKey] || {},
      );
    }
    if (hasPriceBook(g.categoryKey) && !currentRates.books[g.categoryKey]) {
      currentRates.books[g.categoryKey] = getPriceBook(g.categoryKey, g.rateOverrides);
    }
  }

  // The estimate groups: frozen with the quote's costing when that freeze
  // carries a basis, else derived now. The denominators (doors, sqft of
  // coating) come from the quote's own scope either way; only the RATE
  // differs, and the comparison is against today's rate regardless.
  const derivedByIndex = resolvedGroups.map((g) =>
    estimateScopeGroupCost({
      categoryKey: g.categoryKey,
      intake: g.intakeValues || {},
      recipeOverrides: recipeOverrides[g.categoryKey] || {},
      takeoff: g.takeoff || null,
      rateOverrides: g.rateOverrides || null,
    }),
  );
  const derived = derivedByIndex
    .map((est, i) => (est ? { label: resolvedGroups[i].label, ...est } : null))
    .filter(Boolean);
  const frozen = Array.isArray(frozenGroups) ? frozenGroups : [];
  const { groups, source } = pickEstimateGroups({ frozen, derived });

  // Per group: the hours the estimate gave it and the denominator that
  // produced them. Hours come from the FROZEN groups when the quote was
  // costed (matched by trade and label — the freeze drops groups that
  // estimated to nothing, so index is not a key), else derived now the same
  // way quoteCostSummary derives them: the recipe's hours plus the takeoff's.
  const groupHoursFor = (g, i) => {
    const hit =
      frozen.find((f) => f?.categoryKey === g.categoryKey && (f?.label ?? null) === (g.label ?? null)) ||
      frozen.find((f) => f?.categoryKey === g.categoryKey);
    if (hit) return num(hit.labourHours);
    let hours = derivedByIndex[i] ? num(derivedByIndex[i].labourHours) : 0;
    if (g.takeoff) {
      try {
        hours += num(tradeLabourHours(g.categoryKey, g.takeoff, g.rateOverrides || null));
      } catch {
        // A malformed takeoff predicts nothing rather than throwing the
        // whole calibration away — the same rule quoteCostSummary keeps.
      }
    }
    return hours;
  };
  const labourGroups = resolvedGroups.map((g, i) => ({
    categoryKey: g.categoryKey,
    label: g.label,
    labourHours: groupHoursFor(g, i),
    basis: labourBasisFor({
      categoryKey: g.categoryKey,
      intake: g.intakeValues || {},
      takeoff: g.takeoff || null,
      rateOverrides: g.rateOverrides || null,
      recipeOverrides: recipeOverrides[g.categoryKey] || {},
    }),
  }));

  return { resolvedGroups, recipeOverrides, keyToCategoryId, currentRates, groups, source, labourGroups };
}
