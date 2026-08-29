// lib/marketing/fx.js
//
// Turning a competitor's published USD figure into an approximate CAD one, at
// the moment it is rendered, without ever writing a converted number down.
//
// ══ What the old rule was, and why it was too blunt ════════════════════════
//
// lib/marketing/competitors.js banned currency conversion outright and its
// check enforced the ban structurally. The reasoning was right about the
// danger and wrong about the scope. What it was actually protecting against is
// a STATIC CONVERTED NUMBER baked into a statically rendered page: correct the
// day it ships, drifting every day after, a claim about somebody else's prices
// that nobody is watching.
//
// The thing it accidentally banned along the way is useful and honest: telling
// a Canadian reading "$399 USD" roughly what that is in his own money. He is
// going to do that arithmetic anyway, in his head, worse, and with no idea
// which rate he used.
//
// So the ban was narrowed rather than lifted:
//
//   • The DATA never converts. Every `amount` in competitors.js is still the
//     figure as published in the currency as published, still a bare integer
//     literal, still guarded by a check that rejects a decimal literal or a
//     conversion-shaped identifier anywhere in that file. Because a rate is a
//     decimal and that file may not contain one, the rate PHYSICALLY CANNOT
//     live there. That is not a convention; it is an assertion.
//
//   • The CONVERSION lives here, at presentation time, and every value it
//     produces carries its own limits with it.
//
// The dependency runs one way — this file imports competitors.js and
// competitors.js has never heard of this one — so no stored figure can arrive
// pre-converted.
//
// ══ Why a checked-in rate, and not a fetch ═════════════════════════════════
//
// Three options, and the middle one is the one this file rejects most firmly:
//
//   A fetch AT REQUEST TIME is wrong because /pricing and /compare are
//   statically rendered. There is no request to hang it off. Making them
//   dynamic to add an FX call would trade a fast page for a third-party
//   dependency on the critical path of a marketing page, which is a bad trade
//   even before the vendor has an outage.
//
//   A fetch AT BUILD TIME sounds better and is worse. The build would depend
//   on a third-party endpoint that can 503 — turning "somebody merged a typo
//   fix" into "the deploy failed because a central bank had a bad afternoon" —
//   and it would ship a different number on every deploy with no record of
//   which one went out. You could not review it, reproduce it, or answer "what
//   rate did the page show in September" afterwards.
//
//   A CHECKED-IN RATE with its date and its source is reviewable. It appears
//   in a diff. `git log -p lib/marketing/fx.js` is the complete history of
//   every rate this site has ever printed. Its weakness — it goes out of date
//   unless a human updates it — is the one weakness that can be made
//   self-limiting, and RATE_STALE_AFTER_DAYS below does exactly that: past the
//   window this module REFUSES, callers show the original figure alone, and
//   the page gets quieter rather than wrong.
//
// A human keeps it current by re-reading the source URL below and editing four
// fields: `rate`, `rateDate`, `readOn`, `readBy`. scripts/check-fx.mjs prints a
// warning against the real wall clock once the rate is inside 15 days of
// expiring, so the reminder arrives before the conversions disappear rather
// than after.

import {
  COMPETITORS,
  PRICE_AMOUNT,
  SOURCED_OWNER_ASSERTED,
  withholdReason,
} from "@/lib/marketing/competitors";
import { currencyLabel } from "@/lib/pricing/ladder";

/**
 * How old may a rate be before this module stops converting?
 *
 * 45 days, and the number is argued rather than rounded.
 *
 * The figures being converted run from $29 to $14,388, and the output is
 * rounded to two significant figures (see `approximateAmount`). Two
 * significant figures on those numbers is a step of roughly 1–3% of the value.
 * So the honest window is the one inside which USD/CAD's drift stays about
 * that size: the pair routinely moves 2% in six weeks and has repeatedly moved
 * more than 5% in a quarter. At 90 days — the window competitors.js uses for a
 * FIGURE — a converted $14,388 could be off by $700, which is larger than most
 * of the differences this page exists to show. At 45 it is usually inside the
 * rounding step, and where it is not, the printed rate and date let a reader
 * redo the arithmetic himself, which is the real safeguard.
 *
 * It is also longer than a calendar month, deliberately. A monthly re-read is
 * the shortest interval a two-person team actually keeps — the same argument
 * STALE_AFTER_DAYS makes in competitors.js — and 45 days gives that habit two
 * weeks of slack before the page silently loses its conversions.
 *
 * Unlike STALE_AFTER_DAYS this one REFUSES rather than warns, and the
 * difference is deliberate. A stale competitor figure is still a number
 * somebody read off a page; it is old, not invented. A stale rate produces a
 * number nobody ever read anywhere, which is a worse object to publish.
 */
