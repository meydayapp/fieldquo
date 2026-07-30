// lib/payroll/statutoryTemplates.js
//
// Starting points for a company's statutory deductions, per region.
//
// ── Read this before changing a number ──────────────────────────────────────
//
// These are PUBLISHED figures for the tax year named in `sourceYear`, offered so
// a company doesn't type five tax brackets from a PDF on day one. They are NOT
// FieldQuo's opinion about what anyone owes, and they are NOT kept current
// automatically — rates change every year, and provincial/state layers are not
// included at all.
//
// So the flow is deliberately: seed → the company (or its accountant) reviews
// and confirms → the values become the COMPANY's own SalaryComponent rows. After
// seeding, FieldQuo never silently changes them; an out-of-date rate is visible
// as an out-of-date `sourceYear` rather than quietly wrong maths.
//
// What's deliberately missing, and why:
//   • Provincial (CA) and state (US) income tax — 13 provinces × brackets and
//     50 states with wildly different regimes. A half-populated set is worse
//     than none: it looks complete and under-withholds.
//   • Employer-side contributions (CPP employer match, EI 1.4×, FUTA/SUTA,
//     employer NI). Those are a company cost, not an employee deduction, and
//     belong in job costing rather than on a payslip.
//   • CPP2, basic exemptions, personal allowance tapering, NI category letters.
//     Each is a real rule this simplified model does not express.
//
// A company with any complexity should have its accountant set the components.
// The UI says exactly that where these are offered.

export const STATUTORY_TEMPLATES = {
  CA: {
    label: "Canada",
    sourceYear: 2024,
    note:
      "Federal income tax brackets and the employee share of CPP/EI for 2024. " +
      "Provincial tax is NOT included — add your province's brackets as a " +
      "separate component. Confirm every figure with your accountant.",
    components: [
      {
        name: "Federal income tax",
        kind: "deduction",
        calculation: "slabs",
        statutory: true,
        // Published 2024 federal brackets.
        slabs: [
          { upTo: 55867, percent: 15 },
          { upTo: 111733, percent: 20.5 },
          { upTo: 173205, percent: 26 },
          { upTo: 246752, percent: 29 },
          { upTo: null, percent: 33 },
        ],
      },
      // Employee share only. Ignores the basic exemption and the YMPE ceiling,
      // which is why this is a starting point and not a filing.
      { name: "CPP", kind: "deduction", calculation: "percent", percent: 5.95, statutory: true },
      { name: "EI", kind: "deduction", calculation: "percent", percent: 1.66, statutory: true },
    ],
  },

  US: {
    label: "United States",
    sourceYear: 2024,
    note:
      "Federal income tax brackets for a single filer, plus the employee share " +
      "of Social Security and Medicare (FICA), 2024. State tax is NOT included, " +
      "and brackets differ by filing status. Confirm with your accountant.",
    components: [
      {
        name: "Federal income tax",
        kind: "deduction",
        calculation: "slabs",
        statutory: true,
        // Published 2024 single-filer brackets.
        slabs: [
          { upTo: 11600, percent: 10 },
          { upTo: 47150, percent: 12 },
          { upTo: 100525, percent: 22 },
          { upTo: 191950, percent: 24 },
          { upTo: 243725, percent: 32 },
          { upTo: 609350, percent: 35 },
          { upTo: null, percent: 37 },
        ],
      },
      // Ignores the Social Security wage base and the Additional Medicare
      // surcharge — both real rules a high earner will hit.
      { name: "Social Security", kind: "deduction", calculation: "percent", percent: 6.2, statutory: true },
      { name: "Medicare", kind: "deduction", calculation: "percent", percent: 1.45, statutory: true },
    ],
  },

  UK: {
    label: "United Kingdom",
    sourceYear: 2024,
    note:
      "PAYE income tax bands (2024/25, England/Wales/NI) with the personal " +
      "allowance as a 0% band, plus employee National Insurance. Scotland has " +
      "different bands, and the allowance tapers above £100k. Confirm with your " +
      "accountant.",
    components: [
      {
        name: "PAYE income tax",
        kind: "deduction",
        calculation: "slabs",
        statutory: true,
        // Personal allowance modelled as a 0% band so the maths is explicit
        // rather than hidden in an offset.
        slabs: [
          { upTo: 12570, percent: 0 },
          { upTo: 50270, percent: 20 },
          { upTo: 125140, percent: 40 },
          { upTo: null, percent: 45 },
        ],
      },
      // Class 1 employee NI, simplified: the real thing is banded with its own
      // thresholds and category letters.
      { name: "National Insurance", kind: "deduction", calculation: "percent", percent: 8, statutory: true },
    ],
  },
};

export const STATUTORY_REGIONS = Object.keys(STATUTORY_TEMPLATES);

/** Rows ready to insert as SalaryComponent for a company. Pure. */
export function templateComponentsFor(region, companyId) {
  const tpl = STATUTORY_TEMPLATES[region];
  if (!tpl || !companyId) return [];
  return tpl.components.map((c) => ({
    companyId,
    name: c.name,
    kind: c.kind,
    calculation: c.calculation,
    amount: c.amount ?? null,
    percent: c.percent ?? null,
    slabs: c.slabs ?? null,
    statutory: Boolean(c.statutory),
    region,
    // Statutory deductions apply to every employee unless someone removes them,
    // which is the correct default — forgetting to assign income tax to a new
    // hire should not silently pay them gross.
    appliesToAll: true,
  }));
}
