// lib/estimate/stairsFromSteps.js
//
// A whole staircase from two things a homeowner can answer on the phone: how
// many steps, and what shape.
//
// ══ The owner's rule, verbatim ═════════════════════════════════════════════
//
//   "Each step tends to have 2 balusters. And most stairs are either in L
//    shape or U shape, with 4 to 5 posts."
//
// ══ The derivation ═════════════════════════════════════════════════════════
//
//   treads     = steps                one tread per step
//   risers     = steps + flights      a flight has one MORE riser than tread:
//                                     the top riser rises to the landing or
//                                     the floor, which is not a tread. So a
//                                     straight run is steps + 1, an L (two
//                                     flights) steps + 2, a U (three) steps +
//                                     3. It said `= steps` until 2026-09-22,
//                                     which under-counted every stair by one
//                                     riser per flight — the owner spotted it
//                                     on a 25-step L quoted with 25 risers.
//                                     An open-riser stair is the estimator's
//                                     correction, not the rule; every filled
//                                     box stays editable
//   balusters  = 2 × steps            the owner's rule — two spindles per tread
//                                     is the residential code spacing (a 4"
//                                     sphere must not pass) on a 10–11" tread
//   posts      = straight 2           a newel at the bottom and one at the top
//                L        4           the owner's "4 to 5": one turn adds a
//                U        5           landing with a newel each side of it,
//                                     and a U's second turn adds one more
//                                     because the two landing newels sit on a
//                                     shared half-landing
//   handrailFt = railingFt if given   the homeowner measured it; believe them
//              = round(steps × 11" of run + 3 ft of landing per turn)
//                                     11" is a residential tread depth; each
//                                     turn is a landing about 3 ft across that
//                                     the rail follows. Run, not pitch — the
//                                     rail is bought and priced by the foot of
//                                     stair it covers, and the estimator sees
//                                     the photos before the number is final
//
// ══ Why it is a rule and not a question ═══════════════════════════════════
//
// The instant estimate priced treads and the railing feet the homeowner typed
// and nothing else, so balusters, posts and risers — a third of a stair
// refinish — were not in the range at all. Asking a stranger to count
// balusters is asking them to abandon the form; asking how many steps and
// whether it turns is not. The counts are ESTIMATED and say so wherever they
// land; the estimator adjusts them after the photos. The range stays a range.
//
// Pure. Hostile input returns null rather than a stair made of NaN.

export const STAIR_SHAPES = Object.freeze(["straight", "L", "U"]);
export const DEFAULT_STAIR_SHAPE = "L";

const POSTS_BY_SHAPE = Object.freeze({ straight: 2, L: 4, U: 5 });
const TURNS_BY_SHAPE = Object.freeze({ straight: 0, L: 1, U: 2 });

// A house does not have more steps than this; a number past it is a typo or a
// bot, and clamping it would price a skyscraper as a bungalow.
const MAX_STEPS = 200;
const TREAD_RUN_IN = 11;
const LANDING_FT = 3;

/** The shape word, or the default for anything that is not one. */
export function stairShape(value) {
  if (typeof value !== "string") return DEFAULT_STAIR_SHAPE;
  const v = value.trim();
  if (STAIR_SHAPES.includes(v)) return v;
  const lower = v.toLowerCase();
  if (lower === "l" || lower === "l-shape" || lower === "l_shape") return "L";
  if (lower === "u" || lower === "u-shape" || lower === "u_shape") return "U";
  if (lower === "straight" || lower === "i" || lower === "-" || lower === "─") return "straight";
  return DEFAULT_STAIR_SHAPE;
}

/**
 * @param {{ steps: number, shape?: "straight"|"L"|"U", railingFt?: number }} input
 * @returns {{ steps, shape, treads, risers, balusters, posts, handrailFt, turns, flights } | null}
 */
export function stairsFromSteps(input) {
  if (!input || typeof input !== "object") return null;
  const raw = Number(input.steps);
  if (!Number.isFinite(raw)) return null;
  const steps = Math.floor(raw);
  if (steps < 1 || steps > MAX_STEPS) return null;
  const shape = stairShape(input.shape);
  const turns = TURNS_BY_SHAPE[shape];
  // A turn is a landing, and a landing ends one flight and starts the next:
  // straight = 1 flight, L = 2, U = 3.
  const flights = turns + 1;

  const givenRail = Number(input.railingFt);
  const handrailFt =
    Number.isFinite(givenRail) && givenRail > 0
      ? Math.round(givenRail * 100) / 100
      : Math.round((steps * TREAD_RUN_IN) / 12 + turns * LANDING_FT);

  return {
    steps,
    shape,
    turns,
    flights,
    treads: steps,
    risers: steps + flights,
    balusters: 2 * steps,
    posts: POSTS_BY_SHAPE[shape],
    handrailFt,
    railingGiven: Number.isFinite(givenRail) && givenRail > 0,
  };
}

