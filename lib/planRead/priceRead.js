// lib/planRead/priceRead.js
//
// A stored drawing read, computed and priced NOW from the company's current
// books, services, labour rate, target and overhead — the one server path the
// draft quote, the margin-adjustment button, the conversation's pricing diff
// and the below-target notice all take (the screen's GET does the same in
// lib/planRead/view.js with the context it loaded). Nothing is stored: the
// price is always today's, from the model's quantities.
//
// With the first pass (lib/planRead/firstPass.js): height bands, prep, the
// daily setup, the crew plan and access priced from the company's rental
// rates or the cited reference — and each scoped draft (lib/planRead/
// slices.js) priced on its own.

import { db as realDb } from "@/lib/db";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";
import { companyMarginTarget } from "@/lib/costing/quoteCostEstimate";
import { priceProject } from "./pricing";
import { loadPaintBooks } from "./run";
import { computeRead } from "./computeRead";
import { firstPassOptions } from "./firstPass";
import { loadFirstPassContext } from "./firstPassContext";
import { priceSlices } from "./slices";
import { loadPricingContext, readPricing } from "./readPricing";

/** The company's pricing context, with the production loaders. */
export function pricingContextFor(companyId, { prisma = realDb } = {}) {
  return loadPricingContext(companyId, { prisma, minimumPrice: calculateMinimumPrice, marginTarget: companyMarginTarget });
}

/**
 * @param read   a PlanRead with its documents (lib/planRead/load.js)
 * @param model  the model to price — the stored one unless a caller is
 *               trying a change on (the conversation's diff)
 */
export async function priceReadNow(read, { companyId, prisma = realDb, ctx = null, model = read?.model, fpCtx = null } = {}) {
  if (!model) return null;
  const { books, own } = await loadPaintBooks(companyId, { prisma });
  const { computed: paint, trades } = computeRead(read, { books, model });
  const computed = { ...paint, trades };
  const fctx = fpCtx || (await loadFirstPassContext(companyId, { prisma }));
  const firstPass = firstPassOptions({ model, books, ctx: fctx });
  const pricedPaint = priceProject(paint, books, { firstPass });
  const pctx = ctx || (await pricingContextFor(companyId, { prisma }));
  const slices = priceSlices({ read: { ...read, model }, computed, books, firstPass, pctx, similar: read.similar || null });
  return { computed, pricedPaint, books, own, fctx, ctx: pctx, firstPass, slices, pricing: readPricing({ computed, pricedPaint, model, ctx: pctx }) };
}
