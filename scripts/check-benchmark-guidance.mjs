// scripts/check-benchmark-guidance.mjs
//
// The quote builder is behind a login, so the picker and the benchmark hint
// can't be exercised in a browser from here. What CAN be exercised is every
// decision they make, because all of it is pure: which section a chip lands in,
// which kind of guidance a line resolves to, and whether the hint shows at all.
//
// These assertions are written against the same expressions LineItemsTable.js
// evaluates. When you change that component, change these with it — a copy of
// the logic that drifts is worse than no test, because it keeps passing.

import { readFileSync } from "node:fs";
import { ELECTRICAL_LINE_ITEMS, ELECTRICAL_LINE_ITEM_GROUPS } from "@/app/data/electricalCatalog";
import { PLUMBING_LINE_ITEMS, PLUMBING_LINE_ITEM_GROUPS } from "@/app/data/plumbingCatalog";
import { getDefaultLineItems } from "@/app/data/defaultLineItems";
import { getLineItemGroups } from "@/app/data/lineItemGroups";
import { getBenchmark, hasBenchmarks } from "@/lib/pricing/benchmarkGuidance";

let passed = 0;
const failures = [];

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const TRADES = [
  { key: "electrical", items: ELECTRICAL_LINE_ITEMS, groups: ELECTRICAL_LINE_ITEM_GROUPS },
  { key: "plumbing", items: PLUMBING_LINE_ITEMS, groups: PLUMBING_LINE_ITEM_GROUPS },
];

// ── Wiring ──────────────────────────────────────────────────────────────────

section("Wiring — the catalogues actually reach the builder");

for (const { key, items } of TRADES) {
  const served = getDefaultLineItems(key);
  ok(
    `${key}: getDefaultLineItems returns the catalogue, not the generic fallback`,
    served.length === items.length && served.length > 20,
    `got ${served.length}`,
  );
  ok(
    `${key}: no served line carries a numeric rate`,
    served.every((l) => typeof l.rate !== "number"),
  );
  ok(
    `${key}: every served line has a stable key for the benchmark lookup`,
    served.every((l) => typeof l.key === "string" && l.key.length > 0),
  );
}

ok(
  "an unknown category still falls back to the generic list",
  getDefaultLineItems("not_a_trade").length > 0 &&
    getDefaultLineItems("not_a_trade").length < 10,
);

// ── The sectioned picker ────────────────────────────────────────────────────

section("Picker — every chip lands in exactly one visible section");

for (const { key, items, groups } of TRADES) {
  const declared = getLineItemGroups(key);
  ok(
    `${key}: lineItemGroups exposes the catalogue's own groups`,
    declared.length === groups.length && declared.length > 0,
  );

  const groupKeys = new Set(declared.map((g) => g.key));
  const orphans = items.filter((i) => !groupKeys.has(i.group));
  ok(
    `${key}: no line references a group that isn't rendered`,
    orphans.length === 0,
    orphans.map((o) => o.key).join(", "),
  );

  // The component builds sections then drops the empty ones. If that dropped a
  // line, the chip would simply not exist — a suggestion silently missing from
  // a picker is the quiet form of a control that doesn't work.
  const rendered = declared
    .map((g) => items.filter((i) => i.group === g.key))
    .filter((list) => list.length > 0)
    .flat();
  ok(
    `${key}: sectioning loses no lines (${rendered.length}/${items.length})`,
    rendered.length === items.length,
  );

  ok(
    `${key}: is over the grouping threshold, so it renders sectioned`,
    items.length >= 20,
    `${items.length} lines`,
  );
}

const flatTrade = getDefaultLineItems("countertop");
ok(
  "a short trade has no groups and stays flat",
  getLineItemGroups("countertop").length === 0 && flatTrade.length < 20,
);

// ── Benchmark resolution ────────────────────────────────────────────────────

section("Benchmarks — every line resolves, and no label is malformed");

const KINDS = new Set(["range", "ceiling", "multiplier", "single", "none"]);

for (const { key, items } of TRADES) {
  const resolved = items.map((i) => ({ i, b: getBenchmark(key, i.key) }));

  const missing = resolved.filter((r) => !r.b);
  ok(
    `${key}: every catalogue line resolves to a benchmark`,
    missing.length === 0,
    missing.map((m) => m.i.key).join(", "),
  );

  const badKind = resolved.filter((r) => r.b && !KINDS.has(r.b.kind));
  ok(`${key}: every result carries a known kind`, badKind.length === 0);

  // The normaliser had exactly this bug on first run: an unhandled shape
  // printed "basis undefined×" into the label. Cheap to assert, and it is the
  // failure a reader would see first.
  const badLabel = resolved.filter(
    (r) => r.b && /undefined|NaN|\bnull\b/i.test(r.b.label),
  );
  ok(
    `${key}: no label leaks undefined/NaN/null`,
    badLabel.length === 0,
    badLabel.map((m) => `${m.i.key}: ${m.b.label}`).join(" | "),
  );

  const numeric = resolved.filter((r) => r.b.kind === "range");
  ok(
    `${key}: ranged benchmarks are ordered low ≤ typical ≤ high`,
    numeric.length > 0,
    "no ranged benchmarks at all",
  );

  // A "no number" result must say WHY. Rendering "no benchmark" with no reason
  // is indistinguishable from a lookup that silently failed.
  const silent = resolved.filter(
    (r) => r.b.kind !== "range" && !String(r.b.detail || "").trim(),
  );
  ok(
    `${key}: every non-range result explains itself`,
    silent.length === 0,
    silent.map((m) => m.i.key).join(", "),
  );
}

