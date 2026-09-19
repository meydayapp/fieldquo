// lib/costing/marginTarget.js
//
// The ONE margin a quote is measured against.
//
// ── Two targets that never met ──────────────────────────────────────────────
//
// Settings → Overhead has a "Target margin %" box, defaulting to 20, stored on
// ForecastSettings.targetMargin as a fraction. Until 2026-09-19 exactly one
// thing read it: the minimum-price floor. The quote builder's Cost & margin
// panel, the saved QuoteCosting row and the recomputed fallback all measured
// against a hard-coded 30 — so an owner who typed 25 into Settings watched
// the panel keep calling 27% "amber" against a number they had never chosen.
// A setting that saves and changes nothing is the recurring failure class
// AGENTS.md lists first.
//
// Pure, and imported by the BROWSER (the builder's live panel) as well as the
// server, so nothing in here may touch the database. The loader that reads
// the row lives in lib/costing/quoteCostEstimate.js beside the other DB
// reads.

/**
 * What the margin is held to when the company has never said. 20, not 30:
 * the Settings screen has printed "20 (default)" as the placeholder since
 * the box existed, and the price floor has used 20 for as long — the 30 was
 * the builder's own private figure, and only the builder's.
 */
export const DEFAULT_MARGIN_TARGET_PCT = 20;

/** The stored fraction is clamped the same way the floor clamps it. */
const MAX_PCT = 95;

/**
 * The target as a whole percent, from the stored fraction (0.25 → 25).
 *
 * `isDefault` is the half the review needs: "8% against 25%" and "8% against
 * the 20% default — set yours in Settings → Overhead" are different sentences,
 * and only the row can tell them apart. null/undefined/"" mean nothing was
 * said; 0 is a real target (price at cost), not an absence — the same rule
 * lib/analytics/minimumPrice.js keeps for the same column.
 */
export function marginTargetPctFrom(savedFraction) {
  if (savedFraction === null || savedFraction === undefined || savedFraction === "") {
    return { pct: DEFAULT_MARGIN_TARGET_PCT, isDefault: true };
  }
  const n = Number(savedFraction);
  if (!Number.isFinite(n) || n < 0) {
    return { pct: DEFAULT_MARGIN_TARGET_PCT, isDefault: true };
  }
  return { pct: Math.min(Math.round(n * 100), MAX_PCT), isDefault: false };
}
