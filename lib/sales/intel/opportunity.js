// lib/sales/intel/opportunity.js
//
// "What should this rep say to this contractor, and what did we actually see
// that makes it true?"
//
// ══ Deterministic, and that is the whole design ════════════════════════════
//
// The spec's §58 draws the boundary: deterministic software decides what
// software can determine, and AI is only used where interpretation is
// genuinely valuable. Whether an opportunity EXISTS is not interpretation. It
// is a comparison between rows we observed and a list of things we sell, and a
// model asked to do it would be confidently wrong on a sales call with nothing
// to point at afterwards.
//
// So the rules are DATA (`OpportunityRule.conditions`), this file is the
// evaluator, and a model may later rephrase `reason` for tone. Nothing in this
// file calls a model, and nothing downstream may add an opportunity that did
// not come out of it.
//
// ══ The property that matters most: unknown is not absent ══════════════════
//
// `ProspectCapability.value` is three-valued on purpose — the schema's own
// header says so — and this is the file where getting it wrong costs a deal. A
// rule that fires on `value === false` must NOT fire on `value === null`,
// because null means the crawler could not reach the page, not that the page
// does not exist. Telling a contractor they have no booking page when they
// have one is the failure that ends the call in the first thirty seconds.
//
// `normaliseValue` is therefore strict to the point of rudeness: only the
// boolean `true` is true, only the boolean `false` is false, and EVERYTHING
// else — undefined, null, "false", 0, "" — is unknown. The tempting version is
// `Boolean(v)` or `v !== true`; both turn "we did not look" into "they do not
// have it", which is the exact bug.
//
// ══ A recommendation with no evidence is impossible, not discouraged ═══════
//
// Every condition kind declares what evidence it yields, and a condition that
// asserts an ABSENCE yields none — you cannot cite a thing you did not see.
// The opportunity is then refused when the union is empty. The consequence is
// deliberate and worth stating: a rule built only out of "they don't have X"
// and "no competitor detected" can never produce a recommendation, because
// nothing was observed. That is not a gap in the rule engine; it is the point.
//
// ══ Pure ══════════════════════════════════════════════════════════════════
//
// Everything here takes already-loaded rows and returns a decision. db.js is
// the only file that fetches, in the shape lib/marketing/jobPhotoContext.js
// uses — because the hostile cases (a capability row that disagrees with
// itself, a rule pointing at a capability that was deactivated, two rules
// fighting over the same slot) are executed in
// scripts/check-sales-opportunity.mjs rather than reasoned about.
import { capabilityMatrix, OBSERVABLE_CAPABILITY_CODES } from "./capabilities";
import { opportunityConfidence } from "./confidence";

/**
 * Why a rule did not produce an opportunity, and the sentence a superadmin
 * reads on the rules screen.
 *
 * A closed vocabulary, the shape lib/analytics/kpis.js's REASONS uses, for the
 * same reason: a screen renders any refusal generically off the code, and
 * "this rule fired for nobody" is a question somebody will ask about a rule
 * they wrote, so the answer has to be a fact rather than a shrug.
 */
export const REFUSALS = Object.freeze({
  conditions_not_met: "The prospect does not match this rule's conditions.",
  no_conditions:
    "The rule has no conditions, so it would recommend this to every prospect. Refused.",
  unknown_capability:
    "The rule recommends a capability code that is not in the FieldQuo capability matrix.",
  inactive_capability:
    "The capability this rule recommends is switched off in the capability matrix.",
  inactive_rule: "The rule itself is switched off.",
  already_has:
    "The prospect already has this — we observed it. Recommending it would be telling them about something they are paying for.",
  incompatible:
    "Something the prospect already has makes this irrelevant to them.",
  missing_prerequisite:
    "This only makes sense alongside something the prospect does not have yet.",
  competitor_table_stakes:
    "A competitor's platform is installed, and this is a capability any such platform would be expected to carry. The conversation is a displacement, not a gap.",
  no_evidence:
    "Nothing was actually observed that supports this, so there is nothing to cite.",
  unresolved_reason:
    "The rule's reason template names something we have no value for, so the sentence would have had a hole in it.",
  duplicate_capability:
    "Another rule with a higher priority already recommends this capability.",
  unknown_condition_kind:
    "The rule uses a condition kind this evaluator does not implement.",
  unobservable_condition:
    "The rule conditions on a capability code no detector produces, so it could never fire.",
});

