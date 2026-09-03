// scripts/check-job-page-hooks.mjs
//
// Guards the job-detail page tree (/app/jobs/<id>) against the two shapes that
// produce React error #310, "Rendered more hooks than during the previous
// render" — the crash that took the whole page down behind its error boundary.
//
// The bug that prompted this: JobPhotoTimeline.js grew a `useMemo` BELOW its
// `if (loading) return <skeleton/>` early return. The first render (photos not
// fetched yet, loading true) bailed out before reaching the hook; the render
// after the fetch landed reached it. One extra hook on the second render is
// exactly #310. Nothing was statically obvious — the hook was not indented
// inside an `if`, and it was not after an *unconditional* return — which is
// why a scan for "hook after a return" that ignores function scope missed it.
//
// ── WHAT THIS CANNOT PROVE ───────────────────────────────────────────────────
//
// HOOK ORDER IS A RUNTIME PROPERTY. This file catches two SHAPES; it does not
// and cannot decide the class. Specifically it will NOT catch:
//
//   * a custom hook (useTranslation, usePermissions, anything under
//     app/hooks/) that internally calls hooks conditionally — the violation
//     lives in that hook's own file, not in the job tree this script walks;
//   * a hook count that differs between two branches of a `&&` or a ternary
//     that picks between two DIFFERENT components — each component is
//     individually well-formed; the mount/unmount is what changes;
//   * a hook inside a loop or a recursion whose iteration count varies;
//   * a third-party component that violates the rules internally;
//   * anything reached by dynamic dispatch (`const C = MAP[kind]`).
//
// `react-hooks/rules-of-hooks` in eslint.config.mjs is the real check and is a
// strict superset of this one for everything it can see — it is what actually
// found the bug above. This script exists because it is cheap, runs inside
// check:all (which the build already gates on) and states its scope honestly,
// NOT because passing it means the tree is free of hook-order bugs. It is a
// tripwire for a regression whose exact shape has already shipped once.
//
// ── Method ───────────────────────────────────────────────────────────────────
//
// Real AST, via espree with JSX enabled. An earlier version of this script
// hand-rolled a string/comment blanker and brace matcher, and it PASSED on the
// very file it was written to catch: JSX prose containing `you'd` and `job's`
// read as string delimiters, which swallowed the braces that would have
// delimited the component body. That failure is the reason this uses a parser.
// If you extend this file, mutation-test it — reintroduce the bug and watch it
// go red — because a hook checker that silently passes is worse than none.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const espree = require("espree");

const ROOT = new URL("..", import.meta.url).pathname;

// The job-detail render tree. Kept explicit rather than crawled from imports:
// a crawl would drag in the whole shared component library, where a different
// team's conventions would make this check either noisy or meaningless.
const ROOTS = [join(ROOT, "app/app/jobs"), join(ROOT, "app/components/jobs")];

const isHookName = (n) => /^use[A-Z]/.test(n || "");
const isComponentName = (n) => /^[A-Z]/.test(n || "");

const FN_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js") || entry.endsWith(".jsx")) out.push(full);
  }
  return out;
}

// Generic AST walk. `enter` returns false to skip a subtree.
function visit(node, enter) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) visit(n, enter);
    return;
  }
  if (typeof node.type !== "string") return;
  if (enter(node) === false) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    visit(node[key], enter);
  }
}

// The name a function is known by: its own id, or the variable / property it
// is assigned to. React itself uses the capitalised name as the component
// signal, so this mirrors that.
function nameOf(node, parent) {
  if (node.id?.name) return node.id.name;
  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }
  if (parent?.type === "Property" && parent.key?.type === "Identifier") {
    return parent.key.name;
  }
  // `export default function () {}` / `memo(() => {})` etc. — unnamed.
  return null;
}

// Every function in the file, paired with the name it is known by. Parents are
// tracked so an arrow assigned to a const still gets a name.
function collectFunctions(ast) {
  const out = [];
  const stack = [];
  visit(ast, (node) => {
    // `visit` is depth-first but does not tell us when it leaves a node, so
    // the parent is recovered by checking containment against the stack.
    while (
      stack.length &&
      !(node.range[0] >= stack.at(-1).range[0] && node.range[1] <= stack.at(-1).range[1])
    ) {
      stack.pop();
    }
    const parent = stack.at(-1) || null;
    if (FN_TYPES.has(node.type)) {
      out.push({ node, name: nameOf(node, parent) });
    }
    stack.push(node);
  });
  return out;
}

