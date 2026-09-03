// lib/sales/playbook/admin.js
//
// Coercion and bounds for the three playbook console routes.
//
// ══ What is here and what is deliberately elsewhere ══════════════════════
//
// Nothing in this file decides whether a playbook, an objection or an
// experiment is VALID. That is `validatePlaybook`, `validateObjection` and
// `validateExperiment`, which the seeds and the evaluator use too. A second
// opinion living beside the first is how a row saves cleanly and then never
// fires — lib/sales/intel/configAdmin.js's header makes the same argument for
// the same reason, and the superadmin gate and the JSON parser are imported
// from it rather than retyped.
//
// What IS here: is this a string, is it too long, does the JSON parse, is the
// key shaped like a key. Questions about a REQUEST, not about a playbook.
import { CODE_RE, parseJson } from "@/lib/sales/intel/configAdmin";
import { nextVersion, sameValue } from "@/lib/sales/intel/versioning";
import { STAGE_KEYS } from "./stages";
import { MAX_PROMPT, MAX_PROMPTS, MAX_SAY } from "./defaults";
import { MAX_CUES, MAX_CUE_LENGTH, MAX_OBJECTION_LABEL, MAX_OBJECTION_RESPONSE } from "./objections";

/**
 * Turn a problem code into the sentence a screen shows.
 *
 * One per vocabulary, so no route or page invents a second wording for a
 * refusal somebody will quote back at us. Same shape as `say` in
 * lib/sales/intel/configAdmin.js.
 */
export function sayProblems(codes, vocabulary) {
  return (codes || []).map((p) => ({ code: p, text: vocabulary?.[p] || p }));
}

const MAX_NAME = 160;
const MAX_HYPOTHESIS = 600;
const MAX_VARIANTS = 4;

export { CODE_RE };

/**
 * Fields whose change alters what a row DECIDES, per model.
 *
 * The same shape as `SEMANTIC_FIELDS` in lib/sales/intel/versioning.js, and
 * deliberately declared here rather than added there: that file is owned by the
 * intel config screens and its three entries are argued in its own header.
 * `versionBumpFor` is not re-implemented — `nextVersion` and `sameValue` are
 * imported, and only the FIELD LIST is local, which is data about these models
 * rather than a second copy of the rule.
 *
 * `selectorKey` and `priority` are both in here for the playbook. The first
 * decides WHETHER it opens; the second decides which of two matching playbooks
 * wins, so a priority edit can silently swap the script a rep reads — the same
 * argument that puts `priority` in the opportunity rule's list.
 *
 * `cues` is in the objection's list because a cue decides which answer a rep
 * finds mid-call. `label` is not: it is what the list is scanned by, not what
 * is said.
 */
export const PLAYBOOK_SEMANTIC_FIELDS = Object.freeze({
  salesPlaybook: ["selectorKey", "priority", "stages"],
  salesObjection: ["response", "cues", "contextSelectorKey", "priority"],
  // An experiment's variants and which playbook it varies are what an
  // assignment means. Renaming it or writing a longer hypothesis is not.
  salesPlaybookExperiment: ["playbookKey", "variants"],
});

/** @see versionBumpFor in lib/sales/intel/versioning.js — same contract. */
export function playbookVersionBump(model, before, patch) {
  const fields = PLAYBOOK_SEMANTIC_FIELDS[model];
  if (!fields) throw new Error(`playbookVersionBump: unknown model ${model}`);
  const changed = fields.filter((f) => f in (patch || {}) && !sameValue(before?.[f], patch[f]));
  if (changed.length === 0) return { bump: false, changed: [], version: null };
  return { bump: true, changed, version: nextVersion(before?.version) };
}

/** A stage list from a form or a JSON textarea, coerced and bounded. */
function shapeStages(raw) {
  const parsed = parseJson(raw, { what: "stages", expect: "array" });
  if (parsed.error) return parsed;

  const stages = [];
  for (const s of parsed.value) {
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      return { error: "Each stage is a JSON object with stageKey, say and prompts." };
    }
    if (!STAGE_KEYS.includes(s.stageKey)) {
      return {
        error: `"${s.stageKey}" is not a stage. The nine are: ${STAGE_KEYS.join(", ")}.`,
      };
    }
    const say = typeof s.say === "string" ? s.say : "";
    if (say.length > MAX_SAY) {
      return { error: `The ${s.stageKey} script is over ${MAX_SAY} characters — nobody reads that aloud.` };
    }
    const prompts = Array.isArray(s.prompts) ? s.prompts : [];
    if (prompts.length > MAX_PROMPTS) {
      return { error: `Keep ${s.stageKey} to ${MAX_PROMPTS} prompts or fewer.` };
    }
    for (const p of prompts) {
      if (typeof p !== "string") return { error: "A prompt is a string." };
      if (p.length > MAX_PROMPT) return { error: `A prompt is a question, not a paragraph — keep it under ${MAX_PROMPT} characters.` };
    }
    stages.push({ stageKey: s.stageKey, say, prompts: prompts.map((p) => p.trim()).filter(Boolean) });
  }
  return { value: stages };
}