/**
 * Why a whole analysis produced nothing, when it produced nothing.
 *
 * Distinct from REFUSALS: those are per-rule, these are about the prospect.
 * "We have not looked at this business yet" and "we looked and there is
 * nothing to sell them" are different sentences and a rep needs to be able to
 * tell them apart.
 */
export const ANALYSIS_REASONS = Object.freeze({
  nothing_observed:
    "Nothing has been observed about this business yet — no capabilities, no technologies.",
  no_rules: "There are no active opportunity rules to apply.",
  nothing_matched: "Everything we know about this business was checked and nothing matched.",
  all_refused: "Rules matched, and every one of them was refused before it could be recommended.",
});

/** Every condition kind this evaluator implements. */
export const CONDITION_KINDS = Object.freeze([
  "capability",
  "capabilityUnknown",
  "technology",
  "competitor",
]);

/**
 * Three-valued, strictly.
 *
 * See the header. `Boolean(v)` and `v !== true` are both wrong here, in the
 * expensive direction, and this function exists so neither can be written by
 * accident somewhere further down.
 */
export function normaliseValue(v) {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

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

/** Evidence ids off a row: strings only, deduped, order preserved. */
function evidenceOf(row) {
  const ids = Array.isArray(row?.evidenceIds) ? row.evidenceIds : [];
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id === "string" && id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Fold the loaded rows into the two lookups every rule needs.
 *
 * ── Two rows for one code do not average, they cancel ──────────────────────
 *
 * `@@unique([prospectId, code])` means this should be impossible, and it is
 * still handled: rows arrive here from a caller, and a caller can be a check
 * script, a migration, or a detector mid-rewrite. Two rows that AGREE collapse
 * to their agreement. Two rows that DISAGREE collapse to unknown, not to
 * last-wins — a contradiction is not knowledge, and last-wins would make the
 * answer depend on the order the database happened to return.
 */
export function indexProspect({ capabilities = [], technologies = [] } = {}) {
  const capByCode = new Map();
  const conflicts = [];

  for (const row of Array.isArray(capabilities) ? capabilities : []) {
    const code = typeof row?.code === "string" ? row.code : null;
    if (!code) continue;
    const value = normaliseValue(row.value);
    const entry = {
      code,
      value,
      confidence: toNum(row.confidence, 0.5),
      evidenceIds: evidenceOf(row),
      detectedAt: row.detectedAt ?? null,
    };
    const prior = capByCode.get(code);
    if (!prior) {
      capByCode.set(code, entry);
      continue;
    }
    if (prior.value === value) {
      // Same claim twice. Keep the lower confidence and the union of evidence:
      // two sightings do not make us surer than the weaker of them.
      prior.confidence = Math.min(prior.confidence, entry.confidence);
      prior.evidenceIds = [...new Set([...prior.evidenceIds, ...entry.evidenceIds])];
      continue;
    }
    conflicts.push({ kind: "capability", code, values: [prior.value, value] });
    prior.value = null;
    prior.conflicted = true;
    prior.evidenceIds = [...new Set([...prior.evidenceIds, ...entry.evidenceIds])];
  }

  const techByCode = new Map();
  for (const row of Array.isArray(technologies) ? technologies : []) {
    const code = typeof row?.technologyCode === "string" ? row.technologyCode : null;
    if (!code) continue;
    const entry = {
      technologyCode: code,
      // Not coerced with Boolean(): an isCompetitor that arrives as the string
      // "false" from a JSON round trip would then read as a competitor and
      // silently switch the whole conversation to a displacement pitch.
      isCompetitor: row.isCompetitor === true,
      confidence: toNum(row.confidence, 0.5),
      evidenceIds: evidenceOf(row),
    };
    const prior = techByCode.get(code);
    if (!prior) {
      techByCode.set(code, entry);
      continue;
    }
    prior.confidence = Math.min(prior.confidence, entry.confidence);
    prior.evidenceIds = [...new Set([...prior.evidenceIds, ...entry.evidenceIds])];
    // A competitor sighting is not un-seen by a second row that omits the flag.
    prior.isCompetitor = prior.isCompetitor || entry.isCompetitor;
  }

  const competitors = [...techByCode.values()].filter((t) => t.isCompetitor);

  // What we have NOT looked at. Surfaced rather than silently treated as
  // absent — the whole point of the three-valued column, carried up to the
  // screen so a rep can see "we could not read their site" instead of a
  // confident empty list.
  const unchecked = OBSERVABLE_CAPABILITY_CODES.filter((code) => {
    const row = capByCode.get(code);
    return !row || row.value === null;
  });

  return {
    capByCode,
    techByCode,
    competitors,
    conflicts,
    unchecked,
    sampleSize: capByCode.size + techByCode.size,
  };
}

/** Held: observed to be true. Never "not observed to be false". */
function holds(index, code) {
  return index.capByCode.get(code)?.value === true;
}

/**
 * One condition, against one prospect.
 *
 * @returns {{ matched: boolean, evidenceIds: string[], confidence: number|null, problem: string|null }}
 *          `confidence` is null for a condition that matched on an ABSENCE —
 *          there is no observation to be confident about.
 */
export function evaluateCondition(condition, index) {
  const kind = condition?.kind;
  if (!CONDITION_KINDS.includes(kind)) {
    return { matched: false, evidenceIds: [], confidence: null, problem: "unknown_condition_kind" };
  }

  if (kind === "capability") {
    const want = normaliseValue(condition.is);
    if (want === null) {
      // `is` has to be a real boolean. A rule saying `is: "false"` would
      // otherwise silently mean "unknown", which is the opposite of what
      // whoever typed it meant.
      return { matched: false, evidenceIds: [], confidence: null, problem: "unknown_condition_kind" };
    }
    const row = index.capByCode.get(condition.code);
    // THE line. A missing row and a null value are both unknown, and unknown
    // does not satisfy `is: false`. Written as an explicit equality against the
    // normalised value so no future edit can turn it into a truthiness test.
    const value = row ? row.value : null;
    const matched = value === want;
    return {
      matched,
      // Evidence only for what we SAW. `is: false` is a real observation —
      // "we loaded the page and there was no booking link" — and the detector
      // records it with its own evidence rows, so it cites them. What never
      // cites anything is the absence of a row, which cannot match at all.
      evidenceIds: matched && row ? row.evidenceIds : [],
      confidence: matched && row ? row.confidence : null,
      problem: null,
    };
  }

  if (kind === "capabilityUnknown") {
    const row = index.capByCode.get(condition.code);
    const matched = !row || row.value === null;
    // Deliberately no evidence: "we do not know" is not something we observed.
    // A rule built only out of these therefore cannot produce a recommendation,
    // which is the correct outcome and not an oversight.
    return { matched, evidenceIds: [], confidence: null, problem: null };
  }

  if (kind === "technology") {
    const present = condition.present !== false;
    const row = index.techByCode.get(condition.code);
    const matched = present ? Boolean(row) : !row;
    return {
      matched,
      evidenceIds: matched && present && row ? row.evidenceIds : [],
      confidence: matched && present && row ? row.confidence : null,
      problem: null,
    };
  }

  // kind === "competitor"
  const present = condition.present !== false;
  const found = index.competitors;
  const matched = present ? found.length > 0 : found.length === 0;
  return {
    matched,
    evidenceIds: matched && present ? [...new Set(found.flatMap((t) => t.evidenceIds))] : [],
    confidence:
      matched && present && found.length
        ? Math.min(...found.map((t) => t.confidence))
        : null,
    problem: null,
  };
}

/** `all` must all match; a non-empty `any` needs one. */
function evaluateConditions(conditions, index) {
  const all = Array.isArray(conditions?.all) ? conditions.all : [];
  const any = Array.isArray(conditions?.any) ? conditions.any : [];

  // A rule with nothing to test recommends to everybody. That is the generic
  // sales filler this whole subsystem exists to prevent, so it is refused here
  // rather than being allowed to match and fail the evidence gate later — the
  // error a superadmin sees should name the real mistake.
  if (all.length === 0 && any.length === 0) {
    return { matched: false, evidenceIds: [], confidences: [], refusal: "no_conditions" };
  }

  const evidenceIds = [];
  const confidences = [];

  for (const c of all) {
    const r = evaluateCondition(c, index);
    if (r.problem) return { matched: false, evidenceIds: [], confidences: [], refusal: r.problem };
    if (!r.matched) {
      return { matched: false, evidenceIds: [], confidences: [], refusal: "conditions_not_met" };
    }
    evidenceIds.push(...r.evidenceIds);
    if (r.confidence != null) confidences.push(r.confidence);
  }

  if (any.length) {
    let one = false;
    for (const c of any) {
      const r = evaluateCondition(c, index);
      if (r.problem) return { matched: false, evidenceIds: [], confidences: [], refusal: r.problem };
      if (!r.matched) continue;
      one = true;
      evidenceIds.push(...r.evidenceIds);
      if (r.confidence != null) confidences.push(r.confidence);
    }
    if (!one) {
      return { matched: false, evidenceIds: [], confidences: [], refusal: "conditions_not_met" };
    }
  }

  return {
    matched: true,
    evidenceIds: [...new Set(evidenceIds)],
    confidences,
    refusal: null,
  };
}

/**
 * Fill a reason template, or refuse to.
 *
 * A placeholder with no value returns null and the rule is skipped. The
 * alternative — leaving `{competitor}` in the string, or quietly substituting
 * "their current software" — puts a sentence in a rep's mouth that no evidence
 * supports, which is the same failure as an uncited recommendation wearing
 * better clothes.
 */
export function renderReason(template, vars = {}) {
  if (typeof template !== "string" || !template.trim()) return null;
  let missing = false;
  const out = template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    if (value == null || value === "") {
      missing = true;
      return "";
    }
    return String(value);
  });
  return missing ? null : out;
}

