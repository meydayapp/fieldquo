// scripts/check-daily-objectives.mjs
//
//   npm run check:daily-objectives
//
// Executes the daily-sheet arithmetic and access rules against hostile
// input. The two claims the mockup's note flagged as decisions:
//
//   - NO BONUS WITHOUT A RULE. Company.performancePayRule is null by
//     default; computeBonus answers null for it, an all-zero rule is stored
//     as null, and the pay run reads only sheets with a bonus figure.
//   - CREW SEES ONLY THEIR OWN SHEET. sheetScope narrows a member without
//     timeTracking:view_record_edit_all to their own Worker row, and a
//     member with no Worker row to nothing; only a coordinator evaluates.

import { readFileSync } from "node:fs";
import { normalisePayRule, computeBonus } from "../lib/dailySheets/bonus.js";
import { objectivesFromTasks, normaliseObjectives, normaliseUpsells, normaliseScore, OBJECTIVE_STATUSES } from "../lib/dailySheets/objectives.js";
import { sheetScope, mayEditSheet, mayEvaluate, coordinatesSheets } from "../lib/dailySheets/access.js";
import { weeklySummary } from "../lib/dailySheets/weekly.js";
import { dateKeyToColumn, columnToDateKey, weekStartKey, weekKeys, dayInstants, todayKey } from "../lib/dailySheets/day.js";

let failures = 0;
let passes = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

// ── 1. No rule, no bonus ──────────────────────────────────────────────────
section("1. Performance pay: null means null");
{
  const sheet = { objectives: [{ status: "done" }, { status: "done" }], upsells: [{ amountCents: 34000 }], evaluationScore: 4 };
  ok("no rule → computeBonus is null, not 0", computeBonus(null, sheet) === null && computeBonus(undefined, sheet) === null);
  ok("garbage rule → null", computeBonus("20 bucks", sheet) === null && computeBonus(42, sheet) === null && computeBonus([], sheet) === null);
  ok("an all-zero rule normalises to null (no rule)", normalisePayRule({ perObjectiveCents: 0, allDoneCents: 0, upsellPct: 0, minScore: 3 }) === null && normalisePayRule({}) === null);
  ok("negative, NaN and absurd figures are dropped, not stored", JSON.stringify(normalisePayRule({ perObjectiveCents: -5, allDoneCents: "x", upsellPct: 250, minScore: 9 })) === "null");
  const rule = normalisePayRule({ perObjectiveCents: 1000, allDoneCents: 2000, upsellPct: 5, minScore: 0 });
  ok("a real rule normalises to integers", JSON.stringify(rule) === JSON.stringify({ perObjectiveCents: 1000, allDoneCents: 2000, upsellPct: 5, minScore: 0 }));
  const b = computeBonus(rule, sheet);
  ok("the mockup's day: 2 of 2 done → 20 + 20 all-done, 5% of 340 → 17; total 57.00", b.cents === 5700 && b.lines.length === 3 && b.lines.find((l) => l.key === "upsell").cents === 1700);
  ok("all-done pays nothing on a sheet with no objectives", computeBonus(rule, { objectives: [], upsells: [] }).lines.every((l) => l.key !== "all_done"));
  ok("partial objectives do not count as done", computeBonus(rule, { objectives: [{ status: "partial" }, { status: "done" }], upsells: [] }).cents === 1000);
  ok("upsell bonus ignores negative and NaN amounts", computeBonus(rule, { objectives: [], upsells: [{ amountCents: -100 }, { amountCents: "x" }, { amountCents: 1000 }] }).cents === 50);
  const floor = normalisePayRule({ perObjectiveCents: 1000, minScore: 3 });
  ok("a score floor: below it pays nothing and says why", computeBonus(floor, { objectives: [{ status: "done" }], evaluationScore: 2 }).cents === 0 && computeBonus(floor, { objectives: [{ status: "done" }], evaluationScore: 2 }).lines[0].key === "below_min_score");
  ok("a score floor with no score yet: waiting, not failed", computeBonus(floor, { objectives: [{ status: "done" }] }).waitingForScore === true);
  ok("rounding: 5% of 333 cents is 17, never 16.65", computeBonus(normalisePayRule({ upsellPct: 5 }), { upsells: [{ amountCents: 333 }] }).cents === 17);
}

