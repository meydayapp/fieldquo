// scripts/check-feature-flags.mjs
//
//   npm run check:features
//
// A feature flag has to gate something real, and turning it off has to actually
// turn it off.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// AGENTS.md lists "feature flags for features that don't exist" as a recurring
// failure class, and "hiding buttons is not access control" as a
// non-negotiable. A registry is the perfect vehicle for both mistakes: a key
// nobody reads looks exactly like a key that works, and a nav filter looks
// exactly like a permission.
//
// So the two things this asserts hardest are:
//
//   1. EVERY registry key has a real consumer. A key that gates nothing fails.
//   2. EVERY page and API prefix a feature CLAIMS to gate actually calls the
//      guard. Nav-only gating fails.
//
// Everything else follows from those.
//
// ══ Executed, not read, wherever it can be ════════════════════════════════
//
// The resolution rules, the path matcher, the nav filter, the API guard and the
// rent decision are all run for real — the guard against a stubbed database that
// returns the rows this file chooses, so "a malformed override fails closed" is
// demonstrated rather than asserted about source. Only the couplings with no
// single call site (which files mount which gate) are read from disk.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-feature-flags.mjs

import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let fail = 0;
let checks = 0;
const ok = (cond, msg, detail) => {
  checks++;
  console.log((cond ? "✓ " : "✗ ") + msg);
  if (!cond) {
    fail++;
    if (detail) console.log(`    ${detail}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   A stubbed database, and a stubbed session
   ═══════════════════════════════════════════════════════════════════════════

   The gate's job is to turn ROWS into a verdict, so the rows have to be under
   this file's control. `__FQ_ROWS` is swapped between scenarios; the stub reads
   it live rather than closing over a snapshot, or every scenario after the first
   would be testing the first one's data.

   Everything not modelled answers with a shrug — the gate's module graph reaches
   the error log and the email sender, and neither is what this file is about. */

globalThis.__FQ_ROWS = { globals: [], overrides: [] };

function makeDb() {
  const base = {
    platformFeature: {
      async findMany() {
        return globalThis.__FQ_ROWS.globals;
      },
    },
    companyFeatureOverride: {
      async findMany() {
        return globalThis.__FQ_ROWS.overrides;
      },
    },
    company: {
      async findUnique() {
        return { id: "co", name: "Test Co" };
      },
    },
    // checkSpend reports the balance alongside its verdict so the UI can say
    // WHY, so the ledger has to answer even on the paths that refuse before
    // looking at money. A fixed, generous balance: every assertion here is about
    // availability, and a balance that could be the reason for a "no" would make
    // those assertions prove nothing.
    voiceCreditEntry: {
      async aggregate() {
        return { _sum: { cents: 100000 } };
      },
    },
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return new Proxy({}, { get: () => async () => null });
    },
  });
}

globalThis.__FQ_DB = makeDb();

// Swap "@/lib/db" for the stub, and "@/lib/currentMember" for one that returns
// whatever the scenario sets — the second so lib/apiMember.js can be imported
// and EXECUTED without dragging Better Auth and a Prisma pool into a bare node
// process. Registered after alias-loader's hook; hooks run most-recent-first, so
// this one wins for the two specifiers it cares about and defers on the rest.
globalThis.__FQ_MEMBER = async () => ({ id: "m1", companyId: "co", role: "owner" });

// "next/server" is stubbed too — bare node can't resolve it, and the only thing
// this file needs from it is NextResponse.json, whose entire contract here is
// "remember the body and the status". Using the real one would drag the whole
// Next server runtime into a script that is testing a JSON shape.
const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return {
      format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
    };
  }
  if (url === "fq-stub:member") {
    return {
      format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);",
    };
  }
  if (url === "fq-stub:next") {
    return {
      format: "module", shortCircuit: true,
      source:
        "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
    };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const registry = await import("@/lib/features/registry");
const gate = await import("@/lib/features/gate");
const navLib = await import("@/lib/features/nav");
const apiMember = await import("@/lib/apiMember");
const spend = await import("@/lib/voice/spendGate");

const {
  FEATURES,
  FEATURE_KEYS,
  FEATURE_STATES,
  CLOSED_STATE,
  resolveFeature,
  normaliseState,
  assertKnownFeature,
  isKnownFeature,
  featureForApiPath,
  featureForRoutePath,
  featureForNavKey,
  isAvailable,
  isVisible,
} = registry;

const setRows = (globals, overrides) => {
  globalThis.__FQ_ROWS = { globals, overrides };
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. The registry is a closed, well-formed list
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The registry itself ─────────────────────────────────────────\n");

ok(FEATURES.length > 0, `the registry is not empty (${FEATURES.length} features)`);
ok(
  new Set(FEATURE_KEYS).size === FEATURE_KEYS.length,
  "every key is unique",
);
ok(
  FEATURE_KEYS.every((k) => /^[a-z][a-z0-9_]*$/.test(k)),
  "every key is snake_case",
  FEATURE_KEYS.filter((k) => !/^[a-z][a-z0-9_]*$/.test(k)).join(" "),
);
ok(
  FEATURES.every((f) => FEATURE_STATES.includes(f.defaultState)),
  "every defaultState is one of the four states",
);
ok(
  FEATURES.every((f) => f.label && f.blurb),
  "every feature has a label and a blurb for the console",
);
ok(
  Object.isFrozen(FEATURES) && FEATURES.every((f) => Object.isFrozen(f)),
  "the registry is frozen — nothing at runtime can add an entry",
);

// A feature that claims to gate NOTHING is the flag-without-a-feature shape.
for (const f of FEATURES) {
  ok(
    f.routePrefixes.length + f.apiPrefixes.length > 0,
    `${f.key} claims at least one page or API prefix`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Every key has a real consumer  ← the direct guard against failure class #8
   ═══════════════════════════════════════════════════════════════════════════

   "Consumer" is defined narrowly on purpose: a mention in a comment, or in the
   platform console that merely RENDERS the registry, is not a consumer. It has
   to be a gate mount or a guard call — something that changes behaviour. */

console.log("\n── Every key gates something real ──────────────────────────────\n");

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walk(rel, out);
    } else if (/\.(js|jsx|mjs)$/.test(e.name)) {
      out.push(rel);
    }
  }
  return out;
}

const SOURCES = [...walk("app"), ...walk("lib")].filter(
  // The registry declares the keys; it cannot also be the thing that consumes
  // them, or every key would pass by existing.
  (f) => !f.startsWith(path.join("lib", "features")),
);
const SRC = new Map(SOURCES.map((f) => [f, read(f)]));

for (const key of FEATURE_KEYS) {
  const mounts = [];
  for (const [file, src] of SRC) {
    if (new RegExp(`<FeatureGate[^>]*feature=["']${key}["']`).test(src)) {
      mounts.push(`${file} (page gate)`);
    }
    if (
      new RegExp(`(featureAllowsSpend|featureStateFor)\\([^)]*["']${key}["']`).test(src)
    ) {
      mounts.push(`${file} (guard call)`);
    }
  }
  ok(
    mounts.length > 0,
    `${key} has at least one real consumer`,
    `no <FeatureGate feature="${key}"> and no featureAllowsSpend/featureStateFor call. ` +
      `A key nothing reads is a flag for a feature that doesn't exist — delete it, or wire it.`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Every claimed PAGE prefix mounts the gate
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Every claimed page path mounts the page gate ────────────────\n");

for (const f of FEATURES) {
  for (const prefix of f.routePrefixes) {
    const dir = prefix.replace(/^\//, "app/");
    ok(exists(dir), `${prefix} exists on disk`, `expected ${dir}`);
    if (!exists(dir)) continue;

    const layout = path.join(dir, "layout.js");
    ok(exists(layout), `${prefix} has a server layout to hang the gate on`);
    if (!exists(layout)) continue;

    const src = read(layout);
    ok(
      new RegExp(`<FeatureGate[^>]*feature=["']${f.key}["']`).test(src),
      `${prefix} mounts <FeatureGate feature="${f.key}">`,
      "a route prefix the registry claims to gate, that nothing gates",
    );
    ok(
      !src.includes('"use client"') && !src.includes("'use client'"),
      `${prefix}'s gate is a SERVER component`,
      "a client layout cannot read the database, so the gate would be decoration",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Every claimed API prefix routes through the guard
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Every claimed API path routes through the guard ─────────────\n");

const ALL_ROUTES = walk("app/api").filter((f) => path.basename(f) === "route.js");
const routePath = (file) =>
  "/" + path.dirname(file).replace(/^app\//, "").split(path.sep).join("/");

for (const f of FEATURES) {
  const exemptPaths = new Set(f.apiExempt.map((x) => x.path));

  for (const prefix of f.apiPrefixes) {
    const under = ALL_ROUTES.filter((file) => {
      const p = routePath(file);
      return p === prefix || p.startsWith(`${prefix}/`);
    });

    ok(under.length > 0, `${prefix} matches at least one route on disk`);

    for (const file of under) {
      const p = routePath(file);
      if (exemptPaths.has(p)) continue;
      const src = read(file);
      ok(
        /memberOrRefusal(Plain)?\s*\(/.test(src),
        `${p} resolves its member through the guard`,
        "uses getCurrentMember directly, so a refusal escapes as a Next 500 " +
          "instead of the 404/403 the gate chose — and a 500 where an unknown " +
          "path gives 404 is exactly the trace `hidden` must not leave",
      );
      ok(
        !/\bawait getCurrentMember\s*\(/.test(src),
        `${p} does not ALSO call getCurrentMember directly`,
        "two ways in means one of them is ungated",
      );
    }

    // Anything under the prefix that is not covered must be declared exempt.
    const undeclared = under
      .map(routePath)
      .filter((p) => !exemptPaths.has(p) && !/memberOrRefusal/.test(read(
        under.find((file) => routePath(file) === p),
      )));
    ok(
      undeclared.length === 0,
      `${prefix} has no undeclared, ungated routes`,
      undeclared.join(" "),
    );
  }

  // An "exempt" route that DOES take a member isn't exempt — it's gated, and the
  // registry is lying about its own blast radius.
  for (const x of f.apiExempt) {
    const file = ALL_ROUTES.find((r) => routePath(r) === x.path);
    ok(Boolean(file), `${f.key}: exempt route ${x.path} exists on disk`);
    ok(
      Boolean(x.reason) && x.reason.length > 40,
      `${f.key}: exempt route ${x.path} states a real reason`,
    );
    ok(Boolean(x.guard), `${f.key}: exempt route ${x.path} names what guards it instead`);
    if (file) {
      ok(
        !/getCurrentMember|memberOrRefusal/.test(read(file)),
        `${f.key}: ${x.path} really is memberless`,
        "it resolves a member, so it is not exempt — remove it from apiExempt",
      );
    }
  }

  for (const cron of f.cronPaths) {
    ok(
      exists(cron.replace(/^\//, "app/") + "/route.js"),
      `${f.key}: cron ${cron} exists on disk`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The two enforcement points are wired
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Enforcement lives where it says it does ─────────────────────\n");

const currentMemberSrc = read("lib/currentMember.js");
ok(
  /assertFeatureAccess/.test(currentMemberSrc),
  "lib/currentMember.js calls the API-layer gate",
);
ok(
  (currentMemberSrc.match(/await assertFeatureAccess\(/g) || []).length >= 3,
  "…on every return path (primary, fallback and impersonation)",
  `found ${(currentMemberSrc.match(/await assertFeatureAccess\(/g) || []).length}`,
);
ok(
  read("app/components/FeatureGate.js").includes("notFound()"),
  "the page gate 404s rather than redirecting somewhere revealing",
);

// The two feature models are read in ONE place. A second reader is a second
// resolution rule, which is how "companyOverride ?? globalDefault" quietly
// becomes "|| " somewhere nobody looks.
const readers = [...SRC]
  .filter(([f, s]) => /db\.(platformFeature|companyFeatureOverride)\./.test(s))
  .map(([f]) => f);
ok(
  readers.every((f) => f === path.join("app", "api", "platform", "features", "route.js")),
  "only the platform console route touches the feature tables directly",
  readers.join(" "),
);

/* ═══════════════════════════════════════════════════════════════════════════
   6. Resolution order — executed, including the case `||` would swallow
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Resolution: companyOverride ?? global ?? registry default ───\n");

const K = FEATURE_KEYS[0];
const DEF = registry.featureEntry(K).defaultState;

ok(
  resolveFeature({ key: K }).state === DEF &&
    resolveFeature({ key: K }).source === "default",
  "no rows at all → the registry's own default",
);
ok(
  resolveFeature({ key: K, globalRow: { state: "hidden" } }).state === "hidden",
  "a global row wins over the registry default",
);
ok(
  resolveFeature({
    key: K,
    globalRow: { state: "hidden" },
    overrideRow: { state: "preview" },
  }).state === "preview",
  "a company override wins over the global — a beta tester gets in",
);
ok(
  resolveFeature({
    key: K,
    globalRow: { state: "on" },
    overrideRow: { state: "hidden" },
  }).state === "hidden",
  "an override that REFUSES is honoured, not swallowed by the global",
);

// The `||` trap, in the shape this design can actually take it. A boolean flag
// would be `false`; here the equivalent is any override the resolver must not
// silently discard. `undefined` is the ONLY value that means "inherit".
for (const falsy of [false, 0, "", NaN]) {
  const r = resolveFeature({ key: K, globalRow: { state: "on" }, overrideRow: { state: falsy } });
  ok(
    r.state === CLOSED_STATE && r.source === "override",
    `an override row whose state is ${JSON.stringify(falsy)} fails CLOSED and does not inherit "on"`,
    `got ${r.state} from ${r.source}`,
  );
}
ok(
  resolveFeature({ key: K, globalRow: { state: "on" }, overrideRow: undefined }).source ===
    "global",
  "an ABSENT override (undefined) does inherit — absence and refusal stay distinct",
);
ok(
  resolveFeature({ key: K, globalRow: { state: "on" }, overrideRow: null }).source === "global",
  "…and so does a null override row",
);
ok(
  resolveFeature({ key: K, globalRow: { state: "bananas" } }).state === CLOSED_STATE,
  "a malformed GLOBAL row fails closed too",
);

/* Hostile input ───────────────────────────────────────────────────────────── */

console.log("\n── Hostile input fails closed, never open ──────────────────────\n");

for (const bad of ["", "nope", "voice_receptionis", null, undefined, 0, {}, []]) {
  const r = resolveFeature({ key: bad, globalRow: { state: "on" } });
  ok(
    r.state === CLOSED_STATE && r.known === false,
    `unknown key ${JSON.stringify(bad)} resolves hidden, not "on"`,
    `got ${r.state}`,
  );
}
ok(resolveFeature({}).state === CLOSED_STATE, "resolveFeature() with no arguments fails closed");
for (const bad of [null, undefined, 1, true, "ON", " on", {}]) {
  ok(normaliseState(bad) === null, `normaliseState(${JSON.stringify(bad)}) is null`);
}
ok(!isKnownFeature("made_up"), "isKnownFeature refuses an invented key");
let threw = false;
try {
  assertKnownFeature("made_up");
} catch (e) {
  threw = e.status === 400;
}
ok(threw, "assertKnownFeature throws a 400 — the write boundary keeps the list closed");
ok(isAvailable("on") && isAvailable("preview"), "on and preview are usable");
ok(!isAvailable("locked") && !isAvailable("hidden"), "locked and hidden are not usable");
ok(isVisible("locked") && !isVisible("hidden"), "locked is visible, hidden is not");

/* Path matching ──────────────────────────────────────────────────────────── */

console.log("\n── Path matching is segment-aware ──────────────────────────────\n");

ok(featureForApiPath("/api/voice/calls") === "voice_receptionist", "an exact API path matches");
ok(
  featureForApiPath("/api/voice/calls/anything") === "voice_receptionist",
  "a deeper path under the prefix matches",
);
ok(
  featureForApiPath("/api/voicemail-export") === null,
  "a path that merely SHARES A PREFIX STRING does not match",
);
ok(featureForApiPath("/api/marketing/contact") === null, "the public marketing contact form is not gated");
ok(featureForApiPath("/api/marketing/plans") === null, "the public plan list is not gated");
ok(featureForApiPath("/api/ai/quote-suggestions") === null, "AI quote review is not gated by the copilot key");
ok(featureForApiPath("/api/ai/ai-summary") === null, "the dashboard AI summary is not gated by the copilot key");
ok(featureForApiPath("/api/quotes") === null, "an unrelated route is not gated");
for (const bad of [null, undefined, 0, {}, [], ""]) {
  ok(featureForApiPath(bad) === null, `featureForApiPath(${JSON.stringify(bad)}) is null`);
  ok(featureForRoutePath(bad) === null, `featureForRoutePath(${JSON.stringify(bad)}) is null`);
}
ok(featureForRoutePath("/app/settings/voice") === "voice_receptionist", "a settings page path matches");
ok(featureForRoutePath("/app/settings") === null, "the settings index itself is not gated");
ok(featureForRoutePath("/app/quotes") === null, "the pipeline is never gated");

/* ═══════════════════════════════════════════════════════════════════════════
   7. The API guard, run for real
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The API guard, executed ─────────────────────────────────────\n");

const req = (url, method = "GET") => ({ url, method, headers: new Map() });

async function verdict(state, { note = null, url = "/api/voice/calls" } = {}) {
  setRows([{ key: "voice_receptionist", state, note }], []);
  try {
    await gate.assertFeatureAccess({ companyId: "co" }, req(`http://x${url}`));
    return { allowed: true };
  } catch (err) {
    return { allowed: false, status: err.status, message: err.message, err };
  }
}

ok((await verdict("on")).allowed, "state on → the request goes through");
ok((await verdict("preview")).allowed, "state preview → the request goes through");

const hidden = await verdict("hidden");
ok(hidden.status === 404, "state hidden → 404, the same answer an unknown path gives");
const hiddenBody = apiMember.refusalBody(hidden.err);
ok(
  JSON.stringify(hiddenBody) === JSON.stringify({ error: "Not found" }),
  "…and the BODY names nothing at all",
  JSON.stringify(hiddenBody),
);
const hiddenText = JSON.stringify(hiddenBody).toLowerCase();
for (const f of FEATURES) {
  ok(
    !hiddenText.includes(f.key) && !hiddenText.includes(f.label.toLowerCase()),
    `hidden's 404 body leaks neither "${f.key}" nor "${f.label}"`,
  );
}
ok(
  !hiddenText.includes("feature") && !hiddenText.includes("disabled"),
  "…and does not even use the word 'feature' or 'disabled'",
);

const locked = await verdict("locked", { note: "Coming with your next plan." });
ok(locked.status === 403, "state locked → 403, which is meant to be seen");
ok(
  apiMember.refusalBody(locked.err).error === "Coming with your next plan.",
  "…carrying the platform admin's own note as the reason",
);
const lockedNoNote = await verdict("locked");
ok(
  /AI phone receptionist/.test(apiMember.refusalBody(lockedNoNote.err).error),
  "…falling back to the feature's label when no note was written",
);

// The override beats the global here too — the same rule, through the real guard.
setRows(
  [{ key: "voice_receptionist", state: "hidden" }],
  [{ key: "voice_receptionist", state: "on" }],
);
let overrodeOpen = true;
try {
  await gate.assertFeatureAccess({ companyId: "co" }, req("http://x/api/voice/calls"));
} catch {
  overrodeOpen = false;
}
ok(overrodeOpen, "an override of 'on' beats a global 'hidden' through the real guard");

setRows([{ key: "voice_receptionist", state: "on" }], [{ key: "voice_receptionist", state: "hidden" }]);
let overrodeShut = false;
try {
  await gate.assertFeatureAccess({ companyId: "co" }, req("http://x/api/voice/calls"));
} catch (e) {
  overrodeShut = e.status === 404;
}
ok(overrodeShut, "…and an override of 'hidden' beats a global 'on'");

// Malformed rows, through the guard rather than the pure resolver.
setRows([{ key: "voice_receptionist", state: "on" }], [{ key: "voice_receptionist", state: null }]);
let malformedShut = false;
try {
  await gate.assertFeatureAccess({ companyId: "co" }, req("http://x/api/voice/calls"));
} catch (e) {
  malformedShut = e.status === 404;
}
ok(malformedShut, "a malformed override row fails closed through the real guard");

// Rows the database could return that are not rows at all.
setRows([null, 42, { state: "on" }, { key: 7, state: "on" }], []);
const junk = await (async () => {
  try {
    await gate.assertFeatureAccess({ companyId: "co" }, req("http://x/api/voice/calls"));
    return "allowed";
  } catch (e) {
    return e.status;
  }
})();
ok(
  junk === "allowed",
  "junk rows are DROPPED, falling back to the registry default rather than throwing",
  `got ${junk}`,
);

// A route no feature claims is never touched.
setRows([{ key: "voice_receptionist", state: "hidden" }], []);
let untouched = true;
try {
  await gate.assertFeatureAccess({ companyId: "co" }, req("http://x/api/quotes"));
} catch {
  untouched = false;
}
ok(untouched, "an ungated route is unaffected by any feature state");

// No company, no URL: the two shapes getCurrentMember is called with elsewhere.
setRows([{ key: "voice_receptionist", state: "hidden" }], []);
let nullCompany = true;
try {
  await gate.assertFeatureAccess({ companyId: null }, req("http://x/api/voice/calls"));
} catch {
  nullCompany = false;
}
ok(nullCompany, "a member with no company is passed through — 401 is that request's problem, not this gate's");
let noUrl = true;
try {
  await gate.assertFeatureAccess({ companyId: "co" }, { url: "", method: "GET" });
} catch {
  noUrl = false;
}
ok(noUrl, "a server-component call with no URL is passed through to the page gate");

// featureAllowsSpend, the money-path entry point.
setRows([{ key: "voice_receptionist", state: "hidden" }], []);
ok(
  (await gate.featureAllowsSpend("co", "voice_receptionist")) === false,
  "featureAllowsSpend is false when the feature is hidden",
);
setRows([{ key: "voice_receptionist", state: "locked" }], []);
ok(
  (await gate.featureAllowsSpend("co", "voice_receptionist")) === false,
  "…and false when it is locked",
);
setRows([{ key: "voice_receptionist", state: "preview" }], []);
ok(
  (await gate.featureAllowsSpend("co", "voice_receptionist")) === true,
  "…and true in preview: a beta tester's calls are real calls",
);
ok(
  (await gate.featureAllowsSpend("co", "made_up_key")) === false,
  "…and false for a key that isn't in the registry",
);

/* ═══════════════════════════════════════════════════════════════════════════
   8. The nav layer, executed
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The nav layer (cosmetics, asserted anyway) ──────────────────\n");

setRows([], []);
const flags = gate.navFlagsFrom(await gate.featureMapForCompany("co"));
ok(
  FEATURE_KEYS.every((k) => flags[k] && typeof flags[k].state === "string"),
  "navFlagsFrom answers for every registry key",
);
ok(
  FEATURE_KEYS.every((k) => !("note" in flags[k]) && !("source" in flags[k])),
  "…and ships neither the note nor the resolution source to the browser",
);

const GROUPS = [
  { key: "g1", items: [{ key: "app.nav.quotes" }, { key: "app.nav.receptionist" }] },
  { key: "g2", items: [{ key: "app.nav.crewInbox" }] },
];
const hiddenFlags = {
  voice_receptionist: { state: "hidden", visible: false, usable: false },
  crew_inbox: { state: "hidden", visible: false, usable: false },
};
const filtered = navLib.filterNavGroups(GROUPS, hiddenFlags);
ok(
  JSON.stringify(filtered) === JSON.stringify([{ key: "g1", items: [{ key: "app.nav.quotes" }] }]),
  "hidden rows are removed, and a group emptied by that is removed with them",
  JSON.stringify(filtered),
);
ok(
  navLib.filterNavGroups(GROUPS, null).length === 2,
  "null flags leave the menu completely intact — a blank nav is a worse failure",
);
ok(
  navLib.navRowState("app.nav.quotes", hiddenFlags).show === true,
  "a row no feature owns is never hidden",
);
ok(
  navLib.navRowState("app.nav.receptionist", {
    voice_receptionist: { state: "locked" },
  }).show === true,
  "a LOCKED row stays in the menu — it is meant to be seen",
);
ok(
  navLib.navRowState("app.nav.receptionist", { voice_receptionist: { state: "preview" } })
    .state === "preview",
  "a PREVIEW row reports its state so the badge can render",
);

// Every navKey the registry names must be a real row in a real sidebar, and a
// real translated string. A navKey pointing at nothing hides nothing.
const adminSrc = read("app/components/layout/AdminSidebar.js");
const settingsSrc = read("app/components/layout/SettingsSidebar.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
for (const f of FEATURES) {
  for (const navKey of f.navKeys) {
    ok(
      adminSrc.includes(`"${navKey}"`) || settingsSrc.includes(`"${navKey}"`),
      `${f.key}: nav key ${navKey} is a real row in a real sidebar`,
    );
    ok(Boolean(APP_MESSAGES.en[navKey]), `${f.key}: ${navKey} is a translated label`);
    ok(featureForNavKey(navKey) === f.key, `${f.key}: ${navKey} maps back to it`);
  }
}
// Both sidebars must actually apply the filter — a registry full of navKeys and
// a sidebar that ignores them is the "hiding buttons" theatre with none of the
// hiding.
for (const [name, src] of [["AdminSidebar", adminSrc], ["SettingsSidebar", settingsSrc]]) {
  ok(/filterNavGroups\(/.test(src), `${name} filters its groups through the shared helper`);
  ok(/useFeatureFlags\(\)/.test(src), `${name} reads the resolved flags`);
}
ok(
  /filterNavGroups\(SEARCH_CORPUS/.test(adminSrc),
  "the rail's SEARCH box searches the FILTERED corpus",
  "otherwise typing a hidden feature's name surfaces it by name",
);

// The new UI strings exist in all six catalogues.
for (const code of ["en", "fr", "es", "uk", "pa", "tl"]) {
  for (const k of [
    "app.feature.badgePreview",
    "app.feature.badgeLocked",
    "app.feature.previewTitle",
    "app.feature.previewBody",
  ]) {
    ok(Boolean(APP_MESSAGES[code]?.[k]), `${k} is translated into ${code}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Money: what a withdrawn feature does to the voice spend paths
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Money paths when voice is withdrawn ─────────────────────────\n");

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-06-01T12:00:00Z");
const activeNumber = {
  id: "n1",
  companyId: "co",
  status: "active",
  numberType: "local",
  monthlyCents: 400,
  rentPaidThroughAt: new Date(now.getTime() - 5 * DAY), // overdue
  rentGraceUntilAt: null,
  rentWarnedAt: null,
};

// Baseline: the same row, feature available, MUST still charge — otherwise the
// assertions below would pass by the decision being broken for everyone.
ok(
  spend.rentDecision({ number: activeNumber, balanceCents: 10000, now, available: true })
    .action === "charge",
  "baseline: an overdue number with credit is still charged when voice is available",
);
ok(
  spend.rentDecision({ number: activeNumber, balanceCents: 10000, now }).action === "charge",
  "…and `available` defaults to true, so every existing caller is unchanged",
);

const withdrawn = spend.rentDecision({
  number: activeNumber,
  balanceCents: 10000,
  now,
  available: false,
});
ok(withdrawn.action === "skip", "withdrawn: rent is NOT charged");
ok(withdrawn.reason === "feature_unavailable", "…and the reason says why, not 'no rental'");
ok(!("paidThroughAt" in withdrawn), "…and nothing marks a month as paid");

// The release path is the destructive one. A released number cannot be got back.
const expired = {
  ...activeNumber,
  rentGraceUntilAt: new Date(now.getTime() - 1 * DAY),
  rentWarnedAt: new Date(now.getTime() - 4 * DAY),
};
ok(
  spend.rentDecision({ number: expired, balanceCents: 0, now, available: true }).action ===
    "release",
  "baseline: an expired grace period with no credit DOES release",
);
ok(
  spend.rentDecision({ number: expired, balanceCents: 0, now, available: false }).action ===
    "skip",
  "withdrawn: the number is NOT released — FieldQuo's switch must not take a contractor's phone line",
);

// And no warning email either: telling someone to top up for a feature we have
// switched off is a dead control with a stamp on it.
for (const scenario of [
  { number: activeNumber, balanceCents: 0, label: "grace_start" },
  { number: { ...activeNumber, rentPaidThroughAt: new Date(now.getTime() + 1 * DAY) }, balanceCents: 0, label: "warn_soon" },
]) {
  ok(
    spend.rentDecision({ ...scenario, now, available: false }).action === "skip",
    `withdrawn: no ${scenario.label} warning is sent`,
  );
}

// checkSpend refuses provisioning, with a reason topping up cannot fix.
setRows([{ key: "voice_receptionist", state: "hidden" }], []);
const buy = await spend.checkSpend({ companyId: "co", kind: "number_setup" });
ok(!buy.allowed, "withdrawn: buying a number is refused");
ok(
  buy.reason === "feature_unavailable",
  "…with reason feature_unavailable, not insufficient_balance",
  buy.reason,
);
setRows([{ key: "voice_receptionist", state: "on" }], []);
const buyOk = await spend.checkSpend({ companyId: "co", kind: "number_setup" });
ok(
  buyOk.reason !== "feature_unavailable",
  "baseline: with voice available the availability check is out of the way",
);

// The cron and the outbound placer must ASK. Read from source, because the
// assertion is "this call site exists", which has no runtime signature.
ok(
  /featureAllowsSpend/.test(read("lib/voice/spendGate.js")),
  "billNumberRent resolves availability before deciding",
);
ok(
  /featureAllowsSpend/.test(read("lib/voice/outboundCall.js")),
  "placeQueuedCall refuses to dial for a withdrawn company",
);
// The verdict that call site returns, not merely that the call site exists. The
// LAST occurrence, because the first is the import — anchoring on the first was
// this assertion's own first bug, and it failed rather than passing vacuously.
{
  const src = read("lib/voice/outboundCall.js");
  const after = src.slice(src.lastIndexOf("featureAllowsSpend"), src.lastIndexOf("featureAllowsSpend") + 400);
  ok(
    /retryLater:\s*true/.test(after),
    "…and holds the task rather than discarding the queue",
    after.split("\n").slice(0, 8).join("\n    "),
  );
  ok(
    !/terminal:\s*true/.test(after),
    "…and does not mark it terminal — a withdrawal is usually temporary",
  );
}
// The inbound webhook is deliberately NOT gated — the minutes are already spent.
ok(
  !/featureAllowsSpend|memberOrRefusal/.test(read("app/api/voice/webhook/route.js")),
  "the inbound webhook stays ungated: refusing it loses the record without saving a cent",
);

/* ═══════════════════════════════════════════════════════════════════════════
   10. Turning a feature off never deletes anything
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Nothing here can destroy tenant data ────────────────────────\n");

const TENANT_MODELS = [
  "quote", "invoice", "job", "client", "funnel", "marketingCampaign",
  "marketingSubscriber", "companySite", "instantQuoteConfig", "voicePhoneNumber",
  "voiceCall", "voiceCreditEntry", "crewInboundMessage", "jobPhoto", "company",
];
const FEATURE_FILES = [
  "lib/features/registry.js",
  "lib/features/gate.js",
  "lib/features/nav.js",
  "app/components/FeatureGate.js",
  "app/api/platform/features/route.js",
];
for (const file of FEATURE_FILES) {
  const src = read(file);
  const destructive = TENANT_MODELS.filter((m) =>
    new RegExp(`db\\.${m}\\.(delete|deleteMany|updateMany|update|upsert)\\b`).test(src),
  );
  ok(
    destructive.length === 0,
    `${file} never writes to a tenant model`,
    destructive.join(" "),
  );
}
// The console's own deletes are allowed — but only on its own two tables.
const consoleSrc = read("app/api/platform/features/route.js");
const deletes = [...consoleSrc.matchAll(/db\.(\w+)\.delete(Many)?\b/g)].map((m) => m[1]);
ok(
  deletes.every((m) => m === "companyFeatureOverride"),
  "the console only ever deletes an override row — clearing one restores inheritance",
  deletes.join(" "),
);

// Executed rather than grepped: flip a feature hidden and back, and prove the
// resolver's answer is the only thing that moved.
const before = { globals: [{ key: "funnels", state: "on" }], overrides: [] };
setRows(before.globals, before.overrides);
const onMap = await gate.featureMapForCompany("co");
setRows([{ key: "funnels", state: "hidden" }], []);
const offMap = await gate.featureMapForCompany("co");
setRows(before.globals, before.overrides);
const backMap = await gate.featureMapForCompany("co");
ok(
  onMap.funnels.state === "on" && offMap.funnels.state === "hidden" && backMap.funnels.state === "on",
  "a feature toggled off and back on resolves exactly as it did before",
);
ok(
  FEATURE_KEYS.every((k) => onMap[k].state === backMap[k].state),
  "…and no other feature moved with it",
);

/* ═══════════════════════════════════════════════════════════════════════════
   11. The console can't invent a key
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The platform console renders a closed list ──────────────────\n");

ok(
  /assertKnownFeature/.test(consoleSrc),
  "every write validates the key against the registry",
);
ok(
  (consoleSrc.match(/assertKnownFeature/g) || []).length >= 3,
  "…on the global setter AND the override setter, not just one of them",
);
ok(
  /normaliseState\(/.test(consoleSrc),
  "every write validates the state against the four",
);
ok(
  !/req\.body\.key\s*\|\||body\.key\s*\|\|\s*["'][a-z_]+["']/.test(consoleSrc),
  "no default key is invented when the caller omits one",
);
const pageSrc = read("app/platform/features/page.js");
ok(
  !/Add feature|new feature|createFeature/i.test(pageSrc),
  "the console has no 'add a feature' control",
);
ok(
  /data\.features\.map/.test(pageSrc),
  "…it renders exactly the registry the API hands it",
);
ok(
  /requirePlatformPermission/.test(consoleSrc),
  "changing availability needs a platform permission, not merely a session",
);

console.log(
  `\n${checks} checks, ${fail} failure(s).`,
);
process.exit(fail ? 1 : 0);
