// scripts/check-growth-model.mjs
//
//   npm run check:growth-model
//
// Executes lib/platform/growthModel.js — the capacity forecast — against
// hostile input and against the owner's own plan (20 closers, 150 dials a
// day, 918,244 prospects). The point of the model is that it refuses to guess
// and says which milestones the numbers can reach at all; both refusals are
// asserted here, because a forecast that silently filled a missing rate with
// 0.5 would pass every arithmetic test and still be the lie this repo is
// swept for. The three signup sources — dialler, organic, referral — are
// asserted apart, and the ceiling is asserted to move the way the maths says
// it must when referrals enter.

import {
  rate, monthlyCount, project, monthLabel, MILESTONES, FLOORS, RATE_KEYS, ASSUMPTION_FIELDS, HORIZON_MONTHS,
} from "../lib/platform/growthModel.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── rate(): basis is a fact about the sample, not a mood ────────────────────
ok("below the floor with no assumption is NONE, value null",
  (() => { const r = rate({ hit: 3, of: 12, floor: 200 }); return r.basis === "none" && r.value === null && r.remaining === 188 && near(r.measured, 0.25); })());
ok("below the floor with an assumption is ASSUMED, and still shows what was measured so far",
  (() => { const r = rate({ hit: 3, of: 12, floor: 200, assumed: 0.15 }); return r.basis === "assumed" && r.value === 0.15 && near(r.measured, 0.25) && r.sampleSize === 12; })());
ok("at the floor the measurement takes over, whatever the assumption says",
  (() => { const r = rate({ hit: 30, of: 200, floor: 200, assumed: 0.9 }); return r.basis === "measured" && near(r.value, 0.15) && r.remaining === 0 && r.assumed === 0.9; })());
ok("more hits than the denominator clamps to 1, not 1.5", rate({ hit: 15, of: 10, floor: 5 }).value === 1);
ok("the referral coefficient may exceed 1 when its max says so", rate({ hit: 30, of: 20, floor: 5, max: 10 }).value === 1.5);
ok("NaN, negative and string counts are treated as zero rows, never as data",
  (() => { const r = rate({ hit: NaN, of: -4, floor: 10, assumed: 0.2 }); return r.sampleSize === 0 && r.basis === "assumed" && r.measured === null; })());
ok("an assumption outside 0..1 is not an assumption", rate({ of: 0, floor: 10, assumed: 1.5 }).basis === "none" && rate({ of: 0, floor: 10, assumed: -0.1 }).basis === "none");
ok("an assumption of exactly 0 or 1 is allowed (a rate can be zero)", rate({ of: 0, floor: 10, assumed: 0 }).basis === "assumed" && rate({ of: 0, floor: 10, assumed: 1 }).value === 1);
ok("no arguments at all is NONE, not a crash", rate().basis === "none");

// ── monthlyCount(): organic signups a month ─────────────────────────────────
ok("organic: two observed months below a floor of three keep the assumption", (() => { const c = monthlyCount({ total: 9, months: 2, floorMonths: 3, assumed: 50 }); return c.basis === "assumed" && c.value === 50 && near(c.measured, 4.5); })());
ok("organic: three months measured is their mean", (() => { const c = monthlyCount({ total: 9, months: 3, floorMonths: 3, assumed: 50 }); return c.basis === "measured" && c.value === 3; })());
ok("organic: nothing observed, nothing assumed is NONE", monthlyCount({ floorMonths: 3 }).basis === "none");

// ── monthLabel: calendar months, UTC ────────────────────────────────────────
const dec = new Date("2026-12-15T23:30:00Z");
ok("month 0 is the current month", monthLabel(dec, 0) === "2026-12");
ok("December + 1 is next January, not '2026-13'", monthLabel(dec, 1) === "2027-01");
ok("+13 rolls the year", monthLabel(dec, 13) === "2028-01");

// ── The owner's plan, dialler only ──────────────────────────────────────────
const A = { reach: 0.15, signup: 0.05, conversion: 0.4, churn: 0.05 };
const assumedRates = (over = {}) => ({
  reach: rate({ of: 0, floor: FLOORS.reach, assumed: A.reach }),
  signup: rate({ of: 0, floor: FLOORS.signup, assumed: A.signup }),
  conversion: rate({ of: 0, floor: FLOORS.conversion, assumed: A.conversion }),
  churn: rate({ of: 0, floor: FLOORS.churnMonths, assumed: A.churn }),
  referral: rate({ of: 0, floor: FLOORS.referralMonths, assumed: 0, max: 10 }),
  ...over,
});
const now = new Date("2026-09-06T12:00:00Z");
const plan = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now });

