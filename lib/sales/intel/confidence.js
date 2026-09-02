// lib/sales/intel/confidence.js
//
// How sure are we, of WHAT, and on the strength of what kind of signal.
//
// ══ Field-level, not one lead score ════════════════════════════════════════
//
// A single 0–100 "confidence" on a prospect answers no question anybody asks.
// A rep about to dial wants to know whether the phone number is right and
// whether the "no online booking" line is safe to say — two different
// certainties with different evidence behind them, and averaging them produces
// a number that is wrong about both.
//
// So confidence is computed per field, and `ProspectScore` — how ATTRACTIVE
// the prospect is — stays a separate table, as the schema's own comment says.
//
// ══ Weights are data; CLASSIFICATION is not ════════════════════════════════
//
// `ConfidenceRule` rows carry the weight of each signal so a superadmin can
// tune them without a deploy. What those rows deliberately do NOT carry is
// which CATEGORY a signal is in. That lives in SIGNALS below, in code.
//
// The reason is the property this file exists to protect: a Place ID match and
// a similar-sounding name two streets apart are not the same kind of claim, and
// no amount of tuning may make the second one look like the first. If category
// came off the row, a superadmin raising `identity.similar_name` to 1.0 —
// reasonably, trying to surface more matches — would silently promote guesses
// to verified identity across the whole database. Weight is a dial; category is
// a boundary, and a boundary somebody can move is not one.
//
// A signal name with no entry in SIGNALS contributes NOTHING, rather than
// defaulting to some middle weight. Absence of a statement is not a statement
// (AGENTS.md failure class 5), and a typo'd signal that quietly counted for 0.5
// would be indistinguishable from a real one.
//
// ══ A high score never makes an inference a fact ═══════════════════════════
//
// The schema already separates `ProspectCapability` (a fact) from
// `ProspectInference` (a conclusion the evidence supports but does not prove).
// That separation survives the API only if something enforces it there, so
// `presentCapability`/`presentInference` below stamp `layer` and compute
// `verified` from the KIND of signal, never from the number. An inference
// returns `verified: false` at confidence 1.0, because there is no confidence
// at which "several vans in a photo" becomes "eleven employees".
//
// ══ House style ════════════════════════════════════════════════════════════
//
// The envelope is lib/analytics/kpis.js's — { value, sampleSize, incomplete,
// reason, reasonText } — so a screen can render any of these generically. The
// decision vocabulary is lib/crew/attribution.js's: a low-confidence identity
// match ASKS, it does not pick, and it comes back with the candidates so the
// question can be a tap rather than free text.

/**
 * How a signal is classed, and what that class is allowed to conclude.
 *
 *   identity_deterministic  an identifier that is the same identifier. A Place
 *                           ID, an E.164 phone, a registrable domain, a
 *                           normalised address. Can settle a match on its own.
 *   identity_fuzzy          a resemblance. Can never settle a match, at any
 *                           weight — see FUZZY_CEILING.
 *   detection_direct        a machine-readable fingerprint we read off the
 *                           page: a script source, an embed host, schema.org
 *                           markup, a Google field. Can verify a capability.
 *   detection_soft          prose, a link, a meta tag. Real evidence, and never
 *                           on its own enough to call a capability verified.
 *   first_party             the business itself said it, on a recorded call.
 *                           Outranks any web inference — the reason
 *                           ProspectInference carries a `source` column.
 *   human                   somebody looked and corrected it. Top of the stack.
 */
export const CATEGORIES = Object.freeze([
  "identity_deterministic",
  "identity_fuzzy",
  "detection_direct",
  "detection_soft",
  "first_party",
  "human",
]);

/**
 * Every signal this engine understands, its category, and its DEFAULT weight.
 *
 * The defaults are what `seedConfidenceRules()` writes. Once a `ConfidenceRule`
 * row exists it wins on weight — that is the point of the table — but never on
 * category.
 */