// ── 2. Objectives and upsells normalise ───────────────────────────────────
section("2. Objectives from the plan, typed objectives, upsells by id");
{
  const fromTasks = objectivesFromTasks([
    { id: "t1", title: "Walls, 2 coats — Living room", status: "open" },
    { id: "t2", title: "Dining room", status: "done", estimatedHours: 4 },
    { id: "bad", title: "" }, { title: "no id" }, null,
  ]);
  ok("tasks become objectives with taskId; a done task arrives done", fromTasks.length === 2 && fromTasks[0].taskId === "t1" && fromTasks[0].status === "planned" && fromTasks[1].status === "done" && fromTasks[1].plannedHours === 4);
  const objs = normaliseObjectives([
    { id: "o1", title: "  Prime the ceiling ", status: "done", actualHours: "3.6", beforePhoto: "https://res.cloudinary.com/x/a.jpg", afterPhoto: "javascript:alert(1)", note: "x".repeat(400) },
    { title: "", status: "done" },
    { id: "../x", title: "Trim", status: "bogus", actualHours: 99, plannedHours: -1 },
    "string", null,
  ]);
  ok("titles are required, trimmed; statuses fall back; hours are bounded; bad URLs dropped; notes capped", objs.length === 2 && objs[0].title === "Prime the ceiling" && objs[0].actualHours === 3.6 && objs[0].afterPhoto === null && objs[0].beforePhoto && objs[0].note.length === 300 && objs[1].status === "planned" && objs[1].actualHours === null && objs[1].plannedHours === null && objs[1].id !== "../x");
  ok("OBJECTIVE_STATUSES is the four the sheet offers", OBJECTIVE_STATUSES.join() === "planned,done,partial,not_done");

  const linked = new Map([["addon:ad1", { description: "Closet interiors", amountCents: 34000 }]]);
  const ups = normaliseUpsells([
    { quoteAddOnId: "ad1", amountCents: 1 },
    { quoteAddOnId: "other_tenant", amountCents: 99999 },
    { description: "Extra coat on the door", amountCents: "1500" },
    { description: "", amountCents: 500 },
    { description: "Free", amountCents: -20 },
  ], linked);
  ok("a linked upsell takes the row's amount, never the request's", ups[0].amountCents === 34000 && ups[0].description === "Closet interiors");
  ok("an id not on file is dropped", !ups.some((u) => u.quoteAddOnId === "other_tenant"));
  ok("a typed upsell keeps its amount; blank description dropped; negative → 0", ups.length === 3 && ups[1].amountCents === 1500 && ups[2].amountCents === 0);
  ok("normaliseScore: 1–5 only", normaliseScore(4) === 4 && normaliseScore("5") === 5 && normaliseScore(0) === null && normaliseScore(6) === null && normaliseScore("x") === null);
}

// ── 3. Who sees what ──────────────────────────────────────────────────────
section("3. Access: crew sees only their own sheet");
{
  const owner = { role: "owner", userId: "u1", permissions: {} };
  const coordinator = { role: "supervisor", userId: "u2", permissions: { timeTracking: "view_record_edit_all" } };
  const crew = { role: "employee", userId: "u3", permissions: { timeTracking: "view_record_edit_own" } };
  const crewNoGrid = { role: "employee", userId: "u4", permissions: null };
  ok("owner and coordinator see everything", JSON.stringify(sheetScope(owner, "w1")) === "{}" && JSON.stringify(sheetScope(coordinator, null)) === "{}");
  ok("crew is narrowed to their own worker row", JSON.stringify(sheetScope(crew, "w3")) === JSON.stringify({ workerId: "w3" }));
  ok("crew with no worker row sees nothing (null), not everything", sheetScope(crew, null) === null);
  ok("an employee with no grid is NOT a coordinator (hasLevel fails open; this must not)", JSON.stringify(sheetScope(crewNoGrid, "w4")) === JSON.stringify({ workerId: "w4" }) && !mayEvaluate(crewNoGrid));
  ok("a supervisor with no grid is a coordinator by role", coordinatesSheets({ role: "supervisor", userId: "u5", permissions: null }));
  ok("crew may edit their own sheet and nobody else's", mayEditSheet(crew, "w3", "w3") && !mayEditSheet(crew, "w3", "w9") && !mayEditSheet(crew, null, "w3"));
  ok("only a coordinator evaluates", mayEvaluate(owner) && mayEvaluate(coordinator) && !mayEvaluate(crew));
  ok("coordinatesSheets agrees with hasLevel", coordinatesSheets(coordinator) && !coordinatesSheets(crew));
}

