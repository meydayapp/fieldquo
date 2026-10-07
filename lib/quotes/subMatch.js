// lib/quotes/subMatch.js
//
// Which of the GC's own subcontractors wrote this quote? One rule, with no
// imports, so the upload confirm form in the browser
// (app/app/quotes/[id]/SubQuoteUploads.js) and the server
// (lib/quotes/subQuoteUpload.js re-exports it) pick the same row.

const LEGAL = /\b(inc|incorporated|ltd|limited|llc|llp|corp|corporation|co|company|ltee|limitee|enr)\b\.?/g;

/** A business name reduced for matching: case, accents, punctuation and legal form gone. */
export function normaliseBusinessName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(LEGAL, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The GC's roster row this sub most plausibly is, or null. Equal normalised
 * names only — "Sparky Electric Ltd." is "Sparky Electric", but "Sparky" is
 * not "Sparky Electric": a wrong match would show another company's
 * insurance beside this price, so a near miss is offered as "add to your
 * subcontractors" instead, never assumed.
 */
export function matchSubcontractor(name, roster = []) {
  const want = normaliseBusinessName(name);
  if (!want) return null;
  const hits = (Array.isArray(roster) ? roster : []).filter((s) => s && normaliseBusinessName(s.name) === want);
  if (!hits.length) return null;
  return hits.find((s) => s.active !== false) || hits[0];
}
