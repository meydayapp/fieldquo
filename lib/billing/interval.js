// lib/billing/interval.js
//
// How often a subscription is charged, and what it costs on that cadence.
//
// ══ Why this is its own module ═════════════════════════════════════════════
//
// Three places need the same answer and none of them may disagree: the signup
// plan step (which offers the choice), /api/companies (which reprices it from
// its own rows, because the browser never sends money — non-negotiable #5), and
// lib/platform/stripeBilling.js (which builds the Stripe line). Before this,
// stripeBilling.js carried `recurring: { interval: "month" }` as a literal in
// two places, so any screen offering an annual option would have taken the
// commitment and billed monthly — a control that appears to work, with money
// attached.
//
// Pure, so the whole thing is executable from a check script.
//
// ══ Annual is the INTERVAL, not a discount ═════════════════════════════════
//
// The owner's decision: "the 1 yr commitment is just billed annually instead of
// the no commitment." Same rate. `Plan.priceAnnual` is seeded at twelve times
// the monthly figure for exactly that reason, so `annualSaving()` returns 0 and
// no screen may claim otherwise. The function exists anyway — if an operator
// ever types a real annual discount into /platform/billing/plans, the number
// they typed is the one that gets shown, rather than a badge somebody hardcoded.
//
// ══ Null means "no annual option", not "free" ══════════════════════════════
//
// `Plan.priceAnnual` is nullable and the platform console's own hint says blank
// = this tier has no annual option. A bespoke "Custom (N employees)" row is
// created without one. So a null (or a zero, which Stripe would reject anyway)
// means the yearly cadence is not on offer for that plan, and the caller must
// REFUSE rather than quietly fall back to monthly.

const round2 = (n) => Math.round(n * 100) / 100;

/** The cadences a subscription may be sold on. */
export const BILLING_INTERVALS = ["month", "year"];

/** Is this one of them? Anything else is refused, never coerced. */
export function isBillingInterval(value) {
  return value === "month" || value === "year";
}

/** The default cadence when a caller says nothing — what every existing
 *  subscription is on. Absence of a choice is "monthly", which is the option
 *  with no commitment attached, so it is the safe thing to assume. */
export const DEFAULT_INTERVAL = "month";

function money(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  // Prisma Decimal stringifies; Number() handles both it and a plain number.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return round2(n);
}

/** The monthly price, or null when the row carries no usable one. */
export function monthlyPriceOf(plan) {
  return plan ? money(plan.priceMonthly) : null;
}

/** The annual price, or null when this tier has no annual option. */
export function annualPriceOf(plan) {
  return plan ? money(plan.priceAnnual) : null;
}

/** Can this plan be bought on this cadence? */
export function supportsInterval(plan, interval) {
  return priceOnInterval(plan, interval) !== null;
}

function priceOnInterval(plan, interval) {
  if (interval === "year") return annualPriceOf(plan);
  if (interval === "month") return monthlyPriceOf(plan);
  return null;
}

/**
 * What one subscription line costs on this cadence.
 *
 * Returns null when the plan cannot be sold that way. Callers must treat null
 * as a refusal — falling back to the other cadence is the exact failure this
 * module exists to prevent, because the screen would still say "1 year
 * commitment" while Stripe charged by the month.
 *
 * @returns {{ interval, amount, unitAmountCents }|null}
 */
export function chargeFor(plan, interval = DEFAULT_INTERVAL) {
  if (!isBillingInterval(interval)) return null;
  const amount = priceOnInterval(plan, interval);
  if (amount === null) return null;
  return {
    interval,
    amount,
    // Stripe wants the smallest currency unit. Rounded here rather than at each
    // call site so the two checkout builders cannot drift by a cent.
    unitAmountCents: Math.round(amount * 100),
  };
}

/**
 * How much the year costs less than twelve months of the monthly price.
 *
 * Two months on the current ladder — see ANNUAL_FREE_MONTHS. It WAS zero, when
 * the year was billed at the same rate; the owner corrected that, because a
 * commitment which saves nothing asks a customer to give up flexibility for
 * nothing and is therefore never taken.
 *
 * Returns null when either price is missing — "we cannot compare" is not "no
 * saving", and a screen printing "save $0" because a column was blank would be
 * inventing a statement.
 */
export function annualSaving(plan) {
  const m = monthlyPriceOf(plan);
  const a = annualPriceOf(plan);
  if (m === null || a === null) return null;
  return round2(m * 12 - a);
}
