// lib/leads/potentialValue.js
//
// What a lead is probably worth, and WHERE that number came from.
//
// The owner asked for "a summary of the potential money from the leads, given
// that some leads enter information about the scope of work they want". The
// board already knows how hot a lead is (lib/leads/score.js); it did not know
// what it might be worth, so "which of these is the big one" lived in the
// rep's head.
//
// ── A figure always carries its basis, or it is not shown ───────────────────
//
// Every amount here comes back beside a `basis` naming the evidence, in
// strict order of how much of it there is:
//
//   1. "quote"    — a quote exists and a human priced it (or confirmed the
//                   auto-estimate). The total IS the figure.
//   2. "estimate" — the instant estimator produced a range the homeowner saw
//                   and nobody has reviewed yet. The midpoint of that range,
//                   because that is what the draft's own subtotal was seeded
//                   from (lib/estimate/createEstimateQuote.js) and a range
//                   has no single "total" to borrow.
//   3. "average"  — nothing is priced, but the lead asked for a service this
//                   company has WON before: the mean of its own accepted
//                   quotes for that service. The company's own history only
//                   (AGENTS.md non-negotiable #8 — never another tenant's,
//                   never a rate card we invented).
//   4. "unknown"  — none of the above. `amount` is null and the summary
//                   COUNTS these rather than padding them: "4 leads with no
//                   figure" is a true sentence, "$0" would be a false one
//                   (failure class #5, padding absent data with defaults).
//
// A stated budget band deliberately does NOT become a figure. "$5k–$15k" is
// what the homeowner hopes to spend, not what the job prices at, and the
// estimate-vs-budget gap is a separate fact the review queue already shows.
//
// ── Not weighted by stage ───────────────────────────────────────────────────
//
// The product has no stage probabilities — the leads pipeline is four columns
// with no win likelihood attached, and lib/sales/intel/leadScore.js says why
// the sales side refuses to invent one ("no invented conversion probabilities
// before there is data"). So the summary is a plain sum per stage and says
// "not weighted" on screen rather than multiplying by a number nobody chose.
//
// Pure: no I/O. The one database read it needs (won-quote history) is done by
// the caller and handed in as `averages` — see lib/leads/wonAverages.js.

import { LEAD_STATUSES } from "@/lib/leads/pipeline";

export const BASES = ["quote", "estimate", "average", "unknown"];

