// scripts/check-costing-defaults.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-costing-defaults.mjs
//
// The owner's decision of 2026-09-29 on quote costing:
//
//   1. A quote whose costing leaned on FieldQuo's defaults says so — "Labour
//      is at FieldQuo's $35/h default — nobody is assigned" with an Assign
//      action; "Overhead is estimated at 10% of the price — tell us how many
//      jobs you do" with a link. Only when the default was actually used;
//      never on a properly costed quote.
//   2. Assign on an instant estimate: the builder's own team picker, the same
//      save path, labour recomputed from the people's real rates; a worker
//      with no rate is named ("No pay rate set for X"), never priced at $0 or
//      $35 in silence; and the crew carries into the job on approval.
//   3. Capacity per MONTH as well as per week. Worked numbers from the owner:
//      $4,141.40 a month over 4 jobs a month = $1,035.35 a job; 1 job a week
//      = 4,141.40 ÷ 4.33 = $956.44.
//
// EXECUTED: costingDefaultsUsed / unratedCrew (lib/costing/costingDefaults.js)
// against instant-estimate, derived, properly costed and hostile costings;
// quoteCostSummary before and after an assignment; crewMemberFromWorker;
// quotedCrewFrom (lib/jobs/quotedCrew.js); priceFromBurn / jobsPerMonthFrom
// (lib/analytics/minimumPrice.js) and parseCapacity (lib/analytics/
// capacity.js) with the owner's numbers.
//
// READ FROM SOURCE (the wiring a pure test can't reach): the quote page and
// the builder panel render the notice from the helper; QuoteCostEditor sends
// the worker id, the overhead % and the note back; the job route strips the
// pay rates it read; the visit form pre-selects; all new keys in nine
// languages with their placeholders.
import { readFileSync } from "node:fs";
import {
  costingDefaultsUsed,
  isRealOverheadBasis,
  unratedCrew,
  FALLBACK_LABOUR_RATE,
  FALLBACK_OVERHEAD_PCT,
} from "@/lib/costing/costingDefaults";
import {
  quoteCostSummary,
  shapeEstimate,
  shapeSavedQuoteCosting,
  normaliseQuoteCosting,
  FALLBACK_LABOUR_RATE as REEXPORTED_RATE,
  FALLBACK_OVERHEAD_PCT as REEXPORTED_PCT,
} from "@/lib/costing/quoteCosting";
import { crewMemberFromWorker } from "@/lib/costing/crew";
import { quotedCrewFrom, quotedCrewWorkerIds } from "@/lib/jobs/quotedCrew";
import { priceFromBurn, jobsPerMonthFrom } from "@/lib/analytics/minimumPrice";
import { parseCapacity } from "@/lib/analytics/capacity";
import { parseBillableHours } from "@/lib/analytics/hourlyFloor";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
  }
};
const source = (p) => readFileSync(p, "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

// A saved row, shaped the way buildQuoteCostingRow writes it.
function savedRowFrom(summary, inputs) {
  return {
    crew: summary.crew.map((m, i) => ({
      id: m.id ?? null, name: m.name, rate: m.rate, hours: m.hours, cost: m.cost,
      unrated: Boolean(m.unrated), hoursExplicit: inputs.crew?.[i]?.hours != null,
    })),
    addedLabourHours: inputs.addedLabourHours || 0,
    addedMaterialCost: 0,
    labourRate: inputs.labourRate,
    overheadPct: inputs.overheadPct,
    note: null,
    labourHours: summary.labourHours, labourCost: summary.labourCost,
    materialTotal: summary.materialTotal, unpricedMaterials: summary.unpricedMaterials,
    lineItemCost: summary.lineItemCost, overhead: summary.overhead,
    overheadBasis: summary.overheadBasis, totalCost: summary.estimatedCost,
    price: summary.price, profit: summary.profit, marginPct: summary.marginPct,
    marginTargetPct: 20, signal: summary.signal, costIncomplete: summary.costIncomplete,
    blendedRate: summary.blendedRate, groups: summary.groups,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The warnings — shown only when a default was used\n");

ok("the defaults are 35 and 10, and quoteCosting.js re-exports the same two",
  FALLBACK_LABOUR_RATE === 35 && FALLBACK_OVERHEAD_PCT === 10 &&
    REEXPORTED_RATE === 35 && REEXPORTED_PCT === 10);

// An instant estimate: 20 hours, nobody assigned, $35, 10% of a $6,000 price —
// exactly the inputs createEstimateQuote.js passes.
const instantInputs = { crew: [], addedLabourHours: 20, labourRate: FALLBACK_LABOUR_RATE, overheadPct: FALLBACK_OVERHEAD_PCT };
const instant = quoteCostSummary({ ...instantInputs, price: 6000 });
const instantSaved = shapeSavedQuoteCosting(savedRowFrom(instant, instantInputs));
let d = costingDefaultsUsed(instantSaved);
ok("instant estimate (saved row): labour default shown", d.labour === true, d);
ok("…overhead default shown, quoting the 10% it used", d.overhead === true && d.overheadPct === 10, d);
ok("…and the arithmetic really is the default: 20 h × $35 = $700, 10% of $6,000 = $600",
  instant.labourCost === 700 && instant.overhead === 600 && instant.overheadBasis === "pct_of_price",
  [instant.labourCost, instant.overhead, instant.overheadBasis]);

// The derived fallback (nothing saved) — deriveQuoteCosting stamps both.
const derived = { ...shapeEstimate(instant), labourRateBasis: "fallback", labourRate: FALLBACK_LABOUR_RATE, overheadPct: FALLBACK_OVERHEAD_PCT };
d = costingDefaultsUsed(derived);
ok("derived costing (saved: false): both defaults shown", d.labour && d.overhead && d.overheadPct === 10, d);
ok("deriveQuoteCosting states the percentage it used",
  /shaped\.overheadPct = FALLBACK_OVERHEAD_PCT;/.test(strip(source("lib/costing/quoteCostEstimate.js"))));

// A PROPERLY costed quote: a named crew with rates, the company's real
// per-job overhead. Neither sentence may appear.
const properInputs = { crew: [{ id: "w1", name: "Ana", rate: 32, hours: null }, { id: "w2", name: "Ben", rate: 28, hours: 8 }], addedLabourHours: 20, labourRate: 35, overheadPct: 10 };
const proper = quoteCostSummary({ ...properInputs, overheadPerJob: 1035.35, price: 6000 });
const properSaved = shapeSavedQuoteCosting(savedRowFrom(proper, properInputs));
d = costingDefaultsUsed(properSaved);
ok("properly costed (crew + per_job): NOTHING shown", d.labour === false && d.overhead === false && d.overheadPct === null, d);

// Each default on its own.
d = costingDefaultsUsed({ ...instantSaved, overheadBasis: "per_job" });
ok("real overhead, nobody assigned: labour only", d.labour && !d.overhead, d);
// The time share (lib/costing/overheadShare.js) is the company's own figures
// — monthly costs ÷ its billable crew-hours × the job's — not FieldQuo's
// percentage, so it must not be called a default.
d = costingDefaultsUsed({ ...instantSaved, overheadBasis: "per_hour" });
ok("per_hour overhead is NOT a default: labour only", d.labour && !d.overhead && d.overheadPct === null, d);
d = costingDefaultsUsed({ ...properSaved, overheadBasis: "per_hour" });
ok("crew + per_hour: NOTHING shown", d.labour === false && d.overhead === false, d);
ok("the screens' 'hide the % box' test: per_job and per_hour real, the rest not",
  isRealOverheadBasis("per_job") && isRealOverheadBasis("per_hour") &&
  ![ "pct_of_price", null, undefined, "", "PER_HOUR", 1, {} ].some(isRealOverheadBasis));
ok("the builder panel and the quote's cost editor hide the % box through the helper",
  /!isRealOverheadBasis\(estimate\.overheadBasis\)/.test(strip(source("app/components/quotes/builder/CostMarginPanel.js"))) &&
  /!isRealOverheadBasis\(overheadBasis\)/.test(strip(source("app/components/quotes/QuoteCostEditor.js"))));
d = costingDefaultsUsed({ ...properSaved, overheadBasis: "pct_of_price", overheadPct: 12.5 });
ok("a crew, but overhead still a share of the price: overhead only, quoting 12.5%", !d.labour && d.overhead && d.overheadPct === 12.5, d);
d = costingDefaultsUsed({ ...instantSaved, labourRate: 48 });
ok("nobody assigned but the company typed its own $48 fallback: NOT 'FieldQuo's $35 default'", d.labour === false, d);
d = costingDefaultsUsed({ ...instantSaved, labourHours: 0 });
ok("no hours to cost: no labour sentence", d.labour === false, d);
const { labourRate: _lr, ...noRate } = instantSaved;
d = costingDefaultsUsed(noRate);
ok("a costing that doesn't say its rate: silence, not a claim", d.labour === false, d);
const { overheadBasis: _ob, ...noBasis } = instantSaved;
d = costingDefaultsUsed(noBasis);
ok("a costing that doesn't say its overhead basis: silence", d.overhead === false, d);
d = costingDefaultsUsed({ ...instantSaved, overheadPct: undefined });
ok("pct_of_price with no stated pct: the share sentence, no invented number", d.overhead && d.overheadPct === null, d);
d = costingDefaultsUsed({ ...derived, costBasisMissing: true });
ok("costBasisMissing: nothing (that block says something stronger)", !d.labour && !d.overhead, d);
let threw = false;
try {
  for (const hostile of [null, undefined, "x", 7, [], { crew: "x" }, { crew: [null], labourHours: "NaN", labourRate: {} }, { labourHours: Infinity, labourRate: 35, crew: [] }]) {
    const r = costingDefaultsUsed(hostile);
    if (typeof r.labour !== "boolean" || typeof r.overhead !== "boolean") threw = true;
  }
} catch {
  threw = true;
}
ok("hostile input never throws and always answers booleans", !threw);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Assign — the builder's control, real rates, unrated named\n");

const w1 = { id: "w1", name: "Ana", hourlyRate: "32.00", userId: "u1" };
const w2 = { id: "w2", name: "Ben", hourlyRate: null, userId: null };
const m1 = crewMemberFromWorker(w1, "Crew member");
const m2 = crewMemberFromWorker(w2, "Crew member");
ok("a picked worker keeps its id and its real rate (Decimal string → 32)", m1.id === "w1" && m1.rate === 32 && m1.hours === null, m1);
ok("a worker with no rate joins at 0 — not $35, not dropped", m2.id === "w2" && m2.rate === 0, m2);

const assignedInputs = { crew: [m1], addedLabourHours: 20, labourRate: FALLBACK_LABOUR_RATE, overheadPct: FALLBACK_OVERHEAD_PCT };
const assigned = quoteCostSummary({ ...assignedInputs, price: 6000 });
ok("assigning Ana re-costs the same 20 hours at HER $32: $640, not $700", assigned.labourCost === 640 && assigned.labourHours === 20, [assigned.labourCost, assigned.labourHours]);
d = costingDefaultsUsed(shapeSavedQuoteCosting(savedRowFrom(assigned, assignedInputs)));
ok("…and the labour warning goes away (overhead one stays until capacity is set)", !d.labour && d.overhead, d);
const mixed = quoteCostSummary({ crew: [m1, m2], addedLabourHours: 20, labourRate: 35, overheadPct: 10, price: 6000 });
ok("Ana + unrated Ben: Ben's 10 h cost nothing and the costing says it is incomplete", mixed.costIncomplete === true && mixed.crewUnrated === 1 && mixed.signal !== "green", [mixed.costIncomplete, mixed.crewUnrated, mixed.signal]);
const mixedShape = shapeSavedQuoteCosting(savedRowFrom(mixed, { crew: [m1, m2], addedLabourHours: 20, labourRate: 35, overheadPct: 10 }));
const named = unratedCrew(mixedShape.crew).map((m) => m.name);
ok("unratedCrew names Ben — the page prints 'No pay rate set for Ben'", named.length === 1 && named[0] === "Ben", named);
ok("the saved crew keeps both worker ids (what the job reads)", mixedShape.crew.map((m) => m.id).join(",") === "w1,w2", mixedShape.crew.map((m) => m.id));
ok("normaliseQuoteCosting keeps a posted worker id", normaliseQuoteCosting({ crew: [{ id: "w1", name: "Ana", rate: 32 }] }).crew[0].id === "w1");
ok("unratedCrew: rated or zero-hour rows are not named; blank-rate builder rows are",
  unratedCrew([{ name: "a", rate: 30 }, { name: "b", rate: 0, hours: 0 }, { name: "c", rate: "", hours: null }, { name: "d", hourlyRate: 0, hours: 4 }, null]).map((m) => m.name).join(",") === "c,d");

{
  const editor = strip(source("app/components/quotes/QuoteCostEditor.js"));
  ok("QuoteCostEditor renders the shared TeamCrewPicker", /<TeamCrewPicker/.test(editor) && /from "@\/app\/components\/quotes\/TeamCrewPicker"/.test(editor));
  ok("QuoteCostEditor posts the worker id, the overhead % and the note back (it used to drop all three)",
    /id: m\.id \|\| null,/.test(editor) && /overheadPct: overheadPct === "" \? 0 : num\(overheadPct\)/.test(editor) && /note: existing\?\.note \?\? ""/.test(editor));
  ok("QuoteCostEditor opens an unsaved costing on the rate and % the figures were derived at",
    /existing\?\.labourRate \?\? FALLBACK_LABOUR_RATE/.test(editor) && /existing\?\.overheadPct \?\? FALLBACK_OVERHEAD_PCT/.test(editor));
  ok("QuoteCostEditor saves through PATCH /api/quotes/[id] (buildQuoteCostingRow — the builder's path)", /\/api\/quotes\/\$\{quoteId\}`/.test(editor) && /method: "PATCH"/.test(editor));
  const panel = strip(source("app/components/quotes/builder/CostMarginPanel.js"));
  ok("the builder panel uses the same picker, and no longer carries its own copy", /<TeamCrewPicker/.test(panel) && !/app\.cost\.addFromTeam/.test(panel));
  ok("the builder panel shows the notice for quotes only (not invoices)", /\{!hoursAreActual && \(\s*<CostingDefaultsNotice/.test(panel));
  const page = strip(source("app/app/quotes/[id]/page.js"));
  ok("the quote page's Cost & margin block renders the notice from the helper, Assign opening the editor",
    /defaults=\{costingDefaultsUsed\(costing\)\}/.test(page) && /onAssign=\{\(\) => setCostEditorOpen\(true\)\}/.test(page));
  ok("the quote page names unrated crew and links to pay rates", /unratedCrew\(costing\.crew\)/.test(page) && /href="\/app\/settings\/team\/workers"/.test(page));
  const notice = strip(source("app/components/quotes/CostingDefaultsNotice.js"));
  ok("the notice renders nothing when no default was used", /if \(!defaults \|\| \(!defaults\.labour && !defaults\.overhead\)\) return null;/.test(notice));
  ok("the notice's link lands on the capacity card", /href="\/app\/settings\/overhead#capacity"/.test(notice) &&
    /id="capacity"/.test(source("app/app/settings/overhead/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Carry into the job\n");

const stored = [
  { id: "w1", name: "Ana (old name)", rate: 32, hours: 10, cost: 320 },
  { id: null, name: "Sub — Bob's Drywall", rate: 0, hours: 5, cost: 0 },
  { id: "someone-elses", name: "X", rate: 99 },
  {},
  { id: "w1", name: "Ana again" },
  null,
];
const crew = quotedCrewFrom(stored, [{ id: "w1", name: "Ana", userId: "u1" }]);
ok("worker rows resolve to the current name and the login behind them", crew[0].workerId === "w1" && crew[0].name === "Ana" && crew[0].userId === "u1", crew[0]);
ok("a typed name with no worker keeps the name, no identity", crew[1].workerId === null && crew[1].name === "Sub — Bob's Drywall" && crew[1].userId === null, crew[1]);
ok("an id that isn't this company's worker gets no identity", crew[2].workerId === null && crew[2].userId === null, crew[2]);
ok("empty rows, nulls and a duplicate worker are dropped", crew.length === 3, crew.length);
ok("NO pay rate or cost leaves with the names", crew.every((m) => Object.keys(m).sort().join(",") === "name,userId,workerId"), crew);
ok("quotedCrewWorkerIds asks only for real string ids, once", quotedCrewWorkerIds(stored).join(",") === "w1,someone-elses");
ok("hostile stored crew never throws", (() => { try { return quotedCrewFrom("x", null).length === 0 && quotedCrewFrom(null, "y").length === 0; } catch { return false; } })());
{
  const route = strip(source("app/api/jobs/[id]/route.js"));
  ok("GET /api/jobs/[id] reads the quote's costing crew, scoped to this company's workers",
    /costing: \{ select: \{ crew: true \} \}/.test(route) && /where: \{ companyId: member\.companyId, id: \{ in: ids \} \}/.test(route));
  ok("…drops the costing (pay rates) before responding, and returns quotedCrew",
    /if \(job\.quote\) delete job\.quote\.costing;/.test(route) && /\n\s*quotedCrew,\n/.test(route));
  const conv = strip(source("lib/jobs/createJobFromQuote.js"));
  ok("the approved quote's job keeps its quoteId — the link the crew rides on", /quoteId: quote\.id,/.test(conv));
  const visit = strip(source("app/app/jobs/[id]/visits/new/page.js"));
  ok("the first visit's form pre-selects the first quoted person it can offer", /jobData\?\.quotedCrew/.test(visit) && /offered\.has\(c\.userId\)/.test(visit) && /setAssignedToId\(first\.userId\)/.test(visit));
  ok("the job page names the quoted crew", /job\.quotedCrew\?\.length > 0/.test(strip(source("app/app/jobs/[id]/JobDetail.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Capacity per month — the owner's worked numbers\n");

const burn = { totalMonthlyCost: 4141.4, totalMonthlyBurn: 4141.4, breakdown: {} };
const monthly = priceFromBurn({ burn, capacity: 1, jobsPerMonth: 4, targetMargin: 0.2 });
ok("$4,141.40 a month ÷ 4 jobs a month = $1,035.35 a job", monthly.costPerJob === 1035.35 && monthly.jobsPerMonth === 4, [monthly.costPerJob, monthly.jobsPerMonth]);
const weekly = priceFromBurn({ burn, capacity: 1, targetMargin: 0.2 });
ok("1 job a week: 4,141.40 ÷ 4.33 = $956.44 (unchanged path)", weekly.costPerJob === 956.44, weekly.costPerJob);
ok("the monthly answer wins over the weekly column it was stored beside", priceFromBurn({ burn, capacity: 3, jobsPerMonth: 4, targetMargin: 0.2 }).costPerJob === 1035.35);
ok("no monthly answer: the weekly one, exactly as before", priceFromBurn({ burn, capacity: 1, jobsPerMonth: null, targetMargin: 0.2 }).costPerJob === 956.44);
ok("jobsPerMonthFrom: 0, negative, garbage, null, '' are all 'not said'", [0, -3, "x", null, undefined, "", NaN, Infinity].every((v) => jobsPerMonthFrom(v) === null));
ok("neither unit set: needsCapacity, no invented floor", priceFromBurn({ burn, capacity: 0, jobsPerMonth: null, targetMargin: 0.2 }).needsCapacity === true);

let c = parseCapacity({ jobsPerMonthCapacity: 4 });
ok("PUT 4 a month → month 4, week column 1 (rounded, at least 1)", c.month === 4 && c.week === 1, c);
c = parseCapacity({ jobsPerMonthCapacity: 1 });
ok("PUT 1 a month → week column still at least 1", c.month === 1 && c.week === 1, c);
c = parseCapacity({ jobsPerMonthCapacity: 900 });
ok("PUT 900 a month → week column capped at 200", c.month === 900 && c.week === 200, c);
ok("PUT 0 / 901 / 2.5 / 'lots' a month → refused", [0, 901, 2.5, "lots", -1].every((v) => Boolean(parseCapacity({ jobsPerMonthCapacity: v }).error)));
c = parseCapacity({ jobsPerWeekCapacity: 3 });
ok("PUT 3 a week → week 3 and the monthly column CLEARED", c.week === 3 && c.month === null, c);
c = parseCapacity({ jobsPerWeekCapacity: null, jobsPerMonthCapacity: null });
ok("PUT blank → both cleared (week 0 = unknown)", c.week === 0 && c.month === null, c);
ok("PUT with no capacity at all is still refused, as before", Boolean(parseCapacity({}).error));
ok("PUT 201 a week → refused, as before", Boolean(parseCapacity({ jobsPerWeekCapacity: 201 }).error));
{
  const min = strip(source("lib/analytics/minimumPrice.js"));
  ok("calculateMinimumPrice reads the monthly column and hands it through", /jobsPerMonthFrom\(forecast\?\.jobsPerMonthCapacity\)/.test(min) && /jobsPerMonth: monthly,/.test(min));
  const schema = source("prisma/schema.prisma");
  ok("ForecastSettings.jobsPerMonthCapacity Int? is in the schema (additive, nullable)", /^\s*jobsPerMonthCapacity\s+Int\?\s*$/m.test(schema));
  const route = strip(source("app/api/settings/forecast/route.js"));
  ok("the forecast route writes and returns both columns", /jobsPerMonthCapacity: cap\.month,/.test(route) && /jobsPerMonthCapacity: saved\.jobsPerMonthCapacity \?\? null/.test(route) && /jobsPerMonthCapacity: row\?\.jobsPerMonthCapacity \?\? null/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4b. Billable crew hours a month — written AND read\n");

// The PUT's parser — ONE for the column, shared with the hourly floor
// (lib/analytics/hourlyFloor.js, merged 2026-10-05): the same three states
// as the margin beside it, a whole number of hours 1–20,000 — the WHOLE
// crew's together, so not capped at one person's month (the column is Int).
ok("PUT with no hours field: left alone (an older client)", parseBillableHours(undefined).skip === true);
ok("PUT null / '' clears it", parseBillableHours(null).value === null && parseBillableHours("").value === null);
ok("PUT 320 → 320; ' 320 ' → 320", parseBillableHours(320).value === 320 && parseBillableHours(" 320 ").value === 320);
ok("a crew of 20 billing 150 h each (3,000) is accepted; 20,001 is refused", parseBillableHours(3000).value === 3000 && parseBillableHours(20001).error === true);
ok("PUT 0 / negative / 'abc' / NaN / Infinity / 1e9 / 320.5 / true / {} → refused, never clamped",
  [0, -1, "abc", NaN, Infinity, 1e9, 320.5, true, {}, []].every((v) => parseBillableHours(v).error === true));
{
  const schema = source("prisma/schema.prisma");
  ok("ForecastSettings.billableHoursPerMonth Int? is in the schema (nullable — the column production already has)",
    /model ForecastSettings \{[\s\S]*?billableHoursPerMonth\s+Int\?/.test(schema));
  const route = strip(source("app/api/settings/forecast/route.js"));
  ok("the forecast route parses, writes and returns it",
    /parseBillableHours\(body\?\.billableHoursPerMonth\)/.test(route) &&
    /billableHoursPerMonth: billable\.value/.test(route) &&
    /billableHoursPerMonth: row\?\.billableHoursPerMonth \?\? null/.test(route) &&
    /billableHoursPerMonth: saved\.billableHoursPerMonth \?\? null/.test(route));
  const min = strip(source("lib/analytics/minimumPrice.js"));
  ok("calculateMinimumPrice reads it (through billableHoursFrom) and calls calculateHourlyFloor",
    /billableHoursFrom\(forecast\?\.billableHoursPerMonth\)/.test(min) && /await calculateHourlyFloor\(\{ companyId, billableHoursPerMonth: hours, burn \}\)/.test(min));
  const screen = strip(source("app/app/settings/overhead/page.js"));
  ok("Settings → Overhead offers it, sends it, and shows the hourly figures",
    /data-billable-hours/.test(screen) &&
    /billableHoursPerMonth: billableHours === "" \? null : Number\(billableHours\)/.test(screen) &&
    /money\(minPrice\.hourlyFloor\)/.test(screen) && /money\(minPrice\.minimumPerHour\)/.test(screen));
  // Read by the quote: the builder and both server paths, through the one
  // reading of the answer.
  for (const f of ["app/components/quotes/builder/QuoteBuilder.js", "app/api/quotes/costingWrite.js", "lib/costing/quoteCostEstimate.js"]) {
    const s = strip(source(f));
    ok(`${f} reads the rate through overheadInputsFrom and passes overheadPerHour on`,
      /overheadInputsFrom\(/.test(s) && /overheadPerHour/.test(s));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. Every new string in all nine languages\n");

const KEYS = {
  "app.cost.defaultLabour": ["{rate}"],
  "app.cost.assignCrew": [],
  "app.cost.defaultOverhead": ["{pct}"],
  "app.cost.defaultOverheadShare": [],
  "app.cost.setCapacity": [],
  "app.cost.noPayRateFor": ["{name}"],
  "app.cost.setPayRates": [],
  "app.job.quotedCrew": [],
  "app.setOverhead.jobsPerMonthLabel": [],
  "app.setOverhead.capacityUnit": [],
  "app.setOverhead.perWeek": [],
  "app.setOverhead.perMonth": [],
  "app.setup.step.job_capacity": [],
  "app.setup.step.pay_rates": [],
  // The time share (2026-10-04).
  "app.cost.overheadTimeShare": [],
  "app.cost.overheadTimeSource": ["{monthly}", "{capacity}", "{rate}", "{hours}", "{share}"],
  "app.cost.overheadTimeRate": ["{rate}", "{hours}"],
  "app.cost.setBillableHours": [],
  "app.quoteDetail.timeShare": [],
  "app.setOverhead.billableHoursLabel": [],
  "app.setOverhead.billableHoursHelp": [],
  "app.setOverhead.billableHoursPerMonth": [],
  "app.setOverhead.overheadPerHour": [],
  "app.setOverhead.minimumPerHour": [],
  "app.setOverhead.hourlyNote": ["{rate}"],
};
const langs = Object.keys(APP_MESSAGES);
ok("nine language blocks", langs.length === 9, langs);
for (const [key, ph] of Object.entries(KEYS)) {
  const bad = langs.filter((l) => {
    const v = APP_MESSAGES[l][key];
    return typeof v !== "string" || !v.trim() || ph.some((p) => !v.includes(p));
  });
  ok(`${key} in all nine${ph.length ? ` with ${ph.join(" ")}` : ""}`, bad.length === 0, bad);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
