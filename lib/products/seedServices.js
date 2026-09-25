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
import { planServiceSeeds, seedText, seedTemplateFor, seedCategoryKeys, serviceSeedsForCompanyTrade } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { backfillTemplates } from "@/lib/services/backfillTemplates";

/**
 * The Prisma `data` for one seeded service. Pure and exported so the check can
 * assert what is written — the median converted, the takeoff-priced services
 * never here at all, the translations in the documented shape.
 */
export function productDataForSeed(service, { companyId, categoryId, language, currency, country = null, categoryIdsByKey = null }) {
  const { name, description, translations } = seedText(service, language);
  const price = suggestedIn(service.benchmark?.median, currency);
  // The template inside the service, converted like the price. Absent keys
  // (not nulls) for a service without one, so Prisma leaves the Json columns
  // null rather than being handed a bare null it refuses.
  const { templateLines, defaultDiscount, imageUrl, estimateTypes } = seedTemplateFor(service, { language, currency, country });
  // The quote types the template is offered on: the trade being seeded,
  // always, plus every key the seed names that the caller resolved to a
  // system category id. An unknown key links nothing — never a guess.
  const extraIds = seedCategoryKeys(service)
    .map((k) => (categoryIdsByKey && typeof categoryIdsByKey === "object" ? categoryIdsByKey[k] : null))
    .filter((id) => typeof id === "string" && id && id !== categoryId);
  const connect = [{ id: categoryId }, ...[...new Set(extraIds)].map((id) => ({ id }))];
  return {
    companyId,
    seedKey: service.seedKey,
    name,
    description: description || null,
    translations: Object.keys(translations).length ? translations : undefined,
    type: "service",
    unitPrice: price ?? null,
    unit: service.unit || null,
    ...(templateLines ? { templateLines } : {}),
    ...(defaultDiscount ? { defaultDiscount } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(estimateTypes.length ? { estimateTypes } : {}),
    categories: { connect: connect.length === 1 ? connect[0] : connect },
  };
}

/**
 * @returns { created, skipped, referenceOnly, total } — `skipped` is what the
 *          company already held by seed key, `referenceOnly` the services the
 *          seed keeps for the takeoff and never writes as a flat price.
 *          `{ created: 0, ..., total: 0 }` for a trade with no seed.
 */
export async function seedServicesForTrade({ companyId, categoryId, categoryKey }) {
  // The trade's own rows plus every other trade's row tagged for it
  // (lib/services/seeds.js#serviceSeedsForCompanyTrade) — one canonical row
  // per shared service, never a copy per trade.
  const seed = serviceSeedsForCompanyTrade(categoryKey);
  if (!seed) return { created: 0, skipped: 0, referenceOnly: 0, total: 0 };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { defaultLanguage: true, currency: true, country: true },
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
  // The quote-type keys the seed's templates name, resolved once to the
  // shared system categories (companyId null) — a company's own custom quote
  // type is never linked by a seed.
  const wanted = [...new Set(plan.toCreate.flatMap((s) => seedCategoryKeys(s, categoryKey)))];
  const categoryIdsByKey = {};
  if (wanted.length) {
    const rows = await db.serviceCategory.findMany({ where: { companyId: null, key: { in: wanted } }, select: { id: true, key: true } });
    for (const r of rows) categoryIdsByKey[r.key] = r.id;
  }
  const opts = {
    companyId,
    categoryId,
    language: company.defaultLanguage || "en",
    currency: company.currency || "CAD",
    country: company.country || null,
    categoryIdsByKey,
  };
  for (let i = 0; i < plan.toCreate.length; i += 10) {
    await Promise.all(
      plan.toCreate
        .slice(i, i + 10)
        .map((service) => db.product.create({ data: productDataForSeed(service, opts) })),
    );
  }

  // The services this company ALREADY held for the trade get the template
  // lines their seed now carries — filled only where empty, never
  // overwriting what the company changed, never touching a price
  // (lib/services/backfillTemplates.js). A company adding a trade it had
  // rows for, or pressing "Add missing services", gets the lines too.
  let templatesFilled = 0;
  if (plan.skipped > 0) {
    const r = await backfillTemplates({ companyId, seedKeyPrefix: `fq.${categoryKey}.`, apply: true });
    templatesFilled = r.applied;
  }

  return {
    created: plan.toCreate.length,
    skipped: plan.skipped,
    referenceOnly: plan.referenceOnly,
    total: plan.total,
    templatesFilled,
  };
}
