// scripts/backfill-product-descriptions.mjs
//
// Give the standard add-ons seeded before descriptions and translations were
// written the sentence the catalogue always had for them.
//
// A company that pressed "add standard items" last spring has a Product row
// called "Soft-Close Hinges" with `description` NULL. Picked onto a quote, that
// row now copies its description under the line (lib/quotes/lineDetail.js) —
// which is nothing, for that company, until this runs. New seeds are already
// complete; this is for the rows that predate them.
//
// ── What it will and will not touch ─────────────────────────────────────────
//
//   * Only rows whose NAME matches a STANDARD_ADDONS entry. A product the
//     company made up is theirs; its blank description is not ours to fill.
//   * Only an EMPTY description. A sentence the company typed — even one that
//     disagrees with ours — stays.
//   * Only a MISSING French entry under `translations`. An existing `fr` is
//     never overwritten, and other languages are carried through untouched.
//   * Never a name, a price, a unit, a category link. Never a delete.
//   * Never a quote. Lines already on a quote keep what they said; only rows
//     picked from now on pick the description up.
//
// The decision itself is planDescriptionBackfill in
// lib/products/seedStandardAddOns.js — pure, and executed against fixtures by
// scripts/check-addon-descriptions.mjs. This file only fetches and writes.
//
// DRY BY DEFAULT. It prints what it would do and writes nothing until told:
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-product-descriptions.mjs
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-product-descriptions.mjs --apply
//   … --company <companyId>     one tenant only (either mode)

import { db } from "@/lib/db";
import { planDescriptionBackfill } from "@/lib/products/seedStandardAddOns";
import { STANDARD_ADDONS } from "@/app/data/standardAddOns";

const APPLY = process.argv.includes("--apply");
const companyFlag = process.argv.indexOf("--company");
const COMPANY_ID = companyFlag !== -1 ? process.argv[companyFlag + 1] : null;
if (companyFlag !== -1 && !COMPANY_ID) {
  console.error("--company needs an id after it.");
  process.exit(2);
}

// Every standard name, once — the only rows this script is allowed to look at.
const names = [...new Set(Object.values(STANDARD_ADDONS).flat().map((a) => a.name))];

const rows = await db.product.findMany({
  where: {
    name: { in: names },
    ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}),
  },
  select: {
    id: true,
    companyId: true,
    name: true,
    description: true,
    translations: true,
    company: { select: { name: true } },
  },
  orderBy: [{ companyId: "asc" }, { name: "asc" }],
});

const byCompany = new Map();
for (const r of rows) {
  if (!byCompany.has(r.companyId)) byCompany.set(r.companyId, { name: r.company?.name || r.companyId, rows: [] });
  byCompany.get(r.companyId).rows.push(r);
}

if (!rows.length) {
  console.log(COMPANY_ID ? "That company has no standard add-on rows." : "No standard add-on rows anywhere. Nothing to do.");
  await db.$disconnect();
  process.exit(0);
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} standard add-on row(s) across ${byCompany.size} compan${byCompany.size === 1 ? "y" : "ies"}\n`);

let descriptions = 0;
let translations = 0;
let written = 0;

for (const [companyId, { name, rows: companyRows }] of byCompany) {
  const plan = planDescriptionBackfill(companyRows);
  if (!plan.length) {
    console.log(`  ${name} (${companyId}): complete already, nothing to fill`);
    continue;
  }
  console.log(`  ${name} (${companyId}): ${plan.length} row(s)`);
  for (const change of plan) {
    const what = [];
    if (change.data.description) {
      descriptions += 1;
      what.push(`description ← "${change.data.description}"`);
    }
    if (change.data.translations) {
      translations += 1;
      what.push("translations.fr ← catalogue");
    }
    console.log(`      ${change.name.padEnd(40)} ${what.join("; ")}`);
    if (APPLY) {
      // Re-read inside the write so a description typed between the plan and
      // the update is not overwritten: the WHERE fails and nothing happens.
      const guard = change.data.description ? { OR: [{ description: null }, { description: "" }] } : {};
      const res = await db.product.updateMany({
        where: { id: change.id, companyId, ...guard },
        data: change.data,
      });
      written += res.count;
    }
  }
}

console.log(
  APPLY
    ? `\n${written} row(s) written: ${descriptions} description(s), ${translations} French entr${translations === 1 ? "y" : "ies"} planned. No name, price, unit, link or quote changed.`
    : `\nDry run: ${descriptions} description(s) and ${translations} French entr${translations === 1 ? "y" : "ies"} would be filled. Re-run with --apply to write them.`,
);
await db.$disconnect();
