// lib/tax/addressRegion.js
//
// Which province or state a line of address text names — "755 Rue
// Saint-Louis, Gatineau, QC J8T 1A1, Canada" → { country: "CA", region: "QC" }.
//
// ── Why a parser, when the client record has columns ────────────────────────
//
// Services on real property are taxed where the PROPERTY is, not where the
// person who ordered them lives (CRA place-of-supply rules, Schedule IX Part
// IV of the Excise Tax Act; every US state with a sales tax is likewise
// destination-based). Quote.siteAddress is where the property is, and it is
// ONE string — the Places autocomplete hands the builder structured parts,
// but only the formatted line is stored, and every quote written before the
// column existed carries a client whose address is likewise one line with
// no province or country beside it (55 rows in production, zero with a
// country, on the day scripts/check-address-fields.mjs was written). Reading
// the province back out of the text is the only way either of those can
// answer, and Google's formatted line is regular enough that it is a fact
// about the address rather than a guess about it.
//
// ── What it will and will not conclude ──────────────────────────────────────
//
// It answers only when the text carries something that names a province or
// state on its own: the full name in English, French or Spanish, or the
// two-letter code in UPPER CASE as its own token. "on" in lower case is a
// word; "ON" between commas or beside a postal code is Ontario. A Canadian
// postal code (A1A 1A1) settles the country as Canada; a five-digit ZIP
// settles it as the United States; the country's own name at the end does
// the same. Canadian province codes and US state codes do not overlap, so a
// recognised code also settles the country by itself.
//
// Anything else — a street with no city, a city with no province, a code we
// do not know — returns nulls, and the caller falls to the next source. It
// never returns a region without the country that goes with it: half a
// jurisdiction is the thing lib/tax/resolveTaxRate.js refuses to price.
//
// Pure; scripts/check-tax-auto.mjs executes it against hostile input.

import { US_TAXABILITY } from "@/lib/tax/usTaxability";

/**
 * The 13 provinces and territories with the names people type: the code,
 * English, French (Google's `fr` locale and Quebec's own forms), and the
 * short forms that appear on envelopes. Lower case; matched whole.
 */
export const CA_PROVINCE_ALIASES = Object.freeze({
  AB: ["ab", "alberta", "alta"],
  BC: ["bc", "british columbia", "colombie-britannique", "colombie britannique", "c.-b."],
  MB: ["mb", "manitoba", "man"],
  NB: ["nb", "new brunswick", "nouveau-brunswick", "nouveau brunswick", "n.-b."],
  NL: ["nl", "newfoundland", "labrador", "newfoundland and labrador", "terre-neuve", "terre-neuve-et-labrador", "terre neuve", "nfld"],
  NS: ["ns", "nova scotia", "nouvelle-écosse", "nouvelle-ecosse", "nouvelle écosse", "n.-é."],
  NT: ["nt", "northwest territories", "territoires du nord-ouest", "nwt", "t.n.-o."],
  NU: ["nu", "nunavut"],
  ON: ["on", "ontario", "ont"],
  PE: ["pe", "pei", "prince edward island", "prince edward", "île-du-prince-édouard", "ile-du-prince-edouard", "î.-p.-é."],
  QC: ["qc", "quebec", "québec", "pq", "que"],
  SK: ["sk", "saskatchewan", "sask"],
  YT: ["yt", "yukon", "yukon territory"],
});

/** "Québec", "quebec", "QC", "Colombie-Britannique" → the code. Null otherwise. */
export function normaliseProvince(value) {
  const v = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return null;
  for (const [code, aliases] of Object.entries(CA_PROVINCE_ALIASES)) {
    if (aliases.includes(v)) return code;
  }
  return null;
}

/** Spanish and French names the US-state table does not carry. */
const US_STATE_EXTRA_ALIASES = Object.freeze({
  CA: ["californie"],
  FL: ["floride"],
  NY: ["nueva york"],
  NM: ["nuevo méxico", "nuevo mexico", "nouveau-mexique"],
  NC: ["caroline du nord", "carolina del norte"],
  SC: ["caroline du sud", "carolina del sur"],
  ND: ["dakota du nord", "dakota del norte"],
  SD: ["dakota du sud", "dakota del sur"],
  WV: ["virginie-occidentale", "virginia occidental"],
  VA: ["virginie"],
  PA: ["pennsylvanie", "pensilvania"],
  LA: ["louisiane", "luisiana"],
  GA: ["géorgie"],
  HI: ["hawaï", "hawái"],
  NJ: ["nueva jersey"],
  NH: ["nuevo hampshire"],
  DC: ["district of columbia", "washington dc", "washington, d.c.", "washington d.c."],
});

