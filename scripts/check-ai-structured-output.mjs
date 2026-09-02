// scripts/check-ai-structured-output.mjs
//
// Structured outputs: the schema linter, the local validator, and complete()'s
// schema mode, EXECUTED against a stubbed vendor.
//
//   npm run check:ai-structured-output
//
// ══ Why this file executes rather than reads ═══════════════════════════════
//
// Because the thing being proved is a set of DISTINCTIONS, and a distinction
// is invisible to a text scan. complete() returned "" for eight different
// situations — no key, a 401, a retired model ID, a rate limit, a refusal, a
// truncated reply, a model with nothing to say — and reading the source made
// that look fine, because each branch on its own IS fine. What was wrong was
// that they were all the same value on the way out. The only way to show that
// is to make each one happen and compare what comes back.
//
// So this file stands up a fake OpenAI client, drives complete() through every
// one of those situations, and asserts they are now distinguishable. It also
// asserts the one that matters in the other direction: EMPTY is still a
// legitimate outcome, not an error, and must not be reported as a failure that
// would make a caller refund credit it should have charged.
//
// ══ Where the vendor's rules come from ═════════════════════════════════════
//
// The strict-mode subset is documented at
// developers.openai.com/api/docs/guides/structured-outputs and, with the
// limits as an explicit table, at
// learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs
// (both read 2026-09-02). Section 1 encodes that table. If OpenAI relaxes a
// rule, this section is what should change first — a linter that is stricter
// than the vendor only ever costs a developer an argument, while one that is
// laxer costs a 400 in production.
//
// ══ Supported models ═══════════════════════════════════════════════════════
//
// Strict structured outputs are documented as available on gpt-5, gpt-5-mini,
// gpt-5-nano, gpt-5.1, gpt-4.1 (and -mini/-nano), gpt-4o-2024-08-06 and later,
// gpt-4o-mini, o1, o3, o3-mini and o4-mini. The default here is gpt-5-mini
// (provider.js's MODEL), which is on that list.
//
// NOT gated on a hardcoded allowlist, deliberately. OPENAI_MODEL and
// OPENAI_WRITING_MODEL are both environment variables, an allowlist in code
// goes stale the week a model ships, and a stale allowlist would refuse a
// model that works — which is a dead control. A model that genuinely does not
// support response_format returns a 400, which is now a NAMED vendor_error
// with the vendor's own message in the log rather than an empty string. That
// is the honest way to find out.
//
// ══ Rules for reading this file ════════════════════════════════════════════
//
// The string assertions in section 6 are scoped to ONE brace-matched function
// body, never to the whole file, because "the file contains this text" is
// worthless once a file is 700 lines. And note that `src.indexOf(a) <
// src.indexOf(b)` FALSE-PASSES when `a` is absent: indexOf returns -1, which
// is less than everything. Three checks in this repo were found with that bug
// in one day. Every ordering assertion here proves both markers exist first.

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertStrictSchema,
  validateAgainstSchema,
  MAX_PROPERTIES,
  MAX_NESTING_DEPTH,
} from "@/lib/ai/jsonSchema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
const ok = (cond, msg, detail) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg + (cond || detail === undefined ? "" : `  — got ${JSON.stringify(detail)}`));
  if (!cond) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. assertStrictSchema — a schema the vendor would refuse, refused here first");
// ═══════════════════════════════════════════════════════════════════════════

const GOOD = {
  type: "object",
  properties: {
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    note: { type: ["string", "null"] },
  },
  required: ["caption", "hashtags", "note"],
  additionalProperties: false,
};

ok(assertStrictSchema(GOOD).ok, "a well-formed strict schema passes", assertStrictSchema(GOOD).errors);

