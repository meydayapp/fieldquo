// app/(marketing)/compare/addOns.js
//
// The add-ons a competitor sells ON TOP of the plan, totalled — and the
// FieldQuo features that cover the same ground.
//
// ══ Why this is its own module ═════════════════════════════════════════════
//
// Two surfaces need it: /compare/fieldquo-vs-jobber, where it belongs beside
// the plan prices, and /pricing, where a visitor is deciding what $99 buys. The
// second is the one that matters commercially and it is a client component, so
// the alternative to a shared module was the copy that rots (AGENTS.md failure
// class 4) — with a number in it, about somebody else's prices, on two pages
// that would then be free to disagree.
//
// ══ Why ADDITION is allowed here and CONVERSION never is ═══════════════════
//
// lib/marketing/competitors.js bans currency conversion outright, and the
// reasoning is worth re-reading before touching this file: an FX rate is right
// on the day you look it up and wrong the next, so a converted figure baked
// into a statically-rendered page is a claim about a competitor that is
// drifting continuously with nobody watching.
//
// Summing three of a competitor's own published monthly add-on prices is not
// that. Nothing outside their own pricing page enters the arithmetic, the
// result moves only when one of their figures moves, and the sum is exactly
// what a contractor buying all three would be charged. The distinction is not
// "addition is small and conversion is big" — it is that a conversion imports a
// number from somewhere nobody is checking, and this imports nothing.
//
// That is only true while the things being added are the SAME KIND of thing, so
// `addOnStack` refuses rather than totals whenever they are not:
//
//   • a withheld figure is never in the sum (withholdReason decides, exactly as
//     it does for a plan price on /compare);
//   • every item must be a stated AMOUNT — an "on request" add-on has no
//     number and its absence must not read as zero;
//   • one currency only. Two currencies in one total is a conversion whether or
//     not anybody wrote a rate down;
//   • one billing period only. $99/month and $99/year are not addable;
//   • one point on their own selectors. Their prices move with team size and
//     billing mode, so a total assembled from two coordinates is a price no
//     visitor to their site has ever been shown.
//
// Every refusal returns a REASON rather than a null total, so a renderer can
// say what it cannot say instead of quietly printing a shorter list.

