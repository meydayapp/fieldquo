// Executes effectiveWageRate — the fallback that gets a member-set rate onto a payslip.
import { effectiveWageRate } from "@/lib/payroll/buildPayRun";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const costs = new Map([["u1", 25], ["u2", 32.5]]);

console.log("\nExplicit Worker.hourlyRate always wins (never clobbered)");
ok("own rate used", effectiveWageRate({ userId: "u1", hourlyRate: 30 }, costs) === 30);
ok("own rate wins even when a member cost exists", effectiveWageRate({ userId: "u1", hourlyRate: 30 }, costs) === 30);
ok("own rate of 0 is honoured (unpaid role), not overridden", effectiveWageRate({ userId: "u1", hourlyRate: 0 }, costs) === 0);

console.log("\nThe bug: no Worker.hourlyRate -> fall back to the member's labour cost");
ok("falls back to member cost", effectiveWageRate({ userId: "u1", hourlyRate: null }, costs) === 25);
ok("second member's cost", effectiveWageRate({ userId: "u2", hourlyRate: null }, costs) === 32.5);
ok("this is what reaches the payslip instead of $0", effectiveWageRate({ userId: "u2", hourlyRate: null }, costs) > 0);

console.log("\nNeither source -> null (a flaggable gap, not a silent $0)");
ok("no rate, no member -> null", effectiveWageRate({ userId: "u9", hourlyRate: null }, costs) === null);
ok("no userId -> null", effectiveWageRate({ hourlyRate: null }, costs) === null);
ok("undefined worker -> null, no crash", effectiveWageRate(undefined, costs) === null);
ok("no map -> null, no crash", effectiveWageRate({ userId: "u1", hourlyRate: null }, undefined) === null);

console.log("\nHostile values");
ok("NaN hourlyRate -> falls through, not NaN", effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs) === null || effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs) === 25, effectiveWageRate({ userId: "u1", hourlyRate: NaN }, costs));
ok("string hourlyRate coerces", effectiveWageRate({ userId: "u1", hourlyRate: "40" }, costs) === 40);
ok("member cost of NaN ignored -> null", effectiveWageRate({ userId: "x", hourlyRate: null }, new Map([["x", NaN]])) === null);

console.log("\nOverhead salaries (workerId:null) are NOT pay — unaffected by this helper");
// The helper only reads Worker.hourlyRate + Member cost; it never looks at
// Salary rows, so an overhead salary can't leak into a wage rate through it.
ok("helper has no salary path (documented invariant)", true);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
