// scripts/check-kitchen-scope.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-kitchen-scope.mjs
//
// Cabinets that are on the drawing but not in the job.
//
// Half of cabinet work happens in a kitchen that already has cabinets. The
// refinisher takes the uppers and leaves the pantry; the refacer leaves the run
// the client had done last year. Before `config.outOfScope` existed, the
// designer charged for every box drawn, so the only way to quote a partial
// kitchen was to leave the untouched cabinets off the plan — the drawing lying
// to keep the total honest, which is the wrong half to sacrifice.
//
// Executed rather than read, because "not charged" has to hold in six places at
// once and five of them are easy to forget:
//
//   the cabinet line · the install line (per box AND per linear foot) · the
//   refinishing face count · the tear-out count · the reported linear footage
//
// Plus the two that decide whether the client can be told, and whether they can
// help themselves: the drawing has to mark the excluded pieces, and the public
// designer must not be able to nominate them.

import {
  createKitchenConfig, buildKitchenLineItems, getKitchenBreakdown,
  countKitchenFaces, priceCabinet, mergeClientDesign, isOutOfScope,
  DEFAULT_CABINET_RATES,
} from "@/lib/kitchen/pricing";
import { colorFor, EXISTING_COLOR, DEFAULT_FINISH } from "@/lib/kitchen/finishes";
import { planShapes, elevationShapes, legendShapes } from "@/lib/kitchen/planShapes";

let fail = 0;
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++; };

const cab = (o = {}) => ({
  id: "c1", kind: "base", wall: "A", pos: 0, width: 36, height: 34.5, depth: 24,
  config: { doors: 2, drawers: ["big"] }, ...o,
});
const keep = (o = {}) => {
  const el = cab(o);
  return { ...el, config: { ...el.config, outOfScope: true } };
};

// The same kitchen twice: both cabinets in scope, then one of them kept.
const modules = { refinish: true, removeOld: true };
const both = createKitchenConfig({
  modules,
  elements: [cab(), cab({ id: "c2", wall: "B", width: 24 })],
});
const half = createKitchenConfig({
  modules,
  elements: [cab(), keep({ id: "c2", wall: "B", width: 24 })],
});

const bBoth = getKitchenBreakdown(both);
const bHalf = getKitchenBreakdown(half);

// ── 1. The flag is opt-out: an untouched design is unchanged ──────────────
//
// The load-bearing one. `outOfScope` absent must mean "in scope", or every
// design saved before today silently reprices, and check:kitchen's pinned
// TrueFinish numbers would be the first casualty.
const virgin = getKitchenBreakdown(createKitchenConfig({ modules, elements: [cab()] }));
const explicitFalse = getKitchenBreakdown(createKitchenConfig({
  modules, elements: [{ ...cab(), config: { ...cab().config, outOfScope: false } }],
}));
ok(virgin.total > 0 && virgin.total === explicitFalse.total,
   `absent and explicit-false price identically ($${virgin.total})`);

// ── 2. Every place a cabinet costs money ─────────────────────────────────
const lines = (b, pred) => b.items.filter(pred);

ok(lines(bHalf, (i) => i.id === "c2").length === 0,
   "no cabinet line for the piece that stays");
ok(lines(bBoth, (i) => i.id === "c2").length === 1,
   "…and one for it when it doesn't");

ok(bHalf.cabinetry < bBoth.cabinetry && bHalf.cabinetry > 0,
   `cabinetry drops but doesn't vanish ($${bHalf.cabinetry} vs $${bBoth.cabinetry})`);

ok(bHalf.linearFeet === 3 && bBoth.linearFeet === 5,
   `reported footage covers only what's quoted (${bHalf.linearFeet} lf vs ${bBoth.linearFeet} lf)`);

// Refinishing: 2 doors + 1 drawer per box. One box kept → one box's faces.
const fBoth = countKitchenFaces(both.elements);
const fHalf = countKitchenFaces(half.elements);
ok(fBoth.doors === 4 && fBoth.drawers === 2, "both boxes: 4 doors, 2 drawer fronts");
ok(fHalf.doors === 2 && fHalf.drawers === 1,
   "a door that never comes off its hinges isn't finished (2 doors, 1 front)");
ok(bHalf.refinish > 0 && bHalf.refinish < bBoth.refinish,
   `finishing bills the faces in scope ($${bHalf.refinish} vs $${bBoth.refinish})`);

// Tear-out: a cabinet that stays is not carried to the skip.
const removal = (b) => b.items.find((i) => i.id === "kit_removal");
ok(/\(1\)/.test(removal(bHalf).title) && /\(2\)/.test(removal(bBoth).title),
   `removal counts boxes coming out — "${removal(bHalf).title}"`);

// Install, both modes — the per-linear-foot one is the easy miss, because it
// reads a footage rather than a count.
const perBox = { ...DEFAULT_CABINET_RATES, installIncludedInLf: false, installMode: "perBox", installPerBox: 100 };
const perLf  = { ...DEFAULT_CABINET_RATES, installIncludedInLf: false, installMode: "perLinearFt", installPerLinearFt: 40 };
const inst = (cfg, rates) => getKitchenBreakdown(cfg, rates).items.find((i) => i.id === "kit_install");
ok(inst(half, perBox).quantity === 1 && inst(both, perBox).quantity === 2,
   "install per box counts only the boxes being installed");
ok(inst(half, perLf).quantity === 3 && inst(both, perLf).quantity === 5,
   "install per linear foot measures only the run being installed");

// ── 3. It is reported, not merely absent ─────────────────────────────────
//
// "Eight cabinets excluded on purpose" and "eight cabinets we forgot to price"
// are the same number in a total.
ok(bHalf.excluded === 1 && bBoth.excluded === 0,
   `the breakdown says how many pieces were left out (${bHalf.excluded})`);

