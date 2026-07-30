// scripts/check-kitchen-pricing.mjs
//
//   node scripts/check-kitchen-pricing.mjs
//
// Executes lib/kitchen/pricing.js against hostile input rather than reading it.
//
// This engine is reachable from the PUBLIC client-facing designer, where every
// number arrives from a browser. The assertions below are not style checks —
// each one corresponds to a way a quote could be made wrong:
//
//   * a negative or NaN width producing a NEGATIVE line item, which on a signed
//     document is a discount nobody authorised
//   * a rates blob saved by an older settings page leaving a field undefined
//     and pricing a cabinet at NaN
//   * the browser setting an accessory or appliance price directly, which is
//     the thing AGENTS.md §5 forbids for quote add-ons and forbids here too
//   * one tampered cabinet claiming 400 doors and billing $60,000 of finishing
//
// The per-linear-foot assertion pins the arithmetic to the numbers the owner's
// original TrueFinish code produced. If that one fails, pricing has drifted from
// kitchens that real clients have already bought.

import {
  createKitchenConfig, buildKitchenLineItems, getKitchenBreakdown, getKitchenTotal,
  normaliseRates, toLineItems, kitchenLineItems, mergeClientDesign,
  DEFAULT_CABINET_RATES, KITCHEN_ACCESSORIES, priceCabinet,
} from "@/lib/kitchen/pricing";

let fail = 0;
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++; };
const finite = (items) => items.every(i => Number.isFinite(i.total) && Number.isFinite(i.unitPrice));
const nonNeg  = (items) => items.every(i => i.total >= 0 && i.unitPrice >= 0);

const cab = (o = {}) => ({ id: "c1", kind: "base", width: 36, height: 34.5, depth: 24,
  config: { doors: 2, drawers: ["big"], doorMaterial: "maple", boxMaterial: "plywood" }, ...o });

// ── 1. It prices a normal kitchen ────────────────────────────────────────
const normal = createKitchenConfig({ elements: [cab(), cab({ id:"c2", kind:"wall", width:30 })] });
const b = getKitchenBreakdown(normal);
ok(b.total > 0 && Number.isFinite(b.total), `a 2-cabinet kitchen prices to $${b.total} (${b.linearFeet} lf)`);

// 36" base, maple(1.2) × plywood(1.15) at $700/lf = 3 × 700 × 1.38 = 2898, +1 drawer × 75
const p = priceCabinet(cab(), DEFAULT_CABINET_RATES);
ok(Math.abs(p.total - (3 * 700 * 1.2 * 1.15 + 75)) < 0.02,
   `per-linear-foot maths unchanged from source: $${p.total}`);

// ── 2. Hostile numbers ───────────────────────────────────────────────────
const hostile = [
  ["negative width",  cab({ width: -500 })],
  ["NaN width",       cab({ width: NaN })],
  ["Infinity width",  cab({ width: Infinity })],
  ["string width",    cab({ width: "36" })],
  ["absent width",    cab({ width: undefined })],
  ["null config",     cab({ config: null })],
  ["huge door count", cab({ config: { doors: 1e9, doorRows: 1e9 } })],
  ["negative drawers",cab({ config: { drawers: -5 } })],
  ["object width",    cab({ width: { evil: true } })],
];
for (const [name, el] of hostile) {
  const items = buildKitchenLineItems(createKitchenConfig({ elements: [el] }));
  ok(finite(items) && nonNeg(items), `${name} → finite, non-negative (${items.length} lines, $${getKitchenTotal(createKitchenConfig({elements:[el]}))})`);
}

// ── 3. Hostile rates ─────────────────────────────────────────────────────
for (const [name, rates] of [
  ["negative lfBase", { lfBase: -700 }],
  ["NaN lfBase",      { lfBase: NaN }],
  ["string lfBase",   { lfBase: "700" }],
  ["null rates",      null],
  ["array rates",     []],
  ["unknown mode",    { cabinetPricingMode: "free_please" }],
  ["zero multiplier", { doorMaterialMult: { maple: 0 } }],
  ["partial blob",    { lfBase: 450 }],
]) {
  const items = buildKitchenLineItems(createKitchenConfig({ elements: [cab()] }), rates);
  ok(finite(items) && nonNeg(items), `rates "${name}" → finite, non-negative ($${items[0]?.total})`);
}
const partial = normaliseRates({ lfBase: 450 });
ok(partial.lfUpper === DEFAULT_CABINET_RATES.lfUpper && partial.lfBase === 450,
   "a partially-edited rate card keeps defaults for untouched fields");
ok(normaliseRates({ cabinetPricingMode: "free_please" }).cabinetPricingMode === "perLinearFt",
   "an unknown pricing mode falls back rather than skipping every branch");