/**
 * Is this rule well-formed against the matrix it recommends out of?
 *
 * Separate from evaluation so the seeder and the superadmin screen can reject a
 * bad rule at write time, rather than a rep discovering at the top of a call
 * that a rule has been silently matching nobody for a month.
 *
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateRule(rule, { matrix = capabilityMatrix() } = {}) {
  const problems = [];
  const cap = matrix.find((c) => c.code === rule?.capabilityCode);

  if (!cap) problems.push("unknown_capability");
  else if (cap.active !== true) problems.push("inactive_capability");

  const all = Array.isArray(rule?.conditions?.all) ? rule.conditions.all : [];
  const any = Array.isArray(rule?.conditions?.any) ? rule.conditions.any : [];
  if (all.length === 0 && any.length === 0) problems.push("no_conditions");

  for (const c of [...all, ...any]) {
    if (!CONDITION_KINDS.includes(c?.kind)) {
      problems.push("unknown_condition_kind");
      continue;
    }
    if (
      (c.kind === "capability" || c.kind === "capabilityUnknown") &&
      !OBSERVABLE_CAPABILITY_CODES.includes(c.code)
    ) {
      // A rule conditioning on a code no detector emits can never fire. That is
      // a dead control with the button missing — see AGENTS.md — and it is
      // exactly what a typo in a code produces.
      problems.push("unobservable_condition");
    }
    if (c.kind === "capability" && normaliseValue(c.is) === null) {
      problems.push("unknown_condition_kind");
    }
  }

  if (!renderReason(rule?.reasonTemplate, PROBE_VARS)) {
    // Probed with every variable this evaluator can ever supply. A template
    // naming anything else would have produced a hole at run time, on a call.
    problems.push("unresolved_reason");
  }

  // The displacement property, asserted at write time as well as at evaluation
  // time. A rule that conditions on a competitor being present may only
  // recommend a capability that survives one being installed.
  if (cap && conditionsRequireCompetitor(rule?.conditions) && cap.recommendedTalkingPoints?.tableStakes !== false) {
    problems.push("competitor_table_stakes");
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/** Every variable renderReason is ever handed, used to probe a template. */
const PROBE_VARS = Object.freeze({
  capabilityName: "x",
  competitor: "x",
  competitorCount: "1",
});

