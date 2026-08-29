// app/(marketing)/compare/entryPrice.js
//
// "Do they sell something cheaper than our cheapest?" — answered from the data
// rather than from a paragraph.
//
// ══ Why this exists at all ═════════════════════════════════════════════════
//
// QuoteIQ's entry tier is a third of FieldQuo's cheapest rung. There is no
// reading of a one-person comparison that favours us, and the temptation on a
// page like this is to write the concession as prose in compareCopy.js, where
// it is one deletion away from being gone and nothing notices. That is the
// same failure lib/marketing/competitors.js records the capability
// `entry_price_below_our_floor` to prevent, and this module is its rendering
// half: the sentence is assembled from THEIR published figure and OUR ladder,
// so it cannot be typed, cannot be softened, and cannot survive either number
// changing underneath it.
//
// ══ Why the comparison refuses more often than it answers ══════════════════
//
// "Cheaper than us" is only a sentence when the two prices are the same kind
// of thing. Every refusal below is a comparison that would have LOOKED right
// and been wrong:
//
//   • a yearly figure against a monthly rung. Projul publishes three annual
//     amounts; setting one of them beside $99 a month would be arithmetic
//     nobody did, in favour of whichever side you divided.
//   • an ANNUAL-PREPAID monthly-equivalent against our no-commitment monthly
//     price. QuoteIQ prints both — their entry tier is one figure billed
//     monthly and a lower one billed a year at a time — and our ladder's
//     default rung is monthly with nothing to commit to
//     (FIELDQUO_CAPABILITIES.monthly_billing). Comparing their committed price
//     against our uncommitted one understates us by their own annual discount
//     and is not a choice a buyer is ever offered.
//   • a tier with no stated seat count. "Unlimited users" and "1 user" are not
//     comparable to a one-seat rung, and `seatsIncluded: null` on QuoteIQ's Max
//     row is there precisely so nobody invents a ceiling to divide by.
//   • a figure withholdReason() rejects. Decided by that function, never
//     re-derived here — two places deciding what publishes is how the two
//     answers come to disagree.
//   • a currency our own ladder has no row for. FieldQuo carries the SAME
//     NUMBER in each currency it sells in, which is the only reason a USD
//     competitor can be set beside our price with no conversion anywhere. If
//     that ever stops being true, this refuses rather than quietly comparing
//     across currencies.
//
// Every refusal returns a REASON rather than a null, on the same principle as
// ./addOns.js: a renderer that cannot make the comparison should be able to
// say why, and a silent null is indistinguishable from a bug.
//
// ══ What this module may never do ══════════════════════════════════════════
//
// No arithmetic on an amount. It compares two numbers and returns both; it
// does not subtract them, does not compute a multiple, and does not convert.
// "Three times the price" is a phrase for a human to write once they have both
// figures in front of them, not a number for a static page to derive and then
// be wrong about the day either side reprices.

import {
  AXIS_BILLING,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  competitor as findCompetitor,
  withholdReason,
} from "@/lib/marketing/competitors";

/** The billing mode our own entry rung is sold on: monthly, nothing committed. */
const OUR_BILLING = "monthly_none";
/** The period our own entry rung is priced in. */
const OUR_PERIOD = "month";

/**
 * The cheapest thing they publish that is genuinely comparable to our entry
 * rung — or a refusal saying why there isn't one.
 *
 * Pure, and separate from `entryPriceGap` for the reason ./addOns.js gives
 * about `totalOf`: the interesting behaviour is every case where the
 * comparison must NOT be made, and most of those cases do not exist in the
 * live data. A function that read COMPETITORS itself could only ever be
 * checked against the one arrangement that happens to be safe today.
 *
 * @param {object[]} figures       one competitor's figures, unfiltered
 * @param {string[]} axes          the axes that competitor declares
 * @param {object}   ours          a SEAT_LADDER rung: { label, price, seats }
 * @param {string[]} currencies    the currencies our ladder is sold in
 * @param {boolean}  sameNumberBothCurrencies
 * @param {string|Date} asOf       required — see lib/marketing/competitors.js
 */
export function entryGapOf({
  figures,
  axes,
  ours,
  currencies,
  sameNumberBothCurrencies,
  asOf,
}) {
  if (!asOf) {
    throw new Error("entryGapOf: asOf is required — see lib/marketing/competitors.js");
  }
  const none = { theirs: null, ours: null };

  if (!ours || !Number.isFinite(ours.price)) {
    return { ...none, refusal: "we have no entry rung to compare against" };
  }
  // Not a formality. Our two currency rows carrying the same number is the
  // entire reason a USD competitor can be set beside a FieldQuo price with no
  // conversion on the page; if that stops being true there is no single number
  // of ours to compare and the honest move is to stop comparing.
  if (sameNumberBothCurrencies !== true) {
    return {
      ...none,
      refusal:
        "our own rungs no longer carry the same number in each currency, so there is no single price of ours to set beside theirs",
    };
  }

  const declaresBilling = Array.isArray(axes) && axes.includes(AXIS_BILLING);
  const candidates = (figures || []).filter((f) => {
    if (withholdReason(f, asOf) !== null) return false;
    if (f.price?.kind !== PRICE_AMOUNT) return false;
    if (!Number.isFinite(f.price.amount)) return false;
    if (f.price.per !== OUR_PERIOD) return false;
    if (!Array.isArray(currencies) || !currencies.includes(f.price.currency)) return false;
    // A tier whose seat count nobody established is not an entry-price
    // comparison. Unlimited is the live case (QuoteIQ Max) and it is a
    // different fact from "one user", not a bigger version of it.
    if (!Number.isInteger(f.seatsIncluded) || f.seatsIncluded < 1) return false;
    // Where they sell more than one billing mode, only the one ours is sold on.
    if (declaresBilling && f.axis?.billing !== OUR_BILLING) return false;
    return true;
  });

  if (candidates.length === 0) {
    return {
      ...none,
      refusal:
        "nothing they publish is a monthly price, with no commitment, for a stated number of users",
    };
  }

  const cheapest = candidates.reduce((best, f) =>
    f.price.amount < best.price.amount ? f : best,
  );

  if (!(cheapest.price.amount < ours.price)) {
    return {
      ...none,
      refusal: "their cheapest comparable published price is not below our entry rung",
    };
  }

  return { theirs: cheapest, ours, refusal: null };
}

/**
 * The same question, asked of a competitor by id.
 *
 * FieldQuo's side is imported from FIELDQUO_REFERENCE, which is SEAT_LADDER —
 * so the day Solo is repriced, this sentence reprices with it and nobody has
 * to remember a marketing page exists.
 */
export function entryPriceGap(competitorId, asOf) {
  const c = findCompetitor(competitorId);
  if (!c) return { theirs: null, ours: null, refusal: "no such competitor" };
  return entryGapOf({
    figures: c.figures,
    axes: c.axes,
    ours: FIELDQUO_REFERENCE.entryTier,
    currencies: FIELDQUO_REFERENCE.currencies,
    sameNumberBothCurrencies: FIELDQUO_REFERENCE.sameNumberBothCurrencies,
    asOf,
  });
}
