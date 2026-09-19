// scripts/check-preset-translations.mjs
//
//   npm run check:preset-translations
//
// Presets ship translated; the translations page lists only what is custom.
//
// Bundled with esbuild like check:prep-guide so the REAL translations route
// (app/api/settings/translations) runs against an in-memory db and one
// owner. What it holds:
//
//   1. every standard add-on name has a catalogue entry in every document
//      language, and none of them is English with the accents filed off;
//   2. the seeder writes every language, marked, at creation;
//   3. the backfill plan fills the gaps, replaces the unmarked French the old
//      seeder wrote and an unreviewed AI draft, never touches what a person
//      reviewed, and plans NOTHING on a second run;
//   4. the page's GET: a current preset does not appear; a custom product
//      does; a preset the company renamed does, flagged; the counts add up;
//   5. the page prints the one-line explanation.

import { LANGUAGES } from "@/app/i18n/languages";
import { STANDARD_ADDONS } from "@/app/data/standardAddOns";
import { STANDARD_ADDONS_FR, standardAddOnTranslations } from "@/app/data/standardAddOns.fr";
import { STANDARD_ADDONS_I18N } from "@/app/data/standardAddOns.i18n";
import { CATALOGUE_LANGUAGES, CATALOGUE_NAMES, planPresetTranslationBackfill, translationStatus, isCatalogueEntry } from "@/lib/products/presetTranslations";
import { planStandardAddOns } from "@/lib/products/seedStandardAddOns";
import { GET } from "@/app/api/settings/translations/route";
import { rows, reset } from "./fixtures/prepGuide/db.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
const failures = [];
const ok = (label, cond, detail) => (cond ? pass++ : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`));
const section = (t) => console.log(`\n${t}`);
const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

async function main() {
  section("1. The catalogue covers every preset in every document language");
  const names = [...new Set(Object.values(STANDARD_ADDONS).flat().map((a) => a.name))];
  const offered = LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
  ok("every offered non-English document language is a catalogue language", offered.every((c) => CATALOGUE_LANGUAGES.includes(c)), offered.filter((c) => !CATALOGUE_LANGUAGES.includes(c)).join(","));
  ok("every preset name is a catalogue name", names.every((n) => CATALOGUE_NAMES.includes(n)));
  // Not "per" (a preposition in Italian, Spanish and French) and not "install"
  // (\b is ASCII-only, so it matches inside "installé").
  const english = /\b(the|and|with)\b/i;
  for (const lang of CATALOGUE_LANGUAGES) {
    const table = lang === "fr" ? STANDARD_ADDONS_FR : STANDARD_ADDONS_I18N[lang];
    for (const n of names) {
      const e = table[n];
      ok(`${lang}: ${n}`, Boolean(e?.name) && String(e.description || "").length >= 15, JSON.stringify(e));
      if (e && ["fr", "es", "de", "it"].includes(lang)) ok(`${lang}: ${n} is not English`, !english.test(`${e.name} ${e.description}`) && e.name !== n, e?.name);
    }
    ok(`${lang}: no stale name`, Object.keys(table).every((n) => names.includes(n)), Object.keys(table).filter((n) => !names.includes(n)).join(","));
  }

  section("2. The seeder writes every language, marked");
  const seeded = standardAddOnTranslations("Soft-Close Hinges", new Date("2026-09-19T00:00:00Z"));
  ok("all catalogue languages present", CATALOGUE_LANGUAGES.every((l) => seeded[l]?.name));
  ok("each entry is marked source catalogue, of the English name, reviewed", CATALOGUE_LANGUAGES.every((l) => seeded[l].source === "catalogue" && seeded[l].of === "Soft-Close Hinges" && seeded[l].reviewed === true));
  ok("a custom name gets no catalogue translation", standardAddOnTranslations("My own thing") === null);
  ok("the seeder still routes through standardAddOnTranslations", /translations: standardAddOnTranslations\(a\.name\) \|\| undefined,/.test(read("lib/products/seedStandardAddOns.js")));
  ok("planStandardAddOns still dedupes by name", planStandardAddOns({ addons: STANDARD_ADDONS.cabinet_refinishing, existing: [{ id: "x", name: "Soft-Close Hinges", categories: [{ id: "c" }] }], categoryId: "c" }).toCreate.every((a) => a.name !== "Soft-Close Hinges"));

  section("3. The backfill plan");
  const at = new Date("2026-09-19T00:00:00Z");
  const products = [
    // the old seeder's row: unmarked French, nothing else
    { id: "old", name: "Travel Fee", translations: { fr: { name: STANDARD_ADDONS_FR["Travel Fee"].name, description: STANDARD_ADDONS_FR["Travel Fee"].description } } },
    // a company's own French, reviewed — kept; the rest filled
    { id: "own", name: "Travel Fee", translations: { fr: { name: "Frais de route", description: "Au-delà de 40 km.", reviewed: true, reviewedAt: "2026-01-01" } } },
    // an AI draft nobody reviewed — replaced
    { id: "ai", name: "Travel Fee", translations: { es: { name: "Cargo de viaje (borrador)", description: "x" } } },
    // a custom product with the same shape — never touched
    { id: "custom", name: "Weekend surcharge", translations: null },
    // nothing at all
    { id: "bare", name: "Disposal Fee", translations: null },
    // hostile shapes
    { id: "arr", name: "Disposal Fee", translations: ["x"] },
    { id: "str", name: "Disposal Fee", translations: "x" },
  ];
  const plan = planPresetTranslationBackfill(products, at);
  const by = Object.fromEntries(plan.map((p) => [p.id, p]));
  ok("the old seeder's row gets every language, its French now marked", by.old && by.old.languages.length === CATALOGUE_LANGUAGES.length && by.old.translations.fr.source === "catalogue" && by.old.translations.fr.of === "Travel Fee");
  ok("a person's reviewed French is kept; the other languages are filled", by.own && !by.own.languages.includes("fr") && by.own.translations.fr.name === "Frais de route" && by.own.languages.length === CATALOGUE_LANGUAGES.length - 1);
  ok("an unreviewed AI draft is replaced by the catalogue", by.ai && by.ai.languages.includes("es") && by.ai.translations.es.name === STANDARD_ADDONS_I18N.es["Travel Fee"].name);
  ok("a custom product is not planned", !by.custom);
  ok("a bare preset gets every language", by.bare && by.bare.languages.length === CATALOGUE_LANGUAGES.length);
  ok("hostile translations shapes are treated as empty", by.arr && by.str && by.arr.languages.length === CATALOGUE_LANGUAGES.length);
  const applied = products.map((p) => (by[p.id] ? { ...p, translations: by[p.id].translations } : p));
  ok("a second run plans nothing (idempotent)", planPresetTranslationBackfill(applied, new Date()).length === 0, JSON.stringify(planPresetTranslationBackfill(applied, new Date()).map((p) => p.id)));
  ok("…even with a different reviewedAt clock", planPresetTranslationBackfill(applied, new Date("2030-01-01")).length === 0);
  ok("a renamed preset is not re-marked as current", planPresetTranslationBackfill([{ id: "r", name: "Travel Fee (over 40 km)", translations: by.old.translations }]).length === 0);

  section("4. translationStatus");
  const full = by.bare.translations;
  ok("current catalogue entry → preset, reviewed, not missing", (() => { const s = translationStatus({ name: "Disposal Fee", description: "d", translations: full }, "uk"); return s.preset && s.reviewed && !s.missing && !s.renamed; })());
  ok("renamed → shown, flagged, unreviewed", (() => { const s = translationStatus({ name: "Disposal Fee (bins)", description: "d", translations: full }, "uk"); return !s.preset && s.renamed && !s.reviewed && !s.missing; })());
  ok("a person's entry → reviewed as they said", translationStatus({ name: "X", translations: { fr: { name: "Y", reviewed: true } } }, "fr").reviewed === true && !translationStatus({ name: "X", translations: { fr: { name: "Y", reviewed: true } } }, "fr").preset);
  ok("no entry → missing", translationStatus({ name: "X", translations: null }, "fr").missing === true);
  ok("isCatalogueEntry", isCatalogueEntry(full.fr) && !isCatalogueEntry({ name: "x", reviewed: true }) && !isCatalogueEntry(null));

  section("5. The page's GET, against the real route");
  reset();
  rows.company.push({ id: "co1", defaultLanguage: "en" });
  rows.product.push({ id: "p1", companyId: "co1", active: true, name: "Soft-Close Hinges", description: "Install soft-close hinges, per door.", translations: standardAddOnTranslations("Soft-Close Hinges"), type: "service" });
  rows.product.push({ id: "p2", companyId: "co1", active: true, name: "Weekend surcharge", description: "Saturday work.", translations: null, type: "service" });
  rows.product.push({ id: "p3", companyId: "co1", active: true, name: "Travel Fee (over 40 km)", description: "Travel outside the standard service area.", translations: standardAddOnTranslations("Travel Fee"), type: "service" });
  rows.product.push({ id: "p4", companyId: "co1", active: true, name: "Backsplash", description: "Matching backsplash — height chosen on the quote.", translations: { ...standardAddOnTranslations("Backsplash"), fr: { name: "Dosseret assorti (notre texte)", description: "Hauteur au choix.", reviewed: true, reviewedAt: "2026-02-02" } }, type: "product" });
  rows.product.push({ id: "p5", companyId: "co2", active: true, name: "Weekend surcharge", description: "", translations: null, type: "service" });
  for (const lang of ["fr", "es", "uk", "pa", "tl", "de", "it"]) {
    const res = await GET(new Request(`http://local/api/settings/translations?language=${lang}`));
    const body = await res.json();
    const ids = body.items.map((i) => i.id);
    ok(`${lang}: the current preset (p1) is not on the page`, !ids.includes("p1"), ids.join(","));
    ok(`${lang}: the custom product (p2) is, as missing`, ids.includes("p2") && body.items.find((i) => i.id === "p2").missing === true);
    ok(`${lang}: the renamed preset (p3) is, flagged and unreviewed`, ids.includes("p3") && body.items.find((i) => i.id === "p3").renamed === true && body.items.find((i) => i.id === "p3").reviewed === false && body.items.find((i) => i.id === "p3").missing === false);
    ok(`${lang}: another company's row is not`, !ids.includes("p5"));
    ok(`${lang}: presets counted`, body.presets === (lang === "fr" ? 1 : 2) && body.total === ids.length, `presets ${body.presets}`);
  }
  const fr = await (await GET(new Request("http://local/api/settings/translations?language=fr"))).json();
  ok("fr: the preset whose French a person rewrote (p4) is on the page as reviewed by them", fr.items.some((i) => i.id === "p4" && i.reviewed === true && i.translation.name === "Dosseret assorti (notre texte)"));
  ok("GET refuses an unsupported language", (await GET(new Request("http://local/api/settings/translations?language=xx"))).status === 400);

  section("6. The page");
  const page = read("app/app/settings/translations/page.js");
  ok("the page says presets are already translated", /app\.translations\.presetsNote/.test(page));
  ok("the page flags a renamed preset", /item\.renamed/.test(page) && /app\.translations\.renamedPreset/.test(page));
  ok("the page has an honest empty state when only presets exist", /data\?\.presets > 0/.test(page));

  console.log(`\n${pass} passed, ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(failures.length ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
