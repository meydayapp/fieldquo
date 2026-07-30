// lib/leave/policyTemplates.js
//
// Starter leave policies per region. These are STARTING POINTS a company edits,
// not compliance advice — statutory minimums vary by province/state and by how
// long someone has been employed, and several of them scale with service years
// in ways a single number can't express.
//
// What each set deliberately does NOT claim:
//
//   CA — vacation is 2 weeks (4%) federally and in most provinces, rising to 3
//        weeks after 5 years (6%) in several, and Saskatchewan starts at 3.
//        Statutory holidays are separate and not modelled here. Paid sick leave
//        exists federally (10 days) and in BC (5) but not everywhere.
//   US — there is NO federal paid vacation or sick leave entitlement. The
//        numbers below are common private-sector practice, nothing more. State
//        and city sick-leave mandates are not modelled.
//   UK — 5.6 weeks (28 days) including bank holidays is the statutory minimum.
//        Statutory Sick Pay is a payment scheme with waiting days and a flat
//        weekly rate, not a leave allowance, so sick leave is listed unpaid by
//        default and left to the company to set.
//
// The comment above is the point of this file: a company that seeds these sees
// what was assumed, rather than inheriting invented defaults.

export const LEAVE_TEMPLATES = {
  CA: {
    label: "Canada",
    sourceYear: 2024,
    note: "Vacation shown as 4% accrual (the federal/most-provinces 2-week minimum). Rises to 6% after 5 years in several provinces — adjust per employee's service.",
    policies: [
      {
        name: "Vacation pay (4%)",
        kind: "vacation",
        paid: true,
        accrualMethod: "percent_of_gross",
        percentOfGross: 4,
        carryoverMaxDays: null,
        requiresApproval: true,
      },
      {
        name: "Vacation days",
        kind: "vacation",
        paid: true,
        accrualMethod: "per_period",
        annualDays: 10,
        carryoverMaxDays: 5,
        requiresApproval: true,
      },
      {
        name: "Paid sick leave",
        kind: "sick",
        paid: true,
        accrualMethod: "per_period",
        annualDays: 10,
        carryoverMaxDays: 0,
        requiresApproval: false,
      },
      {
        name: "Unpaid leave",
        kind: "unpaid",
        paid: false,
        accrualMethod: "annual_allotment",
        annualDays: 0,
        carryoverMaxDays: 0,
        requiresApproval: true,
      },
    ],
  },

  US: {
    label: "United States",
    sourceYear: 2024,
    note: "No federal paid-leave entitlement exists. These are common practice figures — check your state and city sick-leave rules.",
    policies: [
      {
        name: "PTO",
        kind: "vacation",
        paid: true,
        accrualMethod: "per_period",
        annualDays: 10,
        carryoverMaxDays: 5,
        requiresApproval: true,
      },
      {
        name: "Sick leave",
        kind: "sick",
        paid: true,
        accrualMethod: "per_period",
        annualDays: 5,
        carryoverMaxDays: 0,
        requiresApproval: false,
      },
      {
        name: "Unpaid leave",
        kind: "unpaid",
        paid: false,
        accrualMethod: "annual_allotment",
        annualDays: 0,
        carryoverMaxDays: 0,
        requiresApproval: true,
      },
    ],
  },

  UK: {
    label: "United Kingdom",
    sourceYear: 2024,
    note: "28 days is the 5.6-week statutory minimum and INCLUDES bank holidays. Statutory Sick Pay is a payment scheme, not an allowance — set your own sick policy.",
    policies: [
      {
        name: "Annual leave",
        kind: "vacation",
        paid: true,
        accrualMethod: "per_period",
        annualDays: 28,
        carryoverMaxDays: 8,
        requiresApproval: true,
      },
      {
        name: "Sick leave",
        kind: "sick",
        paid: false,
        accrualMethod: "annual_allotment",
        annualDays: 0,
        carryoverMaxDays: 0,
        requiresApproval: false,
      },
      {
        name: "Unpaid leave",
        kind: "unpaid",
        paid: false,
        accrualMethod: "annual_allotment",
        annualDays: 0,
        carryoverMaxDays: 0,
        requiresApproval: true,
      },
    ],
  },
};

export const LEAVE_REGIONS = Object.keys(LEAVE_TEMPLATES);

export const LEAVE_KINDS = ["vacation", "sick", "personal", "unpaid", "other"];

export function templatePoliciesFor(region, companyId) {
  const t = LEAVE_TEMPLATES[region];
  if (!t) return [];
  return t.policies.map((p) => ({ ...p, companyId, active: true }));
}
