// lib/sales/playbook/script.js
//
// The nine stages, filled in, in the order the rep says them.
//
// ══ A line with a hole in it is not rendered ══════════════════════════════
//
// `renderLine` returns null and names the variable when it cannot resolve one,
// and the screen prints "this line names {city} and we have no town for this
// business" instead of "Hi — is that , then?". That is the same decision
// `renderReason` makes in lib/sales/intel/opportunity.js, and it is the
// difference between a rep noticing a gap on the screen and a rep discovering
// it out loud.
//
// It cannot normally happen: `validatePlaybook` refuses an unknown variable at
// write time and refuses `{competitor}` in a playbook that can open without
// one. What is left is the resolvable-but-absent case — `{city}` on a prospect
// whose town the directory did not record — which no write-time check can
// catch, because it is a fact about the prospect rather than about the
// playbook.
//
// ══ Composition order ═════════════════════════════════════════════════════
//
//   playbook stages → variant overrides → interpolation → talking points and
//   objections attached to the two stages that carry them
//
// The variant is applied BEFORE interpolation so a variant's line gets the
// same treatment as a base line; applying it after would let an experiment
// smuggle in an unvalidated template.
import { OBJECTION_STAGE, orderStages, stage } from "./stages";
import { applyVariant } from "./experiments";

/** Why a line was not rendered. */
export const LINE_REFUSALS = Object.freeze({
  unresolved:
    "This line names something we have no value for on this prospect, so it would be read out with a hole in it.",
});

/**
 * Everything a playbook line may interpolate, for one prospect.
 *
 * A value is null when we do not have it. Never "" and never a placeholder:
 * an empty string interpolates silently and that is the failure this whole
 * file exists to prevent.
 */
export function playbookVars({ prospect = {}, index = {}, rep = null } = {}) {
  const competitors = Array.isArray(index?.competitors) ? index.competitors : [];
  return {
    businessName: prospect?.businessName || null,
    city: prospect?.city || null,
    tradeName: prospect?.tradeName || prospect?.tradeKey || null,
    competitor: competitors[0]?.technologyCode || null,
    repName: rep?.name || rep?.firstName || null,
  };
}

/** @returns {{ text: string|null, missing: string[] }} */
export function renderLine(template, vars = {}) {
  if (typeof template !== "string" || !template.trim()) return { text: "", missing: [] };
  const missing = [];
  const text = template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    if (value == null || value === "") {
      missing.push(key);
      return "";
    }
    return String(value);
  });
  return missing.length ? { text: null, missing: [...new Set(missing)] } : { text, missing: [] };
}

/**
 * One script.
 *
 * @param {object} args
 * @param {object} args.playbook   the selected row, with `stages`
 * @param {object|null} args.variant  the assigned variant, if an experiment is running
 * @param {Array} args.points      already through the evidence gate
 * @param {Array} args.objections  already filtered for this prospect
 * @returns {{ stages: Array, missingStages: string[], unresolvedLines: number }}
 */
export function buildCallScript({
  playbook = null,
  variant = null,
  prospect = {},
  index = {},
  rep = null,
  points = [],
  objections = [],
} = {}) {
  const vars = playbookVars({ prospect, index, rep });
  const withVariant = applyVariant(playbook?.stages || [], variant);
  const { ordered, missing, unknown, duplicates } = orderStages(withVariant);

  const pointsByStage = new Map();
  for (const p of Array.isArray(points) ? points : []) {
    if (!pointsByStage.has(p.stageKey)) pointsByStage.set(p.stageKey, []);
    pointsByStage.get(p.stageKey).push(p);
  }

  let unresolvedLines = 0;

  const stages = ordered.map((row) => {
    const meta = stage(row.stageKey);
    const say = renderLine(row.say, vars);
    if (say.text === null) unresolvedLines += 1;

    const prompts = (Array.isArray(row.prompts) ? row.prompts : []).map((p) => {
      const rendered = renderLine(p, vars);
      if (rendered.text === null) unresolvedLines += 1;
      return {
        template: p,
        text: rendered.text,
        missing: rendered.missing,
        refusal: rendered.text === null ? "unresolved" : null,
      };
    });

    return {
      stageKey: row.stageKey,
      name: meta?.name || row.stageKey,
      purpose: meta?.purpose || null,
      variantOverride: row.variantOverride ?? null,
      say: {
        template: row.say ?? "",
        text: say.text,
        missing: say.missing,
        refusal: say.text === null ? "unresolved" : null,
        refusalText: say.text === null ? LINE_REFUSALS.unresolved : null,
      },
      prompts,
      // Attached rather than merged into `say`: a rep needs to see which
      // sentence is about THIS business and which is the same on every call,
      // because only one of them has evidence behind it to defend.
      points: pointsByStage.get(row.stageKey) || [],
      objections: row.stageKey === OBJECTION_STAGE ? objections : [],
    };
  });

  return {
    stages,
    // Not padded. A playbook missing its `pain` stage renders eight stages and
    // says which one is absent — AGENTS.md failure class 5.
    missingStages: missing,
    unknownStages: unknown,
    duplicateStages: duplicates,
    unresolvedLines,
  };
}
