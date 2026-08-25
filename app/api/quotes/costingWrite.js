// app/api/quotes/costingWrite.js
//
// Writing a quote's internal cost estimate. Shared by POST /api/quotes and
// PATCH /api/quotes/[id] so the two cannot drift — the PATCH is where a second
// copy of this would have been forgotten first, exactly as it would have been
// on the invoice side.
//
// Not a route: this directory's HTTP handlers live in route.js files, and a
// plain module beside them is invisible to the router.
//
// ── The browser sends inputs; the server works out the money ────────────────
//
// The request carries crew names, rates and hours, the estimator's own added
// hours and materials, and an overhead percentage. Nothing else. Labour cost,
// material totals, overhead, profit and margin are computed HERE, by running
// the quote's own scope groups through the same estimator the panel uses — so
// a tampered or merely stale browser cannot write a margin its own numbers
// don't support. Non-negotiable #5 is about client-facing pricing; the same
// discipline is free here and removes the question entirely.
//
// The takeoff-derived half is not sent at all. Hours a price book implies and
// goods bought against a supplier invoice are re-derived server-side from the
// stored takeoff, which means the only thing a browser can assert about labour
// is "this needs N hours MORE than the book says".

import { db } from "@/lib/db";
import {
  normaliseQuoteCosting,
  quoteCostSummary,
  MARGIN_TARGET_PCT,
} from "@/lib/costing/quoteCosting";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";

// The SAME gate the invoice cost panel uses, imported rather than reimplemented.
// "Same permission" written twice is two permissions that agree until one of
// them is edited.
export { mayCost } from "@/app/api/invoices/costingWrite";

/**
 * Resolve what the estimator needs about each scope group.
 *
 * A stored QuoteScopeGroup knows its categoryId and its takeoff; the estimator
 * needs the category KEY (which price book) and this company's overrides to
 * that book. Both are looked up server-side — a browser asserting which price
 * book applies could point a cheap trade's rates at an expensive one's takeoff.
 */
export async function resolveCostingGroups(companyId, groups) {
  const list = (Array.isArray(groups) ? groups : []).filter(
    (g) => g && typeof g === "object",
  );
  if (list.length === 0) return [];

  const categoryIds = [...new Set(list.map((g) => g.categoryId).filter(Boolean))];
  if (categoryIds.length === 0) return [];

  const [categories, settings] = await Promise.all([
    db.serviceCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, key: true },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, categoryId: { in: categoryIds } },
      select: { categoryId: true, rates: true },
    }),
  ]);

  const keyById = new Map(categories.map((c) => [c.id, c.key]));
  const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));

  return list.map((g, i) => ({
    tempId: g.id || `g${i}`,
    categoryKey: keyById.get(g.categoryId) || null,
    label: g.label || null,
    takeoff: g.takeoff ?? null,
    rateOverrides: ratesById.get(g.categoryId) ?? null,
  }));
}

/**
 * This company's saved edits to the material recipes.
 *
 * Read server-side for the same reason as the price books: the recipe decides
 * how many gallons a job needs, which is a cost, and a cost is not something
 * the browser gets to assert.
 */
export async function recipeOverridesFor(companyId) {
  const rows = await db.materialRecipeSetting.findMany({
    where: { companyId },
    select: { categoryKey: true, overrides: true },
  });
  return Object.fromEntries(
    rows.map((r) => [r.categoryKey, r.overrides || {}]),
  );
}

/**
 * Turn a request body's `costing` into the QuoteCosting row to persist.
 *
 * @param {object} p
 * @param {string} p.companyId
 * @param {object} p.costing      the request's costing block
 * @param {number} p.price        pre-tax subtotal this cost is measured against
 * @param {Array}  p.scopeGroups  [{ id?, categoryId, label, takeoff }] — the
 *                                groups as they will be stored
 * @returns the field object, or null when there is nothing to write. The
 *          caller must then leave any existing row alone rather than blanking
 *          it: "this request didn't mention costing" is not "delete it".
 */
