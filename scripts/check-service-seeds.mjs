// scripts/check-service-seeds.mjs
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-service-seeds.mjs [--file <trade>]
//
// The per-trade service seeds (app/data/serviceSeeds/*) and everything that
// reads them, executed rather than read.
//
// ── What is asserted ───────────────────────────────────────────────────────
//
//   A. Every seed file parses, names a trade the catalogue ships, and every
//      service carries en/fr/es name + description that are present and not
//      the same text pasted three times; units are the closed set the quote
//      builder writes; seedKeys follow `<trade>.<category>.<slug>` and are
//      unique ACROSS trades; every category a service names exists.
//   B. The benchmark, where present: median > 0, low ≤ median ≤ high when all
//      three exist (nulls tolerated), currency USD, source "benchmark".
//   C. None of the benchmark source's own sentences appear in any seed — the
//      check holds a list of sentence HASHES, not the text — and the source's
//      name appears nowhere in the folder.
//   D. A takeoff-priced service (pricedBy) is never written as a flat price:
//      planServiceSeeds excludes it and productDataForSeed is never asked for
//      it; the trade it sits in genuinely has a takeoff.
//   E. Seeding is idempotent on a fixture company: a second run creates
//      nothing, a company that renamed and repriced a row keeps it, and a seed
//      that gains a service adds only the new key.
//   F. The CAD conversion: one constant, dated; rounding to $5 / $1 / $0.25 by
//      magnitude; a null or zero median converts to null, never to a number;
//      a non-benchmark source passes through unconverted.
//   G. The index registers every file in the folder and nothing else, and the
//      trades the UI joins on exist in the catalogue.
//   H. The screens read what seeding writes: seedKey is written and read back,
//      the Settings card and the price editor import the same helpers, and the
//      wording says "set your own rate", never that the range is a fact.

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { TAKEOFF_TRADES } from "@/lib/pricing/takeoffTrades";
import { hasPriceBook } from "@/app/data/tradePriceBooks";
import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import {
  SEED_UNITS,
  SEED_LANGUAGES,
  planServiceSeeds,
  seedableServices,
  seedText,
  serviceSeedsFor,
  tradeBenchmarkSummary,
  benchmarkForSeedKey,
} from "@/lib/services/seeds";
import { productDataForSeed } from "@/lib/products/seedServices";
import {
  USD_TO_CAD_SUGGESTED,
  USD_TO_CAD_SUGGESTED_AS_OF,
  roundSuggested,
  suggestedIn,
  benchmarkIn,
} from "@/lib/pricing/benchmarkFx";

let fail = 0;
let passed = 0;
const ok = (c, m, d) => {
  if (c) passed++;
  else {
    fail++;
    console.log("  FAIL " + m + (d === undefined ? "" : `  — got ${JSON.stringify(d)?.slice(0, 300)}`));
  }
};
const section = (t) => console.log(`\n${t}`);
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const only = (() => {
  const i = process.argv.indexOf("--file");
  return i > -1 ? process.argv[i + 1] : null;
})();

const folder = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "app", "data", "serviceSeeds");
const files = readdirSync(folder)
  .filter((f) => f.endsWith(".js") && f !== "index.js" && !f.startsWith("_"))
  .filter((f) => !only || f === `${only}.js`)
  .sort();

const hashes = new Set(JSON.parse(read("scripts/service-seeds/source-sentence-hashes.json")));
const norm = (s) =>
  String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const sentenceHashes = (text) =>
  String(text)
    .split(/ \/ |(?<=[.!?])\s+/)
    .map(norm)
    .filter((n) => n.split(" ").length >= 5)
    .map((n) => createHash("sha256").update(n).digest("hex").slice(0, 24));

const KEY_RE = /^fq\.([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z0-9_]+)$/;
const seenKeys = new Map();
const loaded = {};