import {
  BILLING_MODES,
  PRICE_AMOUNT,
  TEAM_SIZES,
  allAddOns,
  withholdReason,
} from "@/lib/marketing/competitors";
import { MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";

/**
 * What FieldQuo ships against each of their add-ons — as MATRIX KEYS.
 *
 * Keys, never sentences, for the same reason compareCopy.js holds keys: there
 * is nowhere in this file to write down a feature we do not have. The renderer
 * prints the matrix's own `name` and `summary`, both of which
 * scripts/check-feature-matrix.mjs has already proved against the route or
 * library that implements them.
 *
 * ══ What this mapping does and does not claim ══════════════════════════════
 *
 * It claims: these are the FieldQuo features that do this work, and they are in
 * every plan. It does NOT claim feature-for-feature parity, and no renderer may
 * imply one — we read a label and a price off their pricing page and nothing
 * else. What their Marketing Suite contains is not something this repo has
 * established, so nothing here describes it.
 *
 * A `partial` entry stays in the list and its `limits` must be rendered with
 * it. Dropping it to make the column look longer would be the same failure as
 * a bare tick beside a half-built feature, and door-hanger routes are exactly
 * that case: we plan and track the route, we do not print or deliver anything.
 */
export const ADD_ON_COUNTERPARTS = Object.freeze({
  "jobber.addon.marketing_suite": Object.freeze([
    "email_campaigns",
    "door_hanger_routes",
    "review_requests",
  ]),
  "jobber.addon.ai_receptionist": Object.freeze(["voice_receptionist", "call_to_quote"]),
  "jobber.addon.sales_pipeline": Object.freeze(["leads", "funnels"]),
});

// Validated at module load, the way app/data/featurePages.js validates its own
// keys: a typo or a feature somebody wished we had takes the build down rather
// than rendering an empty column on the page that asks for money.
{
  const known = new Set(MATRIX_KEYS);
  const ids = new Set(allAddOns().map((a) => a.id));
  for (const [addOnId, keys] of Object.entries(ADD_ON_COUNTERPARTS)) {
    if (!ids.has(addOnId)) {
      throw new Error(`addOns: "${addOnId}" is not an add-on in lib/marketing/competitors.js`);
    }
    if (!keys.length) {
      throw new Error(`addOns: "${addOnId}" names no FieldQuo feature`);
    }
    for (const key of keys) {
      if (!known.has(key)) {
        throw new Error(`addOns: "${addOnId}" names "${key}", which is not in the feature matrix`);
      }
    }
  }
}

/** The resolved matrix entries we set against one add-on. Order follows above. */
export function counterpartsFor(addOnId) {
  return (ADD_ON_COUNTERPARTS[addOnId] || []).map((key) => matrixEntry(key)).filter(Boolean);
}

/**
 * The point on a competitor's own selectors, in their own words.
 *
 * Shared with the figure rows on /compare so one figure cannot be labelled
 * "6-10 people" on one surface and "6 to 10" on another. A competitor that
 * declares no axes has nothing to locate — ServiceTitan is that case — and gets
 * null rather than an invented "all sizes".
 */
export function coordinateLabel(axis) {
  const parts = [];
  if (axis?.teamSize) {
    const size = TEAM_SIZES[axis.teamSize];
    parts.push(size ? size.label : axis.teamSize);
  }
  if (axis?.billing) {
    const mode = BILLING_MODES[axis.billing];
    parts.push(mode ? mode.label : axis.billing);
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

const axisKey = (axis) => JSON.stringify(axis ?? {});

/**
 * The total of a set of add-ons — or a refusal saying why there isn't one.
 *
 * Pure, and separate from `addOnStack` on purpose: the interesting behaviour is
 * every case where a total must NOT be produced, and none of those cases exists
 * in the live data. A function that reads COMPETITORS itself could only be
 * checked against the one arrangement that happens to be true today, which is
 * the arrangement that is safe. This one can be handed two currencies, a
 * missing amount and two coordinates, and scripts/check-compare-pages.mjs does
 * exactly that.
 *
 * `items` must already be filtered by withholdReason — deciding what publishes
 * is not this function's job and doing it in two places is how the two answers
 * come to disagree.
 */
export function totalOf(items) {
  const list = Array.isArray(items) ? items : [];
  const none = { total: null, currency: null, per: null, coordinates: null };

  if (list.length === 0) {
    return { ...none, refusal: "none of their add-on prices is publishable" };
  }
  // One add-on is a price, not a stack. Printing a "total" of one number would
  // dress a single figure up as an accumulation.
  if (list.length < 2) {
    return { ...none, refusal: "only one add-on price publishes, so there is nothing to total" };
  }
  if (!list.every((a) => a?.price?.kind === PRICE_AMOUNT)) {
    return {
      ...none,
      refusal: "one of the add-ons states no amount, and an absent price is not zero",
    };
  }

  const currencies = [...new Set(list.map((a) => a.price.currency))];
  if (currencies.length > 1) {
    return {
      ...none,
      refusal: `these add-ons are priced in ${currencies.join(" and ")}, and totalling them would be a conversion`,
    };
  }
  const periods = [...new Set(list.map((a) => a.price.per))];
  if (periods.length > 1) {
    return {
      ...none,
      refusal: `these add-ons are billed per ${periods.join(" and per ")}, which cannot be added together`,
    };
  }
  const coordinates = [...new Set(list.map((a) => axisKey(a.axis)))];
  if (coordinates.length > 1) {
    return {
      ...none,
      refusal:
        "these add-on prices were read at different points on their own selectors, so no visitor to their site is shown this combination",
    };
  }

  return {
    // The one piece of arithmetic in this file, and the header says why it is
    // allowed: same currency, same period, same coordinates, every input read
    // off their own page.
    total: list.reduce((sum, a) => sum + a.price.amount, 0),
    currency: list[0].price.currency,
    per: list[0].price.per,
    coordinates: coordinateLabel(list[0].axis),
    refusal: null,
  };
}

/**
 * One competitor's publishable add-ons, and their total when a total is honest.
 *
 * @returns {{
 *   items: object[],          the add-ons that may be printed, in module order
 *   withheld: {addOn: object, reason: string}[],  the ones that may not, with why
 *   total: number|null,       the sum, or null
 *   currency: string|null,
 *   per: string|null,
 *   coordinates: string|null, the selector position every item was read at
 *   refusal: string|null,     why there is no total, when there isn't one
 * }}
 */
export function addOnStack(competitorId, asOf) {
  if (!asOf) {
    // Same rule as figureAgeDays: a caller that does not know what day it is has
    // no business deciding whether a competitor's price is still fresh.
    throw new Error("addOnStack: asOf is required — see lib/marketing/competitors.js");
  }

  const mine = allAddOns().filter((a) => a.competitorId === competitorId);
  const items = [];
  const withheld = [];
  for (const addOn of mine) {
    const reason = withholdReason(addOn, asOf);
    if (reason === null) items.push(addOn);
    else withheld.push({ addOn, reason });
  }

  return { items, withheld, ...totalOf(items) };
}
