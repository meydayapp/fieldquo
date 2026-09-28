// lib/estimate/approveEstimate.js
//
// The money an instant estimate is approved at, when the reviewer changes it.
//
// ── What the number on the review screen means ─────────────────────────────
//
// /app/estimate-reviews shows "Approve at [CAD] [____]" and opens the box on
// the quote's TOTAL — tax included — and an untouched box means "approve at
// the current total". So a figure typed there is the tax-inclusive total the
// client will be asked to pay, and the screen now says so under the box.
//
// POST /api/quotes/[id]/approve-estimate wrote that figure into `subtotal`
// AND `total` and left `tax` where it was: a 13% quote approved at 19,000
// stored subtotal 19,000 + tax 2,119 = total 19,000 — the tax charged on the
// wrong base and a total that is not the sum of its parts. This works the
// other way round, the way the rest of the quote system works:
//
//   rate      the one the document was written with — the stored resolution's
//             rate when it still explains the tax on the page, else the rate
//             the stored money implies (QuoteBuilder recovers an existing
//             quote's rate the same way; it never re-resolves, because an
//             older quote must not be repriced by today's settings);
//   subtotal  solved from the typed total at that rate (quoteTotalsFromTotal);
//   tax       charged on subtotal − discount, as quoteTotals always does;
//   lines     the difference between the new subtotal and what the lines add
//             up to becomes ONE "Price adjustment" line, in the document's
//             language, so the lines still add up to the subtotal — the same
//             answer the builder gives a price that differs from its lines
//             ("Job minimum adjustment", lib/pricing/tradeScope.js). The
//             measured lines are left exactly as measured.
//
// Pure: no db, no React. The route and the review screen both call it, so the
// split the screen previews is the split the route writes.

import { quoteTotalsFromTotal, round2 } from "@/lib/quotes/totals";
import { readTaxResolution, resolutionMatchesAmount, resolutionForDocument, manualTaxResolution } from "@/lib/tax/taxResolution";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** "Price adjustment", in the document's language (Quote.language is fixed). */
export const PRICE_ADJUSTMENT_LABEL = Object.freeze({
  en: "Price adjustment",
  fr: "Ajustement du prix",
  es: "Ajuste de precio",
  uk: "Коригування ціни",
  pa: "ਕੀਮਤ ਵਿੱਚ ਸੋਧ",
  tl: "Pagsasaayos ng presyo",
  de: "Preisanpassung",
  zh: "价格调整",
  it: "Adeguamento del prezzo",
});

export function priceAdjustmentLabel(language) {
  return PRICE_ADJUSTMENT_LABEL[String(language || "").toLowerCase()] || PRICE_ADJUSTMENT_LABEL.en;
}

/**
 * The tax rate (percent) the document was written with. 0 when tax is off.
 * @param quote { subtotal, discount, tax, taxEnabled, taxResolution }
 */
export function appliedTaxRate(quote) {
  if (!quote || quote.taxEnabled === false) return 0;
  const base = num(quote.subtotal) - num(quote.discount);
  const tax = num(quote.tax);
  const rec = readTaxResolution(quote.taxResolution);
  if (rec && resolutionMatchesAmount(rec, tax, base)) return num(rec.rate);
  return base > 0 ? +((tax / base) * 100).toFixed(4) : 0;
}

const sumLines = (lines) => (Array.isArray(lines) ? lines : []).reduce((s, l) => s + num(l?.amount), 0);

/**
 * What the document's lines add up to now. The scope groups are the lines
 * when there are any (an instant draft has exactly one, mirrored into
 * Quote.lineItems); a draft filed under no category has only the flat list.
 * Exported so the review queue can send the one figure its preview needs
 * without shipping every line to the browser.
 */
export function documentLinesTotal(quote) {
  const groups = Array.isArray(quote?.scopeGroups) ? quote.scopeGroups : [];
  return round2(groups.length ? groups.reduce((s, g) => s + sumLines(g?.lineItems), 0) : sumLines(quote?.lineItems));
}

/**
 * @param quote  { subtotal, discount, tax, total, taxEnabled, taxResolution,
 *                 language, lineItems, scopeGroups: [{ id, lineItems, subtotal }] }
 *                 — or, from the review queue, `taxRate` and `linesTotal` in
 *                 place of the tax record and the lines it never receives.
 * @param total  the tax-inclusive figure the reviewer typed
 * @returns null when `total` is not a positive number (approve as-is), else
 *   { subtotal, discount, taxableBase, tax, total, exact, taxRate, adjustment,
 *     quoteLineItems, group: { id, lineItems, subtotal } | null, taxResolution }
 */
export function approvedEstimateMoney(quote, total) {
  const typed = Number(total);
  if (!quote || !Number.isFinite(typed) || !(typed > 0)) return null;
  // `taxRate` is the queue's precomputed appliedTaxRate — the browser never
  // holds the tax record — so the screen splits at the rate the route will.
  const taxRate = quote.taxRate != null ? num(quote.taxRate) : appliedTaxRate(quote);
  const taxEnabled = quote.taxEnabled !== false;
  const t = quoteTotalsFromTotal({ total: typed, discount: quote.discount, taxRate, taxEnabled });

  // `linesTotal` is the queue's precomputed documentLinesTotal (the browser
  // holds no lines); the route passes the quote itself.
  const groups = Array.isArray(quote.scopeGroups) ? quote.scopeGroups : [];
  const current = quote.linesTotal != null ? num(quote.linesTotal) : documentLinesTotal(quote);
  const adjustment = round2(t.subtotal - current);

  let quoteLineItems = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  let group = null;
  if (adjustment !== 0) {
    const description = priceAdjustmentLabel(quote.language);
    const line = { description, quantity: 1, unit: "flat", rate: adjustment, amount: adjustment };
    quoteLineItems = [...quoteLineItems, line];
    if (groups.length) {
      const g = groups[0];
      const lineItems = [...(Array.isArray(g.lineItems) ? g.lineItems : []), line];
      group = { id: g.id, lineItems, subtotal: round2(sumLines(lineItems)) };
    }
  }

  // The stored record keeps explaining the tax when it still does (same
  // rate, new base); otherwise it becomes what the money now says — the
  // PATCH route's rule for a quote whose tax moved.
  const kept = readTaxResolution(quote.taxResolution);
  const taxResolution = !taxEnabled
    ? null
    : kept && resolutionMatchesAmount(kept, t.tax, t.taxableBase)
      ? kept
      : resolutionForDocument({ resolution: null, tax: t.tax, taxableBase: t.taxableBase, taxEnabled }) ?? manualTaxResolution(taxRate);

  return {
    subtotal: t.subtotal,
    discount: t.discount,
    taxableBase: t.taxableBase,
    tax: t.tax,
    total: t.total,
    exact: t.exact,
    taxRate,
    adjustment,
    quoteLineItems,
    group,
    taxResolution,
  };
}
