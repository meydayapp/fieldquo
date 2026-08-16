// lib/estimate/budgetBands.js
//
// "What's your budget?" on the instant-quote form, in numbers that mean
// something for the trade being quoted.
//
// ══ Why the bands are the owner's and not FieldQuo's ═══════════════════════
//
// The self-quote form has always asked this with one fixed set of bands —
// under $1k, $1–5k, $5–15k, $15k+ (lib/leads/qualifiers.js). Those are fine for
// a handyman and useless everywhere else. A cabinet refinisher's cheapest real
// job clears $3,000, so "under $1,000" is a band nobody picks and "$15,000+"
// swallows half their work in one bucket; a plumber quoting $400 callouts has
// the opposite problem. A question whose answers don't fit gets answered at
// random, and a qualifier answered at random is worse than one not asked — it
// looks like data.
//
// So the thresholds are per trade, set by the owner, and default to the
// generic ones so a company that never opens the setting still gets a sane
// question.
//
// ══ The browser never posts a dollar figure ════════════════════════════════
//
// It posts the INDEX of the band that was tapped. The server maps that index
// through its own saved thresholds to a { min, max } pair. Same rule as add-on
// pricing (non-negotiable #5): the client names a choice, the server assigns
// the money. A form that posted "budget: 6000" could be edited to say 60000 by
// anyone who wanted their lead scored hotter.
//
// ══ Publishing these is not publishing a rate card ═════════════════════════
//
// Non-negotiable #4 says public endpoints never return prices, and these do
// cross to the public form. They're not prices: they're the buckets the OWNER
// chose to sort enquiries into, containing no rate, no unit cost and no
// relationship to what any job would actually be quoted. The self-quote form
// has published its bands since it shipped, and truefinishcabinets.com shows
// its own on the open web. What stays server-side is unchanged — the rate card
// and the computed estimate.
//
// Pure. No database, no currency conversion, no I/O.

import { currencySymbol } from "@/lib/selfQuote/confirmation";

// The generic bands, as thresholds. Deliberately the same numbers
// lib/leads/qualifiers.js uses, so a company that never touches the setting
// asks exactly the question it asked before this file existed.
export const DEFAULT_BUDGET_THRESHOLDS = [1000, 5000, 15000];

/** How many bands a threshold list produces: three cuts make four buckets. */
const BAND_COUNT = DEFAULT_BUDGET_THRESHOLDS.length + 1;

/**
 * Coerce a saved threshold list into something renderable.
 *
 * Rejects rather than repairs anything it can't read: a config with two
 * thresholds, or with 6000 before 3500, produces the DEFAULTS instead of a
 * half-built band list. A budget question with overlapping or inverted bands
 * ("$6,000 – $3,500") is worse than the generic one, and it would be published
 * on a public page under the contractor's name.
 *
 * Rounds to whole units — a threshold of $3,500.40 is a typo, not a decision.
 */
export function normaliseBudgetThresholds(input) {
  if (!Array.isArray(input) || input.length !== DEFAULT_BUDGET_THRESHOLDS.length) {
    return [...DEFAULT_BUDGET_THRESHOLDS];
  }
  const nums = input.map((n) => Math.round(Number(n)));
  const usable =
    nums.every((n) => Number.isFinite(n) && n > 0) &&
    nums.every((n, i) => i === 0 || n > nums[i - 1]);
  return usable ? nums : [...DEFAULT_BUDGET_THRESHOLDS];
}

/**
 * The bands to render, as { index, label, min, max }.
 *
 * `max` is null on the top band — it has no ceiling, and null says that
 * plainly where a sentinel like 0 or Infinity would have to be remembered
 * about at every call site. The financing rule below depends on the difference.
 *
 * Labels are built here rather than stored, so changing a threshold changes
 * every label at once and none of them can drift out of step with the number
 * they describe.
 */
export function budgetBands(thresholds, { currency = "CAD", language = "en" } = {}) {
  const cuts = normaliseBudgetThresholds(thresholds);
  const s = currencySymbol(currency);
  const fr = language === "fr";
  const n = (v) => `${s}${v.toLocaleString(fr ? "fr-CA" : "en-CA")}`;

  return [
    {
      index: 0,
      min: null,
      max: cuts[0],
      label: fr ? `Moins de ${n(cuts[0])}` : `Under ${n(cuts[0])}`,
    },
    ...cuts.slice(0, -1).map((cut, i) => ({
      index: i + 1,
      min: cut,
      max: cuts[i + 1],
      label: `${n(cut)} – ${n(cuts[i + 1])}`,
    })),
    {
      index: cuts.length,
      min: cuts[cuts.length - 1],
      max: null,
      label: `${n(cuts[cuts.length - 1])}+`,
    },
  ];
}

/**
 * An index posted by the browser back to a band, or null.
 *
 * Null for anything out of range, non-integer, or absent — the caller then
 * treats it as "not answered", which is the truth. Never clamps to a
 * neighbouring band: a homeowner who sent index 9 did not tell us they have
 * the biggest budget, and recording that they did would be an invention that
 * later gets scored and acted on.
 */
export function bandForIndex(thresholds, index) {
  if (!Number.isInteger(index) || index < 0 || index >= BAND_COUNT) return null;
  return budgetBands(thresholds)[index] || null;
}

/**
 * Does the priced estimate clear what they said they could spend?
 *
 * @param band      { min, max } from bandForIndex, or null if unanswered
 * @param estimate  { low, high } as computed server-side
 * @returns true only when BOTH facts exist and the cheapest real price is
 *          above their ceiling.
 *
 * Three deliberate "false"s:
 *
 *   unanswered      no band, no claim. Silence isn't a small budget.
 *   the top band    max is null. "$15,000+" states no ceiling, so nothing can
 *                   be above it, and treating the band's floor as a ceiling
 *                   would flag every large job as unaffordable.
 *   overlapping     compared against estimate.LOW, not the midpoint or the
 *                   high. A $6,000 ceiling against a $5,500–$9,000 range is
 *                   not a gap: there is a real price in there they can afford,
 *                   and telling the contractor otherwise sends them into the
 *                   call apologising for a number that was fine.
 */
export function estimateExceedsBudget(band, estimate) {
  // Checked as null BEFORE any arithmetic, because Number(null) is 0 and not
  // NaN — so a Number.isFinite guard alone reads the top band's absent ceiling
  // as a ceiling of zero and reports every job over it. Which is every job.
  if (band?.max == null) return false;

  const ceiling = Number(band.max);
  const low = Number(estimate?.low);
  if (!Number.isFinite(ceiling) || !Number.isFinite(low) || low <= 0) return false;
  return low > ceiling;
}
