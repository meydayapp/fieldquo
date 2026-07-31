// Executes lib/analytics/trend.js — the "up from last month" claim, made honest.
import { compare, describeRateTrend } from "@/lib/analytics/trend";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

console.log("\nNo comparison without a real prior (the whole point)");
ok("prior null -> null, not an invented baseline", compare(0.43, null) === null);
ok("prior undefined -> null", compare(0.43, undefined) === null);
ok("current NaN -> null", compare(NaN, 0.3) === null);
ok("prior NaN -> null", compare(0.43, "abc") === null);

console.log("\nDirection");
ok("clearly up", compare(0.43, 0.31).direction === "up");
ok("clearly down", compare(0.31, 0.48).direction === "down");
ok("within 2% band -> flat", compare(0.401, 0.40).direction === "flat", compare(0.401, 0.40));
ok("just past the band -> not flat", compare(0.42, 0.40).direction === "up");

console.log("\nFrom zero — up, but no percentage");
const fromZero = compare(0.43, 0);
ok("0 -> positive reads up", fromZero.direction === "up");
ok("...deltaPct is null (no ∞%)", fromZero.deltaPct === null);
ok("0 -> 0 is flat", compare(0, 0).direction === "flat");

console.log("\nDeltas");
ok("deltaAbs is the difference", Math.abs(compare(0.43, 0.31).deltaAbs - 0.12) < 1e-9);
ok("deltaPct is relative", Math.abs(compare(120, 100).deltaPct - 0.2) < 1e-9);

console.log("\ndescribeRateTrend — the phrase, or nothing");
ok("up phrase", describeRateTrend(0.43, 0.31) === "up from 31% last month");
ok("down phrase", describeRateTrend(0.31, 0.48) === "down from 48% last month");
ok("flat phrase", describeRateTrend(0.40, 0.40) === "about the same as last month");
ok("no prior -> null (omit the clause)", describeRateTrend(0.43, null) === null);
ok("custom period label", describeRateTrend(0.5, 0.4, { period: "last quarter" }).endsWith("last quarter"));
ok("rounds the prior to whole %", describeRateTrend(0.43, 0.314) === "up from 31% last month");

console.log("\nThe marketing example is now deliverable from real data");
// "a 43% conversion rate, up from 31% last month"
ok("real data reproduces the illustrative claim",
  `a ${Math.round(0.43 * 100)}% conversion rate, ${describeRateTrend(0.43, 0.31)}` ===
    "a 43% conversion rate, up from 31% last month");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