export const SIGNALS = Object.freeze({
  // ── Identity: deterministic ────────────────────────────────────────────
  // A Place ID is the identifier itself, so it is 1.0 and nothing else is.
  "identity.google_place_id": { category: "identity_deterministic", weight: 1.0 },
  // E.164, normalised on write (see Prospect.phoneE164) so a match is a match.
  // Below the Place ID because two businesses genuinely share a line — a
  // husband-and-wife pair of trades on one mobile is common.
  "identity.exact_phone": { category: "identity_deterministic", weight: 0.95 },
  // Registrable domain, lowercased, no scheme. Below phone because a marketing
  // agency's domain can front several of its clients' sites.
  "identity.exact_domain": { category: "identity_deterministic", weight: 0.9 },
  // Normalised street address. Lowest of the four: two trades share a unit in
  // an industrial park more often than they share a phone.
  "identity.exact_address": { category: "identity_deterministic", weight: 0.85 },

  // ── Identity: fuzzy ────────────────────────────────────────────────────
  // "Nordic Painting" and "Nordic Painting & Decor" — a question, not an answer.
  "identity.similar_name": { category: "identity_fuzzy", weight: 0.35 },
  "identity.nearby_address": { category: "identity_fuzzy", weight: 0.3 },
  "identity.same_city": { category: "identity_fuzzy", weight: 0.15 },

  // ── Detection: direct ──────────────────────────────────────────────────
  "detection.script_src": { category: "detection_direct", weight: 0.9 },
  "detection.iframe_host": { category: "detection_direct", weight: 0.85 },
  "detection.schema_org": { category: "detection_direct", weight: 0.8 },
  "detection.google_field": { category: "detection_direct", weight: 0.9 },
  "detection.form": { category: "detection_direct", weight: 0.7 },

  // ── Detection: soft ────────────────────────────────────────────────────
  "detection.meta": { category: "detection_soft", weight: 0.6 },
  "detection.link": { category: "detection_soft", weight: 0.55 },
  "detection.page_content": { category: "detection_soft", weight: 0.45 },

  // ── First-party and human ──────────────────────────────────────────────
  "detection.transcript": { category: "first_party", weight: 0.95 },
  "correction.human": { category: "human", weight: 1.0 },
});

export const SIGNAL_NAMES = Object.freeze(Object.keys(SIGNALS));

/** Categories whose signals can, alone, settle that two records are the same. */
const DETERMINISTIC_IDENTITY = new Set(["identity_deterministic", "human"]);

/** Categories that can make a stated fact VERIFIED rather than merely likely. */
const VERIFYING = new Set(["detection_direct", "first_party", "human", "identity_deterministic"]);

/**
 * At or above this, an identity match may be taken automatically.
 *
 * The number is not the interesting part — the relationship to FUZZY_CEILING
 * is. See below.
 */
export const MATCH_THRESHOLD = 0.8;

/**
 * The most a pile of resemblances may ever add up to.
 *
 * Strictly below MATCH_THRESHOLD, and that gap is the guarantee: no number of
 * fuzzy signals, at any weight a superadmin can set, can reach an automatic
 * match. Without the ceiling the combination below is a noisy-or, and four
 * weak signals climb past 0.8 on their own — which is precisely "a similar
 * name two streets apart" being merged into a real business because there
 * were several of it.
 *
 * scripts/check-sales-opportunity.mjs asserts FUZZY_CEILING < MATCH_THRESHOLD
 * and executes the pile-of-fuzzy-signals case, because this is the kind of
 * invariant that survives being written down and not being true.
 */
export const FUZZY_CEILING = 0.6;

/** Reason codes, and the sentence a screen prints. kpis.js's REASONS shape. */
export const REASONS = Object.freeze({
  no_signals: "Nothing has been observed that bears on this yet.",
  no_known_signals:
    "Signals were recorded, but none of them are signals this engine understands.",
  fuzzy_only:
    "Only resemblances — a similar name, a nearby address. Enough to ask about, never enough to conclude.",
  disabled_signals:
    "The only signals present have been switched off in the confidence rules.",
  single_soft_signal:
    "One soft signal — prose on a page, or a link. Real, and not enough to call this verified.",
  weakest_link:
    "A recommendation is only as sure as the least sure thing it cites, so this is the lowest of them.",
});

