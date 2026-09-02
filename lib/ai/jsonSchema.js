// lib/ai/jsonSchema.js
//
// Plain JSON Schema, two ways: linted BEFORE it is sent to a vendor, and
// checked again AFTER the reply comes back.
//
// ══ Why this exists at all ═════════════════════════════════════════════════
//
// Until now every structured answer in this product was PROMPTED JSON: a
// system prompt saying "Return STRICT JSON, no markdown fence, matching {...}",
// then stripJsonFence(), then JSON.parse() in a try, then per-field
// hand-coercion. That works, but the guarantee is a sentence in English inside
// a prompt, and the enforcement is however carefully whoever wrote the caller
// happened to coerce. Ten callers, ten slightly different amounts of care —
// and four of them had re-typed provider.js's fence regex by hand rather than
// importing it, which is exactly failure class #4 in AGENTS.md.
//
// OpenAI's structured outputs move that guarantee to the vendor: with
// `response_format: { type: "json_schema", json_schema: { strict: true, … } }`
// the malformed reply is never GENERATED, rather than generated and then
// rejected here after the tokens are already paid for.
//
// ══ Why we still validate locally ══════════════════════════════════════════
//
// Because `strict: true` is a promise made by one vendor. provider.js exists
// precisely so the vendor can change (its own header says so). A local check
// that the parsed object matches the schema costs microseconds and means a
// provider swap, a proxy in front of the API, or a vendor regression cannot
// silently downgrade a hard guarantee into a hopeful one. It is also the only
// thing standing behind the schema on any provider that expresses this
// differently, or not at all.
//
// No dependency. zod would do this, but adopting zod for one feature means 167
// API routes with two validation conventions — see docs/construction/
// AUDIT-port-candidates.md, "The zod question". This file is ~200 lines and
// covers exactly the JSON Schema subset the vendor itself supports; there is
// nothing to gain from a general-purpose validator when the schemas that can
// be sent are already narrower than one.
//
// ══ The subset, and where it comes from ════════════════════════════════════
//
// Documented at developers.openai.com/api/docs/guides/structured-outputs and
// mirrored, with the limits spelled out as a table, at
// learn.microsoft.com/azure/foundry/openai/how-to/structured-outputs
// (checked 2026-09-02). The rules that bite:
//
//   - The root must be an object. Not an array, not anyOf.
//   - EVERY object must carry `additionalProperties: false`.
//   - EVERY declared property must appear in `required`. There is no optional
//     field; optionality is expressed as a nullable type, `["string", "null"]`,
//     or anyOf with a `{"type":"null"}` branch.
//   - Up to 100 object properties in total, up to 5 levels of nesting.
//   - The combined length of property names, $defs keys, enum and const values
//     is capped (15,000 characters).
//   - Type-specific keywords are NOT supported and NOT enforced:
//       string  minLength maxLength pattern format
//       number  minimum maximum multipleOf
//       object  patternProperties unevaluatedProperties propertyNames
//               minProperties maxProperties
//       array   unevaluatedItems contains minContains maxContains
//               minItems maxItems uniqueItems
//     $defs, $ref and recursion ARE supported; allOf is not.
//
// That last table is the single most important thing on this page, and it is
// why migrating a caller to a schema does NOT mean deleting its hand-coercion.
// A schema cannot say "at most 3 notes", "at most 220 characters", "trimmed",
// "non-empty", or "not shaped like an instruction". Every one of those limits
// in lib/ai/callTranscriptDigest.js survives the migration because the schema
// is structurally incapable of carrying it. The schema replaces the SHAPE
// check. It does not replace the JUDGEMENT.
//
// ══ And the boundary that matters most ═════════════════════════════════════
//
// A schema must never make the model the arithmetic. Structured output makes
// it EASIER to take a number out of a model — declare `{"total": {"type":
// "number"}}` and one arrives, well-formed, every time, looking exactly as
// trustworthy as a number computed in code. It is not. `assembleInsights` in
// callTranscriptDigest.js reads no number out of the model's JSON on purpose;
// every count there is `.length` of an array. Adding a number-typed field to a
// schema is the cheapest way to quietly undo that, so it is worth saying out
// loud: a numeric field in a schema is a claim that a model's guess is good
// enough to show a contractor as a fact. Almost always it is not, and the
// number should be computed from the model's WORDS in code instead.

