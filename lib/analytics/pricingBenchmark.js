// lib/analytics/pricingBenchmark.js
import { db } from "@/lib/db";

const MIN_SAMPLE_SIZE = 5; // don't surface a benchmark if too few quotes would de-anonymize competitors

export async function getPricingBenchmark({ companyId }) {
  const company = await db.company.findUnique({ where: { id: companyId } });

  if (!company.shareAnonymizedPricing) {
    return { shareAnonymizedPricing: false, categories: [] };
  }

  const enabledCategories = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    include: { category: true },
  });

  const categories = await Promise.all(
    enabledCategories.map(async ({ category }) => {
      const yourGroups = await db.quoteScopeGroup.aggregate({
        where: { categoryId: category.id, quote: { companyId } },
        _avg: { subtotal: true },
        _count: true,
      });

      const platformGroups = await db.quoteScopeGroup.aggregate({
        where: {
          categoryId: category.id,
          quote: { company: { shareAnonymizedPricing: true } },
        },
        _avg: { subtotal: true },
        _count: true,
      });

      if (!yourGroups._count || platformGroups._count < MIN_SAMPLE_SIZE)
        return null;

      return {
        categoryId: category.id,
        label: category.label,
        yourAvgPrice: Math.round(Number(yourGroups._avg.subtotal || 0)),
        platformAvgPrice: Math.round(Number(platformGroups._avg.subtotal || 0)),
        sampleSize: platformGroups._count,
      };
    }),
  );

  return {
    shareAnonymizedPricing: true,
    categories: categories.filter(Boolean),
  };
}
