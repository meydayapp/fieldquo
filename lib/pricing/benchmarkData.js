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
//
// ── And it reads across REAL companies only ────────────────────────────────
//
// It didn't. Both queries below took every row on the platform, and a seeded
// demo (lib/demo/seedDemo.js) arrives with a complete, invented price book —
// so the "market average" a paying contractor was shown had fixtures in it,
// and the fixtures were priced to demo well rather than to be true.
//
// Worse than the skew: the cohort floor in benchmark.js (MIN_COHORT) is
// k-anonymity, and its own comment says why — below it, each company can
// subtract its own price from the average and recover the others'. Demo
// companies clear that floor without adding a single real data point, which
// publishes cohorts that should have stayed hidden and makes a lone real
// contractor's rate recoverable from a mean whose other members are known
// fixtures. The exclusion is therefore not tidying; it is what makes the
// guarantee above true.
//
// Applied in the QUERY rather than filtered afterwards, for the same reason
// app/api/platform/analytics/overview/route.js gives: a count taken from one
// population and an average from another is wrong in a way nobody spots.
import { buildBenchmarks, compareCompany, unmatchedNames } from "./benchmark";

/// A sales fixture is not a contractor. See the note above.
const NOT_DEMO = { isDemo: false };

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
import { currencyForCountry } from "@/lib/currency";

// ── Where a row's money lives ─────────────────────────────────────────────
//
// buildBenchmarks in region mode refuses to average across currencies, and it
// is right to: a CAD door price and a USD door price are different numbers
// about different markets, and their mean is wrong in both.
//
// Company.currency is NULLABLE, so it cannot simply be read. It is also not
// defaulted to CAD here — that would quietly file an American contractor's
// prices into the Canadian pool, which is the exact error the currency rule
// exists to stop, arriving through the back door.
//
// currencyForCountry is used ONLY when a country is actually stated. With
// neither, the row carries null and buildBenchmarks drops it from region mode
// — there is nothing it can honestly be averaged with. It still counts in the
// unscoped global figure, which asks a different, currency-blind question.
function placeOf(company) {
  const country = company?.country || null;
  const currency = company?.currency || (country ? currencyForCountry(country) : null);
  return {
    currency: currency || null,
    country,
    // Free text today, so "ON" and "Ontario" do not fold and can split a
    // cohort. The consequence is only ever a fallback to a truthfully-labelled
    // national number, never a wrong one — so this is left alone rather than
    // guessed at with a name-to-code table. The real fix is a province picker
    // at data entry.
    province: company?.province || null,
  };
}

export async function collectPricedRows(db) {
  const [products, rateCards] = await Promise.all([
    db.product.findMany({
      where: { active: true, unitPrice: { not: null }, company: NOT_DEMO },
      select: {
        companyId: true,
        name: true,
        unit: true,
        unitPrice: true,
        categories: { select: { key: true, label: true } },
        // Where this company bills and where it works. Needed by
        // buildBenchmarks in region mode: a CAD price and a USD price cannot be
        // averaged together, and a Toronto door price is not a rural
        // Saskatchewan one. See the currency note below for why this is not
        // defaulted.
        company: { select: { currency: true, country: true, province: true } },
      },
    }),
    db.companyServiceCategory.findMany({
      where: { enabled: true, defaultRate: { not: null }, company: NOT_DEMO },
      select: {
        companyId: true,
        defaultRate: true,
        unit: true,
        pricingModel: true,
        category: { select: { key: true, label: true } },
        // Where this company bills and where it works. Needed by
        // buildBenchmarks in region mode: a CAD price and a USD price cannot be
        // averaged together, and a Toronto door price is not a rural
        // Saskatchewan one. See the currency note below for why this is not
        // defaulted.
        company: { select: { currency: true, country: true, province: true } },
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
        ...placeOf(p.company),
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
      ...placeOf(r.company),
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
