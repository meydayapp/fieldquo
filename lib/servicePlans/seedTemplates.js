// lib/servicePlans/seedTemplates.js
//
// Installs a trade's starter maintenance plans (app/data/planTemplateSeeds.js)
// as the company's own ServicePlanTemplate rows.
//
// Sibling of lib/checklists/seedTemplates.js and called from the same place —
// lib/products/seedServices.js — so every path that seeds a trade's services
// (signup, switching a trade on, "Add missing services") offers its plans too,
// and Settings → Maintenance plans has its own "Add starter plans for my
// trades" for a company that predates this.
//
// ── Idempotent by seed key, and never an update ────────────────────────────
//
// Matched on (companyId, seedKey), unique in the schema, with skipDuplicates —
// a trade switched off and on again adds nothing twice, two trades sharing a
// plan (HVAC install and repair) add it once, and a plan the company renamed,
// repriced or retired is never touched. The seed is a starting point; the row
// is the company's from the moment it exists.
//
// ── The price ──────────────────────────────────────────────────────────────
//
// suggestedIn() — the one exchange rate a suggested price may cross. USD as
// written, CAD converted and rounded to $5, anything else NULL: the template is
// installed unpriced and cannot be put on a quote until the company sets its
// own figure. Never a USD number wearing a euro sign.

import { db } from "@/lib/db";
import { planTemplateSeedsForTrade } from "@/app/data/planTemplateSeeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";

/**
 * The Prisma `data` for one seeded plan. Pure, for the check script.
 */
export function templateDataForPlanSeed(seed, { companyId, currency, productIdsBySeedKey = {}, sortOrder = 0 }) {
  const price = suggestedIn(seed.usd, currency);
  const includedProductIds = (seed.includes || [])
    .map((k) => productIdsBySeedKey[k])
    .filter((id) => typeof id === "string" && id);
  return {
    companyId,
    seedKey: seed.seedKey,
    name: seed.name,
    description: seed.description || undefined,
    frequency: seed.frequency,
    visitCount: Number.isInteger(seed.visitCount) ? seed.visitCount : null,
    pricePerVisit: price ?? null,
    discountPct: seed.discountPct || 0,
    includedProductIds: [...new Set(includedProductIds)],
    active: true,
    sortOrder,
  };
}

/**
 * @returns {{ created: number, skipped: number, total: number, unpriced: number }}
 */
export async function seedPlanTemplatesForTrade({ companyId, categoryId = null, categoryKey }) {
  const seeds = planTemplateSeedsForTrade(categoryKey);
  if (!seeds.length) return { created: 0, skipped: 0, total: 0, unpriced: 0 };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  if (!company) return { created: 0, skipped: 0, total: 0, unpriced: 0 };

  const held = await db.servicePlanTemplate.findMany({
    where: { companyId, seedKey: { in: seeds.map((s) => s.seedKey) } },
    select: { seedKey: true },
  });
  const have = new Set(held.map((r) => r.seedKey));
  const toCreate = seeds.filter((s) => !have.has(s.seedKey));
  if (!toCreate.length) return { created: 0, skipped: seeds.length, total: seeds.length, unpriced: 0 };

  // The company's own services the plans name, by seed key — linked only when
  // the company holds them. Nothing is created to make a link resolve.
  const wantedKeys = [...new Set(toCreate.flatMap((s) => s.includes || []))];
  const productIdsBySeedKey = {};
  if (wantedKeys.length) {
    const rows = await db.product.findMany({
      where: { companyId, seedKey: { in: wantedKeys }, active: true },
      select: { id: true, seedKey: true },
    });
    for (const r of rows) productIdsBySeedKey[r.seedKey] = r.id;
  }

  const currency = company.currency || "CAD";
  // After whatever the company already has, so a second trade's plans list
  // below the first's rather than interleaving with them.
  const already = await db.servicePlanTemplate.count({ where: { companyId } });
  const data = toCreate.map((seed, i) => ({
    ...templateDataForPlanSeed(seed, { companyId, currency, productIdsBySeedKey, sortOrder: already + i }),
    // The trade being seeded, for grouping on the settings screen.
    categoryId: categoryId || null,
  }));

  const result = await db.servicePlanTemplate.createMany({ data, skipDuplicates: true });
  return {
    created: result.count,
    skipped: seeds.length - toCreate.length,
    total: seeds.length,
    unpriced: data.filter((d) => d.pricePerVisit === null).length,
  };
}
