// lib/tax/usTaxability.js
//
// Whether a US state puts sales tax on a contractor's quote at all — and on
// which part of it — one row per state plus DC.
//
// ── Why the rate table is not enough ─────────────────────────────────────────
//
// UsSalesTaxRate says what a delivery address in ZIP 10001 pays on a taxable
// sale: 8.875%. It does not say whether a kitchen renovation IS a taxable sale
// in New York, and in most states it is not. The contractor is treated as the
// end consumer of the materials — they pay tax at the lumber yard — and the
// labour of improving real property is not a taxable service. Putting 8.875%
// on that quote is not "collecting tax"; it is charging a homeowner a tax that
// nobody is owed, and in the states where the contractor should NOT be
// collecting, remitting it is its own problem.
//
// So every US rate passes through this table first, and the table answers:
//
//   labour     "exempt"   the contract charges no sales tax to the customer —
//                         a stated zero, with the reason on the document.
//              "taxable"  the whole contract is taxed at the address's rate
//                         (Washington, Hawaii, New Mexico) or at a fixed
//                         contractor's tax (South Dakota's 2%).
//              "depends"  the state taxes some jobs and not others, on a
//                         distinction only the estimator can make — capital
//                         improvement vs repair, residential vs commercial,
//                         construction vs landscaping. The row carries the
//                         QUESTION, its options, and which option is assumed
//                         until someone taps. Never silently picked: the
//                         assumption is printed beside the rate.
//   materials  "taxable_to_contractor"  tax was paid at purchase, it is a
//                                       cost inside the price, no tax line.
//              "taxable_to_customer"    tax on materials is charged to the
//                                       customer (as part of a taxed contract).
//
// A row's `applies` is what the resolver does with the rate: "all" (the whole
// taxable base), "none" (a stated zero), "share" (Arizona's 65% of gross), or
// "fixed" (South Dakota's 2% excise, whatever the sales-tax rate is).
//
// ── Lump-sum contracts, deliberately ─────────────────────────────────────────
//
// A FieldQuo quote prices work — "paint three rooms, $2,400" — not a parts
// list with labour separately stated. That is a lump-sum contract in every
// state's vocabulary, and the lump-sum rule is the one encoded here. Texas
// and Florida let a contractor write a "separated" or "retail sale plus
// installation" contract that itemises materials and charges tax on that
// line; a company that does so can say so under Settings → Tax with a
// per-state override, and the document then carries THEIR number. This table
// does not guess at a materials share it cannot see.
//
// ── Provenance ───────────────────────────────────────────────────────────────
//
// House style follows app/data/tradePriceBooks.js: a figure, a source, a
// date. `source` names the state publication. `checked` says whether the
// publication was fetched and read on 2026-09-19 ("fetched 2026-09-19") or
// the row rests on the publication as previously known ("publication;
// not re-fetched 2026-09"). Both are honest; only the first is verified this
// month, and the difference is printed nowhere client-facing — it is for the
// next person auditing this file.
//
// Trades this product serves and where the state rule turns on the trade:
// landscaping and lawn care are taxable services in AR, CT, KY, MN, NJ, OH,
// PA, TX and WI even though building work in those states is not. Those rows
// ask.

/**
 * The answers an estimator can give. One label each, in nine languages
 * (app.tax.us.option.*), shared across states so the vocabulary stays small.
 */
export const US_JOB_OPTIONS = Object.freeze([
  "capitalImprovement",
  "repair",
  "newConstruction",
  "residential",
  "commercialRemodel",
  "listedResidential",
  "otherResidential",
  "commercialProperty",
  "modification",
  "mrra",
  "commercial",
  "construction",
  "landscaping",
]);

const CONSUMER = "taxable_to_contractor";
const CUSTOMER = "taxable_to_customer";

const NONE = { applies: "none", materials: CONSUMER };
const ALL = { applies: "all", materials: CUSTOMER };

/** An option row: what the estimator taps, and what it does to the rate. */
const opt = (value, outcome) => ({ value, ...outcome });

/**
 * Capital improvement vs repair — the New York shape, shared by NJ, NC and WV.
 * Defaults to "repair" (taxed): a contractor who collects on a capital
 * improvement refunds a visible line; one who fails to collect on a repair
 * pays it themselves.
 */
