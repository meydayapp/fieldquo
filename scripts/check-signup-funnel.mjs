// scripts/check-signup-funnel.mjs
//
// The /platform/analytics signup funnel, executed against synthetic browsers.
//
// The owner read "Visited /signup 565 · Account & company 581 · Trades 8 ·
// Services 13 · Plan 5 · Checkout started 3 · Completed (card entered) 6" on
// 2026-09-25 — two bars taller than the bar before them, three steps that no
// longer existed. The replacement is held to:
//
//   · each bar a step COMPLETED;
//   · "reached this step or later", so no bar exceeds the one before it —
//     whatever order the evidence arrives in;
//   · a browser with signup steps and no page view (a developer's laptop)
//     is excluded and counted, never a visitor;
//   · the daily-count fallback is monotone too.
//
// ══ Two eras (2026-09-29) ══════════════════════════════════════════════════
//
// The one-screen signup starts the trial on its first press and asks the
// business questions afterwards (app/welcome/[step]), so the bars changed:
// visited → trial started → the seven welcome questions → workspace ready.
// Events from SIGNUP_FUNNEL_CUTOVER on read against that funnel; events
// before it against the legacy seven-step funnel, which is kept intact so
// old data still reads as what it was. Both are executed below.
//
// Run: npm run check:signup-funnel

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SIGNUP_FUNNEL,
  SIGNUP_STEP_BAR,
  SIGNUP_FUNNEL_LEGACY,
  SIGNUP_STEP_BAR_LEGACY,
  SIGNUP_BROWSER_STEPS,
  SIGNUP_FUNNEL_DEFS,
  SIGNUP_FUNNEL_CUTOVER,
  signupFunnelCutover,
  sanitiseEvent,
} from "@/lib/analytics/product/events.js";
import { funnelFromVisitors, furthestBar, monotoneFromCounts, signupFunnel } from "@/lib/analytics/product/aggregate.js";
import { WELCOME_STEPS } from "@/lib/signup/welcome.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const CUR = SIGNUP_FUNNEL_DEFS.current;
const OLD = SIGNUP_FUNNEL_DEFS.legacy;
const monotoneIn = (funnel) => (counts) => funnel.every((k, i) => i === 0 || counts[k] <= counts[funnel[i - 1]]);
const monotone = monotoneIn(SIGNUP_FUNNEL);
const monotoneOld = monotoneIn(SIGNUP_FUNNEL_LEGACY);

// ── 1. The steps ────────────────────────────────────────────────────────────
ok(
  "the current funnel: visited, trial started, the seven welcome questions, workspace ready",
  SIGNUP_FUNNEL.join(",") === "visited,trial_started,profile,business,size,revenue,priority,focus,source,workspace_ready",
  SIGNUP_FUNNEL.join(","),
);
ok(
  "...one bar per welcome question, in lib/signup/welcome.js's order",
  WELCOME_STEPS.filter((s) => s !== "setup").join(",") === SIGNUP_FUNNEL.slice(2, -1).join(","),
);
ok("the legacy funnel is kept exactly as it was", SIGNUP_FUNNEL_LEGACY.join(",") === "visited,account_submitted,team,goals,trades,services,trial_started");
ok("no plan / checkout / card bar in either", ![...SIGNUP_FUNNEL, ...SIGNUP_FUNNEL_LEGACY].some((k) => /plan|checkout|completed|card/.test(k)));
ok(
  "every welcome beacon proves exactly one bar, in order",
  Object.keys(SIGNUP_STEP_BAR).map((s) => SIGNUP_FUNNEL.indexOf(SIGNUP_STEP_BAR[s])).join(",") === "1,2,3,4,5,6,7,8,9",
  Object.keys(SIGNUP_STEP_BAR).join(","),
);
ok(
  "...one per welcome screen shown (w_<step>) plus w_ready",
  Object.keys(SIGNUP_STEP_BAR).join(",") === [...WELCOME_STEPS.map((s) => `w_${s}`), "w_ready"].join(","),
);
ok(
  "every legacy beacon still proves its legacy bar",
  Object.keys(SIGNUP_STEP_BAR_LEGACY).map((s) => SIGNUP_FUNNEL_LEGACY.indexOf(SIGNUP_STEP_BAR_LEGACY[s])).join(",") === "1,2,3,4,5",
);
ok(
  "the browser may send both sets (a cached old page), nothing else",
  SIGNUP_BROWSER_STEPS.length === Object.keys(SIGNUP_STEP_BAR).length + Object.keys(SIGNUP_STEP_BAR_LEGACY).length &&
    sanitiseEvent({ e: "signup_step", p: "w_business" }) !== null &&
    sanitiseEvent({ e: "signup_step", p: "team" }) !== null &&
    sanitiseEvent({ e: "signup_step", p: "w_bogus" }) === null,
);
ok("a beacon can never claim a trial by name", sanitiseEvent({ e: "signup_step", p: "trial_started" }) === null);
ok("the legacy era's trial is still server truth only", !Object.values(SIGNUP_STEP_BAR_LEGACY).includes("trial_started"));
ok("the cutover is a date, 00:00 UTC", SIGNUP_FUNNEL_CUTOVER === "2026-09-29" && signupFunnelCutover().toISOString() === "2026-09-29T00:00:00.000Z");

