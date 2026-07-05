// lib/ai/quoteSuggestions.js
// RULE-BASED — no LLM call. Looks at which service categories have historically
// appeared together on accepted quotes, and suggests the most common pairings for
// whatever categories are currently on the quote being built.

import { db } from "@/lib/db";

export async function getSuggestedAddOns({ companyId, currentCategoryIds }) {
  if (!currentCategoryIds || currentCategoryIds.length === 0) return [];

  const pastQuotes = await db.quote.findMany({
    where: {
      companyId,
      status: { in: ["accepted", "sent"] },
      scopeGroups: { some: { categoryId: { in: currentCategoryIds } } },
    },
    include: { scopeGroups: { include: { category: true } } },
    take: 200, // enough history for a reasonable signal without scanning the whole table
  });

  const coOccurrence = {};

  for (const quote of pastQuotes) {
    const categoryIdsOnQuote = quote.scopeGroups.map((g) => g.categoryId);
    const hasCurrentCategory = categoryIdsOnQuote.some((id) =>
      currentCategoryIds.includes(id),
    );
    if (!hasCurrentCategory) continue;

    for (const group of quote.scopeGroups) {
      if (currentCategoryIds.includes(group.categoryId)) continue; // already on this quote
      if (!coOccurrence[group.categoryId]) {
        coOccurrence[group.categoryId] = { category: group.category, count: 0 };
      }
      coOccurrence[group.categoryId].count++;
    }
  }

  return Object.values(coOccurrence)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => ({
      categoryId: entry.category.id,
      label: entry.category.label,
      frequency: entry.count,
      note: `Added alongside this ${Math.round((entry.count / pastQuotes.length) * 100)}% of the time`,
    }));
}
