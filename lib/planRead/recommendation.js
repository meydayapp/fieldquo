// lib/planRead/recommendation.js
//
// The price a drawing read recommends — at the company's OWN target margin,
// with the working shown line by line.
//
// ══ The arithmetic (every figure from code, none from the model) ═══════════
//
//   Labour      Σ hours × the company's labour COST rate (its field crew's
//               average, or FieldQuo's $35 fallback — labelled which)
//   Materials   Σ quantity × unit cost (books, recipes, the estimator's own
//               figures from the conversation)
//   Line costs  the company's own services' line costs (Product templates)
//   Equipment   access lines at the price the estimator typed, counted at cost
//   Overhead    the job's fair share of the month in crew TIME — the owner's
//               rule (2026-10-04), lib/costing/overheadShare.js overheadForJob,
//               the same function the quote builder's Cost & margin panel uses:
//               monthly fixed costs × (job hours ÷ billable crew-hours a month);
//               per job when only jobs-a-month is set; 10% of price when
//               neither — each labelled.
//   Cost        the sum
//   Target      cost ÷ (1 − target margin)            (time or per-job overhead)
//               (cost before overhead) ÷ (1 − target − overhead%)  (% of price)
//
// "Your rates" = painting's engine + the trades' engine and service blocks +
// the equipment typed. FieldQuo suggestions are priced at the target (or, for
// framing, at the framing book) and are NEVER counted as "your rates".
//
// ══ What is recommended (the owner's decision #9) ══════════════════════════
//
// Your rates meet the target → your rates. They miss it → the target price,
// with the gap, a one-click "add a margin adjustment line" (a visible line —
// never a silent scaling of the company's rates), and the owner, managers and
// the quote's assigned estimator told (lib/planRead/marginNotify.js).
//
// Pure.

import { overheadForJob } from "@/lib/costing/overheadShare";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** A quantity with LOW confidence worth more than this share of the price is
 *  flagged "check before sending". */
export const LOW_CONFIDENCE_SHARE = 0.1;

/**
 * @param p.painting   { price, hours, labourCost, materialCost, lowValue }
 * @param p.trades     priceTrades() output, each block with its confidence
 * @param p.lowValueByBlock  Map(blockId → true) for blocks resting on a
 *                     low-confidence quantity
 * @param p.equipment  { total, unpriced }
 * @param p.labour     { rate, source }
 * @param p.target     { pct, isDefault, whatIf? }
 * @param p.overhead   { rates (overheadRates), fallbackPct, minimumPrice,
 *                       hourlyFloor, needsCapacity }
 */
