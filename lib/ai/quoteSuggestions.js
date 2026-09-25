// lib/ai/quoteSuggestions.js
// RULE-BASED — no LLM call. Looks at which service categories have historically
// appeared together on accepted quotes, and suggests the most common pairings for
// whatever categories are currently on the quote being built.
//
// Two callers, one arithmetic: the AI review's "often sold alongside" add-ons
// (lib/ai/quoteReview.js, on a saved quote) and the quote builder's "Often
// added with this" row (POST /api/ai/quote-suggestions, while the quote is
// still being written). The owner's report was that the add-ons turned up at
// review and not while creating; the fix is the same suggestions, earlier —
// not a second, drifting copy of them.

import { db } from "@/lib/db";
import { median } from "@/lib/quotes/reviewFindings";

const num = (v) => Number(v ?? 0);

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
      // The same percentage the note states, as a number, so a screen can
      // say it in its reader's language instead of printing this English.
      share: Math.round((entry.count / pastQuotes.length) * 100),
      // Carried for a caller that writes the label onto a document in the
      // DOCUMENT's language (non-negotiable #6) — a fixed trade-name lookup,
      // never a machine translation.
      labelTranslations: entry.category.labelTranslations ?? null,
      note: `Added alongside this ${Math.round((entry.count / pastQuotes.length) * 100)}% of the time`,
    }));
}

/**
 * What this company typically charges for a given category, so a suggested
 * add-on arrives with a real price rather than a blank box.
 *
 * Median of the scope-group subtotal on quotes that were actually accepted —
 * a price that has been said yes to before, not an average of hopeful asks.
 *
 * Moved here from lib/ai/quoteReview.js when the builder became its second
 * caller: the review and the builder's offer must price the same suggestion
 * the same way, and two copies of a median would agree until one changed.
 */
export async function typicalPriceByCategory(companyId, categoryIds) {
  if (!categoryIds.length) return {};

  const groups = await db.quoteScopeGroup.findMany({
    where: {
      categoryId: { in: categoryIds },
      quote: { companyId, status: "accepted" },
    },
    select: { categoryId: true, subtotal: true },
    take: 500,
  });

  const byCategory = {};
  for (const g of groups) {
    const v = num(g.subtotal);
    if (v <= 0) continue;
    (byCategory[g.categoryId] ||= []).push(v);
  }

  return Object.fromEntries(
    Object.entries(byCategory).map(([id, values]) => [
      id,
      { amount: Math.round(median(values)), sampleSize: values.length },
    ]),
  );
}

/** A trade name in the document's language — the stored lookup, else its label. */
export function categoryLabelIn(category, language) {
  const lang = String(language || "").slice(0, 2).toLowerCase();
  const t = category?.labelTranslations;
  const own = t && typeof t === "object" && Object.prototype.hasOwnProperty.call(t, lang) ? t[lang] : null;
  return String(own || category?.label || "").trim();
}

/**
 * The builder's "Often added with this": per service on the quote, the
 * services this company's own history sells alongside it, each with the
 * median its accepted quotes carried — or null, and then the builder does
 * not offer it, because an offer needs a number and inventing one is worse
 * than saying nothing.
 *
 * `onQuote` is every category already on the quote: a suggestion for one of
 * those is not a suggestion.
 *
 * @returns {Promise<Record<string, Array<{categoryId, label, share, frequency,
 *            amount: number|null, sampleSize: number}>>>}
 */
export async function getSuggestionsByCategory({ companyId, categoryIds, onQuote = [], language = "en" }) {
  const ids = [...new Set((Array.isArray(categoryIds) ? categoryIds : []).filter((x) => typeof x === "string" && x))].slice(0, 12);
  const exclude = new Set([...ids, ...(Array.isArray(onQuote) ? onQuote : [])]);
  const perCategory = await Promise.all(
    ids.map(async (id) => [id, await getSuggestedAddOns({ companyId, currentCategoryIds: [id] })]),
  );
  const wanted = [...new Set(perCategory.flatMap(([, list]) => list.map((s) => s.categoryId)))].filter((id) => !exclude.has(id));
  const prices = await typicalPriceByCategory(companyId, wanted);

  return Object.fromEntries(
    perCategory.map(([id, list]) => [
      id,
      list
        .filter((s) => !exclude.has(s.categoryId))
        .map((s) => ({
          categoryId: s.categoryId,
          label: categoryLabelIn(s, language),
          share: s.share,
          frequency: s.frequency,
          amount: prices[s.categoryId]?.amount > 0 ? prices[s.categoryId].amount : null,
          sampleSize: prices[s.categoryId]?.sampleSize ?? 0,
        })),
    ]),
  );
}
