// scripts/check-refusal-shape.mjs
//
//   npm run check:refusal-shape
//
// A denial must be a 403 (or a 401, or a 402, or a 404). Never a 500.
//
// ══ The bug this generalises ═══════════════════════════════════════════════
//
// /api/settings/voice/readiness answered HTTP 500 to an unauthenticated
// request in production, where every sibling endpoint answered 401. The cause:
// memberOrRefusalPlain returns a plain `{ error, status }` object — it exists
// for HELPER functions that shape their own reply — and the handler did
// `if (refusal) return refusal`, handing Next something it cannot serialise.
//
// A 500 on an auth failure looks exactly like a broken endpoint, which on that
// endpoint is the worst confusion available: it is the screen somebody opens
// when they already suspect their phone is broken.
//
// ══ The bigger version of the same bug ═════════════════════════════════════
//
// getCurrentMember has three gates that THROW rather than return — the
// impersonation gate (403), the billing gate (402) and the feature gate
// (404/403). Throwing is right; it is what makes them impossible to forget.
// But a route that lets the throw escape gets a Next.js 500 with an empty body,
// so the carefully chosen status never reaches the browser:
//
//   * the 402 that exists precisely because "403 sends people to their admin
//     and 402 sends them to the billing screen" arrived as a 500, which sends
//     them to support;
//   * a HIDDEN feature answered 500 where an unknown path answers 404 — and
//     the difference between those two is exactly the trace `hidden` promises
//     not to leave.
//
// lib/apiMember.js was written for this and its own header says the fix was
// applied to ~35 routes and deferred on "the other ~145… a mechanical
// follow-up with no registry to keep it honest". This file is that registry.
// All 298 routes now resolve their member through it, and the four that
// legitimately do something else are named below with the reason.
//
// ══ Read alongside ═════════════════════════════════════════════════════════
//
// scripts/check-voice-readiness.mjs used to carry the narrow version of the
// `return refusal` assertion. It now defers to this file rather than keeping a
// second copy — the copy is the one that rots (AGENTS.md failure class #4).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";
import { ROOT, routeFiles, decomment, balanced, handlerBodies } from "./tenantScopeScan.mjs";

// lib/apiMember.js imports next/server and lib/currentMember, neither of which
// bare node can load — the first isn't resolvable, the second drags Better Auth
// and a Prisma pool in. Both are stubbed so the refusal SHAPING can be executed
// rather than read, which is the only version of this assertion worth having.
// Same technique and same reason as scripts/check-feature-flags.mjs.
const HOOKS = `
const STUBS = { "@/lib/currentMember": "fq-stub:member", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:member")
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = async (...a) => globalThis.__FQ_MEMBER(...a);" };
  if (url === "fq-stub:next")
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
globalThis.__FQ_MEMBER = async () => ({ id: "m1", companyId: "co" });
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { refusalBody, memberOrRefusal } = await import("@/lib/apiMember");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

// ───────────────────────────────────────────────────────────────────────────
// Routes that resolve a member WITHOUT memberOrRefusal, by name and reason.
//
// The bar is high on purpose. "It has its own try/catch" is not a reason — a
// catch that turns everything into a 500 is the bug, not the fix.
// ───────────────────────────────────────────────────────────────────────────
const RESOLVES_ITS_OWN = {
  "app/api/quotes/received/[token]/route.js":
    "A PUBLIC page that treats a session as optional. `getCurrentMember(request)" +
    ".catch(() => null)` is deliberate: an absent, lapsed or billing-locked " +
    "session means 'you cannot import this', never an error on a page a " +
    "subcontractor's client is allowed to read logged out.",
};

// The helpers that turn a thrown gate into something answerable.
const SHAPERS = ["memberOrRefusal", "memberOrRefusalPlain"];

const files = routeFiles();
console.log(`\nEnumerated ${files.length} API routes from the filesystem`);

// ═══════════════ 1. Nothing calls getCurrentMember bare ════════════════════

console.log("\nEvery route resolves its member through a refusal shaper");

const bare = [];
for (const f of files) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  if (!/\bgetCurrentMember\s*\(/.test(src)) continue;
  if (RESOLVES_ITS_OWN[f]) continue;
  bare.push(f);
}
ok(
  `no route calls getCurrentMember directly (${files.length - bare.length} clean)`,
  bare.length === 0,
  bare,
);

