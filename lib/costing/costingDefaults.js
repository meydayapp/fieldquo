// lib/costing/costingDefaults.js
//
// The two figures FieldQuo fills in when a company hasn't told us its own,
// and the one test for "did this costing actually use them?".
//
// ── Why the constants moved here ────────────────────────────────────────────
//
// They lived in lib/costing/quoteCosting.js, which also pulls in every trade
// price book. The quote page needs the numbers to say "Labour is at the $35/h
// default", and it has no business shipping the price books to do it. They
// are re-exported from quoteCosting.js, so every existing import still works.
//
// ── Why a warning at all ────────────────────────────────────────────────────
//
// An instant estimate is costed with nobody assigned, at $35 an hour and at
// 10% of the price for overhead, because that is the honest best guess when
// nobody has said anything (see createEstimateQuote.js). A guess dressed as a
// margin is still a guess, and the quote page showed it in the same green as a
// costing built from real pay rates and the company's real overhead. The
// owner's call (2026-09-29): say so, on the quote, with the fix beside it.
//
// ── What "used" means ───────────────────────────────────────────────────────
//
// Read off what the costing RECORDED, never assumed:
//
//   labour   — nobody on the crew, hours to cost, and the fallback rate the
//              row actually stored equal to FieldQuo's default. A company that
//              typed its own fallback rate ($48) has made a statement and is
//              not told it is on "FieldQuo's $35/h default". A row that
//              doesn't carry the rate at all says nothing, and nothing is
//              claimed about it.
//   overhead — overheadBasis is neither "per_job" nor "per_hour": the overhead
//              is a share of the price rather than the company's real monthly
//              costs divided by its jobs ("per_job") or shared by the job's
//              crew-hours ("per_hour", lib/costing/overheadShare.js). Both of
//              those are the company's own figures, not FieldQuo's default.
//              Whatever percentage was used is what the sentence quotes; null
//              when the row doesn't say which.
//
// Nothing here fires on a quote whose cost could not be worked out at all
// (costBasisMissing) — that block already says something stronger — and
// nothing fires on a properly costed quote: a named crew and a per-job
// overhead make both answers false.
//
// Pure, and imported by the browser. No database.

/// Overhead as a share of the price, used ONLY when the company has never told
/// us its monthly fixed costs and job capacity. See quoteCosting.js.
export const FALLBACK_OVERHEAD_PCT = 10;

/// What an hour of crew COSTS the company when nobody has said who is doing
/// the job. See quoteCosting.js for why 35 and not a charge-out rate.
export const FALLBACK_LABOUR_RATE = 35;

/// The overhead bases built from the company's own figures — monthly costs ÷
/// jobs a month, and monthly costs ÷ billable crew-hours × the job's hours.
/// Every other stated basis is FieldQuo's percentage-of-price guess. Exported
/// so the screens that hide the percentage box test the same set.
export const REAL_OVERHEAD_BASES = new Set(["per_job", "per_hour"]);

/** True when a costing's overhead came from the company's own figures. */
export function isRealOverheadBasis(basis) {
  return typeof basis === "string" && REAL_OVERHEAD_BASES.has(basis);
}

const finite = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const cents = (n) => Math.round(n * 100);

/**
 * Which of FieldQuo's defaults a costing leaned on.
 *
 * @param {object} costing  the wire shape GET /api/quotes/[id]/costing serves
 *                          (saved or derived), or anything with the same
 *                          field names
 * @returns {{ labour: boolean, overhead: boolean, overheadPct: number|null }}
 */
export function costingDefaultsUsed(costing) {
  const none = { labour: false, overhead: false, overheadPct: null };
  if (!costing || typeof costing !== "object") return none;
  if (costing.costBasisMissing) return none;

  const crew = Array.isArray(costing.crew) ? costing.crew : [];
  const hours = finite(costing.labourHours);
  const rate = finite(costing.labourRate);
  const labour =
    crew.length === 0 &&
    hours !== null &&
    hours > 0 &&
    rate !== null &&
    cents(rate) === cents(FALLBACK_LABOUR_RATE);

  // Only a basis the costing actually states. An absent one is not "per_job",
  // but it is not "pct_of_price" either — it is silence.
  const basis = typeof costing.overheadBasis === "string" ? costing.overheadBasis : null;
  const overhead = basis !== null && !REAL_OVERHEAD_BASES.has(basis);
  const pct = finite(costing.overheadPct);

  return {
    labour,
    overhead,
    overheadPct: overhead && pct !== null ? Math.round(pct * 100) / 100 : null,
  };
}

/**
 * The crew rows with no pay rate against them — the names the quote page
 * prints as "No pay rate set for X". A row with no hours costs nothing either
 * way and is left out: the gap is only a gap when there is time to pay for.
 *
 * Reads `hourlyRate` (the wire shape) or `rate` (the builder's crew state).
 */
export function unratedCrew(crew) {
  return (Array.isArray(crew) ? crew : []).filter((m) => {
    if (!m || typeof m !== "object") return false;
    const rate = finite(m.hourlyRate ?? m.rate);
    const hours = finite(m.hours);
    // Hours unknown (a builder row taking an even share) still counts: the
    // share is real, it just hasn't been worked out on this side yet.
    return (rate === null || rate <= 0) && (hours === null || hours > 0);
  });
}
