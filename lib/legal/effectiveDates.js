// lib/legal/effectiveDates.js
//
// Effective dates for FieldQuo's legal documents.
//
// The bug this replaces: `Last updated: {new Date().toLocaleDateString()}`
// on both the Privacy Policy and Terms of Service placeholders. That
// expression re-evaluates on every single page load, so the page told every
// visitor the document had been updated TODAY — forever, regardless of when
// anything actually changed. An effective date is a fact ABOUT the document,
// fixed the moment it is published or amended. It is not a computation over
// the reader's clock, and it must never be one again.
//
// Change one of these constants by hand, in the same commit as the text
// change it describes — never programmatically, never on a schedule. That is
// what makes "Last updated" a claim a reader (or a regulator) can rely on.
//
// scripts/check-legal-pages.mjs asserts the pages import these constants and
// contain no `new Date(` call, so this class of bug can't come back quietly.

/** ISO 8601 (YYYY-MM-DD) — sorts correctly and has no locale ambiguity. */
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-08-30";
export const TERMS_OF_SERVICE_EFFECTIVE_DATE = "2026-08-30";
// The security page isn't a legal instrument in the same sense as the two
// above — nothing on it is "effective" the way a contract term is — but it
// is a set of factual claims about current practice, and the same failure
// mode (a page silently claiming to be current forever) applies. Pinned for
// the same reason.
export const SECURITY_PAGE_UPDATED_DATE = "2026-08-30";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Renders an ISO date as a fixed, locale-independent long form —
 * "August 30, 2026" — rather than `toLocaleDateString()`, which reads the
 * VISITOR's locale and would render the same effective date as a different
 * string (and in en-GB, a different date entirely) depending on who's
 * looking. A legal document states one date, the same way, to everyone.
 */
export function formatLegalDate(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return String(isoDate);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