/** "Texas", "tx", "TX", "Californie" → the code. Null when not a US state. */
export function normaliseUsState(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, " ");
  if (Object.prototype.hasOwnProperty.call(US_TAXABILITY, upper)) return upper;
  const byName = Object.entries(US_TAXABILITY).find(([, row]) => row.label.toUpperCase() === upper);
  if (byName) return byName[0];
  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  for (const [code, aliases] of Object.entries(US_STATE_EXTRA_ALIASES)) {
    if (aliases.includes(lower)) return code;
  }
  return null;
}

/**
 * The names a country arrives under. ISO alpha-2 is what the autocomplete
 * stores; the words are what a hand-typed record or an address line ends in.
 */
const COUNTRY_ALIASES = Object.freeze({
  CA: ["ca", "can", "canada"],
  US: ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "états-unis", "etats-unis", "estados unidos", "eeuu", "ee. uu.", "ee.uu."],
});

/** Any ISO alpha-2 as typed, upper-cased; null otherwise. */
function normaliseTwoLetter(value) {
  const v = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

/** "Canada", "USA", "United States", "CA" → "CA" / "US". Null otherwise. */
export function countryFromName(value) {
  const v = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return null;
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(v)) return code;
  }
  return null;
}

const CA_POSTAL = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
const US_ZIP = /\b(\d{5})(?:-\d{4})?\b/;

/**
 * @param text  one address line, as the autocomplete formats it or as a
 *              human typed it
 * @returns {{ country: "CA"|"US"|null, region: string|null, postalCode: string|null,
 *            countryEvidence: "word"|"postal"|"code"|null }}
 *          region is the two-letter province or state, always with its
 *          country; both null when the text does not name one.
 *          `countryEvidence` says what settled the country: the country's
 *          own name, a postal code, or only the region code — the last is
 *          the weakest, and a caller may decline to cross a border on it.
 */
export function regionFromAddressText(text) {
  const none = { country: null, region: null, postalCode: null, countryEvidence: null };
  const line = String(text || "").replace(/\s+/g, " ").trim();
  if (!line) return none;

  // ── What the postal code says about the country ─────────────────────────
  const caPostal = line.match(CA_POSTAL);
  const postalCode = caPostal
    ? caPostal[0].toUpperCase().replace(/[ -]?(\d[A-Z]\d)$/, " $1")
    : null;
  // A ZIP is only read at the END of a line (optionally before the country
  // word), the same rule lib/tax/usRates.js applies: "1555 Barton Springs
  // Rd" must not yield 01555, and a Canadian house number never reads as one.
  const zipMatch = !caPostal
    ? line.match(/\b(\d{5})(?:-\d{4})?\s*(?:,?\s*(?:usa|us|u\.s\.a?\.?|united states(?: of america)?|états-unis|etats-unis|estados unidos))?\s*$/i)
    : null;
  const zip = zipMatch ? zipMatch[1] : null;

  // ── Tokens, last first: the province sits after the city, before the
  //    postal code and the country ────────────────────────────────────────
  const parts = line
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let countryWord = null;
  const last = parts[parts.length - 1];
  if (parts.length > 1 && countryFromName(last)) {
    countryWord = countryFromName(last);
    parts.pop();
  }

  let region = null;
  let regionCountry = null;
  for (let i = parts.length - 1; i >= 0 && !region; i--) {
    // Strip the postal code and ZIP off the token: "ON K1A 0B1" → "ON",
    // "TX 78704" → "TX".
    const token = parts[i]
      .replace(CA_POSTAL, " ")
      .replace(US_ZIP, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!token) continue;
    const found = regionFromToken(token);
    if (found) {
      region = found.region;
      regionCountry = found.country;
    }
  }

  const country = regionCountry || countryWord || (caPostal ? "CA" : zip ? "US" : null);
  // A region whose country contradicts the postal code or the country word
  // is two facts that disagree; nothing is returned rather than one of them.
  if (region && countryWord && countryWord !== regionCountry) return { ...none, postalCode: postalCode || zip };
  if (region && regionCountry === "CA" && zip && !caPostal) return { ...none, postalCode: zip };
  if (region && regionCountry === "US" && caPostal) return { ...none, postalCode };

  return {
    country: region ? country : null,
    region: region || null,
    postalCode: postalCode || zip || null,
    countryEvidence: !region ? null : countryWord ? "word" : caPostal || zip ? "postal" : "code",
  };
}