export const RATE_STALE_AFTER_DAYS = 45;

/**
 * The rates, with the date each is FOR and the source it was read from.
 *
 * `rateDate` is the day the rate describes; `readOn` is the day somebody
 * fetched it. Staleness is measured from `rateDate`, which is the conservative
 * one — a rate published for the 28th does not become fresher because it was
 * downloaded on the 29th.
 *
 * A rate with no date or no source cannot be used, and that is enforced in
 * `rateRefusal` rather than trusted: the failure mode is somebody pasting a
 * number they saw somewhere, and the fields are what make that impossible to
 * do quietly.
 */
export const RATES = Object.freeze([
  Object.freeze({
    base: "USD",
    quote: "CAD",
    rate: 1.3888,
    rateDate: "2026-08-28",
    readOn: "2026-08-29",
    source: "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1",
    sourceName: "Bank of Canada, daily average USD/CAD (series FXUSDCAD)",
    readBy:
      "claude/opus-5 — requested the Bank of Canada Valet API and read observations[0].FXUSDCAD.v straight out of the JSON, not out of a summary or a search result",
    // Said out loud because it bounds what the output means. This is a central
    // bank's daily average, not a rate anybody can transact at: a card issuer
    // adds a spread and a fee on top. So a Canadian buying a USD-priced
    // competitor pays MORE than the figures this module produces, which means
    // the approximation errs against us and never in our favour. That is the
    // right direction for the error to run on a comparison page we publish.
    caveat: "a central bank daily average, not a rate you can transact at — a card adds a spread on top",
  }),
]);

/** Whole days between two ISO dates, or null if either is unreadable. */
function ageInDays(isoDate, asOf) {
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.floor((now - then) / 86400000);
}

export function rateAgeDays(rate, asOf) {
  if (!asOf) throw new Error("rateAgeDays: asOf is required — a rate is only fresh or stale against a date");
  return ageInDays(rate?.rateDate, asOf);
}

/**
 * Why this rate may not be used — or null if it may.
 *
 * Returns a reason rather than a boolean for the same reason `withholdReason`
 * does: the caller may want to say why the conversion is missing, and a
 * boolean gives it nothing to say.
 */
export function rateRefusal(rate, asOf) {
  if (!asOf) throw new Error("rateRefusal: asOf is required — see the comment on rateAgeDays");
  if (!rate) return "no rate for this pair";
  if (!Number.isFinite(rate.rate) || rate.rate <= 0) return "the rate is not a positive number";
  // A rate with no date is the one that can never be caught going stale,
  // because there is nothing to measure. Refused before anything else.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rate.rateDate || "")) return "the rate carries no date";
  if (!(typeof rate.source === "string" && rate.source.startsWith("https://"))) return "the rate names no source";
  if (!(typeof rate.sourceName === "string" && rate.sourceName.length > 5)) return "the rate's source is not named in words";
  const age = rateAgeDays(rate, asOf);
  if (age === null) return "the rate's date does not parse";
  // A rate dated in the future is not fresh, it is wrong. Treated as
  // unusable rather than as maximally fresh, which is what a naive
  // `age > window` test would do with a typo'd year.
  if (age < 0) return "the rate is dated in the future";
  if (age > RATE_STALE_AFTER_DAYS) {
    return `the rate is ${age} days old, past the ${RATE_STALE_AFTER_DAYS}-day window — re-read ${rate.source}`;
  }
  return null;
}

/** The recorded rate for a pair, in either direction, or null. */
export function rateFor(from, to) {
  const direct = RATES.find((r) => r.base === from && r.quote === to);
  if (direct) return direct;
  const inverse = RATES.find((r) => r.base === to && r.quote === from);
  return inverse || null;
}

/**
 * Round an approximation to two significant figures, never finer than $1.
 *
 * ══ Why not to the cent, or the dollar ═════════════════════════════════════
 *
 * $4,788 at 1.3888 is $6,648.66. Printing that is a lie about how well this is
 * known: the rate is one daily snapshot, up to 45 days old, of a pair that
 * moves a couple of percent inside that window, and it is a mid-market average
 * nobody transacts at. The third significant figure is not knowable from any
 * of that, so printing it invents precision — and precision is exactly what a
 * reader reads a specific number as claiming.
 *
 * Two significant figures gives "$6,600", which is the shape of a statement
 * somebody actually believes. Floored at $1 so a small figure never comes out
 * as a decimal: this module prints no cents at all, because a cent on an
 * approximation is absurd.
 */
export function approximateAmount(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const magnitude = Math.floor(Math.log10(n));
  const step = Math.max(1, Math.pow(10, magnitude - 1));
  return Math.round(n / step) * step;
}