/** Prisma Decimal, a number, a numeric string, or nothing. */
function toNum(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === "object" && typeof v.toNumber === "function") {
    const n = v.toNumber();
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * The envelope. Identical in shape to lib/analytics/kpis.js's, deliberately —
 * two subsystems that both have to say "I am not sure, and here is why" should
 * not invent two vocabularies for it.
 */
function envelope({ value = null, sampleSize = 0, incomplete = false, reason = null, ...extra }) {
  return {
    value,
    sampleSize,
    incomplete,
    reason,
    reasonText: reason ? REASONS[reason] || reason : null,
    ...extra,
  };
}

/**
 * Resolve the tunable half: signal name → weight.
 *
 * A `ConfidenceRule` row for a signal SIGNALS does not know about is ignored,
 * with its name returned, so the rules screen can show a superadmin that they
 * are tuning something nothing reads — the "written and never read" failure
 * class, caught at the point it would otherwise hide.
 *
 * @param {Array<{signal:string, weight:any, enabled?:boolean}>} rules
 */
export function weightsFrom(rules = []) {
  const weights = new Map();
  const disabled = new Set();
  const unrecognised = [];

  for (const name of SIGNAL_NAMES) weights.set(name, SIGNALS[name].weight);

  for (const row of Array.isArray(rules) ? rules : []) {
    const name = typeof row?.signal === "string" ? row.signal : null;
    if (!name) continue;
    if (!SIGNALS[name]) {
      unrecognised.push(name);
      continue;
    }
    if (row.enabled === false) {
      disabled.add(name);
      weights.delete(name);
      continue;
    }
    const w = toNum(row.weight, null);
    // A row with an unreadable weight falls back to the built-in default
    // rather than to zero: silently dropping a signal is how a whole detector
    // stops counting without anyone noticing.
    if (w != null) weights.set(name, clamp01(w));
  }

  return { weights, disabled, unrecognised };
}

/** Signals we recognise, are not disabled, and have a weight for. */
function usable(signals, weights, disabled) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(signals) ? signals : []) {
    const name = typeof s === "string" ? s : s?.signal;
    if (typeof name !== "string" || !SIGNALS[name]) continue;
    if (disabled.has(name)) continue;
    // The same signal twice is one signal. Two page_content hits for the same
    // claim are one reading of one page, and combining them as independent
    // would manufacture certainty out of a repeated look.
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, category: SIGNALS[name].category, weight: weights.get(name) ?? 0 });
  }
  return out;
}

/**
 * Combine independent signals: 1 − Π(1 − w).
 *
 * Noisy-or rather than max or sum. Max ignores corroboration entirely; sum
 * exceeds 1 and then has to be clamped, which quietly makes three mediocre
 * signals identical to three excellent ones.
 */
function combine(entries) {
  let miss = 1;
  for (const e of entries) miss *= 1 - clamp01(e.weight);
  return clamp01(1 - miss);
}

/**
 * How sure are we that these two records are the same business?
 *
 * ── It ASKS, it does not pick ──────────────────────────────────────────────
 *
 * lib/crew/attribution.js's rule, for the same asymmetry: the cost of asking
 * is a human glancing at two rows, and the cost of a wrong merge is
 * unrecoverable — ProspectCorrection exists because a bad merge destroys
 * provenance. So `decision` is "match" only on a deterministic signal, and
 * "review" for everything a person should look at, with `candidates` attached
 * so the question can be a tap.
 *
 * @param {{ signals: string[], rules: Array, candidates?: Array }} input
 */
