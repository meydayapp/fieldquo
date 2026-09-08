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
import { getStandardAddOns, STANDARD_ADDONS } from "@/app/data/standardAddOns";
import { standardAddOnTranslations } from "@/app/data/standardAddOns.fr";

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
        // The one-line scope text. It reaches the quote line's `detail` when
        // the product is picked (lib/quotes/lineDetail.js) and from there the
        // client's document and the AI review — which is why a blank here
        // used to read as "this line is empty" in the review.
        description: a.description || null,
        // The French name and description, in the shape Product.translations
        // documents. The schema comment had promised this since the field was
        // declared; nothing wrote it until now.
        translations: standardAddOnTranslations(a.name) || undefined,
        type: a.type === "product" ? "product" : "service",
        unitPrice: a.unitPrice ?? null,
        unit: a.unit || null,
        categories: { connect: { id: categoryId } },
      },
    });
  }

  return { created: toCreate.length, linked: toLink.length };
}

/**
 * The catalogue description for a standard add-on, found by name.
 *
 * Names repeat across categories ("Soft-Close Hinges" is sold on refinishing
 * and refacing) and two of them carry slightly different sentences per
 * category; the first occurrence in STANDARD_ADDONS wins, deterministically,
 * which is the refinishing one for cabinets and the only one otherwise.
 */
export function standardAddOnDescription(name) {
  for (const list of Object.values(STANDARD_ADDONS)) {
    const hit = list.find((a) => a.name === name);
    if (hit?.description) return hit.description;
  }
  return null;
}

/**
 * What the description backfill would DO to one company's Product rows.
 *
 * Companies seeded before descriptions and translations were written have
 * rows with the standard names and nothing under them. This fills EXACTLY
 * those gaps: a description only where the row's own description is blank,
 * French only where the row has no French entry at all. A description the
 * company typed — even one that disagrees with the catalogue — is theirs and
 * is left alone; a row whose name is not a standard add-on is not touched,
 * because its blank is not ours to fill.
 *
 * Pure and exported so scripts/check-addon-descriptions.mjs can execute the
 * decision against fixtures; scripts/backfill-product-descriptions.mjs is the
 * caller that has a database.
 *
 * @param products  [{ id, name, description, translations }]
 * @returns [{ id, name, data: { description?, translations? } }] — one entry
 *          per row that would change, with only the fields that would be set
 */
export function planDescriptionBackfill(products = []) {
  const out = [];
  for (const p of Array.isArray(products) ? products : []) {
    if (!p || !p.name) continue;
    const catalogue = standardAddOnDescription(p.name);
    if (!catalogue) continue;

    const data = {};
    if (!String(p.description || "").trim()) data.description = catalogue;

    const fr = standardAddOnTranslations(p.name);
    const existing =
      p.translations && typeof p.translations === "object" ? p.translations : {};
    if (fr && !existing.fr) data.translations = { ...existing, ...fr };

    if (Object.keys(data).length) out.push({ id: p.id, name: p.name, data });
  }
  return out;
}
