// lib/tax/jurisdictions.js
//
// What the tax authority charges, by jurisdiction — the reference table
// lib/tax/resolveTaxRate.js falls back to when a company hasn't set up a rate
// of its own.
//
// ── This table never wins an argument with the contractor ──────────────────
//
// Everything here is a FALLBACK and a SUGGESTION. A rate the company typed
// under Settings → Tax always takes precedence, because they know their
// registrations, their exemptions and their clients and this file does not.
// See the precedence ladder in resolveTaxRate.js.
//
// ── The three regions are three different problems ─────────────────────────
//
// It would be tidy to present Canada, the United States and Europe as one
// table of "the rate for a place". They are not the same kind of fact, and
// flattening them would produce a number that is wrong in two of the three.
//
//   CANADA is determinable. GST/HST/PST/QST are set federally and
//   provincially, there is no municipal sales tax, and knowing the province is
//   genuinely enough to know the rate. Shipped, and applied automatically.
//
//   THE UNITED STATES is two questions, and this file answers only the first.
//   Sales tax is state + county + city + special district, there are over
//   12,000 taxing jurisdictions, and the rate turns on the delivery address
//   rather than the state. The rate question is answered by ZIP from
//   UsSalesTaxRate (lib/tax/usRates.js — the states' own published files,
//   loaded monthly), by the state alone where a state levies no local tax,
//   and by the state base rate WITH A SENTENCE SAYING SO everywhere else.
//   The second question — whether a renovation quote is a taxable sale at
//   all, because most states treat the contractor as the end consumer of
//   materials and do not tax labour on real property — is answered by
//   lib/tax/usTaxability.js, state by state, and the resolver applies the
//   rate only as that table allows. Neither table is applied without the
//   other, and neither is applied above a rate the company typed.
//
//   (Australia's GST sits in the VAT table: same problem, different name —
//   see the Australia entry below VAT_RATES' European rows.)
//
//   EUROPE is determinable but the question is different. For B2C services the
//   supplier's own country rate applies, not the customer's — so the lookup
//   keys on the COMPANY's country, not the client's. Construction and
//   renovation of dwellings qualifies for a REDUCED rate in many member
//   states, so applying the standard rate to a renovation quote overcharges.
//   And a contractor under the national registration threshold charges no VAT
//   at all, which is why `vatRegistered` gates the whole thing.
//
// ── Absence of a rate is not 0% ────────────────────────────────────────────
//
// Every lookup below returns a STATUS. When the jurisdiction is unknown, the
// country is missing, or the date predates the data, the status is "unknown"
// and the caller falls back to the company's own default — it does not fall
// back to zero. Zero is a claim ("this supply is not taxed") and this file is
// never in a position to make it.
//
// ── PROVENANCE ─────────────────────────────────────────────────────────────
//
// House style follows app/data/tradePriceBooks.js: every figure carries where
// it came from and when it took effect. `source` is a human-readable citation,
// not a URL, because the URLs rot and the publication names do not.
//
// Verified against the cited publications as of August 2026. Rates change on
// budget days; when one does, ADD a period rather than editing the old one —
// a quote written last March has to keep explaining the rate it was written
// at (see `asOf` below).

import { countryFromName } from "@/lib/tax/addressRegion";

/* ── Date handling ───────────────────────────────────────────────────────
 *
 * Each rate carries `effectiveFrom` and, once superseded, `effectiveTo`.
 * A lookup with an `asOf` date EARLIER than any period we hold returns
 * unknown rather than the oldest rate we happen to have. Reaching back past
 * the data and presenting today's number as history is exactly the invented
 * figure this file exists to avoid.
 */

/** Picks the period covering `asOf`. Null when the date is outside every period. */
function periodFor(periods, asOf) {
  const t = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(t)) return null;
  for (const p of periods) {
    const from = Date.parse(p.effectiveFrom);
    const to = p.effectiveTo ? Date.parse(p.effectiveTo) : Infinity;
    if (t >= from && t < to) return p;
  }
  return null;
}

/* ══ CANADA ══════════════════════════════════════════════════════════════
 *
 * The clean case. Thirteen provinces and territories, no municipal sales tax,
 * and the combined rate is fully determined by the province.
 *
 * Components are listed separately rather than as one blended number because
 * the breakdown is what the client's bookkeeper needs and what the invoice is
 * supposed to show. `total` is stored alongside and the check script asserts
 * the components sum to it — a stored total that silently disagreed with its
 * own parts is the failure mode this guards against.
 *
 * ── The real-property caveat, and why it is a note not a subtraction ──────
 *
 * In BC and Manitoba a contractor working on real property is treated as the
 * END CONSUMER of the materials: they pay PST/RST when they buy, and do not
 * charge it on the contract. So a BC renovation is very often 5% GST, not the
 * 12% below. Saskatchewan is the opposite — construction services there are
 * expressly taxable and PST goes on the contract.
 *
 * This file does NOT silently strip the provincial component in BC/MB,
 * because whether a given job is a real-property contract, a supply-and-
 * install of taxable goods, or a mix is a question about the job that FieldQuo
 * cannot answer from a quote. Guessing would swing a real invoice by 7%.
 * Instead the caution rides along with the rate and reaches the screen, and
 * the contractor — who does know — sets the rate. Same discipline as the rest
 * of this file: say what is known, name what isn't.
 */
const GST = { name: "GST", rate: 5, kind: "federal" };