export function identityConfidence({ signals = [], rules = [], candidates = [] } = {}) {
  const { weights, disabled } = weightsFrom(rules);
  const present = usable(signals, weights, disabled);

  if (present.length === 0) {
    const anyGiven = (Array.isArray(signals) ? signals : []).length > 0;
    const anyRecognised = (Array.isArray(signals) ? signals : []).some(
      (s) => SIGNALS[typeof s === "string" ? s : s?.signal],
    );
    return envelope({
      sampleSize: 0,
      reason: !anyGiven
        ? "no_signals"
        : anyRecognised
          ? "disabled_signals"
          : "no_known_signals",
      tier: "none",
      decision: "no_match",
      candidates,
      contributing: [],
    });
  }

  const deterministic = present.filter((e) => DETERMINISTIC_IDENTITY.has(e.category));
  const raw = combine(present);

  // The ceiling, applied on CATEGORY rather than on the number. A pile of
  // resemblances is capped no matter what weights are set, because the cap
  // asks what KIND of signal is present, and that is not tunable.
  const value = deterministic.length ? round3(raw) : round3(Math.min(raw, FUZZY_CEILING));

  const tier = deterministic.length ? "deterministic" : "fuzzy";
  // The `tier` half of this test is REDUNDANT today and kept deliberately.
  // Mutation testing confirmed it: removing it changes no behaviour, because
  // the ceiling above already puts every fuzzy-only result below
  // MATCH_THRESHOLD. It becomes load-bearing the moment somebody raises
  // FUZZY_CEILING or lowers MATCH_THRESHOLD, which is exactly the change
  // somebody makes without re-deriving this argument — so the guard stays,
  // named as belt-and-braces rather than dressed up as the thing doing the work.
  const decision =
    tier === "deterministic" && value >= MATCH_THRESHOLD
      ? "match"
      : // Never "no_match" on the strength of a fuzzy pile — that is a decision
        // too, and the wrong one to make silently. It goes to a person.
        "review";

  return envelope({
    value,
    sampleSize: present.length,
    incomplete: false,
    reason: tier === "fuzzy" ? "fuzzy_only" : null,
    tier,
    decision,
    // Only meaningful when somebody has to choose; carried regardless so a
    // renderer does not have to branch on decision to know whether to ask.
    candidates: decision === "match" ? [] : candidates,
    contributing: present.map((e) => ({ signal: e.name, category: e.category, weight: e.weight })),
  });
}

/**
 * How sure are we of one observed field — a capability, a technology?
 *
 * Same combination, no identity ceiling (this is not a merge decision), and it
 * additionally reports whether anything VERIFYING was present, which is what
 * `presentCapability` turns into the `verified` flag.
 */
export function fieldConfidence({ signals = [], rules = [] } = {}) {
  const { weights, disabled } = weightsFrom(rules);
  const present = usable(signals, weights, disabled);

  if (present.length === 0) {
    const given = Array.isArray(signals) ? signals : [];
    const anyRecognised = given.some((s) => SIGNALS[typeof s === "string" ? s : s?.signal]);
    return envelope({
      sampleSize: 0,
      reason: given.length === 0 ? "no_signals" : anyRecognised ? "disabled_signals" : "no_known_signals",
      verifying: false,
      contributing: [],
    });
  }

  const verifying = present.some((e) => VERIFYING.has(e.category));
  const soleSoft = !verifying && present.length === 1;

  return envelope({
    value: round3(combine(present)),
    sampleSize: present.length,
    // Not short-measure — this is everything we have — but flagged when the
    // only thing behind it is prose, because that is the case a rep should
    // hedge out loud rather than assert.
    incomplete: false,
    reason: soleSoft ? "single_soft_signal" : null,
    verifying,
    contributing: present.map((e) => ({ signal: e.name, category: e.category, weight: e.weight })),
  });
}

/**
 * How sure is a recommendation, given the confidences of the rows it cites?
 *
 * The MINIMUM, not the average and not a noisy-or. A recommendation is a
 * conjunction — "they have no booking page AND no competitor platform" — and a
 * conjunction is only as sure as its least sure part. Averaging lets one
 * certain observation carry a shaky one into a sentence a rep says out loud.
 *
 * Called by lib/sales/intel/opportunity.js. Kept here so there is one place
 * that decides what a number means.
 */
