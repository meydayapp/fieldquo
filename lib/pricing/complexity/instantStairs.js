// lib/pricing/complexity/instantStairs.js
//
// The homeowner's eight plain questions, mapped onto the estimator's fourteen
// factors.
//
// ── Not wired in ───────────────────────────────────────────────────────────
//
// `inferComplexity` is exported, pure and covered by
// scripts/check-complexity.mjs, and NOTHING calls it yet. app/api/instant-quote
// and app/app/settings/instant-quotes belong to another agent working at the
// same time as this module was written; wiring it from here would have meant
// editing their files under them. The call site, when they take it, is one
// line in the stairs branch of the instant estimator:
//
//     const complexity = inferComplexity(answers);   // → { model, factors }
//     // store on the draft group, exactly as the builder stores its own
//
// and then lib/pricing/tradeScope.js prices and reasons it with no further
// change, because it is the same object the builder writes.
//
// ── Only what the homeowner actually said ──────────────────────────────────
//
// A homeowner is asked eight questions; the estimator answers fourteen. The
// six the homeowner is never asked — stringers, risers, newel posts, stain
// match, site access, existing finish — are LEFT OUT of the returned factors
// rather than filled with their benign answer.
//
// That distinction matters and it is the failure class AGENTS.md names fifth.
// Filling them in would publish a claim the homeowner never made: "the
// stringers are painted" is a statement about the house, and an instant quote
// asserting it would be priced as though somebody had looked. Left out, they
// score nothing and the estimator sees them unanswered when the lead opens in
// the builder. `unanswered` says which, so a screen can show that honestly
// instead of implying the form covered everything.

import { COMPLEXITY_MODEL, complexityFor } from "./index";

/** Lower-case, trimmed, undefined-safe. Homeowner answers arrive as strings. */
const norm = (v) => String(v ?? "").trim().toLowerCase();
const count = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * @param {object} answers  the eight questions, by the names the public form
 *   uses:
 *     steps          number of steps          (quantity — never a factor)
 *     landings       number of landings       (0, 1, 2…)
 *     shape          straight | l_shape | u_shape | curved | winder | spiral
 *     openSides      none | one | both        (or 0 | 1 | 2)
 *     treads         good | worn | damaged
 *     railing        none | metal | wood | turned | ornate
 *     desiredFinish  same | darker | lighter | two_tone | multiple
 *     condition      good | fair | poor
 * @returns {{ model, factors, unanswered: string[], steps: number,
 *             landings: number }}
 */
export function inferComplexity(answers = {}) {
  const a = answers && typeof answers === "object" ? answers : {};
  const factors = {};

  // ── Shape. A landing is a landing whatever the homeowner called the shape,
  // so the count is allowed to raise it but never to lower it.
  const shape = norm(a.shape);
  const landings = count(a.landings);
  if (shape === "curved" || shape === "winder" || shape === "spiral") {
    factors.shape = "curved";
  } else if (shape === "l_shape" || shape === "u_shape" || shape === "l" || shape === "u") {
    factors.shape = "l_or_u";
  } else if (shape === "straight") {
    factors.shape = landings > 0 ? "l_or_u" : "straight";
  } else if (landings > 0) {
    // Shape unanswered but a landing stated — that much IS a statement.
    factors.shape = "l_or_u";
  }

  // ── Open sides. Accepts the words and the count; "2" and "both" are the
  // same answer and a form that changes its mind must not change the price.
  const sides = norm(a.openSides);
  if (sides === "both" || sides === "2" || sides === "two") factors.sides = "both_open";
  else if (sides === "one" || sides === "1") factors.sides = "one_open";
  else if (sides === "none" || sides === "0" || sides === "enclosed") factors.sides = "enclosed";

  // ── Treads.
  const treads = norm(a.treads);
  if (treads === "damaged" || treads === "poor") factors.treads = "damaged";
  else if (treads === "worn" || treads === "fair") factors.treads = "worn";
  else if (treads === "good" || treads === "sound") factors.treads = "sound";

  // ── Railing. One homeowner answer, two estimator factors: what the
  // balusters are and what the handrail is. A turned baluster and a moulded
  // handrail travel together on a staircase of that age, and the homeowner
  // cannot be expected to tell them apart.
  const railing = norm(a.railing);
  if (railing === "ornate" || railing === "turned") {
    factors.balusters = "turned";
    factors.handrail = "intricate";
  } else if (railing === "wood") {
    factors.balusters = "simple_wood";
    factors.handrail = "sand_stain";
  } else if (railing === "metal" || railing === "none") {
    factors.balusters = "metal_or_none";
    factors.handrail = "painted";
  }

  // ── Desired finish. Two factors again: the colour DIRECTION and whether
  // more than one colour is involved. "lighter" is the dark-to-light answer
  // the owner's switch watches.
  const finish = norm(a.desiredFinish);
  if (finish === "lighter") {
    factors.colourDirection = "dark_to_light";
    factors.finishDesign = "one_colour";
  } else if (finish === "darker") {
    factors.colourDirection = "light_to_dark";
    factors.finishDesign = "one_colour";
  } else if (finish === "same" || finish === "similar") {
    factors.colourDirection = "similar";
    factors.finishDesign = "one_colour";
  } else if (finish === "two_tone") {
    factors.finishDesign = "two_tone";
  } else if (finish === "multiple") {
    factors.finishDesign = "multiple";
  }

  // ── Overall condition → the repairs factor.
  const condition = norm(a.condition);
  if (condition === "poor") factors.repairs = "cracks_loose_nosings";
  else if (condition === "fair") factors.repairs = "dents_gaps_squeaks";
  else if (condition === "good") factors.repairs = "minor_filling";

  const list = complexityFor("stairs");
  const unanswered = list.factors
    .map((f) => f.key)
    .filter((key) => !Object.prototype.hasOwnProperty.call(factors, key));

  return {
    model: COMPLEXITY_MODEL,
    factors,
    unanswered,
    // Carried through because the estimate needs them and they are not
    // complexity: how many treads there are is a quantity, and a 17-step
    // staircase is not "complex", it is long.
    steps: count(a.steps),
    landings,
  };
}

export default inferComplexity;