ok("63,000 dials a month from 20 × 150 × 21", plan.monthly.dials === 63_000, plan.monthly);
ok("9,450 reached, 472.5 signups, 189 paying adds a month",
  plan.monthly.reached === 9_450 && plan.monthly.signups.dial === 472.5 && plan.monthly.signups.total === 472.5 && plan.monthly.payingAdds === 189, plan.monthly);
ok("churn caps the business at adds / churn = 3,780", plan.ceiling === 3_780 && plan.viral === false, plan.ceiling);
ok("month 0 is today: nobody paying yet", plan.series[0].paying === 0 && plan.series[0].label === "2026-09");
ok("month 1: signups are still in trial, nobody paying", plan.series[1].paying === 0 && plan.series[1].trialing === 473, plan.series[1]);
ok("month 2: the first trials convert — 189 paying", plan.series[2].paying === 189, plan.series[2]);
ok("month 3 compounds: 189 × 0.95 + 189 = 369", plan.series[3].paying === 369, plan.series[3]);
const ms = Object.fromEntries(plan.milestones.map((m) => [m.target, m]));
ok("100 paying in month 2 (November 2026)", ms[100].month === 2 && ms[100].label === "2026-11", ms[100]);
ok("1,000 paying in month 7 (April 2027)", ms[1000].month === 7 && ms[1000].label === "2027-04", ms[1000]);
ok("10,000 is UNREACHABLE at these rates — above the 3,780 ceiling — and says so",
  ms[10000].month === null && ms[10000].reachable === false && ms[10000].beyondHorizon === false, ms[10000]);
ok("...and so are 100,000 and 1,000,000", ms[100000].reachable === false && ms[1000000].reachable === false);
ok("the series never exceeds the ceiling", plan.series.every((s) => s.paying <= plan.ceiling), Math.max(...plan.series.map((s) => s.paying)));
ok("the series is monotone until the list runs out", (() => {
  const upTo = plan.listExhaustedAt ?? plan.series.length;
  for (let i = 1; i < upTo; i += 1) if (plan.series[i].paying < plan.series[i - 1].paying) return false;
  return true;
})());
ok("every signup is from the dialler when organic and referral are zero",
  plan.series.every((s) => s.signupsBySource.organic === 0 && s.signupsBySource.referral === 0 && s.signupsBySource.dial === s.cumulativeSignups));
ok("918,244 prospects last 14.6 months at 63,000 dials", near(plan.listRunwayMonths, 14.6), plan.listRunwayMonths);
ok("the list is exhausted in month 15 and the dials stop there",
  plan.listExhaustedAt === 15 && plan.series[16].cumulativeDials === plan.series[15].cumulativeDials && plan.series[15].cumulativeDials === 918_244,
  { at: plan.listExhaustedAt, d15: plan.series[15].cumulativeDials, d16: plan.series[16].cumulativeDials });
ok("after the list runs out the paying stock DECAYS — the model does not keep inventing signups",
  plan.series[20].paying < plan.series[17].paying, { m17: plan.series[17].paying, m20: plan.series[20].paying });
ok("the default horizon is 60 months, 61 points", plan.series.length === HORIZON_MONTHS + 1);
ok("rates ride along with their basis, so the page can label them", RATE_KEYS.every((k) => plan.rates[k].basis === "assumed"));

// ── Organic: a source the dialler does not explain ──────────────────────────
const withOrganic = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now,
  rates: assumedRates(), organic: monthlyCount({ floorMonths: 3, assumed: 50 }),
});
ok("50 organic signups a month lift paying adds to (472.5 + 50) × 0.4 = 209", withOrganic.monthly.payingAdds === 209 && withOrganic.monthly.signups.organic === 50, withOrganic.monthly);
ok("...and the ceiling to 4,180", withOrganic.ceiling === 4_180, withOrganic.ceiling);
ok("...and the sources are kept apart in the series", (() => {
  const s = withOrganic.series[12];
  return s.signupsBySource.organic === 600 && s.signupsBySource.dial === Math.round(472.5 * 12) && s.cumulativeSignups === s.signupsBySource.dial + s.signupsBySource.organic + s.signupsBySource.referral;
})(), withOrganic.series[12]);