for (const [f, reason] of Object.entries(RESOLVES_ITS_OWN)) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  ok(`${f} still exists and still does`, /\bgetCurrentMember\s*\(/.test(src));
  ok(`${f} gives a reason`, reason.length > 80);
}

// ═══════════════ 2. No refusal is returned as data ═════════════════════════
//
// The original bug, now over every route rather than the files that happen to
// import one helper. Two shapes are refused:
//
//   return refusal;                        ← the plain { error, status } object
//   return { error: "…", status: 403 };    ← the same thing written inline
//
// Both serialise to a 500 from an exported handler. Inside a private helper
// they are correct and common, so this only looks at exported handlers.

console.log("\nNo exported handler returns a refusal as a plain object");

const asData = [];
for (const f of files) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  for (const h of handlerBodies(src)) {
    if (h.name === "(module scope)") continue;
    // `return refusal` is only wrong when `refusal` is the PLAIN object.
    // Several routes name a NextResponse `refusal` — refuseUnlessAdmin returns
    // one — and those are correct. The plain shape comes from exactly one
    // place, so that is what is looked for.
    if (/\bmemberOrRefusalPlain\s*\(/.test(h.text) && /\breturn\s+refusal\s*;/.test(h.text))
      asData.push(`${f} ${h.name}: return refusal`);
    // An inline `{ error, status }`. BOTH keys, because `status` alone is an
    // ordinary field name — a campaign row, a subscription summary — and
    // flagging those would be a check that cries wolf until it is switched off.
    const literal = h.text.match(/\breturn\s+\{[^{}]*\berror\s*:[^{}]*\bstatus\s*:[^{}]*\}/);
    if (literal) asData.push(`${f} ${h.name}: ${literal[0].replace(/\s+/g, " ").slice(0, 70)}`);
  }
}
ok("no handler hands Next an object where a Response belongs", asData.length === 0, asData);

// ═══════════════ 3. The shaper is actually consulted ═══════════════════════
//
// Importing memberOrRefusal and then ignoring its `response` is the same bug
// with the import fixed. Every call site must test the refusal it returns.

console.log("\nEvery shaper call site tests what it returns");

const ignored = [];
for (const f of files) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  // Per enclosing block rather than per N characters: the refusal has to be
  // tested somewhere in the same function, and a character window would either
  // miss a test that sits below a long comment or wave through one in the next
  // handler down.
  const scopes = handlerBodies(src);
  for (const scope of scopes) {
    for (const shaper of SHAPERS) {
      const re = new RegExp(`\\b${shaper}\\s*\\(`, "g");
      let m;
      while ((m = re.exec(scope.text))) {
        const lineStart = scope.text.lastIndexOf("\n", m.index) + 1;
        const decl = scope.text.slice(lineStart, m.index);
        const names = decl.match(/\{([^}]*)\}/);
        if (!names) { ignored.push(`${f}: ${decl.trim()} — not destructured`); continue; }
        // Bind by KEY, not by position: several routes rename the member
        // (`{ member: actor, response }`), and reading the first non-"member"
        // name would pick the alias and then report the file for ignoring it.
        const refusalKey = shaper === "memberOrRefusalPlain" ? "refusal" : "response";
        const entry = names[1]
          .split(",")
          .map((p) => p.trim())
          .find((p) => p.split(":")[0].trim() === refusalKey);
        if (!entry) { ignored.push(`${f}: ${decl.trim()} — ${refusalKey} not bound`); continue; }
        const refusalName = entry.split(":").pop().trim();
        if (!new RegExp(`if\\s*\\(\\s*${refusalName}\\s*\\)`).test(scope.text))
          ignored.push(`${f} ${scope.name}: "${refusalName}" bound but never tested`);
      }
    }
  }
}
ok("no call site drops the refusal on the floor", ignored.length === 0, ignored);

// ═══════════════ 4. permissionErrorResponse is not bypassed ════════════════
//
// A thrown permission error carries `err.status`. A catch that answers with a
// hardcoded 500, or with no status at all, throws that away — and a member who
// is merely not allowed to do something is told the server is broken.

console.log("\nA caught permission error keeps its own status");

