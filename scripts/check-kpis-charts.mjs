// scripts/check-kpis-charts.mjs
//
// The two charts on /app/analytics/kpis, executed against the builders that
// feed them. Both shipped drawing nothing: lib/analytics/receivables.js emits
// `{ month, amount }` and Sparkline reads `{ label, value }`; lib/analytics/
// kpis.js emits `{ jobId, title }` and GanttStrip reads `{ id, label }`. The
// page now maps both (app/app/analytics/kpis/page.js), and this check renders
// the real components with the real builders' output through the page's
// mapping — so a rename on either side fails here, not on a customer's screen.
//
//   npm run check:kpis-charts   (esbuild bundle, like check:auth-pages)
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sparkline from "@/app/components/charts/Sparkline";
import GanttStrip from "@/app/components/charts/GanttStrip";
import { buildRevenueTrend } from "@/lib/analytics/receivables";
import { buildOnTimeCompletion } from "@/lib/analytics/kpis";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => { if (cond) pass++; else { fail++; console.error(`  ✗ ${label}`, extra ?? ""); } };

// The page's two mappings, copied verbatim so the check breaks when they drift.
const page = readFileSync("app/app/analytics/kpis/page.js", "utf8");
const mapSeries = (series) => series.map((s) => ({ label: s.label ?? s.month, value: s.value ?? s.amount, partial: s.partial }));
const mapRows = (rows) => rows.map((j) => ({ ...j, id: j.id ?? j.jobId, label: j.label ?? j.title }));
ok("the page maps month/amount → label/value for the sparkline", /label: s\.label \?\? s\.month/.test(page) && /value: s\.value \?\? s\.amount/.test(page) && /<Sparkline series=\{revenueSeries\}/.test(page));
ok("the page maps jobId/title → id/label for the strip", /id: j\.id \?\? j\.jobId/.test(page) && /label: j\.label \?\? j\.title/.test(page) && /<GanttStrip rows=\{ganttRows\}/.test(page));

const asOf = new Date("2026-09-12T12:00:00Z");
const payments = [];
for (let m = 3; m <= 9; m++) { const d = new Date(Date.UTC(2026, m - 1, 10)); payments.push({ date: d, paidAt: d, receivedAt: d, createdAt: d, amount: 1000 * m }); }
const trend = buildRevenueTrend({ payments, months: 6, asOf });
ok("the builder still emits month/amount (its other callers depend on it)", trend.series.length === 6 && "month" in trend.series[0] && "amount" in trend.series[0]);
const render = (el) => renderToStaticMarkup(el);
const unmapped = render(React.createElement(Sparkline, { series: trend.series, formatValue: String, width: 280, height: 64 }));
ok("unmapped, the sparkline draws nothing (the bug this guards)", /Not enough periods/.test(unmapped));
const mappedSvg = render(React.createElement(Sparkline, { series: mapSeries(trend.series), formatValue: String, width: 280, height: 64 }));
ok("mapped, six months of payments draw a path", /<path/.test(mappedSvg) && !/Not enough periods/.test(mappedSvg));
ok("…and the partial month is still marked", mapSeries(trend.series).at(-1).partial === true);

const jobs = [1, 2, 3].map((i) => ({ id: `job_${i}`, title: `Pelletier kitchen ${i}`, visits: [{ scheduledAt: new Date(Date.UTC(2026, 6, i + 1)) }], completedAt: new Date(Date.UTC(2026, 6, i + 1)) }));
const otc = buildOnTimeCompletion({ jobs });
ok("the builder still emits jobId/title", otc.jobs.length === 3 && "jobId" in otc.jobs[0] && "title" in otc.jobs[0]);
const gUnmapped = render(React.createElement(GanttStrip, { rows: otc.jobs, width: 560 }));
ok("unmapped, every row reads the literal 'Job' (the bug this guards)", (gUnmapped.match(/>Job</g) || []).length === 3);
const gMapped = render(React.createElement(GanttStrip, { rows: mapRows(otc.jobs), width: 560 }));
ok("mapped, the rows carry the job titles and no 'Job' literal", (gMapped.match(/Pelletier kitchen/g) || []).length === 3 && !/>Job</.test(gMapped));

// The guide harness fixture sends the API's shape, not the chart's — a
// fixture that pre-mapped would hide a regression in the page.
const fixture = readFileSync("docs/screens/app-guide/harness/fixtures/routes-money.js", "utf8");
ok("the guide fixture sends jobId/title and month/amount, never id/label or value", /jobId, title, scheduledStart/.test(fixture) && /return \{ month, amount, count/.test(fixture) && !/label: title|value: amount/.test(fixture));

console.log(`check-kpis-charts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
