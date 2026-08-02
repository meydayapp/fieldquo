// scripts/check-env-docs.mjs
//
// Every environment variable the code reads must appear in docs/VERCEL.md.
//
// A deployment checklist is exactly the kind of document that is accurate on
// the day it's written and quietly wrong three weeks later — and the cost of it
// being wrong is a feature that looks deployed and isn't. This is the same rule
// AGENTS.md applies to schema fields: if you add one, something has to read it.
//
// Runs as part of `npm run build` via check-imports, so a new process.env.X
// cannot ship without landing on the page the owner works from.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SCAN_DIRS = ["app", "lib", "scripts"];
const SCAN_FILES = ["proxy.js", "middleware.js"];
const DOC = "docs/VERCEL.md";

// Set by Vercel itself; documented as "don't set these by hand" rather than as
// rows in the tables, so they're exempt from the row check.
const PLATFORM_PROVIDED = new Set(["NODE_ENV", "VERCEL_URL"]);

// Read ONLY by local operator scripts that never run on Vercel — account
// recovery, one-off maintenance. They are terminal arguments the operator types
// at the moment they run the script, not deployment configuration. Listing them
// in VERCEL.md would be worse than omitting them: it tells the owner to set a
// Vercel env var that does nothing, on the one page they consult to work out why
// a deploy is misbehaving. Exempt, like the platform-provided set above.
const LOCAL_ONLY = new Set(["ADMIN_EMAIL", "NEW_ADMIN_PASSWORD"]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...SCAN_FILES.map((f) => join(ROOT, f)),
];

const used = new Map(); // NAME -> first file that reads it
for (const file of files) {
  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], file.replace(`${ROOT}/`, ""));
  }
}

let doc;
try {
  doc = readFileSync(join(ROOT, DOC), "utf8");
} catch {
  console.error(`\n✗ ${DOC} is missing. It's the deployment checklist — restore it.\n`);
  process.exit(1);
}

const undocumented = [...used]
  .filter(([name]) => !PLATFORM_PROVIDED.has(name))
  .filter(([name]) => !LOCAL_ONLY.has(name))
  .filter(([name]) => !doc.includes(name));

// The other direction: a documented variable nothing reads is a checklist item
// the owner would go and set for no reason. Warned, not failed — a variable can
// legitimately be consumed by a config file this scan doesn't cover.
// Requires an underscore. Every real variable in this project has one, and
// without it the pattern also matches things like the Prisma error code
// `P1001`, which the doc legitimately mentions.
const documented = [...doc.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]);
const orphaned = [...new Set(documented)].filter(
  (name) => !used.has(name) && !PLATFORM_PROVIDED.has(name),
);

if (orphaned.length) {
  console.warn(`\n⚠ ${DOC} lists ${orphaned.length} variable(s) nothing reads:`);
  for (const name of orphaned) console.warn(`    ${name}`);
  console.warn("  Remove them, or they're work the owner does for nothing.");
}

if (undocumented.length) {
  console.error(`\n✗ ${undocumented.length} environment variable(s) are read but not in ${DOC}:\n`);
  for (const [name, file] of undocumented) console.error(`    ${name.padEnd(32)} ${file}`);
  console.error(
    `\n  Add each to ${DOC} with what breaks without it — the symptom, not just\n` +
    `  the name. Someone reading that page is trying to work out why something\n` +
    `  that looks deployed isn't working.\n`,
  );
  process.exit(1);
}

console.log(`✓ env docs: all ${used.size} variables documented in ${DOC}`);