/** Every keyword the strict subset refuses, and the type it belongs to. */
const UNSUPPORTED_KEYWORDS = {
  string: ["minLength", "maxLength", "pattern", "format"],
  number: ["minimum", "maximum", "multipleOf", "exclusiveMinimum", "exclusiveMaximum"],
  integer: ["minimum", "maximum", "multipleOf", "exclusiveMinimum", "exclusiveMaximum"],
  object: [
    "patternProperties",
    "unevaluatedProperties",
    "propertyNames",
    "minProperties",
    "maxProperties",
  ],
  array: [
    "unevaluatedItems",
    "contains",
    "minContains",
    "maxContains",
    "minItems",
    "maxItems",
    "uniqueItems",
  ],
};

/** Composition keywords the subset refuses outright, whatever the type. */
const UNSUPPORTED_COMPOSITION = ["allOf", "oneOf", "not", "if", "then", "else", "dependentSchemas"];

export const MAX_PROPERTIES = 100;
export const MAX_NESTING_DEPTH = 5;
export const MAX_NAME_BUDGET = 15000;

const PRIMITIVES = new Set(["string", "number", "integer", "boolean", "null", "object", "array"]);

/** The declared type(s) of a node, always as an array. */
function typesOf(node) {
  const t = node?.type;
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t;
  return [];
}

/**
 * Resolve a `$ref` against the root. Only the two forms the vendor documents:
 * `#` (the root itself, for recursion) and `#/$defs/<name>`.
 *
 * Returns null for anything else rather than guessing — a $ref we cannot
 * resolve is a schema we cannot honestly claim to have checked, and silently
 * treating it as "anything goes" is how a local validator becomes decorative.
 */