// The four rules that catch real mistakes, each on its own.
const refusals = [
  [
    "root is an array",
    { type: "array", items: { type: "string" } },
    /root of a strict schema must be/,
  ],
  [
    "an object without additionalProperties: false",
    { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
    /additionalProperties: false/,
  ],
  [
    "a declared property missing from required",
    {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a"],
      additionalProperties: false,
    },
    /must be listed in `required` — missing b/,
  ],
  [
    "required naming a property that does not exist",
    { type: "object", properties: { a: { type: "string" } }, required: ["a", "ghost"], additionalProperties: false },
    /do not exist: ghost/,
  ],
  [
    "an unsupported string keyword (maxLength)",
    {
      type: "object",
      properties: { a: { type: "string", maxLength: 40 } },
      required: ["a"],
      additionalProperties: false,
    },
    /`maxLength` is not supported on a string/,
  ],
  [
    "an unsupported array keyword (maxItems)",
    {
      type: "object",
      properties: { a: { type: "array", items: { type: "string" }, maxItems: 3 } },
      required: ["a"],
      additionalProperties: false,
    },
    /`maxItems` is not supported on an? array/,
  ],
  [
    "an unsupported number keyword (minimum)",
    {
      type: "object",
      properties: { a: { type: "integer", minimum: 0 } },
      required: ["a"],
      additionalProperties: false,
    },
    /`minimum` is not supported on an? integer/,
  ],
  [
    "allOf, which the subset forbids outright",
    {
      type: "object",
      properties: { a: { allOf: [{ type: "string" }] } },
      required: ["a"],
      additionalProperties: false,
    },
    /`allOf` is not supported/,
  ],
  [
    "a node with neither a type nor an anyOf",
    { type: "object", properties: { a: { description: "?" } }, required: ["a"], additionalProperties: false },
    /no `type` and no `anyOf`/,
  ],
  [
    "an unresolvable $ref",
    {
      type: "object",
      properties: { a: { $ref: "#/definitions/nope" } },
      required: ["a"],
      additionalProperties: false,
    },
    /unresolvable \$ref/,
  ],
  ["not an object at all", "a string", /schema must be an object/],
  ["null", null, /schema must be an object/],
];

for (const [label, schema, pattern] of refusals) {
  const res = assertStrictSchema(schema);
  ok(!res.ok, `refused: ${label}`, res.errors);
  ok(res.errors.some((e) => pattern.test(e)), `…and says why (${pattern.source.slice(0, 34)}…)`, res.errors);
}

// The limits, exercised at the boundary rather than asserted from the docs.
{
  const wide = { type: "object", properties: {}, required: [], additionalProperties: false };
  for (let i = 0; i < MAX_PROPERTIES; i++) {
    wide.properties[`p${i}`] = { type: "string" };
    wide.required.push(`p${i}`);
  }
  ok(assertStrictSchema(wide).ok, `exactly ${MAX_PROPERTIES} properties is allowed`, assertStrictSchema(wide).errors);
  wide.properties.oneMore = { type: "string" };
  wide.required.push("oneMore");
  const over = assertStrictSchema(wide);
  ok(!over.ok && over.errors.some((e) => /the limit is 100/.test(e)), `${MAX_PROPERTIES + 1} is refused`, over.errors);
}

{
  // Depth counted the way the vendor counts it: the root is level 1.
  const nest = (levels) => {
    let node = { type: "string" };
    for (let i = 0; i < levels - 1; i++) {
      node = { type: "object", properties: { down: node }, required: ["down"], additionalProperties: false };
    }
    return { type: "object", properties: { down: node }, required: ["down"], additionalProperties: false };
  };
  ok(assertStrictSchema(nest(MAX_NESTING_DEPTH - 1)).ok, `${MAX_NESTING_DEPTH} levels of nesting is allowed`);
  const deep = assertStrictSchema(nest(MAX_NESTING_DEPTH + 3));
  ok(!deep.ok && deep.errors.some((e) => /nesting deeper than/.test(e)), "deeper than five levels is refused", deep.errors);
}

// $defs and recursion — supported by the vendor, so supported here.
{
  const recursive = {
    type: "object",
    properties: { node: { $ref: "#/$defs/node" } },
    $defs: {
      node: {
        type: "object",
        properties: {
          label: { type: "string" },
          child: { anyOf: [{ $ref: "#/$defs/node" }, { type: "null" }] },
        },
        required: ["label", "child"],
        additionalProperties: false,
      },
    },
    required: ["node"],
    additionalProperties: false,
  };
  const res = assertStrictSchema(recursive);
  ok(res.ok, "a recursive $defs schema is accepted and does not hang the linter", res.errors);
}

// An unreachable $defs entry is still linted — a broken one still 400s.
{
  const orphan = {
    type: "object",
    properties: { a: { type: "string" } },
    required: ["a"],
    additionalProperties: false,
    $defs: { unused: { type: "object", properties: { x: { type: "string" } }, required: ["x"] } },
  };
  const res = assertStrictSchema(orphan);
  ok(!res.ok && res.errors.some((e) => /\$defs\.unused/.test(e)), "a broken but unreferenced $defs entry is still caught", res.errors);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. validateAgainstSchema — the local half of the guarantee");
// ═══════════════════════════════════════════════════════════════════════════

const v = (value, schema = GOOD) => validateAgainstSchema(value, schema);

ok(v({ caption: "hi", hashtags: ["#a"], note: null }).ok, "a valid object validates");
ok(v({ caption: "hi", hashtags: [], note: "text" }).ok, "an empty array and a present nullable both validate");

{
  const r = v({ hashtags: [], note: null });
  ok(!r.ok && r.errors.some((e) => /root\.caption: required property is missing/.test(e)), "a MISSING required field is rejected, with a path", r.errors);
}
{
  const r = v({ caption: "hi", hashtags: [], note: null, extra: 1 });
  ok(!r.ok && r.errors.some((e) => /root\.extra: property is not declared/.test(e)), "an EXTRA field is rejected — additionalProperties: false was sent, so a reply carrying one means the guarantee did not hold", r.errors);
}
{
  const r = v({ caption: 42, hashtags: "no", note: 7 });
  ok(!r.ok, "WRONG TYPES are rejected");
  ok(r.errors.some((e) => /root\.caption: expected string, got integer/.test(e)), "…naming the field and both types", r.errors);
  ok(r.errors.some((e) => /root\.hashtags: expected array, got string/.test(e)), "…for every wrong field, not just the first", r.errors);
}
{
  const r = v({ caption: "hi", hashtags: ["#a", 3, null], note: null });
  ok(!r.ok && r.errors.some((e) => /root\.hashtags\[1\]/.test(e)), "a wrong type INSIDE an array is caught, with its index", r.errors);
}
{
  // The trap a hand-rolled validator falls into: null is typeof "object".
  const r = v({ caption: null, hashtags: [], note: null });
  ok(!r.ok && r.errors.some((e) => /root\.caption: expected string, got null/.test(e)), "a null where a non-nullable string was declared is rejected", r.errors);
  ok(v({ caption: "x", hashtags: [], note: null }).ok, "…while a null where the type union permits one is accepted");
}
{
  // A nullable OBJECT must not report its children as missing when it is null.
  const schema = {
    type: "object",
    properties: {
      inner: {
        anyOf: [
          { type: "object", properties: { q: { type: "string" } }, required: ["q"], additionalProperties: false },
          { type: "null" },
        ],
      },
    },
    required: ["inner"],
    additionalProperties: false,
  };
  ok(validateAgainstSchema({ inner: null }, schema).ok, "an anyOf null branch accepts null without demanding the object's children");
  ok(validateAgainstSchema({ inner: { q: "x" } }, schema).ok, "…and accepts the object branch");
  const bad = validateAgainstSchema({ inner: { q: 1 } }, schema);
  ok(!bad.ok && bad.errors.some((e) => /matched none of the 2 anyOf branches/.test(e)), "…and rejects a value matching neither", bad.errors);
}

// A NESTED object, which is where a shallow validator quietly passes anything.
{
  const nested = {
    type: "object",
    properties: {
      calls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            callIndex: { type: "integer" },
            notes: { type: "array", items: { type: "string" } },
          },
          required: ["callIndex", "notes"],
          additionalProperties: false,
        },
      },
    },
    required: ["calls"],
    additionalProperties: false,
  };
  ok(validateAgainstSchema({ calls: [{ callIndex: 0, notes: ["a"] }] }, nested).ok, "a nested object validates");
  const missingDeep = validateAgainstSchema({ calls: [{ callIndex: 0 }] }, nested);
  ok(!missingDeep.ok && missingDeep.errors.some((e) => /root\.calls\[0\]\.notes: required/.test(e)), "a field missing two levels down is caught, with the full path", missingDeep.errors);
  const extraDeep = validateAgainstSchema({ calls: [{ callIndex: 0, notes: [], winRatePct: 87 }] }, nested);
  ok(!extraDeep.ok && extraDeep.errors.some((e) => /root\.calls\[0\]\.winRatePct/.test(e)), "a smuggled statistic two levels down is caught, not ignored", extraDeep.errors);
  const floatIndex = validateAgainstSchema({ calls: [{ callIndex: 1.5, notes: [] }] }, nested);
  ok(!floatIndex.ok && floatIndex.errors.some((e) => /expected integer/.test(e)), "integer is not the same as number — 1.5 is rejected", floatIndex.errors);
}

