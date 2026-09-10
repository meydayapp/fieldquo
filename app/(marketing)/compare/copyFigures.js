// app/(marketing)/compare/copyFigures.js
//
// The amounts the editorial copy needs, and the reason it may not hold them.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// compareCopy.js opens by promising that not one number, price or currency
// lives in it — everything comes from the data modules, which carry the source
// URL, the vantage point, the verification and the date for every figure.
// Then five ledes and four <title>s were written with the numbers typed
// straight in: "$177 a month on top of a plan", "their Max tier, at $699 a
// month", "Ours is $99".
//
// Every one of them was true on the day it was typed. What makes them a defect
// rather than a shortcut is what happens next: they are the only amounts on
// these pages that no gate can reach. Rendered ninety-five days on, with every
// price row correctly emptied and every claim correctly redacted, the Jobber
// page went on saying "$177 a month" and the QuoteIQ page went on saying
// "starts at $29.99" — a competitor's price, on a static page, with no reading
// behind it. That is the exact failure the redactor in ComparisonPage.js was
// written for, arriving through a door nobody had thought to guard, and it was
// found by the check asserting that nothing of theirs survives a stale render.
//
// ══ What replaces them ═════════════════════════════════════════════════════
//
// A placeholder in the copy, resolved here from the same gated sources as the
// rest of the page. A figure that will not publish today resolves to the same
// bracketed marker the withheld rows and expired claims use, so the sentence
// keeps saying what it says and simply stops naming a number nobody has
// re-read. The copy therefore cannot go stale independently of the page it
// sits on, which is the only property that matters.
//
// Deliberately NOT a second copy of the arithmetic: `theirParity` is the tier
// parityFor() picked, `theirEntry` is the first rung of the same ladder the
// table renders, and `addOnTotal` is the sum caseRows prints. If the page and
// the lede ever disagree, that is a bug in one function rather than two
// numbers that were both typed by hand and drifted.

import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { addOnsFor, parityFor, tierLadder } from "@/lib/marketing/parity";

/**
 * What a sentence prints where a figure would go, when the figure will not
 * publish. The same words redactAmounts() puts in a claim, exported so the two
 * surfaces cannot drift into two different brackets.
 */
export const AMOUNT_WITHHELD = "[amount withheld]";

const moneyIn = (locale) => (n) =>
  typeof n === "number"
    ? `$${n % 1 === 0 ? n.toLocaleString(locale) : n.toFixed(2)}`
    : null;

/**
 * Every value the copy may name, for one competitor, on one day.
 *
 * `ourEntry` is the only one that cannot be withheld: it is our own price out
 * of our own ladder, and it does not go stale because nobody has to read it
 * off anybody's website.
 */
export function compareFigures(competitorId, asOf = null, locale = "en-CA") {
  const money = moneyIn(locale);
  const ladder = tierLadder(competitorId, asOf);
  const priced = ladder.filter((t) => typeof t.price === "number");
  const parityTier = parityFor(competitorId, { asOf }).tier;

  const addOns = addOnsFor(competitorId, asOf).filter(
    (a) => !a.includedFree && a.per === "month" && typeof a.price === "number",
  );

  const theirPrice = (tier) =>
    !tier || typeof tier.price !== "number"
      ? null
      : // An annual-only vendor is quoted at the size of the cheque. Saying
        // "their Max tier, at $1,199 a month" about a company that sells no
        // month is a billing option we invented for them.
        tier.annualOnly
        ? money(tier.annualTotal)
        : money(tier.price);

  return {
    ourEntry: money(SEAT_LADDER[0].price),
    theirEntry: theirPrice(priced[0]),
    theirParity: theirPrice(parityTier),
    addOnTotal: addOns.length ? money(addOns.reduce((n, a) => n + a.price, 0)) : null,
  };
}

/**
 * A copy string with its placeholders filled, or bracketed where they are not.
 *
 * An unknown placeholder is left exactly as written rather than blanked: a
 * translator who invents `{price}` should see `{price}` on the page and fix
 * it, not ship a sentence with a hole where a number was supposed to be.
 */
export function fillFigures(text, figures) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (whole, name) =>
    Object.hasOwn(figures || {}, name) ? (figures[name] ?? AMOUNT_WITHHELD) : whole,
  );
}