section("A/B/C — every seed file");
for (const file of files) {
  const trade = file.replace(/\.js$/, "");
  const text = readFileSync(path.join(folder, file), "utf8");
  ok(!/housecall|\bhcp\b/i.test(text), `${file}: names no competitor`);
  let mod;
  try {
    mod = await import(pathToFileURL(path.join(folder, file)).href);
  } catch (e) {
    ok(false, `${file}: parses`, e.message);
    continue;
  }
  const seed = mod.SEED;
  ok(seed && typeof seed === "object", `${file}: exports SEED`);
  if (!seed) continue;
  loaded[trade] = seed;
  ok(seed.trade === trade, `${file}: trade matches the file name`, seed.trade);
  ok(Object.hasOwn(TRADE_CATALOG, seed.trade), `${file}: trade "${seed.trade}" is in the catalogue`);
  ok(Array.isArray(seed.categories) && seed.categories.length > 0, `${file}: has categories`);
  ok(Array.isArray(seed.services) && seed.services.length > 0, `${file}: has services`);

  let sourceMap = new Set();
  try {
    const rows = JSON.parse(readFileSync(path.join(folder, "..", "..", "..", "scripts", "service-seeds", "source-map", file.replace(/\.js$/, ".json")), "utf8"));
    ok(Array.isArray(rows) && rows.every((r) => r.seedKey && r.industry && r.sourceService), `${file}: source map rows carry seedKey, industry, sourceService`);
    sourceMap = new Set(rows.map((r) => r.seedKey));
    ok(rows.length === (seed.services || []).length, `${file}: source map has one row per service`, [rows.length, (seed.services || []).length]);
    ok(rows.every((r) => (seed.services || []).some((x) => x.seedKey === r.seedKey)), `${file}: every source map row names a seed key in the file`);
  } catch (e) {
    ok(false, `${file}: scripts/service-seeds/source-map/${trade}.json exists and parses`, e.message);
  }
  const cats = new Map();
  for (const c of seed.categories || []) {
    ok(/^[a-z0-9_]+$/.test(c.key || ""), `${file}: category key "${c.key}" is a slug`);
    ok(!cats.has(c.key), `${file}: category key "${c.key}" is unique`);
    cats.set(c.key, c);
    for (const lang of SEED_LANGUAGES) {
      ok(typeof c.name?.[lang] === "string" && c.name[lang].trim().length > 1, `${file}: category "${c.key}" has a ${lang} name`);
    }
    ok(!(c.name?.en === c.name?.fr && c.name?.en === c.name?.es), `${file}: category "${c.key}" is not the same word in all three languages`, c.name);
  }

  for (const s of seed.services || []) {
    const id = `${file}:${s.seedKey}`;
    const m = KEY_RE.exec(s.seedKey || "");
    ok(Boolean(m), `${id}: seedKey matches fq.<trade>.<category>.<slug>`);
    if (m) {
      ok(m[1] === trade, `${id}: seedKey starts with the trade`);
      ok(m[2] === s.category, `${id}: seedKey's middle segment is the category key`, [m[2], s.category]);
      ok(!/^default_|_service_\d+$/i.test(s.seedKey), `${id}: seedKey is our own pattern, not the source's task code`);
    }
    ok(!seenKeys.has(s.seedKey), `${id}: seedKey unique across trades`, seenKeys.get(s.seedKey));
    seenKeys.set(s.seedKey, file);
    ok(cats.has(s.category), `${id}: category "${s.category}" is declared`);
    for (const lang of SEED_LANGUAGES) {
      ok(typeof s.name?.[lang] === "string" && s.name[lang].trim().length >= 3 && s.name[lang].length <= 90, `${id}: ${lang} name present, 3–90 chars`, s.name?.[lang]);
      ok(typeof s.description?.[lang] === "string" && s.description[lang].trim().length >= 25 && s.description[lang].length <= 320, `${id}: ${lang} description present, 25–320 chars`, s.description?.[lang]?.length);
      ok(!/\$|\bUSD\b|\bCAD\b/.test(s.description?.[lang] || ""), `${id}: ${lang} description carries no money`);
    }
    const n = s.name || {};
    ok(!(n.en === n.fr && n.en === n.es), `${id}: name is not identical in all three languages`, n);
    const d = s.description || {};
    ok(d.en !== d.fr && d.en !== d.es && d.fr !== d.es, `${id}: descriptions differ per language`);
    // A French or Spanish description pasted from English carries English
    // function words no French/Spanish sentence does.
    ok(!/\b(the|and|with|your)\b/i.test(d.fr || ""), `${id}: fr description is French`, d.fr);
    ok(!/\b(the|and|with|your)\b/i.test(d.es || ""), `${id}: es description is Spanish`, d.es);
    ok(SEED_UNITS.includes(s.unit), `${id}: unit in ${SEED_UNITS.join("/")}`, s.unit);
    ok(typeof s.bookable === "boolean", `${id}: bookable is a boolean`);
    ok(s.durationMinutes === null || (Number.isInteger(s.durationMinutes) && s.durationMinutes > 0), `${id}: durationMinutes null or a positive integer`, s.durationMinutes);
    ok(s.pricedBy === undefined || ["takeoff", "book"].includes(s.pricedBy), `${id}: pricedBy is takeoff/book or absent`, s.pricedBy);
    if (s.pricedBy === "takeoff") ok(TAKEOFF_TRADES.includes(trade), `${id}: takeoff-priced only in a takeoff trade`);
    if (s.pricedBy === "book") ok(hasPriceBook(trade), `${id}: book-priced only in a trade with a price book`);
    ok(s.existing === undefined || (typeof s.existing === "string" && s.existing.length > 10), `${id}: existing note is a sentence or absent`);

    const b = s.benchmark;
    ok(b === null || (b && typeof b === "object"), `${id}: benchmark is null or an object`);
    if (b) {
      ok(Number.isFinite(b.median) && b.median > 0, `${id}: median > 0`, b.median);
      ok(b.low === null || (Number.isFinite(b.low) && b.low > 0), `${id}: low null or > 0`, b.low);
      ok(b.high === null || (Number.isFinite(b.high) && b.high > 0), `${id}: high null or > 0`, b.high);
      if (b.low != null) ok(b.low <= b.median, `${id}: low ≤ median`, [b.low, b.median]);
      if (b.high != null) ok(b.median <= b.high, `${id}: median ≤ high`, [b.median, b.high]);
      ok(b.currency === "USD", `${id}: benchmark currency USD`, b.currency);
      ok(b.source === "benchmark", `${id}: benchmark source "benchmark"`, b.source);
      ok(/^\d{4}-\d{2}-\d{2}$/.test(b.asOf || ""), `${id}: benchmark asOf is a date`, b.asOf);
      ok(!("base" in b) && !("p25" in b) && !("p75" in b), `${id}: no base/p25/p75 stored`);
    }
    // The private join-back map (scripts/, never shipped) names every key.
    ok(sourceMap.has(s.seedKey), `${id}: present in scripts/service-seeds/source-map/${trade}.json`);
    // C — none of the source's sentences, in any language field.
    for (const lang of SEED_LANGUAGES) {
      for (const h of sentenceHashes(d[lang] || "")) ok(!hashes.has(h), `${id}: ${lang} description is not a source sentence`);
      for (const h of sentenceHashes(n[lang] || "")) ok(!hashes.has(h), `${id}: ${lang} name is not a source sentence`);
    }
  }
}

