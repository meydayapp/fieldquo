// lib/pricing/benchmarkData.js
//
// Pulls the priced rows every company has entered, so lib/pricing/benchmark.js
// can turn them into a market average.
//
// ── The cross-tenant read, stated plainly ──────────────────────────────────
//
// This is the ONE query in the codebase that deliberately reads across
// companies. Non-negotiable #8 says pricing comparisons use the company's own
// history only; the owner has asked for a market benchmark twice, explicitly,
// and this is that. Recording it here rather than leaving it to be discovered.
//
// What makes it defensible is what leaves this file:
//
//   * Only (trade, item name, unit, price). No companyId reaches a caller —
//     it is used to COUNT distinct companies and is discarded.
//   * Nothing is published below the cohort floor in benchmark.js, which is
//     k-anonymity, not caution: at two companies each can subtract its own
//     price from the average and recover the other's exactly.
//   * A company's own rows are never singled out. It can locate itself in the
//     distribution only by comparing against a price it already knows.
//
// If a future caller needs companyId out of here, that is the moment to stop
// and ask again rather than widen the select.

import { buildBenchmarks, compareCompany, unmatchedNames } from "./benchmark";

/**
 * Every priced line item across every company, flattened.
 *
 * Two sources, because pricing lives in two shapes:
 *
 *   Product                 the catalogue — "Soft-Close Hinges, $35/door".
 *                           Carries its own unit, which is what makes it
 *                           comparable at all.
 *   CompanyServiceCategory  the per-trade rate card — one headline rate for
 *                           "Interior Painting" with a pricing model.
 *
 * A Product can be linked to several categories; it is emitted once per
 * category, because "Soft-Close Hinges" priced by a cabinet shop and by a
 * kitchen fitter are the same market for that item.
 */
export async function collectPricedRows(db) {
  const [products, rateCards] = await Promise.all([
    db.product.findMany({
      where: { active: true, unitPrice: { not: null } },
      select: {
        companyId: true,
        name: true,
        unit: true,
        unitPrice: true,
        categories: { select: { key: true, label: true } },
      },
    }),
    db.companyServiceCategory.findMany({
      where: { enabled: true, defaultRate: { not: null } },
      select: {
        companyId: true,
        defaultRate: true,
        unit: true,
        pricingModel: true,
        category: { select: { key: true, label: true } },
      },
    }),
  ]);

  const rows = [];

  for (const p of products) {
    // A product linked to no category can't be benchmarked: "which market?"
    // has no answer, and putting it in a global pool would compare a painter's
    // line item with a plumber's.
    for (const c of p.categories || []) {
      rows.push({
        companyId: p.companyId,
        categoryKey: c.key,
        categoryLabel: c.label,
        name: p.name,
        unit: p.unit,
        price: Number(p.unitPrice),
        source: "product",
      });
    }
  }

  for (const r of rateCards) {
    // The rate card has no item name — the trade IS the item. Named after the
    // trade so it groups with itself and never with a catalogue line.
    rows.push({
      companyId: r.companyId,
      categoryKey: r.category.key,
      categoryLabel: r.category.label,
      name: `${r.category.label} — standard rate`,
      // pricingModel carries the measure when `unit` is blank, which is the
      // common case on a rate card: "hourly" with no unit typed.
      unit: r.unit || pricingModelUnit(r.pricingModel),
      price: Number(r.defaultRate),
      source: "rate_card",
    });
  }

  return rows;
}

/** A pricing model implies a unit when nobody typed one. */
function pricingModelUnit(model) {
  switch (String(model || "").toLowerCase()) {
    case "hourly":
      return "hour";
    case "per_sqft":
    case "sqft":
      return "sq ft";
    case "per_linear_ft":
      return "linear ft";
    case "flat":
      return "flat";
    default:
      return null;
  }
}

/**
 * The whole picture for one company: the market, where they sit, and what they
 * price that nobody else does.
 *
 * `benchmarks` excludes nothing on the company's behalf — a contractor should
 * be able to see the market for trades they haven't switched on yet, which is
 * how they find out a service is worth offering.
 */
export async function benchmarkForCompany(db, companyId, opts = {}) {
  const rows = await collectPricedRows(db);
  const benchmarks = buildBenchmarks(rows, opts);

  const mine = rows.filter((r) => r.companyId === companyId);
  const comparison = compareCompany(mine, benchmarks, opts);

  return {
    benchmarks,
    comparison,
    // Their own unmatched items — the ones with no market to compare to.
    // Useful to them directly ("nobody else lists this") and the input to the
    // clustering pass across all companies.
    unmatched: unmatchedNames(mine, benchmarks),
    coverage: {
      pricedRows: mine.length,
      compared: comparison.length,
      marketGroups: benchmarks.length,
      // How many companies contributed anything at all. Shown so a thin
      // benchmark is visibly thin rather than quietly authoritative.
      contributors: new Set(rows.map((r) => r.companyId)).size,
    },
  };
}
