// scripts/check-construction-checklists.mjs
//
//   npm run check:construction-checklists
//
// Static guard over the construction checklist library. Runs with no database
// so it can sit in the build.
//
// The failure this exists to catch: a checklist in the bundle with no entry in
// the seed's MAP is dropped on the floor. The seed throws on it, but the seed
// only runs when somebody remembers to run it — and a checklist that never
// reaches a category is invisible in the picker forever while everything else
// reports success. That is the quiet version of the dead-control failure: the
// library says 88 and the app offers 83.
import { readFileSync } from "node:fs";
import { tradeKeys } from "@/lib/trades/catalog";

const BUNDLE = "prisma/data/construction-checklists.json";
const SEED = "prisma/seed-construction-checklists.js";
// The catalogue is a module now (lib/trades/catalog.js), imported below rather
// than grepped. It was grepped out of prisma/seed.js, and when the list moved
// the substring test matched nothing and reported every key missing.
const CATALOGUE_KEYS = new Set(tradeKeys());

let pass = 0;
const failures = [];
const ok = (label) => { pass += 1; console.log(`  ok   ${label}`); };
const bad = (label, detail) => {
  failures.push(label);
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
};

const bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
const seed = readFileSync(SEED, "utf8");

// ── Parse the MAP out of the seed ─────────────────────────────────────────
// Read as text rather than imported, because importing the seed opens a
// database connection and this check has to run in CI without one.
const mapBlock = seed.match(/const MAP = \{([\s\S]*?)\n\};/)?.[1] || "";
const MAP = {};
for (const m of mapBlock.matchAll(
  /"([a-z0-9-]+)":\s*\[\s*"([a-z_]+)",\s*"(pre|during|post)",?\s*\]/g,
)) {
  MAP[m[1]] = [m[2], m[3]];
}

console.log("\nConstruction checklist library\n");

const ids = bundle.templates.map((t) => t.id);

if (ids.length === 88) ok(`bundle holds 88 checklists`);
else bad(`bundle holds 88 checklists`, `found ${ids.length}`);

const unmapped = ids.filter((id) => !MAP[id]);
if (unmapped.length === 0) ok("every checklist is filed under a trade");
else bad("every checklist is filed under a trade", `unmapped: ${unmapped.join(", ")}`);

const orphans = Object.keys(MAP).filter((id) => !ids.includes(id));
if (orphans.length === 0) ok("no mapping points at a checklist that doesn't exist");
else bad("no mapping points at a checklist that doesn't exist", orphans.join(", "));

// Every trade key must be a real seeded ServiceCategory, or the checklist
// lands with a null category and never appears in the picker.
const keys = [...new Set(Object.values(MAP).map(([k]) => k))];
const missingKeys = keys.filter((k) => !CATALOGUE_KEYS.has(k));
if (missingKeys.length === 0)
  ok(`all ${keys.length} trade keys exist in the service catalogue`);
else
  bad("all trade keys exist in the service catalogue", `missing: ${missingKeys.join(", ")}`);

// ── The namespace collision that already happened once ────────────────────
// seed-checklists.js owns "<categoryKey>:<phase>". If this library ever went
// back to a bare "construction:" prefix, a startsWith query would rake in the
// three residential New Construction lists alongside it.
if (seed.includes("`construction-library:${template.id}`"))
  ok("systemKey namespace can't collide with the residential trade lists");
else
  bad(
    "systemKey namespace can't collide with the residential trade lists",
    "expected the `construction-library:` prefix",
  );

// ── The detail is the point ───────────────────────────────────────────────
// If a future edit flattened these to bare labels, the import would still
// "work" and the library would be worth nothing.
let items = 0, criteria = 0, sections = new Set(), critical = 0, measured = 0;
for (const t of bundle.templates) {
  for (const s of t.sections || []) {
    if (s.name) sections.add(`${t.id}|${s.name}`);
    for (const i of s.items || []) {
      items += 1;
      if (i.acceptance_criteria) criteria += 1;
      if (i.critical) critical += 1;
      if (i.response_type === "numeric") measured += 1;
    }
  }
}

if (items === 2491) ok(`2,491 items present`);
else bad("2,491 items present", `found ${items}`);

if (sections.size === 579) ok(`579 sections present`);
else bad("579 sections present", `found ${sections.size}`);

if (criteria === items)
  ok("every item states an objective acceptance criterion");
else
  bad(
    "every item states an objective acceptance criterion",
    `${items - criteria} item(s) have none — a check with no threshold is a tick nobody can fail`,
  );

if (critical > 0) ok(`${critical} hold points are marked critical`);
else bad("hold points are marked critical", "none found");

if (measured > 0) ok(`${measured} items are recorded as measurements, not ticks`);
else bad("items are recorded as measurements", "none found");

console.log(
  `\n${pass + failures.length} checks, ${failures.length} failure(s).\n`,
);
if (failures.length) process.exitCode = 1;