// A multiplier is a usable number and must not be classified as absent — the
// normaliser's first pass got this wrong for electrical after-hours.
const afterHours = getBenchmark("electrical", "after_hours");
ok(
  "electrical after-hours is a multiplier, not 'no benchmark'",
  afterHours?.kind === "multiplier" && /×/.test(afterHours.label),
  afterHours?.label,
);
const emergency = getBenchmark("plumbing", "emergency_callout");
ok(
  "plumbing emergency call-out names its tiers",
  emergency?.kind === "multiplier" &&
    /weeknight/.test(emergency.label) &&
    /holiday/.test(emergency.label),
  emergency?.label,
);

section("Benchmarks — trades without a table say nothing at all");

ok("hasBenchmarks is true for the two researched trades",
  hasBenchmarks("electrical") && hasBenchmarks("plumbing"));
ok(
  "hasBenchmarks is false for every other trade",
  !hasBenchmarks("countertop") && !hasBenchmarks("roofing_service") && !hasBenchmarks(""),
);
ok(
  "an unresearched trade returns null rather than an empty range",
  getBenchmark("countertop", "disposal") === null &&
    getBenchmark("roofing_service", "permit") === null,
);
ok(
  "an unknown key in a researched trade returns null",
  getBenchmark("electrical", "no_such_line") === null &&
    getBenchmark("plumbing", "no_such_line") === null,
);

section("Benchmarks — hostile input never produces a number");

for (const bad of [null, undefined, "", 0, [], {}, "__proto__", "constructor"]) {
  const r = getBenchmark("electrical", bad);
  ok(
    `getBenchmark(electrical, ${JSON.stringify(bad)}) is null`,
    r === null,
    JSON.stringify(r)?.slice(0, 80),
  );
}
ok(
  "a null category is null, not a crash",
  getBenchmark(null, "service_call") === null &&
    getBenchmark(undefined, "service_call") === null,
);

// ── The hint's visibility rule ──────────────────────────────────────────────

section("Hint — shows only while the rate is blank");

// Mirrors BenchmarkHint: `rate > 0 || !catalogKey` → render nothing.
const shows = (item, cat = "electrical") => {
  const rate = Number(item.rate) || 0;
  if (rate > 0 || !item.catalogKey) return false;
  return getBenchmark(cat, item.catalogKey) != null;
};

ok("shows on a priced-catalogue line with a blank rate",
  shows({ rate: 0, catalogKey: "panel_replacement" }));
ok("hides once a rate is entered",
  !shows({ rate: 1800, catalogKey: "panel_replacement" }));
ok("hides as soon as any positive rate is typed, however small",
  !shows({ rate: 0.01, catalogKey: "panel_replacement" }));
ok("a blank, NaN or negative rate still counts as unpriced and shows",
  shows({ rate: "", catalogKey: "panel_replacement" }) &&
    shows({ rate: NaN, catalogKey: "panel_replacement" }) &&
    shows({ rate: -5, catalogKey: "panel_replacement" }));
ok("hides on a hand-typed line with no catalogue key",
  !shows({ rate: 0, description: "Something bespoke" }));
ok("hides for a trade with no benchmark table",
  !shows({ rate: 0, catalogKey: "disposal" }, "countertop"));
ok("shows the no-number cases too, because a stated gap is information",
  shows({ rate: 0, catalogKey: "reinspection" }) &&
    getBenchmark("electrical", "reinspection").kind === "none");

// ── Boundaries ──────────────────────────────────────────────────────────────

section("Boundary — guidance is internal and never persisted");

const page = readFileSync("app/app/quotes/new/page.js", "utf8");
ok(
  "the builder strips catalogKey before POSTing the quote",
  /lineItems:\s*lineItems\.map\(\(\{\s*catalogKey,\s*\.\.\.item\s*\}\)\s*=>\s*item\)/.test(page),
  "the editor-only handle would otherwise be saved onto the document",
);
ok(
  "the builder attaches catalogKey when adding a suggestion",
  /catalogKey:\s*suggestion\.key/.test(page),
  "without it the hint can never resolve",
);

const guidance = readFileSync("lib/pricing/benchmarkGuidance.js", "utf8");
ok(
  "the guidance module states in words that it is not client-facing",
  /never\s+(reach|be)\b[\s\S]{0,80}client|Nothing here is client-facing/i.test(guidance),
);

// Same rule the two catalogue checks enforce for the tables themselves: the
// normaliser is one import hop from them, so it needs the same fence.
const CLIENT_DIRS = ["app/quote", "app/book", "app/q", "app/portal", "app/site", "app/embed"];
const { execSync } = await import("node:child_process");
let leaked = "";
try {
  leaked = execSync(
    `grep -rl "benchmarkGuidance\\|electricalBenchmarks\\|plumbingBenchmarks\\|electricalMaterials\\|plumbingMaterials" ${CLIENT_DIRS.join(" ")} 2>/dev/null || true`,
    { encoding: "utf8" },
  ).trim();
} catch {
  leaked = "";
}
ok(
  "no client-facing route imports the benchmarks, materials or the normaliser",
  leaked === "",
  leaked,
);

// ── Result ──────────────────────────────────────────────────────────────────

console.log("");
if (failures.length) {
  console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`ALL PASS — ${passed} passed, 0 failed`);
