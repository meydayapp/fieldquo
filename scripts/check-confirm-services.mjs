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
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs --import ./scripts/member-stub-loader.mjs scripts/check-confirm-services.mjs

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
  heldState,
  nearestTradesFor,
  planConfirmedKeys,
  planServiceChanges,
  thinTrades,
  tradeCoverage,
} from "@/lib/services/confirmServices";
import {
  emptySelection,
  groupCount,
  isChecked,
  pendingChanges,
  rowState,
  selectedRows,
  setRows,
  toggleRow,
} from "@/lib/services/confirmSelection";
import { isAddedForYou, signupSeededRows, SIGNUP_SEED_WINDOW_MS } from "@/lib/services/addedForYou";
import { isOffered, offeredOnly, removedOnly } from "@/lib/products/offered";
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
  ok("the route caps both lists", /MAX_KEYS = 1000/.test(route) && /raw\.length <= MAX_KEYS/.test(route) && /!listOfKeys\(raw\) \|\| !listOfKeys\(rawRemove\)/.test(route));
  const screen = read("app/app/settings/services/ConfirmServices.js").replace(/^\s*\/\/.*$/gm, "");
  ok("the screen posts two lists of KEYS and nothing else", /body: \{ seedKeys: add, removeSeedKeys: remove \}/.test(screen) && !/body: \{[^}]*(price|name|unitPrice|id:)/.test(screen));
  ok("the route never deletes a Product", !/product\.(delete|deleteMany)\(/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. The selection model — counts, the Selected tab, the POST lists\n");

{
  const cands = candidateServicesFor(["caulking_sealants"]);
  const g0 = candidateGroups(cands, { language: "en", currency: "USD" })[0];
  const three = g0.services.slice(0, 3).map((s) => s.seedKey);
  // The screenshot's case: every row of a group already in the list.
  const groups = candidateGroups(cands, { language: "en", currency: "USD", heldSeedKeys: g0.services.map((s) => s.seedKey) });
  const g = groups[0];
  let sel = emptySelection();
  ok(`a group whose rows are all in the list counts ${g.services.length} of ${g.services.length}, not 0 of 0`,
    JSON.stringify(groupCount(g.services, sel)) === JSON.stringify({ n: g.services.length, total: g.services.length }), JSON.stringify(groupCount(g.services, sel)));
  ok("…every held row is checked", g.services.every((s) => isChecked(s, sel)));
  sel = toggleRow(sel, g.services[0]);
  ok("unticking a held row puts its key in `remove`, never `add`", sel.remove.has(g.services[0].seedKey) && sel.add.size === 0);
  ok("…the count drops by one", groupCount(g.services, sel).n === g.services.length - 1);
  ok("…the row reads 'removing' (Removed from your list — Undo)", rowState(g.services[0], sel) === "removing");
  ok("…and it is off the Selected tab", !selectedRows(groups, sel).some((r) => r.seedKey === g.services[0].seedKey));
  sel = toggleRow(sel, g.services[0]);
  ok("Undo (a second toggle) puts it back, and nothing is pending", sel.remove.size === 0 && sel.add.size === 0 && rowState(g.services[0], sel) !== "removing");
  const allOff = setRows(emptySelection(), g.services, false);
  ok("Clear on an all-held group removes every row", allOff.remove.size === g.services.length && groupCount(g.services, allOff).n === 0);
  const allOn = setRows(allOff, g.services, true);
  ok("Select all after Clear leaves nothing pending", allOn.remove.size === 0 && allOn.add.size === 0 && groupCount(g.services, allOn).n === g.services.length);

  // Mixed: one held, one archived, the rest suggestions.
  const other = groups.find((x) => x !== g && x.services.length >= 3) || groups[1];
  const [heldRow, archivedRow, newRow] = other.services;
  const mixed = candidateGroups(cands, {
    language: "en",
    currency: "USD",
    heldSeedKeys: [heldRow.seedKey],
    archivedSeedKeys: [archivedRow.seedKey, heldRow.seedKey],
    addedForYouKeys: [heldRow.seedKey, archivedRow.seedKey],
  }).find((x) => x.key === other.key);
  const H = mixed.services.find((s) => s.seedKey === heldRow.seedKey);
  const A = mixed.services.find((s) => s.seedKey === archivedRow.seedKey);
  const N = mixed.services.find((s) => s.seedKey === newRow.seedKey);
  ok("a key in the list is held, never archived, whatever else is passed", H.held === true && H.archived === false && H.addedForYou === true);
  ok("a removed key is archived, not held, and never 'Added for you'", A.held === false && A.archived === true && A.addedForYou === false);
  sel = emptySelection();
  ok("a removed row is listed unticked: 'Removed — tick to add back'", !isChecked(A, sel) && rowState(A, sel) === "removed");
  ok("the Selected tab excludes a removed row", !selectedRows([mixed], sel).some((r) => r.seedKey === A.seedKey));
  ok("…and a suggestion nobody ticked", !selectedRows([mixed], sel).some((r) => r.seedKey === N.seedKey));
  ok("…and includes the held row, with its group's name", selectedRows([mixed], sel).some((r) => r.seedKey === H.seedKey && r.groupName === mixed.name));
  sel = toggleRow(toggleRow(sel, A), N);
  ok("ticking a removed row reads 'Will be added back'", rowState(A, sel) === "restoring" && isChecked(A, sel));
  const sr = selectedRows([mixed], sel).map((r) => r.seedKey);
  ok("Selected = held + ticked (a restored row and a new one)", sr.includes(H.seedKey) && sr.includes(A.seedKey) && sr.includes(N.seedKey) && sr.length === 3, sr.join(","));
  ok("the filter box narrows the Selected tab too", selectedRows([mixed], sel, "zzz-no-such-service").length === 0 && selectedRows([mixed], sel, H.name.slice(0, 4)).some((r) => r.seedKey === H.seedKey));
  sel = toggleRow(sel, H);
  ok("POST lists: sorted keys, adds and removes apart", JSON.stringify(pendingChanges(sel)) === JSON.stringify({ add: [A.seedKey, N.seedKey].sort(), remove: [H.seedKey] }));
  ok("a key offered in two groups is listed once on the Selected tab", selectedRows([mixed, mixed], sel).length === selectedRows([mixed], sel).length);
  ok("garbage in, nothing out", selectedRows(null, sel).length === 0 && groupCount(null, sel).total === 0 && !isChecked(null, sel) && rowState({}, sel) === "offered");
  void three;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The change planner — untick archives, re-tick restores, strangers refused\n");

{
  const cands = candidateServicesFor(["caulking_sealants"]);
  const [k1, k2, k3, k4] = cands.map((c) => c.service.seedKey);
  const heldRows = [
    { seedKey: k1, active: true },
    { seedKey: k2, active: false },
  ];
  let p = planServiceChanges({ add: [], remove: [k1], candidates: cands, heldRows });
  ok("untick a held key → archive, nothing created or restored", p.archive.join() === k1 && p.restore.length === 0 && p.create.size === 0 && p.unknown.length === 0);
  p = planServiceChanges({ add: [k2], remove: [], candidates: cands, heldRows });
  ok("re-tick a removed key → restore, never create", p.restore.join() === k2 && p.create.size === 0);
  p = planServiceChanges({ add: [k1], remove: [], candidates: cands, heldRows });
  ok("tick a key already in the list → nothing to do", p.restore.length === 0 && p.create.size === 0 && p.unknown.length === 0);
  p = planServiceChanges({ add: [k3], remove: [], candidates: cands, heldRows });
  ok("tick a suggestion → create under the company's trade", p.create.get("caulking_sealants")?.[0]?.seedKey === k3);
  p = planServiceChanges({ add: [], remove: [k4], candidates: cands, heldRows });
  ok("removing a key the company does not hold (another company's, or never seeded) is unknown", p.unknown.join() === k4 && p.archive.length === 0);
  p = planServiceChanges({ add: [], remove: [k2], candidates: cands, heldRows });
  ok("removing an already-removed key is a no-op, not an error", p.unknown.length === 0 && p.archive.length === 0);
  p = planServiceChanges({ add: [k1], remove: [k1], candidates: cands, heldRows });
  ok("the same key in both lists is a conflict, planned for neither", p.conflicting.join() === k1 && p.archive.length === 0 && p.restore.length === 0);
  p = planServiceChanges({ add: ["fq.plumbing.nope.x", "__proto__"], remove: ["constructor", 5, null], candidates: cands, heldRows });
  ok("garbage and prototype keys are unknown", p.unknown.includes("fq.plumbing.nope.x") && p.unknown.includes("__proto__") && p.unknown.includes("constructor"));
  p = planServiceChanges({ add: [k2], remove: [], candidates: [], heldRows });
  ok("a held removed key restores even when it is no longer a candidate (the trade was switched off)", p.restore.join() === k2 && p.unknown.length === 0);
  p = planServiceChanges();
  ok("no arguments plans nothing", p.requested === 0 && p.create.size === 0);
  const hs = heldState([{ seedKey: k1, active: false }, { seedKey: k1, active: true }, { seedKey: k2, active: false }, null, { seedKey: 3 }]);
  ok("heldState: a key with ANY active row is in the list; only-inactive is archived", hs.active.has(k1) && !hs.archived.has(k1) && hs.archived.has(k2) && hs.active.size === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. 'Added for you' — the badge rule, and the signup count\n");

{
  const cands = candidateServicesFor(["caulking_sealants"]);
  const priced = cands.find((c) => Number(c.service.benchmark?.median) > 0).service;
  const unpriced = cands.find((c) => !(Number(c.service.benchmark?.median) > 0))?.service;
  const cad = suggestedIn(priced.benchmark.median, "CAD");
  const row = (over = {}) => ({ seedKey: priced.seedKey, name: priced.name.en, unitPrice: cad, ...over });
  ok("seeded, untouched → Added for you", isAddedForYou(row(), { currency: "CAD" }) === true);
  ok("…a Prisma-Decimal-like price string compares by value", isAddedForYou(row({ unitPrice: String(cad) }), { currency: "CAD" }) === true);
  ok("…the seed's French name counts (the company changed its language later)", isAddedForYou(row({ name: priced.name.fr }), { currency: "CAD" }) === true);
  ok("renamed → In your list", isAddedForYou(row({ name: `${priced.name.en} (mine)` }), { currency: "CAD" }) === false);
  ok("repriced → In your list", isAddedForYou(row({ unitPrice: cad + 5 }), { currency: "CAD" }) === false);
  ok("price cleared on a priced seed → In your list", isAddedForYou(row({ unitPrice: null }), { currency: "CAD" }) === false);
  ok("typed by the company (no seedKey) → In your list", isAddedForYou(row({ seedKey: null }), { currency: "CAD" }) === false);
  ok("a key the seeds no longer hold → In your list (never a claim we can't check)", isAddedForYou(row({ seedKey: "fq.nope.x.y" }), { currency: "CAD" }) === false);
  if (unpriced) {
    ok("an unpriced seed left unpriced → Added for you", isAddedForYou({ seedKey: unpriced.seedKey, name: unpriced.name.en, unitPrice: null }, { currency: "CAD" }) === true);
    ok("an unpriced seed the company priced → In your list", isAddedForYou({ seedKey: unpriced.seedKey, name: unpriced.name.en, unitPrice: 40 }, { currency: "CAD" }) === false);
  }
  ok("garbage → false", [null, undefined, 5, "x", {}].every((v) => isAddedForYou(v, { currency: "CAD" }) === false));

  const born = new Date("2026-09-01T12:00:00Z");
  const at = (min) => new Date(born.getTime() + min * 60_000);
  const prods = [
    { seedKey: "a", createdAt: at(0.2) },
    { seedKey: "b", createdAt: at(2) },
    { seedKey: "c", createdAt: at(59) },
    { seedKey: "d", createdAt: at(61) }, // a trade switched on later
    { seedKey: null, createdAt: at(1) }, // typed by the company
    { seedKey: "e", createdAt: "not a date" },
    null,
  ];
  ok("signup = seeded rows created within the hour after the company", signupSeededRows(prods, born).map((p) => p.seedKey).join() === "a,b,c", signupSeededRows(prods, born).map((p) => p.seedKey).join());
  ok("an unreadable company date counts nothing, never everything", signupSeededRows(prods, null).length === 0 && signupSeededRows(prods, "x").length === 0);
  ok("the window is an hour", SIGNUP_SEED_WINDOW_MS === 3_600_000);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n11. The routes, executed — archive not delete, restore not duplicate, tenancy\n");

{
  const stub = await import("@/lib/db");
  const { setCurrentMember, resetCurrentMemberStub } = await import("./fixtures/currentMemberStub.mjs");
  const route = await import("@/app/api/settings/products/confirm-services/route");
  const productRoute = await import("@/app/api/products/[id]/route");
  const { rows, writes, resetDbStub } = stub;

  const cands = candidateServicesFor(["caulking_sealants"]);
  const [c1, c2, c3] = cands.map((c) => c.service);
  const born = new Date("2026-09-01T12:00:00Z");
  const seedRow = (id, companyId, s, extra = {}) => ({
    id,
    companyId,
    seedKey: s.seedKey,
    name: s.name.en,
    unitPrice: suggestedIn(s.benchmark?.median, "USD"),
    active: true,
    createdAt: new Date(born.getTime() + 30_000),
    templateLines: [{ kind: "labour", name: "Prep", qty: 1, unitPrice: 42 }],
    ...extra,
  });

  function fixture() {
    resetDbStub();
    resetCurrentMemberStub();
    rows.company.push(
      { id: "co_A", defaultLanguage: "en", currency: "USD", country: "US", dateFormat: null, servicesConfirmedAt: null, createdAt: born },
      { id: "co_B", defaultLanguage: "en", currency: "USD", country: "US", dateFormat: null, servicesConfirmedAt: null, createdAt: born },
    );
    const caulkCat = { id: "cat_caulk", key: "caulking_sealants", companyId: null, label: "Caulking & Sealants", labelTranslations: null };
    rows.serviceCategory.push(caulkCat, { id: "cat_handy", key: "handyman", companyId: null, label: "Handyman", labelTranslations: null });
    rows.companyServiceCategory.push({ companyId: "co_A", enabled: true, category: caulkCat });
    rows.product.push(
      seedRow("p1", "co_A", c1),
      seedRow("p2", "co_A", c2, { unitPrice: 999 }), // repriced by the owner
      seedRow("pB", "co_B", c3), // another company's row
    );
    setCurrentMember({ id: "m1", userId: "u1", companyId: "co_A", role: "owner" });
  }
  const post = (body) =>
    route.POST(new Request("http://x/api/settings/products/confirm-services", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const get = () => route.GET(new Request("http://x/api/settings/products/confirm-services"));
  const flat = (json) => json.groups.flatMap((g) => g.services);

  fixture();
  let res = await get();
  let json = await res.json();
  ok("GET answers 200", res.status === 200, res.status);
  const installedBefore = json.trades.find((t) => t.key === "caulking_sealants").installed;
  ok("GET: coverage counts the held rows the trade's own list tags", installedBefore >= 1, installedBefore);
  let r1 = flat(json).find((s) => s.seedKey === c1.seedKey);
  let r2 = flat(json).find((s) => s.seedKey === c2.seedKey);
  ok("GET: an untouched seeded row is held and 'Added for you'", r1?.held === true && r1?.addedForYou === true);
  ok("GET: a repriced one is held and 'In your list'", r2?.held === true && r2?.addedForYou === false);
  ok("GET: another company's row is invisible here", flat(json).find((s) => s.seedKey === c3.seedKey)?.held === false);
  ok("GET: 'We added 2 services for Caulking & Sealants when you signed up'", json.seededAtSignup?.count === 2 && json.seededAtSignup.trades.join() === "Caulking & Sealants", JSON.stringify(json.seededAtSignup));
  const gOf = (json, key) => json.groups.find((g) => g.services.some((s) => s.seedKey === key));
  const g1 = gOf(json, c1.seedKey);
  ok("GET + the screen's count: held rows count as selected", groupCount(g1.services, emptySelection()).n === g1.services.filter((s) => s.held).length && groupCount(g1.services, emptySelection()).n >= 1);

  // Untick → archived, not deleted.
  const before = rows.product.length;
  res = await post({ seedKeys: [], removeSeedKeys: [c1.seedKey] });
  json = await res.json();
  const p1 = rows.product.find((p) => p.id === "p1");
  ok("untick: 200 and one removed", res.status === 200 && json.removed === 1 && json.created === 0, JSON.stringify(json));
  ok("untick: the row is still there, active: false", rows.product.length === before && p1.active === false);
  ok("untick: no delete was attempted", !writes.some((w) => w.model === "product" && /delete/i.test(w.action)));
  ok("untick: the archive write is tenant-scoped", writes.some((w) => w.model === "product" && w.action === "updateMany" && w.where.companyId === "co_A" && w.data.active === false));
  ok("untick: the step is stamped confirmed", rows.company.find((c) => c.id === "co_A").servicesConfirmedAt instanceof Date);

  res = await get();
  json = await res.json();
  r1 = flat(json).find((s) => s.seedKey === c1.seedKey);
  ok("GET after: the removed row is listed, unticked, 'tick to add back'", r1.held === false && r1.archived === true && rowState(r1, emptySelection()) === "removed");
  ok("GET after: coverage still counts it (a removal is an answer, not a gap)", json.trades.find((t) => t.key === "caulking_sealants").installed === installedBefore, `${json.trades.find((t) => t.key === "caulking_sealants").installed} vs ${installedBefore}`);

  // Re-tick → restored, not duplicated.
  res = await post({ seedKeys: [c1.seedKey], removeSeedKeys: [] });
  json = await res.json();
  ok("re-tick: 200, one restored, none created", res.status === 200 && json.restored === 1 && json.created === 0, JSON.stringify(json));
  ok("re-tick: the SAME row is active again — no second copy", rows.product.filter((p) => p.companyId === "co_A" && p.seedKey === c1.seedKey).length === 1 && p1.active === true && rows.product.length === before);
  ok("re-tick: its price and template lines are what they were", p1.unitPrice === suggestedIn(c1.benchmark?.median, "USD") && p1.templateLines?.[0]?.unitPrice === 42);

  // Another company's key, and garbage — refused, nothing written.
  writes.length = 0;
  res = await post({ seedKeys: [], removeSeedKeys: [c3.seedKey] });
  json = await res.json();
  ok("removing a key only another company holds: 400, named", res.status === 400 && json.unknown?.includes(c3.seedKey), `${res.status} ${JSON.stringify(json)}`);
  ok("…and nothing was written, in either company", writes.filter((w) => w.model === "product").length === 0 && rows.product.find((p) => p.id === "pB").active === true);
  res = await post({ seedKeys: [c2.seedKey], removeSeedKeys: [c2.seedKey] });
  ok("the same key added and removed: 400", res.status === 400);
  res = await post({ seedKeys: [], removeSeedKeys: "x" });
  ok("a removeSeedKeys that is not a list: 400", res.status === 400);
  res = await post({ seedKeys: [], removeSeedKeys: [{ id: "pB" }] });
  ok("an object where a key belongs: 400", res.status === 400);
  res = await post({ seedKeys: [] });
  ok("the older body (seedKeys alone) still confirms", res.status === 200);

  // A tick on a suggestion creates through the seeder — once.
  const fresh = cands.find((c) => ![c1.seedKey, c2.seedKey].includes(c.service.seedKey) && c.forTrade === "caulking_sealants").service;
  res = await post({ seedKeys: [fresh.seedKey, fresh.seedKey] });
  json = await res.json();
  res = await post({ seedKeys: [fresh.seedKey] });
  const json2 = await res.json();
  ok("a new tick creates one row; ticking it again creates none", json.created === 1 && json2.created === 0 && rows.product.filter((p) => p.companyId === "co_A" && p.seedKey === fresh.seedKey).length === 1, `${JSON.stringify(json)} ${JSON.stringify(json2)}`);

  // Settings › Products & Services: Remove and Add back on the same row.
  fixture();
  const patch = (id, body) =>
    productRoute.PATCH(new Request(`http://x/api/products/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  res = await patch("p2", { active: false });
  const p2 = rows.product.find((p) => p.id === "p2");
  ok("Products › Remove: PATCH { active: false } archives the row", res.status === 200 && p2.active === false && rows.product.length === 3, res.status);
  const upd = writes.filter((w) => w.model === "product" && w.action === "update").at(-1);
  ok("…and writes that one column, nothing else", upd && JSON.stringify(Object.keys(upd.data)) === JSON.stringify(["active"]), JSON.stringify(upd?.data));
  res = await patch("p2", { active: true });
  ok("Products › Add back: the same row, same price, same template lines", res.status === 200 && p2.active === true && p2.unitPrice === 999 && p2.templateLines?.[0]?.unitPrice === 42);
  res = await patch("p2", { active: "false" });
  ok("a non-boolean active is refused, not coerced", res.status === 400 && p2.active === true);
  res = await patch("pB", { active: false });
  ok("another company's row: 404, untouched", res.status === 404 && rows.product.find((p) => p.id === "pB").active === true);
  // Removed in Products, ticked back in the dialog: still the same row.
  await patch("p2", { active: false });
  res = await post({ seedKeys: [c2.seedKey] });
  json = await res.json();
  ok("removed in Products, added back from the dialog: restored, not duplicated", json.restored === 1 && json.created === 0 && rows.product.filter((p) => p.companyId === "co_A" && p.seedKey === c2.seedKey).length === 1 && p2.unitPrice === 999);

  setCurrentMember({ id: "m2", userId: "u2", companyId: "co_A", role: "employee" });
  res = await post({ seedKeys: [], removeSeedKeys: [c1.seedKey] });
  ok("an employee cannot remove services", res.status === 403);
  resetDbStub();
  resetCurrentMemberStub();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n12. Who stops offering a removed service — every reader\n");

{
  ok("isOffered: active false is removed; true, missing and null are offered", isOffered({ active: true }) && isOffered({}) && isOffered({ active: null }) && !isOffered({ active: false }) && !isOffered(null));
  ok("offeredOnly / removedOnly partition a list", offeredOnly([{ active: false }, { active: true }, {}]).length === 2 && removedOnly([{ active: false }, { active: true }, {}]).length === 1 && offeredOnly("x").length === 0);
  const strip = (p) => read(p).replace(/^\s*\/\/.*$/gm, "");
  // The screens that load the whole book through GET /api/products.
  for (const [file, pattern] of [
    ["app/components/quotes/builder/QuoteBuilder.js", /const products = useMemo\(\(\) => offeredOnly\(boot\.products\), \[boot\.products\]\)/],
    ["app/components/invoices/builder/InvoiceBuilder.js", /const products = useMemo\(\(\) => offeredOnly\(boot\.products\), \[boot\.products\]\)/],
    ["app/app/settings/services/ServiceSeedsCard.js", /const mine = offeredOnly\(seededHere\)/],
    ["app/app/settings/services/ServiceTemplatesCard.js", /return offeredOnly\(products\)/],
    ["app/app/analytics/benchmark/page.js", /setProducts\(offeredOnly\(body\)\)/],
    ["app/app/settings/products/ProductCatalogue.js", /const offered = offeredOnly\(products\)/],
  ]) {
    ok(`${file} filters removed services`, pattern.test(strip(file)));
  }
  // The server-side readers: pickers, AI tools, the voice agent, the add-on offers.
  for (const file of [
    "lib/aiEmployee/tools.js",
    "lib/ai/callQuoteDraft.js",
    "lib/ai/jennifer/tools.js",
    "lib/voice/quoteQuestions.js",
    "lib/quotes/offeredAddOns.js",
    "lib/quotes/suggestedAddOns.js",
    "lib/servicePlans/seedTemplates.js",
    "app/api/settings/plan-templates/route.js",
    "app/api/settings/translations/route.js",
    "lib/pricing/benchmarkData.js",
  ]) {
    ok(`${file} reads only active products`, /product\.(findMany|count)\(\{[\s\S]{0,160}active: true/.test(strip(file)));
  }
  // The instant quote prices from rate cards and intake answers, not the
  // price book: nothing there to filter, asserted so a future read is seen.
  const instantFiles = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.m?js$/.test(name)) instantFiles.push(p);
    }
  };
  for (const d of ["app/api/instant-quote", "app/api/self-quote"]) if (existsSync(d)) walk(d);
  ok("the instant quote and self-quote routes read no Product rows", instantFiles.length > 0 && instantFiles.every((f) => !/\bproduct\.(findMany|findFirst|findUnique|count)\(/.test(read(f))), instantFiles.length);
  // The seeders SEE removed rows, so "Add missing services" never re-creates one.
  const seeder = strip("lib/products/seedServices.js");
  ok("the seeder's dedupe reads every row, removed ones included", /const held = await db\.product\.findMany\(\{\s*where: \{ companyId, seedKey: \{ not: null \} \}/.test(seeder));
  ok("…and the add-on seeder's by-name dedupe too", /where: \{ companyId, name: \{ in: addons\.map\(\(a\) => a\.name\) \} \}/.test(strip("lib/products/seedStandardAddOns.js")));
  ok("GET /api/products still returns removed rows (the Removed tab lists them) and marks Added for you", /addedForYou: isAddedForYou\(p, \{ currency \}\)/.test(strip("app/api/products/route.js")) && !/active: true/.test(strip("app/api/products/route.js")));
}

console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
