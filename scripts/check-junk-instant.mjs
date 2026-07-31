// Junk removal wired into the instant-estimate brain: computeInstantEstimate
// dispatches junk_removal → estimateJunk → priceJunk, in the same dollar range
// model as every other trade. Pure — no DB.
import {
  computeInstantEstimate, INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";
import { DEFAULT_JUNK_RATES } from "@/lib/junk/pricing";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const cfg = { enabled: true, rates: DEFAULT_JUNK_RATES, rangeBandPct: 0.15 };
const junk = (measurements, config = cfg) => computeInstantEstimate({ trade: "junk_removal", measurements, config });

console.log("\nRegistry");
ok("junk_removal registered", !!INSTANT_ESTIMATE_TRADES.junk_removal);
ok("measure is item_picker", INSTANT_ESTIMATE_TRADES.junk_removal.measure === "item_picker");
ok("has no materials", INSTANT_ESTIMATE_TRADES.junk_removal.hasMaterials === false);
ok("seeded default rates present", !!INSTANT_ESTIMATE_DEFAULTS.junk_removal?.rates);

console.log("\nThe estimate is a dollar range, low ≤ point ≤ high");
const e = junk({ items: [{ key: "couch", quantity: 2 }, { key: "mattress", quantity: 1 }], jobType: "single_items" });
ok("ok", e.ok, e);
ok("low ≤ point ≤ high", e.low <= e.point && e.point <= e.high, e);
ok("figures are dollars, not cents (a couch+mattress isn't in the tens of thousands)", e.point < 2000 && e.point > 50, e.point);
ok("breakdown carried, in dollars", Array.isArray(e.breakdown) && e.breakdown.every((b) => typeof b.amount === "number"));

console.log("\nVolume discount survives the dollar bridge");
const one = junk({ items: [{ key: "couch", quantity: 1 }] }).point;
const twelve = junk({ items: [{ key: "couch", quantity: 12 }] }).point;
ok("12 couches cost more than 1", twelve > one, { one, twelve });
ok("...but less per couch", twelve / 12 < one, { per1: one, per12: twelve / 12 });

console.log("\nWarnings reach the flow");
const haz = junk({ items: [{ key: "refrigerator", quantity: 1 }, { key: "propane", quantity: 1 }, { key: "couch", quantity: 2 }] });
ok("separate-truck warning surfaced (fridge)", haz.warnings?.separateTruck?.some((x) => x.key === "refrigerator"));
ok("not-accepted warning surfaced (propane)", haz.warnings?.notAccepted?.some((x) => x.key === "propane"));

console.log("\nGates & hostile input");
ok("no config -> needsConfig (trade not offered)", junk({ items: [{ key: "couch", quantity: 1 }] }, null).needsConfig === true);
ok("disabled config -> needsConfig", junk({ items: [{ key: "couch", quantity: 1 }] }, { enabled: false }).needsConfig === true);
ok("empty items -> ok:false, not a phantom minimum", junk({ items: [] }).ok === false);
ok("null measurements -> ok:false, no throw", junk(null).ok === false);
ok("garbage rates -> still a finite number", (() => { const r = junk({ items: [{ key: "couch", quantity: 1 }] }, { enabled: true, rates: { minimumCents: "x" } }); return r.ok && Number.isFinite(r.point); })());

console.log("\nAccess surcharges raise the range");
const bare = junk({ items: [{ key: "couch", quantity: 4 }] }).point;
const access = junk({ items: [{ key: "couch", quantity: 4 }], stairsFlights: 3, disassembly: true }).point;
ok("stairs + disassembly cost more", access > bare, { bare, access });

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