export function shapePlaybookInput(body = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || "key" in body) {
    const key = typeof body.key === "string" ? body.key.trim().toUpperCase() : "";
    if (!key) return { error: "A playbook needs a key." };
    if (!CODE_RE.test(key)) {
      return {
        error:
          "A playbook key is upper-case letters, digits and underscores, 3–64 characters — it is " +
          "stored on every assignment and every talking point, so it has to stay readable.",
      };
    }
    value.key = key;
  }

  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "A playbook needs a name — it is what the list is scanned by." };
    if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };
    value.name = name;
  }

  if (!partial || "selectorKey" in body) {
    const selectorKey = typeof body.selectorKey === "string" ? body.selectorKey.trim() : "";
    if (!selectorKey) return { error: "A playbook needs a selection rule." };
    value.selectorKey = selectorKey;
  }

  if (!partial || "priority" in body) {
    const priority = Number(body.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
      return { error: "Priority is a whole number from 0 to 1000." };
    }
    value.priority = priority;
  }

  if (!partial || "stages" in body) {
    const stages = shapeStages(body.stages);
    if (stages.error) return stages;
    value.stages = stages.value;
  }

  if ("active" in body) {
    if (typeof body.active !== "boolean") return { error: "Active is true or false." };
    value.active = body.active;
  }

  return { value };
}

export function shapeObjectionInput(body = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || "code" in body) {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return { error: "An objection needs a code." };
    if (!CODE_RE.test(code)) {
      return { error: "An objection code is upper-case letters, digits and underscores, 3–64 characters." };
    }
    value.code = code;
  }

  if (!partial || "label" in body) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return { error: "An objection needs a label — it is what a rep scans for mid-call." };
    if (label.length > MAX_OBJECTION_LABEL) {
      return { error: `Keep the label under ${MAX_OBJECTION_LABEL} characters.` };
    }
    value.label = label;
  }

  if (!partial || "response" in body) {
    const response = typeof body.response === "string" ? body.response.trim() : "";
    if (!response) return { error: "An objection with no response is a row that answers nothing." };
    if (response.length > MAX_OBJECTION_RESPONSE) {
      return { error: `Keep the response under ${MAX_OBJECTION_RESPONSE} characters — it is read while somebody waits.` };
    }
    value.response = response;
  }

  if (!partial || "cues" in body) {
    const raw = Array.isArray(body.cues)
      ? body.cues
      : typeof body.cues === "string"
        ? body.cues.split("\n")
        : [];
    const cues = raw.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean);
    if (cues.length > MAX_CUES) return { error: `Keep it to ${MAX_CUES} cues — a list nobody can scan is a list nobody uses.` };
    if (cues.some((c) => c.length > MAX_CUE_LENGTH)) {
      return { error: `A cue is the words a prospect says, under ${MAX_CUE_LENGTH} characters.` };
    }
    value.cues = cues;
  }

  if (!partial || "contextSelectorKey" in body) {
    const key = typeof body.contextSelectorKey === "string" ? body.contextSelectorKey.trim() : "";
    value.contextSelectorKey = key || null;
  }

  if (!partial || "priority" in body) {
    const priority = Number(body.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
      return { error: "Priority is a whole number from 0 to 1000." };
    }
    value.priority = priority;
  }

  if ("active" in body) {
    if (typeof body.active !== "boolean") return { error: "Active is true or false." };
    value.active = body.active;
  }

  return { value };
}

/**
 * An experiment.
 *
 * `variants` carries weights, and a weight is the only number a superadmin
 * sets here. There is no field for a winner and there must not be one — §39,
 * and the schema note in schema.pending.prisma says the same.
 */
export function shapeExperimentInput(body = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || "key" in body) {
    const key = typeof body.key === "string" ? body.key.trim().toUpperCase() : "";
    if (!key) return { error: "An experiment needs a key." };
    if (!CODE_RE.test(key)) {
      return { error: "An experiment key is upper-case letters, digits and underscores, 3–64 characters." };
    }
    value.key = key;
  }

  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "An experiment needs a name." };
    if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };
    value.name = name;
  }

  if (!partial || "hypothesis" in body) {
    const hypothesis = typeof body.hypothesis === "string" ? body.hypothesis.trim() : "";
    if (!hypothesis) {
      return {
        error:
          "Write the hypothesis down before the test runs. Without one, whatever the numbers do " +
          "afterwards will look like it was predicted.",
      };
    }
    if (hypothesis.length > MAX_HYPOTHESIS) {
      return { error: `Keep the hypothesis under ${MAX_HYPOTHESIS} characters.` };
    }
    value.hypothesis = hypothesis;
  }

  if (!partial || "playbookKey" in body) {
    const playbookKey = typeof body.playbookKey === "string" ? body.playbookKey.trim().toUpperCase() : "";
    if (!playbookKey) return { error: "An experiment varies one playbook. Name which." };
    value.playbookKey = playbookKey;
  }

  if (!partial || "variants" in body) {
    const parsed = parseJson(body.variants, { what: "variants", expect: "array" });
    if (parsed.error) return parsed;
    if (parsed.value.length > MAX_VARIANTS) {
      return { error: `At most ${MAX_VARIANTS} variants — more arms than a small team can ever fill.` };
    }
    const variants = [];
    for (const v of parsed.value) {
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        return { error: "Each variant is a JSON object with key, label, weight and stages." };
      }
      const key = typeof v.key === "string" ? v.key.trim() : "";
      if (!key) return { error: "Every variant needs a key — it is what is stored on the assignment." };
      const weight = Number(v.weight);
      if (!Number.isInteger(weight) || weight < 0) {
        return { error: "A weight is a whole number, zero or above." };
      }
      const stages = shapeStages(Array.isArray(v.stages) ? v.stages : []);
      if (stages.error) return stages;
      variants.push({
        key,
        label: typeof v.label === "string" ? v.label.trim() : key,
        weight,
        stages: stages.value,
      });
    }
    value.variants = variants;
  }

  if ("active" in body) {
    if (typeof body.active !== "boolean") return { error: "Active is true or false." };
    value.active = body.active;
  }

  return { value };
}