/** Does this rule only apply when a competitor is installed? */
function conditionsRequireCompetitor(conditions) {
  const all = Array.isArray(conditions?.all) ? conditions.all : [];
  return all.some((c) => c?.kind === "competitor" && c.present !== false);
}

/**
 * One rule against one prospect.
 *
 * The guards below run AFTER the rule's own conditions and are not expressible
 * in them, on purpose. "Never recommend something they already have" must hold
 * for a rule nobody thought about it while writing — putting it in the
 * condition vocabulary would make it something a rule author can forget.
 *
 * @returns {{ opportunity: object|null, refusal: string|null }}
 */
export function evaluateRule(rule, index, { matrix = capabilityMatrix() } = {}) {
  const refuse = (refusal) => ({ opportunity: null, refusal });

  if (rule?.active === false) return refuse("inactive_rule");

  const cap = matrix.find((c) => c.code === rule?.capabilityCode);
  if (!cap) return refuse("unknown_capability");
  if (cap.active !== true) return refuse("inactive_capability");

  const result = evaluateConditions(rule?.conditions, index);
  if (!result.matched) return refuse(result.refusal);

  // ── Guards, in the order a rep would notice them going wrong ────────────

  // They already have it. `=== true` and not `!== false`: unknown must not
  // block a recommendation any more than it may create one.
  if (holds(index, cap.code)) return refuse("already_has");

  // Something they have makes this pointless — a link-in-bio page for somebody
  // with a real website.
  if ((cap.incompatibilities || []).some((code) => holds(index, code))) {
    return refuse("incompatible");
  }

  // Half a thing. A deposit needs a booking page to be taken on.
  const requires = cap.requiredEvidence?.requires || [];
  if (requires.some((code) => !holds(index, code))) return refuse("missing_prerequisite");

  // A competitor's platform is installed. The pitch is a displacement and may
  // only be built out of things that platform would not be expected to carry.
  // Enforced here as well as in validateRule because a rule can be written
  // before a technology signature exists and become wrong later.
  if (index.competitors.length > 0 && cap.recommendedTalkingPoints?.tableStakes !== false) {
    return refuse("competitor_table_stakes");
  }

  // Nothing to cite. Structural, not advisory: the union of what the matching
  // conditions actually SAW.
  const minEvidence = Math.max(1, Number(cap.requiredEvidence?.minEvidence) || 1);
  if (result.evidenceIds.length < minEvidence) return refuse("no_evidence");

  const competitorNames = index.competitors.map((t) => t.technologyCode);
  const reason = renderReason(rule.reasonTemplate, {
    capabilityName: cap.name,
    competitor: competitorNames[0] || null,
    competitorCount: competitorNames.length || null,
  });
  if (!reason) return refuse("unresolved_reason");

  return {
    refusal: null,
    opportunity: {
      capabilityCode: cap.code,
      reason,
      evidenceIds: result.evidenceIds,
      confidence: opportunityConfidence(result.confidences),
      ruleCode: rule.code,
      ruleVersion: rule.version ?? null,
      rulePriority: Number(rule.priority) || 0,
      capabilitySalesPriority: cap.salesPriority,
    },
  };
}

