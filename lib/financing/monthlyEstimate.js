// lib/financing/monthlyEstimate.js
//
// The monthly instalment maths, and the one condition under which FieldQuo is
// willing to show a homeowner a monthly figure at all.
//
// ══ Why this file exists when lib/estimate/financing.js refused to ═════════
//
// financing.js refuses to compute a payment, and it is still right: a
// "$182/month" figure FieldQuo invents — the way the original cabinet site did
// it, at a hardcoded 15% APR — is a term the CONTRACTOR would be held to that
// nobody at the contractor ever agreed.
//
// The objection is about WHOSE terms they are, not about arithmetic. So the
// fix is not a better default; it is having no default. The company types an
// APR and a term into their own settings, and from then on the figure is
// theirs — the same thing they'd say on the phone, rendered consistently.
//
// Which gives the hard rule this module enforces and the check script proves:
//
//   NO TERMS → NO FIGURE. Ever.
//
// There is no fallback APR, no "typical" 12 months, no band, no guess. A
// company that enables financing without stating terms gets the honest "ask
// us" sentence and nothing numeric. Absence of a statement is not a statement.
//
// And where a real lender can quote its own number, that beats this one: at
// Stripe Checkout, Affirm renders its own terms (see lib/stripe.js). What this
// module produces is a pre-checkout illustration on the contractor's stated
// terms, and every surface that shows it must say so.
//
// Pure: no I/O, no clock, no randomness. Same inputs, same cents, forever.

/**
 * The accepted bands.
 *
 * These are sanity rails, NOT defaults — nothing here is ever substituted for a
 * missing value. An APR above 100% or a term over 50 years is a typo or an
 * attack, and either way it must not reach a homeowner's screen.
 */
export const MAX_APR_PCT = 100;
export const MAX_TERM_MONTHS = 600;

/**
 * A finite number within [min, max], or null.
 *
 * Numbers and numeric strings only — a form posts strings, Prisma's Json
 * column hands back numbers, and everything else is refused rather than
 * coerced. That last part is the point: `Number([])`, `Number(null)`,
 * `Number("")` and `Number(false)` are all 0, so a lazier check would accept
 * an empty field, a missing key or an array as a real, stated 0% APR the
 * company never typed. Refusing the type outright also means no `valueOf` or
 * `Symbol.toPrimitive` on a hostile object ever runs, so this cannot throw.
 */
function boundedNumber(value, min, max) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/**
 * Validate a submitted APR / term pair for storage.
 *
 * All-or-nothing on purpose: a term with no rate, or a rate with no term,
 * cannot produce a payment, so storing half a pair would leave a settings
 * screen that looks filled in and a quote page that shows nothing. Either both
 * survive or neither does.
 *
 * @returns {{ aprPct: number|null, termMonths: number|null }}
 */
export function normaliseTerms(input) {
  const none = { aprPct: null, termMonths: null };
  if (!input || typeof input !== "object") return none;

  const aprPct = boundedNumber(input.aprPct, 0, MAX_APR_PCT);
  const termRaw = boundedNumber(input.termMonths, 1, MAX_TERM_MONTHS);
  if (aprPct === null || termRaw === null) return none;

  // Whole months only. A lender does not quote 12.5 payments, and rounding it
  // at display time would make the stored value and the shown value disagree.
  const termMonths = Math.round(termRaw);
  if (termMonths < 1) return none;

  // Two decimals is how APR is written everywhere a homeowner will check it
  // (9.99%, not 9.98999999999). Stored rounded so the settings screen reads
  // back exactly what the quote page computes from.
  return { aprPct: Math.round(aprPct * 100) / 100, termMonths };
}

/**
 * The terms a saved financing setting actually states, or null.
 *
 * Null is the common case and the safe one — see the hard rule above.
 *
 * @returns {{ aprPct: number, termMonths: number }|null}
 */
export function financingTerms(financing) {
  if (!financing || typeof financing !== "object") return null;
  const { aprPct, termMonths } = normaliseTerms(financing);
  return aprPct === null || termMonths === null ? null : { aprPct, termMonths };
}

/**
 * The standard amortised instalment, to the cent.
 *
 *   payment = P · r(1+r)^n / ((1+r)^n − 1)      r = APR/100/12, n = months
 *
 * @returns {number|null} null whenever the inputs don't describe a real loan.
 */
export function monthlyPayment(input) {
  // Destructuring in the signature with `= {}` only covers `undefined`, and
  // `monthlyPayment(null)` then threw — a TypeError out of the one function
  // whose contract is that it returns null instead of misbehaving.
  const { principal, aprPct, termMonths } =
    input && typeof input === "object" ? input : {};

  const p = boundedNumber(principal, 0, Number.MAX_SAFE_INTEGER);
  const apr = boundedNumber(aprPct, 0, MAX_APR_PCT);
  const nRaw = boundedNumber(termMonths, 1, MAX_TERM_MONTHS);
  if (p === null || apr === null || nRaw === null) return null;
  if (p <= 0) return null;

  const n = Math.round(nRaw);
  if (n < 1) return null;

  const r = apr / 100 / 12;

  // 0% APR is a real contractor offer ("0% for 12 months"), and it is also the
  // input that makes the amortisation formula divide by zero: at r = 0 the
  // denominator (1+r)^n − 1 is exactly 0. Straight division is the correct
  // answer, not a special case bolted on.
  //
  // The same guard catches a rate so small that (1+r)^n − 1 underflows to 0 in
  // floating point — 0.0000001% APR is arithmetically indistinguishable from
  // free money, and Infinity on a quote is worse than being a fraction of a
  // cent generous.
  const growth = Math.pow(1 + r, n);
  const denom = growth - 1;
  const payment =
    r <= 0 || !Number.isFinite(growth) || denom <= 0
      ? p / n
      : (p * (r * growth)) / denom;

  return cents(payment);
}

/**
 * A payment rounded to whole cents, or null.
 *
 * Null rather than 0 when the figure rounds away: a principal small enough that
 * the instalment is under half a cent produced "$0.00 a month", which reads as
 * "this is free" — a worse lie than showing nothing. Nothing is the honest
 * output for an amount too small to have an instalment.
 */
function cents(n) {
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return Number.isFinite(r) && r > 0 ? r : null;
}

/**
 * Everything a client-facing surface needs to show an instalment, or null.
 *
 * The single entry point for display code, so no page can accidentally assemble
 * a monthly figure out of a principal and a rate it found lying around.
 *
 * @param financing  the company's saved setting (may state terms, usually not)
 * @param amount     the figure being financed — the document total
 * @returns null, or { monthly, aprPct, termMonths }
 */
export function monthlyEstimate(financing, amount) {
  // Financing switched OFF means no figure, whatever terms are still saved.
  //
  // The public quote route already gates on financingOffer() returning null, so
  // nothing shipped broken. But this function is the one that produces the
  // NUMBER, and the number is the dangerous half — a company that turned
  // financing off still has an APR and a term sitting in their settings, and
  // the next caller to reach for this directly (the quote email has a seam
  // waiting for exactly that) would put a monthly payment on a document for a
  // company that has said it does not offer one.
  //
  // Guarding at the source rather than trusting every future caller to gate
  // first, because "remember to check enabled" is the kind of rule that holds
  // until the third caller.
  if (!financing || financing.enabled !== true) return null;
  const terms = financingTerms(financing);
  if (!terms) return null;
  const monthly = monthlyPayment({ principal: amount, ...terms });
  return monthly === null ? null : { monthly, ...terms };
}