function money(n) {
  // Prisma Decimals arrive as objects with toString; strings arrive from JSON.
  // Anything that isn't a finite non-negative number is "no amount".
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function rangeMidpoint(range) {
  if (!range || typeof range !== "object") return null;
  const low = money(range.low);
  const high = money(range.high);
  if (low != null && high != null) return (low + high) / 2;
  // A one-sided range is still a figure the homeowner saw; the explicit
  // point, when present, is what the draft was seeded from.
  return money(range.point) ?? low ?? high;
}

const UNKNOWN = Object.freeze({ amount: null, basis: "unknown" });

/**
 * The potential value of ONE lead.
 *
 * @param {object} lead  a LeadRequest row with `categoryId` and, when it has
 *   one, `quote` selected with { total, autoEstimated, needsReview,
 *   estimateData, quoteNumber }.
 * @param {{ averages?: Record<string, { amount: number, count: number, label?: string }> }} [ctx]
 *   `averages` keyed by ServiceCategory id — from averageWonByCategory below.
 * @returns {{ amount: number|null, basis: string, service?: string, quoteNumber?: string, sample?: number }}
 */
export function potentialValueForLead(lead, { averages } = {}) {
  if (!lead || typeof lead !== "object") return UNKNOWN;

  const quote = lead.quote && typeof lead.quote === "object" ? lead.quote : null;
  if (quote) {
    const unreviewedEstimate = quote.autoEstimated === true && quote.needsReview === true;
    if (unreviewedEstimate) {
      const mid = rangeMidpoint(quote.estimateData?.range);
      if (mid != null) {
        return { amount: mid, basis: "estimate", quoteNumber: quote.quoteNumber || undefined };
      }
      // An auto-estimated draft with no range recorded is still a priced
      // draft — fall through to its total rather than to the average, which
      // would be a worse guess than the number already on the row.
    }
    const total = money(quote.acceptedTotal) ?? money(quote.total);
    if (total != null) {
      return {
        amount: total,
        basis: unreviewedEstimate ? "estimate" : "quote",
        quoteNumber: quote.quoteNumber || undefined,
      };
    }
    // A $0 quote is a quote nobody has priced yet. It says nothing about the
    // job's size, so the history-based average is the better claim — the
    // basis stays honest about which it is.
  }

  const avg = lead.categoryId && averages ? averages[lead.categoryId] : null;
  if (avg && money(avg.amount) != null && Number(avg.count) > 0) {
    return {
      amount: money(avg.amount),
      basis: "average",
      service: avg.label || lead.category?.label || undefined,
      sample: Number(avg.count),
    };
  }

  return UNKNOWN;
}

/**
 * Mean accepted-quote value per service category, from the company's own
 * won quotes. A quote is counted once for EACH category it carries a scope
 * group for (and its `quoteType`, for older quotes that predate scope groups):
 * a lead asking for painting is worth what a painting job wins, and a job
 * that was painting-plus-drywall still won that much.
 *
 * `acceptedTotal` beats `total` — what the client actually said yes to, after
 * add-ons and before any later edit, exactly as lib/quotes/importQuote.js and
 * the payment schedule read it.
 *
 * @param {Array<{ total?: any, acceptedTotal?: any, quoteType?: string|null, scopeGroups?: Array<{ categoryId: string }> }>} wonQuotes
 * @param {Array<{ id: string, key: string, label?: string }>} categories
 * @returns {Record<string, { amount: number, count: number, label?: string }>}
 *   only categories with at least one won quote of non-zero value appear —
 *   an average over zero history is not an average and is not returned.
 */
export function averageWonByCategory(wonQuotes, categories) {
  const byKey = new Map();
  for (const c of Array.isArray(categories) ? categories : []) {
    if (c && c.id && c.key) byKey.set(c.key, c);
  }
  const sums = new Map(); // categoryId -> { sum, count, label }

  for (const q of Array.isArray(wonQuotes) ? wonQuotes : []) {
    if (!q || typeof q !== "object") continue;
    const value = money(q.acceptedTotal) ?? money(q.total);
    if (value == null) continue; // a $0 win is a data-entry accident, not a price

    const ids = new Set();
    for (const g of Array.isArray(q.scopeGroups) ? q.scopeGroups : []) {
      if (g && typeof g.categoryId === "string" && g.categoryId) ids.add(g.categoryId);
    }
    const typed = q.quoteType ? byKey.get(q.quoteType) : null;
    if (typed) ids.add(typed.id);

    for (const id of ids) {
      const cur = sums.get(id) || { sum: 0, count: 0 };
      cur.sum += value;
      cur.count += 1;
      sums.set(id, cur);
    }
  }

  const labelById = new Map();
  for (const c of byKey.values()) labelById.set(c.id, c.label);

  const out = {};
  for (const [id, { sum, count }] of sums) {
    if (count === 0) continue;
    out[id] = { amount: sum / count, count, label: labelById.get(id) || undefined };
  }
  return out;
}

/**
 * The strip at the top of the board: a sum per stage, how many leads carry
 * a figure and how many don't. Never weighted (see the header).
 *
 * @param {Array<{ status?: string, potential?: { amount: number|null, basis: string } }>} leads
 * @returns {{
 *   byStage: Record<string, { total: number, withFigure: number, withoutFigure: number, count: number }>,
 *   open: { total: number, withFigure: number, withoutFigure: number, count: number },
 *   withoutFigure: number,
 *   weighted: false,
 * }}
 */
export function summarisePotential(leads) {
  const empty = () => ({ total: 0, withFigure: 0, withoutFigure: 0, count: 0 });
  const byStage = Object.fromEntries(LEAD_STATUSES.map((s) => [s, empty()]));
  const open = empty();
  let withoutFigure = 0;

  for (const lead of Array.isArray(leads) ? leads : []) {
    if (!lead || typeof lead !== "object") continue;
    // A status outside the board lands in "new", exactly where the page
    // itself files it (`out[lead.status] || out.new`).
    const stage = byStage[lead.status] ? lead.status : "new";
    const bucket = byStage[stage];
    const amount = money(lead.potential?.amount);
    bucket.count += 1;
    if (amount != null) {
      bucket.total += amount;
      bucket.withFigure += 1;
    } else {
      bucket.withoutFigure += 1;
      withoutFigure += 1;
    }
    // "Open" is what is still potential: not yet won, not lost.
    if (stage === "new" || stage === "contacted") {
      open.count += 1;
      if (amount != null) {
        open.total += amount;
        open.withFigure += 1;
      } else open.withoutFigure += 1;
    }
  }

  return { byStage, open, withoutFigure, weighted: false };
}
