// scripts/check-run-guards.mjs
//
// Executes the pay-run guards. No database, no clock.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-run-guards.mjs
//
// The one that is money: two runs over the same fortnight pay everybody twice,
// and nothing used to notice. Reported at preview where it is free to fix,
// refused at approval — the step after which people actually get paid.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cycleMatch,
  overlappingRuns,
  describeRunGuards,
} from "@/lib/payroll/runGuards";

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fails.push(`${name}: ${err.message}`);
  }
}

check("a period on the company's cadence is recognised", () => {
  const m = cycleMatch("2026-08-17", "2026-08-30", null);
  assert.equal(m.onCycle, true);
  assert.deepEqual(m.expected, { start: "2026-08-17", end: "2026-08-30" });
});

check("a drifted period is named, with the one it should have been", () => {
  // The exact failure the cycle exists to end: "the last fourteen days ending
  // today", run a day late.
  const m = cycleMatch("2026-08-18", "2026-08-31", null);
  assert.equal(m.onCycle, false);
  assert.deepEqual(m.expected, { start: "2026-08-17", end: "2026-08-30" });
  assert.match(describeRunGuards({ cycle: m })[0], /doesn't match your pay cycle/);
});

check("periods that merely touch do not count as overlapping", () => {
  // One ending the 30th and the next starting the 31st is how periods TILE.
  // Counting that as an overlap would flag every single run forever.
  const runs = [{ id: "a", periodStart: "2026-08-17", periodEnd: "2026-08-30", status: "paid" }];
  assert.equal(overlappingRuns(runs, "2026-08-31", "2026-09-13").length, 0);
  assert.equal(overlappingRuns(runs, "2026-08-03", "2026-08-16").length, 0);
});

check("a second run over the same days is caught", () => {
  const runs = [{ id: "a", periodStart: "2026-08-17", periodEnd: "2026-08-30", status: "paid" }];
  for (const [s, e] of [
    ["2026-08-17", "2026-08-30"], // identical
    ["2026-08-20", "2026-08-25"], // inside
    ["2026-08-10", "2026-09-05"], // straddling
    ["2026-08-30", "2026-09-12"], // one day of overlap
  ]) {
    assert.equal(overlappingRuns(runs, s, e).length, 1, `${s}–${e}`);
  }
  const msg = describeRunGuards({ overlaps: runs })[0];
  assert.match(msg, /already been PAID/);
  assert.match(msg, /pays them twice/);
});

check("a cancelled run is not an overlap", () => {
  // It paid nobody. Counting it would make the warning permanent for anyone
  // who has ever cancelled one, which is how a warning becomes wallpaper.
  const runs = [{ id: "a", periodStart: "2026-08-17", periodEnd: "2026-08-30", status: "cancelled" }];
  assert.equal(overlappingRuns(runs, "2026-08-17", "2026-08-30").length, 0);
});

check("a draft overlap reads differently from a paid one", () => {
  const draft = [{ id: "a", periodStart: "2026-08-17", periodEnd: "2026-08-30", status: "draft" }];
  const msg = describeRunGuards({ overlaps: draft })[0];
  assert.match(msg, /already a draft run/);
  assert.ok(!/twice/.test(msg), "a draft has not paid anybody");
});

check("hostile input never throws and never silently clears", () => {
  for (const bad of [null, undefined, 42, "runs", {}, [null], [{}], [{ periodStart: "x" }]]) {
    assert.deepEqual(overlappingRuns(bad, "2026-08-17", "2026-08-30"), []);
  }
  for (const bad of [null, undefined, "", "nope", {}, NaN]) {
    const m = cycleMatch(bad, bad, null);
    assert.equal(m.onCycle, false, String(bad));
  }
  assert.deepEqual(describeRunGuards({}), []);
  assert.deepEqual(describeRunGuards({ cycle: null, overlaps: null }), []);
});

check("approval refuses a duplicate; preview only reports one", () => {
  // A grep, because the alternative needs a session and a database. The
  // distinction is the design: a draft is a working document, an approved run
  // is a promise.
  const create = readFileSync(new URL("../app/api/payroll/runs/route.js", import.meta.url), "utf8");
  assert.match(create, /guards/, "the create route computes them");
  assert.ok(!/status: 409/.test(create.split("if (!commit)")[0].split("const guards")[1] || ""),
    "preview must not refuse");

  const detail = readFileSync(new URL("../app/api/payroll/runs/[id]/route.js", import.meta.url), "utf8");
  const approveBlock = detail.slice(detail.indexOf('action === "approve"'));
  assert.match(approveBlock, /overlappingRuns/, "approval checks for a duplicate");
  assert.match(approveBlock, /status: \{ in: \["approved", "paid"\] \}/,
    "and only against runs that are real money");
  assert.match(approveBlock, /status: 409/, "and refuses");
});

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ pay run guards: ${pass} checks passed`);
