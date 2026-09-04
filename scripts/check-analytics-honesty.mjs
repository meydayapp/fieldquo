// scripts/check-analytics-honesty.mjs
//
// The screens where a number is an answer: analytics, payroll, time off,
// fleet. Every assertion here pins one specific way a page was caught telling
// a confident lie, so that undoing the fix fails a check rather than shipping.
//
//   npm run check:analytics-honesty
//
// ── What this can and cannot prove ─────────────────────────────────────────
//
// A text scan, like check-empty-vs-error.mjs, and worth the same honesty: it
// cannot render a page, cannot follow state, and cannot prove what appears on
// screen when a fetch fails. What it CAN do is hold the mechanical shapes that
// made each bug possible, all of which are visible in the source:
//
//   • a catch handler that FABRICATES a payload ("policies: []") so the page
//     then renders an empty state for a request that failed;
//   • a permission sentence ("only your own payslips") reachable from any
//     failure rather than from a 403;
//   • a raw status column rendered straight into a badge;
//   • an arithmetic fallback to 0 on a denominator that could not be divided;
//   • a payload field the server sends and no screen reads.
//
// ── Comments are stripped before anything is asserted ──────────────────────
//
// Not optional here. Every fix in this pass carries a comment naming the code
// it replaced — app/app/time-off/page.js's catch handler literally contains
// the words `setMine({ policies: [], requests: [], balances: [] })` inside a
// comment explaining why it is gone. Scanning raw source would make each of
// these checks fail on its own explanation, and "fixing" that by deleting the
// comment is the worst outcome available. Comment stripping is line-level
// (`//` and block-comment lines), the same conservative shape
// check-app-currency.mjs uses, because a regex that eats `/* */` across lines
// silently swallowed real code there.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** Source with comment LINES removed. See the header on why line-level. */
function code(p) {
  let inBlock = false;
  return raw(p)
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      if (inBlock) {
        if (t.includes("*/")) inBlock = false;
        return false;
      }
      if (t.startsWith("/*")) {
        if (!t.includes("*/")) inBlock = true;
        return false;
      }
      if (t.startsWith("//") || t.startsWith("*")) return false;
      // `{/* … */}` on one line — JSX comments, which carry prose too.
      if (t.startsWith("{/*")) return false;
      return true;
    })
    .join("\n");
}

