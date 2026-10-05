// scripts/check-hooks.config.mjs
//
// Two rules, repo-wide: react-hooks/rules-of-hooks, and an effect returns a
// cleanup function or nothing (fieldquo/effect-returns-cleanup, below).
//
// ── Why a separate config when eslint.config.mjs already has this rule ───────
//
// Because nothing ran it. `eslint.config.mjs` inherits eslint-config-next, so
// `rules-of-hooks` has been ON at error level the whole time — but the build
// line is
//
//     npx eslint app lib --config scripts/check-undef.config.mjs
//
// which uses a DIFFERENT config, and `check:all` invokes no linter at all.
// `npm run lint` exists and is not wired to anything. So the rule was
// configured, enforced nowhere, and a violation shipped: a `useMemo` below an
// `if (loading) return` in app/components/jobs/JobPhotoTimeline.js, which threw
// React error #310 ("Rendered more hooks than during the previous render") and
// took the whole job-detail page down behind its error boundary.
//
// A rule that is configured but never executed is a feature flag for a feature
// that does not exist. This config is the execution.
//
// ── Why not just turn on the full eslint.config.mjs in the build ─────────────
//
// Because the full config currently reports a large number of pre-existing
// errors of OTHER kinds across this repo — react-hooks/set-state-in-effect,
// react/no-unescaped-entities and friends — most of them cosmetic or debatable,
// none of them the class that just crashed production. Wiring all of that into
// the build would either fail it on day one or force a mass edit nobody asked
// for, and the usual outcome is that the whole check gets switched off within
// the week and the one rule that mattered goes with it. Fixing those is real
// work and its own decision; see check-undef.config.mjs, which makes exactly
// the same argument about no-use-before-define.
//
// So: enforce the one rule that maps to a shipped crash, at zero existing
// violations, today. Widening this list later is cheap; un-breaking a build
// everyone has learned to ignore is not.
import reactHooks from "eslint-plugin-react-hooks";

// No-op stubs for rule names that appear in inline `eslint-disable` comments
// across the repo. Flat ESLint hard-errors on a disable directive naming a rule
// the active config does not know — "Definition for rule X was not found" —
// which would drown this check in 60 failures that have nothing to do with
// hooks. Same trick, same reason, as check-undef.config.mjs. Keep in sync with:
//   npx eslint app lib components --config scripts/check-hooks.config.mjs \
//     | grep -oE "Definition for rule '[^']+'" | sort -u
const noop = { create: () => ({}) };
const stub = (names) => ({ rules: Object.fromEntries(names.map((n) => [n, noop])) });

// ── Second rule: an effect returns a cleanup function or nothing ───────────
//
// React calls whatever an effect returns, as its cleanup, on the next change
// of its dependencies and on unmount. `useEffect(() => el.scrollIntoView())`
// returned undefined for years — and then Chrome made scrollIntoView return a
// Promise. The drawing read's chat effect (app/components/planRead/
// PlanReadWorkspace.js) handed that Promise to React, which called it: "i is
// not a function", the whole screen behind its error boundary on every chat
// reply, every price saved, every edit, and on leaving the page for the quote
// builder (the owner's live test, 2026-10-05). Production only — the dev
// build warns and carries on.
//
// So: an effect's arrow without braces, or its `return`, may hand back only
// a function, a variable holding one, a plain function CALL (`load()`,
// `subscribe(fn)` — a helper whose job is to return the cleanup), or nothing.
// A METHOD call's result (`el.scrollIntoView()`, `input.focus()`,
// `promise.then()`) is never a cleanup — browsers change what those return —
// and neither is an async callback (it always returns a Promise).
const EFFECT_HOOK = /^use(?:Layout|Insertion)?Effect$/;
const isFunctionNode = (n) => n && (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression");
const isEffectCall = (call) =>
  call?.type === "CallExpression" &&
  ((call.callee.type === "Identifier" && EFFECT_HOOK.test(call.callee.name)) ||
    (call.callee.type === "MemberExpression" && EFFECT_HOOK.test(call.callee.property?.name || "")));
/** Why a returned expression is not a cleanup, or null when it may be one. */
function notACleanup(expr) {
  if (!expr) return null;
  if (expr.type === "ChainExpression") return notACleanup(expr.expression);
  if (isFunctionNode(expr) || expr.type === "Identifier") return null;
  if (expr.type === "Literal" && expr.value === null) return null;
  if (expr.type === "UnaryExpression" && expr.operator === "void") return null;
  if (expr.type === "CallExpression") return expr.callee.type === "Identifier" ? null : "a method call's result";
  if (expr.type === "LogicalExpression" || expr.type === "ConditionalExpression") {
    return notACleanup(expr.type === "LogicalExpression" ? expr.right : expr.consequent) || notACleanup(expr.alternate || null);
  }
  return `a ${expr.type}`;
}
const effectCleanupRule = {
  meta: { type: "problem", schema: [] },
  create(context) {
    const report = (node, why) =>
      context.report({ node, message: `An effect may return only a cleanup function or nothing — this returns ${why}, which React will call as a function. Use a block body.` });
    return {
      CallExpression(call) {
        if (!isEffectCall(call)) return;
        const cb = call.arguments[0];
        if (!isFunctionNode(cb)) return;
        if (cb.async) return report(cb, "a Promise (an async callback)");
        if (cb.body.type !== "BlockStatement") {
          const why = notACleanup(cb.body);
          if (why) report(cb.body, why);
        }
      },
      ReturnStatement(ret) {
        const ancestors = context.sourceCode.getAncestors(ret);
        const fn = [...ancestors].reverse().find(isFunctionNode) || null;
        if (!fn || !isEffectCall(fn.parent) || fn.parent.arguments[0] !== fn) return;
        const why = notACleanup(ret.argument);
        if (why) report(ret, why);
      },
    };
  },
};

export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    plugins: {
      "react-hooks": reactHooks,
      fieldquo: { rules: { "effect-returns-cleanup": effectCleanupRule } },
      "@next/next": stub(["no-img-element"]),
      react: stub(["no-danger"]),
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // Client components hold JSX; without this every one is a parse error.
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Inline disables in this repo name rules this config does not load
    // (no-img-element, exhaustive-deps). They would otherwise read as unused.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "fieldquo/effect-returns-cleanup": "error",
    },
  },
];