function resolveRef(ref, root) {
  if (ref === "#") return root;
  const m = /^#\/\$defs\/([^/]+)$/.exec(String(ref || ""));
  if (!m) return null;
  return root?.$defs?.[m[1]] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The pre-flight lint — is this a schema the vendor would accept?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks a schema against the strict-mode subset BEFORE any request is made.
 *
 * This is the cheap half of the cost story. A schema the vendor refuses costs
 * a full round trip and comes back as a 400 whose message names one problem at
 * a time; catching it here costs nothing, names all of them at once, and
 * happens on the developer's machine rather than in production on a
 * contractor's quote. It is deliberately STRICTER than "will this parse" —
 * a rule the vendor merely ignores (an unsupported `maxLength`) is still
 * rejected here, because a limit that silently does not apply is exactly the
 * dead-control failure AGENTS.md is about.
 *
 * PURE. Returns { ok, errors } — never throws, so a check script can execute
 * it against hostile input without wrapping every call.
 */
export function assertStrictSchema(schema) {
  const errors = [];
  let propertyCount = 0;
  let nameBudget = 0;

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { ok: false, errors: ["schema must be an object"] };
  }
  if (schema.type !== "object") {
    errors.push("root: the root of a strict schema must be `type: \"object\"`");
  }

  // `seen` is keyed on the node object, not on a path: a recursive schema
  // ($ref: "#") would otherwise walk forever. Checking each distinct node once
  // is sufficient — the rules are all local to a node.
  const seen = new Set();

  const walk = (node, path, depth) => {
    if (!node || typeof node !== "object") {
      errors.push(`${path}: expected a schema object`);
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    if (depth > MAX_NESTING_DEPTH) {
      errors.push(`${path}: nesting deeper than ${MAX_NESTING_DEPTH} levels`);
      return;
    }

    for (const kw of UNSUPPORTED_COMPOSITION) {
      if (Object.hasOwn(node, kw)) {
        errors.push(`${path}: \`${kw}\` is not supported by strict structured outputs`);
      }
    }

    if (Object.hasOwn(node, "$ref")) {
      const target = resolveRef(node.$ref, schema);
      if (!target) {
        errors.push(`${path}: unresolvable $ref \`${node.$ref}\` (only \`#\` and \`#/$defs/<name>\`)`);
        return;
      }
      // A $ref does not add a level of its own; the node it points at does.
      walk(target, `${path}->${node.$ref}`, depth);
      return;
    }

    if (Array.isArray(node.anyOf)) {
      if (!node.anyOf.length) errors.push(`${path}: empty anyOf`);
      node.anyOf.forEach((branch, i) => walk(branch, `${path}.anyOf[${i}]`, depth));
      return;
    }

    const types = typesOf(node);
    if (!types.length) {
      errors.push(`${path}: no \`type\` and no \`anyOf\` — a node must say what it is`);
      return;
    }
    for (const t of types) {
      if (!PRIMITIVES.has(t)) errors.push(`${path}: unknown type \`${t}\``);
      for (const kw of UNSUPPORTED_KEYWORDS[t] || []) {
        if (Object.hasOwn(node, kw)) {
          errors.push(
            `${path}: \`${kw}\` is not supported on a ${t} — strict mode ignores it, so the limit would not apply`,
          );
        }
      }
    }

    if (Array.isArray(node.enum)) {
      for (const v of node.enum) nameBudget += String(v).length;
    }
    if (Object.hasOwn(node, "const")) nameBudget += String(node.const).length;

    if (types.includes("object")) {
      if (node.additionalProperties !== false) {
        errors.push(`${path}: every object must set \`additionalProperties: false\``);
      }
      const props = node.properties;
      if (!props || typeof props !== "object") {
        errors.push(`${path}: an object needs \`properties\``);
      } else {
        const keys = Object.keys(props);
        propertyCount += keys.length;
        for (const k of keys) nameBudget += k.length;

        const required = Array.isArray(node.required) ? node.required : [];
        const missing = keys.filter((k) => !required.includes(k));
        if (missing.length) {
          errors.push(
            `${path}: every property must be listed in \`required\` — missing ${missing.join(", ")}. ` +
              `Express an optional field as a nullable type instead.`,
          );
        }
        const unknown = required.filter((k) => !keys.includes(k));
        if (unknown.length) {
          errors.push(`${path}: \`required\` names properties that do not exist: ${unknown.join(", ")}`);
        }
        for (const k of keys) walk(props[k], `${path}.${k}`, depth + 1);
      }
    }

    if (types.includes("array")) {
      if (!node.items) errors.push(`${path}: an array needs \`items\``);
      else walk(node.items, `${path}[]`, depth + 1);
    }
  };

  walk(schema, "root", 1);

  // $defs are walked even when nothing references them: an unused def that
  // breaks the subset is still a schema the vendor may reject, and a lint that
  // only sees the reachable half gives a green tick to a request that 400s.
  if (schema.$defs && typeof schema.$defs === "object") {
    for (const [name, def] of Object.entries(schema.$defs)) {
      nameBudget += name.length;
      walk(def, `$defs.${name}`, 1);
    }
  }

  if (propertyCount > MAX_PROPERTIES) {
    errors.push(`schema declares ${propertyCount} properties; the limit is ${MAX_PROPERTIES}`);
  }
  if (nameBudget > MAX_NAME_BUDGET) {
    errors.push(`property names, enum and const values total ${nameBudget} characters; the limit is ${MAX_NAME_BUDGET}`);
  }

  return { ok: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. The post-flight check — does the reply actually match?
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates a parsed value against the same subset.
 *
 * PURE. Returns { ok, errors } with a path on every error, because "the model
 * returned the wrong shape" is not an actionable log line and
 * "calls[2].callIndex: expected integer, got string" is.
 *
 * Deliberately as strict as the schema claims to be: an extra property is an
 * ERROR, not something to ignore, because `additionalProperties: false` was
 * sent to the vendor and a reply carrying an undeclared field means the
 * guarantee did not hold — which is the entire event this function exists to
 * make visible.
 */
export function validateAgainstSchema(value, schema) {
  const errors = [];

  // `errors` is passed rather than closed over so an anyOf branch can be tried
  // against a THROWAWAY list — a branch that fails is not an error, it is a
  // branch that did not match, and only "none of them matched" is worth
  // reporting. Recursing into validateAgainstSchema() for that would reroot
  // the schema and break `$ref: "#"` inside a branch.
  const check = (val, node, path, depth, errors) => {
    if (errors.length >= 20) return; // enough to diagnose; not a wall of text
    if (!node || typeof node !== "object") {
      errors.push(`${path}: schema node is not an object`);
      return;
    }
    if (depth > 64) {
      // Only reachable through a recursive $ref against a deeply nested value.
      errors.push(`${path}: value nested deeper than the validator will follow`);
      return;
    }

    if (Object.hasOwn(node, "$ref")) {
      const target = resolveRef(node.$ref, schema);
      if (!target) {
        errors.push(`${path}: unresolvable $ref \`${node.$ref}\``);
        return;
      }
      check(val, target, path, depth + 1, errors);
      return;
    }

    if (Array.isArray(node.anyOf)) {
      const matched = node.anyOf.some((branch) => {
        const trial = [];
        check(val, branch, path, depth + 1, trial);
        return trial.length === 0;
      });
      if (!matched) errors.push(`${path}: matched none of the ${node.anyOf.length} anyOf branches`);
      return;
    }

    const types = typesOf(node);
    if (!types.some((t) => matchesType(val, t))) {
      errors.push(`${path}: expected ${types.join(" or ") || "a type"}, got ${describe(val)}`);
      return;
    }

    if (Array.isArray(node.enum) && !node.enum.includes(val)) {
      errors.push(`${path}: ${JSON.stringify(val)} is not one of ${JSON.stringify(node.enum)}`);
      return;
    }

    // A null that the type union permits is fully checked — there is nothing
    // below it. Without this, a nullable object would fall into the object
    // branch and report every declared property as missing.
    if (val === null) return;

    if (types.includes("object") && matchesType(val, "object")) {
      const props = node.properties || {};
      const required = Array.isArray(node.required) ? node.required : [];
      for (const key of required) {
        if (!Object.hasOwn(val, key)) errors.push(`${path}.${key}: required property is missing`);
      }
      if (node.additionalProperties === false) {
        for (const key of Object.keys(val)) {
          if (!Object.hasOwn(props, key)) errors.push(`${path}.${key}: property is not declared in the schema`);
        }
      }
      for (const [key, sub] of Object.entries(props)) {
        if (Object.hasOwn(val, key)) check(val[key], sub, `${path}.${key}`, depth + 1, errors);
      }
      return;
    }

    if (types.includes("array") && Array.isArray(val)) {
      if (node.items) val.forEach((item, i) => check(item, node.items, `${path}[${i}]`, depth + 1, errors));
    }
  };

  check(value, schema, "root", 0, errors);
  return { ok: errors.length === 0, errors };
}

function matchesType(val, type) {
  switch (type) {
    case "null":
      return val === null;
    case "string":
      return typeof val === "string";
    case "boolean":
      return typeof val === "boolean";
    case "integer":
      return typeof val === "number" && Number.isInteger(val);
    case "number":
      // NaN and Infinity are `typeof "number"` but cannot survive JSON, so a
      // reply containing one did not come from JSON.parse of a vendor reply.
      return typeof val === "number" && Number.isFinite(val);
    case "array":
      return Array.isArray(val);
    case "object":
      return val !== null && typeof val === "object" && !Array.isArray(val);
    default:
      return false;
  }
}

function describe(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  if (Number.isInteger(val)) return "integer";
  return typeof val;
}
