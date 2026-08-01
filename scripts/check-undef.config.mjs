// scripts/check-undef.config.mjs
//
// A flat ESLint config with ONE job: no-undef. It exists because `next build`
// compiles a module even when it references a name that was never imported —
// the reference only explodes at REQUEST time, as a ReferenceError. That is
// exactly how `accessForCompany is not defined` shipped to production and 500'd
// every authenticated route while every build and check stayed green.
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
const stub = (names) => ({ rules: Object.fromEntries(names.map((n) => [n, noop])) });

export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.mjs"],
    plugins: {
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
    rules: { "no-undef": "error" },
  },
];