/**
 * One comma-separated token → its province or state. Full names match in
 * any case; a two-letter code only in UPPER CASE and only as the whole
 * token or its last word ("Gatineau QC"), because "on", "in", "or", "me",
 * "hi" and "de" are words that appear in street names.
 */
function regionFromToken(token) {
  const whole = token.trim();
  const ca = normaliseProvince(whole);
  if (ca && (whole.length > 2 || whole === whole.toUpperCase())) return { country: "CA", region: ca };
  const us = normaliseUsState(whole);
  if (us && (whole.length > 2 || whole === whole.toUpperCase())) return { country: "US", region: us };

  // "Gatineau QC" / "Austin TX" — the city and the code in one token.
  const words = whole.split(" ");
  if (words.length >= 2) {
    const tail = words[words.length - 1];
    if (/^[A-Z]{2}$/.test(tail)) {
      const caTail = normaliseProvince(tail);
      if (caTail) return { country: "CA", region: caTail };
      const usTail = normaliseUsState(tail);
      if (usTail) return { country: "US", region: usTail };
    }
    // "Ottawa Ontario" / "Ciudad Juárez Texas" — a full name as the tail.
    for (let n = 1; n < words.length; n++) {
      const tailName = words.slice(words.length - n).join(" ");
      const caName = normaliseProvince(tailName);
      if (caName && tailName.length > 2) return { country: "CA", region: caName };
      const usName = normaliseUsState(tailName);
      if (usName && tailName.length > 2) return { country: "US", region: usName };
    }
  }
  return null;
}

/**
 * The client record's own jurisdiction, read the same forgiving way: the
 * columns first (`province` + `country`, in any of the spellings above), and
 * when a column is missing, the address line. A province with no country
 * column is accepted when the province itself settles the country — "ON" is
 * Ontario and nowhere else, "TX" is Texas — because the codes of the two
 * tables do not overlap. A region that is not one of those 64 stays
 * unknown.
 *
 * @param companyCountry  the company's own country, when known. A province
 *                        with NO country column is read as that province's
 *                        country only when it does not cross a border the
 *                        company has not said it works across: "ON" on a
 *                        Canadian company's client is Ontario; on a Texas
 *                        company's client it is two letters somebody typed,
 *                        and the record stays unknown rather than putting
 *                        Canadian HST on a Texas quote.
 *
 * @returns {{ country, region, postalCode, from: "columns"|"address"|null }}
 */
export function regionFromClientRecord(client, { companyCountry = null } = {}) {
  const none = { country: null, region: null, postalCode: null, from: null };
  if (!client || typeof client !== "object") return none;
  const home = countryFromName(companyCountry) || normaliseTwoLetter(companyCountry);
  const mayInfer = (inferred) => !home || home === inferred;

  const provinceRaw = String(client.province || "").trim();
  const countryRaw = String(client.country || "").trim();
  const country = countryFromName(countryRaw);
  const ca = normaliseProvince(provinceRaw);
  const us = normaliseUsState(provinceRaw);

  if (country === "CA" && ca) return { country: "CA", region: ca, postalCode: client.postalCode || null, from: "columns" };
  if (country === "US" && us) return { country: "US", region: us, postalCode: client.postalCode || null, from: "columns" };
  // A country we hold no province table for: the country is still a fact
  // the caller can use (VAT countries resolve on the supplier), the region
  // is whatever was typed.
  if (country && country !== "CA" && country !== "US") {
    return { country, region: provinceRaw || null, postalCode: client.postalCode || null, from: "columns" };
  }
  if (!country && provinceRaw) {
    // The province alone, when it can only be one country's — and only on
    // the company's own side of the border (see `companyCountry`).
    if (ca && !us && mayInfer("CA")) return { country: "CA", region: ca, postalCode: client.postalCode || null, from: "columns" };
    if (us && !ca && mayInfer("US")) return { country: "US", region: us, postalCode: client.postalCode || null, from: "columns" };
  }

  const fromText = regionFromAddressText(client.address);
  if (fromText.region) {
    // A country column that disagrees with the address line is not
    // resolved here — two facts, no tie-break. And a line whose country
    // rests on the region code alone gets the same border rule as the
    // column above; a postal code or the country's name is evidence enough.
    if (country && country !== fromText.country) return none;
    if (!country && fromText.countryEvidence === "code" && !mayInfer(fromText.country)) {
      return none;
    }
    return { country: fromText.country, region: fromText.region, postalCode: fromText.postalCode, from: "address" };
  }
  // Country known, region not: still worth returning for the VAT and
  // "unknown region" branches, which name the country in their sentence.
  if (country) return { country, region: null, postalCode: client.postalCode || null, from: "columns" };
  return none;
}
