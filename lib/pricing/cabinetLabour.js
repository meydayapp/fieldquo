// lib/pricing/cabinetLabour.js
//
// How many hours a cabinet refinishing job actually takes.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// It returned zero. quoteCosting's takeoffDerived only fires when a group has a
// `takeoff` object, and a cabinet group has none — its inputs are intake
// answers, not a drawn takeoff — so every cabinet quote was costed
// labour-blind. The margin panel on the highest-volume trade in this product
// was scoring a job whose largest cost it could not see.
//
// The same lesson as roofLabour.js and paverLabour.js, and the same shape: the
// hours ARE the model. A per-door rate returns the same number for a greasy
// 1980s kitchen with three coats of primer and a two-year-old IKEA install, and
// that is not what happens in the shop.
//
// ══ Every figure here came from the owner, timing his own crew ═════════════
//
// So they are defaults, not laws. All of them live in the price book under
// `labour`, which means a company can tune them in Settings without a deploy —
// and the ones NOT dictated by the owner are marked as assumptions and reported
// back, rather than quietly becoming fact. See `assumptions` in the return.
//
// ══ What it does not do ════════════════════════════════════════════════════
//
// It does not price anything. It returns hours, bare, exactly as the other
// labour modules do; lib/costing/quoteCosting.js multiplies them by the crew's
// burdened cost. Hours are a prediction about work and the rate is a fact about
// payroll — the two have different owners and different reasons to change.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const hoursFromMinutes = (m) => m / 60;

/**
 * Small, medium or large — by piece count, not by room.
 *
 * The owner's bands overlapped ("medium 30 to 45 ish, large 40-45+"), which is
 * how a person describes a spectrum and not a rule a computer can apply. Read
 * as small < 30, medium 30–45, large > 45: it honours both endpoints he was
 * sure about and puts the fuzzy overlap in medium, which is the cheaper of the
 * two readings and therefore the one that cannot silently pad a quote.
 */
export function kitchenSize(pieces) {
  const n = num(pieces);
  if (n < 30) return "small";
  if (n <= 45) return "medium";
  return "large";
}

export const CABINET_LABOUR_DEFAULTS = {
  // Per piece, in minutes.
  sandMinutesPerDoor: 6,
  sandMinutesPerDrawer: 4,
  // 3 minutes in normal condition, 6 with real grease and build-up.
  degreaseMinutesNormal: 3,
  degreaseMinutesHeavy: 6,
  // "2 to 3 minutes" with a tack cloth after fine sanding. The midpoint, which
  // is the only defensible single number to take from a range.
  tackMinutesPerPiece: 2.5,
  paintMinutesPerPiecePerCoat: 3,

  // Fixed, in hours.
  dryHoursPerCoat: 1,
  // Masking, containment, removing doors/drawers and hardware, labelling.
  // Stated for low-to-moderate complexity on small and medium kitchens.
  prepHours: 8,
  boxSandHoursSmall: 1,
  boxSandHoursMedium: 1.5,
  boxSandHoursLarge: 2.5,
  // Reinstall and alignment. The owner's range was 1–4 hours "depending on the
  // size of the kitchen and the hinges" — so it is both, and the two ends of
  // his range are exactly the two ends of this table.
  installHoursSmall: 1,
  installHoursMedium: 2,
  installHoursLarge: 3,
  // Old-school hinges that sit against the door frame have to be aligned by
  // hand; an IKEA-style clip locks into place.
  installExtraHoursLegacyHinges: 1,

  // Add-ons.
  // 1 minute to fill the old hole, 2 to drill the new one.
  handleMinutesPerPiece: 3,
  toneExtraPrepHours: 0.5,
  toneExtraPaintHours: 3,
};

/**
 * The hours, itemised.
 *
 * @param config {{
 *   doors, drawers,
 *   complexityLevel?: "standard"|"moderate"|"high",
 *   condition?: "normal"|"heavy",
 *   primerCoats?: number, topCoats?: number,
 *   hingeType?: "clip"|"legacy",
 *   handleHoles?: boolean, twoTone?: boolean, threeTone?: boolean,
 *   addOnUnits?: Record<string, number>
 * }}
 * @param book the trade price book; `book.labour` overrides any default
 * @returns {{ hours, steps:[{key,label,hours,note}], assumptions:string[],
 *             incomplete:boolean }}
 */
