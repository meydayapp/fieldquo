// lib/quotes/suggestedAddOns.js
//
// The server half of the builder's "Often added with this" (lib/quotes/
// builderOffers.js): the references the estimator clicked become offered
// QuoteAddOn rows, PRICED HERE from this company's own rows — never from
// anything the browser sent (non-negotiable #5).
//
//   catalog  → the Product at the company's price × this quote's own count,
//              through the same catalogueAddOnsFor the creation seed uses, so
//              a clicked offer and a seeded one cannot price differently.
//   history  → the median this company's ACCEPTED quotes carried for that
//              service (typicalPriceByCategory — the review's own figure).
//              No history, no price, no row: an offer the client can tick
//              must have a number, and the estimator is the one who has it.
//
// Runs after the quote is saved, best-effort like the seed beside it: a
// failure here must not report the quote as unsaved. Called AFTER
// seedCatalogueAddOns on a create, so the seed's "only when nothing is
// offered yet" rule sees exactly what it always saw; a clicked offer the seed
// already wrote is skipped as a duplicate, never written twice.

import { OFFER_CAP, normaliseOfferRefs, catalogueOfferFor } from "@/lib/quotes/builderOffers";
import { CATALOGUE_ADD_ON_SOURCE } from "@/lib/quotes/offeredAddOns";
import { typicalPriceByCategory, categoryLabelIn } from "@/lib/ai/quoteSuggestions";
import { tradeExcludedBy } from "@/lib/trades/catalog";

const lower = (v) => String(v ?? "").trim().toLowerCase();

/**
 * @param {object} prisma
 * @param {object} p
 * @param {string} p.companyId
 * @param {string} p.quoteId
 * @param {Array}  p.refs         the request's `offerAddOns`
 * @param {Array}  p.scopeGroups  the quote's groups as saved (categoryId,
 *                                intakeValues, lineItems)
 * @param {string} p.language     the quote's language, for a history row's
 *                                trade name (a lookup, never a translation)
 * @param {Function} [p.priceHistory]  injectable for the check script;
 *                                defaults to typicalPriceByCategory
 * @returns {Promise<{ created: number, skipped: Array<{ ref, reason }> }>}
 */
export async function createOfferedAddOns(
  prisma,
  { companyId, quoteId, refs, scopeGroups, language = "en", priceHistory = typicalPriceByCategory },
) {
  const clean = normaliseOfferRefs(refs);
  const skipped = [];
  if (!clean.length || !companyId || !quoteId) return { created: 0, skipped };

  const groups = (Array.isArray(scopeGroups) ? scopeGroups : []).filter((g) => g && g.categoryId);
  const existing = await prisma.quoteAddOn.findMany({
    where: { quoteId },
    select: { description: true, source: true },
  });
  let room = OFFER_CAP - existing.filter((e) => e.source !== "takeoff").length;
  const seen = new Set([
    ...existing.map((e) => lower(e.description)),
    // Not offered as an option when it is already billed as a line.
    ...groups.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []).map((l) => lower(l?.description))),
  ]);
  const onQuote = new Set(groups.map((g) => g.categoryId));

  const productIds = clean.filter((r) => r.kind === "catalog").map((r) => r.productId);
  const historyIds = clean.filter((r) => r.kind === "history").map((r) => r.categoryId);

  const [products, categories, prices] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { companyId, active: true, id: { in: productIds } },
          select: { id: true, name: true, description: true, unit: true, unitPrice: true, active: true, categories: { select: { id: true } } },
        })
      : [],
    historyIds.length
      ? prisma.serviceCategory.findMany({
          // A system trade, or one of THIS company's own — never another
          // tenant's custom quote type. The quote's OWN categories come back
          // in the same read, because the keys of the trades already on the
          // quote are what decide whether a reference is an alternative to
          // one of them rather than an extra on top of it.
          where: {
            id: { in: [...new Set([...historyIds, ...groups.map((g) => g.categoryId)])] },
            OR: [{ companyId: null }, { companyId }],
          },
          select: { id: true, key: true, label: true, labelTranslations: true },
        })
      : [],
    historyIds.length ? priceHistory(companyId, historyIds) : {},
  ]);
  const productById = new Map(products.map((p) => [String(p.id), p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // Checked again HERE, not only where the chip was drawn: the browser can
  // post a reference the builder never offered, and hiding a button is not a
  // rule (AGENTS.md, non-negotiable #2's reasoning applied to money).
  const onQuoteKeys = [...onQuote].map((id) => categoryById.get(id)?.key).filter(Boolean);

  const rows = [];
  for (const ref of clean) {
    if (room <= 0) {
      skipped.push({ ref, reason: "full" });
      continue;
    }
    let row = null;
    if (ref.kind === "catalog") {
      const product = productById.get(ref.productId);
      const group = groups.find((g) => g.categoryId === ref.categoryId);
      const linked = product && (product.categories || []).some((c) => c?.id === ref.categoryId);
      if (!product || !group || !linked) {
        skipped.push({ ref, reason: "unknown" });
        continue;
      }
      const offer = catalogueOfferFor({ product, group });
      if (!offer) {
        skipped.push({ ref, reason: "unpriced" });
        continue;
      }
      row = { description: offer.description, detail: offer.detail, amount: offer.amount, source: CATALOGUE_ADD_ON_SOURCE };
    } else {
      const category = categoryById.get(ref.categoryId);
      if (!category || onQuote.has(ref.categoryId)) {
        skipped.push({ ref, reason: onQuote.has(ref.categoryId) ? "onQuote" : "unknown" });
        continue;
      }
      // Refinishing recoats the doors refacing replaces — the quote may carry
      // both as compared options, but neither is ever an extra on the other.
      if (tradeExcludedBy(category.key, onQuoteKeys)) {
        skipped.push({ ref, reason: "exclusive" });
        continue;
      }
      const amount = Number(prices?.[ref.categoryId]?.amount);
      if (!(amount > 0)) {
        skipped.push({ ref, reason: "unpriced" });
        continue;
      }
      row = { description: categoryLabelIn(category, language), detail: null, amount: Math.round(amount * 100) / 100, source: "history" };
    }
    if (!row.description || seen.has(lower(row.description))) {
      skipped.push({ ref, reason: "duplicate" });
      continue;
    }
    seen.add(lower(row.description));
    rows.push({
      quoteId,
      description: String(row.description).slice(0, 200),
      detail: row.detail ? String(row.detail).slice(0, 400) : null,
      amount: row.amount,
      taxable: true,
      source: row.source,
      // After the seed's 50s and the editor's 100s, so a builder offer
      // never reshuffles the rows the client already saw in order.
      sortOrder: 150 + rows.length,
    });
    room -= 1;
  }

  if (rows.length) await prisma.quoteAddOn.createMany({ data: rows });
  return { created: rows.length, skipped };
}
