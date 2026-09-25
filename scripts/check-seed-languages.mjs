// scripts/check-seed-languages.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-seed-languages.mjs [--quiet]
//
// Every string a trade seed puts in front of a company or its client carries
// all eight languages FieldQuo sends documents in (lib/i18n/documentLabels.js):
// category names, service names and descriptions, estimate-template line
// names and descriptions, and default-discount names. A missing or empty
// string fails; the table at the end is the per-file language count.

import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { SEED_DOCUMENT_LANGUAGES } from "@/app/data/serviceSeeds/_templateLines";
import { readFileSync } from "node:fs";

const LANGS = SEED_DOCUMENT_LANGUAGES;
const docLabels = readFileSync(new URL("../lib/i18n/documentLabels.js", import.meta.url), "utf8");
const quiet = process.argv.includes("--quiet");
let fail = 0;
let passed = 0;
const ok = (c, m) => {
  if (c) passed++;
  else {
    fail++;
    if (!quiet) console.log("  FAIL " + m);
  }
};
const filled = (v) => typeof v === "string" && v.trim().length > 0;

for (const lang of LANGS) ok(new RegExp(`^  ${lang}: \\{`, "m").test(docLabels), `${lang} is a document language in lib/i18n/documentLabels.js`);

const table = [];
for (const [trade, seed] of Object.entries(SERVICE_SEEDS)) {
  const count = Object.fromEntries(LANGS.map((l) => [l, 0]));
  let strings = 0;
  const see = (lang, v, where) => {
    ok(filled(v), `${trade}: ${where} — ${lang} missing or empty`);
    if (filled(v)) count[lang]++;
  };
  for (const c of seed.categories || []) {
    strings++;
    for (const l of LANGS) see(l, c.name?.[l], `category ${c.key}`);
  }
  for (const s of seed.services || []) {
    const tr = s.translations || {};
    strings += 2;
    for (const l of LANGS) {
      see(l, s.name?.[l] || tr[l]?.name, `${s.seedKey} name`);
      see(l, s.description?.[l] || tr[l]?.description, `${s.seedKey} description`);
    }
    if (Array.isArray(s.templateLines) && s.templateLines.length) {
      strings += s.templateLines.length * 2;
      s.templateLines.forEach((line, i) => {
        see("en", line.name, `${s.seedKey} line ${i} name`);
        see("en", line.description, `${s.seedKey} line ${i} description`);
        for (const l of LANGS.filter((x) => x !== "en")) {
          const t = tr[l]?.templateLines?.[i];
          see(l, t?.name, `${s.seedKey} line ${i} name`);
          see(l, t?.description, `${s.seedKey} line ${i} description`);
        }
      });
      if (s.defaultDiscount) {
        strings++;
        see("en", s.defaultDiscount.name, `${s.seedKey} discount`);
        for (const l of LANGS.filter((x) => x !== "en")) see(l, tr[l]?.defaultDiscountName, `${s.seedKey} discount`);
      }
    }
  }
  table.push({ trade, strings, ...count });
}
console.table(table);
console.log(`\n${passed} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
