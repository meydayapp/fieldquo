// Executes lib/junk/pricing.js against the cases that cost a hauler money.
import {
  priceJunk, normaliseJunkRates, DEFAULT_JUNK_RATES, JUNK_ITEMS, LOAD_TIERS,
} from "@/lib/junk/pricing";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const R = DEFAULT_JUNK_RATES;

console.log("\nLoad-fraction pricing");
ok("half load prices at the half rate", priceJunk({ mode: "load", tier: "half" }).total === R.loadCents.half);
ok("full truckload", priceJunk({ mode: "load", tier: "full" }).total === R.loadCents.full);
ok("unknown tier -> no base (just floor if items)", priceJunk({ mode: "load", tier: "enormous" }).total === 0);

console.log("\nItem-mode: flat per item");
const couch = priceJunk({ mode: "items", items: [{ key: "couch", quantity: 1 }] });
ok("one couch = its flat rate", couch.total === R.itemCents.couch);
ok("two couches doubles", priceJunk({ mode: "items", items: [{ key: "couch", quantity: 2 }] }).total === R.itemCents.couch * 2);
ok("an unrecognised item is dropped, never priced", priceJunk({ mode: "items", items: ["unicorn"] }).total === 0);

console.log("\nRefrigerant: Freon fee AND a separate-truck warning, in BOTH modes");
const fridgeItem = priceJunk({ mode: "items", items: ["refrigerator"] });
ok("item mode charges the fridge + freon fee", fridgeItem.total > R.refrigerantFeeCents);
ok("item mode flags a separate truck", fridgeItem.warnings.separateTruck.some((x) => x.key === "refrigerator"));
const fridgeInLoad = priceJunk({ mode: "load", tier: "half", items: ["refrigerator"] });
ok("load mode adds ONLY the freon fee on top of the load", fridgeInLoad.total === R.loadCents.half + R.refrigerantFeeCents, fridgeInLoad.total);
ok("load mode still flags the separate truck", fridgeInLoad.warnings.separateTruck.length === 1);

console.log("\nE-waste, mattress, tire fees");
ok("TV adds e-waste fee + separate truck", (() => { const r = priceJunk({ mode: "load", tier: "quarter", items: ["tv"] }); return r.total === R.loadCents.quarter + R.ewasteFeeCents && r.warnings.separateTruck.length === 1; })());
ok("mattress adds recycling fee (no separate truck)", (() => { const r = priceJunk({ mode: "load", tier: "quarter", items: ["mattress"] }); return r.total === R.loadCents.quarter + R.mattressFeeCents && r.warnings.separateTruck.length === 0; })());
ok("4 tires charge 4× the per-tire fee", priceJunk({ mode: "load", tier: "minimum", items: [{ key: "tire", quantity: 4 }] }).total === R.loadCents.minimum + R.tirePerUnitCents * 4);

console.log("\nNOT-ACCEPTED items are a warning, never a price");
const hazard = priceJunk({ mode: "items", items: ["propane", "gas_appliance", "couch"] });
ok("propane + gas appliance don't add to the total", hazard.total === R.itemCents.couch, hazard.total);
ok("they're returned as warnings", hazard.warnings.notAccepted.length === 2);
ok("propane named", hazard.warnings.notAccepted.some((x) => x.key === "propane"));
ok("a job of ONLY hazards prices nothing", priceJunk({ mode: "items", items: ["propane", "asbestos"] }).total === 0);
ok("...but still warns", priceJunk({ mode: "items", items: ["propane", "asbestos"] }).warnings.notAccepted.length === 2);

console.log("\nHeavy debris + stairs");
ok("2 heavy loads", priceJunk({ mode: "items", items: ["couch"], heavyLoads: 2 }).total === R.itemCents.couch + R.heavyPerLoadCents * 2);
ok("3 flights of stairs", priceJunk({ mode: "load", tier: "half", stairsFlights: 3 }).total === R.loadCents.half + R.stairsPerFlightCents * 3);

console.log("\nMinimum floor");
ok("a tiny single item floors up to the minimum", priceJunk({ mode: "items", items: [{ key: "furniture", quantity: 1 }] }).total >= R.minimumCents);
ok("an empty job is 0, not the minimum", priceJunk({ mode: "items", items: [] }).total === 0);

console.log("\nCompany rates flow through");
const custom = normaliseJunkRates({ loadCents: { half: 50000 }, refrigerantFeeCents: 8000 });
ok("custom half rate used", priceJunk({ mode: "load", tier: "half" }, custom).total === 50000);
ok("custom freon fee used", priceJunk({ mode: "load", tier: "half", items: ["refrigerator"] }, custom).total === 50000 + 8000);
ok("missing keys fall back to defaults", normaliseJunkRates({}).loadCents.full === R.loadCents.full);
ok("garbage rate -> default, not NaN", Number.isFinite(normaliseJunkRates({ minimumCents: "abc" }).minimumCents));

console.log("\nTaxonomy integrity");
ok("every item has key+label", JUNK_ITEMS.every((i) => i.key && i.label));
ok("refrigerant items exist", JUNK_ITEMS.some((i) => i.special === "refrigerant"));
ok("not-accepted items exist", JUNK_ITEMS.some((i) => i.notAccepted));
ok("keys are unique", new Set(JUNK_ITEMS.map((i) => i.key)).size === JUNK_ITEMS.length);
ok("4 load tiers", LOAD_TIERS.length === 4);

console.log("\nHostile input");
ok("null input -> 0, no crash", priceJunk(null).total === 0);
ok("null rates -> defaults", priceJunk({ mode: "load", tier: "full" }, null).total === R.loadCents.full);
ok("string item shorthand works", priceJunk({ mode: "items", items: ["couch"] }).total === R.itemCents.couch);
ok("negative quantity clamps to 1", priceJunk({ mode: "items", items: [{ key: "couch", quantity: -3 }] }).total === R.itemCents.couch);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
