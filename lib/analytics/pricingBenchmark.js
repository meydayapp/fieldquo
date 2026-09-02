// lib/analytics/pricingBenchmark.js
import { db } from "@/lib/db";

const MIN_SAMPLE_SIZE = 5; // don't surface a benchmark if too few quotes would de-anonymize competitors

// ── Demo companies are not contractors ─────────────────────────────────────
//
// Everything a seeded demo prices is invented (lib/demo/seedDemo.js), and the
// figures are chosen to make a walkthrough look good, not to be true. This
// benchmark is the one screen where one tenant's numbers are shown to another,
// so a demo's rates joining it means a real contractor is told what "companies
// like you charge" on the strength of a fixture — and reprices real work
// against it.
//
// The exposure needs shareAnonymizedPricing to be on for the demo, which it is
// not out of the seed today. That is not a guard: it is one checkbox on a
// settings page a sales rep is encouraged to click through during a demo, on
// an account that is deliberately re-dressed and re-configured between
// prospects. The same shape as the @example.com addresses in
// lib/email/demoMail.js — data standing in for a rule.
//
// It also breaks the k-anonymity floor below rather than merely skewing an
// average. MIN_SAMPLE_SIZE exists so a benchmark can never be published from
// so few quotes that a competitor's price is recoverable from it. Ten seeded
// demos clear that floor on their own, so a cohort that should have stayed
// hidden gets published — and if one real company sits inside it, the platform
// average minus nine known fixtures is that company's rate card.
const NOT_DEMO = { isDemo: false };

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
          // Both conditions on the same company, so a demo cannot contribute
          // however its own settings are left. See NOT_DEMO above.
          quote: { company: { shareAnonymizedPricing: true, ...NOT_DEMO } },
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
