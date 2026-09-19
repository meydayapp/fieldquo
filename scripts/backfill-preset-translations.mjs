// scripts/backfill-preset-translations.mjs
//
// Mark every seeded standard add-on as translated from the catalogue, in
// every document language — the one-off that makes the translations page
// stop listing presets for companies seeded before the catalogue carried
// more than French.
//
// ── What it will and will not touch ─────────────────────────────────────────
//
//   * Only rows whose NAME is a catalogue name. A product the company made
//     up is theirs and never appears here.
//   * A language is written when the row has no entry for it, or when the
//     entry is the catalogue's unmarked French (what the seeder wrote before
//     the mark existed), or an AI draft nobody reviewed. An entry a PERSON
//     reviewed is never overwritten, whatever it says.
//   * Never a name, a description, a price, a unit. Never a delete. Never a
//     quote — lines already on a document keep what they said.
//
// The decision is planPresetTranslationBackfill in
// lib/products/presetTranslations.js — pure, executed against fixtures by
// scripts/check-preset-translations.mjs, which also proves a second run
// plans nothing. This file only fetches and writes.
//
// DRY BY DEFAULT. Prints the count per language and writes nothing until told:
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-preset-translations.mjs
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-preset-translations.mjs --apply
//   … --company <companyId>     one tenant only (either mode)

import { db } from "@/lib/db";
import { planPresetTranslationBackfill, CATALOGUE_NAMES, CATALOGUE_LANGUAGES } from "@/lib/products/presetTranslations";

const APPLY = process.argv.includes("--apply");
const companyFlag = process.argv.indexOf("--company");
const COMPANY_ID = companyFlag !== -1 ? process.argv[companyFlag + 1] : null;
if (companyFlag !== -1 && !COMPANY_ID) {
  console.error("--company needs an id after it.");
  process.exit(2);
}

const rows = await db.product.findMany({
  where: { name: { in: [...CATALOGUE_NAMES] }, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) },
  select: { id: true, companyId: true, name: true, translations: true },
  orderBy: [{ companyId: "asc" }, { name: "asc" }],
});

const plan = planPresetTranslationBackfill(rows);
const perLanguage = Object.fromEntries(CATALOGUE_LANGUAGES.map((l) => [l, 0]));
for (const p of plan) for (const l of p.languages) perLanguage[l]++;
const companies = new Set(plan.map((p) => rows.find((r) => r.id === p.id)?.companyId));

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${rows.length} preset rows across ${new Set(rows.map((r) => r.companyId)).size} companies`);
console.log(`${plan.length} rows need writing (${companies.size} companies); ${rows.length - plan.length} already carry every catalogue language.`);
console.log("Per language:", perLanguage);

if (!APPLY) {
  console.log("\nNothing written. Re-run with --apply to write.");
  process.exit(0);
}

let written = 0;
for (const p of plan) {
  await db.product.update({ where: { id: p.id }, data: { translations: p.translations } });
  written++;
}
console.log(`\nWrote ${written} rows.`);

// Prove idempotence against the database, not the plan: a second read must
// plan nothing.
const after = await db.product.findMany({
  where: { name: { in: [...CATALOGUE_NAMES] }, ...(COMPANY_ID ? { companyId: COMPANY_ID } : {}) },
  select: { id: true, companyId: true, name: true, translations: true },
});
const again = planPresetTranslationBackfill(after);
console.log(`Second pass plans ${again.length} rows${again.length ? " — NOT idempotent, look at the rows above" : " (idempotent)."}`);
process.exit(again.length ? 1 : 0);
