// scripts/backfill-service-templates.mjs
//
//   node --import dotenv/config --import ./scripts/alias-loader.mjs scripts/backfill-service-templates.mjs            # dry run
//   node --import dotenv/config --import ./scripts/alias-loader.mjs scripts/backfill-service-templates.mjs --apply    # write
//   … --company <id>   one company only
//
// Gives existing companies the template lines their seeded services now
// carry — lib/services/backfillTemplates.js has the rule: fill only what is
// empty, never overwrite, never touch a price, never delete. DRY RUN unless
// --apply is passed; the dry run only reads.
import { backfillTemplates } from "@/lib/services/backfillTemplates";
import { db } from "@/lib/db";

const apply = process.argv.includes("--apply");
const i = process.argv.indexOf("--company");
const companyId = i > -1 ? process.argv[i + 1] : null;

const r = await backfillTemplates({ db, companyId, apply });
console.log(`${apply ? "APPLY" : "DRY RUN"} — ${r.totals.scanned} seeded products scanned, ${r.totals.eligible} whose seed carries a template, ${r.totals.toFill} to fill`);
console.log(`fields: templateLines ${r.totals.fields.templateLines}, defaultDiscount ${r.totals.fields.defaultDiscount}, estimateTypes ${r.totals.fields.estimateTypes}, categories ${r.totals.fields.categories}`);
for (const c of r.companies.sort((a, b) => b.toFill - a.toFill)) {
  console.log(`  ${c.companyId}  ${c.isDemo ? "[demo] " : ""}${c.name} — eligible ${c.eligible}, to fill ${c.toFill}`);
}
if (apply) console.log(`written: ${r.applied} products`);
await db.$disconnect();
