// scripts/check-missing-imports.mjs
//
// Catches an identifier that is USED in a module and never imported into it.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// A funnel builder page called `embedSnippet(...)` with no import for it. Every
// funnel in the app crashed on open — "this page couldn't load" — and three
// things that should have caught it did not:
//
//   `npm run build` passed. Next compiles a client component; it does not
//   resolve free identifiers inside one, so an undefined function is a runtime
//   ReferenceError and a clean build.
//
//   ESLint passed. `no-undef` is not enabled in this repo's config, and turning
//   it on wholesale means teaching it every browser and Node global first.
//
//   A grep for the symbol "confirmed" the import, because the grep matched the
//   CALL SITE. That is the failure this file really guards against: a check
//   that looks like it passed.
//
// Deliberately narrow. It knows the names this repo exports from lib/ and
// app/data/ and asks only "is a module using one of ours without importing
// it". A general undefined-variable checker is ESLint's job; this is the one
// case that reaches production silently.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["lib", "app"];
const SKIP = new Set(["node_modules", ".next", "public", ".git"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = SOURCE_DIRS.flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
);

// Every named export this repo publishes, and which file publishes it. A name
// exported from more than one place is dropped: it cannot be attributed, and a
// guess would be a false positive on somebody's local helper.
const exportedBy = new Map();
const ambiguous = new Set();
const EXPORT_RE =
  /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(EXPORT_RE)) {
    const name = m[1];
    // Only names distinctive enough to be worth matching on. Single words like
    // `db` or `t` appear as locals everywhere.
    if (name.length < 6) continue;
    if (exportedBy.has(name) && exportedBy.get(name) !== file) ambiguous.add(name);
    else exportedBy.set(name, file);
  }
}
for (const name of ambiguous) exportedBy.delete(name);

const problems = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");

  // What this file brings in, however it brings it in.
  const imported = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["']/g)) {
    for (const part of m[1].split(/[{},]/)) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) imported.add(name);
    }
  }
  for (const m of src.matchAll(/require\(["'][^"']+["']\)/g)) imported.add("__require");

  // What it defines itself, in any form that shadows an import.
  const local = new Set();
  const LOCAL_RE =
    /(?:^|\s)(?:function|class)\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;
  for (const m of src.matchAll(LOCAL_RE)) {
    if (m[1]) local.add(m[1]);
    if (m[2]) local.add(m[2]);
  }
  // Destructuring, including the dynamic form — `const { geocodeAddress } =
  // await import("...")` is a perfectly good import and the first version of
  // this check called six of them missing.
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of m[1].split(",")) {
      const name = part.split(":").pop().trim().replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(name)) local.add(name);
    }
  }
  // Destructured callback parameters — `.then(({ deleteAsset }) => ...)` is
  // an import too, just an awkwardly spelled one.
  for (const m of src.matchAll(/\(\s*\{([^}]*)\}\s*\)\s*=>/g)) {
    for (const part of m[1].split(",")) {
      const name = part.split(":").pop().trim().replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(name)) local.add(name);
    }
  }
  // Function parameters. A helper called `complete` taken as an argument is
  // not a missing import.
  for (const m of src.matchAll(/(?:function\s*[\w$]*\s*|\)\s*=>|\()\s*\(([^)]*)\)/g)) {
    for (const part of (m[1] || "").split(",")) {
      const name = part.trim().split(/[=:\s]/)[0].replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(name)) local.add(name);
    }
  }

  // Strip comments and strings before looking for uses, so a name mentioned in
  // a comment — which is exactly how this file's own docs read — is not a use.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  for (const [name, source] of exportedBy) {
    if (source === file) continue;
    if (imported.has(name) || local.has(name)) continue;
    // A bare CALL: the name as a whole word, not preceded by a dot (which
    // would make it a property), immediately followed by an opening paren.
    //
    // Calls only, and deliberately not JSX. `<Foo` looked like a cheap way to
    // catch a missing component import and instead matched the word "complete"
    // in a sentence that happened to be followed by a closing tag.
    const use = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`, "m");
    if (use.test(code)) {
      problems.push({
        file: path.relative(ROOT, file),
        name,
        from: path.relative(ROOT, source),
      });
    }
  }
}

if (problems.length === 0) {
  console.log(`✓ no missing imports across ${files.length} files`);
  process.exit(0);
}

console.error(`✗ ${problems.length} identifier(s) used without an import:\n`);
for (const p of problems) {
  console.error(`  ${p.file}`);
  console.error(`    uses "${p.name}" — exported by ${p.from}, never imported here\n`);
}
process.exit(1);
