// lib/aiEmployee/disclosure.js
//
// Does the AI team tell clients, up front, that it's an AI?
//
// ══ The owner's rule (2026-09-22) ══════════════════════════════════════════
//
// The employee does not announce that it's an AI unless asked, EXCEPT where
// the law requires the announcement. So the company-wide setting
// (Company.aiDisclosure) defaults from the company's location: ON where a
// statute requires a bot to identify itself, OFF everywhere else. The owner
// can change it either way on Settings › AI employee, and the screen says in
// one line why it defaulted as it did.
//
// What never depends on this setting: the employee never claims to be a
// person and never denies being an AI when asked (lib/aiEmployee/roles.js,
// rule 5). That half is global, which also satisfies Utah's
// disclose-when-asked rule everywhere without anybody configuring anything.
//
// ══ The laws, as read on 2026-09-25 ════════════════════════════════════════
//
// Read from the statute text, not a summary. Where a primary source could not
// be fetched it says so.
//
// ON by default:
//
//   EU (27 member states) — Regulation (EU) 2024/1689 (AI Act), Art. 50(1):
//     providers must design an AI system that interacts directly with people
//     so they are informed they are interacting with an AI, unless obvious;
//     Art. 50(5): at the latest at the first interaction. Applies from
//     2 Aug 2026 (Art. 113). Regulation (EU) 2026/1744 (the "digital
//     omnibus", OJ 24 Jul 2026) postponed Art. 50(2) watermarking and the
//     high-risk rules, NOT Art. 50(1).
//     http://publications.europa.eu/resource/celex/32024R1689
//     http://publications.europa.eu/resource/celex/32026R1744
//   EEA (NO, IS, LI) — whether the AI Act has been incorporated into the EEA
//     Agreement was NOT verified. On anyway: the cost of an unneeded
//     disclosure is one sentence; the cost of a missing one is a breach.
//   US-CA — Cal. Bus. & Prof. Code §17941(a) (SB 1001, in force 1 Jul 2019):
//     unlawful to use a bot to communicate with a person in California online
//     with intent to mislead about its artificial identity in order to
//     incentivize a purchase or sale. §17941(b): no liability if the bot
//     discloses, clearly and conspicuously. The 10-million-visitor "online
//     platform" definition in §17940 feeds only §17942's platform carve-out;
//     it does not narrow §17941. The closer quotes to win a sale, so this is
//     the sales context the statute names.
//     https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17941
//   US-NJ — N.J.S.A. 56:18-2: "A person shall not use an online bot to
//     communicate or interact with a person in this State in connection with
//     the sale or advertisement of any merchandise or real estate … unless the
//     person discloses at the outset …". No intent test. (Read via FindLaw —
//     the NJ legislature site refused the connection.)
//     https://codes.findlaw.com/nj/title-56-trade-names-trademarks-and-unfair-trade-practices/nj-st-sect-56-18-2/
//   US-ME — 10 M.R.S. §1500-DD (PL 2025 c.294, formerly §1500-Y): a chatbot
//     used in trade may not mislead a reasonable consumer into believing they
//     are dealing with a human without clear and conspicuous notice; a breach
//     is an unfair trade practice.
//     https://legislature.maine.gov/statutes/10/title10sec1500-DD.html
//
// OFF by default (read, and found not to require it for this use):
//
//   US-UT — Utah Code §13-75-103 (SB 226, 2025): disclose when the consumer
//     clearly asks (rule 5 does, everywhere); proactive disclosure only for a
//     regulated occupation in a "high-risk" interaction (health, financial or
//     biometric data; financial/legal/medical/mental-health advice). Quoting
//     and booking a painter is neither.
//     https://le.utah.gov/Session/2025/bills/enrolled/SB0226.pdf
//   US-CO — SB 26-189 (signed 14 May 2026) repealed and re-enacted C.R.S.
//     6-1-1701 et seq., dropping the old §6-1-1704 general interaction notice;
//     what replaces it covers consequential decisions only.
//     https://leg.colorado.gov/bills/sb26-189
//   US-TX — HB 149 (TRAIGA) §552.051: government agencies and health care.
//   US-NY — GBL Art. 47: AI companions, excluding customer-service bots.
//   Canada — AIDA died with Bill C-27 on 6 Jan 2025 (parl.ca). Québec's Law
//     25 s.12.1 is about decisions made by automated processing, not chatbot
//     identity (NOT re-verified: the Québec statute site refused the fetch).
//   UK, Australia — no statute.
//
// ══ Whose location ═════════════════════════════════════════════════════════
//
// Most of these laws key on where the CONSUMER is ("a person in California",
// "a person in this State"), and the EU's on where the output is used. We
// default from the COMPANY's location because that is what we reliably know
// — a local contractor's clients are overwhelmingly where the contractor is —
// and the owner can switch it on for a company that sells across a border.
//
// A location we cannot read defaults ON, not off: "we don't know" is not
// "no law applies", and the cheap mistake is the extra sentence.

