// scripts/check-report-dates.mjs
//
// The report-date fixes of 2026-09-06, held in place.
//
// Four surfaces disagreed with each other about WHEN things happened, and the
// disagreements were all the same mistake wearing different clothes: an
// instant used where a calendar day was meant, or an edit timestamp used where
// an event timestamp was meant.
//
//   1. lib/analytics/dayRange.js — the one place a "YYYY-MM-DD" becomes the
//      two instants of a Prisma filter. Executed here against hostile input.
//   2. /api/expenses and /api/marketing-spend — `lte: new Date(to)` was the
//      FIRST instant of the last day, so the last day was silently dropped.
//   3. lib/analytics/overview.js and the KPI route — "paid this month" was
//      `updatedAt`, so any edit to a paid invoice moved its revenue.
//   4. The marketing-spend table rendered UTC-midnight dates through
//      toLocaleDateString: a day early west of Greenwich.
//   5. lib/accounting/statements.js counted drafts as issued.
//   6. Win/loss dropped quotes accepted or declined without a send date.
//
// 1 is executed; 2–6 are pinned by reading the files, because each is a
// one-line regression that a future "tidy-up" would reintroduce without
// noticing. (The behavioural halves of 5 and 6 are executed in
// check-statements.mjs and check-win-loss.mjs.)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dayStartUtc, dayEndUtc, dayRangeUtc } from "../lib/analytics/dayRange.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

// ── 1. The helper, executed ─────────────────────────────────────────────────
ok("a bare day starts at 00:00:00.000Z", iso(dayStartUtc("2026-03-31")) === "2026-03-31T00:00:00.000Z", iso(dayStartUtc("2026-03-31")));
ok("a bare day ENDS at 23:59:59.999Z — the whole point", iso(dayEndUtc("2026-03-31")) === "2026-03-31T23:59:59.999Z", iso(dayEndUtc("2026-03-31")));
ok("surrounding whitespace is not a different date", iso(dayEndUtc("  2026-03-31 ")) === "2026-03-31T23:59:59.999Z");
ok("a full instant is taken as given, not rounded to its day", iso(dayEndUtc("2026-03-31T10:00:00.000Z")) === "2026-03-31T10:00:00.000Z");
ok("a Date object is taken as given", (() => { const d = new Date("2026-03-31T10:00:00.000Z"); return dayEndUtc(d) === d; })());
ok("an invalid Date is null, not 'Invalid Date'", dayEndUtc(new Date("nonsense")) === null);
ok("empty is null", dayStartUtc("") === null && dayStartUtc(null) === null && dayStartUtc(undefined) === null);
ok("garbage is null", dayStartUtc("garbage") === null && dayStartUtc("31/03/2026") === null);
ok("a non-padded day is REFUSED rather than parsed as local midnight",
  dayStartUtc("2026-3-1") === null && dayStartUtc("March 1 2026") === null);
ok("a range covers both whole days",
  (() => { const r = dayRangeUtc("2026-03-01", "2026-03-31"); return iso(r?.gte) === "2026-03-01T00:00:00.000Z" && iso(r?.lte) === "2026-03-31T23:59:59.999Z"; })());
ok("a one-day range is the whole of that day",
  (() => { const r = dayRangeUtc("2026-03-05", "2026-03-05"); return iso(r?.gte) === "2026-03-05T00:00:00.000Z" && iso(r?.lte) === "2026-03-05T23:59:59.999Z"; })());
ok("a backwards range is null, not an empty filter", dayRangeUtc("2026-03-31", "2026-03-01") === null);
ok("one bad end makes the WHOLE range null — never a half-open guess",
  dayRangeUtc("2026-03-01", "soon") === null && dayRangeUtc(undefined, "2026-03-31") === null);
ok("a row stamped at 12:00 on the last day is inside the range",
  (() => { const r = dayRangeUtc("2026-03-01", "2026-03-31"); const t = Date.parse("2026-03-31T12:00:00Z"); return t >= r.gte.getTime() && t <= r.lte.getTime(); })());

