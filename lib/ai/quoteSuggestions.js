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
import { tradeExcludedBy } from "@/lib/trades/catalog";
import { isUnitPriced } from "@/app/data/cabinetPricing";

const num = (v) => Number(v ?? 0);

export async function getSuggestedAddOns({ companyId, currentCategoryIds, onQuoteKeys = null }) {
  if (!currentCategoryIds || currentCategoryIds.length === 0) return [];

  // The trades already on the quote, as catalogue keys, so a trade that is the
  // ALTERNATIVE to one of them is never offered as an extra on top of it
  // (EXCLUSIVE_TRADES, lib/trades/catalog.js — refinishing recoats the doors
  // refacing replaces). Resolved here when the caller has not done it;
  // getSuggestionsByCategory asks once for the whole quote, because it calls
  // this once per service and would otherwise ask per service.
  const presentKeys = Array.isArray(onQuoteKeys)
    ? onQuoteKeys
    : (
        await db.serviceCategory.findMany({
          where: { id: { in: currentCategoryIds } },
          select: { key: true },
        })
      )
        .map((c) => c.key)
        .filter(Boolean);

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
      // Counted together in the past, and that count is true — an estimator
      // priced both as OPTIONS for one client. Not countable as an extra.
      if (tradeExcludedBy(group.category?.key, presentKeys)) continue;
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
      // Why the figure beside this suggestion is missing, when it is. A trade
      // sold by the door gets no median (typicalPriceByCategory) — the review
      // must say that rather than "no price history yet", which for a company
      // with four accepted refacing jobs is simply untrue.
      pricedByTheUnit: isUnitPriced(entry.category.key),
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
 *
 * ── A median is not a price for a trade sold by the door ───────────────────
 *
 * The owner, 2026-11: refacing "shows wrong calculation based on the
 * company's pricing". It did. The same $5,500 came out on a three-door
 * kitchen and on a twenty-nine-door one, because a median of past scope-group
 * subtotals is the midpoint of the jobs behind it and knows nothing about the
 * job in front of it. For a trade priced per unit that is not an
 * approximation, it is a contradiction: the quote is carrying the very door
 * count the figure ignores, and the company's own per-door rate is in its
 * price book.
 *
 * So a unit-priced trade (UNIT_PRICED_CATEGORIES — the cabinet trades, where
 * the price IS a count times a rate) gets no median, and with no amount the
 * offer is not made at all: builderOfferRows and createOfferedAddOns both
 * already refuse an extra with no number. A wrong figure on a document a
 * homeowner signs is worse than an offer that is not made, and the estimator
 * who wants to offer that trade opens its calculator, which asks for the
 * count.
 *
 * Scaling the median instead — median per door from past quotes times this
 * quote's doors — was the other candidate and was rejected: it needs a
 * primary measure per trade that nothing stores, it is a second pricing
 * mechanism beside the price book that already does this arithmetic properly,
 * and it would put a number on a client's document that no accepted quote
 * ever carried. Trades that are not sold by the unit keep the median, which
 * is the only figure this company's own history supports for them.
 */
export async function typicalPriceByCategory(companyId, categoryIds) {
  if (!categoryIds.length) return {};

  const keys = await db.serviceCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, key: true },
  });
  const priceable = keys.filter((c) => !isUnitPriced(c.key)).map((c) => c.id);
  if (!priceable.length) return {};

  const groups = await db.quoteScopeGroup.findMany({
    where: {
      categoryId: { in: priceable },
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
  // Every trade on the quote, as keys, asked for ONCE. The per-service calls
  // below each see the whole quote, so a trade that is the alternative to any
  // service on it is not offered under a different one — a refinishing quote
  // that also carries flooring must not offer refacing under the flooring.
  const onQuoteKeys = exclude.size
    ? (
        await db.serviceCategory.findMany({
          where: { id: { in: [...exclude] } },
          select: { key: true },
        })
      )
        .map((c) => c.key)
        .filter(Boolean)
    : [];
  const perCategory = await Promise.all(
    ids.map(async (id) => [id, await getSuggestedAddOns({ companyId, currentCategoryIds: [id], onQuoteKeys })]),
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
