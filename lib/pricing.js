// lib/pricing.js

// Tier boundaries, from your spec:
// 1–9 employees:   $45/license flat
// 10 employees:    $400 flat  ($40/license)
// 11–19:           linear blend from $40 down to $35/license
// 20 employees:    $700 flat  ($35/license)
// 21–40:           $35/license flat (same rate as the 20-employee tier)
// 41+:             no self-serve price — contact sales

// ── The first month is free ────────────────────────────────────────────────
//
// Was $1. A token charge is the worst of both worlds: it doesn't pay for
// anything, and it still puts a card form and a "why am I being charged?"
// between a contractor and the thing they came to try. Free removes the
// question entirely.
//
// Zero is load-bearing downstream, not just a number — see
// lib/platform/stripeBilling.js, which now omits the one-time line item
// altogether rather than sending Stripe a $0 charge (Stripe rejects a zero
// unit_amount on a one-time line, so a naive change here would break checkout).
export const TRIAL_PRICE = 0;

/**
 * How to WRITE the first-month price.
 *
 * "$0 first month" is technically correct and reads like a bug. Free is the
 * offer, so it has to say Free. One helper because three screens print this and
 * they were already drifting — two of them hardcoded `1` and would have gone on
 * charging a dollar on screen after the real price changed here.
 */
export function trialLabel(amount = TRIAL_PRICE) {
  return amount > 0 ? `$${amount} first month` : "Free first month";
}

export function calculatePricing(employeeCount) {
  const count = Math.max(1, Math.floor(employeeCount || 1));

  if (count > 40) {
    return {
      employeeCount: count,
      contactSalesRequired: true,
      perLicense: null,
      monthlyTotal: null,
      trialTotal: TRIAL_PRICE,
    };
  }

  let perLicense;

  if (count <= 9) {
    perLicense = 45;
  } else if (count <= 20) {
    // Linear interpolation between $40 (at 10) and $35 (at 20)
    perLicense = 40 - (count - 10) * 0.5;
  } else {
    // 21–40
    perLicense = 35;
  }

  const monthlyTotal = Math.round(perLicense * count * 100) / 100;

  return {
    employeeCount: count,
    contactSalesRequired: false,
    perLicense: Math.round(perLicense * 100) / 100,
    monthlyTotal,
    trialTotal: TRIAL_PRICE,
  };
}

// The three named, promoted tiers — used for the fixed pricing cards.
// "Custom" isn't in this list; it's the free-form employeeCount input.
export const NAMED_TIERS = [
  { key: "starter", label: "1 Employee", employeeCount: 1, popular: false },
  { key: "team10", label: "10 Employees", employeeCount: 10, popular: true },
  { key: "team20", label: "20 Employees", employeeCount: 20, popular: false },
];
