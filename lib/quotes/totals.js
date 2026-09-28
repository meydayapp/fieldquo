// lib/quotes/totals.js
//
// The one place subtotal → discount → tax → total is worked out.
//
// ── Why this is shared rather than written twice ────────────────────────────
//
// The quote builder, the quote editor and the invoice editor each carried
// their own copy of the same four lines. They agreed by luck: the builder had
// no discount at all, so its tax was charged on the UNDISCOUNTED subtotal
// while the editor and the API costed against subtotal − discount. Adding a
// discount to the builder without unifying this would have shipped two
// different totals for the same quote depending on which screen last saved it.
//
// ── The rules, and why each exists ──────────────────────────────────────────
//
// 1. Discount is an AMOUNT, not a percentage. That is what the `discount`
//    Decimal column holds, what TotalsSection prints as `-$500.00`, and what
//    the invoice side stores. A percentage is an input convenience — see
//    discountAmountFromPercent — and is converted before it is stored, because
//    there is nowhere to keep it and a number nothing reads back is the
//    failure class AGENTS.md names first.
//
// 2. Tax is charged on subtotal − discount. Tax on the pre-discount figure
//    would bill the client tax on money they were never charged.
//
// 3. The discount is clamped to the subtotal. "$500 off" typed as "50000"
//    must not produce a negative total, a negative tax, or a credit note
//    dressed up as a quote.
//
// 4. Anything unparseable is 0, never NaN. A NaN reaches the column as null
//    or as a crash on Decimal conversion, and either way the money on the
//    document stops matching the money in the database.

/** A money input from a form field: "" , "12.50", null, "abc" → a number. */
const cash = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Cents, not floats. 22.22 at 14.975% is 3.3274449999999995 in IEEE 754, and
 * that lands in a Decimal column as an amount no one can reconcile.
 */
export const round2 = (n) =>
  Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;

/**
 * @param {object}  input
 * @param {number}  input.subtotal    sum of every line item, pre-discount
 * @param {number}  input.discount    flat amount off, as stored on the column
 * @param {number}  input.taxRate     percent, e.g. 13 for 13%
 * @param {boolean} input.taxEnabled  the "apply tax" flag, honoured as given
 *
 * @returns {{subtotal:number, discount:number, taxableBase:number, tax:number, total:number}}
 *   `discount` comes back CLAMPED — save this one, not the raw input, so the
 *   document and the stored row agree about what was taken off.
 */
export function quoteTotals({
  subtotal,
  discount = 0,
  taxRate = 0,
  taxEnabled = true,
} = {}) {
  const sub = round2(cash(subtotal));

  // Clamped against max(sub, 0) rather than sub: a negative subtotal is
  // possible (someone typed a credit line) and `Math.min(d, -50)` would turn
  // the discount itself negative, quietly ADDING money to the total.
  const disc = round2(Math.min(Math.max(cash(discount), 0), Math.max(sub, 0)));

  const taxableBase = round2(sub - disc);
  const tax = taxEnabled ? round2(taxableBase * (cash(taxRate) / 100)) : 0;

  return {
    subtotal: sub,
    discount: disc,
    taxableBase,
    tax,
    total: round2(taxableBase + tax),
  };
}

/**
 * The same four numbers, worked BACKWARDS from a total that already includes
 * tax — for a screen where a person types what the client will pay (the
 * estimate-review queue's "Approve at", which opens on the quote's total).
 *
 * Why this exists: that screen used to write the typed figure into BOTH
 * `subtotal` and `total` and leave `tax` alone, so a $19,000 approval of a
 * 13% quote stored subtotal 19,000 + tax 2,119 = total 19,000. Solving for
 * the subtotal instead keeps rule 2 above (tax on subtotal − discount) and
 * the identity every renderer assumes: total = subtotal − discount + tax.
 *
 * The subtotal is rounded to cents, so a total can be one the forward
 * arithmetic cannot land on exactly (at 13%, no subtotal in cents gives tax
 * that sums to some totals). The nearest cents either side are tried and the
 * one that reproduces the typed total wins; when none does, the forward
 * result is returned as-is with `exact: false` — a total a cent away from
 * what was typed and internally consistent, never one that is not.
 *
 * @returns {{subtotal, discount, taxableBase, tax, total, exact:boolean}}
 */
export function quoteTotalsFromTotal({
  total,
  discount = 0,
  taxRate = 0,
  taxEnabled = true,
} = {}) {
  const want = round2(Math.max(cash(total), 0));
  const disc = round2(Math.max(cash(discount), 0));
  const rate = taxEnabled ? cash(taxRate) : 0;
  const base = rate > -100 ? want / (1 + rate / 100) : want;
  const guess = round2(base + disc);
  let best = null;
  for (const delta of [0, 0.01, -0.01, 0.02, -0.02]) {
    const t = quoteTotals({ subtotal: round2(guess + delta), discount: disc, taxRate: rate, taxEnabled });
    if (t.total === want) return { ...t, exact: true };
    if (!best) best = t;
  }
  return { ...best, exact: false };
}

/**
 * "10% off" → the amount that gets stored.
 *
 * Percent is an entry mode in the UI only. Kept here rather than in the
 * component so both the builder and the editor convert identically, and so it
 * can be executed against hostile input by scripts/check-quote-totals.mjs.
 */
export function discountAmountFromPercent(subtotal, percent) {
  const pct = Math.min(Math.max(cash(percent), 0), 100);
  return round2(Math.max(cash(subtotal), 0) * (pct / 100));
}

/**
 * The reverse, for showing "(≈12%)" beside an amount someone typed. Returns
 * null when there is no subtotal to be a percentage of — 0/0 is not 0%.
 */
export function discountPercentOfSubtotal(subtotal, amount) {
  const sub = cash(subtotal);
  if (sub <= 0) return null;
  const pct = (Math.min(Math.max(cash(amount), 0), sub) / sub) * 100;
  return Math.round(pct * 10) / 10;
}