// Two formatters, and the difference between them is the point.
//
// The CONVERTED figure never shows cents: it is an approximation and a cent on
// an approximation is invented precision. The ORIGINAL always shows whatever
// the vendor printed — QuoteIQ publishes $29.99, and quoting that back as "$30"
// would be us rounding somebody else's price, which is the one thing this whole
// module is against. The first version of this used one formatter for both and
// printed "published as US$30 a month" beside a page that says $29.99.
const groups = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const asPublished = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 });
const PER_WORDS = { month: "a month", year: "a year" };

/**
 * A converted figure that cannot be printed bare.
 *
 * ══ Why a class, and why it holds no reachable number ══════════════════════
 *
 * The whole risk of conversion is a converted number appearing on a page
 * without the rate and the date that make it meaningful. "Return an object and
 * ask the renderer to print all the fields" is a convention, and conventions
 * are what a template in a hurry drops.
 *
 * So there is no number to drop. The amount lives in a private field. `.amount`
 * is undefined, `Number(x)` and `x + 0` and `x < 5` all route through
 * `valueOf`, which throws. The only exits are `toString()` and `parts` — and
 * both of those are all strings, every one of which already contains its own
 * caveat. The converted figure is a string that BEGINS with "≈"; there is no
 * form of it that does not.
 *
 * The `Safe` wrapper in lib/export/accountingExport.js is the precedent, run
 * in the opposite direction: `Safe` marks a value as vouched for, this marks
 * one as never to be shown alone.
 */
export class Approximate {
  #parts;

  constructor(parts) {
    this.#parts = Object.freeze({ ...parts });
    Object.freeze(this);
  }

  /** Always true. A renderer branches on this rather than on a type check. */
  get approximate() {
    return true;
  }

  /**
   * Everything a renderer may lay out, and all of it is text.
   *
   * There is deliberately no numeric member. A caller wanting to sort or
   * compare converted figures is doing something this module will not
   * support — the honest comparison is between the ORIGINAL amounts, which
   * competitors.js has, unconverted, and can be compared exactly.
   */
  get parts() {
    return this.#parts;
  }

  toString() {
    const p = this.#parts;
    return `${p.converted} (${p.original}, ${p.rate}, ${p.rateDate}, ${p.rateSource}; ${p.rounding})`;
  }

