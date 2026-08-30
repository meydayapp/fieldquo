"use client";

// app/components/designer/DesignerLoader.js
//
// The intended import point for anything embedding the designer: pages
// should import THIS module, never Editor.js directly.
//
// fabric@5.3.0-browser — the exact package/version pinned in AGENTS.md,
// picked over the default `fabric` package precisely because it has no
// node-canvas binding — touches `window`/`document` at import time. Next's
// SSR pass evaluates component modules on the server, where neither exists,
// so importing Editor.js (or anything in its tree — every hook here imports
// "fabric") from a server-rendered path crashes the render.
//
// `next/dynamic` with `{ ssr: false }` is the fix: it defers the import to
// the browser entirely, after hydration, so the server render never touches
// fabric. This is not a perf optimisation here, it's the only way this
// component doesn't crash SSR — see scripts/check-designer.mjs, which
// asserts this file exists and every module that imports "fabric" is marked
// "use client".
import dynamic from "next/dynamic";

const DesignerEditor = dynamic(
  () => import("@/app/components/designer/Editor").then((mod) => mod.Editor),
  { ssr: false },
);

export default DesignerEditor;
