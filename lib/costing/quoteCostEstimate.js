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
import { scopeGroupsLineItemCost } from "@/lib/costing/lineItemCost";
import {
  quoteCostSummary,
  shapeEstimate,
  shapeSavedQuoteCosting,
  costBasisMissing,
  FALLBACK_OVERHEAD_PCT,
  FALLBACK_LABOUR_RATE,
} from "@/lib/costing/quoteCosting";
import { marginTargetPctFrom } from "@/lib/costing/marginTarget";
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
      // For the lines' own cost (lib/costing/lineItemCost.js) — the one
      // figure on a costing that comes off the priced lines themselves.
      lineItems: true,
    },
    orderBy: { sortOrder: "asc" },
  },
};

/**
 * The margin this company holds a quote to — its own Settings → Overhead
 * figure, or the shared default when it has never set one.
 *
 * Read fresh on every costing write and every fallback read rather than
 * cached: the row is one indexed lookup, and a target that lags a settings
 * save by a request is a panel that disagrees with the screen that set it.
 *
 * @returns {Promise<{ pct: number, isDefault: boolean }>}
 */
export async function companyMarginTarget(companyId) {
  const row = await db.forecastSettings.findUnique({
    where: { companyId },
    select: { targetMargin: true },
  });
  return marginTargetPctFrom(row?.targetMargin);
}

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

  const [groups, recipeOverridesByCategory, target] = await Promise.all([
    resolveCostingGroups(companyId, quote.scopeGroups),
    recipeOverridesFor(companyId),
    companyMarginTarget(companyId),
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
    marginTargetPct: target.pct,
    recipeOverridesByCategory,
    lineItemCost: scopeGroupsLineItemCost(quote.scopeGroups),
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
 * A quote's costing as the Cost & margin block shows it: the SAVED row when
 * one exists, verbatim; the derivation otherwise, flagged `saved: false`.
 *
 * This is the read GET /api/quotes/[id]/costing serves, lifted out so the
 * quote review measures the margin off the identical object. The review
 * used to have no view of cost at all; giving it a second, private
 * computation would have been the copy that drifts — a review saying 12%
 * beside a block saying 9% is worse than either alone.
 *
 * No permission check here. The caller decides who may SEE the result; this
 * only answers what it is. Returns null for a quote outside the company.
 */
export async function loadQuoteCosting({ companyId, quoteId }) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: { ...QUOTE_COST_SELECT, costing: true },
  });
  if (!quote) return null;
  if (quote.costing) return shapeSavedQuoteCosting(quote.costing);
  return deriveQuoteCosting({ companyId, quote });
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

  // `labourHours` travels with the cost, from the same source, for the
  // close-out's labour line: "the quote said 16 hours; the crew logged 21".
  // Null — never 0 — when the figure is not a real one, for the same reason
  // as the total: a quote that predicted no hours has not been beaten by a
  // crew that logged some.
  const hoursOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  if (quote.costing) {
    const saved = Number(quote.costing.totalCost);
    if (Number.isFinite(saved)) {
      return {
        totalCost: saved,
        labourHours: hoursOrNull(quote.costing.labourHours),
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
  return {
    totalCost: total,
    labourHours: hoursOrNull(derived.labourHours),
    at: null,
    source: "derived",
  };
}
