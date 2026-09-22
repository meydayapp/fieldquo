// lib/pricing/complexity/index.js
//
// ONE complexity system, with a per-trade list of factors.
//
// ── What was here before ───────────────────────────────────────────────────
//
// Cabinet refinishing had chips — Standard / Moderate (+$20) / High (+$40) /
// Custom — and a checklist of seventeen "complexity reasons" printed beside
// the price. Stairs, flooring and both painting trades had a three-column
// GRID in the price book: every rate restated once per tier. Two different
// shapes for the same idea, neither of them able to say WHY a job is a
// moderate one, and the cabinet list of reasons was not connected to the
// level it justified — an estimator could tick five reasons and leave the
// chip on Standard, or the reverse.
//
// This replaces both with one model:
//
//   FACTORS  → the questions a trade actually asks about a job. Each factor
//              has two or three answers; each answer carries a weight and,
//              when it is not the benign one, a client-facing REASON LINE.
//   LEVEL    → the weights add up and cross the trade's own thresholds:
//              Standard · Moderate · Complex · Specialty.
//   HOURS    → Moderate and Complex multiply the LABOUR HOURS. Never the
//              materials: a harder staircase does not consume more stain, it
//              consumes more of the crew's day, and a multiplier on materials
//              would make the job-costing screen lie about both.
//   SPECIALTY→ never prices automatically. The group returns "on-site
//              assessment required" instead of a number.
//
// ── Where the numbers came from, and what they are worth ───────────────────
//
// The default multipliers (Moderate ×1.25, Complex ×1.75) came from a summary
// of trade practice written by ChatGPT for the product owner. They are NOT
// measured: no FieldQuo job was timed to produce them, and nothing here should
// be read as though one had been. They are an opening position, editable per
// company on the trade's rate card (Settings → Services), and the provenance
// is repeated on that card so the person tuning them knows what they are
// tuning away from. The same is true of every weight in the factor files.
//
// Specialty deliberately has NO multiplier. A number nobody measured for the
// hardest jobs on the list is exactly the invention this file exists to avoid;
// the honest answer is that somebody goes and looks.
//
// ── Why an existing quote never moves ──────────────────────────────────────
//
// `model: "factors_v1"` on a group's stored `complexity` object is the
// discriminator, the same device lib/pricing/tradeScope.js uses for the paint
// area/substrate model. A quote written before this landed has no `complexity`
// key at all, so `resolveComplexity` returns null, `applyComplexityToHours`
// returns the hours it was given, and the cabinet chips keep pricing through
// app/data/cabinetPricing.js exactly as they did. Nothing reprices.
//
// Pure — no database, no request, no React. scripts/check-complexity.mjs runs
// every function in here against hostile input.

import STAIRS_COMPLEXITY from "./stairs";
import ROOFING_COMPLEXITY from "./roofing";
import CABINET_COMPLEXITY from "./cabinets";

/** The discriminator. A stored complexity without it is not ours; ignore it. */
export const COMPLEXITY_MODEL = "factors_v1";

/**
 * The four levels, in order. `key` is what is stored; the labels are staff-
 * facing (the client never sees a level, only the reasons behind it).
 */
export const COMPLEXITY_LEVEL_KEYS = [
  "standard",
  "moderate",
  "complex",
  "specialty",
];

/**
 * Staff-facing level names. Exported so the picker's four chips and the
 * resolved level's own label come from ONE table — two tables of four words
 * would agree until somebody renamed "Complex", and the copy that rots is
 * always the one nobody is looking at.
 */
export const COMPLEXITY_LEVEL_LABELS = {
  standard: { en: "Standard", fr: "Standard", es: "Estándar" },
  moderate: { en: "Moderate", fr: "Modéré", es: "Moderado" },
  complex: { en: "Complex", fr: "Complexe", es: "Complejo" },
  specialty: { en: "Specialty", fr: "Spécialisé", es: "Especializado" },
};

const LEVEL_LABELS = COMPLEXITY_LEVEL_LABELS;

/**
 * What the client reads instead of a price on a Specialty group.
 *
 * Client-facing, so it follows the DOCUMENT's language, not the estimator's
 * (non-negotiable #6). Three languages, hand-written, same closed-set reasoning
 * as lib/i18n/clientDocCopy.js — an unknown language falls back to English.
 */
const ASSESSMENT_COPY = {
  en: "On-site assessment required — we price this one after seeing it.",
  fr: "Évaluation sur place requise — nous chiffrons celle-ci après l'avoir vue.",
  es: "Se requiere evaluación en sitio — cotizamos este trabajo después de verlo.",
};

/** The default multipliers. Provenance in the header; editable per company. */
export const DEFAULT_COMPLEXITY_MULTIPLIERS = {
  standard: 1,
  moderate: 1.25,
  complex: 1.75,
  // null, not 1 and not 2: "no automatic price" is the statement.
  specialty: null,
};