export const CANADA_RATES = {
  AB: {
    label: "Alberta",
    periods: [
      {
        total: 5,
        components: [GST],
        effectiveFrom: "2008-01-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — no provincial sales tax in Alberta",
      },
    ],
  },
  BC: {
    label: "British Columbia",
    labelFr: "Colombie-Britannique",
    // See the real-property caveat above: PST is usually NOT charged on a
    // real-property contract, the contractor pays it on materials instead.
    cautionKey: "app.tax.caution.pstRealProperty",
    periods: [
      {
        total: 12,
        components: [GST, { name: "PST", rate: 7, kind: "provincial" }],
        effectiveFrom: "2013-04-01",
        effectiveTo: null,
        source: "BC Ministry of Finance, Provincial Sales Tax Act — PST reinstated at 7% 1 Apr 2013",
      },
    ],
  },
  MB: {
    label: "Manitoba",
    cautionKey: "app.tax.caution.pstRealProperty",
    periods: [
      {
        total: 12,
        components: [GST, { name: "RST", rate: 7, kind: "provincial" }],
        effectiveFrom: "2019-07-01",
        effectiveTo: null,
        source: "Manitoba Finance — Retail Sales Tax reduced from 8% to 7% on 1 Jul 2019",
      },
    ],
  },
  NB: {
    label: "New Brunswick",
    labelFr: "Nouveau-Brunswick",
    periods: [
      {
        total: 15,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 10, kind: "provincial" },
        ],
        effectiveFrom: "2016-07-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — NB HST raised to 15% on 1 Jul 2016",
      },
    ],
  },
  NL: {
    label: "Newfoundland and Labrador",
    labelFr: "Terre-Neuve-et-Labrador",
    periods: [
      {
        total: 15,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 10, kind: "provincial" },
        ],
        effectiveFrom: "2016-07-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — NL HST raised to 15% on 1 Jul 2016",
      },
    ],
  },
  NS: {
    label: "Nova Scotia",
    labelFr: "Nouvelle-Écosse",
    periods: [
      {
        total: 14,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 9, kind: "provincial" },
        ],
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
        source: "Nova Scotia Budget 2025 — provincial HST part cut from 10% to 9% on 1 Apr 2025",
      },
      // Kept so a quote written before the cut still explains 15%.
      {
        total: 15,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 10, kind: "provincial" },
        ],
        effectiveFrom: "2010-07-01",
        effectiveTo: "2025-04-01",
        source: "Canada Revenue Agency, GST/HST rates — NS HST 15% from 1 Jul 2010 to 31 Mar 2025",
      },
    ],
  },
  NT: {
    label: "Northwest Territories",
    labelFr: "Territoires du Nord-Ouest",
    periods: [
      {
        total: 5,
        components: [GST],
        effectiveFrom: "2008-01-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — no territorial sales tax",
      },
    ],
  },
  NU: {
    label: "Nunavut",
    periods: [
      {
        total: 5,
        components: [GST],
        effectiveFrom: "2008-01-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — no territorial sales tax",
      },
    ],
  },
  ON: {
    label: "Ontario",
    periods: [
      {
        total: 13,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 8, kind: "provincial" },
        ],
        effectiveFrom: "2010-07-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — ON HST introduced at 13% on 1 Jul 2010",
      },
    ],
  },
  PE: {
    label: "Prince Edward Island",
    labelFr: "Île-du-Prince-Édouard",
    periods: [
      {
        total: 15,
        components: [
          { name: "HST (federal part)", rate: 5, kind: "federal" },
          { name: "HST (provincial part)", rate: 10, kind: "provincial" },
        ],
        effectiveFrom: "2016-10-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — PE HST raised to 15% on 1 Oct 2016",
      },
    ],
  },
  QC: {
    label: "Quebec",
    labelFr: "Québec",
    periods: [
      {
        // 14.975%, not 15%. QST is applied to the pre-GST price (it was
        // compounded on GST until 2013), so the two are additive and the
        // combined figure keeps the third decimal. Rounding it to 15% here
        // would overcharge every Quebec job by 0.025%, which is small, wrong,
        // and would not reconcile against Revenu Québec.
        total: 14.975,
        components: [GST, { name: "QST/TVQ", rate: 9.975, kind: "provincial" }],
        effectiveFrom: "2013-01-01",
        effectiveTo: null,
        source: "Revenu Québec — QST set at 9.975% and de-compounded from GST on 1 Jan 2013",
      },
    ],
  },
  SK: {
    label: "Saskatchewan",
    // The opposite of BC/MB: construction services ARE taxable here, so the
    // provincial component belongs on the contract.
    cautionKey: "app.tax.caution.pstConstructionTaxable",
    periods: [
      {
        total: 11,
        components: [GST, { name: "PST", rate: 6, kind: "provincial" }],
        effectiveFrom: "2017-03-23",
        effectiveTo: null,
        source:
          "Saskatchewan Ministry of Finance, Bulletin PST-12 — PST raised to 6% and extended to construction services 23 Mar 2017",
      },
    ],
  },
  YT: {
    label: "Yukon",
    periods: [
      {
        total: 5,
        components: [GST],
        effectiveFrom: "2008-01-01",
        effectiveTo: null,
        source: "Canada Revenue Agency, GST/HST rates — no territorial sales tax",
      },
    ],
  },
};

/* ══ UNITED STATES ═══════════════════════════════════════════════════════
 *
 * STATE-LEVEL statutory general sales tax rates: the floor under every
 * address in the state. The combined rate for an address comes from
 * UsSalesTaxRate by ZIP (lib/tax/usRates.js); this table is what the
 * resolver falls back to when no ZIP row exists — and then the sentence on
 * the builder says "state rate only; county and city not known", never
 * presenting the floor as the rate.
 *
 *   `localTax: "none"`   the state levies no local sales tax, so the state
 *                        rate IS the combined rate for every address and no
 *                        ZIP row is needed. Each such row cites the statute.
 *   `uniformLocalRate`   a local rate levied at the same figure everywhere
 *                        in the state (Virginia's 1%, Utah's 1.25%, Hawaii's
 *                        0.5% county surcharge). Added to the floor so the
 *                        fallback never understates what every address pays.
 *
 * Whether construction work is a taxable sale at all is a different table:
 * lib/tax/usTaxability.js. Local rates are never encoded here as a "typical"
 * figure — an average is a rate nobody pays.
 *
 * Source for the state rates: Federation of Tax Administrators, "State Sales
 * Tax Rates" (January 2026), cross-checked against each state's department of
 * revenue rate schedule. The no-local-tax list: the same FTA table's
 * "local rates" column, cross-checked against the Sales Tax Institute's
 * state list, September 2026.
 */
