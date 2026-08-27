// scripts/backfill-company-country.mjs
//
// Write down the country these companies already told us.
//
// Three of twenty-nine have a null `country` and a complete, Google-formatted
// address ending in "Canada", with the city and province populated. They signed
// up before AddressAutocomplete's country component reached the server. Their
// billing page therefore asked where their business is while Company Settings
// displayed the answer.
//
// lib/company/resolveCountry.js already makes the page work without this. The
// backfill is still worth running, because a derived answer is recomputed on
// every request by every caller that remembers to derive it, and the next
// caller will forget. Writing it down once makes the column true.
//
// Only ever fills a NULL. It never overwrites a stated country, never touches
// an address, and never deletes anything — if a company is genuinely somewhere
// else, the row they typed wins and this leaves it alone.
//
// Run: node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-company-country.mjs [--dry]

import { db } from "@/lib/db";
import { resolveCountry } from "@/lib/company/resolveCountry";

const DRY = process.argv.includes("--dry");

const blank = await db.company.findMany({
  where: { OR: [{ country: null }, { country: "" }] },
  select: { id: true, name: true, country: true, address: true, province: true },
});

if (!blank.length) {
  console.log("Every company already states a country. Nothing to do.");
  process.exit(0);
}

console.log(`${blank.length} company/companies with no country:\n`);
let filled = 0;
let stillUnknown = 0;

for (const c of blank) {
  const { country, source } = resolveCountry(c);
  if (!country) {
    stillUnknown += 1;
    console.log(`  ${c.name.padEnd(22)} -> UNKNOWN (nothing on the record states one; the page will ask)`);
    continue;
  }
  console.log(`  ${c.name.padEnd(22)} -> ${country}  (read from the ${source})`);
  if (!DRY) {
    await db.company.update({ where: { id: c.id }, data: { country } });
    filled += 1;
  }
}

console.log(
  DRY
    ? `\n--dry: nothing written. ${blank.length - stillUnknown} would be filled, ${stillUnknown} would remain unknown.`
    : `\n${filled} filled, ${stillUnknown} left blank. No address changed, no country overwritten.`,
);
console.log(`Companies still without a country: ${await db.company.count({ where: { OR: [{ country: null }, { country: "" }] } })}`);
await db.$disconnect();
