// scripts/check-undef.config.mjs
//
// A flat ESLint config with two jobs, both of the same shape: a name that is
// there at compile time and missing at RUN time.
//
// no-undef — `next build` compiles a module even when it references a name that
// was never imported; the reference only explodes at REQUEST time, as a
// ReferenceError. That is exactly how `accessForCompany is not defined` shipped
// to production and 500'd every authenticated route while every build and check
// stayed green.
//
// no-use-before-define — the same failure one step subtler. The quote detail
// page did this:
//
//     const money = moneyFormatter(quote?.company?.currency, language);
//     ...
//     const [quote, setQuote] = useState(null);
//
// `quote` is read eleven lines before the line that declares it. That is a
// temporal dead zone, and the `?.` reads as a guard but is not one — optional
// chaining protects against null, not against touching a `const` binding that
// does not exist yet. The build was green, no-undef was green (the name IS
// defined, just later), and the page threw "Cannot access 'A' before
// initialization" and rendered nothing at all.
//
// ESLint's own no-use-before-define is the wrong tool: with `variables: true`
// it flags 88 places in this repo, and almost all of them are a `const` arrow
// referenced inside a function BODY that runs long after module init. Those are
// fine, idiomatic, and unfixable without pointless reordering — the rule would
// be switched off within a week, and the one real bug would go with it.
//
// So `local/no-tdz-read` below is written to catch only what actually throws: a
// read that EXECUTES before the declaration does, because it sits in the same
// function body rather than inside a nested one. That is the difference between
// the two, and it is the whole reason ESLint's version is unusable here.
//
// Run via `npm run check:undef` (part of check:all). Globals are listed
// explicitly rather than pulled from the `globals` package so this has no extra
// dependency and no version drift.
const GLOBALS = [
  // node
  "process", "Buffer", "__dirname", "__filename", "module", "require", "exports", "global", "globalThis",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "queueMicrotask",
  "console", "URL", "URLSearchParams", "TextEncoder", "TextDecoder", "performance", "structuredClone",
  // web / fetch / edge
  "fetch", "Headers", "Request", "Response", "FormData", "Blob", "File", "ReadableStream", "WritableStream",
  "AbortController", "AbortSignal", "crypto", "atob", "btoa", "Event", "CustomEvent", "EventTarget",
  "WebSocket", "MessageChannel", "MessagePort", "DOMException", "Intl",
  // browser
  "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage",
  "MutationObserver", "IntersectionObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame",
  "Image", "HTMLElement", "Node", "Element", "getComputedStyle", "matchMedia", "alert", "confirm", "prompt",
  "FileReader", "DataTransfer", "CSS", "Audio", "screen", "devicePixelRatio",
  // react/jsx (classic + automatic runtime references)
  "React", "JSX",
];

// No-op stubs for the rule names that appear in inline `eslint-disable`
// directives across the repo. Flat ESLint errors ("Definition for rule X was
// not found") on a disable comment naming a rule the active config doesn't
// know — so this check has to recognise them, without dragging in the full
// next / react-hooks plugin machinery it has no use for. Keep in sync with:
//   grep -rho 'eslint-disable[a-z-]* .*' app lib scripts | grep -oE '\S+/\S+'
const noop = { create: () => ({}) };

/**
 * Read of a `const`/`let` that runs BEFORE its declaration does.
 *
 * The distinction ESLint's no-use-before-define cannot make: a reference from
 * inside a nested function is deferred and harmless, because that function is
 * called after the module (or the component) has finished evaluating. A
 * reference in the SAME function body is not — it executes in source order, and
 * hits the temporal dead zone.
 *
 * So: walk up from the reference's scope to its nearest FUNCTION scope, and
 * compare it with the declaration's. Same one, and the reference is earlier?
 * That throws at runtime, every time, on every render.
 */
const nearestFunctionScope = (scope) => {
  let s = scope;
  while (s && s.type !== "function" && s.type !== "module" && s.type !== "global") {
    s = s.upper;
  }
  return s;
};

const noTdzRead = {
  create(context) {
    return {
      "Program:exit"() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const walk = (scope) => {
          for (const variable of scope.variables) {
            const def = variable.defs[0];
            if (!def || def.type !== "Variable") continue;
            if (def.parent?.kind === "var") continue; // var is hoisted, not TDZ
            const declEnd = def.name.range[1];
            const declScope = nearestFunctionScope(variable.scope);
            for (const ref of variable.references) {
              if (!ref.isRead()) continue;
              if (ref.identifier.range[0] >= declEnd) continue;
              if (nearestFunctionScope(ref.from) !== declScope) continue;
              context.report({
                node: ref.identifier,
                message:
                  `'{{name}}' is read here but declared on line {{line}}. That is a ` +
                  `temporal dead zone — it throws "Cannot access '{{name}}' before ` +
                  `initialization" at runtime. Optional chaining does not help.`,
                data: { name: variable.name, line: String(def.name.loc.start.line) },
              });
            }
          }
          scope.childScopes.forEach(walk);
        };
        walk(sourceCode.scopeManager.globalScope);
      },
    };
  },
};
const stub = (names) => ({ rules: Object.fromEntries(names.map((n) => [n, noop])) });

export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    plugins: {
      local: { rules: { "no-tdz-read": noTdzRead } },
      "@next/next": stub(["no-img-element"]),
      react: stub(["no-danger"]),
      "react-hooks": stub(["exhaustive-deps"]),
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      // Many client-facing .js files (documentSections, payslip/plan PDFs) hold
      // JSX — the parser has to be told, or every one of them is a parse error.
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: Object.fromEntries(GLOBALS.map((g) => [g, "readonly"])),
    },
    // The stubbed plugin rules above are no-ops, so their inline disable
    // directives read as "unused". That's expected here — this config only
    // cares about no-undef — so don't flag them.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "no-undef": "error",
      "local/no-tdz-read": "error",
    },
  },
];
