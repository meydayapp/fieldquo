// lib/products/seedStandardAddOns.js
//
// Seeds the standard add-on Products for a given category into a company's
// Products & Services catalog, linked to that category so they surface in the
// quote builder.
//
// ── The same upgrade belongs to more than one trade ────────────────────────
//
// Soft-close hinges, new handles, drawer slides, glass inserts and a two-tone
// finish are all sold on BOTH cabinet refinishing and cabinet refacing — they
// appear under both keys in app/data/standardAddOns.js, and the price books
// price them under both. Product.categories is many-to-many precisely so one
// row can serve both.
//
// It wasn't using it. The dedupe below skipped any add-on whose NAME the
// company already had, and skipping meant doing nothing at all — not linking
// the existing row to the new category. A cabinet shop that pressed "add
// standard items" on Refacing and then on Refinishing got `created: 0`, a
// green "0 items added", and a refinishing quote that still could not offer the
// handles it prices. The button reported success and moved nothing, which is
// the dead control AGENTS.md forbids.
//
// So a name that already exists is now LINKED to the category rather than
// skipped, and the count says which happened. Duplicating the row instead would
// have given the owner two "Soft-Close Hinges" to keep in step by hand, and the
// second one is the copy that rots.
//
// Still idempotent, and still never resurrects a deleted product: a row the
// company deleted on purpose has no name to match, so nothing links and nothing
// comes back. Prisma's `connect` on a relation that already exists is a no-op,
// so re-running changes nothing and reports nothing.

import { db } from "@/lib/db";
import { getStandardAddOns } from "@/app/data/standardAddOns";

/**
 * What seeding this category would DO, given what the company already has.
 *
 * Pure and exported so scripts/check-trade-catalog.mjs can execute it against a
 * real company's real Product rows without a database. The bug this replaced
 * was a decision, not a query — "already has the name, therefore nothing to
 * do" — and a decision that can only be reached through Prisma is a decision
 * nothing checks.
 *
 * @param addons    getStandardAddOns(categoryKey) output
 * @param existing  the company's Products matching those names, with their
 *                  category ids: [{ id, name, categoryIds: [] }]
 * @param categoryId the category being seeded
 * @returns { toCreate, toLink, alreadyLinked }
 */
export function planStandardAddOns({ addons = [], existing = [], categoryId }) {
  const byName = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((p) => p && p.name)
      .map((p) => [p.name, p]),
  );

  const toCreate = [];
  const toLink = [];
  const alreadyLinked = [];

  for (const a of Array.isArray(addons) ? addons : []) {
    const hit = byName.get(a.name);
    if (!hit) {
      toCreate.push(a);
    } else if ((hit.categoryIds || []).includes(categoryId)) {
      alreadyLinked.push(hit);
    } else {
      toLink.push(hit);
    }
  }
  return { toCreate, toLink, alreadyLinked };
}

/**
 * @returns { created, linked } — new products, and existing products the
 *          company already had that now also serve this category. The caller
 *          reports both, because "0 created, 5 linked" is a real outcome and
 *          reporting it as "0" is what hid this for months.
 */
export async function seedStandardAddOns({ companyId, categoryId, categoryKey }) {
  const addons = getStandardAddOns(categoryKey);
  if (addons.length === 0) return { created: 0, linked: 0 };

  // Names this company already has — dedupe against them (case-insensitive-ish
  // exact match is enough; these are system-generated names). The category ids
  // come back too, so an already-linked row isn't counted as newly linked.
  const existing = await db.product.findMany({
    where: { companyId, name: { in: addons.map((a) => a.name) } },
    select: { id: true, name: true, categories: { select: { id: true } } },
  });

  const { toCreate, toLink } = planStandardAddOns({
    addons,
    existing: existing.map((p) => ({
      id: p.id,
      name: p.name,
      categoryIds: p.categories.map((c) => c.id),
    })),
    categoryId,
  });

  for (const p of toLink) {
    await db.product.update({
      where: { id: p.id },
      data: { categories: { connect: { id: categoryId } } },
    });
  }

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
  }

  return { created: toCreate.length, linked: toLink.length };
}
