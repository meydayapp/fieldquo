// lib/sales/intel/configAdmin.js
//
// The shared half of the three superadmin config routes: who may write, and
// what a writable row looks like.
//
// ══ Why a shared file rather than three copies ════════════════════════════
//
// Five route files (rules, rules/[code], confidence/[signal], signatures,
// signatures/[code]) need the same superadmin gate and the same bounds on the
// same fields. Copy-pasted, the copy is the one that rots — AGENTS.md failure
// class 4 — and here the thing that rots is a permission check.
//
// ══ What is NOT here ══════════════════════════════════════════════════════
//
// Nothing decides whether a rule is VALID in this file. That is
// `validateRule` in lib/sales/intel/opportunity.js, which the evaluator uses
// too, and a second opinion living beside it is how a rule saves cleanly and
// never fires. What is here is coercion and bounds: is this a string, is it
// too long, does the JSON parse. Those are questions about a request, not
// about a rule.
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { REFUSALS } from "./opportunity";
import { CATEGORIES, SIGNALS } from "./confidence";

/** A rule code is stamped onto every result it produces, so it stays readable. */
export const CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

const MAX_NAME = 160;
const MAX_TEMPLATE = 1200;
const MAX_PATTERNS = 40;
const MAX_PATTERN_LENGTH = 200;

/**
 * Superadmin, or a refusal to return verbatim.
 *
 * The same bar as the capability matrix route, and the same reason: there is
 * no sales permission in PLATFORM_PERMISSIONS, and what these three tables
 * hold decides what every rep is allowed to say to a stranger. Not a support
 * task.
 */
export async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: {
          error: "Only superadmins can change the rules that decide what a rep says",
        },
      },
    };
  }
  return { admin, refusal: null };
}

/** The evaluator's own refusal sentences, so no screen invents a second set. */
export function say(codes) {
  return (codes || []).map((p) => ({ code: p, text: REFUSALS[p] || p }));
}

/**
 * JSON from a textarea, or an object already.
 *
 * The parse error is passed through verbatim rather than flattened to "invalid
 * JSON": somebody fixing a missing comma needs the position. A raw JSON editor
 * is only acceptable BECAUSE it refuses malformed input loudly and says where
 * — a textarea that swallows a typo and fails at evaluation time, on a call,
 * is the dead control AGENTS.md forbids.
 */
export function parseJson(raw, { what = "value", expect = "object" } = {}) {
  let parsed = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return { error: `The ${what} is required.` };
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { error: `The ${what} is not valid JSON — ${err.message}` };
    }
  }
  if (expect === "array") {
    if (!Array.isArray(parsed)) return { error: `The ${what} is a JSON list.` };
  } else if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: `The ${what} is a JSON object.` };
  }
  return { value: parsed };
}

/**
 * The writable half of an OpportunityRule, coerced and bounded.
 *
 * @param {object} body
 * @param {{ partial?: boolean }} options  partial: only the keys present are
 *        read, which is what PATCH needs — an absent field is "leave it", not
 *        "clear it".
 * @returns {{ value: object } | { error: string }}
 */
export function shapeRuleInput(body = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || "code" in body) {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return { error: "A rule needs a code." };
    if (!CODE_RE.test(code)) {
      return {
        error:
          "A rule code is upper-case letters, digits and underscores, 3–64 characters — it is " +
          "stamped onto every recommendation the rule produces, so it has to stay readable.",
      };
    }
    value.code = code;
  }

  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "A rule needs a name — it is what the list is scanned by." };
    if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };
    value.name = name;
  }

  if (!partial || "capabilityCode" in body) {
    const cap = typeof body.capabilityCode === "string" ? body.capabilityCode.trim() : "";
    if (!cap) return { error: "A rule has to name the capability it recommends." };
    value.capabilityCode = cap;
  }

  if (!partial || "reasonTemplate" in body) {
    const tpl = typeof body.reasonTemplate === "string" ? body.reasonTemplate.trim() : "";
    if (!tpl) return { error: "A rule needs the sentence a rep reads." };
    if (tpl.length > MAX_TEMPLATE) {
      return { error: `The reason is a short paragraph — ${MAX_TEMPLATE} characters at most.` };
    }
    value.reasonTemplate = tpl;
  }

  if (!partial || "priority" in body) {
    const n = Number(body.priority);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return { error: "Priority is a whole number from 0 to 1000. Higher wins a tie." };
    }
    value.priority = n;
  }

  if (!partial || "conditions" in body) {
    const parsed = parseJson(body.conditions, { what: "conditions" });
    if (parsed.error) {
      return {
        error:
          parsed.error +
          ' Conditions look like { "all": [{ "kind": "capability", "code": "WEBSITE", "is": false }] }.',
      };
    }
    value.conditions = parsed.value;
  }

  return { value };
}

/**
 * The writable half of a TechnologySignature.
 *
 * ── `patterns` is validated for SHAPE, and nothing more ───────────────────
 *
 * No detector exists yet — there is no crawler in this repo, which
 * docs/sales-intel/STATUS.md states plainly — so nothing reads these patterns
 * today. That makes it tempting to invent matching semantics here (a regex? a
 * glob?) and then have the detector, when it ships, disagree with the rules
 * this editor accepted. So the validation asserts exactly what the schema
 * comment already declares — a closed set of kinds, a non-empty pattern
 * string, a weight in 0..1 — and asserts nothing about how a pattern will be
 * matched. The screen says the same thing out loud.
 */
