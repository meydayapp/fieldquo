// lib/pricing/oneRowPerTier.js
//
// Moved here from app/(marketing)/pricing/page.js on 2026-09-29, unchanged,
// because the homepage's pricing band now prints the same cards and must
// collapse the same currency pairs the same way. Importing it out of a page
// module would have worked and would have tied the homepage to /pricing's
// route-segment file; a second copy would have been the one that rots. The
// page re-exports it, so scripts/check-pricing-page.mjs still imports it from
// where it always did.

const priceOf = (plan) => {
  const n = Number(plan?.priceMonthly);
  return Number.isFinite(n) ? n : 0;
};

/**
 * One card per TIER, not one card per Plan row.
 *
 * ══ Why the naive read renders eight cards ═════════════════════════════════
 *
 * Every rung of the ladder exists TWICE in the Plan table — once with currency
 * CAD, once with USD — carrying the SAME NUMBER rather than a conversion (see
 * SEAT_LADDER in lib/pricing/ladder.js for why). A findMany with no currency
 * filter therefore returns Solo, Solo, Crew, Crew, Shop, Shop, Scale, Scale,
 * and the page printed all eight: four pairs of identical prices, each pair
 * with a different buy link. /api/marketing/plans already selects `currency`
 * and `tierKey` precisely because of this; the public page never got the fix.
 *
 * ══ Why it does not filter by the visitor's currency instead ═══════════════
 *
 * That was the previous shape and it is the thing the owner objected to: you
 * cannot tell from an IP whether somebody is in Canada, the USA or Europe, and
 * a geo guess that picks a row is a guess that names a price in a currency. So
 * the page collapses the pair instead of choosing between them. Both rows say
 * the same number, so there is nothing to choose — and the buy link now carries
 * the TIER, which is currency-free, so the visitor's actual currency is
 * resolved at signup from the address they give.
 *
 * ══ The row that represents the pair ═══════════════════════════════════════
 *
 * Highest price wins, ties broken by currency code so the same card renders on
 * every request. "First row wins" was rejected: if an operator ever edits one
 * currency's row and not its twin, first-wins can advertise the lower of two
 * real prices and bill the higher, which is a number the visitor was shown and
 * is right to expect. Quoting the higher of a disagreeing pair is the error
 * that costs us a signup rather than the one that costs a customer money.
 *
 * A row with no tierKey is a legacy per-headcount plan with no twin to collapse
 * into, so it stands alone under its own id — folding all of them together
 * would delete plans rather than de-duplicate them.
 */
export function oneRowPerTier(plans) {
  const list = Array.isArray(plans) ? plans : [];
  const ranked = [...list].sort(
    (a, b) =>
      priceOf(b) - priceOf(a) ||
      String(a?.currency ?? "").localeCompare(String(b?.currency ?? "")),
  );

  const byTier = new Map();
  for (const plan of ranked) {
    const key = plan?.tierKey ? `tier:${plan.tierKey}` : `row:${plan?.id}`;
    if (!byTier.has(key)) byTier.set(key, plan);
  }

  // Cheapest first, which is the order the grid was already read in. sortOrder
  // breaks a tie rather than the map's insertion order, so two rungs that ever
  // share a price still render in the order an operator set.
  return [...byTier.values()].sort(
    (a, b) =>
      priceOf(a) - priceOf(b) || (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0),
  );
}
