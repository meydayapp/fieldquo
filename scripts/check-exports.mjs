// scripts/check-exports.mjs
//
// Every named import must name something the target module actually exports.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Three production deploys in a row failed with:
//
//   ./app/app/schedule/page.js:14:1
//   Export tierNote doesn't exist in target module
//
// The commit shipped two CONSUMERS of tierNote and not the function itself.
// The working tree it was built from had the definition, so `npm run build`
// was green locally; the committed tree did not, so Turbopack refused it.
//
// The cost of that gap was not the failed build — it was that the QA tester
// spent a full audit round on a build from ninety minutes earlier, and
// correctly reported that seven RBAC findings were unfixed. They were fixed.
// They were never deployed. A red deploy that nobody looks at is
// indistinguishable from a fix that does not work.
//
// check-imports.mjs already resolves every module SPECIFIER. It passed here,
// because "@/lib/permissions/roleManagement" is a real file. Resolving the
// file and resolving the NAME are two different checks and only one existed.
//
// ── Deliberately conservative ───────────────────────────────────────────────
//
// A checker that cries wolf gets muted, so anything it cannot read with
// certainty it SKIPS and counts. It reports what it skipped rather than
// quietly passing, because "0 problems" over a large skip pile is the same
// false confidence this file exists to remove.
//
// Run: node scripts/check-exports.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXTS = [".js", ".jsx", ".mjs", ".ts", ".tsx"];
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", "public", "prisma",
]);

/**
 * Comments stripped — string and template literals left intact.
 *
 * Two wrong versions preceded this one, which is the point of writing it down.
 *
 * v1 matched imports against raw source and flagged six doc comments that
 * contained the word "import" upstream of an unrelated "from".
 *
 * v2 stripped comments with a regex. `appMessages.js` holds translated
 * sentences, one of which contains the characters that open a block comment,
 * so the strip ate 18,000 lines and `APP_MESSAGES` stopped looking exported.
 * The header on that version claimed "strings left alone". It was not true,
 * and the check reported four confident failures on code that builds.
 *
 * So this is a character scanner. It costs thirty lines and it is right, and
 * the two cheap versions were both wrong in the direction that matters most —
 * failing on correct code, which is how a check gets muted.
 *
 * The `/` disambiguation is the usual heuristic: a slash begins a regex only
 * where an operand cannot appear. Worst case it misreads a division as a regex
 * and skips a few characters — it cannot invent an export.
 */
