// lib/voice/platformEconomics.js
//
// What the voice product actually earns FieldQuo, after everything Retell
// charges for.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The per-minute margin was modelled once, in a comment, against a hand-typed
// cost estimate — and the real figures were sitting unused in the database the
// whole time. `VoiceCall.providerCostCents` is what Retell actually billed for
// each call. Nothing aggregated it, so "are we making money on voice?" could
// only be answered by re-deriving the same estimate that set the price.
//
// ══ The costs that are NOT per-minute, which is the whole point ═══════════
//
// A per-minute price recovers per-minute costs by construction. What it does
// not recover is anything charged per MONTH regardless of usage:
//
//   • Concurrency — $8 per concurrent slot past the first 20, per month. A
//     workspace-wide cost that scales with PEAK simultaneous calls, so it is
//     driven by how bunched the calls are, not how many minutes they add up to.
//   • Numbers — rented monthly whether they ring or not. A contractor who
//     bought a number and takes two calls a month is paying rent that covers
//     the number and nothing else.
//   • Knowledge bases — $8 each per month past the first ten. Not adopted, and
//     this is why: at a typical 30 minutes a month the fee exceeds the entire
//     gross margin on that company's calls.
//
// Those three are the ones that can quietly invert the margin, because none of
// them appears on any individual call.
//
// Pure — hand it rows, it answers. Nothing here reads the database, so the
// check script drives every branch without one.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

/** Retell's published fixed prices, in cents. Checked 2026-08-29. */
export const PLATFORM_PRICES = {
  // https://docs.retellai.com/deploy/concurrency — first 20 included.
  concurrencyIncluded: 20,
  concurrencyCentsEach: 800,
  // https://www.retellai.com/pricing — first 10 included.
  knowledgeBaseIncluded: 10,
  knowledgeBaseCentsEach: 800,
};

/**
 * Voice economics for a period.
 *
 * @param calls     [{ revenueCents, providerCostCents }] — revenue is what we
 *                  charged the contractor, cost is what Retell charged us.
 *                  A call with a null cost is COUNTED but not costed.
 * @param numbers   [{ monthlyRevenueCents, monthlyCostCents }] active rentals
 * @param concurrencyLimit  the workspace's current limit, or null if unknown
 * @param knowledgeBases    how many exist, or 0
 */
export function voiceEconomics({
  calls = [],
  numbers = [],
  concurrencyLimit = null,
  knowledgeBases = 0,
} = {}) {
  let callRevenue = 0;
  let callCost = 0;
  let uncosted = 0;

  for (const c of Array.isArray(calls) ? calls : []) {
    if (!c) continue;
    callRevenue += num(c.revenueCents);
    // Null-checked before Number(): a call Retell never priced must not read as
    // a call that cost nothing, which would flatter every margin it appears in.
    if (c.providerCostCents === null || c.providerCostCents === undefined) {
      uncosted += 1;
      continue;
    }
    callCost += num(c.providerCostCents);
  }

  let numberRevenue = 0;
  let numberCost = 0;
  for (const n of Array.isArray(numbers) ? numbers : []) {
    if (!n) continue;
    numberRevenue += num(n.monthlyRevenueCents);
    numberCost += num(n.monthlyCostCents);
  }

  // Charged on the workspace, recovered from nobody in particular. Null limit
  // means we could not ask the provider — reported as unknown rather than as
  // zero, because a fixed cost assumed to be zero is the one that surprises you.
  const paidSlots =
    concurrencyLimit === null
      ? null
      : Math.max(0, num(concurrencyLimit) - PLATFORM_PRICES.concurrencyIncluded);
  const concurrencyCost =
    paidSlots === null ? null : paidSlots * PLATFORM_PRICES.concurrencyCentsEach;

  const paidKbs = Math.max(0, num(knowledgeBases) - PLATFORM_PRICES.knowledgeBaseIncluded);
  const knowledgeBaseCost = paidKbs * PLATFORM_PRICES.knowledgeBaseCentsEach;

  const revenue = callRevenue + numberRevenue;
  const knownCost = callCost + numberCost + knowledgeBaseCost + (concurrencyCost ?? 0);

  return {
    revenueCents: round2(revenue),
    costCents: round2(knownCost),
    marginCents: round2(revenue - knownCost),
    // Null rather than 0% on no revenue: "we earned nothing" and "we have no
    // idea" are different, and only one of them is a reason to change a price.
    marginPct: revenue > 0 ? Math.round(((revenue - knownCost) / revenue) * 1000) / 10 : null,
    calls: {
      count: Array.isArray(calls) ? calls.length : 0,
      revenueCents: round2(callRevenue),
      costCents: round2(callCost),
      // Calls Retell has not priced yet. The margin above is short by whatever
      // these cost, so it reads HIGH — stated, not buried.
      uncosted,
    },
    numbers: {
      count: Array.isArray(numbers) ? numbers.length : 0,
      revenueCents: round2(numberRevenue),
      costCents: round2(numberCost),
    },
    fixed: {
      concurrencyLimit,
      paidSlots,
      concurrencyCents: concurrencyCost,
      knowledgeBases: num(knowledgeBases),
      knowledgeBaseCents: knowledgeBaseCost,
    },
    // True when a figure above is knowably incomplete, so the screen can say so
    // rather than presenting a partial margin as the answer.
    incomplete: uncosted > 0 || concurrencyLimit === null,
  };
}

/**
 * What one more concurrent slot has to earn to pay for itself.
 *
 * The answer is "almost nothing", and it is worth being able to show that: a
 * slot busy two per cent of a month carries hundreds of dollars of billable
 * minutes against an eight dollar fee. Concurrency is an availability decision,
 * not a pricing one — running out means callers hear a business that does not
 * answer, and that costs incomparably more than the slot.
 */
export function slotBreakEvenMinutes(marginCentsPerMinute) {
  const m = num(marginCentsPerMinute);
  if (m <= 0) return null;
  return Math.ceil(PLATFORM_PRICES.concurrencyCentsEach / m);
}
