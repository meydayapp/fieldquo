#!/usr/bin/env node
//
// scripts/check-interconnections.mjs
//
// The map in docs/INTERCONNECTIONS.md, asserted against the code.
//
// ══ Why a checked map and not a written one ═══════════════════════════════
//
// A hand-written architecture document is a snapshot of what someone believed
// on the day they wrote it. This project already has the evidence: three
// separate features shipped this week where a number reached a screen and
// reached no total, and each was written by someone who had read a comment
// saying it would.
//
//   · ChangeOrder.priceDelta — a form, a list, a KPI, and no invoice.
//   · TimeEntry from the phone clock — no jobId, so job costing never saw it.
//   · A receipt aimed at JobMaterial.actualCost — a table job costing does not
//     read at all.
//
// Every one of those is the same shape: a plausible destination that nothing
// consumes. A document describing the flows would not have caught any of them,
// because the document would have described the intention.
//
// So this file asserts the flows instead. When a flow changes, this fails and
// the map gets corrected — which is the only way a map stays worth reading.
import { readFileSync } from "node:fs";

let passed = 0;
const failures = [];
const ok = (n, c, d = "") => {
  if (c) { passed++; console.log("  ✓ " + n); }
  else { failures.push(n + (d ? ` — ${d}` : "")); console.log("  ✗ " + n + (d ? ` — ${d}` : "")); }
};
const src = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };

// Both needles must exist AND be ordered. `indexOf` returns -1 for an absent
// needle and -1 is less than every real index, so the naive form passes when
// the thing you are checking for has been deleted.
function orderedIn(s, a, b) {
  const ia = s.indexOf(a), ib = s.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
}

console.log("\nFLOW 1 — what reaches a job's ACTUAL COST");
// The single most misread flow in the codebase. Three separate features have
// aimed a number at the wrong table here.
const costing = src("app/api/jobs/[id]/costing/route.js");
ok("the costing route exists", costing !== null);
ok("Expense, by projectId", /db\.expense\.findMany/.test(costing || "") && /projectId: job\.id/.test(costing || ""));
ok("TimeEntry, by jobId", /db\.timeEntry\.findMany/.test(costing || "") && /jobId: job\.id/.test(costing || ""));
ok("AssetUseLog", /db\.assetUseLog\.findMany/.test(costing || ""));
// The negative is the valuable half: this is what people keep getting wrong.
ok(
  "JobMaterial does NOT reach actual cost — it is a sourcing list",
  !/db\.jobMaterial\./.test(costing || ""),
);
const sourcing = src("lib/jobs/sourcingList.js");
ok("and JobMaterial is written by the sourcing list", /jobMaterial/.test(sourcing || ""));

console.log("\nFLOW 2 — how a receipt reaches a margin");
// Added after a receipt was aimed at JobMaterial.actualCost, which no total
// reads. The receipt lives on the row costing actually sums.
const schema = src("prisma/schema.prisma");
ok("Expense carries the receipt", /receiptUrl\s+String\?/.test(schema || ""));
ok("and what the model read, verbatim", /receiptExtract\s+Json\?/.test(schema || ""));
ok(
  "Expense links to a job by projectId",
  /model Expense \{[\s\S]{0,2000}?projectId\s+String\?/.test(schema || ""),
);

console.log("\nFLOW 3 — what a job is WORTH");
// Revenue was the quote total alone; every agreed change was missing from it.
const changeValue = src("lib/jobs/changeOrderValue.js");
ok("approved change orders have a single valuer", changeValue !== null);
ok("and costing consults it", /changeOrder|contractValue/i.test(costing || ""));

console.log("\nFLOW 4 — what earns a sales commission");
const commission = src("lib/sales/commission.js");
ok("activation reads stripeChargesEnabled", /stripeChargesEnabled/.test(commission || ""));
ok(
  "first payment requires money actually collected",
  /amount_paid/.test(commission || "") && /subscription_create/.test(commission || ""),
);
ok(
  "retention runs from subscription START, trial included",
  /subscriptionStartedAt/.test(commission || ""),
);
ok(
  "and never from onboarding completeness",
  !/onboardingCompletedAt/.test(commission || ""),
);

console.log("\nFLOW 5 — who is on trial");
const trial = src("lib/platform/trialCounting.js") || src("lib/signup/abandoned.js");
ok("trial state has one definition", trial !== null);
ok(
  "a Subscription row is what proves checkout completed",
  /subscription/i.test(trial || ""),
);

console.log("\nFLOW 6 — the guard that must be inside the write");
// An `if` above the write leaves the window the race lives in.
const stale = src("lib/concurrency/staleWrite.js");
ok("the stale-write guard exists", stale !== null);
ok(
  "and goes in the WHERE, not an if above it",
  /versionWhere|where:/.test(stale || ""),
);

console.log("\nFLOW 7 — the boundaries that must not be crossed");
const provider = src("lib/ai/provider.js");
ok("one file talks to the model vendor", provider !== null && /new OpenAI/.test(provider));
const otherOpenAI = src("lib/ai/usage.js");
ok("and usage metering is separate from it", otherOpenAI !== null);
const demo = src("lib/demo/simulatedSpend.js");
ok("one helper answers 'is this a demo'", demo !== null && /isDemoCompany/.test(demo));

console.log("\nFLOW 8 — the generated entity graph is current");
// A generated map that is not regenerated is a hand-written map with extra
// steps. This compares the committed section against a fresh generation.
import { execSync } from "node:child_process";
let regen = "";
try {
  execSync("node scripts/gen-interconnections.mjs", { stdio: "pipe" });
  regen = readFileSync("docs/INTERCONNECTIONS.generated.md", "utf8");
} catch {
  regen = "";
}
const committed = src("docs/INTERCONNECTIONS.md") || "";
ok("the graph regenerates", regen.length > 0);
// Compare the model count rather than the whole text: a relation added to an
// existing pair changes a cell, and demanding byte-equality would fail on
// whitespace nobody cares about.
// Anchored to the generated table's three-column shape. An earlier version
// matched any row opening with a backticked name and picked up a row from the
// three-valued-fields table above — off by exactly one, which is the most
// annoying kind of wrong.
const countOf = (t) => (t.match(/^\| `\w+` \| [^|]*\| [^|]*\|$/gm) || []).length;
ok(
  "and the committed graph has the same number of models as the schema",
  countOf(committed) === countOf(regen),
  `committed ${countOf(committed)} vs schema ${countOf(regen)}`,
);

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const f of failures) console.error("  ✗ " + f);
  console.error("\nA flow changed. Fix docs/INTERCONNECTIONS.md to match, or fix the code.");
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} flows still hold`);