// ── Referral: the compounding source ────────────────────────────────────────
const k01 = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, assumed: 0.1, max: 10 }) }) });
ok("k = 0.1 with 40% conversion drains only 1% a month net: ceiling 189 / 0.01 = 18,900", k01.ceiling === 18_900 && k01.viral === false, k01.ceiling);
ok("...so 10,000 becomes REACHABLE where it was not", Object.fromEntries(k01.milestones.map((m) => [m.target, m]))[10000].reachable === true);
ok("...referral signups appear from month 2, once somebody is paying", k01.series[1].signupsBySource.referral === 0 && k01.series[3].signupsBySource.referral > 0, k01.series[3]);
ok("...and paying at month 12 is above the no-referral plan's", k01.series[12].paying > plan.series[12].paying, { k01: k01.series[12].paying, plan: plan.series[12].paying });
const k02 = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, assumed: 0.2, max: 10 }) }) });
ok("k = 0.2 outruns 5% churn: VIRAL, no ceiling, every milestone reachable", k02.viral === true && k02.ceiling === null && k02.milestones.every((m) => m.reachable), { viral: k02.viral, ceiling: k02.ceiling });
ok("...and the far milestones are 'beyond the horizon', not 'never'", k02.milestones.find((m) => m.target === 1_000_000).beyondHorizon === true || k02.milestones.find((m) => m.target === 1_000_000).month !== null);

// ── No churn, no list: no ceiling, honest about the horizon ─────────────────
const noChurn = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now,
  rates: assumedRates({ churn: rate({ of: 0, floor: 3, assumed: 0 }) }),
});
ok("zero churn means no ceiling", noChurn.ceiling === null);
ok("...every milestone is reachable, and the far ones are beyond the horizon rather than never",
  noChurn.milestones.every((m) => m.reachable) && noChurn.milestones.find((m) => m.target === 1_000_000).beyondHorizon === true, noChurn.milestones);
ok("no list size means no runway figure", noChurn.listRunwayMonths === null && noChurn.listExhaustedAt === null);

// ── Trial length and starting stock ─────────────────────────────────────────
const instant = project({ reps: 1, dialsPerRepPerDay: 100, workingDaysPerMonth: 20, rates: assumedRates(), trialMonths: 0, now });
ok("with no trial, month 1 already pays", instant.series[1].paying > 0 && instant.series[1].trialing === 0, instant.series[1]);
const seeded = project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, rates: assumedRates(), startingPaying: 1000, now });
ok("no dialling at all: 1,000 existing subscribers just churn — 950 next month", seeded.series[1].paying === 950 && seeded.monthly.dials === 0, seeded.series[1]);
ok("...and the 100 milestone is already met in month 0", seeded.milestones[0].month === 0);
const inTrial = project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, rates: assumedRates(), startingTrialing: 100, trialMonths: 2, now });
ok("100 already in a 2-month trial convert half each month: 20 paying by month 1, 39 by month 2",
  inTrial.series[1].paying === 20 && inTrial.series[2].paying === 39 && inTrial.series[0].trialing === 100, inTrial.series.slice(0, 3));

// ── Refusals ────────────────────────────────────────────────────────────────
ok("a missing rate is a REFUSAL naming the rate, never a guessed 0.5", (() => {
  try {
    project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates({ churn: rate({ of: 0, floor: 3 }) }) });
    return false;
  } catch (e) { return e instanceof TypeError && Array.isArray(e.missing) && e.missing.join() === "churn"; }
})());
ok("two missing rates are both named, in funnel order", (() => {
  try {
    project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates({ reach: rate({}), conversion: rate({}) }) });
    return false;
  } catch (e) { return e.missing?.join() === "reach,conversion"; }
})());
ok("an organic count with no basis is named too", (() => {
  try {
    project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates(), organic: monthlyCount({ floorMonths: 3 }) });
    return false;
  } catch (e) { return e.missing?.join() === "organic"; }
})());
ok("negative reps refuse", (() => { try { project({ reps: -1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates() }); return false; } catch (e) { return /reps/.test(e.message); } })());
ok("a string for dials refuses rather than coercing", (() => { try { project({ reps: 1, dialsPerRepPerDay: "150", workingDaysPerMonth: 1, rates: assumedRates() }); return false; } catch (e) { return /dialsPerRepPerDay/.test(e.message); } })());
ok("no rates at all refuses", (() => { try { project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1 }); return false; } catch (e) { return /rates/.test(e.message); } })());
ok("a horizon of 10,000 months is clamped to 240", project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates(), horizonMonths: 10_000, now }).series.length === 241);
ok("an invalid `now` falls back to the clock rather than NaN labels", /^\d{4}-\d{2}$/.test(project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates(), now: new Date("nope") }).series[0].label));
ok("deterministic: same input, same output", JSON.stringify(project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now })) === JSON.stringify(plan));