/**
 * Every opportunity for one prospect, ranked, with everything that was refused.
 *
 * ── Why the refusals come back too ─────────────────────────────────────────
 *
 * A rep needs the list. A superadmin editing rules needs the reason a rule
 * never fires, and "it produced nothing" is not an answer they can act on. The
 * refusals are the same information the rep list is built from, and returning
 * them costs nothing.
 *
 * @returns {{
 *   opportunities: Array,
 *   sampleSize: number,
 *   incomplete: boolean,
 *   unchecked: string[],
 *   reason: string|null,
 *   reasonText: string|null,
 *   skipped: Array<{ruleCode:string|null, capabilityCode:string|null, refusal:string, refusalText:string}>,
 *   conflicts: Array,
 * }}
 */
export function buildOpportunities({
  capabilities = [],
  technologies = [],
  rules = [],
  matrix = capabilityMatrix(),
} = {}) {
  const index = indexProspect({ capabilities, technologies });
  const ruleList = Array.isArray(rules) ? rules : [];

  const skipped = [];
  const byCapability = new Map();

  // Deterministic input order. The database's ORDER BY is not something this
  // function should depend on: the same rows in a different order must produce
  // the same recommendations, or a re-run silently reshuffles a rep's script.
  const ordered = [...ruleList].sort(
    (a, b) =>
      (Number(b?.priority) || 0) - (Number(a?.priority) || 0) ||
      String(a?.code || "").localeCompare(String(b?.code || "")),
  );

  for (const rule of ordered) {
    const { opportunity, refusal } = evaluateRule(rule, index, { matrix });
    if (!opportunity) {
      skipped.push({
        ruleCode: rule?.code ?? null,
        capabilityCode: rule?.capabilityCode ?? null,
        refusal,
        refusalText: REFUSALS[refusal] || refusal,
      });
      continue;
    }

    // `@@unique([prospectId, capabilityCode])` — one row per capability, so two
    // rules wanting the same slot is a real conflict and not a merge. The
    // higher-priority rule wins whole: taking its reason and the OTHER rule's
    // evidence would produce a sentence citing something it never looked at.
    const prior = byCapability.get(opportunity.capabilityCode);
    if (prior) {
      skipped.push({
        ruleCode: rule.code ?? null,
        capabilityCode: opportunity.capabilityCode,
        refusal: "duplicate_capability",
        refusalText: REFUSALS.duplicate_capability,
      });
      continue;
    }
    byCapability.set(opportunity.capabilityCode, opportunity);
  }

  const opportunities = [...byCapability.values()]
    .sort(
      (a, b) =>
        b.capabilitySalesPriority - a.capabilitySalesPriority ||
        b.rulePriority - a.rulePriority ||
        (b.confidence.value ?? 0) - (a.confidence.value ?? 0) ||
        // Redundant today, and kept. The rules were already sorted
        // deterministically above, so insertion order into `byCapability` is
        // deterministic and a stable sort would produce the same answer —
        // mutation testing confirmed removing this changes nothing. What it
        // buys is not depending on sort stability, which is a language
        // guarantee somebody would have to go and check rather than read here.
        a.capabilityCode.localeCompare(b.capabilityCode),
    )
    .map((o, i) => ({ ...o, rank: i + 1 }));

  let reason = null;
  if (opportunities.length === 0) {
    if (ruleList.length === 0) reason = "no_rules";
    else if (index.sampleSize === 0) reason = "nothing_observed";
    else if (skipped.every((s) => s.refusal === "conditions_not_met")) reason = "nothing_matched";
    else reason = "all_refused";
  }

  return {
    opportunities,
    sampleSize: index.sampleSize,
    // Honest short-measure, the flag lib/analytics/kpis.js uses: the list is
    // real, and we know it is short because there are things we never looked
    // at. A rep reading a two-item list off a business whose site timed out
    // should see that, not a confident two.
    incomplete: index.unchecked.length > 0,
    unchecked: index.unchecked,
    reason,
    reasonText: reason ? ANALYSIS_REASONS[reason] || reason : null,
    skipped,
    conflicts: index.conflicts,
  };
}