const LISTS = {
  stairs: STAIRS_COMPLEXITY,
  roofing_service: ROOFING_COMPLEXITY,
  cabinet_refinishing: CABINET_COMPLEXITY,
  cabinet_refacing: CABINET_COMPLEXITY,
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Own-property lookup — the keys arrive from stored JSON. Same guard, same
 *  reason, as the one in app/data/tradePriceBooks.js. */
function ownKey(map, key) {
  return map &&
    typeof map === "object" &&
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(map, key)
    ? map[key]
    : undefined;
}

/** A three-language string, in the language asked for, falling back to en. */
export function say(entry, language) {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;
  const lang = String(language || "en").slice(0, 2).toLowerCase();
  return String(ownKey(entry, lang) ?? entry.en ?? "");
}

/**
 * The factor list for a trade, or null when the trade has none.
 *
 * Null is a fact about the trade, not a gap to pad: a snow-removal group has
 * no complexity questions and a picker rendered over an empty list would be a
 * control that appears to work and doesn't.
 */
export function complexityFor(tradeKey) {
  return ownKey(LISTS, tradeKey) || null;
}

/** Every trade that has a factor list — for the checks and the settings card. */
export function complexityTrades() {
  return Object.keys(LISTS);
}

/**
 * The company's own multipliers and forcing switches, read off the merged
 * price book.
 *
 * Stored under `complexityFactors` in CompanyServiceCategory.rates, declared
 * in PRICE_BOOK_FIELDS so sanitiseRates lets them through, and rendered on the
 * trade's rate card. A switch is stored as 1/0 because that sanitiser coerces
 * every declared field to a finite number — a boolean would be dropped on the
 * way in and the toggle would be a dead control.
 */
export function complexitySettings(book) {
  const cfg = book && typeof book === "object" ? book.complexityFactors : null;
  const mult = cfg && typeof cfg === "object" ? cfg.multiplier : null;
  const force = cfg && typeof cfg === "object" ? cfg.force : null;

  // A multiplier at or below zero is not an opinion about hard work, it is a
  // typo or a hostile payload; it falls back rather than zeroing a crew's day.
  const read = (key) => {
    const v = num(mult && ownKey(mult, key));
    return v > 0 ? v : DEFAULT_COMPLEXITY_MULTIPLIERS[key];
  };

  return {
    multiplier: {
      standard: 1,
      moderate: read("moderate"),
      complex: read("complex"),
      specialty: null,
    },
    force: {
      darkToLight: num(force && ownKey(force, "darkToLight")) === 1,
      veneer: num(force && ownKey(force, "veneer")) === 1,
    },
  };
}

/**
 * Resolve a group's ticked factors into a level, a multiplier and the reason
 * lines the client reads.
 *
 * @param {object} p
 * @param {string} p.trade      category key, e.g. "stairs"
 * @param {object} p.complexity the stored `{ model, factors: {key: value} }`
 * @param {object} [p.book]     the merged price book, for the company's own
 *                              multipliers and switches
 * @param {string} [p.language] the DOCUMENT's language for the reason lines
 * @returns {null|{
 *   model, level, levelLabel, score, maxScore, multiplier, priced,
 *   assessmentText, reasons: string[], forcedBy: string[], factors: object
 * }}
 *   null when this group is not on the new model — see the header.
 */
export function resolveComplexity({ trade, complexity, book = null, language = "en" } = {}) {
  const list = complexityFor(trade);
  if (!list) return null;
  if (!complexity || typeof complexity !== "object") return null;
  if (complexity.model !== COMPLEXITY_MODEL) return null;

  const settings = complexitySettings(book);
  const chosen =
    complexity.factors && typeof complexity.factors === "object"
      ? complexity.factors
      : {};

  let score = 0;
  let maxScore = 0;
  const reasons = [];
  const forcedBy = [];
  const factors = {};

  for (const factor of list.factors) {
    // The heaviest answer this factor can carry — the denominator the check
    // script uses to prove the thresholds are reachable.
    maxScore += factor.options.reduce((m, o) => Math.max(m, num(o.weight)), 0);

    const value = ownKey(chosen, factor.key);
    if (typeof value !== "string") continue;
    const option = factor.options.find((o) => o.value === value);
    // An answer this factor does not offer is dropped, not scored as zero and
    // not scored as the worst case. A stale draft naming a removed option must
    // not silently change a price in either direction.
    if (!option) continue;

    factors[factor.key] = option.value;
    score += num(option.weight);

    if (option.reason) reasons.push(say(option.reason, language));

    // Two kinds of forcing. `forces: "specialty"` is the trade saying this
    // answer is always a site visit; `forcesWhen` is the OWNER's switch, off
    // by default, because he wanted to decide per company whether a dark-to-
    // light stair or a veneer stringer is a job he will price from a form.
    if (option.forces === "specialty") forcedBy.push(factor.key);
    else if (
      option.forcesWhen &&
      settings.force[option.forcesWhen] === true
    )
      forcedBy.push(factor.key);
  }

  const level = forcedBy.length
    ? "specialty"
    : levelFromScore(score, list.thresholds);
  const multiplier = settings.multiplier[level];

  return {
    model: COMPLEXITY_MODEL,
    trade,
    // Carried so every string derived from this object afterwards — the
    // reason paragraph, the Specialty line — comes from the same language
    // the reasons above were written in.
    language: String(language || "en").slice(0, 2).toLowerCase(),
    level,
    levelLabel: LEVEL_LABELS[level],
    score,
    maxScore,
    // null on specialty, and every caller has to cope with that rather than
    // being handed a 1 that reads like "no uplift".
    multiplier: multiplier == null ? null : multiplier,
    priced: level !== "specialty",
    assessmentText: level === "specialty" ? say(ASSESSMENT_COPY, language) : "",
    reasons,
    forcedBy,
    factors,
  };
}

/** Thresholds are inclusive lower bounds, checked worst-first. */
function levelFromScore(score, thresholds) {
  const t = thresholds || {};
  if (num(t.specialty) > 0 && score >= num(t.specialty)) return "specialty";
  if (num(t.complex) > 0 && score >= num(t.complex)) return "complex";
  if (num(t.moderate) > 0 && score >= num(t.moderate)) return "moderate";
  return "standard";
}

/**
 * The hours a level implies. LABOUR ONLY — this is the whole point.
 *
 * Callers pass the hours a takeoff measured and get the hours the crew will
 * actually stand there. Materials never come through this function, so a
 * Complex staircase costs 1.75× the day and 1× the stain, which is what
 * happens on site and what keeps the margin figure meaningful.
 *
 * Specialty returns the hours UNCHANGED, flagged. There is no measured
 * multiplier for it and inventing one would put a number nobody stands behind
 * into scheduling and job costing.
 */
export function applyComplexityToHours(hours, resolved) {
  const base = num(hours);
  if (!resolved || resolved.model !== COMPLEXITY_MODEL) return base;
  const m = resolved.multiplier;
  if (m == null || !(m > 0)) return base;
  const out = base * m;
  return Number.isFinite(out) ? Math.round(out * 100) / 100 : base;
}

/**
 * The reason lines as ONE client-facing paragraph, for a line item's `detail`.
 *
 * `detail` is what lib/documentSections/ScopeGroupsSection.js prints under the
 * line on the quote, the PDF and the email — so this is the whole of what a
 * homeowner sees. The LEVEL and the MULTIPLIER are deliberately absent: the
 * client is owed the reasons, not the arithmetic, and "Complex ×1.75" on a
 * quote is an invitation to argue about the coefficient instead of the work.
 *
 * Returns "" when nothing was ticked, so a caller can omit `detail` rather
 * than write an empty paragraph into stored JSON.
 */
export function complexityDetailText(resolved, language = "en") {
  if (!resolved || !Array.isArray(resolved.reasons)) return "";
  const lines = resolved.reasons.filter(Boolean);
  if (!lines.length) return "";
  return lines.map((l) => `• ${l}`).join("\n");
}

/**
 * The unpriced line a Specialty group becomes.
 *
 * A text line with `priceMode: "none"` prints NO amount column at all —
 * lib/quotes/textBlocks.js's lineShowsAmount, which the PDF, the email and the
 * builder table all consult. That is the difference between "we have not
 * priced this yet" and "$0.00", and the second one is a quote a homeowner can
 * hold you to.
 *
 * `language` is taken from the RESOLVED object, not from an argument. It was
 * an argument for one draft and that was a second source of truth for the same
 * fact: a caller that resolved in French and then asked for an English line
 * would get a French bullet list under an English sentence. The language a
 * complexity was resolved in is the document's, and the whole line follows it.
 */
export function specialtyLine(resolved, label) {
  const language = resolved?.language || "en";
  const detail = complexityDetailText(resolved, language);
  return {
    description: `${label} — ${resolved.assessmentText}`,
    quantity: 1,
    unit: "flat",
    rate: 0,
    amount: 0,
    kind: "text",
    priceMode: "none",
    ...(detail ? { detail } : {}),
  };
}

/** A blank stored complexity for a trade, or null when it has no list. */
export function newComplexity(tradeKey) {
  const list = complexityFor(tradeKey);
  if (!list) return null;
  // Every factor opens on its benign answer, which is a STATEMENT the
  // estimator can change — not an absence dressed up as one. The weights make
  // that honest: the benign answer is the zero-weight answer, so an untouched
  // control prices exactly as no control at all did.
  const factors = {};
  for (const factor of list.factors) factors[factor.key] = factor.options[0].value;
  return { model: COMPLEXITY_MODEL, factors };
}

export { STAIRS_COMPLEXITY, ROOFING_COMPLEXITY, CABINET_COMPLEXITY };
