// scripts/seed-demo-content.mjs
//
// Fill the shared demo companies with six months of a realistic business.
//
//   node --import ./scripts/alias-loader.mjs scripts/seed-demo-content.mjs --all          # dry run
//   node --import ./scripts/alias-loader.mjs scripts/seed-demo-content.mjs --all --write  # seed the pool
//   node --import ./scripts/alias-loader.mjs scripts/seed-demo-content.mjs --slug demo3 --write
//
// ── Dry run by default ─────────────────────────────────────────────────────
//
// Without --write, nothing reaches Neon. Each demo company's row is copied
// into the in-memory Prisma the check uses (scripts/fixtures/memoryPrisma.mjs),
// the seed runs against THAT, and the counts it would have written are
// printed. What you see in a dry run is what --write does — same function,
// same data, same `now`.
//
// ── What it will and will not touch ────────────────────────────────────────
//
//   * isDemo companies only. seedDemoCompany re-reads the row and refuses
//     otherwise; this script additionally filters its own list to the pool
//     (demoOwnerRepId null) under --all. A rep's own demo is seeded when it is
//     created and on Reset (lib/sales/repDemo.js) and can be named here by
//     --slug.
//   * Adds, never deletes. Every row is looked up by a natural key first; a
//     demo that already has its clients keeps them and gets only what is
//     missing. Run it twice and the second run reports zero created.
//
// The owner runs this. It is not called from the app.
import "dotenv/config";
import { db } from "@/lib/db";
import { seedDemoCompany } from "@/lib/demo/seedContent";
import { INDUSTRIES } from "@/lib/demo/industries";
import { fakeDb } from "./fixtures/memoryPrisma.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] || null;
};

const write = flag("--write");
const all = flag("--all");
const slug = value("--slug");
if (!all && !slug) {
  console.log("Usage: seed-demo-content.mjs (--all | --slug <slug>) [--write]\n");
  console.log("  --all     every pool demo (isDemo, not owned by a rep)");
  console.log("  --slug    one demo company by slug (pool or a rep's)");
  console.log("  --write   actually write; without it this is a dry run\n");
  process.exit(1);
}

// One `now` for the whole run, so ten companies seeded in one go share a
// calendar — and so a re-run tomorrow finds today's rows by their keys, not
// by their dates.
const now = new Date();

const where = slug ? { slug } : { isDemo: true, demoOwnerRepId: null };
const companies = await db.company.findMany({
  where,
  select: { id: true, name: true, slug: true, isDemo: true, demoIndustry: true, demoOwnerRepId: true },
  orderBy: { slug: "asc" },
});

if (companies.length === 0) {
  console.error(slug ? `No company with slug "${slug}".` : "No pool demo companies. Run seed:demos first.");
  process.exit(1);
}

console.log(`${write ? "SEEDING" : "DRY RUN"} — ${companies.length} compan${companies.length === 1 ? "y" : "ies"}, now = ${now.toISOString()}\n`);

let failures = 0;
for (const company of companies) {
  const label = `${company.slug.padEnd(28)} ${(company.demoIndustry || "?").padEnd(12)} ${company.name}`;
  if (!company.isDemo) {
    console.log(`✗ ${label}\n    not a demo company — skipped (isDemo is false)`);
    failures += 1;
    continue;
  }
  if (!INDUSTRIES[company.demoIndustry]) {
    console.log(`✗ ${label}\n    no trade preset for "${company.demoIndustry}" — set one at /platform/demo first`);
    failures += 1;
    continue;
  }
  try {
    let result;
    if (write) {
      result = await seedDemoCompany(company.id, { now });
    } else {
      const memory = fakeDb();
      const full = await db.company.findUnique({ where: { id: company.id } });
      await memory.company.create({ data: full });
      result = await seedDemoCompany(company.id, { now, db: memory });
    }
    const created = Object.values(result.created).reduce((a, b) => a + b, 0);
    const existing = Object.values(result.existing).reduce((a, b) => a + b, 0);
    console.log(`✓ ${label}`);
    console.log(`    ${write ? "wrote" : "would write"} ${created} rows${existing ? `, ${existing} already there` : ""}`);
    const top = Object.entries(result.created)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([m, n]) => `${m} ${n}`)
      .join(", ");
    if (top) console.log(`    ${top}`);
  } catch (err) {
    failures += 1;
    console.log(`✗ ${label}\n    ${err?.message || err}`);
  }
}

console.log(`\n${write ? "Done." : "Dry run only — add --write to seed."}${failures ? ` ${failures} failed.` : ""}\n`);
await db.$disconnect?.();
process.exit(failures ? 1 : 0);
