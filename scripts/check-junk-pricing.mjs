// Executes lib/junk/pricing.js — volume-discounted pricing + special handling.
import {
  priceJunk, volumePriceCents, normaliseJunkRates, DEFAULT_JUNK_RATES,
  JUNK_ITEMS, JOB_TYPES, LOAD_TIERS,
} from "@/lib/junk/pricing";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const R = DEFAULT_JUNK_RATES;

console.log("\nThe whole point: per-item price DECREASES as volume rises");
const one = priceJunk({ items: [{ key: "couch", quantity: 1 }] }).total;
const sixteen = priceJunk({ items: [{ key: "couch", quantity: 16 }] }).total;
const perItem1 = one / 1;
const perItem16 = sixteen / 16;
console.log(`     1 couch: $${(one/100).toFixed(0)} ($${(perItem1/100).toFixed(0)}/item) · 16 couches: $${(sixteen/100).toFixed(0)} ($${(perItem16/100).toFixed(0)}/item)`);
ok("16 items cost more in total than 1", sixteen > one);
ok("...but LESS per item (economies of scale)", perItem16 < perItem1);
// A single small item = a minimum load ($135, the trip cost) — the minimum
// TIER, which sits above the bare minimum-charge floor. The trip is the trip.
ok("a single small item prices at the minimum load (the trip cost)",
  priceJunk({ items: ["microwave"] }).total === R.loadCents.minimum, priceJunk({ items: ["microwave"] }).total);
ok("...which is at least the minimum-charge floor", priceJunk({ items: ["microwave"] }).total >= R.minimumCents);

console.log("\nvolumePriceCents — the curve");
ok("zero volume -> 0", volumePriceCents(0) === 0);
ok("tiny volume -> minimum tier", volumePriceCents(1) === R.loadCents.minimum);
ok("half a truck -> ~half rate", Math.abs(volumePriceCents(R.fullLoadUnits / 2) - R.loadCents.half) < 100, volumePriceCents(R.fullLoadUnits / 2));
ok("a full truck -> full rate", volumePriceCents(R.fullLoadUnits) === R.loadCents.full);
ok("monotonic: more volume never costs less", volumePriceCents(20) >= volumePriceCents(10) && volumePriceCents(10) >= volumePriceCents(5));
ok("two full trucks -> ~2x full (not capped)", Math.abs(volumePriceCents(R.fullLoadUnits * 2) - R.loadCents.full * 2) < 100, volumePriceCents(R.fullLoadUnits * 2));

console.log("\nRefrigerant: Freon fee + separate-truck warning, and its volume counts");
const fridge = priceJunk({ items: ["refrigerator"] });
ok("charges the freon fee", fridge.lines.some((l) => l.key === "fee_refrigerator"));
ok("flags a separate truck", fridge.warnings.separateTruck.some((x) => x.key === "refrigerator"));
const halfPlusFridge = priceJunk({ items: [{ key: "couch", quantity: 4 }, "refrigerator"] });
ok("the fridge fee is ON TOP of the volume base, not a double item charge",
  halfPlusFridge.lines.filter((l) => l.key.startsWith("fee_") || l.key === "base").length === 2);

console.log("\nE-waste / mattress / tire fees");
ok("TV adds e-waste fee + separate truck", (() => { const r = priceJunk({ items: [{ key: "couch", quantity: 4 }, "tv"] }); return r.lines.some((l) => l.key === "fee_tv") && r.warnings.separateTruck.length === 1; })());
ok("mattress fee, no separate truck", (() => { const r = priceJunk({ items: [{ key: "couch", quantity: 4 }, "mattress"] }); return r.lines.some((l) => l.key === "fee_mattress") && r.warnings.separateTruck.length === 0; })());
ok("4 tires = 4x the per-tire fee", priceJunk({ items: [{ key: "tire", quantity: 4 }] }).lines.find((l) => l.key === "fee_tire").cents === R.tirePerUnitCents * 4);

console.log("\nNOT-ACCEPTED items are a warning, never a price");
const hazard = priceJunk({ items: ["propane", "gas_appliance", { key: "couch", quantity: 3 }] });
ok("hazards add nothing to volume/total beyond the couches",
  hazard.total === priceJunk({ items: [{ key: "couch", quantity: 3 }] }).total);