export function recommendPrice({ painting = null, trades = [], equipment = { total: 0, unpriced: 0 }, labour, target, overhead = {}, lowBlocks = new Set() }) {
  const t = Math.max(0, Math.min(0.95, num(target?.pct) / 100));
  const blocks = trades.flatMap((tr) => tr.blocks.map((b) => ({ ...b, tradeKey: tr.tradeKey })));
  const paint = painting || { price: 0, hours: 0, labourCost: 0, materialCost: 0, lowValue: 0 };

  const hours = round2(num(paint.hours) + blocks.reduce((n, b) => n + num(b.hours), 0));
  const labourCost = round2(num(paint.labourCost) + blocks.reduce((n, b) => n + num(b.labourCost), 0));
  const materialCost = round2(num(paint.materialCost) + blocks.reduce((n, b) => n + num(b.materialCost), 0));
  const lineCost = round2(blocks.reduce((n, b) => n + num(b.lineCost), 0));
  const equipmentCost = round2(num(equipment.total));
  const base = round2(labourCost + materialCost + lineCost + equipmentCost);

  const yours = blocks.filter((b) => b.rung === "engine" || b.rung === "service");
  const suggestions = blocks.filter((b) => b.rung === "suggestion");
  const yourPrice = round2(num(paint.price) + yours.reduce((n, b) => n + num(b.sell), 0) + equipmentCost);

  // Overhead on the job's time. The pct fallback depends on the price being
  // solved for, so it is carried as a rate and solved below.
  const fixed = overheadForJob({ rates: overhead.rates || null, jobHours: hours, price: null, fallbackPct: overhead.fallbackPct });
  const pct = fixed.basis === "pct_of_price" ? num(fixed.pct) / 100 : 0;
  const overheadFixed = fixed.basis === "pct_of_price" ? 0 : num(fixed.amount);

  const solve = (cost) => (1 - t - pct > 0.01 ? (cost + overheadFixed) / (1 - t - pct) : null);
  const targetPrice = solve(base) === null ? null : round2(solve(base));

  // A suggestion with no price of its own is priced to the target: its cost
  // plus its share of the overhead (by its hours), grossed up.
  const suggestionSell = suggestions.map((b) => {
    if (b.sell !== null && b.sell !== undefined) return { id: b.id, sell: round2(b.sell), from: "book" };
    if (!b.costComplete && b.hours === null) return { id: b.id, sell: null, from: "none" };
    const share = hours > 0 && num(b.hours) > 0 ? overheadFixed * (num(b.hours) / hours) : 0;
    const cost = num(b.labourCost) + num(b.materialCost);
    return { id: b.id, sell: 1 - t - pct > 0.01 ? round2((cost + share) / (1 - t - pct)) : null, from: "target" };
  });
  const suggestedTotal = round2(suggestionSell.reduce((n, s) => n + num(s.sell), 0));
  const withSuggestions = round2(yourPrice + suggestedTotal);

  const overheadAt = (price) => (fixed.basis === "pct_of_price" ? round2(price * pct) : round2(overheadFixed));
  const marginAt = (price) => (price > 0 ? (price - base - overheadAt(price)) / price : null);
  const yourMargin = marginAt(withSuggestions);
  const meets = yourMargin !== null && yourMargin + 1e-9 >= t;
  const gap = meets || targetPrice === null ? 0 : round2(targetPrice - withSuggestions);
  const recommended = meets ? withSuggestions : targetPrice;

  const lowValue = round2(num(paint.lowValue) + blocks.filter((b) => lowBlocks.has(b.id)).reduce((n, b) => n + num(b.sell ?? suggestionSell.find((s) => s.id === b.id)?.sell), 0));
  const costIncomplete = blocks.filter((b) => !b.costComplete).map((b) => b.id);
  const flags = [];
  if (yourMargin !== null && yourMargin < 0) flags.push("loss");
  else if (!meets) flags.push("below_target");
  if (suggestions.length) flags.push("suggestions");
  if (costIncomplete.length) flags.push("cost_incomplete");
  if (num(equipment.unpriced) > 0) flags.push("equipment_unpriced");
  if (recommended && lowValue > LOW_CONFIDENCE_SHARE * recommended) flags.push("low_confidence_value");
  const minimum = num(overhead.minimumPrice) > 0 ? round2(overhead.minimumPrice) : null;
  if (minimum !== null && recommended !== null && recommended < minimum) flags.push("below_minimum_price");
  // The hourly floor: what each crew-hour must earn, after materials and
  // bought-in lines, to pay the crew AND its share of the month.
  const perHour = fixed.perHour !== null && fixed.perHour !== undefined ? num(fixed.perHour) : null;
  const earnedPerHour = hours > 0 && recommended ? round2((recommended - materialCost - lineCost - equipmentCost) / hours) : null;
  const floorPerHour = perHour !== null ? round2(num(labour?.rate) + perHour) : null;
  if (earnedPerHour !== null && floorPerHour !== null && earnedPerHour < floorPerHour) flags.push("below_hourly_floor");

  return {
    targetPct: round2(t * 100),
    targetIsDefault: Boolean(target?.isDefault),
    targetWhatIf: target?.whatIf || null,
    hours,
    labour: { cost: labourCost, rate: num(labour?.rate), source: labour?.source || "fallback" },
    materialCost,
    lineCost,
    equipment: { cost: equipmentCost, unpriced: num(equipment.unpriced) },
    overhead: {
      basis: fixed.basis,
      amountAtRecommended: recommended ? overheadAt(recommended) : overheadFixed,
      perHour: fixed.perHour,
      share: fixed.share,
      perJob: fixed.perJob,
      pct: fixed.basis === "pct_of_price" ? fixed.pct : null,
      monthlyFixedCosts: fixed.monthlyFixedCosts,
      billableHoursPerMonth: fixed.billableHoursPerMonth,
      jobsPerMonth: fixed.jobsPerMonth,
    },
    costBeforeOverhead: base,
    cost: recommended ? round2(base + overheadAt(recommended)) : round2(base + overheadFixed),
    targetPrice,
    yourPrice,
    suggestedTotal,
    suggestionSell,
    withSuggestions,
    yourMarginPct: yourMargin === null ? null : round2(yourMargin * 100),
    meetsTarget: meets,
    gap,
    recommended,
    minimumPrice: minimum,
    hourlyFloor: floorPerHour,
    earnedPerHour,
    lowConfidenceValue: lowValue,
    costIncomplete,
    flags,
  };
}
