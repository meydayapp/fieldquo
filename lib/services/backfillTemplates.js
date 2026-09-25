// lib/services/backfillTemplates.js
//
// Give EXISTING companies the template lines their seeded services now carry.
// The owner: "include updating services and adding those line items for the
// services from those templates — services could be their version of
// templates." New companies get the lines at seed time (productDataForSeed);
// this fills the rows seeded before the seeds carried templates.
//
// ── The rule: fill what is empty, never overwrite ──────────────────────────
//
// For a Product with a `seedKey` whose seed row now carries templateLines:
//
//   templateLines    written only when the row's is null or []
//   defaultDiscount  written only when the row's is null
//   estimateTypes    written only when the row's is []
//   categories       quote-type links from the seed are connected only when
//                    the row has NO category at all — a company that removed
//                    a link on purpose does not get it back
//
// Never touched: unitPrice, costPrice, name, description, translations,
// templateEnabled, and anything on a row without a seedKey. Nothing is ever
// deleted. Running it twice changes nothing the second time (idempotent: a
// filled field is no longer empty).
//
// `planTemplateBackfill` is pure (the check executes it); `backfillTemplates`
// reads the database and, only with `apply: true`, writes. The dry run is the
// default everywhere — scripts/backfill-service-templates.mjs needs --apply.

import { db as defaultDb } from "@/lib/db";
import { seedServiceByKey, seedTemplateFor, seedCategoryKeys } from "@/lib/services/seeds";

const isEmptyJson = (v) => v == null || (Array.isArray(v) && v.length === 0);

/**
 * What to write on one product, or null when there is nothing to fill.
 *
 * @param product   { seedKey, templateLines, defaultDiscount, estimateTypes,
 *                    categories: [{ id }] }
 * @param seed      the seed service (seedServiceByKey), or null
 * @param language  the company's default language
 * @param currency  the company's currency
 * @param categoryIdsByKey  { quoteTypeKey: ServiceCategory.id } for the keys
 *                    the seed names (system categories only)
 * @returns { data, filled: string[] } | null
 */
export function planTemplateBackfill(product, seed, { language = "en", currency = "CAD", categoryIdsByKey = {} } = {}) {
  if (!product || !product.seedKey || !seed) return null;
  if (!Array.isArray(seed.templateLines) || seed.templateLines.length === 0) return null;
  const tpl = seedTemplateFor(seed, { language, currency });
  const data = {};
  const filled = [];
  if (isEmptyJson(product.templateLines) && tpl.templateLines) {
    data.templateLines = tpl.templateLines;
    filled.push("templateLines");
  }
  if (product.defaultDiscount == null && tpl.defaultDiscount) {
    data.defaultDiscount = tpl.defaultDiscount;
    filled.push("defaultDiscount");
  }
  if ((!Array.isArray(product.estimateTypes) || product.estimateTypes.length === 0) && tpl.estimateTypes.length) {
    data.estimateTypes = tpl.estimateTypes;
    filled.push("estimateTypes");
  }
  const cats = Array.isArray(product.categories) ? product.categories : [];
  if (cats.length === 0) {
    const ids = [...new Set(seedCategoryKeys(seed).map((k) => categoryIdsByKey?.[k]).filter((id) => typeof id === "string" && id))];
    if (ids.length) {
      data.categories = { connect: ids.map((id) => ({ id })) };
      filled.push("categories");
    }
  }
  return filled.length ? { data, filled } : null;
}

/**
 * Walk the seeded products (optionally one company, optionally one seed-key
 * prefix) and fill what is empty.
 *
 * @returns { companies: [{ companyId, name, isDemo, scanned, eligible,
 *            toFill, fields: { templateLines, defaultDiscount, estimateTypes,
 *            categories } }], totals, applied }
 */
export async function backfillTemplates({ db = defaultDb, companyId = null, seedKeyPrefix = null, apply = false } = {}) {
  const where = { seedKey: { not: null } };
  if (companyId) where.companyId = companyId;
  if (seedKeyPrefix) where.seedKey = { startsWith: seedKeyPrefix };
  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      seedKey: true,
      templateLines: true,
      defaultDiscount: true,
      estimateTypes: true,
      categories: { select: { id: true } },
      company: { select: { name: true, isDemo: true, defaultLanguage: true, currency: true } },
    },
  });

  // Resolve every quote-type key the seeds name, once, to system categories.
  const wanted = new Set();
  for (const p of products) for (const k of seedCategoryKeys(seedServiceByKey(p.seedKey))) wanted.add(k);
  const categoryIdsByKey = {};
  if (wanted.size) {
    const rows = await db.serviceCategory.findMany({ where: { companyId: null, key: { in: [...wanted] } }, select: { id: true, key: true } });
    for (const r of rows) categoryIdsByKey[r.key] = r.id;
  }

  const byCompany = new Map();
  const totals = { scanned: 0, eligible: 0, toFill: 0, fields: { templateLines: 0, defaultDiscount: 0, estimateTypes: 0, categories: 0 } };
  let applied = 0;
  for (const p of products) {
    const c = byCompany.get(p.companyId) || {
      companyId: p.companyId,
      name: p.company?.name || "",
      isDemo: Boolean(p.company?.isDemo),
      scanned: 0,
      eligible: 0,
      toFill: 0,
      fields: { templateLines: 0, defaultDiscount: 0, estimateTypes: 0, categories: 0 },
    };
    byCompany.set(p.companyId, c);
    c.scanned += 1;
    totals.scanned += 1;
    const seed = seedServiceByKey(p.seedKey);
    if (!seed || !Array.isArray(seed.templateLines) || seed.templateLines.length === 0) continue;
    c.eligible += 1;
    totals.eligible += 1;
    const plan = planTemplateBackfill(p, seed, {
      language: p.company?.defaultLanguage || "en",
      currency: p.company?.currency || "CAD",
      categoryIdsByKey,
    });
    if (!plan) continue;
    c.toFill += 1;
    totals.toFill += 1;
    for (const f of plan.filled) {
      c.fields[f] += 1;
      totals.fields[f] += 1;
    }
    if (apply) {
      await db.product.update({ where: { id: p.id }, data: plan.data });
      applied += 1;
    }
  }
  return { companies: [...byCompany.values()].filter((c) => c.eligible > 0), totals, applied };
}
