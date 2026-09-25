// lib/checklists/seedTemplates.js
//
// Installs a trade's checklists (app/data/checklistSeeds) into a company's
// own templates — JobChecklistTemplate rows WITH a companyId, which the
// company can then edit, re-flag or delete like any list it wrote.
//
// Sibling of lib/products/seedServices.js and called from inside it, so every
// path that seeds a trade's services (signup, switching a trade on, "Add
// missing services") seeds its checklists too, and Settings → Checklists has
// its own "Add the starter lists for my trades" for a company that predates
// this.
//
// ── Idempotent by seed key, and never an update ────────────────────────────
//
// A row is matched by (companyId, seedKey) — unique in the schema — so a trade
// switched off and on again adds nothing twice, and a list the company has
// reworded is never touched. The same rule as the service seeds: the seed is
// a starting point, the row is the company's from the moment it exists.
//
// ── One language on the row, the others alongside ─────────────────────────
//
// Name and item wording are written on the row in the company's language, and
// all eight languages ride along (template `translations`, item `i18n`) and
// are carried onto every job and visit the list is put on, so a crew member
// working in Punjabi reads Punjabi. A company whose language the seeds do not
// carry gets English on the row, never a blank.

import { db } from "@/lib/db";
import { checklistSeedsForTrade } from "@/app/data/checklistSeeds";
import { templateDataForSeed } from "@/lib/checklists/seedData";

// Re-exported so existing imports of the pure builder keep one address.
export { templateDataForSeed };

/**
 * @returns {{ created: number, skipped: number, total: number }}
 */
export async function seedChecklistTemplatesForTrade({ companyId, categoryId, categoryKey }) {
  const seeds = checklistSeedsForTrade(categoryKey);
  if (!seeds.length) return { created: 0, skipped: 0, total: 0 };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { defaultLanguage: true },
  });
  if (!company) return { created: 0, skipped: 0, total: 0 };

  const held = await db.jobChecklistTemplate.findMany({
    where: { companyId, seedKey: { in: seeds.map((s) => s.seedKey) } },
    select: { seedKey: true },
  });
  const have = new Set(held.map((row) => row.seedKey));
  const toCreate = seeds.filter((s) => !have.has(s.seedKey));

  if (toCreate.length) {
    // skipDuplicates: two trades switched on in one save both carry the
    // generic lists, and the unique (companyId, seedKey) index is what makes
    // the second one a no-op rather than an error.
    await db.jobChecklistTemplate.createMany({
      data: toCreate.map((seed) =>
        templateDataForSeed(seed, {
          companyId,
          categoryId,
          language: company.defaultLanguage || "en",
        }),
      ),
      skipDuplicates: true,
    });
  }

  return { created: toCreate.length, skipped: seeds.length - toCreate.length, total: seeds.length };
}
