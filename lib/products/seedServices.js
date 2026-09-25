// lib/products/seedServices.js
//
// Writes a trade's seeded services into a company's Products & Services, as
// Product rows linked to the trade's ServiceCategory.
//
// Sibling of seedStandardAddOns.js and deliberately not merged into it: the
// add-ons match by NAME (they predate seed keys and a company may hold the same
// hinge under two trades), these match by `Product.seedKey`, which is what
// makes them safe to re-run after a company has renamed or repriced a row.
//
// ── The price that is written ──────────────────────────────────────────────
//
// The benchmark median, converted into the company's currency and rounded
// (lib/pricing/benchmarkFx.js), lands in `unitPrice` ONCE — at creation. That
// is the owner's decision of 2026-09-21: "use the median for the preset
// pricing … keep the low and max and median as guidelines for them to set
// their own custom rates." A service with no benchmark is created with no
// price, and the screen says "set your rate"; it is never given a placeholder.
//
// Nothing here ever updates a row. The seed is a starting point; the row is
// the company's from the moment it exists.

import { db } from "@/lib/db";
import { planServiceSeeds, seedText, serviceSeedsFor } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { seedChecklistTemplatesForTrade } from "@/lib/checklists/seedTemplates";

/**
 * The Prisma `data` for one seeded service. Pure and exported so the check can
 * assert what is written — the median converted, the takeoff-priced services
 * never here at all, the translations in the documented shape.
 */
export function productDataForSeed(service, { companyId, categoryId, language, currency }) {
  const { name, description, translations } = seedText(service, language);
  const price = suggestedIn(service.benchmark?.median, currency);
  return {
    companyId,
    seedKey: service.seedKey,
    name,
    description: description || null,
    translations: Object.keys(translations).length ? translations : undefined,
    type: "service",
    unitPrice: price ?? null,
    unit: service.unit || null,
    categories: { connect: { id: categoryId } },
  };
}

/**
 * @returns { created, skipped, referenceOnly, total } — `skipped` is what the
 *          company already held by seed key, `referenceOnly` the services the
 *          seed keeps for the takeoff and never writes as a flat price.
 *          `{ created: 0, ..., total: 0 }` for a trade with no seed.
 */
export async function seedServicesForTrade({ companyId, categoryId, categoryKey }) {
  // The trade's checklists ride on the same three call sites (signup, a trade
  // switched on, "Add missing services"). First, and on its own catch, because
  // a trade with no service seed (cabinet refinishing) still has checklists,
  // and a checklist hiccup must never cost the services below.
  await seedChecklistTemplatesForTrade({ companyId, categoryId, categoryKey }).catch((err) =>
    console.error("[seedServices] checklist seeding failed:", err?.message),
  );

  const seed = serviceSeedsFor(categoryKey);
  if (!seed) return { created: 0, skipped: 0, referenceOnly: 0, total: 0 };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { defaultLanguage: true, currency: true },
  });
  if (!company) return { created: 0, skipped: 0, referenceOnly: 0, total: 0 };

  const held = await db.product.findMany({
    where: { companyId, seedKey: { not: null } },
    select: { seedKey: true },
  });
  const plan = planServiceSeeds({
    seed,
    existingSeedKeys: held.map((p) => p.seedKey),
  });

  // A trade seeds up to ~110 rows. One create per row because the category
  // link is a many-to-many `connect`, which createMany cannot express; in
  // batches of ten so enabling plumbing is seconds, not a minute of serial
  // round trips to Neon. Partial success is fine: every row is keyed, so the
  // next run picks up exactly the ones that did not land.
  const opts = {
    companyId,
    categoryId,
    language: company.defaultLanguage || "en",
    currency: company.currency || "CAD",
  };
  for (let i = 0; i < plan.toCreate.length; i += 10) {
    await Promise.all(
      plan.toCreate
        .slice(i, i + 10)
        .map((service) => db.product.create({ data: productDataForSeed(service, opts) })),
    );
  }

  return {
    created: plan.toCreate.length,
    skipped: plan.skipped,
    referenceOnly: plan.referenceOnly,
    total: plan.total,
  };
}
