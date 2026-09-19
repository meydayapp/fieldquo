// lib/estimate/estimateLines.js
//
// The line items an instant estimate's breakdown becomes on the draft quote.
//
// ── Two shapes for one number ──────────────────────────────────────────────
//
// An estimator's breakdown entry is `{ label, amount }` — the sentence the
// homeowner read on the public page ("25 doors refinished  $4,750"). That is
// the right thing to keep on estimateData.breakdown, which is the record of
// what they saw. It is the wrong thing to store as the quote's LINE: a line
// with quantity 1 and a rate equal to its amount cannot be recounted, cannot
// be repriced by changing the count, and prints on the document as a flat
// one-liner beside a hand-built quote whose same kitchen reads
// "Cabinet Refinishing — doors × 25 @ $190".
//
// So an estimator that knows more than a label says so in `line`: the count,
// the unit, the per-unit rate, and — for a unit-priced trade — the `meta`
// the quote page explains a price with (base rate, complexity level, the
// reasons). This turns that into the stored row. An entry without `line`
// falls back to the flat shape, which is still exactly what it was before.
//
// Pure, so scripts/check-instant-quote-draft.mjs executes it.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array<{label:string, amount:number, line?:object}>} breakdown
 * @param {{ label?: string }} [opts]  the scope group's client-facing label,
 *        which a `line.part` is prefixed with — "Cabinet Refinishing — doors",
 *        the same text lib/pricing/tradeScope.js buildCabinets writes.
 */
export function lineItemsFromBreakdown(breakdown, { label = "" } = {}) {
  return (Array.isArray(breakdown) ? breakdown : [])
    .filter((b) => b && typeof b === "object")
    .map((b) => {
      const amount = num(b.amount);
      const l = b.line && typeof b.line === "object" ? b.line : null;
      if (!l) return { description: String(b.label || ""), quantity: 1, rate: amount, amount };
      // A part with no service name to hang off falls back to the homeowner's
      // own sentence: "doors" alone is not a line anyone could read.
      const description = l.description
        ? String(l.description)
        : l.part && label
          ? `${label} — ${String(l.part)}`
          : String(b.label || "");
      const quantity = num(l.quantity) > 0 ? num(l.quantity) : 1;
      return {
        description,
        quantity,
        ...(l.unit ? { unit: String(l.unit) } : {}),
        // The rate the estimator priced at; the amount stays the estimator's
        // own rounded figure, which is what every renderer treats as the truth.
        rate: num(l.rate) || (quantity > 0 ? Math.round((amount / quantity) * 100) / 100 : amount),
        amount,
        ...(l.detail ? { detail: String(l.detail) } : {}),
        ...(l.meta && typeof l.meta === "object" ? { meta: l.meta } : {}),
      };
    });
}

/** The homeowner-facing record: labels and amounts only, never the line. */
export function breakdownForRecord(breakdown) {
  return (Array.isArray(breakdown) ? breakdown : [])
    .filter((b) => b && typeof b === "object")
    .map(({ line, ...rest }) => rest);
}
