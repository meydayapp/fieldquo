// lib/servicePlans/pricing.js
//
// What one occurrence of a service plan costs, and what the whole package
// costs. Pure, and executed against hostile input by scripts/check-service-
// plans.mjs — this is the arithmetic that decides how much money leaves a
// homeowner's account, so reading it is not enough.
//
// ── Why the discount is applied per occurrence ──────────────────────────────
//
// The owner's examples are stated as totals: "Spring & Fall (2×/year), 10% off
// total", "Quarterly maintenance plan, 15% off total". The obvious reading —
// take 10% off the sum and spread the deduction — does not survive contact with
// an invoice: 10% off a 3-visit plan at $167 is $50.10, which does not divide
// into three equal invoices, and whichever visit absorbs the stray cent bills a
// figure the client cannot reconcile against the plan they were sold.
//
// So the percentage is applied to EACH occurrence at the same rate. For a plan
// of N identical visits the two readings give the same term total (N × the
// rounded per-visit discount vs. one rounded deduction differ by at most N-1
// cents, and only when the per-visit figure lands exactly on a half-cent), and
// every individual invoice adds up on its own. The term total printed to the
// contractor is computed by SUMMING the occurrences, never by discounting the
// gross — so the number they quote is the number that will actually be billed.
//
// ── Everything is done in cents ─────────────────────────────────────────────
//
// Decimal columns in, Decimal-safe numbers out, integer arithmetic in between.
// Floating-point dollars are how a plan comes to bill $299.99999999997.

/** Coerce anything (Prisma Decimal, string, number, null) to a finite number. */
function num(value) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Dollars → integer cents, half-up, and never negative. */
function cents(dollars) {
  const n = num(dollars);
  if (n <= 0) return 0;
  return Math.round(n * 100);
}

/** Integer cents → a 2-decimal number safe to hand Prisma. */
export function fromCents(c) {
  return Math.round(c) / 100;
}

/**
 * A percentage, clamped to something that can be charged.
 *
 * Clamped rather than rejected: a discount over 100% would produce a negative
 * invoice, and a negative one would produce a surcharge the client never agreed
 * to. Both are silently impossible here rather than left to a validator
 * somewhere upstream that might not run.
 */
function pct(value, { max = 100 } = {}) {
  const n = num(value);
  if (!(n > 0)) return 0;
  return Math.min(n, max);
}

/**
 * What one occurrence bills.
 *
 * @param plan  { amountPerOccurrence, discountPct, taxRatePct }
 * @returns { grossCents, discountCents, subtotalCents, taxCents, totalCents,
 *            gross, discount, subtotal, tax, total }
 *          Both units, because the invoice columns want dollars and Stripe
 *          wants cents, and converting at two different call sites is how they
 *          come to disagree.
 */
export function occurrenceAmounts(plan) {
  const grossCents = cents(plan?.amountPerOccurrence);
  const discountCents = Math.round((grossCents * pct(plan?.discountPct)) / 100);
  const subtotalCents = Math.max(0, grossCents - discountCents);

  // A null tax rate means the contractor said there is no tax on this plan.
  // It is NOT a missing value to fill in from company settings here — the plan
  // form asks, and the answer is stored. Padding it would put tax on an invoice
  // nobody agreed to charge.
  const taxCents =
    plan?.taxRatePct === null || plan?.taxRatePct === undefined
      ? 0
      : Math.round((subtotalCents * pct(plan.taxRatePct, { max: 1000 })) / 100);

  const totalCents = subtotalCents + taxCents;

  return {
    grossCents,
    discountCents,
    subtotalCents,
    taxCents,
    totalCents,
    gross: fromCents(grossCents),
    discount: fromCents(discountCents),
    subtotal: fromCents(subtotalCents),
    tax: fromCents(taxCents),
    total: fromCents(totalCents),
  };
}

/**
 * What the whole package costs over its term.
 *
 * @returns null for an open-ended plan. Null, not a projection: "we don't know,
 *          and neither does the contractor" is the true answer, and a screen
 *          that prints "$0.00 total" or "$199/visit × 12" for a plan that runs
 *          until cancelled is stating something nobody agreed to. Callers
 *          render the per-occurrence figure and the cadence instead.
 */
export function termTotals(plan, occurrenceCount) {
  if (!Number.isInteger(occurrenceCount) || occurrenceCount <= 0) return null;

  const one = occurrenceAmounts(plan);
  return {
    occurrences: occurrenceCount,
    grossCents: one.grossCents * occurrenceCount,
    discountCents: one.discountCents * occurrenceCount,
    subtotalCents: one.subtotalCents * occurrenceCount,
    taxCents: one.taxCents * occurrenceCount,
    totalCents: one.totalCents * occurrenceCount,
    gross: fromCents(one.grossCents * occurrenceCount),
    discount: fromCents(one.discountCents * occurrenceCount),
    subtotal: fromCents(one.subtotalCents * occurrenceCount),
    tax: fromCents(one.taxCents * occurrenceCount),
    total: fromCents(one.totalCents * occurrenceCount),
  };
}
