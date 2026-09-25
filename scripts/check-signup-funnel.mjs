// scripts/check-signup-funnel.mjs
//
// The /platform/analytics signup funnel, executed against synthetic browsers.
//
// The owner read "Visited /signup 565 · Account & company 581 · Trades 8 ·
// Services 13 · Plan 5 · Checkout started 3 · Completed (card entered) 6" on
// 2026-09-25 — two bars taller than the bar before them, three steps that no
// longer exist (no card, no plan, no checkout since 2026-09-24). This holds
// the replacement to:
//
//   · the seven steps of the card-free signup, each a step COMPLETED;
//   · "reached this step or later", so no bar exceeds the one before it —
//     whatever order the evidence arrives in (resume links that land on
//     Services, Team/Goals that sent no beacon before the fix, a finished
//     company whose browser sent nothing);
//   · a browser with signup steps and no page view (a developer's laptop:
//     the beacon skipped localhost page views but not steps) is excluded
//     and counted, never a visitor;
//   · the daily-count fallback is monotone too;
//   · the page, route and signup page are wired to all of that.
//
// Run: npm run check:signup-funnel

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SIGNUP_FUNNEL, SIGNUP_STEP_BAR, SIGNUP_BROWSER_STEPS, sanitiseEvent } from "@/lib/analytics/product/events.js";
import { funnelFromVisitors, furthestBar, monotoneFromCounts, signupFunnel } from "@/lib/analytics/product/aggregate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const monotone = (counts) => SIGNUP_FUNNEL.every((k, i) => i === 0 || counts[k] <= counts[SIGNUP_FUNNEL[i - 1]]);

// ── 1. The steps ────────────────────────────────────────────────────────────
ok("seven steps, card-free", SIGNUP_FUNNEL.join(",") === "visited,account_submitted,team,goals,trades,services,trial_started");
ok("no plan / checkout / card bar survives", !SIGNUP_FUNNEL.some((k) => /plan|checkout|completed|card/.test(k)));
ok("every browser step proves exactly one bar, in order", SIGNUP_BROWSER_STEPS.map((s) => SIGNUP_FUNNEL.indexOf(SIGNUP_STEP_BAR[s])).join(",") === "1,2,3,4,5");
ok("a beacon can never claim a trial", sanitiseEvent({ e: "signup_step", p: "trial_started" }) === null && !Object.values(SIGNUP_STEP_BAR).includes("trial_started"));

// ── 2. One browser's furthest bar ──────────────────────────────────────────
ok("a page view alone is Visited", furthestBar({ visited: true }) === 0);
ok("Team shown = account submitted", furthestBar({ visited: true, steps: ["team"] }) === 1);
ok("finish pressed = Services", furthestBar({ visited: true, steps: ["finish"] }) === 5);
ok("a linked company is a trial whatever the beacons said", furthestBar({ visited: false, steps: [], trial: true }) === 6);
ok("legacy rows (account shown, plan) prove nothing beyond the visit", furthestBar({ visited: true, steps: ["account", "plan"] }) === 0);
ok("unknown and hostile step names are ignored", furthestBar({ visited: true, steps: ["<script>", "__proto__", "constructor", ""] }) === 0);

// ── 3. Monotone on the owner's shape of data ───────────────────────────────
{
  // 565 real visitors; 16 laptop browsers with steps and no page view; one
  // browser that resumed straight onto Services (no trades event); 6 with
  // services and no trades (the 2026-09-25 harness pattern) — the exact
  // mixture that produced 581 > 565 and Services 13 > Trades 8.
  const visitors = [];
  for (let i = 0; i < 565; i += 1) visitors.push({ visited: true, steps: [] });
  for (let i = 0; i < 16; i += 1) visitors.push({ visited: false, steps: ["account", i % 2 ? "services" : "trades"] });
  for (let i = 0; i < 8; i += 1) visitors[i].steps = ["account", "trades", "services"];
  for (let i = 8; i < 14; i += 1) visitors[i].steps = ["account", "services"];
  visitors[20] = { visited: true, steps: ["team", "goals", "trades", "services", "finish"], trial: true };
  visitors.push({ visited: false, steps: [], trial: true }); // a company whose browser's beacons are outside the window
  const f = funnelFromVisitors(visitors);
  ok("monotone on the owner's mixture", monotone(f.counts), JSON.stringify(f.counts));
  ok("laptop browsers are excluded and counted", f.excluded === 16 && f.counts.visited === 566, `excluded ${f.excluded}, visited ${f.counts.visited}`);
  ok("resume onto Services counts at Goals and every step before it", f.counts.goals >= 15 && f.counts.account_submitted === f.counts.goals, JSON.stringify(f.counts));
  ok("two trials, counted at every bar", f.counts.trial_started === 2 && f.stoppedAt.trial_started === 2);
  const stoppedTotal = SIGNUP_FUNNEL.reduce((n, k) => n + f.stoppedAt[k], 0);
  ok("every counted browser stops exactly once", stoppedTotal === f.counts.visited, `${stoppedTotal} vs ${f.counts.visited}`);
}

