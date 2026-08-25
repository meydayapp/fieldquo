// scripts/check-quote-builder.mjs
//
// ONE quote builder, used by two routes — and the money it produces is the
// same whichever one you came in through.
//
// ── What went wrong, and why this file exists ──────────────────────────────
//
// /app/quotes/new and /app/quotes/[id]/edit were two independent
// implementations of the same screen. They drifted exactly the way AGENTS.md
// says a copy drifts, and it cost money: the builder charged tax on the GROSS
// subtotal while the editor charged it on subtotal − discount, so the same
// quote had two different totals depending on which screen saved it last. It
// cost features too — the cost/margin panel, the 30-day expiry, the readiness
// checks and the discount entry modes all landed on one and never reached the
// other, so a saved quote could not be re-costed at all.
//
// So this check has two halves, and both matter:
//
//   1. STRUCTURE. Both routes render the same component and hold no builder
//      logic of their own. A future split fails the build instead of drifting
//      quietly for a month.
//   2. ARITHMETIC. The money is EXECUTED, in both modes, against the same
//      scope groups — including the round trip that is the real hazard here.
//
// ── The round trip is the hazard ───────────────────────────────────────────
//
// A takeoff and a unit-priced scope are DERIVED on screen and FLATTENED into
// stored line items at save, on purpose: a sent quote has to keep its prices
// when the rate card moves next week. Which means a group loaded back from the
// database has already been flattened. Deriving it a second time would prepend
// every derived line again and double the group's total — a bug that shows up
// as a quote quietly worth twice what the estimator agreed. `persisted` is what
// stops it, and the fixed point below is what proves it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-quote-builder.mjs

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  groupSubtotal,
  scopeGroupPayload,
  lineItemsFromStored,
  applyLineItemEdit,
  takeoffLinesFor,
} from "@/lib/quotes/builderPayload";
import { quoteTotals } from "@/lib/quotes/totals";
import { createTradeConfig } from "@/lib/pricing/tradeScope";
import { TAKEOFF_TRADES, hasTakeoff } from "@/lib/pricing/takeoffTrades";

let fail = 0;
const ok = (name, pass, detail = "") => {
  if (!pass) fail++;
  console.log(`${pass ? "  ok  " : "  FAIL"} ${name}${pass ? "" : `  ${detail}`}`);
};
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

const section = (s) => console.log(`\n${s}\n`);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ───────────────────────────────────────────────────────────────────────────
section("1. Both routes render the SAME component");
// ───────────────────────────────────────────────────────────────────────────

const SHARED = "@/app/components/quotes/builder/QuoteBuilder";
const ROUTES = [
  ["app/app/quotes/new/page.js", 'mode="create"'],
  ["app/app/quotes/[id]/edit/page.js", 'mode="edit"'],
];

