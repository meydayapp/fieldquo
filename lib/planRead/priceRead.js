// lib/planRead/priceRead.js
//
// A stored drawing read, computed and priced NOW from the company's current
// books, services, labour rate, target and overhead — the one server path the
// draft quote, the margin-adjustment button, the conversation's pricing diff
// and the below-target notice all take (the screen's GET does the same in
// lib/planRead/view.js with the context it loaded). Nothing is stored: the
// price is always today's, from the model's quantities.

import { db as realDb } from "@/lib/db";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";
import { companyMarginTarget } from "@/lib/costing/quoteCostEstimate";
import { buildDimIndex, computeProject } from "./projectModel";
import { priceProject } from "./pricing";
import { readInputs, loadPaintBooks } from "./run";
import { computeTrades, buildCountIndex, buildScheduleIndex } from "./tradeModel";
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
export async function priceReadNow(read, { companyId, prisma = realDb, ctx = null, model = read?.model } = {}) {
  if (!model) return null;
  const { books } = await loadPaintBooks(companyId, { prisma });
  const inputs = readInputs(read);
  const dims = buildDimIndex(inputs.sheets);
  const paint = computeProject(model, { dims, book: books.interior_painting, excel: inputs.excel, photoRead: read.photoRead });
  const trades = computeTrades(model, { dims, counts: buildCountIndex(inputs.sheets), schedules: buildScheduleIndex(inputs.sheets), excel: inputs.excel, photoRead: read.photoRead });
  const computed = { ...paint, trades };
  const pricedPaint = priceProject(paint, books);
  const pctx = ctx || (await pricingContextFor(companyId, { prisma }));
  return { computed, pricedPaint, books, ctx: pctx, pricing: readPricing({ computed, pricedPaint, model, ctx: pctx }) };
}