// ── 2. The two routes that dropped the last day ─────────────────────────────
// Code lines only: each route's comment quotes the old `lte: new Date(to)` to
// say why it is gone, and a pin that read prose would fail on its own
// explanation.
const codeOnly = (src) => src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
for (const file of ["app/api/expenses/route.js", "app/api/marketing-spend/route.js"]) {
  const src = codeOnly(read(file));
  ok(`${file} builds its date filter through dayRangeUtc`, /dayRangeUtc\(from,\s*to\)/.test(src) && /import \{ dayRangeUtc \} from "@\/lib\/analytics\/dayRange"/.test(src));
  ok(`${file} no longer uses the first instant of the last day as its end`, !/lte:\s*new Date\(to\)/.test(src));
  ok(`${file} drops the filter when the range is unreadable, rather than matching nothing`, /\.\.\.\(range && \{ date: range \}\)/.test(src));
}

// ── 3. Paid revenue by the date it was paid ─────────────────────────────────
{
  const overview = read("lib/analytics/overview.js");
  // Filters, not prose: the comments explaining the change name `updatedAt`.
  ok("overview.js never FILTERS by updatedAt", !/updatedAt:\s*\{/.test(overview));
  ok("overview.js dates paid revenue by paidDate — this month, year to date, last month",
    (overview.match(/status: "paid", paidDate: \{|status: "paid",\s*\n\s*paidDate: \{/g) || []).length === 3,
    (overview.match(/paidDate: \{/g) || []).length);
  ok("overview.js dates accepted quotes by acceptedAt — this month and last", (overview.match(/acceptedAt: \{/g) || []).length === 2);
  const kpis = read("app/api/analytics/kpis/route.js");
  ok("the KPI route's cash-revenue card uses paidDate, matching overview", /status: "paid", paidDate: \{ gte, lte \}/.test(kpis));
  ok("...and no paid-invoice filter in it dates by updatedAt", !/status: "paid",\s*updatedAt:\s*\{/.test(kpis));
}

// ── 4. The spend table reads the UTC day ────────────────────────────────────
{
  const page = read("app/app/marketing/spend/page.js");
  ok("the spend table renders entry dates with formatDateOnly", /formatDateOnly\(entry\.date\)/.test(page) && /import \{ formatDateOnly \} from "@\/lib\/format\/companyDate"/.test(page));
  ok("...and not through the browser's zone", !/new Date\(entry\.date\)\.toLocaleDateString\(\)/.test(page));
  ok("the form's default date is the user's calendar day, not UTC's", !/const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(page) && /now\.getDate\(\)/.test(page));
}

// ── 5. Statements: a draft is not issued ────────────────────────────────────
{
  const st = read("lib/accounting/statements.js");
  ok("statements gate issuedIn on isIssued()", /const issuedIn = families\.filter\(\(f\) => isIssued\(f\) && inRange\(issueOf\(f\)\.key, fromKey, toKey\)\)/.test(st));
  ok("...which excludes draft and cancelled by the LATEST version's status", /fam\.latest\?\.status;[\s\S]{0,120}s !== "draft" && s !== "cancelled"/.test(st));
}

// ── 6. Win/loss: a decision date places a quote ─────────────────────────────
{
  const lib = read("lib/analytics/winLoss.js");
  ok("an opportunity is dated by its send, else its decision", /const datedAt = sentAt \|\| decidedAt \|\| null;/.test(lib));
  ok("...and period membership reads datedAt, not sentAt", /o\.datedAt && o\.datedAt\.getTime\(\) >= startTs/.test(lib) && !/o\.sentAt && o\.sentAt\.getTime\(\) >= startTs/.test(lib));
  ok("...while time-to-decision still requires a real sentAt", /if \(!o\.sentAt \|\| !o\.decidedAt\)/.test(lib));
  ok("...and the report says how many were placed by decision", /code: "dated_by_decision"/.test(lib));
  const route = read("app/api/analytics/win-loss/route.js");
  ok("the route fetches by send date OR (unsent) decision date", /\{ sentAt: null, acceptedAt: \{ gte, lte \} \}/.test(route) && /\{ sentAt: null, declinedAt: \{ gte, lte \} \}/.test(route));
  ok("...and 'undated' means no date of any kind", /sentAt: null,\s*acceptedAt: null,\s*declinedAt: null,/.test(route));
  const page = read("app/app/analytics/win-loss/page.js");
  ok("the page no longer calls a decided quote 'left draft'", !/left draft without a send date/.test(page));
  ok("...and tells the reader how many were placed by decision", /app\.winLoss\.datedByDecision/.test(page));
}

console.log(`\ncheck-report-dates: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
