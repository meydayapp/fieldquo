// lib/planRead/readPricing.js
//
// A drawing read's pricing, end to end: the company's context loaded from
// its own records (loadPricingContext — server only), then priced and
// recommended in pure code (readPricing). One function the screen, the draft
// quote and the margin notification all call, so they cannot disagree.
//
//   painting    lib/planRead/pricing.js (the company's paint engine), costed
//               by quoteCostSummary — the Cost & margin panel's own formula
//   trades      lib/planRead/tradePricing.js (the ladder)
//   result      lib/planRead/recommendation.js (target margin, overhead by
//               crew time, the gap, the flags)
//
// The estimator's own figures from the conversation (model.pricingAssumptions,
// accepted through the manual "Update pricing from this conversation" button
// — lib/planRead/pricingChat.js) are applied here: a production rate, the
// labour cost rate, a material cost, waste, a what-if target margin. Each is
// shown on the line it changed, and none ever touches the company's settings.

import { quoteCostSummary } from "@/lib/costing/quoteCosting";
import { FALLBACK_LABOUR_RATE, FALLBACK_OVERHEAD_PCT } from "@/lib/costing/costingDefaults";
import { overheadRates, overheadInputsFrom } from "@/lib/costing/overheadShare";
import { priceTrades, assumptionsIndex, engineBooks } from "./tradePricing";
import { PRESET_HOME_CATEGORIES } from "@/lib/pricing/labourPresets";
import { recommendPrice } from "./recommendation";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The company's pricing context. Server only (it reads the database through
 * the injected prisma); every lookup is keyed by the company.
 *
 * @returns {{ currency, labour: { rate, source, workers }, target: { pct,
 *   isDefault }, overhead: { rates, fallbackPct, minimumPrice, hourlyFloor,
 *   minimumPerHour, needsCapacity }, books, services, enabledKeys }}
 */
export async function loadPricingContext(companyId, { prisma, minimumPrice, marginTarget } = {}) {
  // Each lookup degrades on its own: a missing figure is a labelled default
  // or an empty list, never a draft quote that cannot open.
  const soft = (promise, fallback) => promise.catch((err) => {
    console.error("[planRead] pricing context:", err?.message);
    return fallback;
  });
  const [company, workers, rateRows, products, enabled, min, target] = await Promise.all([
    soft(prisma.company.findUnique({ where: { id: companyId }, select: { currency: true } }), null),
    soft(prisma.worker.findMany({ where: { companyId, active: true, workType: "field" }, select: { hourlyRate: true } }), []),
    soft(
      prisma.companyServiceCategory.findMany({
        // The two engines' books, and the rate cards whose `presets` carry
        // the company's own labour figures (lib/pricing/labourPresets.js).
        where: { companyId, category: { key: { in: [...new Set(["drywall_install", "roofing_service", ...PRESET_HOME_CATEGORIES])] } } },
        select: { rates: true, category: { select: { key: true } } },
      }),
      [],
    ),
    soft(
      prisma.product.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, templateLines: true, production: true, templateEnabled: true, active: true, categories: { select: { key: true } } },
        take: 500,
      }),
      [],
    ),
    soft(prisma.companyServiceCategory.findMany({ where: { companyId, enabled: true }, select: { category: { select: { key: true } } } }), []),
    minimumPrice({ companyId }).catch(() => null),
    marginTarget(companyId).catch(() => null),
  ]);
  // The field crew's average cost rate, when anyone has one on file; the
  // costing default otherwise — and the screen says which.
  const rated = (workers || []).map((w) => num(w.hourlyRate)).filter((r) => r > 0);
  const labour = rated.length
    ? { rate: round2(rated.reduce((a, b) => a + b, 0) / rated.length), source: "crew", workers: rated.length }
    : { rate: FALLBACK_LABOUR_RATE, source: "fallback", workers: 0 };
  const inputs = overheadInputsFrom(min);
  const rates = overheadRates({
    monthlyFixedCosts: inputs.monthlyFixedCosts,
    billableHoursPerMonth: inputs.billableHoursPerMonth,
    jobsPerMonth: min && !min.error ? min.jobsPerMonth : null,
  });
  const ratesByCategory = Object.fromEntries((rateRows || []).map((r) => [r.category?.key, r.rates && typeof r.rates === "object" ? r.rates : null]));
  return {
    currency: String(company?.currency || "CAD").toUpperCase(),
    labour,
    target: target || { pct: 20, isDefault: true },
    overhead: {
      rates,
      fallbackPct: FALLBACK_OVERHEAD_PCT,
      minimumPrice: min && !min.error ? min.minimumPrice : null,
      hourlyFloor: min?.hourlyFloor ?? null,
      minimumPerHour: min?.minimumPerHour ?? null,
      needsCapacity: Boolean(min?.needsCapacity),
    },
    books: engineBooks(ratesByCategory),
    // Read only: the company's own labour figures win over FieldQuo's presets.
    presetRates: ratesByCategory,
    services: (products || []).map((p) => ({ ...p, categoryKeys: (p.categories || []).map((c) => c.key) })),
    enabledKeys: (enabled || []).map((r) => r.category?.key).filter(Boolean),
  };
}

