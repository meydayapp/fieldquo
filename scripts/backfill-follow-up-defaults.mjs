// scripts/backfill-follow-up-defaults.mjs
//
// One-off: give every existing company FieldQuo's three default follow-up
// rules (lib/followUps/defaults.js). New companies get them at signup; this
// is for the ones that existed before the defaults did.
//
//   node --import ./scripts/alias-loader.mjs scripts/backfill-follow-up-defaults.mjs --dry-run
//   node --import ./scripts/alias-loader.mjs scripts/backfill-follow-up-defaults.mjs
//
// Dry run first, always: it prints how many companies would be seeded and
// writes nothing. Idempotent either way — ensureDefaultFollowUps is keyed on
// (companyId, builtInKey), so a second run creates nothing and a company that
// deleted a default keeps it deleted.
//
// Sanctioned write: creating FieldQuo's own default rows inside a tenant is
// the same act signup performs, not an edit to anything a company wrote.

import { db } from "@/lib/db";
import { ensureDefaultFollowUps, BUILT_IN_KEYS } from "@/lib/followUps/defaults";

const dryRun = process.argv.includes("--dry-run");

const companies = await db.company.findMany({
  select: { id: true, name: true, isDemo: true },
  orderBy: { createdAt: "asc" },
});

let seeded = 0;
let created = 0;
let untouched = 0;
for (const company of companies) {
  const n = await ensureDefaultFollowUps(db, company.id, { dryRun });
  if (n > 0) {
    seeded++;
    created += n;
    console.log(`  ${dryRun ? "would seed" : "seeded"}  ${company.name}${company.isDemo ? " (demo)" : ""}  +${n}`);
  } else {
    untouched++;
  }
}

console.log(
  `\n${dryRun ? "DRY RUN — " : ""}${companies.length} companies: ${seeded} ${dryRun ? "would be " : ""}seeded (${created} rules across ${BUILT_IN_KEYS.length} defaults), ${untouched} already had them.`,
);

await db.$disconnect();
