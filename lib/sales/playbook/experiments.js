// lib/sales/playbook/experiments.js
//
// A/B playbook variants: the assignment seam, and nothing more.
//
// ══ What is built here, and what is deliberately NOT ══════════════════════
//
// §38 wants variants with the assignment stored BEFORE the call and reps
// unable to choose their own. That is what this file does.
//
// §39 forbids declaring a winner without the sample to support it, and the
// honest reading of that with a team this size is not "build significance
// testing and let it say 'not enough data' for months" — it is to not build
// the verdict at all. `summariseExperiment` returns counts and the sentence
// "no winner is declared here", permanently. A number that reads like a
// verdict is the thing to avoid; a p-value on eleven calls IS that number
// wearing a lab coat. Nothing in this file computes one, and the check asserts
// nothing does.
//
// ══ Why a rep cannot choose ═══════════════════════════════════════════════
//
// Not because reps cheat. Because a rep who picks the variant they like turns
// the experiment into a survey of rep preference, and the result then looks
// like evidence about the SCRIPT. There is no parameter anywhere in this file
// that takes a requested variant, and `shapeAssignmentRequest` refuses a
// request body that names one at all rather than ignoring it — an ignored
// field is a control that appears to work, which is the rule that matters
// most.
//
// ══ Deterministic assignment, and the stored row still wins ═══════════════
//
// The bucket is a hash of (experiment key, prospect id), so the same prospect
// lands in the same arm however many times the pipeline retries, and no random
// seed has to be persisted for the assignment to be reproducible.
//
// The STORED row still outranks a re-derivation, and that is the whole reason
// §38 says "stored before the call": editing the weights would otherwise move
// prospects between arms retroactively, and every call already made would be
// filed under the wrong script. A stored assignment is a fact about what a rep
// actually read out. It is never recomputed.

/** Why an assignment was refused. Rendered verbatim; never paraphrased. */
export const ASSIGNMENT_REFUSALS = Object.freeze({
  rep_chose_variant:
    "A variant cannot be requested. Assignment is made by the system and stored before the call — a rep choosing their own arm would make the experiment a measurement of rep preference rather than of the script.",
  no_active_experiment: "No experiment is running for this playbook.",
  no_variants: "The experiment has no variants to assign between.",
  weights_all_zero:
    "Every variant has a weight of zero, so there is nothing to assign between.",
  no_prospect: "An assignment needs a prospect. There is nothing to key it to.",
});

/** Why an experiment row cannot be written. */
export const EXPERIMENT_PROBLEMS = Object.freeze({
  no_key: "An experiment needs a key.",
  no_name: "An experiment needs a name.",
  no_hypothesis:
    "An experiment needs a hypothesis written down before it runs. Without one, whatever the numbers do afterwards will look like it was predicted.",
  no_playbook: "An experiment varies one playbook. It needs to name which.",
  too_few_variants: "An experiment needs at least two variants. One variant is just the playbook.",
  duplicate_variant_key: "Two variants share a key, so an assignment would be ambiguous.",
  no_variant_key: "Every variant needs a key — it is what is stored on the assignment.",
  negative_weight: "A weight cannot be negative.",
  weights_all_zero: "Every weight is zero, so nothing could ever be assigned.",
  unknown_stage: "A variant overrides a stage that does not exist.",
});

/** Field names that would let a caller pick an arm. Refused, never ignored. */
export const CHOSEN_VARIANT_KEYS = Object.freeze([
  "variantKey",
  "variant",
  "variantId",
  "arm",
  "bucket",
  "forceVariant",
]);

/** Permanent, and it is a policy rather than a placeholder. See the header. */
export const WINNER_POLICY =
  "No winner is declared here. Counts only — deciding which script wins needs a sample this team will not have for months, and a verdict called early is worse than no verdict.";

/**
 * FNV-1a, 32-bit. Pure and dependency-free on purpose.
 *
 * Not `crypto.createHash`: this has to be callable from anywhere, including a
 * check script and a component, and the property needed is an even spread over
 * a small number of buckets — not collision resistance. Nothing security-
 * bearing depends on it.
 */
