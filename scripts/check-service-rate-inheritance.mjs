// scripts/check-service-rate-inheritance.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-service-rate-inheritance.mjs
//
// ── The invariant ──────────────────────────────────────────────────────────
//
// app/data/tradePriceBooks.js states it, at TRADE_DEFAULT_RATES:
//
//   "Read-time fallback ONLY. Nothing writes these into a row, for two
//    reasons: a company that never opens the rates screen keeps inheriting
//    improvements here (same contract as the books), and
//    lib/pricing/benchmarkData.js builds its peer comparisons from rates
//    companies actually set — seeding the column would feed it FieldQuo's own
//    defaults back as though they were market data."
//
// app/api/settings/service-categories/route.js restated it in its own words.
// And then broke it, in three lines that each look reasonable alone:
//
//   GET   defaultRate: setting?.defaultRate ?? defaultTradeRate(c.key)?.rate
//   page  categories.map((c) => ({ …, defaultRate: c.defaultRate, unit: c.unit }))
//   PATCH defaultRate: c.defaultRate ?? null
//
// Once the fallback is resolved into the same field as the stored value, the
// screen cannot tell them apart, so it echoes it back — and the PATCH writes
// unconditionally. One press of Save, with nothing typed into any box, pinned
// electrical to $80/hour, plumbing to $95, lawn_care to $82 and
// residential_cleaning to $65. Both consequences the comment names then
// followed: the company stopped inheriting, and benchmarkData.js:116
// (`where: { defaultRate: { not: null } }`) began counting those four numbers
// as rates real companies had chosen.
//
// ── Why the assertions are what they are ───────────────────────────────────
//
// The load-bearing one is #4: it RUNS newScopeGroup, the real quote-builder
// seeding path, and requires that a company with a null column still opens at
// the catalogue rate. That is the half of the fix that could be silently lost
// — stopping the write is easy, keeping the read-time fallback working
// everywhere is the part that would regress into a $0 line item.
//
// Source is comment-stripped first: this file, the route and the page all now
// carry a description of the forbidden shape, and a write-up of a bug matches
// as the bug.

import { readFileSync } from "node:fs";
import {
  TRADE_DEFAULT_RATES,
  defaultTradeRate,
} from "@/app/data/tradePriceBooks";
import { newScopeGroup } from "@/lib/quotes/builderPayload";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const route = stripComments(read("app/api/settings/service-categories/route.js"));
const page = stripComments(read("app/app/settings/services/page.js"));
const benchmark = stripComments(read("lib/pricing/benchmarkData.js"));

// ── 1. The four trades, named, so a fifth is a deliberate decision ─────────
const EXPECTED = {
  electrical: 80,
  plumbing: 95,
  lawn_care: 82,
  residential_cleaning: 65,
};
ok(
  "TRADE_DEFAULT_RATES still holds exactly the four book-less trades",
  Object.keys(TRADE_DEFAULT_RATES).sort().join(",") ===
    Object.keys(EXPECTED).sort().join(","),
);
for (const [key, rate] of Object.entries(EXPECTED)) {
  ok(`${key} still opens at ${rate}`, defaultTradeRate(key)?.rate === rate);
}
ok(
  "a trade WITH a price book has no flat default to pin",
  defaultTradeRate("cabinet_refinishing") === null,
);

// ── 2. The GET keeps the stored value and the inherited one apart ──────────
//
// Asserted as a shape rather than by searching for the word "inherited": the
// bug is specifically the `??` chain collapsing two answers into one field.
ok(
  "the GET no longer resolves the fallback into defaultRate",
  !/defaultRate:\s*setting\?\.defaultRate\s*\?\?\s*defaultTradeRate/.test(route),
);
ok(
  "the GET no longer resolves the fallback into unit",
  !/unit:\s*setting\?\.unit\s*\?\?\s*defaultTradeRate/.test(route),
);
ok(
  "the GET sends what the company actually stored",
  /defaultRate:\s*setting\?\.defaultRate\s*\?\?\s*null/.test(route),
);
ok(
  "...and the catalogue's opening rate as a separate field",
  /inheritedRate:\s*defaultTradeRate\(c\.key\)\?\.rate/.test(route),
);
ok(
  "...and the same for the unit",
  /unit:\s*setting\?\.unit\s*\?\?\s*null/.test(route) &&
    /inheritedUnit:\s*defaultTradeRate\(c\.key\)\?\.unit/.test(route),
);

// ── 3. The screen shows the inherited number without adopting it ───────────
//
// A placeholder is visible and is not a value. `value` must stay bound to the
// stored field, or the save re-acquires the fallback by another route.
ok(
  "the rate box shows the inherited rate as a placeholder",
  /placeholder=\{[\s\S]{0,120}c\.inheritedRate != null/.test(page),
);
ok(
  "the unit box does the same",
  /placeholder=\{[\s\S]{0,120}c\.inheritedUnit \|\|/.test(page),
);
ok(
  "the rate box's VALUE is still only what the company stored",
  /value=\{c\.defaultRate \?\? ""\}/.test(page),
);
ok(
  "clearing the box sends null rather than 0",
  /defaultRate: e\.target\.value[\s\S]{0,120}: null,/.test(page),
);

// ── 4. The read-time fallback still works, run for real ────────────────────
//
// This is the assertion that would catch the wrong fix — stopping the write
// while forgetting that something downstream was relying on the pinned value.
// newScopeGroup is the production path that seeds a quote line item.
{
  const inheriting = { id: "c1", key: "electrical", unit: "hour", defaultRate: null };
  const chosen = { id: "c1", key: "electrical", unit: "hour", defaultRate: 125 };

  const g1 = newScopeGroup(inheriting, "Electrical");
  const g2 = newScopeGroup(chosen, "Electrical");

  ok(
    "a company that never typed a rate still opens at the catalogue rate, not $0",
    g1.lineItems?.[0]?.rate === 80 && g1.lineItems?.[0]?.amount === 80,
  );
  ok(
    "a company that DID type a rate keeps theirs",
    g2.lineItems?.[0]?.rate === 125,
  );
  // The trades with a book must not acquire a flat rate by this route.
  const booked = newScopeGroup(
    { id: "c2", key: "roofing", unit: "sqft", defaultRate: null },
    "Roofing",
  );
  ok(
    "a trade with a price book still seeds at 0 from this path, not from a guess",
    (booked.lineItems?.[0]?.rate ?? 0) === 0,
  );
}

// ── 5. The reason the invariant exists is still live ───────────────────────
//
// If the benchmark ever stops filtering on a non-null defaultRate, half the
// justification above has changed and this file should be re-read rather than
// quietly kept passing.
ok(
  "the peer benchmark still counts only rates a company set",
  /defaultRate:\s*\{\s*not:\s*null\s*\}/.test(benchmark),
);

// ── 6. The comment that would get a live column deleted ────────────────────
//
// The PATCH's header said of pricingModel: "nothing looks at it". The
// benchmark does — it selects the column and derives a unit from it. AGENTS.md
// says fix the comment too.
ok(
  "the benchmark really does read pricingModel (so the old comment was wrong)",
  /pricingModel:\s*true/.test(benchmark) && /pricingModelUnit\(/.test(benchmark),
);
ok(
  "the route no longer claims nothing reads pricingModel",
  !/last stored, and nothing looks at it/.test(read("app/api/settings/service-categories/route.js")),
);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(
  `\ncheck-service-rate-inheritance: ${pass} passed, ${failures.length} failed`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