export const SIGNATURE_PATTERN_KINDS = Object.freeze([
  "script_src",
  "iframe_host",
  "html",
  "link",
  "meta",
]);

export function shapeSignatureInput(body = {}, { partial = false } = {}) {
  const value = {};

  if (!partial || "code" in body) {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return { error: "A signature needs a code." };
    if (!CODE_RE.test(code)) {
      return {
        error:
          "A signature code is upper-case letters, digits and underscores, 3–64 characters — " +
          "every detection is stored against it.",
      };
    }
    value.code = code;
  }

  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "A signature needs a name — a rep reads it, not the code." };
    if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };
    value.name = name;
  }

  if ("isCompetitor" in body) {
    if (typeof body.isCompetitor !== "boolean") {
      return { error: "isCompetitor must be true or false" };
    }
    value.isCompetitor = body.isCompetitor;
  } else if (!partial) {
    value.isCompetitor = false;
  }

  if (!partial || "patterns" in body) {
    const parsed = parseJson(body.patterns, { what: "patterns", expect: "array" });
    if (parsed.error) {
      return {
        error:
          parsed.error +
          ' Patterns look like [{ "kind": "script_src", "pattern": "jobber.com", "weight": 0.9 }].',
      };
    }
    const problems = signaturePatternProblems(parsed.value);
    if (problems.length) return { error: problems.join(" ") };
    value.patterns = parsed.value;
  }

  return { value };
}

/** Every way a patterns list can be wrong, said in full rather than one at a time. */
export function signaturePatternProblems(patterns) {
  const problems = [];
  if (!Array.isArray(patterns)) return ["Patterns are a JSON list."];
  if (patterns.length === 0) {
    // Not merely empty — a signature with no patterns can never match, which
    // is a fingerprint that detects nothing while appearing to be configured.
    problems.push("A signature with no patterns can never match anything.");
  }
  if (patterns.length > MAX_PATTERNS) {
    problems.push(`${MAX_PATTERNS} patterns is the most one signature may carry.`);
  }
  patterns.forEach((p, i) => {
    const at = `Pattern ${i + 1}:`;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      problems.push(`${at} each pattern is an object.`);
      return;
    }
    if (!SIGNATURE_PATTERN_KINDS.includes(p.kind)) {
      problems.push(`${at} kind must be one of ${SIGNATURE_PATTERN_KINDS.join(", ")}.`);
    }
    const pattern = typeof p.pattern === "string" ? p.pattern.trim() : "";
    if (!pattern) problems.push(`${at} pattern must be a non-empty string.`);
    else if (pattern.length > MAX_PATTERN_LENGTH) {
      problems.push(`${at} a pattern is at most ${MAX_PATTERN_LENGTH} characters.`);
    }
    if (p.weight != null) {
      const w = Number(p.weight);
      if (!Number.isFinite(w) || w <= 0 || w > 1) {
        problems.push(`${at} weight is a number above 0 and at most 1.`);
      }
    }
  });
  return problems;
}

/**
 * The writable half of a ConfidenceRule: a weight and a switch.
 *
 * `signal` and `category` are NOT writable and are refused rather than
 * ignored. confidence.js's header is explicit about why: weight is a dial,
 * category is a boundary, and a boundary somebody can move is not one — a
 * superadmin raising `identity.similar_name` to 1.0 must not be able to also
 * reclassify it as deterministic and promote guesses to verified identity.
 * The signal name itself is a code contract with the detectors; a row naming
 * something SIGNALS does not know is ignored by weightsFrom(), so renaming one
 * here would silently switch a signal off.
 */
export const CONFIDENCE_READ_ONLY_FIELDS = Object.freeze(["signal", "category", "version"]);

export function shapeConfidenceInput(body = {}) {
  const offered = CONFIDENCE_READ_ONLY_FIELDS.filter((f) => f in body);
  if (offered.length) {
    return {
      error:
        `${offered.join(", ")} cannot be changed here. A signal's name is a contract with the ` +
        "detector that emits it, and its category is a boundary rather than a dial — see the " +
        "note on the screen.",
    };
  }

  const value = {};

  if ("weight" in body) {
    const w = Number(body.weight);
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      return { error: "A weight is a number from 0 to 1." };
    }
    // Decimal(4,3) — three decimal places is what the column stores, so round
    // here rather than letting the database silently do it and the screen show
    // a number nobody typed.
    value.weight = Math.round(w * 1000) / 1000;
  }

  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") return { error: "enabled must be true or false" };
    value.enabled = body.enabled;
  }

  if (Object.keys(value).length === 0) return { error: "Nothing to change" };
  return { value };
}

/** Signal names the engine understands, with the category it fixes for each. */
export function knownSignals() {
  return Object.entries(SIGNALS).map(([signal, s]) => ({
    signal,
    category: s.category,
    defaultWeight: s.weight,
  }));
}

export { CATEGORIES };
