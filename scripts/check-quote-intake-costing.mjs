// scripts/check-quote-intake-costing.mjs
//
// A cabinet quote is priced from intake answers — doors, drawer fronts, door
// material — and its COST is derived from the same answers through
// app/data/materialRecipes.js. QuoteScopeGroup had a column for the takeoff and
// none for the intake, so those answers were thrown away at save. The result
// was a Cost & Margin panel that showed a full costing while the quote was
// being written and "this quote was never costed" the moment it was saved.
//
// This executes the chain rather than reading it: intake → builder payload →
// what the server stores → what the server re-derives. Ordinary node, so the
// imports are rewritten off the @/ alias by the npm script.

import { estimateScopeGroupCost } from "../lib/costing/estimateJobCost.js";
import {
  quoteCostSummary,
  FALLBACK_LABOUR_RATE,
  FALLBACK_OVERHEAD_PCT,
  costBasisMissing,
} from "../lib/costing/quoteCosting.js";
import { scopeGroupPayload } from "../lib/quotes/builderPayload.js";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};

// The quote the owner reported: Q-2026-0007, 35 units of cabinet refinishing at
// $150, thermofoil. 32 doors + 3 drawer fronts.
const INTAKE = { doorCount: 32, drawerCount: 3, woodSpecies: "thermofoil" };
const GROUP = {
  tempId: "g1",
  categoryId: "cat-refinish",
  categoryKey: "cabinet_refinishing",
  label: "Cabinet Refinishing",
  intakeValues: INTAKE,
  baseUnitPrice: 150,
  complexityLevel: "standard",
  complexityReasons: [],
  lineItems: [],
  addOns: {},
};

// ── 1. The builder's payload carries the intake ───────────────────────────
const payload = scopeGroupPayload(GROUP, null);
ok("payload keeps intakeValues", JSON.stringify(payload.intakeValues) === JSON.stringify(INTAKE),
   JSON.stringify(payload.intakeValues));
ok("payload still prices 35 units", payload.lineItems[0]?.quantity === 35 && payload.lineItems[0]?.amount === 5250,
   JSON.stringify(payload.lineItems[0]));

// An emptied form is a statement, not silence: `{}` must be SENT so it
// overwrites, otherwise yesterday's door count keeps costing today's quote.
const cleared = scopeGroupPayload({ ...GROUP, intakeValues: {} }, null);
ok("a cleared form sends {} rather than omitting the key",
   cleared.intakeValues !== undefined && Object.keys(cleared.intakeValues).length === 0);

// ── 2. The server re-derives a real cost from the stored answers ──────────
const derived = estimateScopeGroupCost({
  categoryKey: "cabinet_refinishing",
  intake: payload.intakeValues,
  labourRatePerHour: FALLBACK_LABOUR_RATE,
});
ok("recipe returns labour hours", derived && derived.labourHours > 0, String(derived?.labourHours));
ok("recipe returns materials", derived && derived.materialTotal > 0, String(derived?.materialTotal));
// 32×45min + 3×20min = 1500min = 25h, plus 3h setup.
ok("hours match the recipe arithmetic (25h work + 3h setup)", derived.labourHours === 28, String(derived.labourHours));
// Thermofoil is in threeCoatSpecies, so 3 primer coats, not 2.
const primerLine = derived.materials.find((m) => m.name.startsWith("Primer"));
ok("thermofoil gets 3 primer coats", /3 coats/.test(primerLine?.name || ""), primerLine?.name);

// The same answers on a species that is NOT porous must cost less primer —
// proof the stored answer is actually read, not merely present.
const maple = estimateScopeGroupCost({
  categoryKey: "cabinet_refinishing",
  intake: { ...INTAKE, woodSpecies: "maple" },
  labourRatePerHour: FALLBACK_LABOUR_RATE,
});
ok("door material changes the cost", maple.materialTotal < derived.materialTotal,
   `${maple.materialTotal} vs ${derived.materialTotal}`);