// ── 4. Days and weeks ─────────────────────────────────────────────────────
section("4. Days in the company's zone, weeks from Monday");
{
  ok("dateKeyToColumn parses a real date and refuses Feb 31 and garbage", columnToDateKey(dateKeyToColumn("2026-09-23")) === "2026-09-23" && dateKeyToColumn("2026-02-31") === null && dateKeyToColumn("tomorrow") === null && dateKeyToColumn(20260923) === null);
  ok("weekStartKey lands on the Monday", weekStartKey("2026-09-23") === "2026-09-21" && weekStartKey("2026-09-21") === "2026-09-21" && weekStartKey("2026-09-27") === "2026-09-21");
  ok("weekKeys gives seven consecutive days", weekKeys("2026-09-21").join() === "2026-09-21,2026-09-22,2026-09-23,2026-09-24,2026-09-25,2026-09-26,2026-09-27");
  const b = dayInstants("2026-09-23", "America/Toronto");
  ok("dayInstants spans the Toronto day (04:00Z to 04:00Z next day in September)", b.start.toISOString() === "2026-09-23T04:00:00.000Z" && b.next.toISOString() === "2026-09-24T04:00:00.000Z");
  ok("todayKey follows the zone: 02:00Z on the 24th is still the 23rd in Toronto", todayKey("America/Toronto", new Date("2026-09-24T02:00:00Z")) === "2026-09-23");

  const keys = weekKeys("2026-09-21");
  const summary = weeklySummary({
    sheets: [
      { dateKey: "2026-09-23", objectives: [{ status: "done" }, { status: "partial" }], upsells: [{ amountCents: 34000 }], evaluationScore: 4, bonusCents: 3700 },
      { dateKey: "2026-09-24", objectives: [{ status: "done" }], upsells: [], evaluationScore: 5, bonusCents: 2000 },
      { dateKey: "2026-09-30", objectives: [{ status: "done" }] }, // outside the week
    ],
    entries: [
      { clockIn: "2026-09-23T12:00:00Z", clockOut: "2026-09-23T20:00:00Z", hours: 7.5 },
      { clockIn: "2026-09-23T21:00:00Z", clockOut: null, hours: null },
      { clockIn: "2026-09-25T12:00:00Z", clockOut: "2026-09-25T13:00:00Z", hours: "x" },
    ],
    dayKeys: keys,
    dayKeyOf: (e) => e.clockIn.slice(0, 10),
  });
  ok("the week sums hours, objectives, upsells, average score and bonus", summary.totals.hours === 7.5 && summary.totals.objectives === 3 && summary.totals.done === 2 && summary.totals.upsellCents === 34000 && summary.totals.avgScore === 4.5 && summary.totals.bonusCents === 5700 && summary.totals.daysWithSheet === 2);
  ok("a day outside the week is ignored; an open entry and NaN hours add nothing", summary.days.length === 7 && summary.days[4].hours === 0);
  const noRule = weeklySummary({ sheets: [{ dateKey: "2026-09-23", objectives: [] }], entries: [], dayKeys: keys, dayKeyOf: () => "" });
  ok("no bonus figure on any sheet → bonus total is null, not 0; no score → avg null", noRule.totals.bonusCents === null && noRule.totals.avgScore === null);
}

// ── 5. Wiring ─────────────────────────────────────────────────────────────
section("5. Wiring");
{
  const evaluate = readFileSync(new URL("../app/api/daily-sheets/evaluate/route.js", import.meta.url), "utf8");
  ok("the evaluate route is coordinator-only and computes the bonus from the company row", evaluate.includes("if (!mayEvaluate(full))") && evaluate.includes("computeBonus(company?.performancePayRule"));
  const day = readFileSync(new URL("../app/api/daily-sheets/route.js", import.meta.url), "utf8");
  ok("the day route narrows through sheetScope and refuses a member with no scope", day.includes("sheetScope(full, mine?.id || null)") && day.includes("if (scope === null)"));
  ok("the PUT route refuses a sheet already on a pay run", day.includes("existing?.payRunId"));
  const pay = readFileSync(new URL("../lib/payroll/buildPayRun.js", import.meta.url), "utf8");
  ok("the pay run reads only sheets with a bonus and no payRunId", pay.includes("payRunId: null") && pay.includes("bonusCents: { gt: 0 }") && pay.includes('source: "bonus"'));
  const runs = readFileSync(new URL("../app/api/payroll/runs/route.js", import.meta.url), "utf8");
  ok("committing a run stamps the sheets it took", runs.includes("data: { payRunId: run.id }"));
  const settings = readFileSync(new URL("../app/api/settings/field-work/route.js", import.meta.url), "utf8");
  ok("the rule is written through normalisePayRule (all-zero → null)", settings.includes("data.performancePayRule = normalisePayRule(body.performancePayRule)"));
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  ok("Company.performancePayRule has no default and DailyObjectiveSheet.bonusCents is nullable", /performancePayRule Json\?\n/.test(schema) && /bonusCents\s+Int\?/.test(schema));
  const page = readFileSync(new URL("../app/app/daily-sheets/page.js", import.meta.url), "utf8");
  ok("the sheet says 'no rule' rather than printing a placeholder figure", page.includes('t("app.dailySheet.noRule")') && !page.includes("+$20"));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
