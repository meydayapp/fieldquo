// lib/marketing/homeSale.js
//
// The homepage's sale pill: which running promotion, if any, it may announce.
//
// ══ It announces a sale only where every visitor gets it ══════════════════
//
// The pill sits above the headline and says "40% off 1-year plans · ends
// Oct 31" to everybody. So the promotion behind it has to be one that every
// visitor would actually be charged — and "running" is not enough for that:
//
//   · Currency. The caller passes promotions already narrowed by
//     universalPromotions() — the same filter /pricing applies, for the same
//     reason: the page cannot know the visitor's currency.
//   · Plans. A sale scoped to Solo only cannot be announced as "off 1-year
//     plans". Every ladder card on the page must carry THIS promotion as the
//     offer it resolved to.
//   · Being the better deal. A year sale is measured against twelve months
//     and loses to the standing 1-year offer when it is weaker (a 10% "sale"
//     is 1,069.20 against the standing 990 — lib/pricing/planOffer.js). The
//     checkout then charges the standing offer, and a pill promising "10%
//     off" would be promising a price nobody pays. So the test is not "is it
//     live" but "is it what withOffers() resolved every card to", which is
//     exactly what the checkout will reprice with.
//
// Pure, and every figure comes off the promotion row and the resolved offers
// — nothing is typed here. scripts/check-homepage-sections.mjs executes it
// against the cases above.

import { promotionIntervals } from "@/lib/pricing/ladder";

/**
 * The promotion's name without a trailing "40%" when the pill is about to
 * say "40% off" beside it. "Fall Sale 40%" reads as "Fall Sale · 40% off
 * 1-year plans"; the original label is kept whenever the number in it is not
 * the discount (a label is typed by a person and may say anything).
 */
export function saleName(label, percent) {
  const raw = String(label || "").trim();
  if (!raw) return null;
  if (percent == null) return raw;
  const m = raw.match(/^(.*?)[\s\-–—·:]*(\d+(?:[.,]\d+)?)\s*%\s*(?:off)?\s*$/i);
  if (m && Number(m[2].replace(",", ".")) === Number(percent) && m[1].trim()) return m[1].trim();
  return raw;
}

/**
 * @param promotions  live promotions, already narrowed to every currency
 * @param plans       the ladder cards as withOffers() returned them
 * @returns null, or { id, name, kind, percent, intervals, durationMonths, endsAt }
 */
export function homeSalePill({ promotions = [], plans = [] } = {}) {
  const cards = (plans || []).filter((p) => p && p.tierKey && p.offers);
  if (!cards.length) return null;

  const winners = [];
  for (const promo of promotions || []) {
    if (!promo?.id || !promo.endsAt) continue;
    const intervals = promotionIntervals(promo);
    const everywhere = cards.every((card) =>
      intervals.every((interval) => card.offers?.[interval]?.available && card.offers[interval].promo?.id === promo.id),
    );
    if (!everywhere) continue;
    const percent =
      promo.discountKind === "percent" && Number(promo.discountValue) > 0 ? Number(promo.discountValue) : null;
    winners.push({
      id: promo.id,
      name: saleName(promo.label, percent),
      kind: promo.discountKind === "amount" ? "amount" : "percent",
      percent,
      intervals,
      durationMonths: Math.max(1, Math.floor(Number(promo.durationMonths) || 1)),
      endsAt: new Date(promo.endsAt).toISOString(),
    });
  }
  if (!winners.length) return null;
  // Two universal sales at once would be an operator's mistake, but the page
  // still has to pick one, the same one on every render: the bigger discount,
  // then the one ending first (the more urgent true statement), then id.
  winners.sort(
    (a, b) =>
      (b.percent ?? -1) - (a.percent ?? -1) ||
      new Date(a.endsAt) - new Date(b.endsAt) ||
      String(a.id).localeCompare(String(b.id)),
  );
  return winners[0];
}