const CAPITAL_VS_REPAIR = {
  options: [opt("capitalImprovement", NONE), opt("repair", ALL)],
  default: "repair",
};

/** Building work vs landscaping — the states that tax lawn and garden services. */
const CONSTRUCTION_VS_LANDSCAPING = {
  options: [opt("construction", NONE), opt("landscaping", ALL)],
  default: "construction",
};

export const US_TAXABILITY = Object.freeze({
  AL: {
    label: "Alabama", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials built into real property and pays tax when buying them; no sales tax is charged on the contract.",
    source: "Alabama Department of Revenue, Sales and Use Tax Rule 810-6-1-.46, Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  AK: {
    label: "Alaska", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "Alaska has no state sales tax. Some boroughs and cities levy their own and a few tax services; the state rate here is 0% and any municipal tax is the contractor's to add.",
    source: "Alaska Department of Commerce, Community and Economic Development, Alaska Taxable (annual); no state sales tax under AS 43",
    checked: "publication; not re-fetched 2026-09",
  },
  AZ: {
    label: "Arizona", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "Prime contracting (a modification — new build, addition, major alteration) owes transaction privilege tax on 65% of the gross contract; maintenance, repair, replacement and alteration (MRRA) work is not taxed and the contractor pays tax on materials at purchase.",
    source: "Arizona Department of Revenue, Transaction Privilege Tax — Contracting; A.R.S. § 42-5075 (35% standard labor deduction; MRRA exemption)",
    checked: "publication; not re-fetched 2026-09 (azdor.gov refused the fetch)",
    question: {
      options: [opt("mrra", NONE), opt("modification", { applies: "share", share: 0.65, materials: CUSTOMER })],
      default: "mrra",
    },
  },
  AR: {
    label: "Arkansas", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A contractor is the consumer of materials and charges no tax on real-property work; landscaping and lawn care are taxable services on the whole charge.",
    source: "Arkansas Department of Finance and Administration, Gross Receipts Tax Rules GR-21 (Contractors) and GR-9.13 (Landscaping and Lawn Care Services)",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  CA: {
    label: "California", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; installation labour is not taxable. A contractor is the RETAILER of fixtures (prefabricated cabinets, water heaters, HVAC units) and owes tax on their selling price — a job that is mostly fixtures needs a rate typed by hand.",
    source: "California Department of Tax and Fee Administration, Tax Guide for Construction Contractors — Industry Topics; Publication 9; Regulation 1521",
    checked: "fetched 2026-09-19",
  },
  CO: {
    label: "Colorado", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into real property; labour and lump-sum contracts are not taxed.",
    source: "Colorado Department of Revenue, Sales & Use Tax Topics: Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  CT: {
    label: "Connecticut", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "New construction is not taxed. On existing homes, paving, painting or staining, wallpapering, roofing, siding, exterior sheet-metal work and landscaping are taxable services at 6.35% on the whole charge; other residential renovation is not. Any work on commercial, industrial or income-producing property is taxable.",
    source: "Connecticut Department of Revenue Services, IP 2018(2) Building Contractors' Guide to Sales and Use Taxes; Special Notice 92(23); Conn. Gen. Stat. § 12-407(a)(37)(I)",
    checked: "fetched 2026-09-19 (via DRS search results; the IP itself is a PDF)",
    question: {
      options: [
        opt("listedResidential", ALL),
        opt("otherResidential", NONE),
        opt("commercialProperty", ALL),
        opt("newConstruction", NONE),
      ],
      default: "listedResidential",
    },
  },
  DE: {
    label: "Delaware", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "Delaware has no sales tax. Its contractor gross receipts tax is the contractor's own and is not charged to the customer.",
    source: "Delaware Division of Revenue, Contractors — Gross Receipts Tax; 30 Del. C. § 2501",
    checked: "publication; not re-fetched 2026-09",
  },
  DC: {
    label: "District of Columbia", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A real-property contractor is the consumer of materials and pays tax at purchase; construction labour is not a taxable service.",
    source: "DC Office of Tax and Revenue, Sales and Use Tax — Contractors; D.C. Code § 47-2001(n)(1)",
    checked: "publication; not re-fetched 2026-09",
  },
  FL: {
    label: "Florida", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "On a lump-sum real-property contract the contractor pays tax on materials at purchase and charges the customer nothing; labour installing or affixing property to real estate is exempt. Repairs to tangible personal property are taxable.",
    source: "Florida Department of Revenue, GT-800067 Sales and Use Tax on Construction, Improvements, Installations and Repairs",
    checked: "fetched 2026-09-19",
  },
  GA: {
    label: "Georgia", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials used in real-property work and pays tax on them; the contract is not taxed.",
    source: "Georgia Department of Revenue, Rule 560-12-2-.26 Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  HI: {
    label: "Hawaii", labour: "taxable", materials: CUSTOMER, applies: "all",
    reason: "grossReceipts",
    rule: "General excise tax applies to a contractor's gross contracting income — 4% state plus a 0.5% county surcharge in every county — and is customarily passed on; the visible pass-on may be up to 4.712% to cover the tax on the tax.",
    source: "Hawaii Department of Taxation, Tax Facts 96-1 General Excise vs. Sales Tax; Tax Facts 37-1 County Surcharge; HRS § 237-13(3)",
    checked: "publication; not re-fetched 2026-09",
  },
  ID: {
    label: "Idaho", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor improving real property is the consumer of materials and pays tax when buying them; the contract is not taxed.",
    source: "Idaho State Tax Commission, Contractors — Sales and Use Tax; Idaho Code § 63-3609",
    checked: "publication; not re-fetched 2026-09",
  },
  IL: {
    label: "Illinois", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A construction contractor is the end user of materials incorporated into real estate and pays tax at purchase; no tax is charged to the customer on the contract.",
    source: "Illinois Department of Revenue, 86 Ill. Adm. Code 130.1940 and 130.2075 (Construction Contractors)",
    checked: "publication; not re-fetched 2026-09",
  },
  IN: {
    label: "Indiana", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "On a lump-sum contract the contractor pays tax on materials at purchase and charges the customer nothing; a time-and-materials contract charges tax on the materials line only.",
    source: "Indiana Department of Revenue, Sales Tax Information Bulletin #60, Construction Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  IA: {
    label: "Iowa", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "Labour on new construction, reconstruction, alteration, expansion or remodeling is exempt; labour on repairs and installations that do not qualify is taxable on the whole charge. Contractors pay tax on materials at purchase either way.",
    source: "Iowa Department of Revenue, Iowa Contractors Guide",
    checked: "fetched 2026-09-19",
    question: {
      options: [opt("newConstruction", NONE), opt("repair", ALL)],
      default: "repair",
    },
  },
  KS: {
    label: "Kansas", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "Labour on original construction and on any residential work is exempt; labour on commercial remodel and repair is taxable on the whole charge. All contractors pay tax on materials at purchase.",
    source: "Kansas Department of Revenue, Publication KS-1525 Sales & Use Tax for Contractors, Subcontractors and Repairmen",
    checked: "fetched 2026-09-19",
    question: {
      options: [opt("residential", NONE), opt("newConstruction", NONE), opt("commercialRemodel", ALL)],
      default: "residential",
    },
  },
  KY: {
    label: "Kentucky", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A contractor is the consumer of materials and charges no tax on building work; landscaping and lawn care have been taxable services since July 2018.",
    source: "Kentucky Department of Revenue, Sales Tax Facts; KRS 139.200(2)(g) landscaping services",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  LA: {
    label: "Louisiana", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into immovable property; repairs to immovable property are not taxable services.",
    source: "Louisiana Department of Revenue, Contractors — Sales Tax; La. R.S. 47:301(3)",
    checked: "publication; not re-fetched 2026-09",
  },
  ME: {
    label: "Maine", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; labour on real property is not taxed.",
    source: "Maine Revenue Services, Instructional Bulletin No. 8, Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  MD: {
    label: "Maryland", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A real-property contractor pays tax on materials at purchase and charges no sales tax on the contract.",
    source: "Comptroller of Maryland, Sales and Use Tax — Contractors; Md. Code, Tax-Gen. § 11-101",
    checked: "publication; not re-fetched 2026-09",
  },
  MA: {
    label: "Massachusetts", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into real estate and pays tax at purchase; the contract is not taxed.",
    source: "Massachusetts Department of Revenue, 830 CMR 64H.1.1 Service Enterprises; Directive 92-1",
    checked: "publication; not re-fetched 2026-09",
  },
  MI: {
    label: "Michigan", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials affixed to real estate and pays tax at purchase; the contract is not taxed.",
    source: "Michigan Department of Treasury, Revenue Administrative Bulletin 2016-18, Sales and Use Tax — Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  MN: {
    label: "Minnesota", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A contractor pays tax on building materials at purchase and charges none on construction; lawn care, tree and shrub services are taxable on the whole charge.",
    source: "Minnesota Department of Revenue, Sales Tax Fact Sheet 128 Contractors and Building Materials; Fact Sheet 121A Lawn and Garden Maintenance, Tree and Shrub Services",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  MS: {
    label: "Mississippi", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "Residential construction is not taxed to the customer; the contractor pays tax on materials at purchase. Commercial contracts over $10,000 owe the 3.5% contractor's tax on the whole contract.",
    source: "Mississippi Department of Revenue, Contractor's Tax; Miss. Code Ann. § 27-65-21",
    checked: "publication; not re-fetched 2026-09",
    question: {
      options: [opt("residential", NONE), opt("commercial", { applies: "fixed", fixedRate: 3.5, materials: CUSTOMER })],
      default: "residential",
    },
  },
  MO: {
    label: "Missouri", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; labour on real property is not taxed.",
    source: "Missouri Department of Revenue, 12 CSR 10-112.010 Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  MT: {
    label: "Montana", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "Montana has no general sales tax.",
    source: "Montana Department of Revenue — no general sales tax",
    checked: "publication; not re-fetched 2026-09",
  },
  NE: {
    label: "Nebraska", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "An Option 1 contractor pays tax on materials at purchase and charges none on the contract; construction labour on real property is not taxable.",
    source: "Nebraska Department of Revenue, Information Guide — Contractors; Reg-1-017",
    checked: "publication; not re-fetched 2026-09",
  },
  NV: {
    label: "Nevada", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into real property and pays tax at purchase; the contract is not taxed.",
    source: "Nevada Department of Taxation, NAC 372.190 Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  NH: {
    label: "New Hampshire", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "New Hampshire has no sales tax.",
    source: "New Hampshire Department of Revenue Administration — no sales tax",
    checked: "publication; not re-fetched 2026-09",
  },
  NJ: {
    label: "New Jersey", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "A capital improvement (the customer gives Form ST-8) is not taxed and the contractor pays tax on materials at purchase; repair and maintenance work is taxable on the whole charge, and so is landscaping.",
    source: "New Jersey Division of Taxation, S&U-3 Contractors and New Jersey Taxes; N.J.S.A. 54:32B-3(b)(2) and (4)",
    checked: "publication; not re-fetched 2026-09",
    question: {
      options: [opt("capitalImprovement", NONE), opt("repair", ALL), opt("landscaping", ALL)],
      default: "repair",
    },
  },
  NM: {
    label: "New Mexico", labour: "taxable", materials: CUSTOMER, applies: "all",
    reason: "grossReceipts",
    rule: "Gross receipts tax applies to a contractor's whole receipts from construction services at the rate for the job's location, and is customarily passed on to the customer.",
    source: "New Mexico Taxation and Revenue Department, FYI-105 Gross Receipts and Compensating Taxes; NMSA 1978 § 7-9-4",
    checked: "publication; not re-fetched 2026-09",
  },
  NY: {
    label: "New York", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "A capital improvement (the customer gives Form ST-124) is not taxed and the contractor pays tax on materials at purchase; repair, maintenance and installation services are taxable on the whole charge.",
    source: "New York State Department of Taxation and Finance, Tax Bulletin ST-104 Capital Improvements; Publication 862",
    checked: "fetched 2026-09-19",
    question: CAPITAL_VS_REPAIR,
  },
  NC: {
    label: "North Carolina", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "A real property contract for a capital improvement (Form E-589CI) is not taxed and the contractor pays tax on materials at purchase; repair, maintenance and installation services to real property are taxable on the whole charge.",
    source: "North Carolina Department of Revenue, Real Property Contracts; Repair, Maintenance, and Installation Services; Form E-589CI",
    checked: "fetched 2026-09-19 (via NCDOR search results)",
    question: CAPITAL_VS_REPAIR,
  },
  ND: {
    label: "North Dakota", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials installed into real property and pays tax at purchase; the contract is not taxed.",
    source: "North Dakota Office of State Tax Commissioner, Sales Tax Guideline — Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  OH: {
    label: "Ohio", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A construction contractor is the consumer of materials incorporated into real property and charges no tax on the contract; landscaping, lawn care and snow removal are taxable services on the whole charge.",
    source: "Ohio Department of Taxation, Information Release ST 1999-01 Construction Contracts; R.C. 5739.01(B)(3)(g) landscaping and lawn care service",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  OK: {
    label: "Oklahoma", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; labour on real property is not taxed.",
    source: "Oklahoma Tax Commission, OAC 710:65-7-13 Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  OR: {
    label: "Oregon", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "Oregon has no sales tax.",
    source: "Oregon Department of Revenue — no sales tax",
    checked: "publication; not re-fetched 2026-09",
  },
  PA: {
    label: "Pennsylvania", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A construction contractor pays tax on materials at purchase and charges none on the contract; lawn care services (mowing, fertilizing, aerating) are taxable on the whole charge.",
    source: "Pennsylvania Department of Revenue, 61 Pa. Code §§ 31.11–31.16 Contractors; § 55.6 Lawn Care Services",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  RI: {
    label: "Rhode Island", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into real property and pays tax at purchase; the contract is not taxed.",
    source: "Rhode Island Division of Taxation, Regulation SU 07-53 Contractors and Subcontractors",
    checked: "publication; not re-fetched 2026-09",
  },
  SC: {
    label: "South Carolina", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; the real-property contract is not taxed.",
    source: "South Carolina Department of Revenue, Regulation 117-314 Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  SD: {
    label: "South Dakota", labour: "taxable", materials: CONSUMER, applies: "fixed", fixedRate: 2,
    reason: "contractorExcise",
    rule: "Realty improvement contracts owe the 2% contractor's excise tax on gross receipts, whatever the local sales-tax rate; the contractor also pays sales tax on materials at purchase.",
    source: "South Dakota Department of Revenue, Contractor's Excise Tax Guide; SDCL ch. 10-46A",
    checked: "publication; not re-fetched 2026-09",
  },
  TN: {
    label: "Tennessee", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; labour on real property is not taxed.",
    source: "Tennessee Department of Revenue, Sales and Use Tax Manual — Contractors; Tenn. Code Ann. § 67-6-209",
    checked: "publication; not re-fetched 2026-09",
  },
  TX: {
    label: "Texas", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "Under a lump-sum contract for residential work or new construction the contractor pays tax on materials at purchase and charges the customer nothing. Remodeling or repairing nonresidential property is taxable on the total charge, and so are landscaping and lawn care.",
    source: "Texas Comptroller, Publication 94-116 Real Property Repair and Remodeling; Publication 94-112 Landscaping and Lawn Care Services",
    checked: "fetched 2026-09-19",
    question: {
      options: [opt("residential", NONE), opt("newConstruction", NONE), opt("commercialRemodel", ALL), opt("landscaping", ALL)],
      default: "residential",
    },
  },
  UT: {
    label: "Utah", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A real-property contractor is the consumer of materials and pays tax at purchase; labour converting property to real property is not taxed.",
    source: "Utah State Tax Commission, Publication 42 Sales Tax Information for Construction Contractors",
    checked: "publication; not re-fetched 2026-09",
  },
  VT: {
    label: "Vermont", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials incorporated into real property and pays tax at purchase; the contract is not taxed.",
    source: "Vermont Department of Taxes, Contractors — Sales and Use Tax fact sheet",
    checked: "publication; not re-fetched 2026-09",
  },
  VA: {
    label: "Virginia", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A real-property contractor is the consumer of materials and pays tax at purchase; the contract is not taxed.",
    source: "Virginia Department of Taxation, Contractors; Va. Code § 58.1-610",
    checked: "publication; not re-fetched 2026-09",
  },
  WA: {
    label: "Washington", labour: "taxable", materials: CUSTOMER, applies: "all",
    rule: "Custom construction on real property is a retail sale: the contractor collects retail sales tax on the full contract price — labour, materials, profit and subcontractors — at the job site's rate, and buys materials with a reseller permit.",
    source: "Washington Department of Revenue, Construction industry guide — Custom construction; Reseller permits for contractors",
    checked: "fetched 2026-09-19 (via DOR search results)",
  },
  WV: {
    label: "West Virginia", labour: "depends", materials: CONSUMER, applies: "all",
    rule: "Contracting for a capital improvement to real property is exempt (the contractor pays tax on materials); repair and maintenance that is not a capital improvement is a taxable service on the whole charge.",
    source: "West Virginia Tax Division, Publication TSD-310 Capital Improvement Rule — Sales and Use Tax for Construction Trades",
    checked: "publication; not re-fetched 2026-09",
    question: CAPITAL_VS_REPAIR,
  },
  WI: {
    label: "Wisconsin", labour: "depends", materials: CONSUMER, applies: "none",
    rule: "A contractor is the consumer of materials used in real-property construction and charges no tax on the contract; landscaping and lawn maintenance services are taxable on the whole charge.",
    source: "Wisconsin Department of Revenue, Publication 207 Sales and Use Tax Information for Contractors; Publication 210 Landscaping and Lawn Maintenance",
    checked: "publication; not re-fetched 2026-09",
    question: CONSTRUCTION_VS_LANDSCAPING,
  },
  WY: {
    label: "Wyoming", labour: "exempt", materials: CONSUMER, ...NONE,
    rule: "A contractor is the consumer of materials and pays tax at purchase; services to real property are not taxed.",
    source: "Wyoming Department of Revenue, Excise Tax Division — Contractors bulletin; W.S. 39-15-103",
    checked: "publication; not re-fetched 2026-09",
  },
});

export const US_STATES = Object.freeze(Object.keys(US_TAXABILITY));

function own(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/** The row for a state, or null. Accepts "ny", " NY ". */
export function usTaxabilityFor(state) {
  if (typeof state !== "string") return null;
  return own(US_TAXABILITY, state.trim().toUpperCase()) || null;
}

/**
 * What applies to THIS job in this state, given the estimator's answer.
 *
 * @param state   two-letter state
 * @param answer  one of US_JOB_OPTIONS, or null when nobody has answered
 * @returns {{
 *   applies: "all"|"none"|"share"|"fixed", share?: number, fixedRate?: number,
 *   materials: string, labour: string, question: object|null,
 *   answer: string|null, assumedAnswer: boolean,
 * }|null}
 *   `assumedAnswer` is true when the row has a question and `answer` was null
 *   — the default was used, and every surface that shows the rate must say
 *   so. It is never true for a state without a question.
 */
export function usJobTreatment(state, answer = null) {
  const row = usTaxabilityFor(state);
  if (!row) return null;
  const base = {
    labour: row.labour,
    materials: row.materials,
    question: row.question || null,
    // A state whose "why" is not the generic one — a gross-receipts tax, a
    // contractor's excise — names its own reason key.
    reason: row.reason || null,
  };
  if (!row.question) {
    return {
      ...base,
      applies: row.applies,
      share: row.share ?? null,
      fixedRate: row.fixedRate ?? null,
      answer: null,
      assumedAnswer: false,
    };
  }
  const chosen =
    (answer && row.question.options.find((o) => o.value === answer)) || null;
  const picked = chosen || row.question.options.find((o) => o.value === row.question.default);
  return {
    ...base,
    applies: picked.applies,
    share: picked.share ?? null,
    fixedRate: picked.fixedRate ?? null,
    materials: picked.materials,
    answer: picked.value,
    assumedAnswer: !chosen,
  };
}

/** Counts for the report and the check script: { exempt, taxable, depends }. */
export function usTaxabilitySummary() {
  const out = { exempt: 0, taxable: 0, depends: 0 };
  for (const row of Object.values(US_TAXABILITY)) out[row.labour]++;
  return out;
}
