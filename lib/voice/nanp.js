// lib/voice/nanp.js
//
// Which country a North American number belongs to. No dependencies, on purpose.
//
// ══ Why this is its own file ══════════════════════════════════════════════
//
// These two functions were written inside lib/voice/numberSearch.js, which
// imports the Twilio SDK. The crew-lines panel is a client component, so
// importing one function from there pulled `pg` and `dns` into the browser
// bundle and the build failed outright — which is the good version of that
// mistake, because the bad version ships a server SDK to a browser.
//
// Pure arithmetic over three digits and two letters. Both sides import it,
// numberSearch re-exports it so its own callers do not have to move, and
// scripts/check-number-country.mjs drives it without a network.

/**
 * Canadian NANP area codes.
 *
 * ══ Why this list exists ══════════════════════════════════════════════════
 *
 * The platform's number search defaulted to `country: "CA"` and the panel that
 * calls it has no country selector, so EVERY search was Canadian. The owner
 * searched 716 for a list of 1,683 Buffalo contractors and got "no numbers free
 * in 716 right now" — while 819 and 343 worked, because those are Canadian. The
 * inventory was there the whole time; Twilio was simply being asked the wrong
 * country, and the answer it gave back was indistinguishable from an empty one.
 *
 * A selector would have fixed it and left the same trap set: somebody picks
 * Canada, types a US area code, and gets a true-sounding "none available". The
 * country is not a preference — a NANP area code belongs to exactly one
 * country, and it is derivable. So it is derived.
 *
 * The list is the geographic Canadian codes in service. Non-geographic ones
 * (600, 622) are excluded: nothing local can be bought on them, so treating one
 * as Canadian would only produce a confident empty answer of a different kind.
 * Anything else in NANP resolves to US, which is right for the United States
 * and wrong for the Caribbean members — Jamaica's 876, Bahamas' 242 — and that
 * is a knowing limit rather than a gap: FieldQuo sells in the US and Canada,
 * and a search for a Barbados number returning US inventory is a wrong answer
 * nobody will ask for. `country` may still be passed to override.
 */
export const CANADIAN_AREA_CODES = Object.freeze([
  "204", "226", "236", "249", "250", "263", "289", "306", "343", "354",
  "365", "367", "368", "382", "387", "403", "416", "418", "428", "431",
  "437", "438", "450", "468", "474", "506", "514", "519", "548", "579",
  "581", "584", "587", "604", "613", "639", "647", "672", "683", "705",
  "709", "742", "753", "778", "780", "782", "807", "819", "825", "867",
  "873", "879", "902", "905",
]);

const CANADIAN = new Set(CANADIAN_AREA_CODES);

/**
 * Which country a NANP area code belongs to, or null when it is not one.
 *
 * Null is a real answer and callers must handle it: a three-digit string that
 * is not an area code at all should not silently become a US search.
 */
export function countryForAreaCode(areaCode) {
  const code = String(areaCode ?? "").replace(/\D/g, "");
  if (code.length !== 3) return null;
  // N-X-X, and never N11. The first digit of a NANP area code is 2-9, and a
  // second and third of "11" is a service code — 911, 411, 611 — which is not
  // an area code in any country. isUsableAreaCode() has excluded these since it
  // was written; this function did not, and answered "US" for 911.
  if (!/^[2-9]\d\d$/.test(code) || /^\d11$/.test(code)) return null;
  return CANADIAN.has(code) ? "CA" : "US";
}

/** The thirteen Canadian provinces and territories, by their two-letter code. */
const CANADIAN_REGIONS = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

/**
 * Which country a two-letter region belongs to.
 *
 * The region search has no area code to derive a country from, so it needs its
 * own answer. There is no ambiguity to resolve: no Canadian province or
 * territory code collides with a USPS state code, so the thirteen are listed
 * and everything else is treated as US.
 *
 * That last clause is a knowing limit, the same one countryForAreaCode carries:
 * a two-letter code that is neither becomes a US search rather than an error.
 * FieldQuo sells in the US and Canada, and nobody will type "JM" here.
 */
export function countryForRegion(region) {
  const code = String(region ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return CANADIAN_REGIONS.has(code) ? "CA" : "US";
}

/**
 * The NANP members that are neither Canada nor the United States.
 *
 * countryForAreaCode() above answers "US" for these, and its header says why
 * that is a knowing limit for buying numbers. Texting a stranger is a
 * different question: FieldQuo's texting rules are CASL and the TCPA, and a
 * text to Jamaica or the Dominican Republic is governed by neither. So the
 * list exists here, once, for the one place that has to refuse them — a rep
 * typing a number to start a conversation.
 *
 * US territories (Puerto Rico 787/939, USVI 340, Guam 671, CNMI 670,
 * American Samoa 684) are NOT in it: they are the United States for the
 * TCPA's purposes.
 */
export const NANP_OUTSIDE_US_CA_AREA_CODES = Object.freeze([
  "242", // Bahamas
  "246", // Barbados
  "264", // Anguilla
  "268", // Antigua and Barbuda
  "284", // British Virgin Islands
  "345", // Cayman Islands
  "441", // Bermuda
  "473", // Grenada
  "649", // Turks and Caicos
  "658", // Jamaica
  "664", // Montserrat
  "721", // Sint Maarten
  "758", // Saint Lucia
  "767", // Dominica
  "784", // Saint Vincent and the Grenadines
  "809", // Dominican Republic
  "829", // Dominican Republic
  "849", // Dominican Republic
  "868", // Trinidad and Tobago
  "869", // Saint Kitts and Nevis
  "876", // Jamaica
]);

const OUTSIDE_US_CA = new Set(NANP_OUTSIDE_US_CA_AREA_CODES);

/**
 * "CA", "US", "other" (a NANP member FieldQuo does not text), or null for
 * something that is not an area code at all.
 */
export function nanpRegionForAreaCode(areaCode) {
  const code = String(areaCode ?? "").replace(/\D/g, "");
  const country = countryForAreaCode(code);
  if (!country) return null;
  if (OUTSIDE_US_CA.has(code)) return "other";
  return country;
}