// ── 4. Random evidence, any order: always monotone ─────────────────────────
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pool = [...SIGNUP_BROWSER_STEPS, "account", "plan", "checkout", "bogus"];
  let allMonotone = true;
  for (let run = 0; run < 300; run += 1) {
    const vs = Array.from({ length: 1 + Math.floor(rnd() * 60) }, () => ({
      visited: rnd() < 0.8,
      steps: pool.filter(() => rnd() < 0.25).sort(() => rnd() - 0.5),
      trial: rnd() < 0.05,
    }));
    const f = funnelFromVisitors(vs);
    if (!monotone(f.counts)) allMonotone = false;
    if (!monotone(signupFunnel(f.counts, f.stoppedAt).steps.reduce((o, s) => ({ ...o, [s.key]: s.count }), {}))) allMonotone = false;
  }
  ok("300 random mixtures (resume jumps, missing beacons, junk steps): every one monotone", allMonotone);
}

// ── 5. The daily fallback ──────────────────────────────────────────────────
{
  const m = monotoneFromCounts({ visited: 565, account_submitted: 581, team: 0, goals: 8, trades: 13, services: 3, trial_started: 6 });
  ok("daily counts are made monotone (running max from the end)", monotone(m) && m.visited === 581 && m.trades === 13 && m.goals === 13 && m.trial_started === 6, JSON.stringify(m));
  ok("absent counts are zero, not NaN", Object.values(monotoneFromCounts({})).every((n) => n === 0));
}

// ── 6. Wiring ───────────────────────────────────────────────────────────────
{
  const q = read("lib/analytics/product/queries.js");
  ok("the raw query reads steps, not the old per-step columns", /array_agg\(DISTINCT path\) FILTER \(WHERE event = 'signup_step'\)/.test(q) && !/checkout_started/.test(q));
  ok("trials are tied through SignupLead.visitorId → a finished, non-demo company", /completedCompany: \{ is: \{ isDemo: false, createdAt: \{ gte: start, lt: end \}, \.\.\.completedSignupWhere\(\) \} \}/.test(q) && /skipReason: \{ not: "company_exists" \}/.test(q));
  const route = read("app/api/platform/analytics/product/route.js");
  ok("the route makes the daily fallback monotone and trial = companies", /signupFunnel\(monotoneFromCounts\(counts\)/.test(route) && /counts\.trial_started = completedInRange/.test(route));
  ok("the route passes the reconciliation figures", /funnel\.companiesFinished = funnelRaw\.companiesFinished/.test(route) && /funnel\.excluded = funnelRaw\.excluded/.test(route));
  const page = read("app/platform/analytics/page.js");
  ok("the page has no card / plan / checkout wording in the funnel", !/card entered|Checkout started|handed to Stripe/.test(page));
  ok("the page labels every bar and prints the reconciliation", SIGNUP_FUNNEL.every((k) => new RegExp(`\\b${k}: "`).test(page)) && /data-funnel-reconcile/.test(page));
  const signup = read("app/signup/page.js");
  ok("the signup page sends team/goals/trades/services and finish, never account or plan", /\{ team: "team", goals: "goals", industry: "trades", services: "services" \}\[step\]/.test(signup) && /trackSignupStep\("finish"\)/.test(signup));
}

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
