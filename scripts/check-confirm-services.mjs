// scripts/check-confirm-services.mjs
//
//   npm run check:confirm-services
//
// "Confirm what you quote" (lib/services/confirmServices.js, the step in
// lib/setupSteps.js). Everything below is EXECUTED against the real seed
// files and the real trade catalogue — the table, the resolver, the
// candidate builder and the planner — with hostile input thrown at each:
// an unknown trade, a custom quote type, prototype keys, garbage arrays,
// keys the company already holds, a currency the suggestions cannot convert
// into. The one write (createSeededServices) is read as source for the
// promise that matters — it creates and never updates — because executing it
// needs a database; scripts/check-service-seeds.mjs runs its planner.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-confirm-services.mjs

import { readFileSync } from "node:fs";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { planServiceSeeds, seedableServices, serviceSeedsForCompanyTrade } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import {
  NEAREST_TRADES,
  QUOTE_COVERAGE_MIN,
  candidateGroups,
  candidateServicesFor,
  fileTradeOf,
  nearestTradesFor,
  planConfirmedKeys,
  thinTrades,
  tradeCoverage,
} from "@/lib/services/confirmServices";
import { productDataForSeed } from "@/lib/products/seedServices";

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
  }
};
const read = (p) => readFileSync(p, "utf8");
const seeded = new Set(Object.keys(SERVICE_SEEDS));
const catalogue = Object.keys(TRADE_CATALOG);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The nearest-trades table\n");

