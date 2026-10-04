// scripts/check-custom-item.mjs
//
// "Create custom item" in the quote builder's Add service dialog (owner,
// 2026-10-03): "custom item should be based on the current estimate so they
// pick one service and based on what we have the custom line item makes
// sense." lib/quotes/customItem.js holds every rule; CustomItemDialog.js is
// the boxes; QuoteBuilder hands the add.
//
//   npm run check:custom-item
//
//   A. The units a service offers — its own measured units first, with the
//      figure THIS group holds and the calculator it came from; each, hour,
//      lump sum; the units its calculator already bills, flagged.
//   B. The line, against hostile input — negative / zero / huge / junk
//      quantities, an empty or control-character description, a unit from
//      another service (unit mismatch), negative and absurd prices, an
//      amount past what a line may hold, rich-text junk in the details.
//   C. Through the save: a custom item sits in the group's typed lines,
//      beside the calculator's derived lines, counted ONCE — cabinets, stairs,
//      interior painting with trim, a plain trade — and the save → reload →
//      save round trip is a fixed point (nothing doubles).
//   D. Tiers: a tiered-package group keeps its custom item when a tier is
//      picked (and a group with none gets exactly the one line it always
//      did); Good/Better/Best variants are three quotes, each with its own
//      lines and totals.
//   E. Downstream: the document (toGroups — PDF, email, client page), the
//      invoice the accepted quote becomes (ensureInvoiceForQuote, executed),
//      job costing (lineItemCost), commission linkage (productId), the
//      billed-units reader (billedUnitsOf) untouched.
//   F. Save to price book: the POST /api/products body.
//   G. Payload md5: groups with no custom item save byte-identically to
//      before this existed.
//   H. Wiring, read from source, and the words in nine languages.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-custom-item.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  customItemTargets,
  customItemUnits,
  buildCustomLine,
  isCustomItemLine,
  tierSelectedLines,
  priceBookBody,
  openingQuantity,
  MAX_QUANTITY,
  MAX_LINE_AMOUNT,
} from "@/lib/quotes/customItem";
import {
  newScopeGroup,
  scopeGroupPayload,
  groupSubtotal,
  lineItemsFromStored,
  billedUnitsOf,
} from "@/lib/quotes/builderPayload";
import { quoteTotals, round2 } from "@/lib/quotes/totals";
import { newPaintArea, newPaintSubstrate } from "@/lib/pricing/paintTakeoff";
import { toGroups } from "@/lib/quotes/scopeGroupDisplay";
import { lineItemCostOf, scopeGroupsLineItemCost } from "@/lib/costing/lineItemCost";
import { ensureInvoiceForQuote } from "@/lib/invoices/createInvoiceFromQuote";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${cond || !detail ? "" : `  (${detail})`}`);
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
const src = (p) => readFileSync(p, "utf8");
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

// ── Fixtures ──────────────────────────────────────────────────────────────
const CAB = { id: "cat-cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", unit: "unit" };
const STAIRS = { id: "cat-st", key: "stairs", label: "Stairs" };
const INT = { id: "cat-int", key: "interior_painting", label: "Interior Painting", unit: "sqft" };
const PLUMB = { id: "cat-pl", key: "plumbing", label: "Plumbing", unit: "hour", defaultRate: 120 };
const JUNK = { id: "cat-junk", key: "junk_removal", label: "Junk Removal" };
const DRY = { id: "cat-dry", key: "drywall_install", label: "Drywall" };

function cabinetGroup() {
  const g = newScopeGroup(CAB, "Kitchen cabinets", null, { tempId: "g-cab" });
  return { ...g, intakeValues: { doorCount: 32, drawerCount: 6 } };
}
function stairsGroup() {
  const g = newScopeGroup(STAIRS, "Main staircase", null, { tempId: "g-st" });
  const sections = g.takeoff.sections.map((s) => ({ ...s, treads: 13, risers: 14, balusters: 26, posts: 2, handrailFt: 14 }));
  return { ...g, takeoff: { ...g.takeoff, sections } };
}
function interiorGroup() {
  const g = newScopeGroup(INT, "Living room", null, { tempId: "g-int" });
  const area = {
    ...newPaintArea("living_room", undefined, { estimateType: "interior" }),
    lengthFt: 15,
    widthFt: 12,
    heightFt: 8,
    substrates: [newPaintSubstrate("walls"), newPaintSubstrate("baseboard")].filter(Boolean),
  };
  return { ...g, takeoff: { ...g.takeoff, areas: [area] } };
}
function plumbingGroup() {
  return newScopeGroup(PLUMB, "Plumbing", null, { tempId: "g-pl" });
}
const unitsOf = (g, cat) => customItemUnits(g, { categoryUnit: cat?.unit || null });
const line = (g, cat, input) => buildCustomLine(input, { units: unitsOf(g, cat), categoryKey: g.categoryKey, showPricing: true });

// ───────────────────────────────────────────────────────────────────────────
console.log("A. the units a service offers");
// ───────────────────────────────────────────────────────────────────────────
{
  const cab = unitsOf(cabinetGroup(), CAB);
  const doors = cab.find((u) => u.id === "m:doorCount");
  ok("cabinets: per door first, opening on the 32 doors the intake holds", cab[0]?.id === "m:doorCount" && doors.figure === 32 && doors.calc === "cabinet" && openingQuantity(doors) === 32);
  ok("…drawer fronts too", cab.some((u) => u.id === "m:drawerCount" && u.figure === 6));
  ok("…both flagged as already billed by the cabinet calculator", doors.pricedByCalculator && doors.pricedBy === "cabinet" && cab.find((u) => u.id === "m:drawerCount").pricedByCalculator);
  ok("…the base line's own unit is NOT offered as a plain unit (billedUnitsOf would read it as more doors)", !cab.some((u) => u.id === "u:unit"));
  ok("…each, hour, lump sum after", ["u:each", "u:hour", "u:flat"].every((id) => cab.some((u) => u.id === id)));

  const st = unitsOf(stairsGroup(), STAIRS);
  ok("stairs: per tread with the takeoff's 13", st.some((u) => u.id === "m:treads" && u.figure === 13 && u.calc === "stairs"));
  ok("…handrail in linear ft", st.some((u) => u.id === "m:handrailFt" && u.unit === "linear_ft" && u.figure === 14));
  ok("…treads flagged as priced by the stair takeoff", st.find((u) => u.id === "m:treads").pricedBy === "stairs");

  const int = unitsOf(interiorGroup(), INT);
  const wall = int.find((u) => u.id === "m:wallSqft");
  const trim = int.find((u) => u.id === "m:linearFt");
  ok("interior: sq ft of wall from the room (15×12×8 → 432)", wall?.figure === 432 && wall.calc === "paint", JSON.stringify(wall));
  ok("…trim run (linear ft) from the same room", trim?.figure === 54, JSON.stringify(trim));
  ok("…walls and baseboard are priced by the room takeoff — flagged", wall.pricedByCalculator && trim.pricedByCalculator && trim.pricedBy === "paint");
  ok("…ceiling is measured but NOT priced (no ceiling substrate) — not flagged", int.some((u) => u.id === "m:ceilingSqft" && u.figure === 180 && !u.pricedByCalculator));
  ok("…the company's sq ft unit offered plainly too", int.some((u) => u.id === "u:sqft"));

  const ext = unitsOf({ ...interiorGroup(), takeoff: { ...interiorGroup().takeoff, estimateType: "exterior" } }, INT);
  ok("an exterior painting estimate offers the exterior list (no ceiling)", !ext.some((u) => u.id === "m:ceilingSqft") && ext.some((u) => u.id === "m:wallSqft"));

  const pl = unitsOf(plumbingGroup(), PLUMB);
  eq("a trade with no calculator: its own unit, then each / hour / lump sum, nothing doubled", pl.map((u) => u.id), ["u:hour", "u:each", "u:flat"]);
  ok("…nothing flagged", pl.every((u) => !u.pricedByCalculator));

  const dry = unitsOf(newScopeGroup(DRY, "Drywall", null, { tempId: "g-dry" }), DRY);
  ok("drywall: board units named against the drywall price book when it bills board", dry.filter((u) => u.pricedByCalculator).every((u) => u.pricedBy === "drywallBook"));

  eq("junk group / no group → no units", customItemUnits(null), []);
  ok("hostile category unit is dropped, not offered", !customItemUnits(plumbingGroup(), { categoryUnit: "<script>" }).some((u) => u.unit === "<script>"));

  const targets = customItemTargets(
    [cabinetGroup(), { ...plumbingGroup(), imported: true }, null, "x", { tempId: "nocat" }, stairsGroup()],
    [CAB, PLUMB, STAIRS],
  );
  eq("targets: the estimate's services, never an imported sub cost or junk", targets.map((x) => x.tempId), ["g-cab", "g-st"]);
  ok("…carrying the quote type for the price book", targets[0].categoryId === "cat-cab" && targets[0].categoryLabel === "Cabinet Refinishing");
  eq("no services on the estimate → no targets", customItemTargets([], [CAB]), []);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("B. the line, against hostile input");
// ───────────────────────────────────────────────────────────────────────────
{
  const g = cabinetGroup();
  const good = line(g, CAB, { description: "Extra coat on doors", unitId: "m:doorCount", quantity: 32, rate: "12.50", unitCost: "4" });
  ok("a good line builds", good.ok, JSON.stringify(good));
  const l = good.line;
  eq("…the ordinary line shape", { d: l.description, q: l.quantity, u: l.unit, r: l.rate, a: l.amount, c: l.unitCost }, { d: "Extra coat on doors", q: 32, u: "each", r: 12.5, a: 400, c: 4 });
  eq("…office-only meta, no money in it", l.meta, { customItem: { categoryKey: "cabinet_refinishing", measurementKey: "doorCount", filled: { value: 32, calc: "cabinet" } } });
  ok("…no tax flag (a quote taxes as a whole)", !("taxable" in l));
  ok("…recognised as a custom item", isCustomItemLine(l) && !isCustomItemLine({ description: "x" }) && !isCustomItemLine(null));
  const part = line(g, CAB, { description: "Glass doors", unitId: "m:doorCount", quantity: 4, rate: 30 });
  ok("a quantity under the measured figure is not marked as filled from it", part.ok && !part.line.meta.customItem.filled);

  const bad = (name, input, field, reason, opts = {}) => {
    const r = buildCustomLine(input, { units: unitsOf(g, CAB), categoryKey: g.categoryKey, showPricing: true, ...opts });
    ok(name, !r.ok && r.field === field && r.reason === reason, JSON.stringify(r));
  };
  const base = { description: "Item", unitId: "u:each", quantity: 1, rate: 10 };
  bad("negative quantity refused", { ...base, quantity: -3 }, "quantity", "quantityPositive");
  bad("zero quantity refused", { ...base, quantity: 0 }, "quantity", "quantityPositive");
  bad("a quantity that rounds to zero refused", { ...base, quantity: 0.001 }, "quantity", "quantityPositive");
  bad("huge quantity refused", { ...base, quantity: MAX_QUANTITY + 1 }, "quantity", "quantityLarge");
  bad("1e309 (Infinity) refused", { ...base, quantity: "1e309" }, "quantity", "quantity");
  bad("NaN refused", { ...base, quantity: "abc" }, "quantity", "quantity");
  bad("blank quantity refused", { ...base, quantity: "" }, "quantity", "quantity");
  bad("boolean quantity refused", { ...base, quantity: true }, "quantity", "quantity");
  bad("empty description refused", { ...base, description: "" }, "description", "description");
  bad("whitespace / control-character description refused", { ...base, description: " \u0000\t\n " }, "description", "description");
  bad("unit from another service (treads on a cabinet group) refused — unit mismatch", { ...base, unitId: "m:treads" }, "unit", "unit");
  bad("missing unit refused", { ...base, unitId: undefined }, "unit", "unit");
  bad("an invented unit refused", { ...base, unitId: "u:bananas" }, "unit", "unit");
  bad("negative price refused", { ...base, rate: -5 }, "rate", "rateNegative");
  bad("blank price refused", { ...base, rate: "" }, "rate", "rate");
  bad("absurd price refused", { ...base, rate: 1e9 }, "rate", "rateLarge");
  bad("an amount past what a line holds refused", { ...base, quantity: 900000, rate: 1000 }, "rate", "amountLarge");
  bad("negative cost refused", { ...base, unitCost: -1 }, "unitCost", "costNegative");
  bad("absurd cost refused", { ...base, unitCost: 1e12 }, "unitCost", "costLarge");
  ok("a refused input is not a line", !buildCustomLine(null, { units: [] }).ok && !buildCustomLine("junk", { units: unitsOf(g, CAB) }).ok);

  const commas = line(g, CAB, { ...base, quantity: "1,250", rate: "2,000.50" });
  ok("typed thousands separators read as numbers", commas.ok && commas.line.quantity === 1250 && commas.line.rate === 2000.5, JSON.stringify(commas));
  const zeroCost = line(g, CAB, { ...base, unitCost: 0 });
  ok("a zero cost adds no unitCost key (absent is absent)", zeroCost.ok && !("unitCost" in zeroCost.line));
  const free = line(g, CAB, { ...base, rate: 0 });
  ok("a $0 line is allowed (a goodwill item), amount 0", free.ok && free.line.amount === 0);
  const unpriced = buildCustomLine({ ...base, rate: -999, unitCost: 50 }, { units: unitsOf(g, CAB), showPricing: false });
  ok("without showPricing: no price, no cost — whatever the browser sent", unpriced.ok && unpriced.line.rate === 0 && unpriced.line.amount === 0 && !("unitCost" in unpriced.line));
  const long = line(g, CAB, { ...base, description: "x".repeat(500) });
  ok("a 500-character description is capped at 160", long.ok && long.line.description.length === 160);
  const xss = line(g, CAB, { ...base, detail: "<script>alert(1)</script>\u0007 [x](javascript:alert(1))" });
  ok("details go through the rich-text sanitiser (control characters stripped; markup stays text)", xss.ok && !/\u0007/.test(xss.line.detail) && typeof xss.line.detail === "string");
  const blankDetail = line(g, CAB, { ...base, detail: "   " });
  ok("blank details add no key", blankDetail.ok && !("detail" in blankDetail.line));
  const pid = line(g, CAB, { ...base, productId: "  prod_1 " });
  ok("a productId (Save to price book) rides on the line, trimmed", pid.ok && pid.line.productId === "prod_1");
  const pidJunk = line(g, CAB, { ...base, productId: { $ne: 1 } });
  ok("…a junk productId adds nothing", pidJunk.ok && !("productId" in pidJunk.line));
  const fractional = line(g, CAB, { ...base, unitId: "u:hour", quantity: 2.25, rate: 85 });
  ok("hours in quarters: 2.25 h × $85 = $191.25", fractional.ok && fractional.line.amount === 191.25 && fractional.line.unit === "hour");
  const tiny = line(g, CAB, { ...base, quantity: 3, rate: 0.333 });
  ok("money rounds to the cent", tiny.ok && tiny.line.rate === 0.33 && tiny.line.amount === 0.99, JSON.stringify(tiny.line));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("C. through the save — beside the calculator, counted once, a fixed point");
// ───────────────────────────────────────────────────────────────────────────
function withCustom(g, cat, input) {
  const r = line(g, cat, input);
  if (!r.ok) throw new Error(`fixture line refused: ${r.error}`);
  return { ...g, lineItems: [...g.lineItems, r.line] };
}
function roundTrip(g) {
  const saved = scopeGroupPayload(g, null, "en");
  const reloaded = { ...g, id: "stored", persisted: true, lineItems: lineItemsFromStored(saved.lineItems) };
  return { saved, again: scopeGroupPayload(reloaded, null, "en"), reloaded };
}
{
  const cases = [
    ["cabinets (unit-priced)", cabinetGroup(), CAB, { description: "Glass inserts", unitId: "m:doorCount", quantity: 4, rate: 45, unitCost: 20 }],
    ["stairs (takeoff)", stairsGroup(), STAIRS, { description: "Extra coat on treads", unitId: "m:treads", quantity: 13, rate: 15 }],
    ["interior painting with trim (takeoff)", interiorGroup(), INT, { description: "Crown moulding", unitId: "m:linearFt", quantity: 54, rate: 3.5 }],
    ["plumbing (plain)", plumbingGroup(), PLUMB, { description: "Shut-off valve", unitId: "u:each", quantity: 2, rate: 65 }],
  ];
  for (const [name, g, cat, input] of cases) {
    const before = scopeGroupPayload(g, null, "en");
    const after = withCustom(g, cat, input);
    const saved = scopeGroupPayload(after, null, "en");
    const customs = saved.lineItems.filter(isCustomItemLine);
    const amount = round2(input.quantity * input.rate);
    ok(`${name}: the custom item is saved exactly once`, customs.length === 1 && customs[0].description === input.description);
    ok(`${name}: every derived line is still there, unchanged`, JSON.stringify(saved.lineItems.filter((l) => !isCustomItemLine(l))) === JSON.stringify(before.lineItems));
    ok(`${name}: the group subtotal rises by the line's amount, no more`, round2(saved.subtotal - before.subtotal) === amount, `${before.subtotal} → ${saved.subtotal}, line ${amount}`);
    ok(`${name}: the subtotal is the sum of the saved lines`, round2(saved.lineItems.reduce((s, l) => s + Number(l.amount), 0)) === saved.subtotal);
    const { again, reloaded } = roundTrip(after);
    ok(`${name}: save → reload → save is a fixed point (nothing derived twice)`, again.subtotal === saved.subtotal && again.lineItems.filter(isCustomItemLine).length === 1 && again.lineItems.length === saved.lineItems.length);
    ok(`${name}: the reloaded group's own subtotal agrees`, groupSubtotal(reloaded) === saved.subtotal);
  }
  // The trim case the owner named: the room takeoff prices baseboard; a
  // custom crown-moulding line on the same linear feet is a separate line,
  // counted once, and the screen says it is on top.
  const g = withCustom(interiorGroup(), INT, { description: "Crown moulding", unitId: "m:linearFt", quantity: 54, rate: 3.5 });
  const saved = scopeGroupPayload(g, null, "en");
  const takeoffLines = saved.lineItems.filter((l) => !isCustomItemLine(l));
  ok("trim: the takeoff's own lines are not touched by the custom line", takeoffLines.length > 0 && takeoffLines.every((l) => !l.meta?.customItem));
  ok("trim: the overlap is flagged for the screen, not silently merged", unitsOf(g, INT).find((u) => u.id === "m:linearFt").pricedByCalculator);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("D. tiers — a tiered package, and Good/Better/Best");
