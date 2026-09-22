// lib/pricing/benchmarkFx.js
//
// The ONE exchange rate a suggested price is allowed to cross, and the rounding
// a converted suggestion gets.
//
// ── Why a constant and not a live rate ─────────────────────────────────────
//
// The seeded service benchmarks (app/data/serviceSeeds/*) are US national
// quartiles in USD. A Canadian company is shown them as a *guideline*, and a
// guideline that moves with this morning's FX print would read as a quote —
// $325 on Monday, $331 on Tuesday, for a number that was never precise to a
// dollar in the first place. So the rate is fixed, dated, and rounded coarsely
// enough that the conversion cannot pretend to be exact.
//
// electricalBenchmarks.js and priceBooks/systems.js refuse to convert COSTS
// between markets at all, because a Canadian shelf price is a different
// observation from a US one. That reasoning stands and is not contradicted
// here: this converts a *suggested sell price the company is told to change*,
// never a cost, never a figure that lands on a document. The rounding is the
// tell — a converted suggestion is always a multiple of $5.
//
// ── The seam for the FieldQuo-wide median ──────────────────────────────────
//
// `source: "benchmark"` on a seed's range means "industry benchmark". The
// owner's plan is to replace it with `source: "fieldquo_median"` — the median
// across FieldQuo companies' own prices (aggregate only, MIN_COHORT applies —
// see lib/pricing/benchmark.js), which arrives already in the company's
// currency and needs no conversion. `benchmarkIn` passes such a range through
// untouched, so the UI needs no second code path when the source changes.

/** USD → CAD, fixed on 2026-09-21 for suggested prices only. */
export const USD_TO_CAD_SUGGESTED = 1.37;
export const USD_TO_CAD_SUGGESTED_AS_OF = "2026-09-21";

/** Currencies a suggestion can be rendered in. Anything else gets null. */
const SUPPORTED = new Set(["USD", "CAD"]);

/**
 * Round a converted suggestion so it cannot read as exact.
 *
 *   ≥ $20   nearest $5      ($331.45 → $330)
 *   ≥ $5    nearest $1      ($6.85 → $7)
 *   < $5    nearest $0.25   (a $1.25/sq ft rate must not round to $0)
 *
 * The brief said "nearest $5"; the two finer steps exist because per-square-
 * foot and per-linear-foot services in the seeds run from $0.50 up, and $5
 * granularity would zero them — a suggestion of $0 is a lie, not a rounding.
 */
export function roundSuggested(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 20) return Math.round(n / 5) * 5;
  if (n >= 5) return Math.round(n);
  return Math.round(n * 4) / 4;
}

/**
 * One USD benchmark figure, in the company's currency, rounded.
 * Null for a null input, a non-positive input, or a currency this file cannot
 * convert into — never a guess, never the USD figure wearing the wrong sign.
 */
export function suggestedIn(usd, currency) {
  const code = String(currency || "").toUpperCase();
  if (!SUPPORTED.has(code)) return null;
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (code === "USD") return n;
  return roundSuggested(n * USD_TO_CAD_SUGGESTED);
}

/**
 * A seed's benchmark range, in the company's currency.
 *
 * Returns `{ low, median, high, currency, source, asOf, converted }` or null
 * when there is no range or no median. `low`/`high` stay null when the source
 * had none — a range is never padded out of a point. A range whose source is
 * not "benchmark" (the future FieldQuo median) is assumed to already be in the
 * company's currency and passes through.
 */
export function benchmarkIn(benchmark, currency) {
  if (!benchmark || typeof benchmark !== "object") return null;
  const code = String(currency || "").toUpperCase();
  if (!SUPPORTED.has(code)) return null;
  const median = Number(benchmark.median);
  if (!Number.isFinite(median) || median <= 0) return null;

  const source = benchmark.source || "benchmark";
  const from = String(benchmark.currency || "USD").toUpperCase();
  if (source !== "benchmark" || from === code) {
    return {
      low: positiveOrNull(benchmark.low),
      median,
      high: positiveOrNull(benchmark.high),
      currency: code,
      source,
      asOf: benchmark.asOf || null,
      converted: false,
    };
  }
  if (from !== "USD") return null; // only USD → CAD is documented
  return {
    low: benchmark.low == null ? null : suggestedIn(benchmark.low, code),
    median: suggestedIn(median, code),
    high: benchmark.high == null ? null : suggestedIn(benchmark.high, code),
    currency: code,
    source,
    asOf: benchmark.asOf || null,
    converted: true,
  };
}

function positiveOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