export function opportunityConfidence(confidences = []) {
  const list = (Array.isArray(confidences) ? confidences : [])
    .map((c) => toNum(c, null))
    .filter((n) => n != null)
    .map(clamp01);

  if (list.length === 0) {
    // Reachable only for an opportunity built entirely out of absence
    // conditions — which the evidence gate in opportunity.js refuses before
    // this is ever stored. Returning null rather than a default is what makes
    // that refusal visible if the gate is ever weakened.
    return envelope({ sampleSize: 0, reason: "no_signals" });
  }

  return envelope({
    value: round3(Math.min(...list)),
    sampleSize: list.length,
    incomplete: false,
    reason: list.length > 1 ? "weakest_link" : null,
  });
}

// ── The API surface: three layers that never collapse into one ─────────────

export const LAYER_FACT = "fact";
export const LAYER_INFERENCE = "inference";
export const LAYER_RECOMMENDATION = "recommendation";

/**
 * A `ProspectCapability` row, shaped for an API response.
 *
 * `verified` is computed from the KIND of signal behind it, never from the
 * number: a capability seen only in page prose is `verified: false` at
 * confidence 0.95, and one read off a script tag is `verified: true` at 0.7.
 * A renderer that ticks a box on a high score is the bug this prevents.
 *
 * `value` stays three-valued out to the client. Collapsing null to false at
 * the serialisation boundary would undo the whole schema decision one layer
 * from the screen.
 */
export function presentCapability(row, { rules = [] } = {}) {
  const value = row?.value === true ? true : row?.value === false ? false : null;
  const confidence = fieldConfidence({ signals: row?.signals || [], rules });
  return {
    layer: LAYER_FACT,
    code: row?.code ?? null,
    value,
    // Unknown is never verified, whatever the signals say — there is no
    // statement to have verified.
    verified: value !== null && confidence.verifying === true,
    confidence,
    evidenceIds: Array.isArray(row?.evidenceIds) ? row.evidenceIds : [],
  };
}

/**
 * A `ProspectInference` row, shaped for an API response.
 *
 * `verified` is hard-coded false and takes no arguments. This is the line the
 * spec's §2 draws — a conclusion the evidence SUPPORTS but does not prove — and
 * making it a constant rather than a computation means no future weight change,
 * no first-party transcript, and no 1.0 confidence can flip it. A prospect
 * saying "we have six technicians" on a call is a strong inference and still an
 * inference; if it should become a fact, it becomes a fact by being written to
 * a fact table, not by scoring well here.
 */
export function presentInference(row, { rules = [] } = {}) {
  return {
    layer: LAYER_INFERENCE,
    kind: row?.kind ?? null,
    // A CLASSIFICATION, never a number — the schema's own comment.
    value: row?.value ?? null,
    verified: false,
    confidence: fieldConfidence({ signals: row?.signals || [], rules }),
    source: row?.source ?? "derived",
    evidenceIds: Array.isArray(row?.evidenceIds) ? row.evidenceIds : [],
  };
}

/**
 * A `ProspectOpportunity` row, shaped for an API response.
 *
 * Also never verified: a recommendation is an argument, not an observation.
 * It carries the evidence so the argument can be walked back.
 */
export function presentOpportunity(row) {
  return {
    layer: LAYER_RECOMMENDATION,
    capabilityCode: row?.capabilityCode ?? null,
    rank: row?.rank ?? null,
    reason: row?.reason ?? null,
    verified: false,
    confidence:
      row?.confidence && typeof row.confidence === "object" && "value" in row.confidence
        ? row.confidence
        : envelope({ value: toNum(row?.confidence, null), sampleSize: 0 }),
    evidenceIds: Array.isArray(row?.evidenceIds) ? row.evidenceIds : [],
    ruleCode: row?.ruleCode ?? null,
    ruleVersion: row?.ruleVersion ?? null,
  };
}

/**
 * The default `ConfidenceRule` rows, for the seeder.
 *
 * Version "1" across the board: a weight change a superadmin makes is a row
 * update, and the version is what lets a later analysis say which weights a
 * stored score was computed under.
 */
export function seedConfidenceRules() {
  return SIGNAL_NAMES.map((signal) => ({
    signal,
    weight: SIGNALS[signal].weight,
    category: SIGNALS[signal].category,
    enabled: true,
    version: "1",
  }));
}