// ───────────────────────────────────────────────────────────────────────────
{
  const junk = newScopeGroup(JUNK, "Junk removal", null, { tempId: "g-junk" });
  eq("a tiered group with no custom item gets exactly the line it always got", tierSelectedLines(junk, "Half Load"), [
    { description: "Junk removal — Half Load", quantity: 1, unit: "flat", rate: 0, amount: 0 },
  ]);
  const withItem = withCustom(junk, JUNK, { description: "Mattress disposal fee", unitId: "u:each", quantity: 2, rate: 40 });
  const picked = tierSelectedLines(withItem, "Full Truckload");
  ok("picking a tier keeps the custom item (it used to replace the whole list)", picked.length === 2 && picked[1].description === "Mattress disposal fee" && picked[0].description === "Junk removal — Full Truckload");
  const repicked = tierSelectedLines({ ...withItem, lineItems: picked }, "Quarter Load");
  ok("…re-picking replaces the TIER line, never stacks it, never duplicates the item", repicked.length === 2 && repicked.filter(isCustomItemLine).length === 1 && repicked[0].description.endsWith("Quarter Load"));
  ok("…a hand-typed (non-custom) line is still replaced, as before", tierSelectedLines({ ...junk, lineItems: [{ description: "typed", amount: 5 }] }, "Half Load").length === 1);

  // Good/Better/Best (POST /api/quotes/tier-group): three independent Quote
  // rows, each with its own scope groups. A custom item on Better is
  // Better's alone.
  const tiers = ["good", "better", "best"].map((tier, i) => {
    let g = plumbingGroup();
    g = { ...g, tempId: `g-${tier}`, lineItems: [{ ...g.lineItems[0], quantity: 1 + i, amount: round2((1 + i) * 120) }] };
    if (tier === "better") g = withCustom(g, PLUMB, { description: "Pressure regulator", unitId: "u:each", quantity: 1, rate: 210 });
    const payload = scopeGroupPayload(g, null, "en");
    return { tier, payload, totals: quoteTotals({ subtotal: payload.subtotal, discount: 0, taxRate: 13, taxEnabled: true }) };
  });
  ok("G/B/B: only Better carries the custom item", tiers.map((x) => x.payload.lineItems.filter(isCustomItemLine).length).join() === "0,1,0");
  ok("G/B/B: Better's subtotal is its own lines plus the item; Good and Best unmoved", tiers[0].payload.subtotal === 120 && tiers[1].payload.subtotal === 450 && tiers[2].payload.subtotal === 360, tiers.map((x) => x.payload.subtotal).join());
  ok("G/B/B: tax on Better includes the item, like its other lines", tiers[1].totals.tax === round2(450 * 0.13), JSON.stringify(tiers[1].totals));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("E. downstream — document, invoice, costing, commissions");
// ───────────────────────────────────────────────────────────────────────────
{
  const cab = withCustom(cabinetGroup(), CAB, { description: "Glass inserts", detail: "Clear tempered glass in 4 upper doors.", unitId: "m:doorCount", quantity: 4, rate: 45, unitCost: 20, productId: "prod_glass" });
  const pl = withCustom(plumbingGroup(), PLUMB, { description: "Shut-off valve", unitId: "u:each", quantity: 2, rate: 65 });
  const stored = [cab, pl].map((g, i) => {
    const p = scopeGroupPayload(g, null, "en");
    return { id: `sg${i}`, label: p.label, lineItems: p.lineItems, subtotal: p.subtotal, sortOrder: i, category: { key: g.categoryKey } };
  });

  const doc = toGroups({ scopeGroups: stored });
  const docItem = doc[0].items.find((i) => i.description === "Glass inserts");
  ok("the document (PDF, email, client page) draws the custom item with its words and amount", docItem && Number(docItem.amount) === 180 && docItem.detail === "Clear tempered glass in 4 upper doors.");
  ok("…its group subtotal includes it once", doc[0].subtotal === stored[0].subtotal);

  const lineCostBefore = scopeGroupsLineItemCost([{ lineItems: scopeGroupPayload(cabinetGroup(), null, "en").lineItems }]);
  ok("job costing: the unit cost counts once (4 × $20 = $80)", round2(scopeGroupsLineItemCost(stored) - lineCostBefore) === 80);
  ok("commissions: the price-book item is linked by productId, as a priced-book line is", stored[0].lineItems.find(isCustomItemLine).productId === "prod_glass");
  eq("billedUnitsOf (the cabinet faces billed) is not moved by a custom item", billedUnitsOf({ lineItems: stored[0].lineItems }), billedUnitsOf({ lineItems: scopeGroupPayload(cabinetGroup(), null, "en").lineItems }));

  // The accepted quote → its invoice, executed against a stand-in client.
  const subtotal = round2(stored.reduce((s, g) => s + g.subtotal, 0));
  const t = quoteTotals({ subtotal, discount: 0, taxRate: 13, taxEnabled: true });
  const quote = {
    id: "q1", companyId: "co1", clientId: "cl1", quoteNumber: "Q-2026-0042", status: "accepted",
    scopeGroups: stored, addOns: [], lineItems: null,
    subtotal, discount: 0, tax: t.tax, total: t.total, taxEnabled: true, taxResolution: null,
    acceptedTotal: null, acceptedSubtotal: null, acceptedTax: null,
    offlineDiscountPct: null, offlineDiscountChosen: false, clientPhotos: null, language: "en", clientPoNumber: null,
  };
  let created = null;
  const tx = {
    $queryRaw: async () => [],
    quote: { findUnique: async () => quote },
    invoice: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }) => (created = { id: "inv1", ...data }),
    },
    job: { findFirst: async () => null },
  };
  const res = await ensureInvoiceForQuote("q1", { db: { $transaction: (fn) => fn(tx) } });
  ok("the accepted quote becomes an invoice", res.created && created);
  const invItems = created.lineItems.filter((l) => /Glass inserts|Shut-off valve/.test(l.description));
  ok("the invoice mirrors both custom items, once each, under their service", invItems.length === 2 && invItems[0].description === "Kitchen cabinets: Glass inserts" && invItems[1].description === "Plumbing: Shut-off valve", JSON.stringify(invItems.map((l) => l.description)));
  ok("…with quantity, unit, rate, amount and cost intact", invItems[0].quantity === 4 && invItems[0].unit === "each" && invItems[0].rate === 45 && invItems[0].amount === 180 && invItems[0].unitCost === 20);
  ok("…the invoice's lines sum to the quote's subtotal (nothing double counted)", round2(created.lineItems.reduce((s, l) => s + Number(l.amount), 0)) === subtotal && Number(created.subtotal) === subtotal);
  ok("…and the invoice total is the quote's total", Number(created.total) === t.total);
  ok("…invoice costing reads the same unit cost", lineItemCostOf(created.lineItems) === scopeGroupsLineItemCost(stored));
  const invDoc = toGroups({ lineItems: created.lineItems });
  ok("…and the invoice document draws them", invDoc[0].items.some((i) => i.description === "Kitchen cabinets: Glass inserts"));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("F. Save to price book");
