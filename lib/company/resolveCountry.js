// lib/company/resolveCountry.js
//
// Which country a record is in, when the country column is empty.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The billing page told a company "we need to know where your business is
// before we can show plans" while their full address — "1039 Bank St, Ottawa,
// ON K1X 1H4, Canada" — was displayed two screens away in Company Settings.
// The `country` column was null; everything needed to answer the question was
// sitting in the columns beside it.
//
// Three of twenty-nine companies are in that state, all Canadian, all with a
// Google-formatted address and a province code. They signed up before
// AddressAutocomplete's country component was carried through to the server,
// which is the same defect that left 55 client rows unable to resolve a tax
// rate.
//
// ══ Reading is not guessing ════════════════════════════════════════════════
//
// Every branch below READS something the record already states. Nothing infers
// a country from a phone number, a currency, a language or an IP address —
// those correlate with a country and do not state one, and a wrong answer here
// picks somebody's price. When nothing states it, this returns null and the
// caller asks. Absence of a statement is not a statement.
//
// `source` comes back with the answer so a screen can say WHERE it got it. A
// company being priced off a country nobody typed deserves to see that.

import { normaliseProvince } from "@/lib/tax/resolveTaxRate";
import { COUNTRIES } from "@/lib/currency";

/** Province codes that only exist in Canada. */
const CA_REGIONS = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

// Only the endings a formatted address actually carries. Deliberately not a
// list of every country name: this file resolves the two countries the product
// prices in, and a third appearing here without a price behind it would be a
// country we cannot sell to, answered confidently.
const ADDRESS_ENDINGS = [
  [/,\s*canada\s*$/i, "CA"],
  [/,\s*(usa|united states(\s+of\s+america)?)\s*$/i, "US"],
];

/**
 * @param {{country?, address?, province?, state?}} record — a Company or a
 *        Client. Both carry these fields under the same names, and the question
 *        is the same one, so this takes the fields rather than the model.
 * @returns {{ country: "CA"|"US"|null, source: "column"|"address"|"province"|null }}
 */
export function resolveCountry(record) {
  if (!record || typeof record !== "object") {
    return { country: null, source: null };
  }

  // 1. What somebody actually entered. Two-letter codes only — a `country`
  //    holding "Canada" is not a code, and normalising it here would hide that
  //    the column is being written wrongly somewhere upstream.
  const stated = String(record.country || "").trim().toUpperCase();
  if (stated === "CA" || stated === "US") {
    return { country: stated, source: "column" };
  }

  // 2. The formatted address. Google puts the country last, so this anchors to
  //    the END rather than searching anywhere in the string — "Canada Street,
  //    Buffalo, NY, USA" is in the United States, and a substring match would
  //    confidently say otherwise.
  const address = String(record.address || "").trim();
  for (const [pattern, code] of ADDRESS_ENDINGS) {
    if (pattern.test(address)) return { country: code, source: "address" };
  }

  // 3. The province. Only Canadian codes are read this way, and that asymmetry
  //    is deliberate: normaliseProvince recognises Canadian provinces, and a US
  //    state list here would collide with them (ON is Ontario; there is no ON
  //    state, but NB, NS and PE are close enough to other codes that guessing
  //    across two countries off two letters is not worth the one row it saves).
  const region = normaliseProvince(record.province ?? record.state);
  if (region && CA_REGIONS.has(region)) {
    return { country: "CA", source: "province" };
  }

  return { country: null, source: null };
}

// The countries a company can actually SAY it is in — the same eleven the
// signup form and the Company Settings select offer. A code outside the list is
// not read as a statement, for the reason lib/signup/funnel.js gives about the
// same set: "ZZ" in a hand-rolled POST body is not a country, and believing it
// puts a value in the column every later reader has to cope with.
const OFFERED = new Set(COUNTRIES.map((c) => c.code));

/**
 * What country the record STATES, whichever country that turns out to be.
 *
 * ══ Why this is not resolveCountry ═════════════════════════════════════════
 *
 * resolveCountry answers a narrower question — "which of the two countries we
 * PRICE IN is this record in" — and deliberately returns null for a British
 * company, because a third country in its endings table would be a country we
 * cannot sell to, answered confidently.
 *
 * A screen that is not choosing a price asks the wider question. The leave
 * templates have a United Kingdom set, so a British company that comes back as
 * null is shown three countries as an open question while its own is one of
 * them; and a screen that must say "we have no starter for Australia" cannot
 * say it if Australia comes back as null too. Both of those are the product
 * failing to read its own record, which is the defect resolveCountry was
 * written for in the first place.
 *
 * The column is read FIRST here, not after the address. It is the only one of
 * these fields a human picked from a list, so a company that chose Ireland
 * while its address still reads Ottawa has answered the question — and unlike
 * resolveCountry's column branch, this one can hear an answer that is neither
 * CA nor US. The address and province branches below it are resolveCountry's,
 * unchanged, and cover the rows whose column was never written at all.
 *
 * (lib/signup/funnel.js composes the identical rule for billing. It should call
 * this instead; it belongs to another change in flight and was left alone.)
 *
 * @returns {{ country: string|null, source: "column"|"address"|"province"|null }}
 */
export function statedCountry(record) {
  const stated = String(record?.country || "").trim().toUpperCase();
  if (OFFERED.has(stated)) return { country: stated, source: "column" };
  return resolveCountry(record);
}

// GB and UK are one country spelled by two standards. ISO-3166 and Google's
// address components say GB, so GB is what lands in Company.country; sets
// written by hand say UK, because that is what the thing is called. Kept as
// groups rather than a code->code map so neither spelling is privileged.
const SAME_COUNTRY = [["GB", "UK"]];

/**
 * Which key of a country-keyed set names this country, or null if none does.
 *
 * Exists because matching on the code alone would show a British company "we
 * have no starter set for the United Kingdom" with a United Kingdom template
 * sitting in the list underneath it. The key is returned exactly as the set
 * spells it, so the caller can index straight back into its own object.
 */
export function countryKeyIn(country, keys) {
  const code = String(country || "").trim().toUpperCase();
  if (!code || !Array.isArray(keys)) return null;
  const spellings = SAME_COUNTRY.find((g) => g.includes(code)) || [code];
  for (const key of keys) {
    if (spellings.includes(String(key || "").trim().toUpperCase())) return key;
  }
  return null;
}