// enum, one of the few constraints the vendor actually enforces.
{
  const schema = {
    type: "object",
    properties: { priority: { type: "string", enum: ["urgent", "high", "normal", "low"] } },
    required: ["priority"],
    additionalProperties: false,
  };
  ok(validateAgainstSchema({ priority: "high" }, schema).ok, "an enum member validates");
  const bad = validateAgainstSchema({ priority: "CRITICAL" }, schema);
  ok(!bad.ok && bad.errors.some((e) => /is not one of/.test(e)), "a value outside the enum is rejected", bad.errors);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. complete() in schema mode — every outcome, against a stubbed vendor");
// ═══════════════════════════════════════════════════════════════════════════
//
// provider.js constructs its OpenAI client lazily (lib/lazyClient.js) from a
// module-scoped factory, so there is no seam to inject through. The stub goes
// in one level lower — at the module resolver — which means the function under
// test is the SHIPPED complete(), not a copy of it. A copy is the one thing
// worth refusing here: the whole bug being fixed was that reading the real
// function did not reveal the problem.

const stub = {
  // Set per case by the tests below.
  next: null,
  lastRequest: null,
};

// A fake `openai` module. Registered before provider.js is imported.
const { register } = await import("node:module");
const stubUrl = new URL("./ai-vendor-stub-hooks.mjs", import.meta.url);
fs.writeFileSync(
  fileURLToPath(stubUrl),
  `// Generated by check-ai-structured-output.mjs. Safe to delete.
export async function resolve(spec, ctx, next) {
  if (spec === "openai") return { url: "fieldquo-openai-stub:", shortCircuit: true, format: "module" };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === "fieldquo-openai-stub:") {
    return {
      format: "module",
      shortCircuit: true,
      source: \`
        const bus = globalThis.__fieldquoVendorStub;
        export default class OpenAI {
          constructor() {
            this.chat = { completions: { create: async (req) => bus.handle(req) } };
            this.images = { generate: async () => ({}), edit: async () => ({}) };
          }
        }
        export const toFile = async (b) => b;
      \`,
    };
  }
  return next(url, ctx);
}
`,
);

globalThis.__fieldquoVendorStub = {
  handle(req) {
    stub.lastRequest = req;
    const next = stub.next;
    if (typeof next === "function") return next(req);
    throw new Error("vendor stub had no scripted reply");
  },
};

register(stubUrl, import.meta.url);

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-not-a-real-key";
const { complete, AI_FAILURE, stripJsonFence } = await import("@/lib/ai/provider");

/** A vendor reply in the shape chat.completions.create actually returns. */
const reply = (content, { finish = "stop", refusal = null, usage = { prompt_tokens: 100, completion_tokens: 20 } } = {}) => ({
  choices: [{ finish_reason: finish, message: { content, refusal } }],
  usage,
});

/** Drive complete() once, capturing what it metered and what it reported. */
async function run({ vendor, schema = GOOD, ...rest }) {
  stub.next = vendor;
  const usage = [];
  const errors = [];
  const out = await complete({
    prompt: "x",
    schema,
    schemaName: "check",
    onUsage: async (u) => usage.push(u),
    onError: async (e) => errors.push(e),
    ...rest,
  });
  return { out, usage, errors };
}

// ── a valid response ───────────────────────────────────────────────────────
{
  const payload = { caption: "Fresh coat.", hashtags: ["#kitchen"], note: null };
  const { out, usage, errors } = await run({ vendor: () => reply(JSON.stringify(payload)) });
  ok(out.ok === true, "VALID: ok is true", out);
  ok(JSON.stringify(out.data) === JSON.stringify(payload), "VALID: the parsed object comes back", out.data);
  ok(errors.length === 0, "VALID: nothing reported as a failure", errors);
  ok(usage.length === 1 && usage[0].promptTokens === 100 && usage[0].completionTokens === 20, "VALID: metered exactly once, with the vendor's own counts", usage);
}

// ── the request we actually sent ───────────────────────────────────────────
{
  const rf = stub.lastRequest.response_format;
  ok(rf?.type === "json_schema", "the request carries response_format.type === 'json_schema'", rf);
  ok(rf?.json_schema?.strict === true, "…with strict: true — without it this is JSON MODE, which guarantees the reply parses and NOTHING about its shape", rf?.json_schema);
  ok(rf?.json_schema?.name === "check", "…named after the caller, which is what shows up in a vendor-side error", rf?.json_schema?.name);
  ok(JSON.stringify(rf?.json_schema?.schema) === JSON.stringify(GOOD), "…and carries the caller's plain JSON Schema verbatim, no wrapper of ours", rf?.json_schema?.schema);
}

// ── a text call is byte-for-byte what it was before this parameter existed ──
{
  stub.next = () => reply("just words");
  const before = await complete({ prompt: "x" });
  ok(before === "just words", "TEXT MODE: still returns a plain string", before);
  ok(!Object.hasOwn(stub.lastRequest, "response_format"), "TEXT MODE: no response_format is sent at all — an existing call's payload is unchanged", Object.keys(stub.lastRequest));
}

// ── one missing a required field ───────────────────────────────────────────
{
  const { out, usage, errors } = await run({ vendor: () => reply(JSON.stringify({ caption: "hi", note: null })) });
  ok(out.ok === false && out.reason === AI_FAILURE.SCHEMA_MISMATCH, "MISSING FIELD: reported as schema_mismatch", out);
  ok(/hashtags: required property is missing/.test(out.message), "…with the field named", out.message);
  ok(out.raw.includes("caption"), "…and the raw reply preserved for the log", out.raw);
  ok(usage.length === 1, "…and STILL METERED: the vendor generated and billed those tokens whether or not we could use them", usage);
  ok(errors[0]?.reason === AI_FAILURE.SCHEMA_MISMATCH, "…and reported through onError", errors);
}

// ── one with an extra field ────────────────────────────────────────────────
{
  const { out } = await run({
    vendor: () => reply(JSON.stringify({ caption: "hi", hashtags: [], note: null, winRatePct: 87 })),
  });
  ok(out.ok === false && out.reason === AI_FAILURE.SCHEMA_MISMATCH, "EXTRA FIELD: rejected rather than ignored", out);
  ok(/winRatePct: property is not declared/.test(out.message), "…named, because a field we never asked for is a number nobody validated", out.message);
}

// ── wrong types ────────────────────────────────────────────────────────────
{
  const { out } = await run({ vendor: () => reply(JSON.stringify({ caption: 1, hashtags: {}, note: 2 })) });
  ok(out.ok === false && out.reason === AI_FAILURE.SCHEMA_MISMATCH, "WRONG TYPES: rejected", out);
  ok(/caption: expected string/.test(out.message) && /hashtags: expected array/.test(out.message), "…every one of them, not just the first", out.message);
}

// ── a vendor error ─────────────────────────────────────────────────────────
{
  const { out, usage, errors } = await run({
    vendor: () => {
      const err = new Error("404 The model `gpt-5-mini` does not exist or you do not have access to it.");
      throw err;
    },
  });
  ok(out.ok === false && out.reason === AI_FAILURE.VENDOR_ERROR, "VENDOR ERROR: named as such", out);
  ok(/does not exist/.test(out.message), "…carrying the vendor's own words, which is the whole point — a retired model ID used to be indistinguishable from silence", out.message);
  ok(usage.length === 0, "…and NOT metered: the vendor never produced a usage block, so there is nothing to charge", usage);
  ok(errors[0]?.reason === AI_FAILURE.VENDOR_ERROR, "…and reported through onError", errors);
}

// ── an empty response, which must NOT look like a rejection ────────────────
{
  const { out, usage } = await run({ vendor: () => reply("") });
  ok(out.ok === false && out.reason === AI_FAILURE.EMPTY, "EMPTY: reported as `empty`", out);
  ok(out.reason !== AI_FAILURE.SCHEMA_MISMATCH && out.reason !== AI_FAILURE.VENDOR_ERROR && out.reason !== AI_FAILURE.UNPARSEABLE, "EMPTY is a DIFFERENT reason from every kind of rejection — this is the distinction the whole change exists for", out.reason);
  ok(usage.length === 1, "…and metered, because the vendor answered and billed for it", usage);
}

// The same distinction in the plain-text path, where every caller lives today.
{
  const seen = [];
  const cases = [
    ["no key at all", () => reply("never called"), { unset: true }, AI_FAILURE.UNCONFIGURED],
    ["a vendor throw", () => { throw new Error("429 rate limited"); }, {}, AI_FAILURE.VENDOR_ERROR],
    ["a blank answer", () => reply("   "), {}, AI_FAILURE.EMPTY],
    ["a refusal", () => reply(null, { refusal: "I can't help with that." }), {}, AI_FAILURE.REFUSED],
    ["a truncated answer", () => reply("half a sen", { finish: "length" }), {}, AI_FAILURE.TRUNCATED],
  ];
  for (const [label, vendor, opts, expected] of cases) {
    stub.next = vendor;
    const errors = [];
    const key = process.env.OPENAI_API_KEY;
    if (opts.unset) delete process.env.OPENAI_API_KEY;
    const text = await complete({ prompt: "x", onError: (e) => errors.push(e) });
    if (opts.unset) process.env.OPENAI_API_KEY = key;
    seen.push(errors[0]?.reason);
    ok(errors[0]?.reason === expected, `TEXT MODE: "${label}" reports \`${expected}\``, errors[0]);
    ok(typeof text === "string", `TEXT MODE: "${label}" still returns a string — no caller was broken to gain this`, text);
  }
  ok(new Set(seen).size === cases.length, "…and all five reasons are distinct from one another", seen);
}

// A truncated TEXT reply keeps whatever arrived — the pre-existing behaviour.
{
  stub.next = () => reply("half a sen", { finish: "length" });
  const text = await complete({ prompt: "x" });
  ok(text === "half a sen", "TEXT MODE: a truncated reply still returns its partial content, as it always did", text);
}

// ── a refusal, which does NOT follow the schema ────────────────────────────
{
  const { out, usage } = await run({ vendor: () => reply(null, { refusal: "I won't do that." }) });
  ok(out.ok === false && out.reason === AI_FAILURE.REFUSED, "REFUSAL: reported as `refused`, not as unparseable JSON", out);
  ok(out.message === "I won't do that.", "…carrying the model's own words, which is the only actionable part", out.message);
  ok(usage.length === 1, "…and metered", usage);
}

// ── a truncated reply is not 'unparseable' ─────────────────────────────────
{
  const { out } = await run({ vendor: () => reply('{"caption":"Fresh co', { finish: "length" }) });
  ok(out.ok === false && out.reason === AI_FAILURE.TRUNCATED, "TRUNCATION: named as truncation, not as bad JSON — the fix is maxTokens, and 'unparseable' would hide that", out);
}

// ── prose instead of JSON ──────────────────────────────────────────────────
{
  const { out } = await run({ vendor: () => reply("Sure! Here's your caption.") });
  ok(out.ok === false && out.reason === AI_FAILURE.UNPARSEABLE, "UNPARSEABLE: named", out);
  ok(out.raw === "Sure! Here's your caption.", "…with the raw text kept, so a log shows what actually came back", out.raw);
}

// ── a fenced reply is still read ───────────────────────────────────────────
{
  const body = JSON.stringify({ caption: "ok", hashtags: [], note: null });
  const { out } = await run({ vendor: () => reply("```json\n" + body + "\n```") });
  ok(out.ok === true, "a fenced reply is still unwrapped — strict mode should make this impossible, and one regex is cheap to be wrong about", out);
  ok(stripJsonFence("```json\n{}\n```") === "{}", "stripJsonFence itself is still exported and working for the callers not yet migrated");
}

// ── a schema the vendor would refuse: caught before anything is spent ──────
{
  stub.lastRequest = null;
  const { out, usage, errors } = await run({
    vendor: () => reply("{}"),
    schema: { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a"], additionalProperties: false },
  });
  ok(out.ok === false && out.reason === AI_FAILURE.BAD_SCHEMA, "BAD SCHEMA: named as our fault, not the model's", out);
  ok(stub.lastRequest === null, "…and NO REQUEST WAS MADE — a schema the vendor would 400 on costs nothing to catch here", stub.lastRequest);
  ok(usage.length === 0, "…so nothing was metered", usage);
  ok(errors[0]?.reason === AI_FAILURE.BAD_SCHEMA, "…and it was reported", errors);
}

// ── a nested object, end to end ────────────────────────────────────────────
{
  const nestedSchema = {
    type: "object",
    properties: {
      intro: {
        type: "object",
        properties: { headline: { type: "string" }, subhead: { type: "string" } },
        required: ["headline", "subhead"],
        additionalProperties: false,
      },
      extra: {
        anyOf: [
          {
            type: "object",
            properties: { question: { type: "string" }, answers: { type: "array", items: { type: "string" } } },
            required: ["question", "answers"],
            additionalProperties: false,
          },
          { type: "null" },
        ],
      },
    },
    required: ["intro", "extra"],
    additionalProperties: false,
  };
  const good = { intro: { headline: "h", subhead: "s" }, extra: { question: "q", answers: ["a", "b"] } };
  const r1 = await run({ vendor: () => reply(JSON.stringify(good)), schema: nestedSchema });
  ok(r1.out.ok && r1.out.data.extra.answers.length === 2, "NESTED: a two-level object with an anyOf-null branch round-trips", r1.out);

  const r2 = await run({ vendor: () => reply(JSON.stringify({ intro: { headline: "h", subhead: "s" }, extra: null })), schema: nestedSchema });
  ok(r2.out.ok && r2.out.data.extra === null, "NESTED: the null branch is accepted, not reported as a missing object", r2.out);

  const r3 = await run({ vendor: () => reply(JSON.stringify({ intro: { headline: "h" }, extra: null })), schema: nestedSchema });
  ok(!r3.out.ok && /root\.intro\.subhead/.test(r3.out.message), "NESTED: a field missing inside the nested object is caught with its path", r3.out);
}

// ── metering, stated as an ordering rather than a hope ─────────────────────
{
  const order = [];
  stub.next = () => { order.push("vendor"); return reply(JSON.stringify({ caption: "x", hashtags: [], note: null })); };
  await complete({
    prompt: "x",
    schema: GOOD,
    onUsage: async () => order.push("usage"),
  });
  ok(JSON.stringify(order) === JSON.stringify(["vendor", "usage"]), "usage is recorded AFTER the vendor call, from its own counts", order);
}

// ── no retry. A schema rejection must cost exactly one call ────────────────
{
  let calls = 0;
  stub.next = () => { calls += 1; return reply(JSON.stringify({ caption: "hi" })); };
  await complete({ prompt: "x", schema: GOOD, onUsage: async () => {} });
  ok(calls === 1, "a schema rejection makes exactly ONE vendor call — a retry would spend tokens against a quota that was checked once, before the first", calls);
}

// ── onError is optional, and a throwing one cannot take down the request ───
{
  stub.next = () => reply(JSON.stringify({ caption: "x", hashtags: [], note: null }));
  const noHandler = await complete({ prompt: "x", schema: GOOD });
  ok(noHandler.ok === true, "onError is optional — omitting it changes nothing");

  stub.next = () => { throw new Error("boom"); };
  let threw = null;
  let out = null;
  try {
    out = await complete({ prompt: "x", schema: GOOD, onError: () => { throw new Error("the handler itself is broken"); } });
  } catch (err) {
    threw = err;
  }
  ok(threw === null, "an onError handler that throws does not take down the request it was reporting on", threw?.message);
  ok(out?.reason === AI_FAILURE.VENDOR_ERROR, "…and the original reason still comes back", out);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The migrated callers, driven through the same stub");
// ═══════════════════════════════════════════════════════════════════════════

const { runVisionPass } = await import("@/lib/ai/visionPass");
const { parseModelOutput, assembleInsights } = await import("@/lib/ai/callTranscriptDigest");
const { parseModelJson } = await import("@/lib/ai/marketingCopy");

// visionPass is the paid one: every failure must return null so the route
// refunds, and a legitimately EMPTY read must not.
{
  // photosFromQuote() reads `clientPhotos`, not `photos` — the shape below is
  // the one lib/ai/quoteReview.js's loadQuote() actually produces.
  const quote = { scopeGroups: [], clientPhotos: [{ kind: "photo", url: "https://example.com/a.jpg" }] };
  for (const [label, vendor] of [
    ["a vendor outage", () => { throw new Error("503"); }],
    ["a refusal", () => reply(null, { refusal: "no" })],
    ["a truncated reply", () => reply('{"notes":["ha', { finish: "length" })],
    ["a shape that fails validation", () => reply(JSON.stringify({ findings: [] }))],
    ["prose", () => reply("I had a look and…")],
    ["an empty answer", () => reply("")],
  ]) {
    stub.next = vendor;
    const out = await runVisionPass({ quote, onUsage: async () => {} });
    ok(out === null, `visionPass: "${label}" returns null, so the caller refunds the credit it reserved`, out);
  }

  stub.next = () => reply(JSON.stringify({ notes: [] }));
  const emptyRead = await runVisionPass({ quote, onUsage: async () => {} });
  ok(emptyRead !== null && emptyRead.notes.length === 0, "visionPass: an EMPTY notes array is a real answer and is NOT a refund — this is the distinction that would have cost a company money", emptyRead);

  stub.next = () => reply(JSON.stringify({ notes: ["", "   ", "Check the sill.", "x"] }));
  const trimmed = await runVisionPass({ quote, onUsage: async () => {} });
  ok(trimmed.notes.length === 2 && trimmed.notes[0] === "Check the sill.", "visionPass: blank strings are still dropped — the schema cannot express minLength, so this coercion had to survive", trimmed.notes);
  ok(trimmed.photosRead === 1, "visionPass: photosRead is counted in code, never read out of the model's JSON", trimmed);
}

// The digest's discipline: no number comes out of the model, ever.
{
  const candidates = [
    { quoteId: "qa", quoteNumber: "Q-A", outcome: "won" },
    { quoteId: "qb", quoteNumber: "Q-B", outcome: "lost" },
  ];
  const smuggled = {
    calls: [{ callIndex: 0, notes: ["said out loud"] }, { callIndex: 1, notes: [] }],
    winRatePct: 87,
    totalWon: 999,
    conclusion: "You are losing on price.",
  };
  const { notesByQuoteId } = parseModelOutput(smuggled, candidates);
  const assembled = assembleInsights({ totalCandidates: 2, read: candidates, notesByQuoteId, aiRead: true });
  ok(!/87|999|conclusion|winRate/.test(JSON.stringify(assembled)), "digest: a statistic the model volunteered reaches nothing — every count on the output is an array length", assembled);
  ok(assembled.withNotes === 1 && assembled.byOutcome.won.read === 1, "digest: the counts that ARE there were computed here", assembled);
}

// marketingCopy takes the validated object and still normalises it.
{
  ok(parseModelJson({ caption: "ok", hashtags: ["kitchen remodel"] }).hashtags[0] === "#kitchenremodel", "marketingCopy: hashtag normalisation survived the migration");
  ok(parseModelJson("a string, not an object").caption === "", "marketingCopy: still degrades rather than throwing on a shape the vendor swears is impossible");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. stripJsonFence still works for everything not yet migrated");
// ═══════════════════════════════════════════════════════════════════════════

const NOT_MIGRATED = [
  "lib/ai/callQuoteDraft.js",
  "lib/site/generateSite.js",
  "lib/i18n/translateContent.js",
  "lib/voice/knowledgeDraft.js",
];
for (const rel of NOT_MIGRATED) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  ok(/JSON\.parse/.test(src), `${rel}: still hand-parses (deliberately — see the report), so it must keep working`, rel);
}
ok(stripJsonFence('```json\n{"a":1}\n```') === '{"a":1}', "a fenced reply is unwrapped");
ok(stripJsonFence("```\n{}\n```") === "{}", "an unlabelled fence is unwrapped");
ok(stripJsonFence('{"a":1}') === '{"a":1}', "an unfenced reply passes through untouched");
ok(stripJsonFence(null) === "" && stripJsonFence(undefined) === "", "null and undefined degrade to an empty string, as they always did");

// ═══════════════════════════════════════════════════════════════════════════
section("6. The rules a future edit could quietly undo");
// ═══════════════════════════════════════════════════════════════════════════
//
// Text assertions, and therefore the weakest thing here — but each one is
// scoped to a single brace-matched function body rather than to the file, and
// every ordering claim proves BOTH markers exist before comparing positions.
// `src.indexOf(a) < src.indexOf(b)` false-passes when `a` is absent, because
// indexOf returns -1; three checks in this repo were found with exactly that
// bug in one day.

/**
 * The body of `name`, from its opening brace to the matching close.
 *
 * The subtlety worth spelling out: `export async function complete({ system,
 * prompt, ... })` destructures its parameters, so the FIRST `{` after the name
 * opens the parameter list, not the body. Brace-matching from there returns
 * the signature and none of the code — which passes an "is this text absent"
 * assertion trivially, in the wrong direction. So when a `(` comes before the
 * first `{`, the parameter list is skipped by paren-matching first.
 */
function functionBody(src, name) {
  const at = src.indexOf(name);
  assert.notStrictEqual(at, -1, `${name} not found — this check is scoped to it`);

  let open = src.indexOf("{", at);
  const paren = src.indexOf("(", at);
  if (paren !== -1 && (open === -1 || paren < open)) {
    let pdepth = 0;
    let end = -1;
    for (let i = paren; i < src.length; i++) {
      if (src[i] === "(") pdepth++;
      else if (src[i] === ")") { pdepth--; if (pdepth === 0) { end = i; break; } }
    }
    assert.notStrictEqual(end, -1, `unbalanced parentheses in ${name}`);
    open = src.indexOf("{", end);
  }
  assert.notStrictEqual(open, -1, `no opening brace after ${name}`);
  let depth = 0;
  let inLine = false;
  let inBlock = false;
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** `a` must appear, `b` must appear, and `a` must come first. */
function orderedIn(body, a, b) {
  const ia = body.indexOf(a);
  const ib = body.indexOf(b);
  if (ia === -1) return { ok: false, why: `"${a}" is absent` };
  if (ib === -1) return { ok: false, why: `"${b}" is absent` };
  return { ok: ia < ib, why: `"${a}" at ${ia}, "${b}" at ${ib}` };
}

{
  const providerSrc = fs.readFileSync(path.join(ROOT, "lib/ai/provider.js"), "utf8");
  const body = functionBody(providerSrc, "export async function complete(");

  const metersFirst = orderedIn(body, "onUsage({", "AI_FAILURE.EMPTY");
  ok(metersFirst.ok, "complete(): metering happens BEFORE the content is judged, so a refused or mismatched reply is still charged for", metersFirst.why);

  const lintsFirst = orderedIn(body, "assertStrictSchema(schema)", "client.chat.completions.create");
  ok(lintsFirst.ok, "complete(): the schema is linted BEFORE the request, so a bad schema costs no round trip", lintsFirst.why);

  const validatesLocally = orderedIn(body, "JSON.parse(", "validateAgainstSchema(");
  ok(validatesLocally.ok, "complete(): the parsed object is validated locally, after parsing — the vendor's promise is checked, not assumed", validatesLocally.why);

  ok(body.includes("strict: true"), "complete(): strict: true is actually sent — plain json_schema without it is JSON mode, which constrains nothing about the shape");

  // One vendor call per complete(). A retry would double the cost of the call
  // most likely to be failing, against a quota checked before the first.
  const creates = body.match(/client\.chat\.completions\.create/g) || [];
  ok(creates.length === 1, "complete(): exactly one vendor call in the function — no retry loop crept in", creates.length);
}

{
  // The rule the whole audit was written around: the digest reads no number.
  const digestSrc = fs.readFileSync(path.join(ROOT, "lib/ai/callTranscriptDigest.js"), "utf8");
  const assembleBody = functionBody(digestSrc, "export function assembleInsights(");
  ok(!/parsed\.|model\w*\.(count|total|rate|pct)/i.test(assembleBody), "assembleInsights(): reads nothing off the model's parsed JSON", assembleBody.slice(0, 80));
  const lengths = assembleBody.match(/\.length/g) || [];
  ok(lengths.length >= 3, "assembleInsights(): its numbers are still array lengths, computed here", lengths.length);

  // And the schema itself must carry no number-typed field.
  const schemaBody = functionBody(digestSrc, "const DIGEST_SCHEMA =");
  ok(!/"number"/.test(schemaBody), "DIGEST_SCHEMA: declares no number-typed field — a schema is the cheapest way to start accepting a model's arithmetic", schemaBody);

  const parseBody = functionBody(digestSrc, "export function parseModelOutput(");
  ok(parseBody.includes("looksLikeInstruction"), "parseModelOutput(): the instruction-shaped-note gate survived the migration — no schema in any format can express it");
  ok(parseBody.includes("MAX_NOTE_CHARS") && parseBody.includes("MAX_NOTES_PER_CALL"), "parseModelOutput(): the length and count caps survived — maxLength and maxItems are both outside the strict subset");
  ok(parseBody.includes("idx >= candidates.length"), "parseModelOutput(): the callIndex range check survived, so a miscounted index cannot attach a note to the wrong homeowner's quote");
}

{
  // No schema anywhere may declare money.
  const files = [
    "lib/ai/visionPass.js",
    "lib/ai/quoteReview.js",
    "lib/ai/callTranscriptDigest.js",
    "lib/ai/marketingCopy.js",
    "lib/funnels/generate.js",
    "lib/tasks/suggestFromJob.js",
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const at = src.search(/const \w*_?SCHEMA =/);
    ok(at !== -1, `${rel}: declares a schema`, rel);
    const schemaBody = functionBody(src, src.slice(at, src.indexOf("=", at) + 1));
    ok(
      !/(price|total|amount|cost|subtotal|deposit|dollars|cents|margin)/i.test(schemaBody),
      `${rel}: its schema declares no money field — the model writes sentences, the arithmetic stays in code`,
      schemaBody.match(/(price|total|amount|cost|subtotal|deposit|dollars|cents|margin)/i)?.[0],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
fs.rmSync(fileURLToPath(stubUrl), { force: true });
console.log(fail === 0 ? "\nPASSED — every assertion held\n" : `\nFAILED — ${fail} assertion(s)\n`);
process.exit(fail === 0 ? 0 : 1);