// ── 2. One browser's furthest bar ──────────────────────────────────────────
ok("a page view alone is Visited (both eras)", furthestBar({ visited: true }) === 0 && furthestBar({ visited: true }, OLD) === 0);
ok("the first welcome screen shown = trial started", furthestBar({ visited: true, steps: ["w_profile"] }) === 1);
ok("the size screen shown = business answered", furthestBar({ visited: true, steps: ["w_size"] }) === SIGNUP_FUNNEL.indexOf("business"));
ok("w_ready = workspace ready", furthestBar({ visited: true, steps: ["w_ready"] }) === SIGNUP_FUNNEL.length - 1);
ok("a linked company proves the trial — the SECOND bar now, not the last", furthestBar({ visited: false, steps: [], trial: true }) === 1);
ok("...and never less than the welcome screens it also reached", furthestBar({ visited: true, steps: ["w_revenue"], trial: true }) === SIGNUP_FUNNEL.indexOf("size"));
ok("legacy: Team shown = account submitted", furthestBar({ visited: true, steps: ["team"] }, OLD) === 1);
ok("legacy: finish pressed = Services", furthestBar({ visited: true, steps: ["finish"] }, OLD) === 5);
ok("legacy: a linked company is the last bar", furthestBar({ visited: false, steps: [], trial: true }, OLD) === 6);
ok("old beacons prove nothing in the current funnel", furthestBar({ visited: true, steps: ["team", "services", "finish"] }) === 0);
ok("unknown and hostile step names are ignored", furthestBar({ visited: true, steps: ["<script>", "__proto__", "constructor", ""] }) === 0);

// ── 3. Monotone on the owner's shape of data (legacy) ──────────────────────
{
  const visitors = [];
  for (let i = 0; i < 565; i += 1) visitors.push({ visited: true, steps: [] });
  for (let i = 0; i < 16; i += 1) visitors.push({ visited: false, steps: ["account", i % 2 ? "services" : "trades"] });
  for (let i = 0; i < 8; i += 1) visitors[i].steps = ["account", "trades", "services"];
  for (let i = 8; i < 14; i += 1) visitors[i].steps = ["account", "services"];
  visitors[20] = { visited: true, steps: ["team", "goals", "trades", "services", "finish"], trial: true };
  visitors.push({ visited: false, steps: [], trial: true });
  const f = funnelFromVisitors(visitors, OLD);
  ok("legacy: monotone on the owner's mixture", monotoneOld(f.counts), JSON.stringify(f.counts));
  ok("legacy: laptop browsers are excluded and counted", f.excluded === 16 && f.counts.visited === 566, `excluded ${f.excluded}, visited ${f.counts.visited}`);
  ok("legacy: resume onto Services counts at Goals and every step before it", f.counts.goals >= 15 && f.counts.account_submitted === f.counts.goals, JSON.stringify(f.counts));
  ok("legacy: two trials, counted at every bar", f.counts.trial_started === 2 && f.stoppedAt.trial_started === 2);
}

// ── 4. The current era on its own shape ───────────────────────────────────
{
  const visitors = [];
  for (let i = 0; i < 100; i += 1) visitors.push({ visited: true, steps: [] });
  // 40 pressed Start (a company exists): 30 of them seen by the beacon, 10
  // only by the server link. 20 answered the business screen; 5 finished.
  for (let i = 0; i < 30; i += 1) visitors[i].steps = ["w_profile"];
  for (let i = 30; i < 40; i += 1) visitors[i].trial = true;
  for (let i = 0; i < 20; i += 1) visitors[i].steps.push("w_business", "w_size");
  for (let i = 0; i < 5; i += 1) visitors[i].steps.push("w_revenue", "w_priority", "w_focus", "w_source", "w_setup", "w_ready");
  const f = funnelFromVisitors(visitors);
  ok("monotone on a welcome-flow mixture", monotone(f.counts), JSON.stringify(f.counts));
  ok("trial started = every browser with a company, beacon or server link", f.counts.trial_started === 40, JSON.stringify(f.counts));
  ok("business = the 20 whose size screen was shown", f.counts.business === 20);
  ok("workspace ready = the 5 who finished setup", f.counts.workspace_ready === 5);
  ok("the finishers are not counted as having stopped", f.stoppedAt.workspace_ready === 5 && !signupFunnel(f.counts, f.stoppedAt).stoppedAt.some((s) => s.key === "workspace_ready"));
  const stoppedTotal = SIGNUP_FUNNEL.reduce((n, k) => n + f.stoppedAt[k], 0);
  ok("every counted browser stops exactly once", stoppedTotal === f.counts.visited, `${stoppedTotal} vs ${f.counts.visited}`);
}

