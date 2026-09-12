// scripts/reclassify-licence-registers.mjs
//
// Run the one-off licence-register reclassification from a laptop.
//
//   node --import ./scripts/alias-loader.mjs scripts/reclassify-licence-registers.mjs            # dry run
//   node --import ./scripts/alias-loader.mjs scripts/reclassify-licence-registers.mjs --apply    # write
//
// The same function the Review folder's maintenance panel calls
// (lib/sales/discovery/reclassifyRegisters.js), against the DATABASE_URL in
// the environment. Exists because a real run is ~117,000 rows in pages of
// 2,000 and a laptop has no 300-second budget. Dry run is the default and
// prints the same numbers a real run would write; --apply is the only flag.
//
// Idempotent: the selection is `status = needs_review` on a licence-register
// provider and the write sets `discovered`, so running it twice writes once.
import "dotenv/config";
import { db } from "../lib/db.js";
import { reclassifyLicenceRegisterRows } from "../lib/sales/discovery/reclassifyRegisters.js";

const apply = process.argv.includes("--apply");
const started = Date.now();
console.log(apply ? "Reclassifying licence-register rows — WRITING" : "Reclassifying licence-register rows — dry run");

try {
  const result = await reclassifyLicenceRegisterRows({ db, dryRun: !apply, now: new Date(), adminId: null });
  for (const [provider, stats] of Object.entries(result.byProvider)) {
    console.log(
      `  ${provider.padEnd(12)} found ${String(stats.found).padStart(7)}  ` +
        `with trade ${String(stats.withTrade).padStart(7)}  without ${String(stats.withoutTrade).padStart(7)}  skipped ${String(stats.skipped).padStart(6)}`,
    );
  }
  console.log(`  planned ${result.planned} · written ${result.updated} · campaigns ${result.campaigns} · ${Math.round((Date.now() - started) / 1000)}s`);
} finally {
  await db.$disconnect();
}
