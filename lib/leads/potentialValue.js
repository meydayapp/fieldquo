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
//   3. "scope"    — nothing is priced, but the homeowner gave the job's size
//                   (22 doors + 15 drawers, 1,200 sq ft — lib/leads/
//                   scopeExtract.js, stored on intake.scope) and the company
//                   has its OWN price for those units in that service
//                   (lib/leads/scopeEstimate.js: its price book or its single
//                   rate). Labelled "estimate from 22 doors + 15 drawers".
//   4. "unknown"  — none of the above. `amount` is null, `why` says which
//                   piece is missing (no scope given, no service, or no price
//                   for it), and the summary COUNTS these rather than padding
//                   them: "4 leads with no figure" is a true sentence, "$0"
//                   would be a false one (failure class #5).
//
// ── Why there is no "average" any more (owner, 2026-10-05) ──────────────────
//
// It used to be: a lead with no scope, for a service the company had won
// before, showed the mean of its won quotes. On TrueFinish's board that put
// the same figure on Tony (22 doors, 15 drawers, an address, photos) and on a
// man who tapped "What services do you offer?" three times. A figure that is
// the same for every lead says nothing about any of them; a lead that gave no
// scope now shows no figure and is counted as "no figure".
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
// Pure: no I/O. The one database read it needs (the company's own priced
// services) is done by the caller and handed in as `pricing` — see
// lib/leads/scopeEstimate.js loadScopePricing.

import { LEAD_STATUSES } from "@/lib/leads/pipeline";

import { estimateFromScope, inferService } from "@/lib/leads/scopeEstimate";

export const BASES = ["quote", "estimate", "scope", "unknown"];

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

const UNKNOWN = Object.freeze({ amount: null, basis: "unknown", why: "no_scope" });

/**
 * The potential value of ONE lead.
 *
 * @param {object} lead  a LeadRequest row with `categoryId`, `intake` (its
 *   `scope` is read) and `message`, and when it has one, `quote` selected
 *   with { total, autoEstimated, needsReview, estimateData, quoteNumber }.
 * @param {{ pricing?: Record<string, object> }} [ctx]  the company's own
 *   priced services keyed by ServiceCategory id — loadScopePricing().
 * @returns {{ amount: number|null, basis: string, why?: string, service?: string,
 *   quoteNumber?: string, counts?: object, minimumApplied?: boolean }}
 */
export function potentialValueForLead(lead, { pricing } = {}) {
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
      // draft — fall through to its total rather than to the scope, which
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
    // job's size, so the homeowner's own scope is the better claim — the
    // basis stays honest about which it is.
  }

  return scopeValue(lead, pricing);
}

// A public form's own answers, by the intake field keys the quote builder
// uses (app/data/quoteIntakeFields.js) — the self-quote form and the funnels
// store them on intake at the top level.
const FORM_COUNT_KEYS = Object.freeze({ doorCount: "doors", drawerCount: "drawers", squareFootage: "sqft", roomCount: "rooms" });

/**
 * The counts a lead carries: what its conversation said (intake.scope), with
 * a form's own answers where the conversation said nothing. Pure.
 */
export function leadScopeCounts(lead) {
  const intake = lead?.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? lead.intake : {};
  const out = {};
  for (const [key, unit] of Object.entries(FORM_COUNT_KEYS)) {
    const n = Number(intake[key]);
    if (Number.isFinite(n) && n > 0) out[unit] = n;
  }
  const said = intake.scope && typeof intake.scope.counts === "object" && intake.scope.counts ? intake.scope.counts : {};
  for (const [unit, v] of Object.entries(said)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[unit] = n;
  }
  return out;
}

/**
 * The "scope" basis, or "unknown" with the reason. Pure.
 */
export function scopeValue(lead, pricing) {
  const counts = leadScopeCounts(lead);
  const scope = lead?.intake?.scope && typeof lead.intake.scope === "object" ? lead.intake.scope : {};
  if (!Object.values(counts).some((v) => Number(v) > 0)) return UNKNOWN;

  const services = pricing && typeof pricing === "object" ? pricing : {};
  let service = lead.categoryId ? services[lead.categoryId] || null : null;
  if (lead.categoryId && !service) {
    // The lead names a service the company does not sell (or has switched
    // off): there is no price of its own to estimate from.
    return { amount: null, basis: "unknown", why: "no_pricing", counts };
  }
  if (!service) {
    const words = [lead.message, ...Object.values(scope.sources || {}).map((s) => s?.quote)].filter(Boolean).join(" ");
    service = inferService(Object.values(services), counts, words);
  }
  const est = estimateFromScope(counts, service);
  if (est.amount == null) return { amount: null, basis: "unknown", why: est.why, service: est.service, counts };
  return {
    amount: est.amount,
    basis: "scope",
    service: est.service || undefined,
    counts: est.counts,
    minimumApplied: est.minimumApplied || undefined,
  };
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