if (only) {
  console.log(`\n${passed} passed, ${fail} failed (file ${only})`);
  process.exit(fail ? 1 : 0);
}

section("G — the index");
{
  const indexed = Object.keys(SERVICE_SEEDS).sort();
  const onDisk = files.map((f) => f.replace(/\.js$/, "")).sort();
  ok(JSON.stringify(indexed) === JSON.stringify(onDisk), "index registers exactly the files on disk", { indexed: indexed.filter((k) => !onDisk.includes(k)), onDisk: onDisk.filter((k) => !indexed.includes(k)) });
  for (const k of indexed) ok(SERVICE_SEEDS[k] === loaded[k], `index entry ${k} is the file's SEED`);
  ok(serviceSeedsFor("no_such_trade") === null, "serviceSeedsFor unknown → null");
  ok(serviceSeedsFor("constructor") === null, "serviceSeedsFor('constructor') → null, not Object's");
}

section("D — takeoff-priced services never get a flat price");
{
  let takeoffSeen = 0;
  for (const [trade, seed] of Object.entries(loaded)) {
    const plan = planServiceSeeds({ seed, existingSeedKeys: [] });
    const ref = seed.services.filter((s) => s.pricedBy);
    takeoffSeen += ref.length;
    ok(plan.referenceOnly === ref.length, `${trade}: referenceOnly counts the pricedBy services`, [plan.referenceOnly, ref.length]);
    ok(plan.toCreate.every((s) => !s.pricedBy), `${trade}: nothing pricedBy is in toCreate`);
    ok(seedableServices(seed).every((s) => !s.pricedBy), `${trade}: seedableServices excludes pricedBy`);
  }
  ok(takeoffSeen > 0, "at least one takeoff-priced service exists to exercise the rule (painting/roofing)", takeoffSeen);
}