function decomment(src) {
  let out = "";
  let i = 0;
  let prev = "";
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i++; break; }
        i++;
      }
      prev = quote;
      continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%~^]/.test(prev)) {
      // A regex literal. Consume it so a "/*" or "//" inside cannot start a
      // comment, and a quote inside cannot start a string.
      out += c;
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) { out += src[i]; i++; break; }
        else if (src[i] === "\n") break;
        out += src[i];
        i++;
      }
      prev = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/** Every source file we own. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") && e.name !== ".") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

/** "@/lib/x" or "./x" → an absolute file path, or null if not ours. */
function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // a package — not ours to verify
  for (const ext of ["", ...EXTS]) {
    const cand = base + ext;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  for (const ext of EXTS) {
    const cand = path.join(base, "index" + ext);
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

const exportCache = new Map();

/**
 * What a module exports: { names:Set, hasDefault:bool, starFrom:[specs] }.
 *
 * Regex rather than a parser on purpose — the alternative is adding a build
 * dependency to a repo whose checks are all dependency-free, and the shapes
 * below cover every export form actually written here. Anything unrecognised
 * widens `starFrom`, which makes the module UNKNOWN and skips it. Failing open
 * on a parse we do not trust is the right direction for this check: a missed
 * warning costs a red deploy, a false alarm costs the check's credibility.
 */
function exportsOf(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file);
  if (seen.has(file)) return { names: new Set(), hasDefault: false, unknown: false };
  seen.add(file);

  const src = decomment(fs.readFileSync(file, "utf8"));
  const names = new Set();
  let hasDefault = false;
  let unknown = false;

  if (/^\s*export\s+default\b/m.test(src)) hasDefault = true;

  // export function f / export async function f / export const|let|var x
  for (const m of src.matchAll(
    /^\s*export\s+(?:async\s+)?(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
  ))
    names.add(m[1]);
  for (const m of src.matchAll(
    /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  ))
    names.add(m[1]);
  // export const { a, b } = … — destructured, each binding is an export
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var)\s*\{([^}]*)\}/gm))
    for (const part of m[1].split(","))
      if (part.trim()) names.add(part.split(":").pop().trim());

  // export { a, b as c }  and  export { a } from "./x"
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*(?:from\s*["']([^"']+)["'])?/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      const name = (as[1] || as[0]).trim();
      if (name === "default") hasDefault = true;
      else names.add(name);
    }
  }

  // export * from "./x" — follow it; if we cannot, the module is unknown.
  for (const m of src.matchAll(/export\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*["']([^"']+)["']/g)) {
    if (m[1]) { names.add(m[1]); continue; }
    const target = resolve(m[2], file);
    if (!target) { unknown = true; continue; }
    const sub = exportsOf(target, seen);
    if (sub.unknown) unknown = true;
    for (const n of sub.names) names.add(n);
  }

  const out = { names, hasDefault, unknown };
  exportCache.set(file, out);
  return out;
}

const problems = [];
let checkedImports = 0;
let skippedModules = 0;
const skipped = new Set();

for (const file of walk(ROOT)) {
  if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
  const src = decomment(fs.readFileSync(file, "utf8"));

  // import <default>, { a, b as c } from "spec"   (static only — a dynamic
  // import()'s named access is a property read and fails at runtime, not build)
  for (const m of src.matchAll(
    /^\s*import\s+([^;'"]*?)\s+from\s*["']([^"']+)["']/gm,
  )) {
    const clause = m[1];
    const target = resolve(m[2], file);
    if (!target) continue;
    const mod = exportsOf(target);
    if (mod.unknown) {
      if (!skipped.has(target)) { skipped.add(target); skippedModules++; }
      continue;
    }

    const braces = clause.match(/\{([^}]*)\}/);
    const defaultName = clause.replace(/\{[^}]*\}/, "").replace(/,/g, "").trim();

    if (defaultName && !defaultName.startsWith("*") && !mod.hasDefault) {
      problems.push({
        file, spec: m[2], name: `default (as ${defaultName})`,
      });
    }
    if (braces) {
      for (const part of braces[1].split(",")) {
        const t = part.trim();
        if (!t) continue;
        const name = t.split(/\s+as\s+/)[0].trim();
        checkedImports++;
        if (name === "default") {
          if (!mod.hasDefault) problems.push({ file, spec: m[2], name });
        } else if (!mod.names.has(name)) {
          problems.push({ file, spec: m[2], name });
        }
      }
    }
  }
}

const rel = (p) => path.relative(ROOT, p);
console.log(`\nNamed imports resolved against real exports`);
console.log(`  checked ${checkedImports} named imports`);
if (skippedModules)
  console.log(`  skipped ${skippedModules} module(s) whose exports could not be read with certainty`);

if (problems.length) {
  console.log(`\nFAILED — ${problems.length} import(s) name something that is not exported:\n`);
  for (const p of problems)
    console.log(`  ✗ ${rel(p.file)}\n      imports "${p.name}" from "${p.spec}" — not exported there`);
  console.log(
    `\nThis is the error Turbopack fails the production build with. It does not\n` +
      `always fail locally: a working tree that still holds the definition builds\n` +
      `clean while the committed tree does not.\n`,
  );
  process.exit(1);
}

console.log(`\nPASSED — every named import names a real export\n`);