import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { normaliseProvince, normaliseUsState, regionFromAddressText } from "@/lib/tax/addressRegion";

const EU = Object.freeze([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);
const EEA = Object.freeze(["NO", "IS", "LI"]);

const AI_ACT = "EU AI Act, Art. 50(1)";

/** Whole countries where the default is ON, and the law's short name. */
export const DISCLOSURE_COUNTRIES = Object.freeze(
  Object.fromEntries([...EU.map((c) => [c, AI_ACT]), ...EEA.map((c) => [c, `${AI_ACT} (EEA)`])]),
);

/** Sub-national: "US-CA" → the law's short name. */
export const DISCLOSURE_REGIONS = Object.freeze({
  "US-CA": "Cal. Bus. & Prof. Code §17941",
  "US-NJ": "N.J.S.A. 56:18-2",
  "US-ME": "10 M.R.S. §1500-DD",
});

/** Countries whose rule (if any) is set per state/province, so an unknown
 *  region is an unknown answer. */
const REGIONAL_COUNTRIES = new Set(["US"]);

/** What the company row must carry for the answer — for every reader's select. */
export const DISCLOSURE_COMPANY_SELECT = Object.freeze({ country: true, province: true, address: true, aiDisclosure: true });

/**
 * Where the company is, from what its row states. Country from the column
 * (or the address's own ending); region from `province` — which holds the
 * state for a US company — or the formatted address.
 */
export function companyPlace(company = {}) {
  const fromAddress = regionFromAddressText(company?.address || "");
  const country = normaliseCountry(company?.country || "") || fromAddress.country || null;
  if (!country) return { country: null, region: null };
  let region = null;
  if (country === "US") region = normaliseUsState(company?.province) || (fromAddress.country === "US" ? fromAddress.region : null);
  else if (country === "CA") region = normaliseProvince(company?.province) || (fromAddress.country === "CA" ? fromAddress.region : null);
  return { country, region };
}

/**
 * The default for a location. Pure.
 *
 * @returns {{ required: boolean, reason: "required"|"not_required"|"unknown"|"unknown_region",
 *            law: string|null, place: { country, region } }}
 *   `required` is the DEFAULT: true where a statute requires disclosure, and
 *   true when we cannot tell (see the header). `reason` picks the screen's
 *   one-line explanation.
 */
export function disclosureDefault(place = {}) {
  const country = place?.country || null;
  const region = place?.region || null;
  if (!country) return { required: true, reason: "unknown", law: null, place: { country: null, region: null } };
  if (DISCLOSURE_COUNTRIES[country]) {
    return { required: true, reason: "required", law: DISCLOSURE_COUNTRIES[country], place: { country, region } };
  }
  if (REGIONAL_COUNTRIES.has(country)) {
    if (!region) return { required: true, reason: "unknown_region", law: null, place: { country, region } };
    const law = DISCLOSURE_REGIONS[`${country}-${region}`] || null;
    return law
      ? { required: true, reason: "required", law, place: { country, region } }
      : { required: false, reason: "not_required", law: null, place: { country, region } };
  }
  return { required: false, reason: "not_required", law: null, place: { country, region } };
}

/**
 * The whole answer for a company row: the default, the owner's choice, and
 * what is in force.
 *
 * @returns {{ on, setting: boolean|null, required, reason, law, place }}
 */
export function disclosureFor(company = {}) {
  const base = disclosureDefault(companyPlace(company));
  const setting = typeof company?.aiDisclosure === "boolean" ? company.aiDisclosure : null;
  return { ...base, setting, on: setting === null ? base.required : setting };
}

/** Does the first reply announce that it's an AI? */
export function discloseAi(company = {}) {
  return disclosureFor(company).on;
}
