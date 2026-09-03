// scripts/check-hooks.config.mjs
//
// One rule, repo-wide: react-hooks/rules-of-hooks.
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

export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    plugins: {
      "react-hooks": reactHooks,
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
    },
  },
];