// Nodes of interest inside ONE function's own scope — the walk deliberately
// does not descend into nested functions. That distinction is the whole point:
// a `return` inside `if (loading) { … }` is a component return, while a
// `return` inside a `useCallback(async () => { … })` is not, and treating them
// alike makes this check either blind or unusably noisy.
function ownScope(fn) {
  const returns = [];
  const hooks = [];
  const body = fn.body;
  visit(body, (node) => {
    if (node !== body && FN_TYPES.has(node.type)) return false; // don't descend
    if (node.type === "ReturnStatement") returns.push(node);
    if (node.type === "CallExpression") {
      const c = node.callee;
      const n =
        c?.type === "Identifier"
          ? c.name
          : c?.type === "MemberExpression" && c.property?.type === "Identifier"
            ? c.property.name
            : null;
      if (isHookName(n)) hooks.push({ node, name: n });
    }
  });
  return { returns, hooks };
}

const failures = [];
const scanned = [];

for (const dir of ROOTS) {
  for (const file of walk(dir)) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, "utf8");
    let ast;
    try {
      ast = espree.parse(src, {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        range: true,
        loc: true,
      });
    } catch (err) {
      // A parse failure must never read as a pass.
      failures.push(`${rel}  could not be parsed: ${err.message}`);
      continue;
    }
    scanned.push(rel);

    const fns = collectFunctions(ast);
    // Components and custom hooks — the two kinds of function React applies
    // the rules of hooks to.
    const subjects = fns.filter(
      (f) => isComponentName(f.name) || isHookName(f.name),
    );

    for (const subject of subjects) {
      const { node: fn, name } = subject;

      // ── Rule 1: no component defined inside another component's body ──────
      // A component redeclared on every render gets a fresh identity, so React
      // unmounts and remounts it, and its hook count is compared against a
      // different component's. Silent while the tree is stable; #310 the
      // moment the parent re-renders with different data.
      if (isComponentName(name)) {
        for (const other of fns) {
          if (other.node === fn) continue;
          if (!isComponentName(other.name)) continue;
          const inside =
            other.node.range[0] > fn.range[0] && other.node.range[1] <= fn.range[1];
          if (!inside) continue;
          // Only report the innermost enclosing component, so one nested
          // component in a three-deep tree is one failure, not three.
          const nearer = fns.some(
            (mid) =>
              mid.node !== fn &&
              mid.node !== other.node &&
              isComponentName(mid.name) &&
              mid.node.range[0] > fn.range[0] &&
              mid.node.range[1] <= fn.range[1] &&
              other.node.range[0] > mid.node.range[0] &&
              other.node.range[1] <= mid.node.range[1],
          );
          if (nearer) continue;
          failures.push(
            `${rel}:${other.node.loc.start.line}  component "${other.name}" is ` +
              `defined inside component "${name}". Hoist it to module scope — ` +
              `a component redeclared each render remounts, and its hook count ` +
              `is compared against a different component's.`,
          );
        }
      }

      // ── Rule 2: no hook after a return, in the function's OWN scope ───────
      // This is the shape that shipped.
      const { returns, hooks } = ownScope(fn);
      if (!returns.length || !hooks.length) continue;
      const firstReturn = returns.reduce((a, b) =>
        a.range[0] <= b.range[0] ? a : b,
      );
      for (const h of hooks) {
        if (h.node.range[0] <= firstReturn.range[0]) continue;
        failures.push(
          `${rel}:${h.node.loc.start.line}  hook "${h.name}" is called after a ` +
            `return in "${name}" (return at line ${firstReturn.loc.start.line}). ` +
            `Every hook must run before the first return, on every render — a ` +
            `render that takes the early path calls fewer hooks, and React ` +
            `throws #310 on the next one. Hoist the hook above the return and ` +
            `render a loading or empty state instead.`,
        );
        break; // one report per function is enough to act on
      }
    }
  }
}

if (failures.length) {
  console.error("check-job-page-hooks: FAIL\n");
  for (const f of failures) console.error("  " + f);
  console.error(
    `\n${failures.length} problem(s) across ${scanned.length} file(s). This ` +
      `check proves only the two shapes named in its header — see ` +
      `react-hooks/rules-of-hooks for the rest.`,
  );
  process.exit(1);
}

console.log(
  `check-job-page-hooks: OK — ${scanned.length} files, no nested components ` +
    `and no hooks after a return in the job-page tree.`,
);
