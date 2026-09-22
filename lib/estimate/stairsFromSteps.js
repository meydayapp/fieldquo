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
