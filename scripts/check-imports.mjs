// scripts/check-imports.mjs
//
// Catches broken module specifiers before Vercel does.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// A batch of empty stub files was deleted after checking that nothing imported
// them. The check only matched STATIC imports — `from "@/x"` — and missed
// `await import("@/x")` in app/api/templates/route.js. The deploy failed on
// Turbopack's module resolution, which is exactly the failure the check was
// supposed to prevent.
//
// The underlying lesson isn't "remember dynamic imports". It's that a
// correctness check written inline, run once, and thrown away will be written
// slightly differently and slightly wrong the next time. So it lives here and
// runs from package.json.
//
// ── What it does and doesn't cover ──────────────────────────────────────────
//
// Covers: static imports, dynamic import(), require(), and re-exports
// (`export … from`), for both "@/" aliases and relative paths.
//
// Does NOT cover: computed specifiers like import(`@/x/${name}`). Those can't
// be resolved statically by anything, including the bundler, and pretending
// otherwise would produce false confidence. There are none in this codebase
// today; if one appears, it needs a runtime test rather than this.

import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "lib", "prisma", "scripts"];
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel"]);
const EXTS = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx"];

// `from "x"` | `import("x")` | `require("x")` — the quote style is captured so
// the specifier itself can be lifted out cleanly.
const SPECIFIER = /(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;

/**
 * Comments are stripped before scanning.
 *
 * The first version of this script flagged a broken import inside its OWN
 * explanatory comment — the same failure mode as a codemod that rewrites the
 * text it was describing. A scanner that reads prose as code will always find
 * something eventually, and every one of those findings is noise that trains
 * you to ignore real ones.
 *
 * Deliberately naive about strings containing "//": a false NEGATIVE here
 * means one specifier goes unchecked, which the build still catches. A false
 * positive means the check cries wolf, which is how checks get switched off.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolves(spec, fromFile) {
  // Bare package names are npm's problem, not ours.
  if (!spec.startsWith("@/") && !spec.startsWith(".")) return true;

  const base = spec.startsWith("@/")
    ? spec.slice(2)
    : path.join(path.dirname(fromFile), spec);

  return EXTS.some((ext) => fs.existsSync(base + ext));
}

const files = ROOTS.flatMap((r) => walk(r));
const broken = [];

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const seen = new Set();
  for (const [, spec] of src.matchAll(SPECIFIER)) {
    if (seen.has(spec)) continue;
    seen.add(spec);
    if (!resolves(spec, file)) broken.push({ file, spec });
  }
}

if (broken.length) {
  console.error(`\n${broken.length} unresolved import(s):\n`);
  for (const { file, spec } of broken) {
    console.error(`  ${spec}`);
    console.error(`    in ${file}\n`);
  }
  process.exit(1);
}

console.log(`${files.length} files — all imports resolve`);