export function hash32(input) {
  let h = 0x811c9dc5;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Variants, coerced and bounded. Order is the order a superadmin wrote them. */
function variantsOf(experiment) {
  return (Array.isArray(experiment?.variants) ? experiment.variants : [])
    .map((v) => ({
      key: typeof v?.key === "string" ? v.key.trim() : "",
      label: typeof v?.label === "string" ? v.label.trim() : "",
      weight: Number.isFinite(Number(v?.weight)) ? Number(v.weight) : 0,
      stages: Array.isArray(v?.stages) ? v.stages : [],
    }))
    .filter((v) => v.key);
}

export function validateExperiment(experiment, { stageKeys = [] } = {}) {
  const problems = [];
  if (!experiment?.key) problems.push("no_key");
  if (!experiment?.name || !String(experiment.name).trim()) problems.push("no_name");
  if (!experiment?.hypothesis || !String(experiment.hypothesis).trim()) {
    problems.push("no_hypothesis");
  }
  if (!experiment?.playbookKey) problems.push("no_playbook");

  const variants = variantsOf(experiment);
  const raw = Array.isArray(experiment?.variants) ? experiment.variants : [];
  if (raw.length !== variants.length) problems.push("no_variant_key");
  if (variants.length < 2) problems.push("too_few_variants");

  const seen = new Set();
  for (const v of variants) {
    if (seen.has(v.key)) problems.push("duplicate_variant_key");
    seen.add(v.key);
    if (v.weight < 0) problems.push("negative_weight");
    for (const s of v.stages) {
      if (stageKeys.length && !stageKeys.includes(s?.stageKey)) problems.push("unknown_stage");
    }
  }

  if (variants.length && variants.every((v) => v.weight === 0)) problems.push("weights_all_zero");

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/**
 * Which arm this prospect belongs in, derived.
 *
 * Pure. Used to CREATE an assignment; never to read one back — see the header.
 *
 * @returns {{ variantKey: string|null, bucket: number|null, refusal: string|null }}
 */
export function deriveVariant(experiment, prospectId) {
  if (!prospectId) return { variantKey: null, bucket: null, refusal: "no_prospect" };

  const variants = variantsOf(experiment);
  if (variants.length === 0) return { variantKey: null, bucket: null, refusal: "no_variants" };

  const total = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (total <= 0) return { variantKey: null, bucket: null, refusal: "weights_all_zero" };

  // Keyed on the experiment as well as the prospect, so a second experiment
  // does not put the same prospects in the same relative arms as the first —
  // which would quietly correlate two results that are supposed to be
  // independent.
  const bucket = hash32(`${experiment?.key || experiment?.id || ""}:${prospectId}`) % total;

  let running = 0;
  for (const v of variants) {
    running += Math.max(0, v.weight);
    if (bucket < running) return { variantKey: v.key, bucket, refusal: null };
  }
  // Unreachable while total is the sum of the same weights. Kept as a refusal
  // rather than a throw: a pipeline stage must not die over an arithmetic
  // edge, and a null assignment renders the base playbook.
  return { variantKey: null, bucket, refusal: "no_variants" };
}

/**
 * The request body a rep's client is allowed to send: a prospect, and nothing
 * that could steer the arm.
 *
 * @returns {{ value: object }|{ error: string, refusal: string, keys?: string[] }}
 */
export function shapeAssignmentRequest(body = {}) {
  const source = body && typeof body === "object" ? body : {};
  const named = CHOSEN_VARIANT_KEYS.filter((k) => Object.hasOwn(source, k));
  if (named.length > 0) {
    // Refused, not stripped. Stripping would accept the request, ignore the
    // field, and leave whoever sent it believing it worked.
    return {
      error: ASSIGNMENT_REFUSALS.rep_chose_variant,
      refusal: "rep_chose_variant",
      keys: named,
    };
  }

  const prospectId = typeof source.prospectId === "string" ? source.prospectId.trim() : "";
  if (!prospectId) {
    return { error: ASSIGNMENT_REFUSALS.no_prospect, refusal: "no_prospect" };
  }

  return { value: { prospectId } };
}

/**
 * Apply a variant's stage overrides on top of a playbook's stages.
 *
 * An override REPLACES one stage. It cannot add a stage the playbook does not
 * have and it cannot remove one — see stages.js: the nine are fixed, and two
 * variants that do not cover the same nine stages are not comparable, which is
 * the one thing an experiment needs them to be.
 */
export function applyVariant(stages, variant) {
  const base = Array.isArray(stages) ? stages : [];
  const overrides = new Map(
    (Array.isArray(variant?.stages) ? variant.stages : [])
      .filter((s) => typeof s?.stageKey === "string")
      .map((s) => [s.stageKey, s]),
  );
  if (overrides.size === 0) return base;

  return base.map((s) => {
    const o = overrides.get(s.stageKey);
    if (!o) return s;
    return { ...s, ...o, stageKey: s.stageKey, variantOverride: variant?.key ?? null };
  });
}

/**
 * Counts per arm. No rate, no lift, no verdict.
 *
 * `outcomes` is whatever the caller has — today, assignment rows. The shape is
 * deliberately thin: the moment this returns a conversion RATE somebody will
 * compare two of them, and comparing two rates on a handful of calls is the
 * thing §39 exists to stop.
 */
export function summariseExperiment(experiment, assignments = []) {
  const variants = variantsOf(experiment);
  const counts = new Map(variants.map((v) => [v.key, 0]));
  let unknownArm = 0;

  for (const a of Array.isArray(assignments) ? assignments : []) {
    const key = a?.variantKey;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    else unknownArm += 1;
  }

  return {
    variants: variants.map((v) => ({
      key: v.key,
      label: v.label || v.key,
      weight: v.weight,
      assigned: counts.get(v.key) || 0,
    })),
    total: (Array.isArray(assignments) ? assignments : []).length,
    // Assignments whose arm no longer exists, because somebody edited the
    // variants after the calls happened. Surfaced rather than folded into a
    // total that would then silently disagree with the sum of its parts.
    orphanedAssignments: unknownArm,
    winner: null,
    winnerPolicy: WINNER_POLICY,
  };
}