const US_SOURCE =
  "Federation of Tax Administrators, State Sales Tax Rates, January 2026";
// The table above is the January 2026 schedule; a date before it gets
// "unknown", the same discipline as Canada's periods — a 2024 job imported
// after the fact must not be re-priced at this year's floor.
const US_SOURCE_FROM = "2026-01-01";

export const US_STATE_BASE_RATES = {
  AL: { label: "Alabama", stateRate: 4 },
  AK: { label: "Alaska", stateRate: 0, note: "no_state_tax_local_only" },
  AZ: { label: "Arizona", stateRate: 5.6, note: "gross_receipts" },
  AR: { label: "Arkansas", stateRate: 6.5 },
  CA: { label: "California", stateRate: 7.25 },
  CO: { label: "Colorado", stateRate: 2.9 },
  CT: { label: "Connecticut", stateRate: 6.35, localTax: "none" },
  DE: { label: "Delaware", stateRate: 0, note: "no_sales_tax", localTax: "none" },
  DC: { label: "District of Columbia", stateRate: 6, localTax: "none" },
  FL: { label: "Florida", stateRate: 6 },
  GA: { label: "Georgia", stateRate: 4 },
  // 4% GET plus the 0.5% county surcharge every county now levies (Maui
  // joined on 1 Jan 2024), so 4.5% is the floor everywhere.
  HI: { label: "Hawaii", stateRate: 4, note: "gross_receipts", uniformLocalRate: 0.5, localTax: "none" },
  ID: { label: "Idaho", stateRate: 6 },
  IL: { label: "Illinois", stateRate: 6.25 },
  IN: { label: "Indiana", stateRate: 7, localTax: "none" },
  IA: { label: "Iowa", stateRate: 6 },
  KS: { label: "Kansas", stateRate: 6.5 },
  KY: { label: "Kentucky", stateRate: 6, localTax: "none" },
  LA: { label: "Louisiana", stateRate: 5 },
  ME: { label: "Maine", stateRate: 5.5, localTax: "none" },
  MD: { label: "Maryland", stateRate: 6, localTax: "none" },
  MA: { label: "Massachusetts", stateRate: 6.25, localTax: "none" },
  MI: { label: "Michigan", stateRate: 6, localTax: "none" },
  MN: { label: "Minnesota", stateRate: 6.875 },
  MS: { label: "Mississippi", stateRate: 7 },
  MO: { label: "Missouri", stateRate: 4.225 },
  MT: { label: "Montana", stateRate: 0, note: "no_sales_tax", localTax: "none" },
  NE: { label: "Nebraska", stateRate: 5.5 },
  NV: { label: "Nevada", stateRate: 6.85 },
  NH: { label: "New Hampshire", stateRate: 0, note: "no_sales_tax", localTax: "none" },
  // Urban Enterprise Zone retailers charge half; that is a seller status,
  // not an address rate, and a contractor is not one.
  NJ: { label: "New Jersey", stateRate: 6.625, localTax: "none" },
  NM: { label: "New Mexico", stateRate: 4.875, note: "gross_receipts" },
  NY: { label: "New York", stateRate: 4 },
  NC: { label: "North Carolina", stateRate: 4.75 },
  ND: { label: "North Dakota", stateRate: 5 },
  OH: { label: "Ohio", stateRate: 5.75 },
  OK: { label: "Oklahoma", stateRate: 4.5 },
  OR: { label: "Oregon", stateRate: 0, note: "no_sales_tax", localTax: "none" },
  PA: { label: "Pennsylvania", stateRate: 6 },
  RI: { label: "Rhode Island", stateRate: 7, localTax: "none" },
  SC: { label: "South Carolina", stateRate: 6 },
  SD: { label: "South Dakota", stateRate: 4.2 },
  TN: { label: "Tennessee", stateRate: 7 },
  TX: { label: "Texas", stateRate: 6.25 },
  // 4.85% statutory, plus a 1.25% local rate levied statewide that most
  // published tables fold in as 6.1%. Kept apart so the sentence can name
  // both; `uniformLocalRate` puts the 1.25% back into the floor.
  UT: { label: "Utah", stateRate: 4.85, uniformLocalRate: 1.25 },
  VT: { label: "Vermont", stateRate: 6 },
  // Same shape as Utah: 4.3% state plus a 1% local rate levied everywhere.
  // Regional additions (Northern Virginia, Hampton Roads, Central Virginia)
  // sit on top and are NOT known here — the fallback sentence says so.
  VA: { label: "Virginia", stateRate: 4.3, uniformLocalRate: 1 },
  WA: { label: "Washington", stateRate: 6.5 },
  WV: { label: "West Virginia", stateRate: 6 },
  WI: { label: "Wisconsin", stateRate: 5 },
  WY: { label: "Wyoming", stateRate: 4 },
};

