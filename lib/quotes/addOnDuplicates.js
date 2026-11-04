// lib/quotes/addOnDuplicates.js
//
// "Two of these look like the same upgrade" — the warning above the optional
// extras, and the reason it is a warning rather than a rule.
//
// ── The owner's report (2026-11-03) ────────────────────────────────────────
//
// "the add-ons also seems to have double hinges." Q-2026-0029 offered the
// homeowner both of these, on one document:
//
//     New Hinges                       $540    source "history"
//     Soft-Close Hinges (31 × door)  $1,085    source "catalog"
//
// and Q-2026-0036 has "New handles" $360 sitting beside the catalogue's "New
// Handles — supply & install".
//
// ── Why this cannot be a rule ──────────────────────────────────────────────
//
// The first two fixes in this family were rules: a declared pair of trades
// that are alternatives, a declared count for a selective add-on, a
// structural collision between a product and the category it is linked to.
// Each one could be pointed at. This one cannot, and it is worth being exact
// about why rather than reaching for the nearest heuristic and calling it a
// fix.
//
// PUT /api/quotes/[id]/add-ons takes `description` from the browser and
// validates only that `source` is one of four known strings. So an offered
// row's text is whatever a person typed. Read off the live tenant, the
// distinct `source: "history"` descriptions on this company's quotes are:
// Cabinet Refacing, "Interior cabinet  Refinishing" (two spaces), New Handles
// holes, New Hinges, New handles, Stairs. Two of those are trade labels; the
// rest are free text. "New Hinges" is not a ServiceCategory and not a Product
// — there is no row of either kind with that name, for any company — so there
// is nothing in the schema that says it means the same thing as "Soft-Close
// Hinges". The only thing the two rows share is the word.
//
// Two free-text rows therefore cannot be safely de-duplicated by software,
// and a silent drop is the worst available answer: it would delete a priced
// row a person typed on a document, on the strength of a shared noun. What
// software CAN do is notice the resemblance and say so, which is a control
// the estimator resolves — they know whether the kitchen is getting two
// different hinge jobs. A false positive costs a glance; the silence it
// replaces cost a homeowner a quote with one upgrade on it twice at two
// prices.
//
// So: this is a heuristic, it is deliberately only wired to a sentence, and
// nothing here removes, reprices or blocks anything.
//
// ── The head noun, not any shared word ─────────────────────────────────────
//
// "Shares a word" was tried first and is too loose to live with: "Soft-Close
// Hinges" and "Soft-Close Drawer Slides" share two of them, sit together on
// nearly every cabinet quote, and are not remotely the same upgrade — a
// warning that fires on every quote is a warning nobody reads.
//
// What distinguishes them is the thing at the END. English names an upgrade
// by its head noun and qualifies it in front: soft-close HINGES, soft-close
// drawer SLIDES, new HINGES, glass INSERTS. So two rows are flagged when one
// row's head noun appears anywhere in the other's words. Hinges/hinges match;
// slides/hinges do not. That single rule gets every pair in the live data
// right, including both the owner reported.
//
// QUALIFIERS carry the words that say how a thing is done or supplied rather
// than what it is, because leaving them in moves the head noun onto the wrong
// word: "New Handles — supply & install" would be about INSTALL and would
// never match "New handles". Every word on that list is a verb or a function
// word for that reason; no word is there because it happened to cause a false
// positive, which is how a stop list stops being explainable.

import { catalogueRowName } from "@/lib/quotes/offeredAddOns";

/**
 * Words that describe how an upgrade is done, supplied or counted — never
 * which upgrade it is. See the header: verbs and function words only.
 */
export const QUALIFIERS = new Set([
  "and",
  "each",
  "for",
  "install",
  "installation",
  "installed",
  "new",
  "per",
  "supply",
  "supplied",
  "the",
  "with",
]);

const SHORT = 3; // "of", "to", "&" — nothing three letters short names a thing

/**
 * An offered extra's words and the noun it is named by.
 *
 * The quantity suffix this codebase writes (`name (n × unit)`) is stripped
 * first, so a catalogue row is compared as the product it is rather than as
 * the count it happens to carry on this quote.
 *
 * @returns {{ words: string[], head: string|null }}
 */
export function upgradeWords(description) {
  const words = catalogueRowName(description)
    .toLowerCase()
    // Punctuation, em dashes, slashes and the double space somebody typed are
    // all just separators here.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= SHORT && !QUALIFIERS.has(w))
    // Crude singular: "hinges" and "hinge" must meet. Applied to BOTH sides,
    // so a word it mangles ("glass" → "glas") still matches itself.
    .map((w) => (w.length > SHORT && w.endsWith("s") ? w.slice(0, -1) : w));
  return { words, head: words.length ? words[words.length - 1] : null };
}

/**
 * Pairs of offered extras that look like one upgrade written twice.
 *
 * Takes the panel's own list, in its own order, because that is where both
 * rows coexist and where the person who can settle it is looking. Rows a
 * takeoff owns are skipped: they are derived from the scope group on every
 * save and are not the estimator's to merge.
 *
 * Pure, and the only thing it returns is a list of pairs to say a sentence
 * about.
 *
 * @param {Array<{description?: string, amount?: number|string, source?: string}>} addOns
 * @returns {Array<{ a: number, b: number, shared: string }>} indexes into `addOns`
 */
export function duplicateAddOnPairs(addOns) {
  const list = (Array.isArray(addOns) ? addOns : []).map((a, i) => {
    const description = String(a?.description ?? "").trim();
    if (!description || a?.source === "takeoff") return null;
    const { words, head } = upgradeWords(description);
    return head ? { i, words: new Set(words), head } : null;
  });

  const pairs = [];
  for (let x = 0; x < list.length; x += 1) {
    const a = list[x];
    if (!a) continue;
    for (let y = x + 1; y < list.length; y += 1) {
      const b = list[y];
      if (!b) continue;
      // One row's head noun inside the other's words, either direction: "New
      // Handles holes" is named by HOLES and still names handles, which is
      // what makes it the same upgrade as "New Handles — supply & install".
      const shared = b.words.has(a.head) ? a.head : a.words.has(b.head) ? b.head : null;
      if (!shared) continue;
      pairs.push({ a: a.i, b: b.i, shared });
    }
  }
  return pairs;
}
