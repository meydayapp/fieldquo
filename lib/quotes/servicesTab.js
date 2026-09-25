// lib/quotes/servicesTab.js
//
// The rows the document builder's Services tab draws — one per service (scope
// group) on the quote: what was measured, the production rates of the
// services on it, the crew hours those give, and — for the people allowed to
// see them — labour cost, materials, price and margin.
//
// ── A summary, not a second editor ─────────────────────────────────────────
//
// Nothing here is editable. The quantities are the takeoff's and the lines'
// (edited in the Estimate tab's own editors), the rates are the Product's
// (Settings › Services), and the money is the Cost & margin panel's
// arithmetic, read off the SAME estimate object the panel renders — so the tab
// cannot disagree with the drawer beside it. A second place to type a
// quantity would be a second value for it.
//
// ── Redaction is done here, not in the markup ──────────────────────────────
//
// The builder already refuses a member without showPricing, and the cost
// drawer is drawn only for one with jobCosting. This model applies the same
// two toggles itself: without `mayCost` a row carries NO labourCost,
// materials or margin key at all, and without `showPricing` no price or
// margin — absent, not null, so a component that forgets to check cannot
// print what it was never given. Hours and production rates are not money
// (the crew is told how long a job takes on the work order) and stay.
// scripts/check-production-rates.mjs asserts the keys are gone.
//
// Pure — no React.

import { groupMeasurements, calculatorOfTrade } from "@/lib/quotes/serviceTemplateLines";
import { MEASUREMENT_KEYS } from "@/lib/services/measurementKeys";
import { hasTakeoff } from "@/lib/pricing/takeoffTrades";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * @param p.groups            the builder's scope groups (tempId, label, categoryKey, takeoff, intakeValues, lineItems)
 * @param p.productionByGroup Map tempId → lib/services/productionRates.js groupProduction(...)
 * @param p.estimate          the builder's estimateQuoteCost result (groups[].tempId,
 *                            labourHours, materialTotal; effectiveRate)
 * @param p.tradeHoursOf      (group) → the book's takeoff hours for it (tradeLabourHours)
 * @param p.priceOf           (group) → the group's subtotal
 * @param p.lineCostOf        (group) → the group's lines' own cost (lib/costing/lineItemCost.js)
 * @param p.showPricing       the showPricing toggle
 * @param p.mayCost           the jobCosting toggle
 * @returns { rows: [...], totals: {...} }
 */
export function servicesTabModel({
  groups = [],
  productionByGroup = new Map(),
  estimate = null,
  tradeHoursOf = () => 0,
  priceOf = () => 0,
  lineCostOf = () => 0,
  showPricing = false,
  mayCost = false,
} = {}) {
  const estGroups = new Map((Array.isArray(estimate?.groups) ? estimate.groups : []).map((g) => [g.tempId, g]));
  const rate = num(estimate?.effectiveRate);
  const rows = [];
  const totals = { hours: 0, ...(mayCost ? { labourCost: 0, materials: 0 } : {}), ...(showPricing ? { price: 0 } : {}) };

  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g || typeof g !== "object") continue;
    const production = productionByGroup instanceof Map ? productionByGroup.get(g.tempId) : null;
    const est = estGroups.get(g.tempId) || null;
    let measured = {};
    try {
      measured = groupMeasurements(g);
    } catch {
      measured = {};
    }
    let bookHours = 0;
    try {
      bookHours = round2(tradeHoursOf(g));
    } catch {
      bookHours = 0;
    }
    const byServices = production && production.hours !== null && production.hours !== undefined;
    // With a rate in force the estimate's group carries the services' hours
    // (estimateJobCost.js withProductionHours) and the book's takeoff hours
    // are left out of the pool; without one, the group's hours are the book's
    // takeoff hours plus any recipe labour the estimate gave it.
    const hours = byServices ? round2(production.hours) : round2(bookHours + num(est?.labourHours));
    const row = {
      tempId: g.tempId,
      label: String(g.label || ""),
      categoryKey: g.categoryKey || null,
      // Whether the group's trade has a calculator to open — the tab offers
      // "Open measurements" only where there is something to measure with.
      hasCalculator: Boolean(calculatorOfTrade(g.categoryKey) || hasTakeoff(g.categoryKey)),
      measurements: Object.entries(measured).map(([key, m]) => ({
        key,
        value: m.value,
        unit: MEASUREMENT_KEYS[key]?.unit || null,
        calc: m.calc || null,
      })),
      services: (production?.services || []).map((s) => ({
        runId: s.runId,
        productId: s.productId,
        name: s.name,
        production: s.production,
        quantity: s.quantity,
        quantitySource: s.quantitySource,
        unit: s.unit,
        hours: s.hours,
      })),
      hours,
      hoursSource: byServices ? "services" : hours > 0 ? "trade" : "none",
      // What the rate replaced, so the tab can say so instead of a number
      // changing with no explanation. Only the book's takeoff hours are known
      // here; 0 is not printed.
      replacedBookHours: byServices && bookHours > 0 ? bookHours : null,
    };
    totals.hours = round2(totals.hours + hours);

    if (mayCost) {
      const labourCost = round2(hours * rate);
      const materials = round2(num(est?.materialTotal) + num(lineCostOf(g)));
      row.labourCost = labourCost;
      row.materials = materials;
      totals.labourCost = round2(totals.labourCost + labourCost);
      totals.materials = round2(totals.materials + materials);
    }
    if (showPricing) {
      const price = round2(priceOf(g));
      row.price = price;
      totals.price = round2(totals.price + price);
      // Before overhead: overhead is the job's, charged once in Cost &
      // margin, and splitting it across services would be a number nobody
      // decided. Null, not 0, with nothing to measure against.
      if (mayCost) row.margin = price > 0 ? round2(((price - row.labourCost - row.materials) / price) * 100) : null;
    }
    rows.push(row);
  }
  if (mayCost && showPricing) {
    totals.margin = totals.price > 0 ? round2(((totals.price - totals.labourCost - totals.materials) / totals.price) * 100) : null;
  }
  return { rows, totals };
}

/** "250 sq ft / hr", "12 each / day", "1.5 h per each" — as the parts the screen translates. */
export function productionParts(production) {
  if (!production || typeof production !== "object") return null;
  const unit = MEASUREMENT_KEYS[production.key]?.unit || null;
  return { amount: production.amount, basis: production.basis, unit, key: production.key };
}
