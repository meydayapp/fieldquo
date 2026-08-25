// lib/documents/loadServiceSettings.js
//
// Attaches each scope group's per-company content overrides.
//
// Prisma can't join CompanyServiceCategory onto QuoteScopeGroup directly —
// the relation runs group → ServiceCategory → CompanyServiceCategory, and the
// row we want is the one matching BOTH that category and this company. So
// it's one extra query and a map, done here rather than repeated in the PDF
// route, the email renderer and the public quote endpoint, which is exactly
// how three copies of a query drift apart.
//
// Companies that have never customised anything — the overwhelming majority,
// and every company on day one — get no rows back and fall through to the
// defaults in serviceContent.js. That's the intended path, not a degraded one.

export async function attachServiceSettings(db, companyId, scopeGroups) {
  const groups = Array.isArray(scopeGroups) ? scopeGroups : [];
  if (!groups.length || !companyId) return groups;

  const categoryIds = [
    ...new Set(groups.map((g) => g.categoryId).filter(Boolean)),
  ];
  if (!categoryIds.length) return groups;

  const settings = await db.companyServiceCategory.findMany({
    where: { companyId, categoryId: { in: categoryIds } },
    select: {
      categoryId: true,
      accentColor: true,
      includedItems: true,
      processSteps: true,
      scopeDescription: true,
    },
  });

  // Nothing customised. Return the groups untouched rather than decorating
  // every one with an explicit null, so `g.companySettings || null` downstream
  // reads the same either way.
  if (!settings.length) return groups;

  const byCategory = new Map(settings.map((s) => [s.categoryId, s]));

  return groups.map((g) => ({
    ...g,
    companySettings: byCategory.get(g.categoryId) || null,
  }));
}