export function cabinetRunLabour(config = {}, book = null) {
  const r = { ...CABINET_LABOUR_DEFAULTS, ...(book?.labour || {}) };
  const doors = num(config.doors);
  const drawers = num(config.drawers);
  const pieces = doors + drawers;

  // Nothing counted is not a job worth zero hours — it is a question nobody
  // has answered, and returning 0 would let a margin panel report a healthy
  // margin on a job with no labour in it. Same contract as roofLabour.
  if (pieces <= 0) {
    return { hours: 0, steps: [], assumptions: [], incomplete: true };
  }

  const size = kitchenSize(pieces);
  const assumptions = [];
  const steps = [];
  const add = (key, label, hours, note) => {
    if (hours > 0) steps.push({ key, label, hours: round2(hours), note: note || "" });
  };

  // ── Prep ────────────────────────────────────────────────────────────────
  //
  // Stated as 8 hours for low-to-moderate complexity on kitchens under 40
  // pieces. Above that it is scaled pro-rata rather than left flat: 8 hours of
  // masking and removal on a 70-piece kitchen is not a number anybody offered,
  // and holding it flat would understate the biggest jobs by the most. The
  // scaling is arithmetic on his own figure, not a new figure — but it is still
  // an extrapolation, so it says so.
  const PREP_STATED_UP_TO = 40;
  let prep = num(r.prepHours);
  if (pieces > PREP_STATED_UP_TO) {
    prep = (prep * pieces) / PREP_STATED_UP_TO;
    assumptions.push(
      `Prep scaled pro-rata to ${pieces} pieces — the ${r.prepHours}h figure was measured on kitchens up to ${PREP_STATED_UP_TO}.`,
    );
  }
  // High complexity was explicitly outside the measured range ("low to medium
  // complexity"). Rather than invent a multiplier, the hours stand and the
  // estimator is told the number does not cover their case. An invented 1.4×
  // would look like measurement.
  if (config.complexityLevel === "high") {
    assumptions.push(
      "Prep is the low-to-moderate complexity figure — a high-complexity kitchen was not measured, so add hours below.",
    );
  }
  add("prep", "Prep, masking and removal", prep);

  // ── Sanding ─────────────────────────────────────────────────────────────
  const sandMinutes =
    doors * num(r.sandMinutesPerDoor) + drawers * num(r.sandMinutesPerDrawer);
  add(
    "sanding",
    "Sanding, all faces",
    hoursFromMinutes(sandMinutes),
    `${doors} doors × ${r.sandMinutesPerDoor}min + ${drawers} drawers × ${r.sandMinutesPerDrawer}min`,
  );

  const boxSandHours =
    size === "small"
      ? num(r.boxSandHoursSmall)
      : size === "medium"
        ? num(r.boxSandHoursMedium)
        : num(r.boxSandHoursLarge);
  add("boxSanding", "Sanding cabinet boxes", boxSandHours, `${size} kitchen`);

  // ── Degreasing ──────────────────────────────────────────────────────────
  //
  // Defaults to normal. Heavy is a judgement made standing in the kitchen, and
  // assuming it would double this line on every quote where nobody looked.
  const heavy = config.condition === "heavy";
  if (!config.condition) {
    assumptions.push(
      "Degreasing assumes normal condition — set it to heavy if there is real build-up.",
    );
  }
  const degreaseMinutes =
    pieces * num(heavy ? r.degreaseMinutesHeavy : r.degreaseMinutesNormal);
  add(
    "degreasing",
    "Degreasing and cleaning",
    hoursFromMinutes(degreaseMinutes),
    heavy ? "heavy build-up" : "normal condition",
  );

  // ── Coats ───────────────────────────────────────────────────────────────
  const primerCoats = Math.max(0, num(config.primerCoats ?? 2));
  const topCoats = Math.max(0, num(config.topCoats ?? 2));
  const coats = primerCoats + topCoats;

  add(
    "spraying",
    "Spraying",
    hoursFromMinutes(pieces * num(r.paintMinutesPerPiecePerCoat) * coats),
    `${pieces} pieces × ${r.paintMinutesPerPiecePerCoat}min × ${coats} coats (${primerCoats} primer, ${topCoats} top)`,
  );
  add(
    "drying",
    "Drying between coats",
    num(r.dryHoursPerCoat) * coats,
    `${r.dryHoursPerCoat}h × ${coats} coats`,
  );

  // Fine sanding happens ONCE, after the primer is on — not per coat. Same
  // minutes as the first sanding, which is what the owner said and is also why
  // it reuses the same two rates rather than getting its own pair to drift.
  if (primerCoats > 0) {
    add(
      "fineSanding",
      "Fine sanding after primer",
      hoursFromMinutes(sandMinutes),
      "same rate as the first sanding",
    );
    add(
      "tackCloth",
      "Tack-cloth wipe before top coat",
      hoursFromMinutes(pieces * num(r.tackMinutesPerPiece)),
      `${pieces} pieces × ${r.tackMinutesPerPiece}min`,
    );
  }

  // ── Add-ons ─────────────────────────────────────────────────────────────
  //
  // Counts come from the same override map the PRICE uses, so a job quoted for
  // two handles is costed for two handles. Reading the piece count here while
  // the price read the override is how a margin comes to be computed against
  // work nobody is doing.
  const overrideFor = (key, derived) => {
    const v = Number(config.addOnUnits?.[key]);
    return Number.isFinite(v) && v >= 0 ? v : derived;
  };

  if (config.handleHoles) {
    const handles = overrideFor("handleHoles", pieces);
    add(
      "handles",
      "Filling and drilling handle holes",
      hoursFromMinutes(handles * num(r.handleMinutesPerPiece)),
      `${handles} × ${r.handleMinutesPerPiece}min (1 fill, 2 drill)`,
    );
  }

  if (config.twoTone || config.threeTone) {
    add(
      "toneExtra",
      config.threeTone ? "Third colour — extra prep and spraying" : "Second colour — extra prep and spraying",
      num(r.toneExtraPrepHours) + num(r.toneExtraPaintHours),
      `${r.toneExtraPrepHours}h masking + ${r.toneExtraPaintHours}h spraying and drying`,
    );
    if (config.threeTone) {
      assumptions.push(
        "A third colour is costed at the second colour's extra hours — only the two-tone figure was measured.",
      );
    }
  }

  // ── Reinstall ───────────────────────────────────────────────────────────
  const installBase =
    size === "small"
      ? num(r.installHoursSmall)
      : size === "medium"
        ? num(r.installHoursMedium)
        : num(r.installHoursLarge);
  const legacy = config.hingeType === "legacy";
  if (!config.hingeType) {
    assumptions.push(
      "Reinstall assumes clip-on hinges — frame-mounted hinges take longer to align.",
    );
  }
  add(
    "install",
    "Reinstall and alignment",
    installBase + (legacy ? num(r.installExtraHoursLegacyHinges) : 0),
    legacy ? `${size} kitchen, frame-mounted hinges` : `${size} kitchen, clip-on hinges`,
  );

  const hours = round2(steps.reduce((s, x) => s + x.hours, 0));
  return { hours, steps, assumptions, incomplete: false };
}