/* ══ EUROPE — VAT ════════════════════════════════════════════════════════
 *
 * `standard` is the country's standard VAT rate.
 *
 * `constructionReduced` is the reduced rate that applies to renovation,
 * repair or improvement of PRIVATE DWELLINGS under Annex III of the VAT
 * Directive (2006/112/EC) or a national derogation. It is null wherever the
 * member state does not operate one — an empty cell here is a real answer,
 * not a gap, and the standard rate applies.
 *
 * ── Why the reduced rate is offered rather than applied ───────────────────
 *
 * Every reduced rate below carries CONDITIONS: the dwelling has to be over a
 * certain age (2 years in France and the Netherlands, 10 in Belgium), the
 * materials portion has to stay under a threshold (Spain), or the property has
 * to sit inside a designated area (Portugal). FieldQuo knows none of that from
 * a quote. So `lookupVatRate` returns the reduced rate only when the caller
 * explicitly says the work is renovation of a dwelling, and the conditions
 * ride along as a note the contractor reads before sending. The quote builder
 * does not assume renovation on the contractor's behalf.
 *
 * ── Sweden and Iceland have no reduced rate here on purpose ───────────────
 *
 * Both support household renovation, but through an income-tax credit claimed
 * by the homeowner (Sweden's ROT deduction) or a VAT refund scheme (Iceland),
 * not through a reduced rate on the contractor's invoice. Putting a number in
 * `constructionReduced` for either would under-charge VAT on a real invoice.
 * The scheme is named in the note so the contractor knows it exists.
 *
 * Source for the whole table: European Commission, DG TAXUD, "VAT rates
 * applied in the Member States of the European Union" (2026 edition), and each
 * country's own tax authority for the reduced-rate conditions. Non-EU rows
 * (GB, NO, CH, IS) cite their national authority.
 *
 * `effectiveFrom` is when the STANDARD rate below took effect. A lookup for a
 * date before it returns unknown rather than back-dating today's rate.
 */
const EU_SOURCE =
  "European Commission DG TAXUD, VAT rates applied in the Member States of the European Union, 2026 edition";