{
  const unseeded = catalogue.filter((k) => !seeded.has(k));
  const missing = unseeded.filter((k) => !Object.hasOwn(NEAREST_TRADES, k));
  ok("every catalogue trade without a seed file has an entry (possibly an honest [])", missing.length === 0, missing.join(","));
  const stray = Object.keys(NEAREST_TRADES).filter((k) => !Object.hasOwn(TRADE_CATALOG, k));
  ok("every entry is a catalogue trade", stray.length === 0, stray.join(","));
  const seededEntries = Object.keys(NEAREST_TRADES).filter((k) => seeded.has(k));
  ok("no entry for a trade that ships its own list (its file is the list)", seededEntries.length === 0, seededEntries.join(","));
  for (const [trade, near] of Object.entries(NEAREST_TRADES)) {
    const bad = near.filter((n) => !seeded.has(n));
    ok(`${trade}: every neighbour is a seeded trade`, bad.length === 0, bad.join(","));
    ok(`${trade}: never names itself, never twice`, !near.includes(trade) && new Set(near).size === near.length);
    ok(`${trade}: at most three neighbours`, near.length <= 3, near.length);
  }
  ok("the owner's example: caulking_sealants → handyman, exterior_painting",
    JSON.stringify(nearestTradesFor("caulking_sealants")) === JSON.stringify(["handyman", "exterior_painting"]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The resolver against hostile input\n");

for (const bad of [undefined, null, "", "nope", "custom_ckx1y2z3", "__proto__", "constructor", "toString", "hasOwnProperty", 42, {}, ["handyman"], "HANDYMAN", "caulking_sealants "]) {
  const got = nearestTradesFor(bad);
  ok(`nearestTradesFor(${JSON.stringify(bad) ?? "undefined"}) is []`, Array.isArray(got) && got.length === 0, JSON.stringify(got));
}
ok("a seeded trade borrows nothing", nearestTradesFor("plumbing").length === 0);
ok("fileTradeOf reads the file from the key", fileTradeOf("fq.handyman.exterior.caulk") === "handyman");
ok("fileTradeOf refuses a key naming no seed file", fileTradeOf("fq.nope.x.y") === null && fileTradeOf("x") === null && fileTradeOf(null) === null && fileTradeOf("fq.__proto__.x.y") === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The candidate builder\n");

{
  for (const bad of [undefined, null, "handyman", 7, {}, [], [null, 3, {}, "nope", "custom_x"]]) {
    const got = candidateServicesFor(bad);
    ok(`candidateServicesFor(${JSON.stringify(bad) ?? "undefined"}) is []`, Array.isArray(got) && got.length === 0, got.length);
  }

  const caulk = candidateServicesFor(["caulking_sealants"]);
  const keys = caulk.map((c) => c.service.seedKey);
  ok("caulking_sealants: candidates exist", caulk.length > 20, caulk.length);
  ok("…no seedKey twice", new Set(keys).size === keys.length);
  ok("…nothing priced by a takeoff is offered as a flat price", caulk.every((c) => !c.service.pricedBy));
  ok("…every row is offered FOR the company's trade", caulk.every((c) => c.forTrade === "caulking_sealants"));
  ok("…the rows tagged for it come first, marked shared", caulk[0].via === "shared" && caulk.findIndex((c) => c.via === "related") > caulk.findLastIndex((c) => c.via === "shared"));
  // A neighbour's list is what a company IN that trade gets: its own file
  // and the rows other files tag for it (gutter cleaning is tagged handyman).
  const neighbourKeys = new Set(
    ["handyman", "exterior_painting"].flatMap((n) => serviceSeedsForCompanyTrade(n).services.map((s) => s.seedKey)),
  );
  ok("…borrowed rows come only from its neighbours' lists", caulk.filter((c) => c.via === "related").every((c) => neighbourKeys.has(c.service.seedKey)));
  const ownTagged = seedableServices(serviceSeedsForCompanyTrade("caulking_sealants")).map((s) => s.seedKey);
  ok("…every row signup would have installed is on the list", ownTagged.every((k) => keys.includes(k)), ownTagged.join(","));

  // Two trades: a row one of them sells outright is filed under it, never
  // borrowed by the other.
  const two = candidateServicesFor(["well_water", "plumbing"]);
  const plumbingRow = two.find((c) => c.fromTrade === "plumbing");
  ok("well_water + plumbing: plumbing's rows are plumbing's own, not borrowed by well_water", plumbingRow && two.filter((c) => c.fromTrade === "plumbing").every((c) => c.forTrade === "plumbing" && c.via === "own"));
  ok("…and the list is plumbing's, once", two.length === seedableServices(serviceSeedsForCompanyTrade("plumbing")).length, two.length);

  ok("a trade with no neighbour and nothing tagged has no candidates (the screen says so)", candidateServicesFor(["marine_services"]).length === 0);
  ok("duplicated trades in the input do not duplicate rows", candidateServicesFor(["caulking_sealants", "caulking_sealants"]).length === caulk.length);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Coverage, and the number that decides the step\n");

{
  ok("QUOTE_COVERAGE_MIN is ten", QUOTE_COVERAGE_MIN === 10);
  // Every seeded trade fully installed must clear the bar, or a plumber who
  // got every row at signup would be asked forever.
  for (const trade of seeded) {
    const all = seedableServices(serviceSeedsForCompanyTrade(trade)).map((s) => s.seedKey);
    const c = tradeCoverage(trade, all);
    ok(`${trade}: fully installed (${c.installed}) clears the bar`, c.ownSeed === true && c.installed >= QUOTE_COVERAGE_MIN && thinTrades([c]).length === 0, c.installed);
  }
  const none = tradeCoverage("plumbing", []);
  ok("plumbing with nothing installed (seeding failed) is thin", none.installed === 0 && thinTrades([none]).length === 1);
  ok("tradeCoverage of an unknown trade: no seed, nothing installed", JSON.stringify(tradeCoverage("nope", ["fq.plumbing.drains.x"])) === JSON.stringify({ key: "nope", ownSeed: false, installed: 0 }));
  ok("tradeCoverage ignores garbage held keys", tradeCoverage("plumbing", [null, 3, {}, "fq.nope"]).installed === 0 && tradeCoverage("plumbing", "fq.x").installed === 0);
  ok("thinTrades of garbage is []", thinTrades(null).length === 0 && thinTrades([null, {}, { key: 5 }]).length === 0);

  // The table the report quotes: what each unseeded trade is offered.
  const rows = catalogue.filter((k) => !seeded.has(k)).map((k) => `${k}=${candidateServicesFor([k]).length}`);
  console.log(`\n  candidates per unseeded trade: ${rows.join(" ")}\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The planner — what a POST may create\n");

{
  const cands = candidateServicesFor(["caulking_sealants"]);
  const a = cands[0].service.seedKey;
  const b = cands.find((c) => c.via === "related").service.seedKey;
  let p = planConfirmedKeys([a, b, a, "fq.plumbing.drains.nope", 7, null, "", {}], cands);
  ok("an unknown key is reported, not dropped", p.unknown.length === 1 && p.unknown[0] === "fq.plumbing.drains.nope", JSON.stringify(p.unknown));
  ok("duplicates and non-strings are ignored", p.requested === 3, p.requested);
  ok("the rows are filed under the company's trade", [...p.byTrade.keys()].join(",") === "caulking_sealants" && p.byTrade.get("caulking_sealants").length === 2);
  p = planConfirmedKeys("fq.x", cands);
  ok("a non-array request plans nothing", p.requested === 0 && p.byTrade.size === 0);
  p = planConfirmedKeys([a], []);
  ok("no candidates: every key is unknown", p.unknown.length === 1);
  p = planConfirmedKeys([...cands.map((c) => c.service.seedKey), "__proto__", "constructor"], cands);
  ok("prototype keys are unknown, not matched", p.unknown.join(",") === "__proto__,constructor", p.unknown.join(","));

  // Already-installed keys: the seeder's own planner skips them — the route
  // passes them through and nothing is created twice.
  const services = cands.slice(0, 5).map((c) => c.service);
  const held = [services[0].seedKey, services[3].seedKey];
  const plan = planServiceSeeds({ seed: { services }, existingSeedKeys: held });
  ok("held keys are skipped by the shared planner, never re-created", plan.toCreate.length === 3 && plan.skipped === 2 && plan.toCreate.every((s) => !held.includes(s.seedKey)));

  // A borrowed row is linked to the COMPANY's trade category first.
  const borrowed = cands.find((c) => c.via === "related").service;
  const data = productDataForSeed(borrowed, { companyId: "co_1", categoryId: "cat_caulk", language: "fr", currency: "CAD" });
  const connect = Array.isArray(data.categories.connect) ? data.categories.connect : [data.categories.connect];
  ok("a borrowed row is linked to the company's own trade", connect[0].id === "cat_caulk");
  ok("…keeps its seedKey, so it is never offered twice", data.seedKey === borrowed.seedKey);
  ok("…is priced by the same conversion the screen showed", data.unitPrice === (suggestedIn(borrowed.benchmark?.median, "CAD") ?? null));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The groups the screen renders\n");

{
  const cands = candidateServicesFor(["caulking_sealants"]);
  const heldKey = cands[1].service.seedKey;
  const en = candidateGroups(cands, { language: "en", currency: "USD", heldSeedKeys: [heldKey] });
  const flat = en.flatMap((g) => g.services);
  ok("every candidate lands in exactly one group", flat.length === cands.length);
  ok("a held row is flagged held", flat.find((s) => s.seedKey === heldKey)?.held === true && flat.filter((s) => s.held).length === 1);
  ok("every group has a heading", en.every((g) => typeof g.name === "string" && g.name.trim()));
  ok("USD prices are the benchmark median, untouched", cands.every((c) => flat.find((s) => s.seedKey === c.service.seedKey).price === suggestedIn(c.service.benchmark?.median, "USD")));
  const withMedian = cands.find((c) => Number(c.service.benchmark?.median) > 0);
  const cad = candidateGroups(cands, { language: "en", currency: "CAD" }).flatMap((g) => g.services);
  ok("CAD prices are converted and rounded to $5", withMedian && cad.find((s) => s.seedKey === withMedian.service.seedKey).price % 5 === 0);
  const eur = candidateGroups(cands, { language: "en", currency: "EUR" }).flatMap((g) => g.services);
  ok("a currency the suggestions cannot convert into shows no price (\"set your rate\"), never a USD figure", eur.every((s) => s.price === null));
  const noMedian = cands.find((c) => !c.service.benchmark);
  if (noMedian) ok("a row with no benchmark has no price", cad.find((s) => s.seedKey === noMedian.service.seedKey).price === null);
  const fr = candidateGroups(cands, { language: "fr", currency: "CAD" }).flatMap((g) => g.services);
  ok("French text for a French company", fr.find((s) => s.seedKey === cands[0].service.seedKey).name === cands[0].service.name.fr);
  const zh = candidateGroups(cands, { language: "zh", currency: "CAD" }).flatMap((g) => g.services);
  ok("a language the seed does not carry falls back to English, never a guess", zh.find((s) => s.seedKey === cands[0].service.seedKey).name === cands[0].service.name.en);
  ok("garbage in, [] out", candidateGroups(null).length === 0 && candidateGroups("x").length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The write is create-only, and the screen sends keys only\n");

{
  const seeder = read("lib/products/seedServices.js").replace(/^\s*\/\/.*$/gm, "");
  ok("createSeededServices never updates or upserts a Product", !/product\.(update|updateMany|upsert)\(/.test(seeder));
  ok("seedServicesForTrade writes through createSeededServices", /await createSeededServices\(\{ companyId, categoryId, categoryKey, services: seed\.services \}\)/.test(seeder));
  const route = read("app/api/settings/products/confirm-services/route.js");
  ok("the route never reads a price or a name from the body", !/body\??\.(unitPrice|price|name)/.test(route));
  ok("the route builds candidates from the company's own trades", /candidateServicesFor\(trades\.map\(\(t\) => t\.key\)\)/.test(route) && /where: \{ companyId, enabled: true, category: \{ companyId: null \} \}/.test(route));
  ok("the route caps the request", /MAX_KEYS = 1000/.test(route) && /raw\.length > MAX_KEYS/.test(route));
}

console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
