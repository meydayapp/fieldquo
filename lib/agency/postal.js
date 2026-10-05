// lib/agency/postal.js
//
// The postal code an agency may see. Pure.
//
// ══ The rule (owner, 2026-10-05) ═══════════════════════════════════════════
//
//   United States   the 5-digit ZIP — never ZIP+4, which narrows to a block
//   Canada          the first three characters (the FSA, "K1A") — never the
//                   full code, which narrows to a few houses
//   anywhere else   nothing: no rule was agreed for it, and absence is the
//                   only safe default
//
// The street address is never shared, whatever the switch says. With
// "Share contact details" ON, the full postal code is shared instead.
//
// ══ A street number is not a ZIP ═══════════════════════════════════════════
//
// "12345 Main St, Springfield, IL 62704": the first five-digit run in that
// line is the HOUSE NUMBER. Reading any five digits as a ZIP would publish
// half an address under the name of a postal code. So a ZIP is read only
// from a dedicated postal field, or from an address line where it follows a
// state abbreviation or ends the line — the places a ZIP actually sits.

const CA_FULL = /\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/i;
const CA_FSA_ONLY = /^\s*([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s*$/i;
const US_FIELD = /^\s*(\d{5})(?:[-\s]?(\d{4}))?\s*$/;
// "IL 62704", "IL 62704-1234" — a state, then the ZIP.
const US_AFTER_STATE = /\b[A-Z]{2}\.?,?\s+(\d{5})(?:-(\d{4}))?\b/;
// "…, 62704" or "…62704-1234, USA" at the very end of the line.
const US_AT_END = /(?:^|[\s,])(\d{5})(?:-(\d{4}))?\s*(?:,?\s*(?:USA|US|U\.S\.A?\.?|United States))?\s*$/i;

function normaliseCountry(c) {
  const s = String(c || "").trim().toUpperCase();
  if (s === "CA" || s === "CANADA") return "CA";
  if (s === "US" || s === "USA" || s === "UNITED STATES") return "US";
  return s || null;
}

/**
 * Read a postal code out of one candidate.
 * @returns {{ country: "US"|"CA", full: string, partial: string } | null}
 */
export function readPostal(value, { field = false, country = null } = {}) {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.normalize("NFKC");
  const want = normaliseCountry(country);

  if (want !== "US") {
    const ca = s.match(CA_FULL);
    if (ca) {
      const fsa = ca[1].toUpperCase();
      return { country: "CA", full: `${fsa} ${ca[2].toUpperCase()}`, partial: fsa };
    }
    // A field holding only the FSA is still an FSA (a form that asked for it).
    if (field) {
      const fsa = s.match(CA_FSA_ONLY);
      if (fsa) return { country: "CA", full: fsa[1].toUpperCase(), partial: fsa[1].toUpperCase() };
    }
  }
  if (want !== "CA") {
    const m = field ? s.match(US_FIELD) : s.match(US_AFTER_STATE) || s.match(US_AT_END);
    if (m) return { country: "US", full: m[2] ? `${m[1]}-${m[2]}` : m[1], partial: m[1] };
  }
  return null;
}

/**
 * The postal code for an agency row.
 *
 * @param p.candidates  [{ value, field }] in order of trust — a dedicated
 *                      postal-code column first, address lines after
 * @param p.country     the company's country (Company.country), used to
 *                      decide which shape to look for when it is known
 * @param p.full        true only when the company switched contact sharing on
 * @returns {{ postalCode: string|null, postalCountry: "US"|"CA"|null }}
 */
export function postalForAgency({ candidates = [], country = null, full = false } = {}) {
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (!c) continue;
    const hit = readPostal(c.value, { field: Boolean(c.field), country });
    if (hit) return { postalCode: full ? hit.full : hit.partial, postalCountry: hit.country };
  }
  return { postalCode: null, postalCountry: null };
}