// ── 4. The browser cannot set a price ────────────────────────────────────
const cheat = createKitchenConfig({
  elements: [cab()],
  accessories: [{ id: "toe_kick", quantity: 2, price: 0.01, name: "FREE", unit: "gift" }],
});
const acc = buildKitchenLineItems(cheat).find(i => i.id === "acc_toe_kick");
const real = KITCHEN_ACCESSORIES.find(a => a.id === "toe_kick");
ok(acc.unitPrice === real.price && acc.title === real.name,
   `a tampered accessory price is ignored — repriced at catalogue $${acc.unitPrice}, not $0.01`);

const fake = buildKitchenLineItems(createKitchenConfig({
  elements: [cab()], accessories: [{ id: "not_a_real_accessory", quantity: 5, price: 999 }],
}));
ok(!fake.some(i => i.id.startsWith("acc_")), "an accessory id that isn't in the catalogue is dropped, not priced");

// ── 5. mergeClientDesign ─────────────────────────────────────────────────
const saved = createKitchenConfig({
  room: { width: 180, depth: 140, ceiling: 96 },
  elements: [cab(), { id: "f1", kind: "fridge", width: 36, height: 70, depth: 30,
                      config: { billable: true, supplyPrice: 2200, installPrice: 150 } }],
});
const tampered = {
  room: { width: 60, depth: 60, ceiling: 60 },
  elements: [cab({ width: 48 }),
             { id: "f1", kind: "fridge", width: 36, height: 70, depth: 30,
               config: { billable: true, supplyPrice: 99999, installPrice: 99999 } },
             { id: "f2", kind: "stove", width: 30, height: 36, depth: 26,
               config: { billable: true, supplyPrice: 5000, installPrice: 500 } }],
  accessories: [{ id: "toe_kick", quantity: 3, price: 0 }],
  rates: { lfBase: 1 },
};
const merged = mergeClientDesign(saved, tampered);
const mf = merged.elements.find(e => e.id === "f1");
ok(mf.config.supplyPrice === 2200 && mf.config.installPrice === 150,
   "a client's appliance price is replaced by the contractor's ($2200, not $99999)");
const added = merged.elements.find(e => e.id === "f2");
ok(added.config.billable === false && added.config.supplyPrice === 0,
   "an appliance the client added comes back non-billable, not free-and-billed");
ok(merged.room.width === 180, "room dimensions stay the contractor's measured figures");
ok(merged.rates === undefined, "a rate card sent by the browser is discarded");
ok(merged.elements.find(e => e.kind === "base").width === 48, "the client's actual DESIGN edit survives (36 → 48)");
ok(merged.accessories[0].price === undefined, "accessories keep id + quantity only");

const mergedTotal = getKitchenTotal(merged, { lfBase: 700 });
const cheatTotal  = getKitchenTotal(tampered, { lfBase: 700 });
ok(mergedTotal < cheatTotal, `merging strips the inflated appliance: $${mergedTotal} vs $${cheatTotal} unmerged`);
ok(mergeClientDesign(saved, null) === saved, "a null client design leaves the saved one alone");
ok(mergeClientDesign(null, tampered) !== null, "a missing saved design doesn't throw");

const huge = createKitchenConfig({ elements: [cab({ config: { doors: 1e9, doorRows: 1e9 } })] });
const hugeRefinish = buildKitchenLineItems(huge).filter(i => i.id.startsWith("kit_refinish"))
  .reduce((s,i) => s + i.total, 0);
ok(hugeRefinish <= 12 * 150, `one tampered cabinet can't bill 400 doors — refinishing capped at $${hugeRefinish}`);

// ── 6. Runaway sizes ─────────────────────────────────────────────────────
const many = createKitchenConfig({ elements: Array.from({ length: 5000 }, (_, i) => cab({ id: `c${i}` })) });
const manyItems = buildKitchenLineItems(many);
ok(manyItems.filter(i => i.category === "cabinet").length === 300,
   `5000 cabinets clamp to 300 lines (got ${manyItems.filter(i=>i.category==="cabinet").length})`);

// ── 7. The FieldQuo shape ────────────────────────────────────────────────
const fq = kitchenLineItems(normal);
const KEYS = ["description","quantity","unit","rate","amount"];
ok(fq.every(i => KEYS.every(k => k in i)), `toLineItems emits ${KEYS.join("/")} — the shape QuoteScopeGroup reads`);
ok(fq.every(i => Number.isFinite(i.amount) && i.amount >= 0), "every converted amount is finite and non-negative");
const sum = fq.reduce((s,i) => s + i.amount, 0);
ok(Math.abs(sum - getKitchenTotal(normal)) < 0.01, `converted total matches the engine total ($${sum.toFixed(2)})`);
ok(fq[0].description.includes("—"), `description folds title + spec: "${fq[0].description.slice(0,70)}…"`);

// ── 8. Empty / absent ────────────────────────────────────────────────────
ok(buildKitchenLineItems(null).length === 0, "a null config prices to nothing rather than throwing");
ok(buildKitchenLineItems({}).length === 0, "an empty config prices to nothing");
ok(getKitchenTotal(createKitchenConfig()) >= 0, "an empty kitchen has a non-negative total");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
