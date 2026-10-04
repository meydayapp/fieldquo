// scripts/check-historical-rows.mjs
//
//   npm run check:historical-rows
//
// Past jobs typed in through the Past jobs screen (POST /api/jobs/import, and
// the TrueFinish import) are real records of real work — and they are created
// TODAY, carrying dates from last year. Every figure that windows by
// createdAt, or forgets Quote/Job.historicalImportedAt, reads them as this
// month's activity: "Quotes sent this month: 18" for a company that sent two.
//
// EXECUTED, not grepped: each fixed function is run against an in-memory
// database (scripts/fixtures/countingFakeDb.mjs, which actually evaluates the
// where clause) holding live rows plus historical rows created this month but
// dated earlier. Two claims per surface:
//
//   1. with the imports present, the figure is the live figure;
//   2. the SAME call with the imports deleted from the fixture returns an
//      identical result (md5 of the JSON) — so a company with no historical
//      rows sees exactly what it saw, and the import moves nothing.
import { register } from "node:module";
import { createHash } from "node:crypto";
import { countingFakeDb } from "./fixtures/countingFakeDb.mjs";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) pass += 1;
  else failures.push(`${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

// `@/lib/db` → whatever fake the current section installed.
globalThis.__FQ_DB = null;
const HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true, source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

/** Run `fn` against a fake seeded with `seed`; returns { result, calls, writes }. */
async function withDb(seed, fn, opts) {
  const fake = countingFakeDb(seed, opts);
  globalThis.__FQ_DB = fake.db;
  const result = await fn(fake.db);
  return { result, calls: fake.calls, writes: fake.writes };
}
/** The seed with every historical row removed — "a company that never imported". */
function withoutHistory(seed) {
  const out = {};
  for (const [k, rows] of Object.entries(seed)) out[k] = rows.filter((r) => !r.historicalImportedAt);
  return out;
}

// Sunday 4 October 2026, mid-afternoon in Toronto. The imports were typed in
// yesterday; the work they record happened in 2025 and earlier this year.
const NOW = new Date("2026-10-04T18:00:00Z");
const IMPORTED = new Date("2026-10-03T14:00:00Z");
const d = (iso) => new Date(iso);

const COMPANY = { id: "c1", timezone: "America/Toronto", createdAt: d("2025-01-01T00:00:00Z"), revenueGoalAnnual: null, currency: "CAD" };

/** Sixteen past jobs' quotes, created by the import yesterday, accepted on their real dates. */
function importedQuotes(companyId = "c1") {
  const out = [];
  for (let i = 0; i < 16; i += 1) {
    // One of them is dated THIS month (a job finished on the 1st and typed in
    // on the 3rd) — still an import, still never sent from FieldQuo.
    const acceptedAt = i === 0 ? d("2026-10-01T16:00:00Z") : d(`2025-${String((i % 12) + 1).padStart(2, "0")}-15T16:00:00Z`);
    out.push({
      id: `hq${i}`, companyId, status: "accepted", total: 1000 + i * 100, acceptedTotal: 1000 + i * 100,
      createdAt: IMPORTED, sentAt: null, acceptedAt, declinedAt: null, archivedAt: null,
      historicalImportedAt: IMPORTED,
    });
  }
  return out;
}

const LIVE_QUOTES = [
  // Two sent this month, one of them accepted.
  { id: "q1", companyId: "c1", status: "accepted", total: 2400, acceptedTotal: 2400, createdAt: d("2026-10-01T15:00:00Z"), sentAt: d("2026-10-02T15:00:00Z"), acceptedAt: d("2026-10-03T15:00:00Z"), declinedAt: null, archivedAt: null, historicalImportedAt: null },
  { id: "q2", companyId: "c1", status: "sent", total: 1800, createdAt: d("2026-10-02T15:00:00Z"), sentAt: d("2026-10-03T15:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Sent at 10 pm on 30 September in Toronto — 02:00 on 1 October in UTC.
  // The company's September, whatever the server's clock says.
  { id: "q3", companyId: "c1", status: "sent", total: 900, createdAt: d("2026-09-30T20:00:00Z"), sentAt: d("2026-10-01T02:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Last month: sent and declined.
  { id: "q4", companyId: "c1", status: "declined", total: 3100, createdAt: d("2026-09-10T15:00:00Z"), sentAt: d("2026-09-10T16:00:00Z"), acceptedAt: null, declinedAt: d("2026-09-20T15:00:00Z"), archivedAt: null, historicalImportedAt: null },
  // A draft this month: created, never sent.
  { id: "q5", companyId: "c1", status: "draft", total: 500, createdAt: d("2026-10-04T12:00:00Z"), sentAt: null, acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
  // Another tenant's quote, sent this month — never counted.
  { id: "x1", companyId: "c2", status: "sent", total: 9999, createdAt: d("2026-10-02T15:00:00Z"), sentAt: d("2026-10-02T15:00:00Z"), acceptedAt: null, declinedAt: null, archivedAt: null, historicalImportedAt: null },
];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. lib/analytics/overview.js — the dashboard tiles, the monthly summary, the AI digest\n");
{
  const { getAnalyticsOverview } = await import("@/lib/analytics/overview");
  const seed = {
    company: [COMPANY],
    quote: [...LIVE_QUOTES, ...importedQuotes()],
    invoice: [],
    expense: [],
  };
  const run = (s) => withDb(s, () => getAnalyticsOverview({ companyId: "c1", now: NOW }));
  const { result: o, writes } = await run(seed);
  ok("quotes sent this month counts the two that were sent, not the sixteen imports", o.quotesSent === 2, o.quotesSent);
  ok("...dated by sentAt in the company's month: 10 pm on 30 Sept in Toronto is September", o.priorQuotesSent === 2, o.priorQuotesSent);
  ok("quotes accepted this month is the one live acceptance, not the import dated the 1st", o.quotesAccepted === 1, o.quotesAccepted);
  ok("conversion is 1 of 2, not 1 of 18", o.conversionRate === 0.5, o.conversionRate);
  ok("quotes created this month excludes imports (q1, q2 and the draft)", o.quotesCreated === 3, o.quotesCreated);
  ok("last month's conversion: 0 of 2", o.priorConversionRate === 0, o.priorConversionRate);
  ok("the overview writes nothing", writes.length === 0);
  const { result: bare } = await run(withoutHistory(seed));
  ok("a company with no historical rows sees an identical overview (md5)", md5(o) === md5(bare), [md5(o), md5(bare)]);

  // The monthly summary email asks about the month it reports by handing
  // overview the 15th at noon UTC (lib/analytics/monthlySummaryData.js) —
  // inside that month in every zone a company can pick, so the company-zone
  // windows still land on the month being reported.
  const { result: sept } = await withDb(seed, () => getAnalyticsOverview({ companyId: "c1", now: d("2026-09-15T12:00:00Z") }));
  ok("the summary's September: two sent (incl. 10 pm on the 30th), none accepted, no imports", sept.quotesSent === 2 && sept.quotesAccepted === 0, [sept.quotesSent, sept.quotesAccepted]);
}

// ═══════════════════════════════════════════════════════════════════════════
if (failures.length) {
  console.error(`\n✗ ${failures.length} failed, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\n✓ check:historical-rows — ${pass} passed\n`);