ok("both returned as warnings", hazard.warnings.notAccepted.length === 2);
ok("a job of only hazards prices nothing", priceJunk({ items: ["propane", "asbestos"] }).total === 0);
ok("...but still warns", priceJunk({ items: ["propane", "asbestos"] }).warnings.notAccepted.length === 2);

console.log("\nJob-type context — reno debris is a premium");
const living = priceJunk({ jobType: "house_cleanout", items: [{ key: "couch", quantity: 6 }] }).total;
const reno = priceJunk({ jobType: "construction", items: [{ key: "couch", quantity: 6 }] }).total;
ok("construction multiplier makes the same volume cost more", reno > living, { reno, living });
ok("unknown job type -> single_items default, no crash", priceJunk({ jobType: "nonsense", items: ["couch"] }).total > 0);

console.log("\nAccess surcharges (the screenshot's service options)");
const access = priceJunk({
  items: [{ key: "couch", quantity: 6 }],
  stairsFlights: 2, disassembly: true, demolition: true, longCarry: true, noElevator: true, outOfArea: true,
});
const bare = priceJunk({ items: [{ key: "couch", quantity: 6 }] }).total;
ok("stairs charged per flight", access.lines.find((l) => l.key === "stairs").cents === 2 * R.stairsPerFlightCents);
ok("disassembly added", access.lines.some((l) => l.key === "disassembly"));
ok("small demolition added", access.lines.some((l) => l.key === "demolition"));
ok("long carry added", access.lines.some((l) => l.key === "long_carry"));
ok("no elevator added", access.lines.some((l) => l.key === "no_elevator"));
ok("out-of-area added", access.lines.some((l) => l.key === "out_of_area"));
ok("all of them raise the total", access.total > bare);

console.log("\nHeavy debris per truck-bed");
ok("2 heavy loads on top", (() => { const r = priceJunk({ items: [{ key: "couch", quantity: 4 }], heavyLoads: 2 }); return r.lines.find((l) => l.key === "heavy").cents === 2 * R.heavyPerLoadCents; })());

console.log("\nCompany rates flow through");
const custom = normaliseJunkRates({ loadCents: { full: 100000 }, refrigerantFeeCents: 8000, fullLoadUnits: 20 });
ok("custom full rate used at a full truck", volumePriceCents(20, custom) === 100000);
ok("custom freon fee used", priceJunk({ items: ["refrigerator"] }, custom).lines.find((l) => l.key === "fee_refrigerator").cents === 8000);
ok("missing keys fall back to defaults", normaliseJunkRates({}).loadCents.full === R.loadCents.full);
ok("garbage rate -> default, not NaN", Number.isFinite(normaliseJunkRates({ minimumCents: "abc" }).minimumCents));
ok("fullLoadUnits can't be 0 (no divide by zero)", normaliseJunkRates({ fullLoadUnits: 0 }).fullLoadUnits >= 1);

console.log("\nReturns the volume it computed (for the UI to show)");
const v = priceJunk({ items: [{ key: "couch", quantity: 2 }, "microwave"] });
ok("volumeUnits reported", v.volumeUnits === 4 * 2 + 0.5);
ok("loadFraction reported", typeof v.loadFraction === "number");

console.log("\nTaxonomy integrity");
ok("every item has key+label+ (volume or notAccepted)", JUNK_ITEMS.every((i) => i.key && i.label && (i.volume != null || i.notAccepted)));
ok("keys unique", new Set(JUNK_ITEMS.map((i) => i.key)).size === JUNK_ITEMS.length);
ok("refrigerant + not-accepted items exist", JUNK_ITEMS.some((i) => i.special === "refrigerant") && JUNK_ITEMS.some((i) => i.notAccepted));
ok("4 load tiers, 5 job types", LOAD_TIERS.length === 4 && Object.keys(JOB_TYPES).length === 5);

console.log("\nHostile input");
ok("null input -> 0, no crash", priceJunk(null).total === 0);
ok("null rates -> defaults", priceJunk({ items: ["couch"] }, null).total > 0);
ok("negative qty clamps to 1", priceJunk({ items: [{ key: "couch", quantity: -3 }] }).volumeUnits === 4);
ok("empty job -> 0, not the minimum", priceJunk({ items: [] }).total === 0);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