export const VAT_RATES = {
  AT: {
    label: "Austria",
    labelFr: "Autriche",
    standard: 20,
    constructionReduced: null,
    effectiveFrom: "1984-01-01",
    source: EU_SOURCE,
  },
  BE: {
    label: "Belgium",
    labelFr: "Belgique",
    standard: 21,
    // Dwelling must be at least 10 years old and used as a private residence.
    constructionReduced: 6,
    reducedConditionKey: "app.tax.vatCondition.dwellingAge10",
    effectiveFrom: "1996-01-01",
    source: EU_SOURCE,
  },
  BG: {
    label: "Bulgaria",
    labelFr: "Bulgarie",
    standard: 20,
    constructionReduced: null,
    effectiveFrom: "1999-01-01",
    source: EU_SOURCE,
  },
  CY: {
    label: "Cyprus",
    labelFr: "Chypre",
    standard: 19,
    constructionReduced: 5,
    reducedConditionKey: "app.tax.vatCondition.privateResidence",
    effectiveFrom: "2014-01-13",
    source: EU_SOURCE,
  },
  CZ: {
    label: "Czechia",
    labelFr: "Tchéquie",
    standard: 21,
    // The two reduced rates were merged into a single 12% on 1 Jan 2024.
    constructionReduced: 12,
    reducedConditionKey: "app.tax.vatCondition.residentialBuilding",
    effectiveFrom: "2013-01-01",
    source: EU_SOURCE,
  },
  DE: {
    label: "Germany",
    labelFr: "Allemagne",
    standard: 19,
    constructionReduced: null,
    effectiveFrom: "2007-01-01",
    source: EU_SOURCE,
  },
  DK: {
    label: "Denmark",
    labelFr: "Danemark",
    // Denmark operates no reduced rates at all — the only member state that
    // does not. Null here is emphatically not a missing figure.
    standard: 25,
    constructionReduced: null,
    effectiveFrom: "1992-01-01",
    source: EU_SOURCE,
  },
  EE: {
    label: "Estonia",
    labelFr: "Estonie",
    standard: 24,
    constructionReduced: null,
    effectiveFrom: "2025-07-01",
    source: "Estonian Tax and Customs Board — standard VAT raised to 24% on 1 Jul 2025",
  },
  ES: {
    label: "Spain",
    labelFr: "Espagne",
    standard: 21,
    // Applies where the materials supplied are under 40% of the contract.
    constructionReduced: 10,
    reducedConditionKey: "app.tax.vatCondition.materialsUnder40",
    effectiveFrom: "2012-09-01",
    source: EU_SOURCE,
  },
  FI: {
    label: "Finland",
    labelFr: "Finlande",
    standard: 25.5,
    constructionReduced: null,
    effectiveFrom: "2024-09-01",
    source: "Finnish Tax Administration — standard VAT raised to 25.5% on 1 Sep 2024",
  },
  FR: {
    label: "France",
    standard: 20,
    // 10% for improvement work on dwellings completed over 2 years ago. A
    // further 5.5% applies to energy-renovation work specifically; it is not
    // encoded because qualifying turns on the equipment installed, which a
    // quote line does not reliably state.
    constructionReduced: 10,
    reducedConditionKey: "app.tax.vatCondition.dwellingAge2",
    effectiveFrom: "2014-01-01",
    source: EU_SOURCE,
  },
  GR: {
    label: "Greece",
    labelFr: "Grèce",
    standard: 24,
    constructionReduced: null,
    effectiveFrom: "2016-06-01",
    source: EU_SOURCE,
  },
  HR: {
    label: "Croatia",
    labelFr: "Croatie",
    standard: 25,
    constructionReduced: null,
    effectiveFrom: "2012-03-01",
    source: EU_SOURCE,
  },
  HU: {
    label: "Hungary",
    labelFr: "Hongrie",
    // Hungary's 5% rate is for the sale of NEW residential property, not for
    // renovation services, so it is not a construction-reduced rate and is
    // left null rather than borrowed.
    standard: 27,
    constructionReduced: null,
    effectiveFrom: "2012-01-01",
    source: EU_SOURCE,
  },
  IE: {
    label: "Ireland",
    labelFr: "Irlande",
    // Ireland's 13.5% reduced rate covers construction services generally
    // rather than renovation specifically — the broadest in the EU.
    standard: 23,
    constructionReduced: 13.5,
    reducedConditionKey: "app.tax.vatCondition.constructionServices",
    effectiveFrom: "2012-01-01",
    source: EU_SOURCE,
  },
  IT: {
    label: "Italy",
    labelFr: "Italie",
    standard: 22,
    constructionReduced: 10,
    reducedConditionKey: "app.tax.vatCondition.residentialBuilding",
    effectiveFrom: "2013-10-01",
    source: EU_SOURCE,
  },
  LT: {
    label: "Lithuania",
    labelFr: "Lituanie",
    standard: 21,
    constructionReduced: null,
    effectiveFrom: "2009-09-01",
    source: EU_SOURCE,
  },
  LU: {
    label: "Luxembourg",
    standard: 17,
    // The 3% super-reduced rate, for creating or renovating a main residence.
    constructionReduced: 3,
    reducedConditionKey: "app.tax.vatCondition.mainResidence",
    effectiveFrom: "2015-01-01",
    source: EU_SOURCE,
  },
  LV: {
    label: "Latvia",
    labelFr: "Lettonie",
    standard: 21,
    constructionReduced: null,
    effectiveFrom: "2012-07-01",
    source: EU_SOURCE,
  },
  MT: {
    label: "Malta",
    labelFr: "Malte",
    standard: 18,
    constructionReduced: 5,
    reducedConditionKey: "app.tax.vatCondition.privateResidence",
    effectiveFrom: "2004-01-01",
    source: EU_SOURCE,
  },
  NL: {
    label: "Netherlands",
    labelFr: "Pays-Bas",
    standard: 21,
    // Labour on dwellings completed over 2 years ago; materials stay at 21%.
    constructionReduced: 9,
    reducedConditionKey: "app.tax.vatCondition.dwellingAge2Labour",
    effectiveFrom: "2012-10-01",
    source: EU_SOURCE,
  },
  PL: {
    label: "Poland",
    labelFr: "Pologne",
    standard: 23,
    // Restricted to housing covered by the social housing programme, which
    // has floor-area limits (150 m² flats, 300 m² houses).
    constructionReduced: 8,
    reducedConditionKey: "app.tax.vatCondition.socialHousing",
    effectiveFrom: "2011-01-01",
    source: EU_SOURCE,
  },
  PT: {
    label: "Portugal",
    standard: 23,
    constructionReduced: 6,
    reducedConditionKey: "app.tax.vatCondition.urbanRehabilitation",
    effectiveFrom: "2011-01-01",
    source: EU_SOURCE,
  },
  RO: {
    label: "Romania",
    labelFr: "Roumanie",
    standard: 21,
    // Romania merged its reduced rates into a single 11% at the same time.
    constructionReduced: 11,
    reducedConditionKey: "app.tax.vatCondition.privateResidence",
    effectiveFrom: "2025-08-01",
    source: "Romanian Ministry of Finance — standard VAT raised to 21% and reduced rates merged at 11% on 1 Aug 2025",
  },
  SE: {
    label: "Sweden",
    labelFr: "Suède",
    // See the header: Sweden's ROT relief is an income-tax credit the
    // homeowner claims, not a reduced VAT rate on the invoice.
    standard: 25,
    constructionReduced: null,
    schemeNoteKey: "app.tax.vatScheme.rot",
    effectiveFrom: "1990-07-01",
    source: EU_SOURCE,
  },
  SI: {
    label: "Slovenia",
    labelFr: "Slovénie",
    standard: 22,
    constructionReduced: 9.5,
    reducedConditionKey: "app.tax.vatCondition.privateResidence",
    effectiveFrom: "2013-07-01",
    source: EU_SOURCE,
  },
  SK: {
    label: "Slovakia",
    labelFr: "Slovaquie",
    standard: 23,
    constructionReduced: null,
    effectiveFrom: "2025-01-01",
    source: "Slovak Financial Administration — standard VAT raised to 23% on 1 Jan 2025",
  },

  /* ── Europe outside the EU VAT area ────────────────────────────────────
   * Same practical shape for a contractor, different legal basis, so the
   * sources cite national authorities rather than the EU directive.
   */
  GB: {
    label: "United Kingdom",
    labelFr: "Royaume-Uni",
    standard: 20,
    // 5% applies to a narrow set of residential work — conversions that change
    // the number of dwellings, and homes empty for two years or more. It is
    // NOT a general renovation rate, which is why the condition key says so.
    constructionReduced: 5,
    reducedConditionKey: "app.tax.vatCondition.ukResidentialConversion",
    effectiveFrom: "2011-01-04",
    source: "HM Revenue & Customs, VAT Notice 708 — buildings and construction",
  },
  NO: {
    label: "Norway",
    labelFr: "Norvège",
    standard: 25,
    constructionReduced: null,
    effectiveFrom: "2005-01-01",
    source: "Norwegian Tax Administration (Skatteetaten) — standard VAT rate",
  },
  CH: {
    label: "Switzerland",
    labelFr: "Suisse",
    standard: 8.1,
    // The 2.6% reduced rate covers food, medicine and print — not building work.
    constructionReduced: null,
    effectiveFrom: "2024-01-01",
    source: "Swiss Federal Tax Administration — standard VAT raised to 8.1% on 1 Jan 2024",
  },
  LI: {
    label: "Liechtenstein",
    standard: 8.1,
    constructionReduced: null,
    effectiveFrom: "2024-01-01",
    source: "Liechtenstein applies Swiss VAT law under the customs and VAT union",
  },
  IS: {
    label: "Iceland",
    labelFr: "Islande",
    standard: 24,
    // See the header: Iceland refunds a share of the labour VAT on residential
    // building work to the homeowner rather than reducing the invoice rate.
    constructionReduced: null,
    schemeNoteKey: "app.tax.vatScheme.icelandRefund",
    effectiveFrom: "2015-01-01",
    source: "Iceland Revenue and Customs (Skatturinn) — standard VAT rate",
  },

  /* ── Australia: a value-added tax called GST ──────────────────────────
   *
   * In this table rather than a fourth region of its own because it is the
   * SAME problem as the VAT countries above, not a different one: a
   * value-added tax, charged by a supplier who is registered for it, at one
   * national rate, keyed on where the contractor is. What differs is only
   * the NAME — and the name matters, because "VAT 10% (Australia)" on an
   * Australian invoice reads as a foreign system's paperwork. `taxName`
   * carries it to every sentence (consumptionTaxName below; lib/tax/taxLine.js
   * and resolveTaxRate's notes pick the GST wording from it).
   *
   * Registration gates it exactly as VAT does, through the same
   * Company.vatRegistered column (asked as "Are you registered for GST?"):
   * registering is compulsory only at A$75,000 GST turnover (ATO, "Registering
   * for GST"), a sole trader below it charges none, and a business that is
   * not registered must not charge GST at all. Assuming registration would
   * put 10% on invoices a small contractor is not allowed to issue; assuming
   * none would drop 10% a registered one owes. Unanswered stays unknown.
   *
   * Exclusive, like every rate in this file: lib/quotes/totals.js adds the
   * rate on top of the ex-GST subtotal, and the total the client pays is the
   * GST-inclusive figure. The GST inside it is therefore total ÷ 11 to the
   * cent — which scripts/check-tax-jurisdictions.mjs asserts. There is no
   * "prices include tax" entry mode anywhere in the product (Canada and the
   * EU are exclusive too); that would be a builder feature, not a table row.
   *
   * No reduced rate: GST-free supplies (Div 38) are food, health, education
   * and the like — residential building and renovation work is fully taxable.
   */
  AU: {
    label: "Australia",
    labelFr: "Australie",
    taxName: "GST",
    standard: 10,
    constructionReduced: null,
    effectiveFrom: "2000-07-01",
    source:
      "Australian Taxation Office — A New Tax System (Goods and Services Tax) Act 1999, s 9-70: GST is 10% of the value of a taxable supply, in force 1 Jul 2000",
  },
};

