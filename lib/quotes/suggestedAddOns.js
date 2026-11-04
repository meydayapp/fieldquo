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

import { OFFER_CAP, normaliseOfferRefs, catalogueOfferFor, offeredProductCategories, offerKey } from "@/lib/quotes/builderOffers";
import { CATALOGUE_ADD_ON_SOURCE, catalogueRowName } from "@/lib/quotes/offeredAddOns";
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
  // The catalogue extras already on the quote, by the product name their text
  // was built from. Matched to products below, so a history reference for a
  // category one of them belongs to is refused as the same upgrade twice.
  const offeredNames = existing
    .filter((e) => e.source === CATALOGUE_ADD_ON_SOURCE)
    .map((e) => e.description);
  let room = OFFER_CAP - existing.filter((e) => e.source !== "takeoff").length;
  const seen = new Set([
    ...existing.map((e) => lower(e.description)),
    // Not offered as an option when it is already billed as a line.
    ...groups.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []).map((l) => lower(l?.description))),
  ]);
  const onQuote = new Set(groups.map((g) => g.categoryId));

  const productIds = clean.filter((r) => r.kind === "catalog").map((r) => r.productId);
  const historyIds = clean.filter((r) => r.kind === "history").map((r) => r.categoryId);
  // Only read when a history reference could collide with one.
  const coveredNames = historyIds.length ? [...new Set(offeredNames.map(catalogueRowName).filter(Boolean))] : [];

  const [products, covering, categories, prices] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { companyId, active: true, id: { in: productIds } },
          select: { id: true, name: true, description: true, unit: true, unitPrice: true, active: true, categories: { select: { id: true } } },
        })
      : [],
    coveredNames.length
      ? prisma.product.findMany({
          where: { companyId, active: true, name: { in: coveredNames } },
          select: { name: true, categories: { select: { id: true } } },
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
  // Every clicked catalogue reference priced ONCE, before anything is
  // written. Decided up front rather than inside the loop so the covered set
  // below is the same whatever order the browser listed the references in —
  // a request is not a sequence of decisions, and "the hinges suppressed the
  // service, unless the service came first" is not a rule anybody could
  // explain to the owner. `undefined` is a reference to nothing, `null` one
  // this quote cannot price.
  const offerForRef = new Map();
  for (const ref of clean) {
    if (ref.kind !== "catalog") continue;
    const product = productById.get(ref.productId);
    const group = groups.find((g) => g.categoryId === ref.categoryId);
    const linked = product && (product.categories || []).some((c) => c?.id === ref.categoryId);
    offerForRef.set(offerKey(ref), !product || !group || !linked ? undefined : catalogueOfferFor({ product, group }) || null);
  }

  // The categories the catalogue extras on this quote belong to — the rows
  // already saved, plus the clicked references that WILL become rows. A body
  // posting the hinges and the "New Hinges" service together cannot land
  // both; a reference that prices to nothing covers nothing, because then the
  // catalogue is offering nothing to be the duplicate of.
  const willOffer = clean.filter((r) => r.kind === "catalog" && offerForRef.get(offerKey(r)));
  const covered = offeredProductCategories({
    products: [...covering, ...products],
    descriptions: [...offeredNames, ...willOffer.map((r) => productById.get(r.productId)?.name).filter(Boolean)],
  });

  const rows = [];
  for (const ref of clean) {
    if (room <= 0) {
      skipped.push({ ref, reason: "full" });
      continue;
    }
    let row = null;
    if (ref.kind === "catalog") {
      const offer = offerForRef.get(offerKey(ref));
      if (offer === undefined) {
        skipped.push({ ref, reason: "unknown" });
        continue;
      }
      if (offer === null) {
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
      // The company's catalogue already offers this upgrade on this quote,
      // priced from its own rate card against this job's counts. One row.
      if (covered.has(ref.categoryId)) {
        skipped.push({ ref, reason: "alreadyOffered" });
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