let failures = 0;
let checks = 0;
// Label FIRST, condition second. Reversed, a non-empty label becomes the
// condition and every check passes forever — the trap this repo has already
// been bitten by.
function ok(label, condition, detail = "") {
  checks++;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Time off — a failed read is not "your company has no leave policies"
// ═══════════════════════════════════════════════════════════════════════════
//
// The bug: loadMine's catch replaced `mine` with
// `{ policies: [], requests: [], balances: [] }`. MyTimeOff then took its
// `!data.policies?.length` branch and told the reader that nobody has set up
// leave policies — a statement about a company's configuration, printed
// because a request 500'd, complete with instructions to go and create them.

console.log("\nTime off — empty state vs failed read\n");
{
  const src = code("app/app/time-off/page.js");

  ok(
    "the /api/leave catch does not fabricate a payload for the page to render",
    !/catch\s*\([^)]*\)\s*\{[^}]*setMine\s*\(\s*\{/.test(src),
    "a catch that assigns an object literal to setMine is the fabricated-empty-state bug",
  );

  ok(
    "MyTimeOff takes an error and RETURNS before any empty-state branch",
    /function MyTimeOff\([\s\S]{0,600}?if\s*\(\s*errorMessage\s*\)[\s\S]{0,200}?return/.test(src),
    "no early error return — the 'no leave policies' copy below it is reachable on a failure",
  );

  // The order matters as much as the presence: an error branch that sits
  // BELOW the empty branch never runs.
  const errAt = src.indexOf("if (errorMessage)");
  const emptyAt = src.indexOf("!data.policies?.length");
  ok(
    "...and that error branch comes before the policies branch, not after it",
    errAt !== -1 && emptyAt !== -1 && errAt < emptyAt,
    `errorMessage at ${errAt}, policies branch at ${emptyAt}`,
  );

  ok(
    "the status pill never renders LeaveRequest.status raw",
    !/>\s*\{status\}\s*</.test(src),
    "a raw enum in a badge: snake/lowercase, untranslated, on every language",
  );
  ok(
    "...it resolves through the app.status.* catalogue instead",
    /t\(`app\.status\.\$\{status\}`/.test(src),
  );
  ok(
    "the leave KIND is translated rather than read off an English-only map",
    /`app\.setLeave\.kind\.\$\{/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Payroll — "only your own payslips" is a 403, not any failure
// ═══════════════════════════════════════════════════════════════════════════
//
// The bug: every failure of /api/payroll/runs took the same branch, so an
// owner whose list 500'd was told their account is restricted to its own
// payslips. That is a false statement about somebody's permissions, made
// because a request failed — and it also set `runs` to [], which would have
// rendered "No pay runs yet" over a company's real payroll history.

console.log("\nPayroll — a refusal and a failure are different sentences\n");
{
  const src = code("app/app/payroll/page.js");

  ok(
    "the runs catch does not blank the list to []",
    !/catch\s*\([^)]*\)\s*\{[^}]*setRuns\s*\(\s*\[\s*\]\s*\)/.test(src),
    "setRuns([]) on a failure claims 'no pay runs' for a company that has them",
  );
  ok(
    "the catch distinguishes a 403 from every other status",
    /catch\s*\([^)]*\)\s*\{[\s\S]{0,400}?\.status\s*===\s*403/.test(src),
  );
  ok(
    "the 'own payslips only' sentence is gated on that 403 and nothing else",
    /refused\s*\?[\s\S]{0,400}?app\.payroll\.ownPayslipsOnly/.test(src),
    "reachable from a plain load failure — a lie about the reader's account",
  );
  ok(
    "a non-403 failure offers a retry instead",
    /listError\s*&&[\s\S]{0,900}?app\.load\.retry/.test(src),
  );

  // PayRun.status is a free string column: draft | approved | paid |
  // cancelled. Three of the four used to reach the badge raw and lowercase.
  for (const file of ["app/app/payroll/page.js", "app/app/payroll/[id]/page.js"]) {
    const s = code(file);
    ok(
      `${file} routes PayRun.status through the catalogue`,
      /t\(`app\.payRunStatus\.\$\{status\}`/.test(s),
    );
    ok(
      `${file} renders no bare status expression in its badge`,
      !/\{\s*(r|run)\.status\s*\}/.test(s),
      "a raw enum reaching a human",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Benchmark — a zero denominator is not "you match the platform average"
// ═══════════════════════════════════════════════════════════════════════════

console.log("\nBenchmark — no confident 0% from a missing average\n");
{
  const page = code("app/app/analytics/benchmark/page.js");
  const lib = code("lib/analytics/pricingBenchmark.js");

  ok(
    "the page no longer falls back to 0 when the platform average is zero",
    !/platformAvgPrice\s*\n?\s*\?[\s\S]{0,120}?:\s*0;/.test(page),
    "`: 0` here renders a grey dash and 0% — the pixels for 'exactly on average'",
  );
  ok(
    "the percentage is null when there is nothing to divide by",
    /const pct = comparable \? /.test(page) && /pct === null/.test(page),
  );
  ok(
    "both money cells are null-gated before the formatter",
    /row\.yourAvgPrice === null/.test(page) && /row\.platformAvgPrice === null/.test(page),
    "formatAppMoney(null) is '$0.00' — see lib/format/money.js",
  );
  ok(
    "the library stops padding a null average with 0",
    !/_avg\.subtotal\s*\|\|\s*0/.test(lib),
    "Prisma _avg is null when every row's subtotal is null; `|| 0` makes that a price",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Money flow — the comparison is clamped to what has happened
// ═══════════════════════════════════════════════════════════════════════════
//
// The arithmetic itself is executed, with hostile fixtures and mutants, by
// scripts/check-money-flow.mjs. What is checked HERE is the wiring the pure
// function cannot see: that the route actually supplies a clock and sizes the
// prior query to the elapsed window, and that the chart drops future days.

console.log("\nMoney flow — the route supplies a clock, the chart drops the future\n");
{
  const route = code("app/api/analytics/money-flow/route.js");
  const chart = code("app/components/charts/FlowChart.js");
  const page = code("app/app/analytics/kpis/page.js");

  ok(
    "the route computes today's UTC day and hands it to buildMoneyFlow",
    /const today = dayKey\(new Date\(\)\)/.test(route) && /\btoday,/.test(route),
    "without a clock the whole 30-day range is compared to a full prior month",
  );
  ok(
    "the prior window is derived from the ELAPSED range, not the selected one",
    /priorWindow\(elapsed\.from, elapsed\.to\)/.test(route),
    "priorWindow(from, to) would fetch 30 days to compare against 3",
  );
  ok(
    "a period that has not started fetches no prior rows at all",
    /prior\s*\n?\s*\?\s*db\.payment\.findMany/.test(route),
  );
  ok(
    "FlowChart excludes points flagged as future",
    /\.filter\(\(p\) => p\?\.future !== true\)/.test(chart),
    "a gap-filled 0 for a day that has not happened is a flat line to the right",
  );
  ok(
    "the KPI page sizes the chart to the days that happened",
    /filter\(\(d\) => !d\.future\)/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Fixed costs — four empty tables are not "$0.00 a month"
// ═══════════════════════════════════════════════════════════════════════════

console.log("\nFixed costs — absence and a real zero stay two screens\n");
{
  const burn = code("lib/analytics/burnRate.js");
  const route = code("app/api/analytics/finance-overview/route.js");
  const page = code("app/app/analytics/kpis/page.js");

  ok(
    "calculateBurnRate reports how many rows its totals were built from",
    /sourcesRecorded:/.test(burn),
  );
  ok(
    "...counting all four sources, not just one",
    /overheadExpenses\.length \+ salaries\.length \+ debts\.length \+ assets\.length/.test(burn),
  );
  ok(
    "the finance route answers fixedCosts in the figure() envelope",
    /fixedCosts:\s*\{[\s\S]{0,400}?available:\s*burnRate\.sourcesRecorded > 0/.test(route),
    "a bare monthlyTotal renders $0.00 for a company that has recorded nothing",
  );
  ok(
    "the KPI page renders it through MoneyTile, which cannot format a null",
    /figure=\{finance\.fixedCosts\}/.test(page),
  );
  ok(
    "...and no longer formats the monthly total directly",
    !/money\(finance\.fixedCosts\.monthlyTotal\)/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Fleet — a book value nothing is depreciating says so
// ═══════════════════════════════════════════════════════════════════════════
//
// lib/fleet/load.js has always sent `chargeable` and `chargeReason` per
// vehicle asset and nothing read them. lib/accounting/depreciation.js returns
// `bookValue = cost` for a register row with no in-service date or no useful
// life, so a half-entered van showed its full purchase price as "Book value
// now" — indistinguishable from a van that really is worth that.

console.log("\nFleet — the depreciation reason reaches the card\n");
{
  const load = code("lib/fleet/load.js");
  const card = code("app/components/fleet/VehicleCard.js");

  ok(
    "the payload still carries chargeable and chargeReason",
    /chargeable:/.test(load) && /chargeReason:/.test(load),
  );
  // Asserted on the guard's SHAPE, not on the words in it: `chargeReason`
  // also appears inside the fallback lookup, so a dead `{false && (` render
  // would still contain the identifier. Both the condition and the absence of
  // a short-circuited guard are required.
  ok(
    "the reason renders behind the chargeable flag, not behind a dead guard",
    /row\.asset\.chargeable === false && row\.asset\.chargeReason/.test(card) &&
      // `{false &&` / `(false &&` — a literal short-circuit at the START of
      // an expression. Deliberately NOT /\bfalse\s*&&/, which the real
      // guard's own `=== false &&` matches; that version failed on the code
      // it was written to protect, which is how a check ends up deleted.
      !/[({[]\s*false\s*&&/.test(card),
    "the field was write-only for its whole life; a `false &&` puts it back",
  );
  ok(
    "...and reuses Settings → Overhead's own wording for the five reasons",
    /app\.setOverhead\.assetReason\.\$\{/.test(card),
  );
  ok(
    "the card's money helper does not coerce an unrecorded cost to zero",
    !/Number\(v \|\| 0\)/.test(card),
    "`Number(null) || 0` printed $0 for a cost nobody had entered",
  );
  ok(
    "...and formats in the company's currency",
    /useCompanyMoney\(\)/.test(card),
  );
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
