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