/** "estimated from 14 steps, L-shape" — the note every derived count carries. */
export function stairsDerivationNote(derived) {
  if (!derived) return "";
  const shapeWord = derived.shape === "straight" ? "straight" : `${derived.shape}-shape`;
  return `estimated from ${derived.steps} steps, ${shapeWord}`;
}

/* ── The builder's automatic fill ─────────────────────────────────────────
 *
 * The owner (2026-09-22): the step count fills the staircase by itself — no
 * Fill button. Every change to the step count (or the shape) re-runs the one
 * rule above and writes the result onto the section, EXCEPT into a box the
 * estimator has typed over: a count taken on site outranks one derived from a
 * rule of thumb, and a fill that silently overwrote it would be the
 * destructive-operation-labelled-as-cosmetic failure.
 *
 * "Typed over" is judged against what the PREVIOUS fill wrote (`last`), not
 * against zero alone: typing 1 then 14 in the step box fills twice, and the
 * second fill must replace the first's numbers, which are still the fill's
 * own. A box at 0 or blank is always the fill's to write.
 *
 * The opt-in parts (risers, balusters, posts) are switched on with the count
 * they bill — the Fill button's rule, because counting balusters and then
 * billing none is a number typed for nothing — and, like a count, a switch the
 * estimator turned off after a fill stays off.
 *
 * On a fresh section the patch is EXACTLY what the Fill button wrote (same
 * keys, same values), so the priced payload is byte-identical — asserted by
 * md5 in scripts/check-stairs-from-steps.mjs.
 *
 * Pure. Returns { patch, filled }: merge `patch` into the section, and pass
 * `filled` back as `last` on the next call.
 */
export const STAIR_FILL_COUNTS = Object.freeze(["treads", "risers", "balusters", "posts", "handrailFt"]);
const TOGGLE_FOR = Object.freeze({ risers: "paintRisers", balusters: "paintBalusters", posts: "paintPosts" });

export function stairFillPatch(section, derived, last = null) {
  const s = section && typeof section === "object" ? section : {};
  const prev = last && typeof last === "object" ? last : null;
  if (!derived) return { patch: {}, filled: prev };
  const patch = {};
  const filled = { ...(prev || {}) };
  const blank = (v) => v === undefined || v === null || v === "" || !(Number(v) > 0);
  for (const key of STAIR_FILL_COUNTS) {
    const cur = s[key];
    const ours = blank(cur) || (prev != null && Number(cur) === Number(prev[key]));
    if (!ours) continue;
    patch[key] = derived[key];
    filled[key] = derived[key];
  }
  for (const [countKey, toggle] of Object.entries(TOGGLE_FOR)) {
    if (!(countKey in patch)) continue;
    // Off because nobody switched it on yet, or on because a fill did: ours.
    // Off after a fill switched it on: the estimator's, and left alone.
    const ours = prev == null || !(toggle in prev) || s[toggle] === prev[toggle];
    if (!ours) continue;
    patch[toggle] = true;
    filled[toggle] = true;
  }
  return { patch, filled };
}

/**
 * The step count and shape a section was evidently filled from, or null.
 *
 * The step box is the builder's own state, not the takeoff's — storing it
 * would change the saved takeoff every estimator already sends — so when the
 * service's editor is closed and reopened the box would come back blank and
 * the next count typed would treat every earlier fill as the estimator's own
 * numbers and change nothing. Instead the fill is recognised from the counts
 * themselves: treads = N, and the risers and posts the rule gives for N in
 * one shape (risers and posts both depend on the shape). A match returns the
 * step count, the shape and a `last` that makes the rule's boxes the fill's
 * again — while a box typed over still differs from it and stays the
 * estimator's. The switches are taken as the fill left them (on), so one
 * turned off since stays off.
 */
export function inferStairFill(section) {
  const s = section && typeof section === "object" ? section : {};
  const treads = Number(s.treads);
  if (!(treads > 0)) return null;
  for (const shape of [DEFAULT_STAIR_SHAPE, ...STAIR_SHAPES.filter((x) => x !== DEFAULT_STAIR_SHAPE)]) {
    const d = stairsFromSteps({ steps: treads, shape });
    if (!d || Number(s.risers) !== d.risers || Number(s.posts) !== d.posts) continue;
    const last = { ...Object.fromEntries(STAIR_FILL_COUNTS.map((k) => [k, d[k]])) };
    for (const toggle of Object.values(TOGGLE_FOR)) last[toggle] = true;
    return { steps: d.steps, shape: d.shape, last };
  }
  return null;
}

/** The fields a fill can write, as they stand — what Undo puts back. */
export function stairFillSnapshot(section) {
  const s = section && typeof section === "object" ? section : {};
  const out = {};
  for (const key of [...STAIR_FILL_COUNTS, ...Object.values(TOGGLE_FOR)]) out[key] = s[key];
  return out;
}