export async function buildQuoteCostingRow({
  companyId,
  costing,
  price,
  scopeGroups,
}) {
  const clean = normaliseQuoteCosting(costing);
  if (!clean) return null;

  const [groups, recipeOverridesByCategory] = await Promise.all([
    resolveCostingGroups(companyId, scopeGroups),
    recipeOverridesFor(companyId),
  ]);

  // The company's REAL overhead per job, when they have told us their
  // capacity. Read server-side rather than accepted from the request: it is a
  // figure about the company, not about this quote, and a share of the price
  // is not a cost — quoting the same job twice at different prices does not
  // change what the rent was.
  let overheadPerJob = null;
  try {
    const min = await calculateMinimumPrice({ companyId });
    if (!min?.error && Number.isFinite(Number(min?.costPerJob))) {
      overheadPerJob = Number(min.costPerJob);
    }
  } catch {
    // An overhead we couldn't work out is absent, not zero. The percentage the
    // estimator chose stands in, and overheadBasis records that it did.
  }

  const summary = quoteCostSummary({
    scopeGroups: groups,
    crew: clean.crew,
    addedLabourHours: clean.addedLabourHours,
    addedMaterialCost: clean.addedMaterialCost,
    labourRate: clean.labourRate,
    overheadPct: clean.overheadPct,
    overheadPerJob,
    price,
    marginTargetPct: MARGIN_TARGET_PCT,
    recipeOverridesByCategory,
  });

  // ── The crew is stored PRICED, not as it was typed ───────────────────────
  //
  // The obvious version — store `clean.crew` straight back — is what the
  // invoice side does, and it is wrong here. On a quote most members carry
  // `hours: null`, meaning "take an even share of whatever the takeoffs
  // predict". Stored raw, the saved row reads back three people on zero hours
  // costing nothing, sitting underneath a labour cost of several thousand
  // dollars: a breakdown that contradicts its own total.
  //
  // So the resolved share and its cost are frozen with everything else, and
  // `hoursExplicit` records which of the two a number was — otherwise
  // reopening the panel would silently pin a share that should still move when
  // the scope does.
  const pricedCrew = summary.crew.map((m, i) => ({
    id: m.id ?? null,
    name: m.name,
    rate: m.rate,
    hours: m.hours,
    cost: m.cost,
    unrated: Boolean(m.unrated),
    hoursExplicit: clean.crew[i]?.hours != null,
  }));

  return {
    crew: pricedCrew,
    addedLabourHours: clean.addedLabourHours,
    addedMaterialCost: clean.addedMaterialCost,
    labourRate: clean.labourRate,
    overheadPct: clean.overheadPct,
    note: clean.note,

    labourHours: summary.labourHours,
    labourCost: summary.labourCost,
    materialTotal: summary.materialTotal,
    unpricedMaterials: summary.unpricedMaterials,
    overhead: summary.overhead,
    overheadBasis: summary.overheadBasis,
    totalCost: summary.estimatedCost,
    price: summary.price,
    profit: summary.profit,
    // Null when there was no price to have a margin against — the column is
    // nullable for exactly this. 0 would claim the job broke even.
    marginPct: summary.marginPct == null ? null : summary.marginPct,
    marginTargetPct: MARGIN_TARGET_PCT,
    signal: summary.signal,
    costIncomplete: summary.costIncomplete,
    blendedRate: summary.blendedRate == null ? null : summary.blendedRate,
    // Frozen with the totals. See the QuoteCosting model: the quantities
    // survive on QuoteScopeGroup.takeoff, but the PRICES that turned them into
    // money live in a settings row somebody will edit.
    groups: summary.groups.map((g) => ({
      label: g.label ?? null,
      categoryKey: g.categoryKey ?? null,
      labourHours: g.labourHours,
      materialTotal: g.materialTotal,
      materials: (Array.isArray(g.materials) ? g.materials : []).map((m) => ({
        name: m.name,
        qty: m.qty,
        unit: m.unit,
        unitCost: m.unitCost ?? null,
        cost: m.cost,
        unpriced: Boolean(m.unpriced),
      })),
    })),
  };
}

/**
 * Did the estimator actually say anything?
 *
 * The builder posts this block on every save, so a quote raised by someone who
 * never opened the cost panel would otherwise get a row of zeroes — and the
 * quote page would then show a costing card claiming a job with no crew, no
 * hours and no materials had been costed at 0% margin. Absence of a statement
 * is not a statement.
 *
 * Overhead and the fallback rate are excluded from the test on purpose: they
 * default to 10% and to a seeded rate, and neither is an assertion about THIS
 * job. The takeoff-derived hours are excluded too — they come from the quote's
 * own scope, not from anybody's opinion of it, and treating them as intent
 * would make every takeoff quote self-cost whether or not a human looked.
 *
 * The caller still has to distinguish "nothing to say" from "clear what is
 * there". An empty block over an EXISTING row is a deletion the user asked
 * for and must be written; over no row it is nothing at all.
 */
export function isEmptyQuoteCosting(row) {
  if (!row) return true;
  return (
    (!Array.isArray(row.crew) || row.crew.length === 0) &&
    Number(row.addedLabourHours) === 0 &&
    Number(row.addedMaterialCost) === 0 &&
    !row.note
  );
}

/**
 * Write the cost row, or leave whatever is there alone?
 *
 * Both routes ask this one function rather than each spelling the condition
 * out, because the condition has three cases and the middle one is the easy
 * thing to get wrong:
 *
 *   the request said NOTHING     → leave. A status-only PATCH — accept,
 *                                  decline, send — must not wipe the crew, the
 *                                  hours and the margin the quote was priced
 *                                  at. `costing: undefined` is silence, and
 *                                  silence is not an instruction.
 *   the request sent an EMPTY    → write, but only over an existing row. That
 *   panel                          is somebody clearing the panel, and
 *                                  ignoring it would be a Save button that
 *                                  doesn't save. With no row it means the
 *                                  panel was never opened, and a row of zeroes
 *                                  would claim the job was costed at nothing.
 *   the request sent figures     → write.
 *
 * Callers without the job-costing toggle never get here with `may` true, so a
 * member who cannot see the panel cannot post one alongside a line-item edit.
 *
 * @param {boolean} p.costingSent    was `costing` present in the body at all
 * @param {boolean} p.may            mayCost(member)
 * @param {boolean} p.hasExistingRow does this quote already carry a QuoteCosting
 * @param {object|null} p.row        the built row, or null
 * @returns {boolean} true to write it
 */
export function shouldWriteQuoteCosting({
  costingSent,
  may,
  hasExistingRow,
  row,
}) {
  if (!costingSent || !may || !row) return false;
  return Boolean(hasExistingRow) || !isEmptyQuoteCosting(row);
}
