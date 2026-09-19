// lib/format/address.js
//
// One address string from an address plus its parts, without saying the city
// twice.
//
// ── The regression this fixes ──────────────────────────────────────────────
//
// Client records store `address` as the FORMATTED address Google Places
// returns — "123 Queen St W, Toronto, ON M5H 3M9, Canada" — which already
// contains the locality and the province. Several screens did:
//
//   [client.address, client.city, client.province].filter(Boolean).join(", ")
//
// That was harmless only because city and province were always null: the
// quick-add path discarded them, which was its own bug (untaxed clients). The
// moment that was fixed and the components started being stored, every one of
// those joins began printing
//
//   "123 Queen St W, Toronto, ON M5H 3M9, Canada, Toronto, ON"
//
// on the quote a client opens. Fixing one bug lit up a latent second one — the
// join was always wrong, it just had nothing to duplicate.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// A part is appended only if the address does not already contain it. That
// keeps working for a hand-typed "123 Queen St" with city and province in
// their own fields, which is a real shape in this data and the reason the
// join existed at all.

const norm = (v) =>
  String(v ?? "")
    .toLowerCase()
    // Punctuation and spacing vary between what Google returns and what
    // someone typed; comparing on letters and digits alone avoids "ON," not
    // matching "ON".
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Does `haystack` already mention `part` as a whole word-ish run? */
function mentions(haystack, part) {
  const h = norm(haystack);
  const p = norm(part);
  if (!h || !p) return false;
  return ` ${h} `.includes(` ${p} `);
}

/**
 * One stored address component, or null.
 *
 * Trimmed, capped, and never an empty string: "" in a nullable column is a
 * value that reads as "set to nothing" on every screen that checks for null.
 * Shared by the client routes and the instant estimator so the two store the
 * same thing for the same Google component.
 */
export function cleanAddressPart(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, 80);
  return v || null;
}

/**
 * @param {object} entity  anything with { address, city, province, postalCode }
 * @returns {string} "" when there is nothing to show — callers should render
 *   nothing rather than an empty line, so absence stays absence.
 */
export function formatAddress(entity) {
  if (!entity || typeof entity !== "object") return "";
  const base = String(entity.address ?? "").trim();
  const parts = [];

  // The postal code last, and only when the formatted line does not already
  // carry it — Google's line for "5th Ave, New York, NY, USA" has none, while
  // the component it returned beside it does. Same rule as city and province:
  // appended, never duplicated, never invented.
  for (const value of [entity.city, entity.province, entity.postalCode]) {
    const v = String(value ?? "").trim();
    if (!v) continue;
    // Against the base AND against what we've already appended, so a city that
    // equals the province (rare, but "Quebec" exists) isn't printed twice.
    if (mentions(base, v)) continue;
    if (parts.some((p) => mentions(p, v))) continue;
    parts.push(v);
  }

  return [base, ...parts].filter(Boolean).join(", ");
}

/** Just the place, for a list row where the street would be noise. */
export function formatPlace(entity) {
  if (!entity || typeof entity !== "object") return "";
  const city = String(entity.city ?? "").trim();
  const province = String(entity.province ?? "").trim();
  if (city && province && !mentions(city, province)) return `${city}, ${province}`;
  return city || province || "";
}
