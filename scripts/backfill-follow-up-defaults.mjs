// scripts/backfill-follow-up-defaults.mjs
//
// One-off: give every existing company FieldQuo's built-in follow-up rules
// (lib/followUps/defaults.js). New companies get them at signup; this is for
// the ones that existed before the defaults did.
//
// Seven of them since 2026-11-17 — the three quote chases (ON), the three
// enquiry chases (OFF) and the one change-order chase (ON). Every number
// printed below comes from ALL_BUILT_IN_KEYS rather than being typed here,
// so this script cannot report a count the seeder does not write, and a
// seventh default needs no edit to it. Running it is optional either way:
// the Follow-ups page seeds a company that is missing any of them on load —
// which is also why this exists, because a company whose staff never open
// that page would otherwise wait indefinitely for a default that shipped
// after they signed up.
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
import { ensureDefaultFollowUps, ALL_BUILT_IN_KEYS } from "@/lib/followUps/defaults";

const dryRun = process.argv.includes("--dry-run");

const companies = await db.company.findMany({
  select: { id: true, name: true, isDemo: true },
  orderBy: { createdAt: "asc" },
});

// Which defaults are missing, and from how many companies — the breakdown a
// dry run needs to answer "is this worth running", which a single total
// cannot: six defaults seeded months ago and one added today look identical
// in a count of rows.
//
// A TOMBSTONED row counts as present, exactly as the seeder treats it: a
// company that deleted a default is not missing it, and reporting it as
// missing would promise a write this script will never make.
const existingRules = await db.followUpRule.findMany({
  where: { builtInKey: { in: [...ALL_BUILT_IN_KEYS] } },
  select: { companyId: true, builtInKey: true },
});
const companiesWith = new Map(ALL_BUILT_IN_KEYS.map((k) => [k, new Set()]));
for (const r of existingRules) companiesWith.get(r.builtInKey)?.add(r.companyId);

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
  `\n${dryRun ? "DRY RUN — " : ""}${companies.length} companies: ${seeded} ${dryRun ? "would be " : ""}seeded (${created} rules across ${ALL_BUILT_IN_KEYS.length} defaults), ${untouched} already had them.`,
);

console.log("\nBy default, before this run:");
for (const key of ALL_BUILT_IN_KEYS) {
  const had = companiesWith.get(key).size;
  console.log(`  ${key.padEnd(22)}  ${had} of ${companies.length} companies had it, ${companies.length - had} missing`);
}

await db.$disconnect();