// ── The form fields match the model ────────────────────────────────────────
ok("every rate key has a form field carrying its floor", RATE_KEYS.every((k) => ASSUMPTION_FIELDS.some((f) => f.key === k && f.kind === "rate" && f.floor > 0)));
ok("organic has its own field, as a monthly count", ASSUMPTION_FIELDS.some((f) => f.key === "organic" && f.kind === "monthlyCount"));
ok("the milestones are the owner's five", MILESTONES.join() === "100,1000,10000,100000,1000000");

// ── monthsRate(): churn and referral are sampled in months ─────────────────
import { monthsRate } from "../lib/platform/growthModel.js";
ok("churn: 2 qualifying months keep the assumption, and show the measurement forming",
  (() => { const r = monthsRate({ hit: 3, of: 60, months: 2, floorMonths: 3, assumed: 0.05 }); return r.basis === "assumed" && r.value === 0.05 && near(r.measured, 0.05) && r.remaining === 1; })());
ok("churn: 3 qualifying months are measured", monthsRate({ hit: 3, of: 100, months: 3, floorMonths: 3, assumed: 0.5 }).basis === "measured");
ok("referral: a coefficient above 1 survives its own max", monthsRate({ hit: 40, of: 20, months: 3, floorMonths: 3, max: 10 }).value === 2);

// ── The wiring: route, page, sidebar — pinned, because each is one line ────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
{
  const route = read("app/api/platform/growth/route.js");
  ok("the route is superadmin-only, compared on the role like the sales floor", /admin\.role !== "superadmin"/.test(route) && /getCurrentPlatformAdmin\(request\)/.test(route));
  ok("the route turns a missing rate into `needs`, never a 500 or a guess", /needs = err\.missing/.test(route) && /if \(!Array\.isArray\(err\?\.missing\)\) throw err/.test(route));
  ok("PUT guards request.json() and refuses a non-object body", /catch \{\s*return NextResponse\.json\(\{ error: "Send a JSON body\." \}, \{ status: 400 \}\)/.test(route) && /Array\.isArray\(body\)/.test(route));
  ok("PUT bounds every rate, with referral allowed above 1 and organic as a count", /reach: 1, signup: 1, conversion: 1, churn: 1, referral: 10, organic: 1_000_000/.test(route));
  ok("PUT records who saved", /updatedByAdminId: admin\.id/.test(route));
  const measured = read("lib/platform/growthMeasured.js");
  ok("reached is derived from DISPOSITIONS[].reached, not a hardcoded list", /Object\.entries\(DISPOSITIONS\)[\s\S]{0,80}d\.reached/.test(measured) && !/"reached_interested"/.test(measured));
  ok("every dial count filters direction \"out\"", (measured.match(/salesCallAttempt\.count\(\{ where: \{ direction: "out"/g) || []).length >= 4);
  ok("demo companies are excluded from every signup and subscription measure", /isDemo: true/.test(measured) && (measured.match(/\.\.\.notDemo/g) || []).length >= 5);
  ok("on-trial is billingStartedAt == null, per the schema's own rule", /billingStartedAt: null, status: "trialing"/.test(measured));
  ok("only FULL months are observed — never the current one", /for \(let i = MONTHS_BACK; i >= 1; i -= 1\)/.test(measured));
  const page = read("app/platform/growth/page.js");
  ok("the page shows a basis chip beside every rate", /basisChip\(r\)/.test(page) && /Measured/.test(page) && /Assumed/.test(page) && /Missing/.test(page));
  ok("the page says 'not reachable at these rates' with the ceiling, in words", /Not reachable at these rates — the ceiling is/.test(page));
  ok("the page draws with the platform Sparkline, not a chart library", /from "@\/app\/components\/platform\/Sparkline"/.test(page) && !/recharts|chart\.js|d3/.test(page));
  ok("the page loads through fetchJson and catches, never if (res.ok) with no else", /await fetchJson\("\/api\/platform\/growth"\)/.test(page) && !/res\.ok/.test(page));
  const sidebar = read("app/components/platform/PlatformSidebar.js");
  ok("the sidebar links the page (check-nav-audit would refuse the build otherwise)", /href: "\/platform\/growth"/.test(sidebar));
  const pkg = read("package.json");
  // Anywhere in the chain — the first version assumed it was last, and broke
  // the moment the next check was appended after it.
  ok("the check is in check:all", /npm run check:growth-model( &&|")/.test(pkg));
}

console.log(`\ncheck-growth-model: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
