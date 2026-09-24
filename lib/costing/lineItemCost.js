// lib/costing/lineItemCost.js
//
// What the priced lines themselves COST the company — the third bucket of a
// job's cost beside labour and materials, and the one the two recipes never
// see: a subcontracted counter, a bought-in door set, a permit fee resold to
// the client. Jobber calls it "line items" on its profit-margin card; the
// owner asked for that card by name (2026-09-23).
//
// ── Where the number comes from ─────────────────────────────────────────────
//
// A line carries an optional `unitCost` — typed in the builder's cost / markup
// popover (LineItemsTable), or copied from Product.costPrice when the line was
// picked from the catalogue (lib/quotes/lineDetail.js). It is stored on the
// line itself, in the same Json the line's price lives in, because that is
// what survives a save unchanged and reopens beside the price it was typed
// against. Nothing client-facing reads the key: ScopeGroupsSection, the PDF
// and the approval page read description, detail, quantity and amount and
// nothing else, and lib/documents/theme.js has no colour for a cost.
//
// ── Absent is absent ────────────────────────────────────────────────────────
//
// A line with no unitCost contributes nothing, and a quote whose lines carry
// none has a line-item cost of 0 — which reads as "nothing was said", not
// "these lines were free", because the panel only prints the row when the
// figure is above zero. The same rule the material list follows for a
// quantity with no supplier price.
//
// Pure. Shared by the builder (live), the two save routes (the frozen row)
// and scripts/check-invoice-builder.mjs, which executes it against junk.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;

/** A line's own cost: quantity × unitCost, or 0 when no cost was stated. */
export function lineCost(line) {
  if (!line || typeof line !== "object") return 0;
  const unitCost = num(line.unitCost);
  if (unitCost <= 0) return 0;
  const quantity = num(line.quantity);
  // A stored line with no quantity bills as one (lineItemsFromStored), so it
  // costs as one too — the two must not disagree about how many there are.
  return round2((quantity > 0 ? quantity : 1) * unitCost);
}

/** The cost of every line in a list — Json from any document, junk tolerated. */
export function lineItemCostOf(lines) {
  return round2((Array.isArray(lines) ? lines : []).reduce((s, l) => s + lineCost(l), 0));
}

/** Across a quote's scope groups: each group's own lines, as stored. */
export function scopeGroupsLineItemCost(groups) {
  return round2(
    (Array.isArray(groups) ? groups : []).reduce(
      (s, g) => s + lineItemCostOf(g && typeof g === "object" ? g.lineItems : null),
      0,
    ),
  );
}

/**
 * The markup a price carries over its cost, as a percentage — what the
 * popover shows beside "Unit cost". Null when either side is missing: a
 * markup over nothing is not 0%, and a free line over a real cost is −100%,
 * which is a fact worth printing rather than hiding.
 */
export function markupPct(unitCost, rate) {
  const c = num(unitCost);
  const r = num(rate);
  if (c <= 0) return null;
  return Math.round(((r - c) / c) * 1000) / 10;
}

/** The price a cost and a markup imply — the other direction of the popover. */
export function priceFromMarkup(unitCost, pct) {
  const c = num(unitCost);
  if (c <= 0) return null;
  return round2(c * (1 + num(pct) / 100));
}