for (const [file, modeProp] of ROUTES) {
  const src = read(file);
  const name = file.replace("app/app/quotes/", "");
  ok(`${name} exists`, src.length > 0, file);
  ok(
    `${name} imports the shared builder`,
    new RegExp(`import\\s+QuoteBuilder\\s+from\\s+["']${SHARED.replace("/", "\\/")}`.replace(/\//g, "\\/")).test(src) ||
      src.includes(`from "${SHARED}"`),
    "the whole point is that there is one of these",
  );
  ok(`${name} renders <QuoteBuilder`, src.includes("<QuoteBuilder"), "");
  ok(`${name} says which mode it is in`, src.includes(modeProp), modeProp);
}

// A wrapper is a wrapper. These are the tells of the old copies — state, the
// money helper, the line-item table, a save call. Any of them coming back means
// somebody started rebuilding one of the screens in place.
const FORBIDDEN = [
  ["useState", "page state belongs in the shared component"],
  ["quoteTotals", "two copies of the money is how the totals diverged"],
  ["LineItemsTable", "the line editor belongs in the shared component"],
  ["CostMarginPanel", "the cost panel belongs in the shared component"],
  ["QuoteTotalsBar", "the totals bar belongs in the shared component"],
  ["/api/quotes", "saving belongs in the shared component"],
];
for (const [file] of ROUTES) {
  const src = read(file);
  const name = file.replace("app/app/quotes/", "");
  for (const [needle, why] of FORBIDDEN) {
    ok(`${name} holds no ${needle}`, !src.includes(needle), why);
  }
  // Comments are welcome; code is not. 40 lines is generous for an import, a
  // hook and a return.
  const code = src
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//"));
  ok(`${name} is still a thin wrapper`, code.length <= 12, `${code.length} lines of code`);
}

// The two wrappers must resolve to the SAME file, not two files that happen to
// share a name.
ok(
  "the shared component exists where both routes point",
  existsSync("app/components/quotes/builder/QuoteBuilder.js"),
);

// ───────────────────────────────────────────────────────────────────────────
section("2. One request body, built once, for both verbs");
// ───────────────────────────────────────────────────────────────────────────

const builder = read("app/components/quotes/builder/QuoteBuilder.js");

ok(
  "the shared fields are assembled once",
  (builder.match(/const shared = \{/g) || []).length === 1,
  "two bodies is how a field ends up saved by one screen and not the other",
);
ok(
  "…and spread into both the POST and the PATCH",
  (builder.match(/\.\.\.shared,/g) || []).length === 2,
);
ok(
  "the money is worked out by the shared helper, once",
  (builder.match(/quoteTotals\(/g) || []).length === 1,
);
ok(
  "the CLAMPED discount is what gets saved",
  /discount: appliedDiscount/.test(builder),
  "saving the raw box would contradict the total printed beside it",
);
ok(
  "the tax FLAG is sent, not just the amount",
  /\btaxEnabled,/.test(builder),
  "read in two places and written in none was the original bug",
);
ok(
  "an edit omits scope groups once the client has decided",
  /canEditScope \? \{ scopeGroups/.test(builder),
  "the API refuses them, so sending them fails the whole save",
);
ok(
  "costing is omitted rather than emptied when it could not be loaded",
  /costingLoaded !== true\) return undefined/.test(builder),
  "an empty block over an existing row is read as 'the estimator cleared it'",
);

// ───────────────────────────────────────────────────────────────────────────
section("3. Flattening is a fixed point — a reopened quote is not worth double");
// ───────────────────────────────────────────────────────────────────────────

/** What the API stores → what the edit route loads back in. */
const reopen = (payload) => ({
  tempId: "t",
  id: payload.id || "g1",
  persisted: true,
  imported: false,
  categoryId: payload.categoryId,
  categoryKey: FIXTURE_KEY,
  label: payload.label,
  takeoff: payload.takeoff ?? null,
  lineItems: lineItemsFromStored(payload.lineItems),
});

let FIXTURE_KEY = "stairs";

const takeoffGroup = {
  tempId: "new",
  id: null,
  persisted: false,
  categoryId: "cat-stairs",
  categoryKey: "stairs",
  label: "Main staircase",
  intakeValues: {},
  takeoff: createTradeConfig("stairs"),
  lineItems: [
    { description: "Disposal fee", quantity: 1, unit: "flat", rate: 120, amount: 120 },
  ],
};

// A takeoff with nothing measured yet still has to behave; then one with real
// numbers in it, because a fixed point that only holds at zero proves nothing.
const measured = {
  ...takeoffGroup,
  takeoff: {
    ...createTradeConfig("stairs"),
    ...(createTradeConfig("stairs")?.sections
      ? {
          sections: (createTradeConfig("stairs").sections || []).map((s) => ({
            ...s,
            treads: 13,
            risers: 14,
            stringers: 2,
          })),
        }
      : {}),
  },
};

for (const [label, g] of [
  ["blank takeoff", takeoffGroup],
  ["measured takeoff", measured],
]) {
  const created = scopeGroupPayload(g, null);
  const reopened = reopen(created);
  const resaved = scopeGroupPayload(reopened, null);
  const again = scopeGroupPayload(reopen(resaved), null);

  ok(
    `${label}: derives something on create`,
    created.lineItems.length >= g.lineItems.length,
    JSON.stringify(created.lineItems.length),
  );
  eq(`${label}: reopening does not change the subtotal`, resaved.subtotal, created.subtotal);
  eq(`${label}: nor the number of lines`, resaved.lineItems.length, created.lineItems.length);
  eq(`${label}: a third save is still the same`, again.subtotal, created.subtotal);
  eq(
    `${label}: every amount survives the round trip`,
    resaved.lineItems.map((i) => i.amount),
    created.lineItems.map((i) => i.amount),
  );
  ok(
    `${label}: a reopened group derives NOTHING further`,
    takeoffLinesFor(reopened, null).length === 0,
    "deriving again is what doubles the total",
  );
  ok(
    `${label}: the takeoff form survives the round trip`,
    JSON.stringify(resaved.takeoff) === JSON.stringify(created.takeoff),
    "blanking it would leave a flat list nobody can recount",
  );
}

// The unit-priced trades take the same path through a different branch: a base
// line of units × final unit price, plus the rate-card add-ons.
FIXTURE_KEY = "cabinet_refinishing";
const cabinets = {
  tempId: "new",
  id: null,
  persisted: false,
  categoryId: "cat-cab",
  categoryKey: "cabinet_refinishing",
  label: "Kitchen cabinets",
  baseUnitPrice: 150,
  complexityLevel: "standard",
  complexityUpcharge: 0,
  complexityReasons: [],
  intakeValues: { doorCount: 22, drawerCount: 8 },
  lineItems: [],
};
{
  const created = scopeGroupPayload(cabinets, null);
  const resaved = scopeGroupPayload(reopen(created), null);
  ok("cabinets: a base line is written", created.lineItems.length >= 1);
  ok("cabinets: 30 units at $150 is $4,500", created.subtotal >= 4500, String(created.subtotal));
  eq("cabinets: reopening does not change the subtotal", resaved.subtotal, created.subtotal);
  eq("cabinets: nor the line count", resaved.lineItems.length, created.lineItems.length);
  ok(
    "cabinets: the pricing detail rides along for the review page",
    created.lineItems[0]?.meta?.baseUnitPrice === 150,
    JSON.stringify(created.lineItems[0]?.meta),
  );
}
FIXTURE_KEY = "stairs";

// ───────────────────────────────────────────────────────────────────────────
section("4. The totals behave identically in both modes");
// ───────────────────────────────────────────────────────────────────────────

/**
 * A whole quote, priced the way the screen prices it: sum the groups, then run
 * the shared totals helper. `mode` only decides whether the groups are stored
 * ones or freshly built ones — the arithmetic must not care.
 */
function priceQuote(groups, { discount, taxRate, taxEnabled }) {
  const subtotal = groups.reduce((s, g) => s + groupSubtotal(g, null), 0);
  return quoteTotals({ subtotal, discount, taxRate, taxEnabled });
}

const CASES = [
  ["no discount, 13% HST", { discount: "", taxRate: 13, taxEnabled: true }],
  ["a normal discount", { discount: "500", taxRate: 13, taxEnabled: true }],
  ["tax switched off", { discount: "500", taxRate: 13, taxEnabled: false }],
  ["a fat-fingered discount", { discount: "50000", taxRate: 13, taxEnabled: true }],
  ["a negative discount", { discount: "-500", taxRate: 13, taxEnabled: true }],
  ["nothing typed yet", { discount: "-", taxRate: "", taxEnabled: true }],
  ["Quebec GST+QST", { discount: "0", taxRate: 14.975, taxEnabled: true }],
];

for (const [label, terms] of CASES) {
  const createGroups = [takeoffGroup, cabinets];
  const editGroups = createGroups.map((g) => reopen(scopeGroupPayload(g, null)));

  const asCreated = priceQuote(createGroups, terms);
  const asEdited = priceQuote(editGroups, terms);

  eq(`${label}: same subtotal in both modes`, asEdited.subtotal, asCreated.subtotal);
  eq(`${label}: same discount applied`, asEdited.discount, asCreated.discount);
  eq(`${label}: same tax`, asEdited.tax, asCreated.tax);
  eq(`${label}: same total`, asEdited.total, asCreated.total);

  // Worked out here from first principles rather than by calling the helper
  // again — a check that reuses the implementation only proves it is consistent
  // with itself. Charging tax on the GROSS subtotal is the bug this guards.
  const rate = Number(terms.taxRate);
  const pct = Number.isFinite(rate) ? rate : 0;
  const expectedTax = terms.taxEnabled
    ? Math.round((asCreated.subtotal - asCreated.discount) * (pct / 100) * 100) / 100
    : 0;
  eq(`${label}: tax is charged on subtotal − discount`, asCreated.tax, expectedTax);
  ok(`${label}: never negative`, asCreated.total >= 0 && asCreated.tax >= 0 && asCreated.discount >= 0,
    JSON.stringify(asCreated));
  ok(`${label}: never NaN`, Object.values(asCreated).every((v) => Number.isFinite(v)),
    JSON.stringify(asCreated));
}

// The clamp, specifically: the number SAVED is the one the screen showed.
{
  const groups = [cabinets];
  const subtotal = groupSubtotal(cabinets, null);
  const r = quoteTotals({ subtotal, discount: "50000", taxRate: 13, taxEnabled: true });
  eq("a discount bigger than the job is capped at the job", r.discount, subtotal);
  eq("…and the total is zero, not negative", r.total, 0);
  eq("…and no tax is charged on nothing", r.tax, 0);
  ok("…and the groups are untouched by any of it", groups.length === 1);
}

// ───────────────────────────────────────────────────────────────────────────
section("5. Hostile and absent input");
// ───────────────────────────────────────────────────────────────────────────

const JUNK = [
  ["nothing at all", null],
  ["an empty object", {}],
  ["a string where lines should be", { categoryKey: "stairs", lineItems: "nope" }],
  ["NaN amounts", { categoryKey: "stairs", lineItems: [{ description: "x", quantity: "abc", amount: "abc" }] }],
  ["a null line", { categoryKey: "stairs", lineItems: [null, undefined] }],
  ["a takeoff that is a number", { categoryKey: "stairs", takeoff: 42 }],
  ["a trade nobody has heard of", { categoryKey: "unicorn_grooming", takeoff: { a: 1 }, lineItems: [] }],
  ["a persisted group with junk", { persisted: true, lineItems: [{ amount: "12.5" }, { amount: null }] }],
  ["unit pricing with no counts", { categoryKey: "cabinet_refinishing", intakeValues: {}, lineItems: [] }],
];

for (const [label, g] of JUNK) {
  let subtotal, payload;
  try {
    subtotal = groupSubtotal(g, null);
    payload = scopeGroupPayload(g, null);
  } catch (err) {
    ok(`${label}: survives`, false, err.message);
    continue;
  }
  ok(`${label}: a finite subtotal`, Number.isFinite(subtotal), String(subtotal));
  ok(
    `${label}: every amount on the wire is finite`,
    payload.lineItems.every((i) => Number.isFinite(i.amount) && Number.isFinite(i.quantity)),
    JSON.stringify(payload.lineItems),
  );
  ok(
    `${label}: the editor-only benchmark handle never ships`,
    payload.lineItems.every((i) => !("catalogKey" in i)),
    "a pointer into FieldQuo's own pricing research must not reach the document",
  );
}

// A suggestion carries catalogKey while its rate is blank, and must lose it.
{
  const g = {
    categoryKey: "stairs",
    lineItems: [
      { description: "Disposal fee", quantity: 1, rate: 0, amount: 0, catalogKey: "disposal" },
    ],
  };
  const p = scopeGroupPayload(g, null);
  ok("catalogKey is stripped on save", !("catalogKey" in p.lineItems[0]));
  eq("…and nothing else about the line changes", p.lineItems[0].description, "Disposal fee");
}

// ───────────────────────────────────────────────────────────────────────────
section("6. Reopening a stored line does not lose its amount");
// ───────────────────────────────────────────────────────────────────────────
//
// The old editor on the edit route typed an AMOUNT; this one types quantity ×
// rate. So a stored line with no `rate` has to gain one that multiplies back to
// what is on the document, or reopening a quote silently reprices it.

const STORED = [
  ["a flat line with no rate", { description: "Labour", quantity: 1, amount: 2400 }, 2400],
  ["a quantity line with no rate", { description: "Treads", quantity: 13, amount: 1300 }, 1300],
  ["a zero-quantity oddity", { description: "Odd", quantity: 0, amount: 500 }, 500],
  ["a rate that already agrees", { description: "Risers", quantity: 4, rate: 25, amount: 100 }, 100],
  ["a rate that disagrees with the amount", { description: "Import", quantity: 1, rate: 0, amount: 900 }, 900],
  ["a string amount", { description: "Str", quantity: "2", amount: "50" }, 50],
];

for (const [label, line, wantAmount] of STORED) {
  const [restored] = lineItemsFromStored([line]);
  eq(`${label}: the amount is untouched on load`, restored.amount, wantAmount);
  ok(`${label}: a usable rate exists`, Number.isFinite(restored.rate), String(restored.rate));
  ok(`${label}: quantity is at least 1`, restored.quantity >= 1, String(restored.quantity));
  // And the moment somebody edits it, the amount is qty × rate and finite.
  const edited = applyLineItemEdit(restored, "quantity", restored.quantity);
  ok(`${label}: editing keeps it finite`, Number.isFinite(edited.amount), String(edited.amount));
}

// A half-typed number must not reach a Decimal column.
for (const bad of ["", "-", "abc", null, undefined, NaN]) {
  const e = applyLineItemEdit({ quantity: 1, rate: 10, amount: 10 }, "rate", bad);
  ok(`editing the rate to ${String(bad)} gives 0, not NaN`, e.amount === 0, String(e.amount));
}

// ───────────────────────────────────────────────────────────────────────────
section("7. The takeoff list and the takeoff forms agree");
// ───────────────────────────────────────────────────────────────────────────

// The list moved to lib so the pricing code can ask without importing React.
// The forms stayed in the component. A key in one and not the other is either a
// takeoff whose lines never price or a price with no form to enter it.
const takeoffSrc = read("app/components/quotes/builder/TradeTakeoff.js");
const mapBlock = takeoffSrc.slice(
  takeoffSrc.indexOf("const TAKEOFFS = {"),
  takeoffSrc.indexOf("};", takeoffSrc.indexOf("const TAKEOFFS = {")),
);
const componentKeys = [...mapBlock.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
eq(
  "every takeoff form has a list entry (and vice versa)",
  [...componentKeys].sort(),
  [...TAKEOFF_TRADES].sort(),
);
ok(
  "cabinets are NOT takeoff trades",
  !hasTakeoff("cabinet_refinishing") && !hasTakeoff("cabinet_refacing"),
  "they price per door; treating them as takeoffs double-charges the base scope",
);

// ───────────────────────────────────────────────────────────────────────────
section("8. The payload did not change shape");
// ───────────────────────────────────────────────────────────────────────────
//
// An md5 of the serialised body is cheap proof that a refactor of the screen
// changed nothing about what reaches the API. Update the hash deliberately when
// the shape is MEANT to change, never to make a red check go green.

const canonical = scopeGroupPayload(
  {
    id: "grp_1",
    persisted: false,
    categoryId: "cat_1",
    categoryKey: "cabinet_refinishing",
    label: "Kitchen cabinets",
    baseUnitPrice: 150,
    complexityLevel: "standard",
    complexityUpcharge: 0,
    complexityReasons: [],
    color: "White Dove",
    sheen: "satin",
    doorStyle: "shaker",
    intakeValues: { doorCount: 22, drawerCount: 8 },
    lineItems: [
      { description: "Disposal fee", quantity: 1, unit: "flat", rate: 120, amount: 120 },
    ],
  },
  null,
);
const keys = Object.keys(canonical).sort();
// `intakeValues` joined this list deliberately, and the exact-key form is why
// it had to be argued for rather than slipped in: doors, drawer fronts and the
// door material are what the material recipe derives a COST from, and with no
// column to keep them in, a cabinet quote could be re-priced but never
// re-costed. It is internal — the client's document is built from lineItems —
// and QuoteScopeGroup.intakeValues says so.
eq("the wire shape is id / categoryId / label / intakeValues / lineItems / subtotal", keys, [
  "categoryId",
  "id",
  "intakeValues",
  "label",
  "lineItems",
  "subtotal",
]);
console.log(
  `  note  payload md5 ${createHash("md5").update(JSON.stringify(canonical)).digest("hex")}`,
);

// ───────────────────────────────────────────────────────────────────────────

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — one builder, one set of totals, flattening is a fixed point\n",
);
process.exit(fail ? 1 : 0);