/**
 * What the value-added tax is CALLED where this company works: "GST" for
 * Australia, "VAT" for every other row of VAT_RATES, null outside the table.
 * Read by every sentence that names the tax, so an Australian contractor is
 * asked about GST and shown "GST 10%", never "VAT".
 */
export function consumptionTaxName(country) {
  const code = typeof country === "string" ? country.trim().toUpperCase() : "";
  const entry = code ? own(VAT_RATES, code) : undefined;
  if (!entry) return null;
  return entry.taxName || "VAT";
}

/* ── Which region does a country belong to? ─────────────────────────────── */

/**
 * Countries whose rate this file can answer for, and how.
 *
 * Anything not listed resolves to unknown. That list is short on purpose: a
 * country is added here only once its table above is filled in and cited.
 */
export const SUPPORTED_COUNTRIES = { CA: "ca", US: "us" };
for (const code of Object.keys(VAT_RATES)) SUPPORTED_COUNTRIES[code] = "vat";

/**
 * Country names for the pickers, English only and deliberately so.
 *
 * These are proper nouns on a form control, not interface copy — the same
 * reason the language picker lists "Français" rather than "French". Running
 * them through the i18n catalogue would add 30-odd keys per language for
 * strings that are already recognisable to the person choosing one.
 */
export const COUNTRY_LABELS = { CA: "Canada", US: "United States" };
for (const [code, entry] of Object.entries(VAT_RATES)) {
  COUNTRY_LABELS[code] = entry.label;
}