const swallowed = [];
for (const f of files) {
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  const re = /\bcatch\s*\(\s*([A-Za-z0-9_]+)\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const body = balanced(src, m.index + m[0].length - 1);
    const name = m[1];
    // Only catches that are ABOUT a permission failure — the ones that read
    // the thrown error's status, or call the shared shaper.
    const isPermission =
      new RegExp(`${name}\\.status`).test(body) ||
      /permissionErrorResponse/.test(body) ||
      /requirePermission|requireLevel|requireToggle/.test(
        src.slice(Math.max(0, m.index - 400), m.index),
      );
    if (!isPermission) continue;
    // A catch that answers 500 is only wrong if it answers ONLY 500. The
    // import routes handle their own typed error with its status and then fall
    // through to a genuine 500 for anything unexpected, which is right — an
    // unexplained failure must stay a 500 and reach the error log.
    const keepsStatus =
      new RegExp(`${name}\\.status`).test(body) || /permissionErrorResponse/.test(body);
    if (/status:\s*500/.test(body) && !keepsStatus)
      swallowed.push(`${f}: catch (${name}) answers 500 and nothing else`);
  }
}
ok("no permission failure is answered with a 500", swallowed.length === 0, swallowed);

// ═══════════════ 5. refusalBody, executed against every gate ═══════════════
//
// Reading it is not enough: the whole point is what a browser receives.

console.log("\nrefusalBody — run against each gate's actual error");

{
  // The impersonation gate (lib/currentMember.js assertReadOnly).
  const err = Object.assign(new Error("You're viewing this account read-only."), {
    status: 403,
  });
  const body = refusalBody(err);
  ok("a read-only refusal keeps its sentence", body.error === err.message);
}
{
  // The billing gate. `billing` has to survive — the banner reads it.
  const err = Object.assign(new Error("Your payment failed."), {
    status: 402,
    billing: { state: "locked", graceEndsAt: null },
  });
  const body = refusalBody(err);
  ok("a billing refusal carries the access state through", body.billing?.state === "locked");
  ok("...and its own message", body.error === "Your payment failed.");
}
{
  // The feature gate, hidden. This one must say NOTHING.
  const err = Object.assign(new Error("Voice is not available on your plan."), {
    status: 404,
    featureKey: "voice",
  });
  const body = refusalBody(err);
  ok("a hidden feature answers exactly what an unknown path answers", body.error === "Not found");
  ok("...and names no key", !JSON.stringify(body).includes("voice"));
  ok("...and leaks no message", !JSON.stringify(body).includes("plan"));
  ok("...and carries nothing else at all", Object.keys(body).join() === "error", body);
}
{
  // The feature gate, locked (visible but unavailable) — this one may explain.
  const err = Object.assign(new Error("Upgrade to use this."), {
    status: 403,
    featureLocked: true,
  });
  const body = refusalBody(err);
  ok("a locked feature is allowed to say so", body.featureLocked === true);
}

// ═══════════════ 6. memberOrRefusal, executed against a throwing gate ══════
//
// The end-to-end version: a gate throws, and what comes back has to be
// something a route can `return` — with the status the gate chose, not a 500.

console.log("\nmemberOrRefusal — a thrown gate becomes a returnable refusal");

const throwing = (err) => {
  globalThis.__FQ_MEMBER = async () => { throw err; };
};

for (const [label, err, expect] of [
  ["billing", Object.assign(new Error("Payment required."), { status: 402, billing: { state: "locked" } }), 402],
  ["read-only support", Object.assign(new Error("Read only."), { status: 403 }), 403],
  ["hidden feature", Object.assign(new Error("Voice."), { status: 404, featureKey: "voice" }), 404],
]) {
  throwing(err);
  const { member, response } = await memberOrRefusal({});
  ok(`${label}: a refusal comes back, not a member`, !member && !!response);
  ok(`${label}: with status ${expect}`, response?.status === expect, response?.status);
}

{
  // No member at all — the ordinary 401.
  globalThis.__FQ_MEMBER = async () => null;
  const { response } = await memberOrRefusal({});
  ok("no session is a 401", response?.status === 401, response?.status);
}
{
  // A genuine bug must NOT be laundered into a tidy refusal. It has to stay a
  // throw so it reaches the error log as a 500.
  globalThis.__FQ_MEMBER = async () => { throw new TypeError("x is not a function"); };
  let rethrown = false;
  try { await memberOrRefusal({}); } catch { rethrown = true; }
  ok("an error with no status is re-thrown, never dressed up as a refusal", rethrown);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