// ───────────────────────────────────────────────────────────────────────────
{
  const l = line(cabinetGroup(), CAB, { description: "Glass inserts", detail: "Tempered", unitId: "m:doorCount", quantity: 4, rate: 45, unitCost: 20 }).line;
  eq("the POST /api/products body: name, words, price, cost, unit, linked to the quote type", priceBookBody(l, { categoryId: "cat-cab" }), {
    name: "Glass inserts", description: "Tempered", type: "service", unitPrice: 45, costPrice: 20, unit: "each", categoryIds: ["cat-cab"],
  });
  ok("a $0 line is not a price-book entry", priceBookBody({ ...l, rate: 0 }) === null);
  ok("junk → null", priceBookBody(null) === null && priceBookBody({ description: "", rate: 5 }) === null && priceBookBody({ description: "x", rate: "abc" }) === null);
  ok("no cost → costPrice null (not 0)", priceBookBody({ ...l, unitCost: undefined }).costPrice === null);
  ok("the body carries no money the route would not take from the products screen", Object.keys(priceBookBody(l)).sort().join() === "categoryIds,costPrice,description,name,type,unit,unitPrice");
}

// ───────────────────────────────────────────────────────────────────────────
console.log("G. payload md5 — groups with no custom item save as they always did");
// ───────────────────────────────────────────────────────────────────────────
{
  // builderPayload.js is not touched by this change; these fixtures are the
  // proof that the builder's saves are byte-identical for every quote
  // without a custom item. Taken from the code before the change.
  const fixtures = [cabinetGroup(), stairsGroup(), interiorGroup(), plumbingGroup(), newScopeGroup(JUNK, "Junk removal", null, { tempId: "g-junk" })];
  const digest = md5(fixtures.map((g) => scopeGroupPayload(g, null, "en")));
  console.log(`  note  no-custom-item payload md5 ${digest}`);
  ok("payload md5 unchanged", digest === "4dc8be0f9121266407ec707bbb57dd44", digest);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("H. wiring and words");
// ───────────────────────────────────────────────────────────────────────────
{
  const qb = src("app/components/quotes/builder/QuoteBuilder.js");
  const doc = src("app/components/quotes/builder/DocumentBuilder.js");
  const picker = src("app/components/quotes/builder/AddServicePicker.js");
  const dialog = src("app/components/quotes/builder/CustomItemDialog.js");
  const inv = src("app/components/invoices/builder/InvoiceBuilder.js");
  ok("the builder hands the picker its custom-item add", /customItem: customItemPicker,/.test(qb) && /add: addCustomItem,/.test(qb));
  ok("…which appends to the chosen group's typed lines, never an imported group", /g\.tempId === groupTempId && !g\.imported \? \{ \.\.\.g, lineItems: \[\.\.\.g\.lineItems, line\] \}/.test(qb));
  ok("…the targets and units come from lib/quotes/customItem.js", /customItemTargets\(scopeGroups, categories\)/.test(qb) && /customItemUnits\(g, \{ categoryUnit/.test(qb));
  ok("picking a tier keeps custom items (tierSelectedLines)", /lineItems: tierSelectedLines\(g, tierLabel\)/.test(qb));
  ok("Save to price book is offered only to the roles POST /api/products allows", /canSaveToBook: \["owner", "admin"\]\.includes\(caller\?\.role\)/.test(qb) && /\["owner", "admin"\]\.includes\(member\.role\)/.test(src("app/api/products/route.js")));
  ok("the document layout keeps the add and unfolds the chosen service", /b\.servicePicker\.customItem\.add\(tempId, line\);\s*setOpenGroup\(tempId\);/.test(doc));
  ok("the picker draws the entry and the dialog", /<CustomItemEntry picker=\{picker\} onCustom=\{onCustom\}/.test(picker) && /<CustomItemDialog customItem=\{custom\}/.test(picker));
  ok("an invoice's picker never offers it", /picker\?\.kind === "invoice" \? null : picker\?\.customItem/.test(picker) && !/customItem/.test(inv));
  ok("the dialog builds the line with the pure rule and adds through the builder", /buildCustomLine\(/.test(dialog) && /customItem\.add\(tempId, line\)/.test(dialog));
  ok("the dialog posts to the price book only through priceBookBody", /priceBookBody\(line, \{ categoryId/.test(dialog) && /fetchJson\("\/api\/products"/.test(dialog));
  ok("…and a failed price-book save adds nothing", /bookFailed[\s\S]{0,200}return;/.test(dialog));
  ok("the line table names a custom item and warns on a calculator's unit", /isCustomItemLine\(item\)/.test(qb) && /app\.customItem\.lineNoteOverlap/.test(qb));

  const used = new Set();
  for (const code of [dialog, picker, qb]) for (const m of code.matchAll(/t\(\s*"(app\.(?:customItem|servicePicker)\.[A-Za-z_]+)"/g)) used.add(m[1]);
  // The error keys are composed from buildCustomLine's reasons.
  for (const r of ["description", "unit", "quantity", "quantityPositive", "quantityLarge", "rate", "rateNegative", "rateLarge", "costNegative", "costLarge", "amountLarge"]) used.add(`app.customItem.error_${r}`);
  const reasons = [...src("lib/quotes/customItem.js").matchAll(/fail\("[a-zA-Z]+", "([a-zA-Z]+)"/g)].map((m) => m[1]);
  ok("every reason buildCustomLine returns has a message key", reasons.length > 0 && reasons.every((r) => used.has(`app.customItem.error_${r}`)), reasons.join());
  const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9);
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = [...used].filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`every custom-item key exists in ${lang}`, missing.length === 0, missing.join(", "));
    const bad = [...used].filter((k) => k in APP_MESSAGES[lang] && holes(APP_MESSAGES[lang][k]) !== holes(APP_MESSAGES.en[k]));
    ok(`${lang}: placeholders match English`, bad.length === 0, bad.join(", "));
  }
  const unused = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.customItem.") && !used.has(k));
  ok("every app.customItem string is one something prints", unused.length === 0, unused.join(", "));
}

if (fails.length) {
  console.error(`\n✗ custom item: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ custom item: ${pass} checks`);