section("E — idempotent seeding on a fixture company");
{
  const seed = {
    trade: "fixture",
    categories: [{ key: "c", name: { en: "C", fr: "C-fr", es: "C-es" } }],
    services: [
      { seedKey: "fixture.c.a", category: "c", name: { en: "A", fr: "A-fr", es: "A-es" }, description: { en: "A desc", fr: "A desc fr", es: "A desc es" }, unit: "flat", benchmark: { low: 100, median: 200, high: 300, currency: "USD", source: "benchmark", asOf: "2026-09-21" }, durationMinutes: null, bookable: false },
      { seedKey: "fixture.c.b", category: "c", name: { en: "B", fr: "B-fr", es: "B-es" }, description: { en: "B desc", fr: "B desc fr", es: "B desc es" }, unit: "sqft", benchmark: null, durationMinutes: 60, bookable: true },
      { seedKey: "fixture.c.t", category: "c", name: { en: "T", fr: "T-fr", es: "T-es" }, description: { en: "T desc", fr: "T desc fr", es: "T desc es" }, unit: "sqft", benchmark: { low: 1, median: 2, high: 3, currency: "USD", source: "benchmark", asOf: "2026-09-21" }, durationMinutes: null, bookable: false, pricedBy: "takeoff" },
    ],
  };
  const first = planServiceSeeds({ seed, existingSeedKeys: [] });
  ok(first.toCreate.map((s) => s.seedKey).join() === "fixture.c.a,fixture.c.b", "first run creates the two flat-priced services", first.toCreate.map((s) => s.seedKey));
  ok(first.referenceOnly === 1 && first.skipped === 0 && first.total === 3, "first run counts", first);
  const held = first.toCreate.map((s) => s.seedKey);
  const second = planServiceSeeds({ seed, existingSeedKeys: held });
  ok(second.toCreate.length === 0 && second.skipped === 2, "second run creates nothing", second);
  // The company renamed and repriced A — the plan only sees the key, so it
  // cannot touch the row, and the row is never in `toCreate`.
  const renamed = planServiceSeeds({ seed, existingSeedKeys: ["fixture.c.a"] });
  ok(renamed.toCreate.map((s) => s.seedKey).join() === "fixture.c.b", "a renamed/repriced row is kept, the missing one added", renamed.toCreate.map((s) => s.seedKey));
  const grown = { ...seed, services: [...seed.services, { ...seed.services[1], seedKey: "fixture.c.new" }] };
  const third = planServiceSeeds({ seed: grown, existingSeedKeys: held });
  ok(third.toCreate.map((s) => s.seedKey).join() === "fixture.c.new", "a seed that gains a service adds only the new key");
  ok(planServiceSeeds({ seed: null }).toCreate.length === 0, "no seed → nothing to create");
  ok(planServiceSeeds({ seed, existingSeedKeys: "fixture.c.a" }).toCreate.length === 2, "a non-array existing list is treated as empty, not iterated as characters");

  // What is written.
  const cad = productDataForSeed(seed.services[0], { companyId: "co", categoryId: "cat", language: "fr", currency: "CAD" });
  ok(cad.seedKey === "fixture.c.a", "seedKey is written");
  ok(cad.unitPrice === 275, "CAD company: median 200 USD × 1.37 = 274 → 275", cad.unitPrice);
  ok(cad.name === "A-fr" && cad.description === "A desc fr", "French company gets the French text as its own", cad);
  ok(cad.translations.en.name === "A" && cad.translations.es.name === "A-es" && !cad.translations.fr, "the other two languages travel as translations", cad.translations);
  ok(cad.categories.connect.id === "cat" && cad.type === "service" && cad.unit === "flat", "linked to the trade, typed service, unit carried", cad);
  const usd = productDataForSeed(seed.services[0], { companyId: "co", categoryId: "cat", language: "en", currency: "USD" });
  ok(usd.unitPrice === 200 && usd.name === "A" && !usd.translations.en && usd.translations.fr.name === "A-fr", "USD/English company: median as-is, en as source", usd);
  const none = productDataForSeed(seed.services[1], { companyId: "co", categoryId: "cat", language: "de", currency: "CAD" });
  ok(none.unitPrice === null, "no benchmark → no price, never a placeholder", none.unitPrice);
  ok(none.name === "B" && none.translations.fr && none.translations.es && !none.translations.en, "unsupported default language falls back to English source", none);
  const t = seedText(seed.services[0], "es");
  ok(t.name === "A-es" && t.translations.en && t.translations.fr && !t.translations.es, "seedText for es");
}

