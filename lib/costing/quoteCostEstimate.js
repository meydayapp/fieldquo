// lib/costing/quoteCostEstimate.js
//
// "What did this quote cost us?" — answered once, for every screen that asks.
//
// Three screens ask it: the quote's own cost panel, the invoice lifecycle
// ("QUOTED COST" against the actual), and the job costing view. They used to
// answer it three different ways. The quote page recomputed from the stored
// scope when no row had been saved; the other two read QuoteCosting.totalCost
// and printed "this quote was never costed" whenever it was null. So a cabinet
// quote with a perfectly derivable cost showed a full breakdown on one screen
// and nothing at all on the next.
//
// Saved still wins, everywhere and without exception. A stored row is what the
// quote was actually priced at; recomputing part of it would put a figure on
// screen that moves while nobody touches the quote. What changed is the case
// BELOW that: no row is not the same as no cost, and the fallback is now the
// same calculation on all three.

import { db } from "@/lib/db";
import {
  quoteCostSummary,
  shapeEstimate,
  costBasisMissing,
  MARGIN_TARGET_PCT,
  FALLBACK_OVERHEAD_PCT,
  FALLBACK_LABOUR_RATE,
} from "@/lib/costing/quoteCosting";
import {
  resolveCostingGroups,
  recipeOverridesFor,
} from "@/app/api/quotes/costingWrite";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";

// Everything the derivation needs off the quote row. Exported so callers select
// the same columns instead of each remembering — `intakeValues` was left out of
// one of them and that alone made cabinet quotes uncostable.
export const QUOTE_COST_SELECT = {
  id: true,
  subtotal: true,
  discount: true,
  scopeGroups: {
    select: {
      id: true,
      categoryId: true,
      label: true,
      takeoff: true,
      intakeValues: true,
    },
    orderBy: { sortOrder: "asc" },
  },
};

/**
 * Work out a quote's cost from its own stored scope.
 *
 * No crew, because nothing recorded who was going to do this job and the
 * workers on the payroll today are not an answer to that question — inventing
 * one produces a margin nobody ever quoted. The RATE is assumed rather than
 * zero: the recipes still return hours, and pricing them at nothing subtracts
 * no labour at all and hands back a margin inflated by the entire wage bill.
 * `labourRateBasis` travels with the result so no screen presents the
 * assumption as a costing.
 *
 * @returns the shaped estimate with `saved: false`, or a `costBasisMissing`
 *          body when the quote's trades leave nothing to work from.
 */
export async function deriveQuoteCosting({ companyId, quote }) {
  const price = (Number(quote.subtotal) || 0) - (Number(quote.discount) || 0);

  const [groups, recipeOverridesByCategory] = await Promise.all([
    resolveCostingGroups(companyId, quote.scopeGroups),
    recipeOverridesFor(companyId),
  ]);

  let overheadPerJob = null;
  try {
    const min = await calculateMinimumPrice({ companyId });
    if (!min?.error && Number.isFinite(Number(min?.costPerJob))) {
      overheadPerJob = Number(min.costPerJob);
    }
  } catch {
    // Unknown overhead is absent, not zero. The percentage fallback stands in
    // and `overheadBasis` says which one ran.
  }

  const estimate = quoteCostSummary({
    scopeGroups: groups,
    crew: [],
    labourRate: FALLBACK_LABOUR_RATE,
    addedLabourHours: 0,
    addedMaterialCost: 0,
    overheadPct: FALLBACK_OVERHEAD_PCT,
    overheadPerJob,
    price,
    marginTargetPct: MARGIN_TARGET_PCT,
    recipeOverridesByCategory,
  });

  const shaped = shapeEstimate(estimate, { saved: false });
  shaped.labourRateBasis = "fallback";
  shaped.labourRate = FALLBACK_LABOUR_RATE;

  // ── A margin computed from overhead alone is not a margin ────────────────
  //
  // Q-2026-0006 rendered "54.52% margin" against LABOUR $0.00 / 0 hrs and
  // MATERIALS $0.00 on a $6,650 cabinet quote. The arithmetic was right —
  // $6,650 minus $3,024 of overhead really is 54.52%. What was wrong is that it
  // presented a subtraction with its two biggest terms missing as an answer, in
  // green. Absence of a cost is not a cost of zero.
  if (costBasisMissing({ ...shaped, price })) {
    return {
      ...shaped,
      marginPct: null,
      profit: null,
      signal: "none",
      costIncomplete: true,
      costBasisMissing: true,
      costBasisReason:
        "This quote's trades are priced from intake answers that weren't recorded on it — so there is nothing left to work the cost out from. Open it in the editor, fill in the door and drawer counts or the cost panel, and save: it is kept from then on.",
      costBasisTrades: [
        ...new Set(groups.map((g) => g.categoryKey).filter(Boolean)),
      ],
    };
  }

  return shaped;
}

/**
 * The one figure the invoice and the job views want: what this quote was
 * estimated to cost, and whether that is a record or a derivation.
 *
 * Returns null — never 0 — when there is genuinely no basis. "We have not
 * measured this" and "this cost nothing" are different statements and the
 * comparison against actual cost is meaningless if they are conflated.
 *
 * @returns {Promise<{totalCost:number, at:Date|null, source:"saved"|"derived"}|null>}
 */
export async function quotedCostFor({ companyId, quoteId }) {
  if (!quoteId) return null;

  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: { ...QUOTE_COST_SELECT, costing: true },
  });
  if (!quote) return null;

  if (quote.costing) {
    const saved = Number(quote.costing.totalCost);
    if (Number.isFinite(saved)) {
      return {
        totalCost: saved,
        at: quote.costing.updatedAt || null,
        source: "saved",
      };
    }
  }

  const derived = await deriveQuoteCosting({ companyId, quote });
  if (derived.costBasisMissing) return null;
  const total = Number(derived.estimatedCost ?? derived.totalCost);
  if (!Number.isFinite(total) || total <= 0) return null;

  // No `at`: a derivation has no moment it was recorded, and stamping it with
  // "now" would let a screen print "estimated 3 seconds ago" for a quote
  // written in March.
  return { totalCost: total, at: null, source: "derived" };
}
