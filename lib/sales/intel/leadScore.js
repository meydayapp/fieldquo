// lib/sales/intel/leadScore.js
//
// How worth calling a prospect is, as a number a rep can argue with.
//
// ══ Deterministic rules, and NO conversion probability ═════════════════════
//
// The spec's §18 settles the shape: rules first, and no invented conversion
// probabilities before there is data. That second half is the one worth
// spelling out, because the tempting output is "68% likely to convert" and it
// would be fiction. FieldQuo has closed no deals through this pipeline; there
// is no outcome to have fitted anything to. A percentage implies a measurement
// nobody has taken, and a rep who trusts one and finds it wrong stops trusting
// the whole screen.
//
// So the output is an ORDERING, 0–100, of how much there is to work with —
// built entirely out of things we can point at:
//
//   can a rep reach them at all      phone, street address
//   is this our market               trade fit, company scale, territory
//   is there anything to say         opportunities the rule engine produced
//   who else is in the room          a competitor's platform, detected
//   how current is the record        the source's own refresh date
//
// ══ The weights are judgement, and this file says so ══════════════════════
//
// lib/analytics/leadScoring.js makes exactly this point about the contractor-
// side lead score, and it applies here word for word: these numbers are
// somebody's opinion about what makes a prospect worth an hour, and none of
// them has been checked against whether a deal closed. They are a starting
// position to be measured, not a model. When there are enough decided
// prospects, the measurement is the same one leadScoring.js already does:
// score against outcome, on decided rows only, reporting a fraction below the
// sample floor rather than a percentage.
//
// ══ Every reason is `{ label, weight }` ═══════════════════════════════════
//
// The shape `LeadRequest.scoreReasons` already uses, and its schema comment
// gives the reason: "so the number is never a black box a rep has to trust
// blind". Reusing it means one convention for two scores rather than two.
//
// A weight of ZERO is a real entry and not padding. "The website was never
// read, so capability gaps are unknown" changes no arithmetic and is the most
// important line on the card when it is true — it is the difference between a
// low score meaning "there is nothing here" and meaning "we have not looked".
// Absence is stated, never inferred (AGENTS.md failure class 5).
//
// ══ Versioned, because the weights will change ════════════════════════════
//
// `ProspectScore.scoringVersion` exists so last month's stored scores stay
// readable after these weights move. Bump SCORING_VERSION whenever a weight,
// a threshold or a signal changes — anything that would make the same prospect
// score differently. Not for a label edit: a reworded sentence describes the
// same arithmetic.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// Rows in, decision out. lib/analytics/kpis.js does the same and its header
// says why: it is what lets the whole ladder be executed against hostile input
// by a check with no database.
import { isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { STALE_AFTER_DAYS, sourceAgeDays } from "@/lib/sales/discovery/normalise";

/** Bump on any change that would score the same prospect differently. */
export const SCORING_VERSION = "1";

/**
 * The weights, in one object.
 *
 * ── Standing rule 1, and where this stands against it ─────────────────────
 *
 * The owner's standing rule is that every rule and setting is editable from
 * the superadmin console — and lead-score weights are named in it explicitly.
 * These are constants, and that is a gap rather than a decision: there is no
 * `LeadScoreWeight` table to edit and the schema was held by other work while
 * this shipped. They sit in the same position as `DETECTION_THRESHOLD` in
 * technology.js and `MATCH_THRESHOLD` in confidence.js, which the same rule
 * has so far accepted. Exported as one frozen object precisely so that the
 * screen, when it lands, reads these as the DEFAULTS and the database as the
 * truth — the shape loadCapabilityMatrix() already uses for the matrix.
 */
export const LEAD_SCORE_WEIGHTS = Object.freeze({
  phonePresent: 25,
  phoneMissing: -25,
  addressPresent: 5,
  inTerritory: 5,
  tradeMapped: 10,
  tradeUnmapped: -5,
  perOpportunity: 8,
  competitorPresent: -8,
  reviewsEstablished: 8,
  reviewsSome: 3,
  scaleSolo: 5,
  scaleSmall: 10,
  scaleFranchise: -15,
  listingStale: -10,
  noWebsiteListed: 10,
});

/** At most this many opportunities count toward the score. A prospect with
 *  nine gaps is not three times as attractive as one with three; past a
 *  handful the rep runs out of call, not out of talking points. */
export const MAX_SCORED_OPPORTUNITIES = 3;

/** Reviews at or above this are an established business rather than a new one.
 *  Deliberately blunt: the only honest thing a review COUNT supports is "this
 *  business has been trading a while", and two buckets is as fine as that
 *  claim gets. */
export const ESTABLISHED_REVIEWS = 20;

/** The company-scale buckets this score knows, and what it does with them.
 *  A bucket outside this list contributes NOTHING rather than a default —
 *  an inference kind we have not thought about must not be silently scored. */
export const SCALE_WEIGHTS = Object.freeze({
  SOLO_LIKELY: "scaleSolo",
  SMALL_BUSINESS: "scaleSmall",
  FRANCHISE_LIKELY: "scaleFranchise",
});

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** Prisma Decimal, number, numeric string, or nothing. Never NaN. */
function toNum(v) {
  if (v == null) return null;
  if (typeof v === "object" && typeof v.toNumber === "function") {
    const n = v.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Three-valued, strictly — the same rule opportunity.js's normaliseValue
 *  keeps, restated here rather than imported so this module stays free of the
 *  opportunity engine. Only a real boolean is a statement. */
function known(value) {
  return value === true || value === false;
}

/**
 * Score one prospect.
 *
 * @param prospect       the row: phoneE164, addressLine, tradeKey, territoryId,
 *                       websiteUrl, googleReviewCount, sourceUpdatedAt
 * @param capabilities   ProspectCapability rows — { code, value }
 * @param technologies   ProspectTechnology rows — { technologyCode, isCompetitor }
 * @param opportunities  what the rule engine produced — { capabilityCode }
 * @param inferences     ProspectInference rows — { kind, value }
 * @param now            for the staleness arithmetic; injected so the check
 *                       does not depend on today's date
 *
 * @returns { score, reasons: [{label, weight}], scoringVersion, observed }
 *          `observed` is not stored. It is what the handler's note and the
 *          research brief read to say whether a low score means "nothing here"
 *          or "we never looked".
 */
export function computeLeadScore({
  prospect = null,
  capabilities = [],
  technologies = [],
  opportunities = [],
  inferences = [],
  now = new Date(),
  weights = LEAD_SCORE_WEIGHTS,
} = {}) {
  const reasons = [];
  const add = (label, weight) => reasons.push({ label, weight });

  // ── Can a rep reach them ────────────────────────────────────────────────
  if (prospect?.phoneE164) {
    add("A phone number is on the record", weights.phonePresent);
  } else {
    // Not "this business has no phone" — "the record we hold has none". The
    // measured fill rate is 99.6%, so this is rare and it is decisive: the
    // whole pipeline exists to produce a call.
    add("No phone number on the record — there is nothing to dial", weights.phoneMissing);
  }

  if (prospect?.addressLine) {
    add("A street address, so the record is a real premises", weights.addressPresent);
  }

  // ── Is this our market ──────────────────────────────────────────────────
  if (isDiscoveryTradeKey(prospect?.tradeKey)) {
    add(`Trade fits FieldQuo: ${prospect.tradeKey}`, weights.tradeMapped);
  } else {
    add("The source category maps to no FieldQuo trade", weights.tradeUnmapped);
  }

  if (prospect?.territoryId) {
    add("Inside a sales territory", weights.inTerritory);
  }

  const scale = inferences.find((i) => i?.kind === "company_scale");
  const scaleWeightKey = scale ? SCALE_WEIGHTS[scale.value] : null;
  if (scaleWeightKey) {
    add(`Company scale looks like ${String(scale.value).toLowerCase().replace(/_/g, " ")}`, weights[scaleWeightKey]);
  } else {
    add("Company size is unknown — nothing has been inferred about it", 0);
  }

  // ── Is there anything to say ────────────────────────────────────────────
  const opportunityCount = Array.isArray(opportunities) ? opportunities.length : 0;
  const counted = Math.min(opportunityCount, MAX_SCORED_OPPORTUNITIES);
  if (counted > 0) {
    add(
      `${counted} thing${counted === 1 ? "" : "s"} to talk about, each with evidence behind it`,
      counted * weights.perOpportunity,
    );
  }

  // The distinction the whole card turns on. A prospect whose site was never
  // read has no capability rows at all, or rows that are all null; either way
  // the absence of opportunities says nothing about the business.
  const decided = capabilities.filter((c) => known(c?.value)).length;
  if (decided === 0) {
    add("Their website has not been read, so capability gaps are unknown", 0);
  } else if (opportunityCount === 0) {
    add(`Their website was read (${decided} capabilities decided) and nothing came up to sell`, 0);
  }

  // ── Who else is in the room ─────────────────────────────────────────────
  const competitor = technologies.find((t) => t?.isCompetitor === true);
  if (competitor) {
    // Down, and this is the least-evidenced weight here. They already buy
    // software, which is a qualification; they are also mid-contract with
    // their data somewhere else, which is a longer call. Nobody has measured
    // which dominates, and this file's header says so rather than the number
    // implying somebody has.
    add(
      `Already running ${competitor.technologyCode} — a displacement conversation, not a gap`,
      weights.competitorPresent,
    );
  }

  // ── How much of a business is there ─────────────────────────────────────
  const reviews = toNum(prospect?.googleReviewCount);
  if (reviews != null) {
    if (reviews >= ESTABLISHED_REVIEWS) {
      add(`${reviews} reviews — an established business`, weights.reviewsEstablished);
    } else if (reviews > 0) {
      add(`${reviews} review${reviews === 1 ? "" : "s"}`, weights.reviewsSome);
    }
    // Exactly zero reviews is left alone on purpose: it is as likely to mean
    // "nobody has reviewed them" as "they are new", and neither is worth a
    // weight. A NULL never reaches here at all — the discovery source measured
    // for this pipeline carries no review count, and treating its absence as
    // zero would score every prospect down for a column that does not exist.
  }

  // ── The record's own age ────────────────────────────────────────────────
  const age = prospect?.sourceUpdatedAt ? sourceAgeDays(prospect.sourceUpdatedAt, now) : null;
  if (age != null && age > STALE_AFTER_DAYS) {
    add(`The directory last refreshed this record ${Math.floor(age / 365)}+ years ago`, weights.listingStale);
  }

  // ── No website listed ───────────────────────────────────────────────────
  //
  // A signal, not a disqualifier (spec §5), and phrased as what it actually
  // is: the SOURCE listed none. Suppressed when the crawl already decided
  // WEBSITE, because then the opportunity engine has counted it above and
  // scoring it twice would double one observation.
  const websiteDecided = capabilities.some((c) => c?.code === "WEBSITE" && known(c?.value));
  if (!prospect?.websiteUrl && !websiteDecided) {
    add("The source lists no website — worth confirming on the call", weights.noWebsiteListed);
  }

  const total = reasons.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  return {
    score: clamp(total),
    reasons,
    scoringVersion: SCORING_VERSION,
    observed: {
      capabilitiesDecided: decided,
      opportunities: opportunityCount,
      competitor: competitor ? competitor.technologyCode : null,
    },
  };
}

/**
 * Has anything changed since the last stored score?
 *
 * The pipeline re-scores on every run, and `ProspectScore` is history rather
 * than a column — so a re-run that changes nothing would file an identical row
 * and turn the history into noise. Compared on the score, the version and the
 * reasons, because two identical numbers reached for different reasons are a
 * real change worth keeping.
 */
export function scoreChanged(previous, next) {
  if (!previous) return true;
  if (Number(previous.score) !== Number(next.score)) return true;
  if (String(previous.scoringVersion) !== String(next.scoringVersion)) return true;
  return JSON.stringify(previous.reasons ?? null) !== JSON.stringify(next.reasons ?? null);
}
