// scripts/check-ai-employee-load.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-ai-employee-load.mjs
//
// /app/settings/ai-employee sat on "Loading…" for ever on the owner's own
// account. "i thought this was completed."
//
// Nothing was missing from the deployment — the page, the three API routes and
// the AiEmployee tables were all live, and the routes answered. What was wrong
// was the SCREEN, in exactly the way AGENTS.md names: a control that appears to
// work and does not.
//
//   1. `load()` returned early on a bad status without setting `data`, and the
//      render guard was `loading || !form || !data`. A REFUSED load and a load
//      still in flight therefore drew the identical frame. The spinner WAS the
//      error state.
//   2. The three loads ran under `Promise.all`, whose rejection skipped the
//      `setLoading(false)` after it — so anything that THREW rather than
//      returning a bad status left `loading` true with no toast at all. That is
//      "nothing happens", precisely as reported.
//   3. A toast is not a screen state. It fades; the page still claims to load.
//
// This file asserts the three halves separately, because each fails on its own.
// Source is read with comments STRIPPED — every one of these bugs is now
// described in a comment on the page, and scanning raw source would let the
// write-up of the bug match as the bug.

import { readFileSync } from "node:fs";

let pass = 0;
const failures = [];
// Label FIRST — reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const page = stripComments(read("app/app/settings/ai-employee/page.js"));

// ── 1. Failed and still-loading are two states ────────────────────────────
ok(
  "the loading guard no longer swallows a failed load",
  !/if\s*\(\s*loading\s*\|\|\s*!form\s*\|\|\s*!data\s*\)/.test(page),
);
ok(
  "a failed load has its own render branch",
  /if\s*\(\s*loadError\s*\|\|\s*!form\s*\|\|\s*!data\s*\)/.test(page),
);
ok(
  "the spinner branch is now `loading` alone",
  /if\s*\(\s*loading\s*\)\s*\{/.test(page),
);

// ── 2. A throw cannot strand the screen ───────────────────────────────────
ok(
  "one failing load cannot strand the other two",
  /Promise\.allSettled/.test(page) && !/Promise\.all\(\s*\[\s*load\(\)/.test(page),
);
ok(
  "loading is cleared in a finally, not after the await",
  /finally\s*\{\s*setLoading\(false\);?\s*\}/.test(page),
);
ok(
  "the main load catches its own throw",
  /catch\s*\(\s*err\s*\)\s*\{[\s\S]{0,200}?setLoadError/.test(page),
);

// ── 3. The reason reaches the page, not just a toast ──────────────────────
//
// reportResponseError's THREE-argument form puts the sentence in the page's
// own error state as well as toasting it. The two-argument form only toasts,
// which is what left the screen claiming to load after the toast faded.
ok(
  "a refusal is written into the page's error state",
  /reportResponseError\(\s*res\s*,\s*setLoadError\s*,/.test(page),
);
ok(
  "the error state offers a way back",
  /onClick=\{loadAll\}/.test(page),
);
ok(
  "and says nothing was lost, because a contractor will assume it was",
  /loadErrorHelp/.test(page),
);

// A check that asserts nothing exits 0 and proves nothing. This one has been
// gutted by an edit before — the regexes above all live on one file's shape.
ok("this file actually ran its assertions", pass > 0);


console.log(`check-ai-employee-load: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