section("F — the CAD conversion");
{
  ok(USD_TO_CAD_SUGGESTED === 1.37 && /^\d{4}-\d{2}-\d{2}$/.test(USD_TO_CAD_SUGGESTED_AS_OF), "one constant, dated");
  ok(roundSuggested(331.45) === 330 && roundSuggested(332.5) === 335, "≥ $20 rounds to $5");
  ok(roundSuggested(6.85) === 7, "≥ $5 rounds to $1");
  ok(roundSuggested(1.71) === 1.75 && roundSuggested(0.62) === 0.5, "< $5 rounds to $0.25");
  ok(roundSuggested(0) === null && roundSuggested(-4) === null && roundSuggested("x") === null, "zero/negative/garbage → null");
  ok(suggestedIn(325, "CAD") === 445, "325 USD → 445.25 → 445 CAD", suggestedIn(325, "CAD"));
  ok(suggestedIn(325, "USD") === 325, "USD passes through");
  ok(suggestedIn(325, "EUR") === null && suggestedIn(null, "CAD") === null && suggestedIn(0, "CAD") === null, "unsupported currency / null / zero → null");
  ok(suggestedIn(1.25, "CAD") === 1.75, "a per-sq-ft rate does not round to zero", suggestedIn(1.25, "CAD"));
  const r = benchmarkIn({ low: 250, median: 325, high: 450, currency: "USD", source: "benchmark", asOf: "2026-09-21" }, "CAD");
  ok(r && r.low === 345 && r.median === 445 && r.high === 615 && r.currency === "CAD" && r.converted === true, "a range converts all three, rounded", r);
  const p = benchmarkIn({ low: null, median: 75, high: null, currency: "USD", source: "benchmark" }, "CAD");
  ok(p && p.low === null && p.high === null && p.median === 105, "a point stays a point — no padded low/high", p);
  const same = benchmarkIn({ low: 250, median: 325, high: 450, currency: "USD", source: "benchmark" }, "USD");
  ok(same && same.converted === false && same.median === 325, "USD company sees USD unconverted");
  const fq = benchmarkIn({ low: 300, median: 400, high: 500, currency: "CAD", source: "fieldquo_median" }, "CAD");
  ok(fq && fq.converted === false && fq.median === 400 && fq.source === "fieldquo_median", "the future FieldQuo median passes through (the seam)");
  ok(benchmarkIn(null, "CAD") === null && benchmarkIn({ median: 0 }, "CAD") === null && benchmarkIn({ median: 5 }, "GBP") === null, "no range / zero median / unknown currency → null");
}