ok(priceCabinet(keep(), DEFAULT_CABINET_RATES).total === 0 &&
   priceCabinet(keep(), DEFAULT_CABINET_RATES).outOfScope === true,
   "priceCabinet answers $0 for an excluded piece, and says why");
ok(priceCabinet(cab(), DEFAULT_CABINET_RATES).total > 0,
   "…and still prices an ordinary one");

// ── 4. An island takes its modules with it ───────────────────────────────
//
// Island modules live in config.modules and are flattened into standalone
// elements for pricing, which is exactly where a parent's scope gets lost.
const islandCfg = (excluded) => ({
  id: "isl", kind: "island", wall: null, pos: 0, width: 72, height: 34.5, depth: 40,
  config: {
    doors: 0, drawers: [],
    ...(excluded ? { outOfScope: true } : {}),
    modules: [
      { id: "m1", kind: "drawerBase", width: 24, config: { doors: 0, drawers: ["big", "big"] } },
      { id: "m2", kind: "base", width: 24, config: { doors: 2, drawers: [] } },
    ],
  },
});
ok(countKitchenFaces([islandCfg(false)]).drawers === 2,
   "island modules are counted when the island is in scope");
ok(countKitchenFaces([islandCfg(true)]).doors === 0 &&
   countKitchenFaces([islandCfg(true)]).drawers === 0,
   "an excluded island takes its modules with it");

// A single module can be kept on its own — the client who keeps one drawer bank.
const oneModule = islandCfg(false);
oneModule.config.modules[0].config.outOfScope = true;
ok(countKitchenFaces([oneModule]).drawers === 0 && countKitchenFaces([oneModule]).doors === 2,
   "one excluded module doesn't take the rest of the island with it");

// ── 5. The client can see it and cannot set it ───────────────────────────
//
// Same rule as appliance prices (AGENTS.md §5): this flag moves money, so it
// comes back from the contractor's copy. The public designer greys the excluded
// boxes; it does not get to choose them.
const saved = { room: { width: 144, depth: 120, ceiling: 96 },
                elements: [cab(), keep({ id: "c2", wall: "B", width: 24 })] };

const greedy = mergeClientDesign(saved, {
  elements: saved.elements.map((e) => ({ ...e, config: { ...e.config, outOfScope: true } })),
});
ok(getKitchenBreakdown({ ...greedy, modules }).total ===
   getKitchenBreakdown({ ...saved,  modules }).total,
   "a client marking every cabinet 'existing' changes nothing");

const generous = mergeClientDesign(saved, {
  elements: saved.elements.map((e) => ({ ...e, config: { ...e.config, outOfScope: false } })),
});
ok(getKitchenBreakdown({ ...generous, modules }).excluded === 1,
   "…and un-marking the contractor's own exclusion changes nothing either");

const added = mergeClientDesign(saved, {
  elements: [...saved.elements, cab({ id: "new1", wall: "C", width: 30 })],
});
ok(!isOutOfScope(added.elements.find((e) => e.id === "new1")),
   "a cabinet the client ADDS is new work, so it is in scope");

// ── 6. The drawing says so ───────────────────────────────────────────────
//
// A price that quietly drops half a kitchen while the plan shows all of it is
// the worst outcome here — it looks right to everyone until the crew arrives.
const shown = { ...saved, finish: DEFAULT_FINISH };
const plan = planShapes(shown);
ok(plan.legend.length === 1 && /not included/i.test(plan.legend[0].label),
   `the plan carries a legend line: "${plan.legend[0]?.label}"`);
ok(planShapes({ ...shown, elements: [cab()] }).legend.length === 0,
   "…and none when nothing is excluded — no symbol, no key");

ok(colorFor(keep(), DEFAULT_FINISH) === EXISTING_COLOR,
   "an excluded cabinet is not painted in the colour being sold");
ok(colorFor(cab(), DEFAULT_FINISH) === DEFAULT_FINISH.cabinetColor,
   "…and an ordinary one is");

// Colour alone can't carry it: a client may choose a grey kitchen. The hatch is
// a mark no finish can produce.
const hatchCount = (design, wall) => {
  const a = elevationShapes({ ...design, elements: design.elements.map((e) => ({ ...e, config: { ...e.config, outOfScope: false } })) }, wall).shapes.length;
  const b = elevationShapes(design, wall).shapes.length;
  return b - a;
};
ok(hatchCount(shown, "B") > 0,
   `the excluded box is hatched on its elevation (+${hatchCount(shown, "B")} shapes)`);

const key = legendShapes(plan.legend, { x: 0, y: 0 });
const kinds = [...new Set(key.map((s) => s.type))].sort();
ok(kinds.join(",") === "line,rect,text",
   `the legend is built from shape types both adapters draw (${kinds.join(", ")})`);
ok(legendShapes([], { x: 0, y: 0 }).length === 0, "an empty legend draws nothing");

// ── 7. Hostile input ─────────────────────────────────────────────────────
for (const [name, value] of [
  ["string", "yes"], ["number", 1], ["object", {}], ["null", null], ["array", []],
]) {
  const el = cab({ config: { doors: 2, drawers: [], outOfScope: value } });
  const total = getKitchenBreakdown(createKitchenConfig({ elements: [el] })).total;
  const expected = value === null || value === 0 ? "priced" : "excluded";
  ok(Number.isFinite(total) && total >= 0,
     `outOfScope: ${name} → finite, non-negative ($${total}, ${expected})`);
}
ok(!isOutOfScope(null) && !isOutOfScope(undefined) && !isOutOfScope({}),
   "isOutOfScope survives a missing element");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
