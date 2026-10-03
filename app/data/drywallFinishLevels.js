// app/data/drywallFinishLevels.js
//
// The six drywall finish levels a quote can name, and the one rule for reading
// a stored answer back.
//
// ── What the levels are ─────────────────────────────────────────────────────
//
// The Gypsum Association's GA-214 (the levels ASTM C840 refers to) is the
// standard a drywall spec calls out. In our own words, cumulative — each level
// is the one below it plus one more pass:
//
//   Level 0  board hung and fastened, no tape or compound. Temporary work, or
//            walls that will be covered up.
//   Level 1  tape set in compound at the joints and inside corners, nothing
//            more. Attics, plenums, areas nobody sees.
//   Level 2  one coat of compound over the tape and the screw heads. A base
//            for tile; garages and storage rooms.
//   Level 3  two coats. A base for heavy texture or heavy wall covering — not
//            for flat paint, which shows every joint.
//   Level 4  three coats on the joints, two on the screws, sanded smooth.
//            Paint-ready, and the usual standard for a home.
//   Level 5  Level 4 plus a thin skim coat over the WHOLE surface. For gloss,
//            semi-gloss and enamel paint, and walls under strong side light.
//
// app/data/priceBooks/interior.js (the staged drywall_install book) prices
// Levels 1–5 as rows `finish_l1` … `finish_l5`; Level 0 is hung board, which
// is the hang row with no finish row, so it has no line of its own.
//
// ── Why the stored values changed, and why the old ones still read ─────────
//
// The intake select used to offer three values: `level_2_unfinished`,
// `level_4_standard`, `level_5_premium`. "Level 2 unfinished" was simply wrong
// (Level 2 is a finished coat — it is the substrate tile is set on), there was
// no 0, 1 or 3, and nothing read the answer. Quotes and lead answers already
// hold those three strings, so they are MAPPED here, never rewritten in the
// database: a stored `level_4_standard` reads as Level 4 everywhere a level is
// read for pricing or for the builder's display.
//
// One deliberate exception, in lib/documents/serviceContent.js: the client's
// document names a level ONLY for an answer in the new vocabulary. Every quote
// that exists today carries an old value or none, and its document printed
// "Level 4, or Level 5 where specified" — it keeps printing exactly that, so
// nothing already in a client's inbox changes its wording overnight.
//
// No imports: quoteIntakeFields.js reads this, and that file is loaded by
// plain-node check scripts and the seeders.

export const FINISH_LEVELS = Object.freeze([
  "level_0",
  "level_1",
  "level_2",
  "level_3",
  "level_4",
  "level_5",
]);

/** GA-214's residential default — "paint ready". */
export const DEFAULT_FINISH_LEVEL = "level_4";

/** The three values the select offered before 2026-10-03, read as levels. */
export const LEGACY_FINISH_LEVELS = Object.freeze({
  level_2_unfinished: "level_2",
  level_4_standard: "level_4",
  level_5_premium: "level_5",
});

/**
 * One line each, for the staff select — English, the fallback under the app
 * catalogue's `app.intake.finishLevel.<value>` keys. Plain enough that a
 * homeowner reading over the estimator's shoulder follows it too.
 */
export const FINISH_LEVEL_LABELS = Object.freeze({
  level_0: "Level 0 — hung board, no finishing (temporary or concealed)",
  level_1: "Level 1 — tape in compound only (attics, plenums)",
  level_2: "Level 2 — one coat over the tape (tile backing, garages)",
  level_3: "Level 3 — two coats (under heavy texture, not for flat paint)",
  level_4: "Level 4 — three coats, sanded, paint-ready (the home standard)",
  level_5: "Level 5 — Level 4 plus a full skim coat (gloss paint, strong light)",
});

/** The quote types whose intake carries a finish level. */
export const FINISH_LEVEL_TRADES = Object.freeze(["drywall", "drywall_install"]);

const own = (map, key) =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);

/**
 * A stored answer → one of FINISH_LEVELS, or null.
 *
 * Legacy values map; anything else (blank, junk, "__proto__", a number) is
 * null — an answer nobody gave is not Level 4.
 */
export function normaliseFinishLevel(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (FINISH_LEVELS.includes(v)) return v;
  if (own(LEGACY_FINISH_LEVELS, v)) return LEGACY_FINISH_LEVELS[v];
  return null;
}

/**
 * The level a client's DOCUMENT may name: new-vocabulary answers only.
 * See the header — a legacy answer keeps the wording its document always had.
 */
export function documentFinishLevel(categoryKey, intake) {
  if (!FINISH_LEVEL_TRADES.includes(categoryKey)) return null;
  const v = intake && typeof intake === "object" ? intake.finishLevel : null;
  return typeof v === "string" && FINISH_LEVELS.includes(v) ? v : null;
}

/** "level_4" → 4; null for anything else. */
export function finishLevelNumber(level) {
  const i = FINISH_LEVELS.indexOf(level);
  return i >= 0 ? i : null;
}