section("B — trade summaries and the index of keys");
{
  for (const trade of Object.keys(loaded)) {
    const s = tradeBenchmarkSummary(trade);
    ok(s && s.total === loaded[trade].services.length, `${trade}: summary total`, s);
    const medians = loaded[trade].services.map((x) => x.benchmark?.median).filter((n) => n > 0);
    ok(s.withRange === medians.length, `${trade}: withRange counts services with a median`, [s.withRange, medians.length]);
    if (medians.length) ok(s.medianOfMedians >= Math.min(...medians) && s.medianOfMedians <= Math.max(...medians), `${trade}: median of medians inside the medians`, s.medianOfMedians);
    else ok(s.medianOfMedians === null, `${trade}: no medians → null summary, not zero`);
  }
  ok(tradeBenchmarkSummary("no_such") === null, "summary for unknown trade → null");
  const any = Object.values(loaded).flatMap((s) => s.services).find((s) => s.benchmark);
  if (any) ok(benchmarkForSeedKey(any.seedKey)?.median === any.benchmark.median, "benchmarkForSeedKey finds a range by key");
  ok(benchmarkForSeedKey("nope") === null && benchmarkForSeedKey("") === null, "benchmarkForSeedKey unknown → null");
}

section("I — one row per shared service");
{
  // A service many trades sell lives once and is tagged (`categories`) for
  // the others; two rows with the same name offered on the same quote type
  // would put the same service in a company's list twice.
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const rows = [];
  for (const [trade, seed] of Object.entries(loaded)) {
    for (const s of seed.services || []) rows.push({ key: s.seedKey, name: norm(s.name?.en), cats: new Set([trade, ...(Array.isArray(s.categories) ? s.categories : [])]) });
  }
  const byName = new Map();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) || []), r]);
  let pairs = 0;
  for (const [name, group] of byName) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      pairs++;
      const shared = [...group[i].cats].filter((c) => group[j].cats.has(c));
      ok(shared.length === 0, `"${name}": ${group[i].key} and ${group[j].key} share quote types`, shared);
    }
  }
  const tagged = rows.filter((r) => r.cats.size > 1).length;
  ok(tagged > 0, "some shared services are tagged for more than one quote type", tagged);
  // Every tag names a trade the catalogue ships.
  for (const r of rows) for (const c of r.cats) ok(Object.hasOwn(TRADE_CATALOG, c), `${r.key}: tag "${c}" is a catalogue trade`);
}

