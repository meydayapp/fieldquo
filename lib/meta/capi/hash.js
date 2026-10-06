// lib/meta/capi/hash.js
//
// The only place a homeowner's email or phone is turned into what Meta's
// Conversions API may receive: a SHA-256 of the normalised value. Nothing in
// lib/meta/capi/ sends, or stores in the outbox, a raw address or number.
//
// Meta's normalisation (developers.facebook.com/documentation/ads-commerce/
// conversions-api/parameters/customer-information-parameters, read
// 2026-10-05):
//
//   em  "Trim any leading and trailing whitespace. Convert all characters to
//       lowercase." Then SHA-256, hex.
//   ph  "Remove symbols, letters, and any leading zeros. Phone numbers must
//       include a country code to be used for matching." Then SHA-256, hex.
//
// ── The country code is never guessed past what we know ────────────────────
//
// A number typed "(514) 555-0101" carries no country code. Hashing its ten
// digits would produce a value Meta can never match — worse than sending
// nothing, because it looks like data. So a national number gets the calling
// code of the COMPANY's country (a Montréal painter's homeowners dial
// Montréal numbers), and only for the countries listed below; a number that
// cannot be completed with confidence is left out of user_data entirely.
import { createHash } from "node:crypto";

export function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Meta's normalised email, or null when it is not an address. Pure. */
export function normaliseEmail(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

// Calling codes for the countries FieldQuo companies operate in (lib/currency.js
// and lib/tax/jurisdictions.js name the markets). National significant number
// lengths are the ITU ranges, used only to refuse an obviously wrong length.
const CALLING = Object.freeze({
  CA: { cc: "1", nsn: [10] },
  US: { cc: "1", nsn: [10] },
  GB: { cc: "44", nsn: [9, 10] },
  IE: { cc: "353", nsn: [7, 8, 9] },
  AU: { cc: "61", nsn: [9] },
  NZ: { cc: "64", nsn: [8, 9, 10] },
  FR: { cc: "33", nsn: [9] },
  ES: { cc: "34", nsn: [9] },
  // Italy has no trunk prefix: a Rome landline is +39 06 …, the 0 stays.
  IT: { cc: "39", nsn: [9, 10, 11], keepZero: true },
  DE: { cc: "49", nsn: [10, 11] },
  MX: { cc: "52", nsn: [10] },
  PH: { cc: "63", nsn: [10] },
  IN: { cc: "91", nsn: [10] },
  UA: { cc: "380", nsn: [9] },
});

/**
 * Meta's normalised phone — digits only, WITH the country code — or null.
 * Pure.
 *
 *   "+1 (514) 555-0101"       → "15145550101"
 *   "514-555-0101", CA        → "15145550101"
 *   "1 514 555 0101", CA      → "15145550101"
 *   "07700 900123", GB        → "447700900123"   (trunk 0 dropped)
 *   "0044 7700 900123"        → "447700900123"   (international 00 prefix)
 *   "555-0101", CA            → null             (too short to be a number)
 *   "514-555-0101", no country → null            (country code unknowable)
 */
export function normalisePhone(raw, country = null) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const international = s.startsWith("+") || /^00\d/.test(s.replace(/[^\d+]/g, ""));
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (international) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    digits = digits.replace(/^0+/, "");
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  const rule = CALLING[String(country || "").toUpperCase()];
  if (!rule) return null;
  // Already carries its own country code (a North American "1 514 …").
  if (digits.startsWith(rule.cc) && rule.nsn.includes(digits.length - rule.cc.length)) return digits;
  const national = rule.keepZero ? digits : digits.replace(/^0+/, "");
  if (!rule.nsn.includes(national.length)) return null;
  return rule.cc + national;
}

/** user_data.em — an array of one hash, or undefined. Pure. */
export function hashedEmail(raw) {
  const v = normaliseEmail(raw);
  return v ? [sha256Hex(v)] : undefined;
}

/** user_data.ph — an array of one hash, or undefined. Pure. */
export function hashedPhone(raw, country) {
  const v = normalisePhone(raw, country);
  return v ? [sha256Hex(v)] : undefined;
}

/**
 * The hashed contact half of user_data, without empty keys. Pure.
 * @returns {{ em?: string[], ph?: string[] }}
 */
export function hashedContact({ email = null, phone = null, country = null } = {}) {
  const out = {};
  const em = hashedEmail(email);
  const ph = hashedPhone(phone, country);
  if (em) out.em = em;
  if (ph) out.ph = ph;
  return out;
}
