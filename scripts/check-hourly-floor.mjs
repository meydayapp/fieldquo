// scripts/check-hourly-floor.mjs
//
//   npm run check:hourly-floor
//   node --import ./scripts/alias-loader.mjs scripts/check-hourly-floor.mjs
//
// The hourly price floor reaches the quote builder (owner, 2026-10-03):
// calculateHourlyFloor had no caller, so work billed by the hour could be
// quoted below cost in silence. Executed against hostile input:
//
//   A. The arithmetic — the pure formula calculateHourlyFloor now runs.
//   B. The billable-hours answer: parsed, never defaulted.
//   C. The quote check: hourly lines only, averaged, warns and never blocks.
//   D. The wiring: column, settings, route, builder, words.
import { readFileSync, existsSync } from "node:fs";
import {
  hourlyFloorFromCost,
  billableHoursFrom,
  parseBillableHours,
  checkHourlyFloor,
  hasHourlyLine,
  MAX_BILLABLE_HOURS_PER_MONTH,
} from "@/lib/analytics/hourlyFloor";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? pass++ : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)?.slice(0, 300)}` : ""}`);
const section = (s) => console.log(`\n${s}`);
const src = (p) => readFileSync(p, "utf8");

/* ══ A ══ */
section("A. The arithmetic");
{
  const f = hourlyFloorFromCost({ totalMonthlyCost: 4141.4, billableHoursPerMonth: 100 });
  ok("$4,141.40 a month over 100 billable hours is $41.41 an hour", f.hourlyFloor === 41.41 && f.monthlyFixedCosts === 4141.4 && f.perCleanerRate === 41.41, f);
  ok("profit defaults to 0 and crew to 1", f.desiredMonthlyProfit === 0 && f.crewSize === 1);
  ok("a profit is added before dividing", hourlyFloorFromCost({ totalMonthlyCost: 1000, billableHoursPerMonth: 100, desiredMonthlyProfit: 500 }).hourlyFloor === 15);
  ok("a negative profit is 0, not a discount", hourlyFloorFromCost({ totalMonthlyCost: 1000, billableHoursPerMonth: 100, desiredMonthlyProfit: -900 }).hourlyFloor === 10);
  ok("crew 2: the per-person rate halves", hourlyFloorFromCost({ totalMonthlyCost: 1000, billableHoursPerMonth: 100, crewSize: 2 }).perCleanerRate === 5);
  ok("crew 0 / junk is 1", hourlyFloorFromCost({ totalMonthlyCost: 1000, billableHoursPerMonth: 100, crewSize: "x" }).crewSize === 1);
  for (const h of [0, -5, NaN, "abc", null, undefined]) {
    ok(`hours ${JSON.stringify(h)}: no floor (null), never a division by zero`, hourlyFloorFromCost({ totalMonthlyCost: 1000, billableHoursPerMonth: h }) === null);
  }
  ok("junk cost is 0, never NaN", hourlyFloorFromCost({ totalMonthlyCost: "x", billableHoursPerMonth: 10 }).hourlyFloor === 0);
  ok("huge cost stays finite", Number.isFinite(hourlyFloorFromCost({ totalMonthlyCost: 1e15, billableHoursPerMonth: 1 }).hourlyFloor));
  const mp = src("lib/analytics/minimumPrice.js");
  ok("calculateHourlyFloor runs this formula (one copy)", /return hourlyFloorFromCost\(\{/.test(mp) && !/const hourlyFloor = \(burn\.totalMonthlyCost \+ profit\) \/ hours/.test(mp));
  ok("…and still refuses with needsHours before it", /needsHours: true/.test(mp));
}

/* ══ B ══ */
section("B. Billable hours — the owner's answer, never a default");
for (const v of [null, undefined, "", 0, -1, NaN, "x", 20001, 1e9]) {
  ok(`stored ${JSON.stringify(v)} reads as not said`, billableHoursFrom(v) === null);
}
ok("160 reads as 160", billableHoursFrom(160) === 160 && billableHoursFrom("160") === 160);
// The figure is the whole crew's together, so it is not capped at one
// person's month: a crew of five billing full time is past 744.
ok("the whole crew's hours: up to 20,000 a month", MAX_BILLABLE_HOURS_PER_MONTH === 20000 && billableHoursFrom(20000) === 20000 && billableHoursFrom(20001) === null);
ok("a crew's 3,000 hours is accepted; 20,001 is refused", parseBillableHours(3000).value === 3000 && parseBillableHours("3000").value === 3000 && parseBillableHours(20001).error === true);
ok("absent in the PUT: leave the column", parseBillableHours(undefined).skip === true);
ok("null / \"\": clear it", parseBillableHours(null).value === null && parseBillableHours("").value === null);
ok("\" 120 \": 120", parseBillableHours(" 120 ").value === 120);
for (const v of [0, -3, 1.5, "abc", 20001, true, {}, []]) {
  ok(`PUT ${JSON.stringify(v)}: refused, not clamped`, parseBillableHours(v).error === true);
}

/* ══ C ══ */
section("C. The quote check");
{
  const lines = [
    { description: "Labour", quantity: 6, unit: "hour", rate: 40, amount: 240 },
    { description: "Parts", quantity: 1, unit: "flat", rate: 300, amount: 300 },
  ];
  const c = checkHourlyFloor(lines, 55);
  ok("only the hourly line counts: 6 h at $40 against $55 → below, $90 short", c.hours === 6 && c.rate === 40 && c.below === true && c.gapPerHour === 15 && c.gapTotal === 90, c);
  ok("a $40 helper hour beside a $120 lead hour is judged on the average ($80)", checkHourlyFloor([{ quantity: 1, unit: "hr", rate: 40, amount: 40 }, { quantity: 1, unit: "hours", rate: 120, amount: 120 }], 55).below === false);
  ok("exactly at the floor is not below", checkHourlyFloor([{ quantity: 2, unit: "hour", rate: 55, amount: 110 }], 55).below === false);
  ok("every spelling of an hour counts (hr, hrs, h, heure, hora)", ["hr", "hrs", "h", "heure", "hora", " Hour "].every((u) => checkHourlyFloor([{ quantity: 1, unit: u, rate: 10, amount: 10 }], 55)?.below === true));
  ok("no hourly line: no check", checkHourlyFloor([{ quantity: 1, unit: "door", rate: 150, amount: 150 }], 55) === null);
  ok("no floor (0, null, junk): no check", [0, null, "x", -10].every((f) => checkHourlyFloor(lines, f) === null));
  ok("zero / negative / junk quantities count nowhere", checkHourlyFloor([{ quantity: 0, unit: "hour", rate: 1 }, { quantity: -3, unit: "hour", rate: 1 }, { quantity: "x", unit: "hour", rate: 1 }], 55) === null);
  ok("a line without an amount is quantity × rate", checkHourlyFloor([{ quantity: 4, unit: "hour", rate: 30 }], 55).amount === 120);
  ok("junk lines are skipped, not thrown on", checkHourlyFloor([null, 7, "x", { unit: "hour" }, ...lines], 55).hours === 6);
  ok("a million hours stays finite", Number.isFinite(checkHourlyFloor([{ quantity: 1e6, unit: "hour", rate: 1e3 }], 55).amount));
  ok("hasHourlyLine", hasHourlyLine(lines) && !hasHourlyLine([{ quantity: 1, unit: "flat" }]) && !hasHourlyLine(null));
  ok("the check returns figures, never a changed line", JSON.stringify(lines) === JSON.stringify([
    { description: "Labour", quantity: 6, unit: "hour", rate: 40, amount: 240 },
    { description: "Parts", quantity: 1, unit: "flat", rate: 300, amount: 300 },
  ]));
}

/* ══ D ══ */
section("D. Wiring");
{
  const schema = src("prisma/schema.prisma");
  const block = schema.slice(schema.indexOf("model ForecastSettings {"), schema.indexOf("}", schema.indexOf("model ForecastSettings {")));
  ok("ForecastSettings.billableHoursPerMonth Int? (additive, nullable)", /billableHoursPerMonth Int\?/.test(block));
  const fr = src("app/api/settings/forecast/route.js");
  ok("the settings route WRITES it (create and update) and READS it back", (fr.match(/\.\.\.billableWrite/g) || []).length === 2 && /billableHoursPerMonth: row\?\.billableHoursPerMonth/.test(fr) && /parseBillableHours\(body\?\.billableHoursPerMonth\)/.test(fr));
  const route = "app/api/analytics/hourly-floor/route.js";
  ok("the hourly-floor route exists", existsSync(route));
  const r = src(route);
  ok("…gated like minimum-price (cost basis: showPricing + jobCosting)", /requireCostBasisRead\(full, "minimumPrice"\)/.test(r));
  ok("…reads the stored hours and calls calculateHourlyFloor at profit 0, crew 1", /billableHoursFrom\(forecast\?\.billableHoursPerMonth\)/.test(r) && /calculateHourlyFloor\(/.test(r) && /desiredMonthlyProfit: 0/.test(r) && /crewSize: 1/.test(r));
  ok("…and answers 400 needsHours rather than inventing hours", /needsHours: true/.test(r));
  const overhead = src("app/app/settings/overhead/page.js");
  ok("Settings → Overhead asks for the hours and saves them", /data-billable-hours/.test(overhead) && /billableHoursPerMonth: billableHours === "" \? null : Number\(billableHours\)/.test(overhead));
  ok("…and shows the floor it makes", /\/api\/analytics\/hourly-floor/.test(overhead) && /data-hourly-floor-figure/.test(overhead));
  const qb = src("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder fetches the floor", /fetch\("\/api\/analytics\/hourly-floor"\)/.test(qb));
  ok("…checks the lines the save would store", /buildScopeGroupPayload\(g, rateOverridesFor\(g\.categoryId\)/.test(qb) && /checkHourlyFloor\(quoteLinesForFloor/.test(qb));
  ok("…renders the warning beside Cost & margin, for the same audience", /<HourlyFloorNotice/.test(qb) && /\{mayCost && \(\s*<HourlyFloorNotice/.test(qb));
  const notice = src("app/components/quotes/builder/HourlyFloorNotice.js");
  ok("the warning names every input and the default, and says it does not block", /app\.hourlyFloor\.inputs/.test(notice) && /app\.hourlyFloor\.notBlocked/.test(notice) && /app\.hourlyFloor\.needsHours/.test(notice));
  ok("…and touches no price (no setter, no onChange)", !/set[A-Z]\w*\(|onChange|onPricingChange/.test(notice));
  const keys = ["app.hourlyFloor.needsHours", "app.hourlyFloor.setHours", "app.hourlyFloor.inputs", "app.hourlyFloor.ok", "app.hourlyFloor.below", "app.hourlyFloor.notBlocked", "app.setOverhead.billableHours", "app.setOverhead.hourlyFloor", "app.setOverhead.hourlyFloorNeedsHours"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: every hourly-floor string`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k]), keys.filter((k) => !APP_MESSAGES[lang][k]));
    ok(`${lang}: placeholders kept`, ["{rate}", "{floor}", "{gap}", "{hours}"].every((p) => APP_MESSAGES[lang]["app.hourlyFloor.below"].includes(p)) && ["{monthly}", "{hours}"].every((p) => APP_MESSAGES[lang]["app.hourlyFloor.inputs"].includes(p)));
  }
}

console.log(`\ncheck-hourly-floor: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