// ── 5. Random evidence, any order: always monotone ─────────────────────────
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
    for (const [def, mono] of [[CUR, monotone], [OLD, monotoneOld]]) {
      const f = funnelFromVisitors(vs, def);
      if (!mono(f.counts)) allMonotone = false;
      if (!mono(signupFunnel(f.counts, f.stoppedAt, "visitors", def).steps.reduce((o, s) => ({ ...o, [s.key]: s.count }), {}))) allMonotone = false;
    }
  }
  ok("300 random mixtures × both eras: every one monotone", allMonotone);
}

// ── 6. The daily fallback ──────────────────────────────────────────────────
{
  const m = monotoneFromCounts({ visited: 565, account_submitted: 581, team: 0, goals: 8, trades: 13, services: 3, trial_started: 6 }, OLD);
  ok("legacy daily counts are made monotone (running max from the end)", monotoneOld(m) && m.visited === 581 && m.trades === 13 && m.goals === 13 && m.trial_started === 6, JSON.stringify(m));
  const c = monotoneFromCounts({ visited: 50, trial_started: 12, profile: 9, business: 11, workspace_ready: 2 });
  ok("current daily counts likewise", monotone(c) && c.profile === 11 && c.trial_started === 12, JSON.stringify(c));
  ok("absent counts are zero, not NaN", Object.values(monotoneFromCounts({})).every((n) => n === 0));
}

// ── 7. Wiring ───────────────────────────────────────────────────────────────
{
  const q = read("lib/analytics/product/queries.js");
  ok("the raw query reads steps, not the old per-step columns", /array_agg\(DISTINCT path\) FILTER \(WHERE event = 'signup_step'\)/.test(q) && !/checkout_started/.test(q));
  ok("trials are tied through SignupLead.visitorId → a finished, non-demo, non-test company", /completedCompany: \{ is: \{ \.\.\.METRICS_COMPANY_WHERE, createdAt: \{ gte: start, lt: end \}, \.\.\.completedSignupWhere\(\) \} \}/.test(q) && /skipReason: \{ not: "company_exists" \}/.test(q));
  ok("the raw query takes the era's definition", /signupVisitors\(\{ start, end, def = undefined \} = \{\}\)/.test(q) && /funnelFromVisitors\(visitors, def\)/.test(q));
  const route = read("app/api/platform/analytics/product/route.js");
  ok("the route splits the range at the cutover", /signupFunnelCutover\(\)/.test(route) && /SIGNUP_FUNNEL_DEFS\.legacy/.test(route) && /SIGNUP_FUNNEL_DEFS\.current/.test(route));
  ok("the daily fallback is monotone and trial = companies, per era", /signupFunnel\(monotoneFromCounts\(counts, def\), raw \? raw\.stoppedAt : null, "events", def\)/.test(route) && /counts\[def\.trialBar\] = Math\.max\(counts\[def\.trialBar\] \|\| 0, completed\)/.test(route));
  ok("the route passes the reconciliation figures", /f\.companiesFinished = raw\.companiesFinished/.test(route) && /f\.excluded = raw\.excluded/.test(route));
  ok("...and the legacy funnel beside the current one", /funnelLegacy,/.test(route));
  const page = read("app/platform/analytics/page.js");
  ok("the page has no card / plan / checkout wording in the funnel", !/card entered|Checkout started|handed to Stripe/.test(page));
  ok("the page labels every current bar", SIGNUP_FUNNEL.every((k) => new RegExp(`\\b${k}: "`).test(page.split("const WELCOME_STEP_HINTS")[0])));
  ok("...and every legacy bar", SIGNUP_FUNNEL_LEGACY.every((k) => new RegExp(`\\b${k}: "`).test(page.split("const STEP_LABELS")[1] || "")));
  ok("...and draws the legacy funnel when the range reaches back before the cutover", /data\.funnelLegacy \?/.test(page) && /data-funnel-reconcile/.test(page));
  const flow = read("app/welcome/WelcomeFlow.js");
  ok("each welcome screen sends its beacon, and setup sends w_ready", /trackSignupStep\(WELCOME_BEACON\[step\]\)/.test(flow) && /trackSignupStep\("w_ready"\)/.test(flow));
  ok("/signup sends no step beacon of its own (the page view is Visited)", !/trackSignupStep\(/.test(read("app/signup/page.js")));
}

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
