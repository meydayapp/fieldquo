// lib/pricing.js

// Tier boundaries, from your spec:
// 1–9 employees:   $45/license flat
// 10 employees:    $400 flat  ($40/license)
// 11–19:           linear blend from $40 down to $35/license
// 20 employees:    $700 flat  ($35/license)
// 21–40:           $35/license flat (same rate as the 20-employee tier)
// 41+:             no self-serve price — contact sales

const TRIAL_PRICE = 1; // first month, flat, any tier

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