section("H — the screens read what seeding writes");
{
  const schema = read("prisma/schema.prisma");
  const productModel = schema.slice(schema.indexOf("model Product {"), schema.indexOf("\n}\n", schema.indexOf("model Product {")));
  ok(/seedKey\s+String\?/.test(productModel), "Product.seedKey exists in the schema");
  ok(/@@index\(\[companyId, seedKey\]\)/.test(productModel), "Product has an index on (companyId, seedKey)");
  const seeder = read("lib/products/seedServices.js");
  ok(seeder.includes("seedKey: { not: null }"), "seeder reads seedKey back to skip what the company holds");
  const card = read("app/app/settings/services/ServiceSeedsCard.js");
  ok(card.includes("benchmarkIn(") && card.includes("tradeBenchmarkSummary("), "Settings > Services card reads the range and the trade summary");
  ok(card.includes("app.serviceSeeds.rangeNote"), "the card carries the 'set your own rate' wording key");
  ok(card.includes("/api/settings/products/seed-services"), "the card's 'Add missing services' posts to the seed route");
  // The price editor is the catalogue's Add / Edit Item form, which lives
  // beside it since 2026-09-24 (ProductFormModal.js — shared with the
  // "Confirm what you quote" screen); both files are the editor.
  const editor = read("app/app/settings/products/ProductCatalogue.js") + read("app/app/settings/products/ProductFormModal.js");
  ok(editor.includes("BenchmarkRange") && editor.includes("seedKey"), "the price editor shows the range for a seeded product");
  const shared = read("app/components/pricing/BenchmarkRange.js");
  ok(shared.includes("app.serviceSeeds.useTypical"), "one shared range component carries the 'Use typical' button");
  const route = read("app/api/settings/products/seed-services/route.js");
  ok(route.includes("seedServicesForTrade(") && /owner.*admin|admin.*owner/.test(route), "seed route calls the seeder and is owner/admin only");
  // Signup seeds through lib/signup/setupStages.js since 2026-09-25: inline
  // (runSetupInline) from /api/companies, or streamed stage by stage from
  // /api/signup/setup behind the progress screen. Both reach the services
  // stage, which is where the seeder is called.
  const signup = read("app/api/companies/route.js");
  const stagesLib = read("lib/signup/setupStages.js");
  const setupRoute = read("app/api/signup/setup/route.js");
  ok(
    signup.includes("runSetupInline(") &&
      setupRoute.includes("runSetupStage(") &&
      stagesLib.includes("call(seeders.seedServicesForTrade, t") &&
      stagesLib.includes("seedServicesForTrade,"),
    "signup seeds the selected trades",
  );
  const patch = read("app/api/settings/service-categories/route.js");
  ok(patch.includes("seedServicesForTrade("), "enabling a trade seeds it");
  const messages = read("app/i18n/appMessages.js");
  for (const key of ["app.serviceSeeds.rangeNote", "app.serviceSeeds.useTypical", "app.serviceSeeds.addMissing", "app.serviceSeeds.setYourRate", "app.serviceSeeds.typicalForTrade"]) {
    const n = messages.split(`"${key}"`).length - 1;
    ok(n >= 3, `${key} present in at least en/fr/es`, n);
  }
  // Never presented as a fact, never as the source's.
  ok(!/housecall/i.test(card + shared + editor + messages.slice(messages.indexOf("app.serviceSeeds"))), "no competitor named on any screen");
  // Client-facing surfaces never import the seeds or the benchmark.
  const { execSync } = await import("node:child_process");
  const hits = execSync(
    `grep -rl "serviceSeeds\\|benchmarkFx\\|lib/services/seeds" app/quote app/book app/q app/portal app/site app/embed app/api/self-quote app/api/booking app/api/public 2>/dev/null || true`,
    { cwd: new URL(root).pathname, encoding: "utf8" },
  ).trim();
  ok(hits === "", "no client-facing route imports the seeds or the benchmark", hits);
}

// ── A removed service stays removed (2026-09-25) ────────────────────────────
//
// "Confirm what you quote" and Settings › Products & Services remove a service
// by setting Product.active = false (lib/products/offered.js). The seeder must
// count that row as HELD — or "Add missing services" and a trade switched
// back on would quietly put back what the owner took out, as a second copy.
// Executed against the db stub: the write path, not a reading of it.
{
  const { rows, writes, resetDbStub } = await import("@/lib/db");
  const { createSeededServices } = await import("@/lib/products/seedServices");
  resetDbStub();
  const plumbing = seedableServices(serviceSeedsFor("plumbing"));
  const [gone, kept] = plumbing;
  rows.company.push({ id: "co_s", defaultLanguage: "en", currency: "USD", country: "US" });
  rows.product.push(
    { id: "p_gone", companyId: "co_s", seedKey: gone.seedKey, name: "Mine", unitPrice: 1, active: false },
    { id: "p_kept", companyId: "co_s", seedKey: kept.seedKey, name: "Mine too", unitPrice: 2, active: true },
  );
  const r = await createSeededServices({ companyId: "co_s", categoryId: "cat_plumbing", categoryKey: "plumbing", services: plumbing.slice(0, 5) });
  ok(r.created === 3 && r.skipped === 2, "the seeder skips a removed key exactly as it skips a kept one", JSON.stringify(r));
  ok(rows.product.filter((p) => p.seedKey === gone.seedKey).length === 1, "…never a second copy of the removed service");
  ok(rows.product.find((p) => p.id === "p_gone").active === false, "…and never switches it back on");
  ok(!writes.some((w) => w.model === "product" && w.action !== "create"), "…and writes nothing but creates");
  resetDbStub();
}

console.log(`\n${passed} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