/** Which blocks rest on a low-confidence quantity — "check before sending". */
function lowBlocksOf(computedTrades, priced) {
  const low = new Set();
  for (const pt of priced) {
    const tr = computedTrades.find((t) => t.tradeKey === pt.tradeKey);
    for (const b of pt.blocks) {
      if ((b.itemIds || []).some((id) => tr?.items.find((i) => i.id === id)?.quantity?.confidence === "low")) low.add(b.id);
    }
  }
  return low;
}

/**
 * Price a read. Pure — `ctx` is loadPricingContext's answer (or a fixture).
 *
 * @param computed      computeProject() with `trades` = computeTrades()
 * @param pricedPaint   priceProject() output (or null)
 * @param model         the stored model (for pricing assumptions / choices)
 */
export function readPricing({ computed, pricedPaint, model, ctx }) {
  const a = assumptionsIndex(model?.pricingAssumptions);
  const labour = a.labourRate ? { rate: a.labourRate.value, source: "conversation", quote: a.labourRate.quote } : ctx.labour;
  const target = a.targetPct ? { pct: a.targetPct.value, isDefault: false, whatIf: { pct: a.targetPct.value, companyPct: ctx.target.pct, quote: a.targetPct.quote } } : ctx.target;
  const trades = priceTrades(computed?.trades || [], {
    currency: ctx.currency,
    commercial: computed?.commercial === true,
    labourRate: labour.rate,
    books: ctx.books,
    services: ctx.services,
    presetRates: ctx.presetRates || {},
    assumptions: a,
  });

  // Painting, costed by the panel's own formula (quoteCostSummary): the
  // takeoff's hours at the labour cost rate, the paint recipe's materials.
  let painting = null;
  if (pricedPaint && pricedPaint.groups?.length) {
    const est = quoteCostSummary({
      scopeGroups: pricedPaint.groups.map((g) => ({ categoryKey: g.categoryKey, takeoff: g.takeoff })),
      labourRate: labour.rate,
      price: pricedPaint.paintTotal,
      // Overhead is the whole job's, worked out once over every trade.
      overheadPerJob: 0,
    });
    const lowLines = (pricedPaint.lines || []).filter((l) => l.estimated);
    painting = {
      price: num(pricedPaint.paintTotal),
      hours: num(est.labourHours),
      labourCost: num(est.labourCost),
      // The paint and the conditions' prep materials (the cost panel's own
      // bill — lib/costing/tradeMaterials.js), plus, on a first-pass read,
      // the sundries line and any quantity the estimator changed on the
      // read's material list.
      materialCost: round2(num(est.materialTotal) + num(pricedPaint.materials?.sundries) + num(pricedPaint.materials?.editDelta)),
      lowValue: round2(lowLines.reduce((n, l) => n + num(l.amount), 0)),
    };
  }
  // Every priced access line counts at cost — a person's price, the
  // company's own rental rate, or the cited reference (lib/planRead/
  // firstPass.js priceAccessLine), each named on its line.
  const equipment = {
    total: round2((pricedPaint?.access || []).reduce((n, x) => n + num(x.price), 0)),
    unpriced: pricedPaint?.unpricedAccess || 0,
    estimated: round2((pricedPaint?.access || []).filter((x) => x.priceSource === "reference" || x.priceSource === "company").reduce((n, x) => n + num(x.price), 0)),
  };
  const recommendation = recommendPrice({
    painting,
    trades,
    equipment,
    labour,
    target,
    overhead: ctx.overhead,
    lowBlocks: lowBlocksOf(computed?.trades || [], trades),
  });
  // The crew plan (first pass): each 2/3/4-painter option's labour at the
  // same labour cost rate the recommendation uses — the hours are the same
  // whatever the crew; the days, and so the equipment rental, are not.
  const plan = pricedPaint?.plan
    ? {
        ...pricedPaint.plan,
        labourRate: labour.rate,
        options: pricedPaint.plan.options.map((o) => ({ ...o, labourCost: round2(o.hours * labour.rate), cost: round2(o.hours * labour.rate + o.equipmentCost) })),
      }
    : null;
  return {
    currency: ctx.currency,
    labour,
    trades,
    painting,
    plan,
    recommendation,
    marginAdjustment: model?.pricing?.marginAdjustment || null,
    useSuggestions: model?.pricing?.useSuggestions || {},
    assumptions: (model?.pricingAssumptions || []).filter((x) => x && x.applied !== false),
    overheadSetup: { needsHours: ctx.overhead.rates?.perHour === null, needsCapacity: ctx.overhead.needsCapacity },
  };
}