/** Options for a country picker, alphabetical by name. */
export function supportedCountryOptions() {
  return Object.keys(SUPPORTED_COUNTRIES)
    .map((code) => ({ code, label: COUNTRY_LABELS[code] || code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * A jurisdiction's name in the reader's language.
 *
 * `labelFr` is present only where the French name actually DIFFERS — Ontario,
 * Manitoba, France and Portugal are spelled the same in both, and a duplicate
 * entry for each would be one more pair of strings to drift apart. Absence
 * here means "same in both", which is a real answer rather than a gap.
 *
 * US state names carry no French form on purpose. Most are identical or near
 * enough to read, the handful that differ (Californie, Pennsylvanie) sit inside
 * a note that already tells the contractor the figure is not their rate, and
 * shipping 51 half-checked translations would be the same half-verified matrix
 * this file declines to ship for US construction rules.
 */
function labelFor(entry, lang) {
  if (!entry) return "";
  return lang === "fr" && entry.labelFr ? entry.labelFr : entry.label;
}

/** Prototype-safe own-property read. Guards `__proto__`, `constructor` etc. */
function own(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * Normalises a country to ISO-3166 alpha-2, or null.
 *
 * Two letters in any case, plus the handful of NAMES the two countries we
 * hold province tables for arrive under — "Canada", "United States", "USA",
 * "États-Unis" (lib/tax/addressRegion.js keeps that list). It used to be two
 * letters only, on the argument that Google Places emits short_name and a
 * picker emits a code; but a hand-typed client record says "Canada", and a
 * client in Ottawa whose country column reads "Canada" was resolving to
 * "no country set" and losing its 13% (owner, 2026-09-21). Any other free
 * text is still null: no guessing at strings nobody validated.
 *
 * Shape only. Whether we hold RATES for the country is a separate question —
 * `countryIsSupported` answers that. Collapsing the two would report "MX" as
 * "no country set", which sends the contractor to fix a field that is already
 * correct.
 */
export function normaliseCountry(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(v)) return v;
  return countryFromName(v);
}

/**
 * Does this country operate VAT (as opposed to Canadian GST/HST or US sales
 * tax)? Drives whether the VAT-registration question is worth asking a
 * company at all.
 */
export function isVatJurisdiction(value) {
  const code = normaliseCountry(value);
  return Boolean(code && own(VAT_RATES, code));
}

/** Do we hold a rate table for this country? */
export function countryIsSupported(code) {
  return Boolean(code && own(SUPPORTED_COUNTRIES, code));
}

/* ── The lookups ─────────────────────────────────────────────────────────
 *
 * Each returns a tagged result. `status` is the only thing a caller should
 * branch on, and "unknown" is a first-class outcome rather than an error —
 * most of the time it is the correct answer.
 */

const UNKNOWN = (reason, extra = {}) => ({ status: "unknown", reason, ...extra });

/**
 * Canada. The one region where a rate is returned for automatic application.
 *
 * @param region  province/territory code, already normalised to two letters
 * @param asOf    Date or ISO string — which day's rate. Defaults to today.
 */
export function lookupCanadianRate(region, asOf = new Date(), lang = "en") {
  if (typeof region !== "string") return UNKNOWN("unknown_region");
  const entry = own(CANADA_RATES, region.trim().toUpperCase());
  if (!entry) return UNKNOWN("unknown_region");

  const period = periodFor(entry.periods, asOf);
  // A date we hold no period for. Returning the current rate here would
  // silently re-price a historical document, which is the thing this whole
  // effective-date apparatus exists to prevent.
  if (!period) return UNKNOWN("no_data_for_date", { label: labelFor(entry, lang) });

  return {
    status: "known",
    country: "CA",
    region: region.trim().toUpperCase(),
    label: labelFor(entry, lang),
    rate: period.total,
    components: period.components,
    effectiveFrom: period.effectiveFrom,
    source: period.source,
    cautionKey: entry.cautionKey || null,
  };
}

/**
 * United States: the combined rate for an address, as well as it is known.
 *
 * Three precisions, and the status names the difference so no caller can
 * mistake the floor for the rate:
 *
 *   "known" / precision "zip"            a UsSalesTaxRate row for the client's
 *                                        ZIP — the state's own published
 *                                        composition for that ZIP.
 *   "known" / precision "state_uniform"  the state levies no local sales tax,
 *                                        so the state rate is the rate.
 *   "state_only"                         no ZIP row and the state has local
 *                                        rates we do not hold. Carries the
 *                                        floor (state plus any uniform local
 *                                        rate) and a caution that MUST reach
 *                                        the screen. Applied, because the
 *                                        owner chose automation over a blank —
 *                                        but never silently.
 *
 * This is the RATE only. Whether it goes on the quote at all is
 * lib/tax/usTaxability.js's call, made in resolveTaxRate.
 *
 * @param region   two-letter state
 * @param zipRate  the client's UsSalesTaxRate row, if lib/tax/usRates.js
 *                 attached one. Ignored when its state disagrees with
 *                 `region` — a ZIP typed against the wrong state is not a
 *                 rate for either.
 * @param asOf     which day's rate. A ZIP row answers only from its
 *                 effectiveFrom; the state table only from January 2026.
 *                 Earlier dates are "unknown", never today's number.
 */
export function lookupUsRate(region, { zipRate = null, asOf = new Date(), lang = "en" } = {}) {
  if (typeof region !== "string") return UNKNOWN("unknown_region");
  const code = region.trim().toUpperCase();
  const entry = own(US_STATE_BASE_RATES, code);
  if (!entry) return UNKNOWN("unknown_region");
  const t = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(t) || t < Date.parse(US_SOURCE_FROM)) {
    return UNKNOWN("no_data_for_date", { country: "US", region: code, label: labelFor(entry, lang) });
  }

  const floor = Math.round((entry.stateRate + (entry.uniformLocalRate || 0)) * 10000) / 10000;
  const base = {
    country: "US",
    region: code,
    // English only — see labelFor().
    label: labelFor(entry, lang),
    stateRate: entry.stateRate,
    uniformLocalRate: entry.uniformLocalRate || 0,
    note: entry.note || null,
  };

  const zipFrom = zipRate?.effectiveFrom ? Date.parse(zipRate.effectiveFrom) : null;
  if (
    zipRate &&
    String(zipRate.state || "").toUpperCase() === code &&
    Number.isFinite(Number(zipRate.combinedRate)) &&
    (!Number.isFinite(zipFrom) || t >= zipFrom)
  ) {
    const combined = Number(zipRate.combinedRate);
    const stateRate = Number(zipRate.stateRate);
    const maxRate = zipRate.maxRate == null ? null : Number(zipRate.maxRate);
    return {
      status: "known",
      precision: "zip",
      ...base,
      rate: combined,
      zip: String(zipRate.zip),
      stateRate: Number.isFinite(stateRate) ? stateRate : entry.stateRate,
      localRate: Math.round((combined - (Number.isFinite(stateRate) ? stateRate : entry.stateRate)) * 10000) / 10000,
      maxRate: maxRate != null && maxRate > combined ? maxRate : null,
      zipSpansRates: Boolean(zipRate.zipSpansRates),
      effectiveFrom: zipRate.effectiveFrom || null,
      fetchedAt: zipRate.fetchedAt || null,
      source: zipRate.source || US_SOURCE,
      cautionKey: null,
    };
  }

  if (entry.localTax === "none") {
    return {
      status: "known",
      precision: "state_uniform",
      ...base,
      rate: floor,
      localRate: entry.uniformLocalRate || 0,
      source: US_SOURCE,
      cautionKey: null,
    };
  }

  return {
    status: "state_only",
    precision: "state_only",
    ...base,
    rate: floor,
    localRate: entry.uniformLocalRate || 0,
    source: US_SOURCE,
    // Not optional, and not a nicety. Every state-only path must say this.
    cautionKey: "app.tax.caution.usLocalNotIncluded",
  };
}

/**
 * Kept for the settings screen and older callers: the state floor as
 * information. Same row, no ZIP, no application.
 */
export function lookupUsStateBase(region, lang = "en") {
  const found = lookupUsRate(region, { lang, asOf: new Date() });
  if (found.status === "unknown") return found;
  return { ...found, status: "base_only", cautionKey: "app.tax.caution.usLocalNotIncluded" };
}

/**
 * VAT, keyed on the SUPPLIER's country.
 *
 * @param country        the COMPANY's country, not the client's — for B2C
 *                       services the place of supply is where the supplier is.
 * @param vatRegistered  true / false / null. Three states, and null is not
 *                       false: a company that has never answered is unknown,
 *                       whereas one that has said "below the threshold" is a
 *                       definite no-VAT answer. Padding null into either
 *                       direction is the invented-default failure this
 *                       codebase keeps finding.
 * @param workType       "renovation" to request the reduced rate. Anything
 *                       else gets the standard rate. Never inferred here.
 * @param asOf           which day's rate.
 */
export function lookupVatRate({
  country,
  vatRegistered = null,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  if (typeof country !== "string") return UNKNOWN("unknown_country");
  const code = country.trim().toUpperCase();
  const entry = own(VAT_RATES, code);
  if (!entry) return UNKNOWN("unknown_country");

  // "VAT" or "GST" — see the Australia entry. Carried on every result so
  // the screens name the tax the contractor actually registers for.
  const taxName = entry.taxName || "VAT";

  // Explicitly not registered: no VAT is charged, and that IS the answer —
  // a stated 0 with a reason, distinct from "we don't know" below.
  if (vatRegistered === false) {
    return {
      status: "not_registered",
      country: code,
      label: labelFor(entry, lang),
      taxName,
      rate: 0,
      source: entry.source,
      cautionKey: taxName === "GST" ? "app.tax.caution.gstNotRegistered" : "app.tax.caution.vatNotRegistered",
    };
  }

  // Never answered. Not registered, not zero, not the standard rate — unknown.
  if (vatRegistered !== true) {
    return UNKNOWN("vat_status_unknown", { country: code, label: labelFor(entry, lang), taxName });
  }

  const t = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(t) || t < Date.parse(entry.effectiveFrom)) {
    return UNKNOWN("no_data_for_date", { country: code, label: labelFor(entry, lang) });
  }

  const wantsReduced =
    workType === "renovation" && typeof entry.constructionReduced === "number";

  return {
    status: "known",
    country: code,
    label: labelFor(entry, lang),
    taxName,
    rate: wantsReduced ? entry.constructionReduced : entry.standard,
    standardRate: entry.standard,
    reducedRate:
      typeof entry.constructionReduced === "number"
        ? entry.constructionReduced
        : null,
    appliedReduced: wantsReduced,
    // The conditions attached to the reduced rate, so the contractor can check
    // the job actually qualifies before sending. Only present when a reduced
    // rate exists at all.
    reducedConditionKey: entry.reducedConditionKey || null,
    // A national relief scheme that is NOT a rate reduction (Sweden's ROT,
    // Iceland's refund). Named so nobody reads the null reduced rate as an
    // oversight.
    schemeNoteKey: entry.schemeNoteKey || null,
    effectiveFrom: entry.effectiveFrom,
    source: entry.source,
  };
}

/**
 * The one entry point callers should use: dispatches on country.
 *
 * @param clientCountry   where the CLIENT is (drives CA and US)
 * @param clientRegion    province / state
 * @param clientZipRate   the client's UsSalesTaxRate row, when one was
 *                        attached (lib/tax/usRates.js). US only.
 * @param companyCountry  where the COMPANY is (drives VAT — see lookupVatRate)
 * @param vatRegistered   the company's VAT status, three-state
 * @param workType        "renovation" to request an EU reduced rate
 * @param asOf            which day's rate
 * @param lang            which language to name the jurisdiction in
 */
export function lookupJurisdictionRate({
  clientCountry = null,
  clientRegion = null,
  clientZipRate = null,
  companyCountry = null,
  vatRegistered = null,
  workType = null,
  asOf = new Date(),
  lang = "en",
} = {}) {
  const client = normaliseCountry(clientCountry);

  // ── VAT first, and on the COMPANY's country ────────────────────────────
  //
  // Deliberately ahead of the client lookup. A Dutch contractor quoting a
  // Belgian homeowner charges Dutch VAT on a B2C service; resolving on the
  // client's country would hand them Belgium's 21% and the wrong return.
  const supplier = normaliseCountry(companyCountry);
  if (supplier && own(VAT_RATES, supplier)) {
    return lookupVatRate({ country: supplier, vatRegistered, workType, asOf, lang });
  }

  // The client is in a VAT country but we don't know where the CONTRACTOR is.
  // Falling through to the client's own rate here would be the exact mistake
  // the block above exists to avoid, so this refuses and names the missing
  // field — the fix is the company's address, not the client's.
  if (client && own(VAT_RATES, client)) {
    return UNKNOWN("supplier_country_unknown", { country: client });
  }

  // ── Otherwise the client's country decides ─────────────────────────────
  //
  // No country means no answer. "ON" alone is not a province — it is two
  // letters that could be anywhere, and assuming Canada because most tenants
  // are Canadian is precisely the guess this refuses to make. Every existing
  // client row has a null country, so this is also the common case, and it
  // must land on the company's own default rather than on a number.
  if (!client) return UNKNOWN("no_client_country");

  if (client === "CA") return lookupCanadianRate(clientRegion, asOf, lang);
  // Destination-based: the client's state and ZIP decide, whatever country
  // the COMPANY is in. A Canadian contractor quoting a Seattle address
  // collects Washington's rate, and this is where that happens.
  if (client === "US") return lookupUsRate(clientRegion, { zipRate: clientZipRate, asOf, lang });

  return UNKNOWN("unsupported_country", { country: client });
}
