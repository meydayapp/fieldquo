// lib/quotes/addOnAutoAdd.js
//
// Whether a quote review's PRICED recommendations may join the offered list
// by themselves, and which ones.
//
// ── Why the auto-add exists ────────────────────────────────────────────────
//
// The estimator pressed Review to be told what to offer; making them press
// Add on each answer was a second ask for the same thing. A recommendation
// with a price — the median this company's own accepted quotes carried for
// it (lib/ai/quoteReview.js), never a model's guess — lands in the list with
// the review's one-line benefit as its detail and is saved at once, so it is
// offered even if nobody scrolls down. One without a price stays a
// suggestion with an Add button: an offer needs a number, and the estimator
// is the one who has it.
//
// ── Why it has to stop ─────────────────────────────────────────────────────
//
// It filtered against the list ON SCREEN. So after the estimator deleted
// every row that list was empty, every priced recommendation passed the
// filter, and the save that follows PUT them all back:
//
//   "if I delete all addons I cannot save it so then when the quote is
//    created or saved they all appear again I would assume that if I delete
//    all of the add-ons and save the quote they will not appear. It forces
//    me to at least have one"
//
// `curatedAt` is Quote.addOnsCuratedAt — set the moment a human presses Save
// extras, which is the only thing that can tell an empty list apart from a
// list nobody has decided about yet. Once it is set this returns null and
// the panel shows the recommendations with their Add buttons instead, the
// way an unpriced one always has. Nothing is hidden and nothing is written
// behind the estimator's back.
//
// Pure, and in lib/ rather than inside the panel, so the decision can be
// executed by a check (scripts/check-offered-add-ons.mjs) rather than read.

// The editor's own cap — more than a handful of extras is a second quote.
const CAP = 8;

const key = (s) => String(s ?? "").trim().toLowerCase();

/**
 * @param {object} p
 * @param {Array} p.reviewAddOns  the stored review's add-on recommendations
 * @param {Array} p.addOns        the offered list as it stands
 * @param {boolean} [p.readOnly]  true once the client has decided
 * @param {string|Date|null} [p.curatedAt]  Quote.addOnsCuratedAt
 * @returns {{ next: Array, added: Array }|null}  null = append nothing and
 *   save nothing; the caller leaves the list exactly as it found it.
 */
export function autoAddFromReview({ reviewAddOns, addOns, readOnly = false, curatedAt = null }) {
  if (readOnly) return null;
  // A human has already said what this quote offers. Asked and answered.
  if (curatedAt) return null;

  const current = Array.isArray(addOns) ? addOns : [];
  const offered = new Set(current.map((a) => key(a?.description)));
  const priced = (Array.isArray(reviewAddOns) ? reviewAddOns : []).filter(
    (s) => Number(s?.amount) > 0 && !offered.has(key(s?.description)),
  );
  if (!priced.length) return null;

  const next = [
    ...current,
    ...priced.map((s) => ({
      description: s.description,
      detail: s.detail || "",
      amount: s.amount,
      taxable: true,
      source: s.source === "history" ? "history" : "ai",
    })),
  ].slice(0, CAP);

  return { next, added: priced };
}
