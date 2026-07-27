// lib/products/seedStandardAddOns.js
//
// Seeds the standard add-on Products for a given category into a company's
// Products & Services catalog, linked to that category so they surface in the
// quote builder. Idempotent: skips any add-on whose name already exists for
// the company (so re-running, or a company that deleted one on purpose, won't
// get duplicates — a deleted one simply won't come back unless its name is
// gone entirely). Returns the number of products actually created.

import { db } from "@/lib/db";
import { getStandardAddOns } from "@/app/data/standardAddOns";

export async function seedStandardAddOns({ companyId, categoryId, categoryKey }) {
  const addons = getStandardAddOns(categoryKey);
  if (addons.length === 0) return 0;

  // Names this company already has — dedupe against them (case-insensitive-ish
  // exact match is enough; these are system-generated names).
  const existing = await db.product.findMany({
    where: { companyId, name: { in: addons.map((a) => a.name) } },
    select: { id: true, name: true },
  });
  const existingNames = new Set(existing.map((p) => p.name));

  const toCreate = addons.filter((a) => !existingNames.has(a.name));
  let created = 0;

  for (const a of toCreate) {
    await db.product.create({
      data: {
        companyId,
        name: a.name,
        description: a.description || null,
        type: a.type === "product" ? "product" : "service",
        unitPrice: a.unitPrice ?? null,
        unit: a.unit || null,
        categories: { connect: { id: categoryId } },
      },
    });
    created++;
  }

  return created;
}