// ── 3. Nothing stored still means no cost, and says so ────────────────────
const blind = quoteCostSummary({
  scopeGroups: [{ tempId: "g1", categoryKey: "cabinet_refinishing", label: "x", intakeValues: null, takeoff: null }],
  crew: [], labourRate: FALLBACK_LABOUR_RATE, addedLabourHours: 0, addedMaterialCost: 0,
  overheadPct: FALLBACK_OVERHEAD_PCT, price: 5250, marginTargetPct: 30,
});
ok("no intake → no basis, not a flattering margin",
   costBasisMissing({ ...blind, price: 5250 }) === true);

const seeing = quoteCostSummary({
  scopeGroups: [{ tempId: "g1", categoryKey: "cabinet_refinishing", label: "x", intakeValues: INTAKE, takeoff: null }],
  crew: [], labourRate: FALLBACK_LABOUR_RATE, addedLabourHours: 0, addedMaterialCost: 0,
  overheadPct: FALLBACK_OVERHEAD_PCT, price: 5250, marginTargetPct: 30,
});
ok("stored intake → a basis exists", costBasisMissing({ ...seeing, price: 5250 }) === false);
ok("labour is priced, not free", seeing.labourCost > 0, String(seeing.labourCost));
ok("margin is a number now", Number.isFinite(seeing.marginPct), String(seeing.marginPct));

// ── 4. The create screen and the server agree ─────────────────────────────
//
// The bug underneath the reported one: the builder assumed $35/hr and the
// server's recompute assumed $0, so the same quote showed two different
// margins depending on which screen you were on.
ok("one fallback rate, not two", FALLBACK_LABOUR_RATE === 35);
const asBuilder = quoteCostSummary({
  scopeGroups: [{ tempId: "g1", categoryKey: "cabinet_refinishing", label: "x", intakeValues: INTAKE, takeoff: null }],
  crew: [], labourRate: FALLBACK_LABOUR_RATE, addedLabourHours: 0, addedMaterialCost: 0,
  overheadPct: FALLBACK_OVERHEAD_PCT, price: 5250, marginTargetPct: 30,
});
ok("create screen and recompute produce the same cost",
   asBuilder.estimatedCost === seeing.estimatedCost,
   `${asBuilder.estimatedCost} vs ${seeing.estimatedCost}`);

// ── 5. Hostile input ──────────────────────────────────────────────────────
for (const bad of [null, undefined, {}, { doorCount: "abc" }, { doorCount: -5, drawerCount: -5 },
                   { doorCount: 1e400 }, { doorCount: "1e400" }, JSON.parse('{"__proto__":{"doorCount":999}}')]) {
  const r = estimateScopeGroupCost({ categoryKey: "cabinet_refinishing", intake: bad || {}, labourRatePerHour: 35 });
  const finite = r === null || (Number.isFinite(r.materialTotal) && Number.isFinite(r.labourHours) && Number.isFinite(r.labourCost));
  ok(`hostile intake stays finite: ${JSON.stringify(bad)}`, finite, JSON.stringify(r && { m: r.materialTotal, h: r.labourHours }));
}
// A prototype-polluted object must not conjure 999 doors.
const polluted = estimateScopeGroupCost({ categoryKey: "cabinet_refinishing", intake: JSON.parse('{"__proto__":{"doorCount":999}}'), labourRatePerHour: 35 });
ok("__proto__ door count is not read", polluted === null);

// ── It must not reach a stranger's browser ───────────────────────────────
//
// The public quote endpoint selects scope groups with `include`, so it holds
// the whole row — takeoff and now intake answers alike. present() rebuilds an
// explicit whitelist and that is the only reason neither travels. This asserts
// the whitelist stays a whitelist: the day someone returns `...g`, a homeowner
// receives the door counts and, through the takeoff, a countertop supplier's
// cost and the company's markup.
{
  const src = readFileSync("app/api/public/quotes/[token]/route.js", "utf8");
  const present = src.slice(src.indexOf("function present(quote)"));
  const mapped = present.slice(present.indexOf("scopeGroups: quote.scopeGroups.map"));
  const body = mapped.slice(0, mapped.indexOf("\n    }),"));
  ok("the public presenter never returns intakeValues", !/intakeValues/.test(body));
  ok("the public presenter never spreads the raw group", !/\.\.\.g\b/.test(body));
  ok("the public presenter never returns the takeoff",
     !/^\s*takeoff[,:]/m.test(body));
}

console.log(fail === 0 ? "\nALL PASS — intake answers survive the save and the cost derives from them" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