  toJSON() {
    return { approximate: true, ...this.#parts };
  }

  /** Refuses to be a number, so a converted figure cannot be added, averaged,
   *  compared or formatted by anything that expected one. */
  valueOf() {
    throw new Error(
      "Approximate: refuses to be used as a number. A converted figure may only be rendered with its rate and date — use toString() or .parts.",
    );
  }
}

// Every observation this module will convert, by id, with the host its source
// must sit on. Built from the data rather than listed, so a competitor added
// to competitors.js is convertible and nothing else ever is.
const CONVERTIBLE = new Map();
for (const c of COMPETITORS) {
  const host = new URL(c.homepage).hostname.replace(/^www\./, "");
  for (const f of [...(c.figures || []), ...(c.addOns || [])]) {
    CONVERTIBLE.set(f.id, { host, competitorName: c.name });
  }
}

/**
 * Why this observation may not be converted — or null if it may.
 *
 * ══ Why an allowlist of ids, and not a shape check ═════════════════════════
 *
 * This is the guard that keeps FieldQuo's own prices out. SEAT_LADDER carries
 * the SAME NUMBER in CAD and USD by design — 99 CAD and 99 USD are both real
 * FieldQuo prices, not conversions of one another — so running our ladder
 * through an exchange rate would print $137 beside a plan we sell for $99.
 * That is not a stale number or a rounding argument; it is a price we do not
 * charge, on our own pricing page.
 *
 * A shape check ("does it have amount and currency") would pass a ladder tier
 * happily. So the rule is identity: the thing being converted must BE an
 * observation recorded in competitors.js, by id, with its source on that
 * competitor's own domain. A FieldQuo price has no such id and no such source
 * and can never acquire one, and neither can a number somebody made up.
 *
 * This module also never imports SEAT_LADDER, so there is nothing here to
 * accidentally hand to a converter — check-fx.mjs asserts that too, because
 * "we simply won't" is not a guarantee.
 */
export function conversionRefusal(observation, { to, asOf } = {}) {
  if (!asOf) throw new Error("conversionRefusal: asOf is required — a rate is only fresh against a date");
  if (!observation) return "no observation";
  const known = CONVERTIBLE.get(observation.id);
  if (!known) {
    return "not a competitor observation recorded in competitors.js — FieldQuo's own prices are never converted";
  }
  let host;
  try {
    host = new URL(observation.source || "").hostname.replace(/^www\./, "");
  } catch {
    return "the observation names no source URL";
  }
  if (host !== known.host) return `the observation's source is not ${known.host}`;

  // ── A figure we will not publish is a figure we will not convert ────────
  //
  // The hole this closes was live for about an hour of writing this module:
  // every gate in competitors.js — unverified, unresolved, stale, no vantage
  // point, a currency nobody established — is enforced by `withholdReason`,
  // and none of them were being asked here. So Jobber's eight annual figures,
  // which are withheld because nobody settled what their $49 is relative to
  // their $29, all converted happily. An approximate CAD figure derived from a
  // number we refuse to print is a way of printing it.
  //
  // Deferring to withholdReason rather than restating its rules is the point:
  // a gate added there is a gate added here, and failure class 4 says the copy
  // is the one that rots.
  const withheld = withholdReason(observation, asOf);
  if (withheld) return `the figure itself is withheld — ${withheld}`;

  const price = observation.price;
  // Only a single published amount converts. A reported band has no single
  // number to convert and converting one end of it would be the midpoint
  // mistake wearing a different hat; a free, on-request, not-offered or
  // unknown price has no number at all.
  if (price?.kind !== PRICE_AMOUNT) return "only a published amount converts, and this is not one";
  if (!Number.isFinite(price.amount) || price.amount <= 0) return "the amount is not a positive number";
  if (!["month", "year"].includes(price.per)) return "the amount does not say what it is per";
  const from = price.currency;
  if (!/^[A-Z]{3}$/.test(from || "")) return "the observation's currency is not a currency code";
  if (from === to) return "already in that currency";
  if (!/^[A-Z]{3}$/.test(to || "")) return "no target currency given";
  // ── Currency provenance is NOT re-checked here, deliberately ────────────
  //
  // This function used to restate the three provenance rules — unrecorded,
  // third-hand, asserted-but-unsigned — and mutation testing showed all three
  // were dead: `withholdReason` above enforces every one of them and runs
  // first, so nothing could reach the copies. A guard that cannot fire is
  // worse than no guard, because it reads as coverage. Failure class 4: the
  // copy is the one that rots.
  //
  // What that leaves is a GUARANTEE this function relies on rather than
  // repeats: anything past withholdReason has a `currencySourcing` of
  // publisher or owner-asserted, and an owner-asserted one has a signed
  // assertion. `approximateInCurrency` reads `assertedBy.who` on that basis,
  // and check-fx.mjs asserts the behaviour end to end rather than the branch.

  return rateRefusal(rateFor(from, to), asOf);
}

/**
 * An approximate figure in another currency, or a refusal — always both fields.
 *
 * Returns `{ approx, refusedBecause }` rather than a value-or-null, so a caller
 * that ignores the refusal still gets `approx: null` and renders nothing,
 * while one that wants to explain the blank has the sentence to hand. Nothing
 * this function can return is a bare number.
 */
export function approximateInCurrency(observation, { to, asOf } = {}) {
  const refusedBecause = conversionRefusal(observation, { to, asOf });
  if (refusedBecause) return { approx: null, refusedBecause };

  const from = observation.price.currency;
  const rate = rateFor(from, to);
  const inverted = rate.base !== from;
  const multiplier = inverted ? 1 / rate.rate : rate.rate;
  const rounded = approximateAmount(observation.price.amount * multiplier);
  if (rounded === null) return { approx: null, refusedBecause: "the converted amount did not round to anything" };

  const per = PER_WORDS[observation.price.per] || "";
  const known = CONVERTIBLE.get(observation.id);
  const currencyFrom =
    observation.price.currencySourcing === SOURCED_OWNER_ASSERTED
      ? `${from} is asserted by ${observation.price.assertedBy.who} on ${observation.price.assertedBy.on}, not stated on ${known.competitorName}'s page`
      : `${from} is stated on ${known.competitorName}'s own page`;

  return {
    refusedBecause: null,
    approx: new Approximate({
      // Begins with the approximation mark, always. There is no variant of
      // this string that reads as a price.
      converted: `≈ ${currencyLabel(to)}${groups.format(rounded)}${per ? ` ${per}` : ""}`,
      original: `published as ${currencyLabel(from)}${asPublished.format(observation.price.amount)}${per ? ` ${per}` : ""}`,
      // The rate written out so a reader can redo the arithmetic. This is the
      // thing that makes the approximation checkable instead of trusted.
      rate: `converted at 1 ${currencyLabel(rate.base)} = ${rate.rate} ${currencyLabel(rate.quote)}${inverted ? ", applied in reverse" : ""}`,
      rateDate: `rate for ${rate.rateDate}`,
      rateSource: `source: ${rate.sourceName}`,
      rateSourceUrl: rate.source,
      rateCaveat: rate.caveat,
      rounding:
        "rounded to two significant figures — an exchange rate this old cannot support a more precise answer",
      currencyProvenance: currencyFrom,
    }),
  };
}
