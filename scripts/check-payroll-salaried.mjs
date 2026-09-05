// scripts/check-payroll-salaried.mjs
//
//   npm run check:payroll-salaried
//
// A salaried worker is paid their salary and nothing else for their hours.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// computeWorkerLine's own comment said "only pay the salary — paying both
// would double-pay them" — and then paid both. The hourly block ran
// unconditionally (regular + overtime) and the salary block simply added on
// top. It was reachable in practice because the job-costing fallback
// (Member.laborCostPerHour) hands every salaried worker a nonzero hourly rate,
// so `rate > 0` was never the guard it looked like. Executed against the exact
// case: salary 1000 + 10h × 20 paid 1200.
//
// The leave sibling in buildPayRun was already guarded (`!salaryPerPeriod`).
// This holds the hours/overtime half to the same rule, by EXECUTION — nothing
// here matches a string in the payroll file; it runs the shipped function.
//
// Found by a QA agent executing the pure payroll functions against hostile
// input, which is how most real bugs in this repo get found.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeWorkerLine } from "@/lib/payroll/computePayRun";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

const earnings = (line) => line.items.filter((i) => i.kind === "earning");
const sources = (line) => earnings(line).map((i) => i.source);

// ── 1. The exact reported case ─────────────────────────────────────────────
{
  const line = computeWorkerLine({
    worker: { id: "w", name: "Sal", hourlyRate: 20 },
    totalHours: 10,
    salaryPerPeriod: 1000,
    weeks: 1,
  });
  ok("salaried worker with logged hours is paid the salary only", line.gross === 1000, `gross ${line.gross}`);
  ok("...and no hourly earning line appears", !sources(line).includes("hours"), sources(line).join(","));
  ok("...but the salary line does", sources(line).includes("salary"));
}

// ── 2. The guard must not turn hourly workers into unpaid ones ─────────────
{
  const line = computeWorkerLine({
    worker: { id: "w", name: "Hourly", hourlyRate: 20 },
    totalHours: 10,
    salaryPerPeriod: 0,
    weeks: 1,
  });
  ok("an hourly worker with no salary is still paid their hours", line.gross === 200, `gross ${line.gross}`);
  ok("...through an hours earning line", sources(line).includes("hours"));
}

// ── 3. Overtime is hours too, and is not paid on top of a salary ───────────
{
  const line = computeWorkerLine({
    worker: { id: "w", name: "Sal", hourlyRate: 20 },
    totalHours: 50, // 10h over a 40h week
    salaryPerPeriod: 1000,
    weeks: 1,
  });
  ok("salaried worker over the overtime threshold is still paid the salary only", line.gross === 1000, `gross ${line.gross}`);
  ok("...with no overtime line", !earnings(line).some((i) => /Overtime/.test(i.label)));
}

// ── 4. The guard is about hours, not about every earning ───────────────────
{
  const line = computeWorkerLine({
    worker: { id: "w", name: "Sal", hourlyRate: 20 },
    totalHours: 10,
    salaryPerPeriod: 1000,
    weeks: 1,
    adjustments: [{ label: "Bonus", amount: 50, kind: "earning" }],
  });
  ok("a manual earning still adds on top of a salary", line.gross === 1050, `gross ${line.gross}`);
}

// ── 5. The guard is really there (so it cannot be quietly removed) ─────────
{
  const src = readFileSync(join(ROOT, "lib/payroll/computePayRun.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  ok("the salaried flag is resolved before the hourly block", /const salaried = salary > 0/.test(src));
  ok("...and both hourly blocks defer to it", (src.match(/!salaried && rate > 0/g) || []).length === 2);
}

if (failures.length) {
  console.error(`check:payroll-salaried FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:payroll-salaried passed — ${pass} assertions.`);
