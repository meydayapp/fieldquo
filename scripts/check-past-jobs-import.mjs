// scripts/check-past-jobs-import.mjs
//
//   npm run check:past-jobs-import
//
// Past jobs are DATA ENTRY. A company typing in the year it already worked
// must not, by doing so, email a single one of those homeowners — no invoice,
// no receipt, no review request, no overdue chase, no follow-up rule. That is
// the whole feature, and it is the kind of promise that breaks silently: a
// cron added six months from now iterates invoices, forgets the flag, and a
// homeowner gets chased for a job they paid for in 2024.
//
// So this file does two different jobs. It EXECUTES the row parser against
// hostile input (that is where the refusals live), and it PINS the guard at
// every site that reaches a client — the three crons, the two lifecycles, the
// payment-schedule runner, the send and chase routes — plus the notes and
// hidden buttons on the three detail pages.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_PAST_JOB_ROWS,
  PAST_JOB_COLUMNS,
  normalisePastJob,
  buildPastJobsPreview,
  pastJobNaturalKey,
  parsePastJobsCsv,
  pastJobsCsvTemplate,
  parseYesNo,
  isoDay,
} from "../lib/jobs/pastJobImport.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 200));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Comments explain the rule; only code may satisfy a pin.
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("///") && !l.trim().startsWith("*")).join("\n");
const has = (p) => fs.existsSync(path.join(ROOT, p));

const TODAY = new Date("2026-09-08T12:00:00Z");
const GOOD = {
  clientName: "Marie Tremblay",
  clientEmail: "marie@example.com",
  description: "Repainted the kitchen and hallway",
  startDate: "2025-06-02",
  endDate: "2025-06-04",
  amount: "3200",
  taxApplied: "yes",
  paidDate: "2025-06-20",
  paymentMethod: "cheque",
};
const norm = (patch) => normalisePastJob({ ...GOOD, ...patch }, { today: TODAY, defaultTaxApplied: true });
const codesOf = (r) => r.errors.map((e) => `${e.field}:${e.code}`);

// ── The row parser, executed ───────────────────────────────────────────────
{
  const r = norm({});
  ok("a complete past job is accepted", r.ok, codesOf(r));
  ok("...keeping the amount as typed", r.value.amount === 3200, r.value.amount);
  ok("...and both real dates", isoDay(r.value.startDate) === "2025-06-02" && isoDay(r.value.paidDate) === "2025-06-20");
}
ok("a payment dated tomorrow is refused", codesOf(norm({ paidDate: "2026-09-09" })).includes("paidDate:future"));
ok("...but a payment dated today is not (it is a past payment)", !codesOf(norm({ paidDate: "2026-09-08" })).includes("paidDate:future"));
ok("paid before the work started is refused", codesOf(norm({ paidDate: "2025-06-01" })).includes("paidDate:before_start"));
ok("an end before the start is refused", codesOf(norm({ endDate: "2025-06-01" })).includes("endDate:end_before_start"));
ok("a missing end means a one-day job, not an open one",
  isoDay(norm({ endDate: "" }).value.endDate) === "2025-06-02");
ok("a zero amount is refused", codesOf(norm({ amount: "0" })).includes("amount:not_positive"));
ok("a negative amount is refused", codesOf(norm({ amount: "-500" })).includes("amount:not_positive"));
ok("a non-amount is refused", codesOf(norm({ amount: "three thousand" })).includes("amount:bad_amount"));
ok("a bad email is refused rather than stored", codesOf(norm({ clientEmail: "marie@@example" })).includes("clientEmail:bad_email"));
ok("no client at all is refused", codesOf(norm({ clientName: "", clientId: "" })).includes("clientName:required"));
ok("an empty description is refused", codesOf(norm({ description: "" })).includes("description:required"));
ok("an unknown payment method is refused", codesOf(norm({ paymentMethod: "crypto" })).includes("paymentMethod:unknown_method"));
ok("a payment method is required", codesOf(norm({ paymentMethod: "" })).includes("paymentMethod:required"));
ok("'e-transfer' and 'E Transfer' reach the same method",
  norm({ paymentMethod: "e-transfer" }).value.paymentMethod === norm({ paymentMethod: "E Transfer" }).value.paymentMethod);
ok("yes/no is read, not guessed", parseYesNo("yes") === true && parseYesNo("no") === false && parseYesNo("maybe") === undefined);
ok("an absent tax answer falls to the company's own default, both ways",
  norm({ taxApplied: "" }).value.taxApplied === true &&
  normalisePastJob({ ...GOOD, taxApplied: "" }, { today: TODAY, defaultTaxApplied: false }).value.taxApplied === false);
// Numbering: a typed number must never look like one the live allocator owns.
ok("a live-format quote number is refused", codesOf(norm({ quoteNumber: "Q-2026-0011" })).includes("quoteNumber:live_format"));
ok("a live-format invoice number is refused", codesOf(norm({ invoiceNumber: "INV-2026-0007" })).includes("invoiceNumber:live_format"));
ok("...while the company's own old numbering is kept", norm({ quoteNumber: "2024-114" }).ok);

// ── The batch: idempotency and collisions ──────────────────────────────────
{
  const key = pastJobNaturalKey({ clientName: "Marie Tremblay", startDate: new Date("2025-06-02T00:00:00Z"), amount: 3200, paidDate: new Date("2025-06-20T00:00:00Z") });
  ok("the natural key ignores case and spacing in the name",
    key === pastJobNaturalKey({ clientName: "  marie   tremblay ", startDate: new Date("2025-06-02T00:00:00Z"), amount: 3200, paidDate: new Date("2025-06-20T00:00:00Z") }));
  ok("...and separates two different amounts",
    key !== pastJobNaturalKey({ clientName: "Marie Tremblay", startDate: new Date("2025-06-02T00:00:00Z"), amount: 3201, paidDate: new Date("2025-06-20T00:00:00Z") }));

  const already = buildPastJobsPreview({ rows: [GOOD], today: TODAY, defaultTaxApplied: true, existingKeys: new Set([key]) });
  ok("a row already imported is reported, not written twice", already.rows[0].status === "duplicate", already.rows[0].status);

  const twice = buildPastJobsPreview({ rows: [GOOD, { ...GOOD }], today: TODAY, defaultTaxApplied: true });
  ok("the same job typed twice in ONE file is caught inside the batch",
    twice.rows[0].status === "ok" && twice.rows[1].status === "duplicate", twice.rows.map((r) => r.status));

  const clash = buildPastJobsPreview({
    rows: [{ ...GOOD, invoiceNumber: "2024-88" }],
    today: TODAY, defaultTaxApplied: true,
    existingInvoiceNumbers: new Set(["2024-88"]),
  });
  ok("an invoice number the company already uses is refused",
    clash.rows[0].status !== "ok", clash.rows[0].status);

  const big = buildPastJobsPreview({ rows: new Array(MAX_PAST_JOB_ROWS + 5).fill(GOOD), today: TODAY, defaultTaxApplied: true });
  ok("an oversized file is truncated and says so", big.summary.truncated === true && big.rows.length === MAX_PAST_JOB_ROWS,
    { t: big.summary.truncated, n: big.rows.length });
}

// ── CSV: the template is importable by its own parser ──────────────────────
{
  const template = pastJobsCsvTemplate();
  const parsed = parsePastJobsCsv(template);
  // The template is the instructions. A template its own parser rejects is
  // the dead control this file exists to catch.
  ok("the downloadable template parses with the parser that reads uploads",
    Array.isArray(parsed?.rows) && !parsed.error, parsed?.error || parsed?.missingHeaders);
  for (const col of PAST_JOB_COLUMNS) {
    ok(`the template names the "${col.header}" column`, template.includes(col.header));
  }
  // Every required column named, so a missing one is reported rather than
  // silently importing a row with a hole in it.
  {
    const required = PAST_JOB_COLUMNS.filter((c) => c.required).map((c) => c.header);
    const short = parsePastJobsCsv("client_name,description\nMarie,Kitchen\n");
    ok("a file missing required columns is refused, and says which",
      short.error === "missing_columns" && required.some((h) => short.missingHeaders.includes(h)), short.missingHeaders);
  }
  {
    const header = PAST_JOB_COLUMNS.map((c) => c.header).join(",");
    const row = PAST_JOB_COLUMNS.map((c) => (c.header === "client_name" ? '"Tremblay, Marie"' : c.example ?? "")).join(",");
    const quoted = parsePastJobsCsv(`${header}\n${row}\n`);
    ok("a CSV with a quoted comma keeps one field",
      quoted.rows?.[0]?.clientName === "Tremblay, Marie", quoted.error || quoted.rows?.[0]?.clientName);
  }
}

// ── Nothing in the writer can send ─────────────────────────────────────────
{
  const writer = code("lib/jobs/importPastJob.js");
  ok("the writer imports no mailer, no SMS, no task raiser",
    !/from "@\/lib\/email\//.test(writer) && !/from "@\/lib\/sms\//.test(writer) && !/taskFor[A-Z]/.test(writer),
    writer.match(/from "@\/lib\/(email|sms)\/[^"]+"/g));
  ok("...and stamps the historical flag on all three records",
    (writer.match(/historicalImportedAt/g) || []).length >= 3);
  ok("...writing each job in one transaction", /\$transaction/.test(writer));

  const route = code("app/api/jobs/import/route.js");
  ok("the route proves the member before anything else", /memberOrRefusal\(request\)/.test(route));
  ok("...gates on the level quotes, invoices and jobs each ask for", /pastJobsGate\(member\)/.test(route));
  ok("...guards request.json() so a truncated body is a 400, not a 500", /catch \{[\s\S]{0,120}status: 400/.test(route));
  ok("...and caps the batch", new RegExp(`MAX_PAST_JOB_ROWS`).test(route));
}

// ── The guard at every site that could reach a client ──────────────────────
const GUARDED = [
  ["app/api/cron/review-requests/route.js", "the review-request cron"],
  ["app/api/cron/follow-ups/route.js", "the follow-up cron"],
  ["app/api/cron/large-quote-check/route.js", "the large-quote cron"],
  ["lib/paymentSchedule/run.js", "the payment-schedule runner"],
  ["lib/invoices/lifecycle.js", "the invoice lifecycle"],
  ["lib/quotes/quoteLifecycle.js", "the quote lifecycle"],
  ["app/api/invoices/[id]/send/route.js", "sending an invoice"],
  ["app/api/invoices/[id]/request-payment/route.js", "chasing an invoice"],
];
for (const [file, label] of GUARDED) {
  ok(`${label} skips a past job`, /historicalImportedAt/.test(code(file)), file);
}

// ── The screens: a note, and no button that would write to a homeowner ─────
{
  const invoice = code("app/app/invoices/[id]/page.js");
  ok("the invoice says it was entered as a past job", /data-historical-note/.test(invoice));
  ok("...and hides both the send and the chase on it",
    (invoice.match(/&& !historical/g) || []).length >= 2, (invoice.match(/&& !historical/g) || []).length);

  const quote = code("app/app/quotes/[id]/page.js");
  ok("the quote says so too", /data-historical-note/.test(quote));
  ok("...and hides every send on it", (quote.match(/!quote\.historicalImportedAt/g) || []).length >= 3);

  const job = code("app/app/jobs/[id]/JobDetail.js");
  ok("the job says so", /data-historical-note/.test(job));
}

// ── The way back, and the dashboard step that points here ──────────────────
ok("the Past jobs screen exists where the set-up step links", has("app/app/jobs/import/page.js"));
ok("...and offers the way back when arrived at from the dashboard",
  /BackToHome/.test(code("app/app/jobs/import/page.js")));
{
  const back = code("app/components/BackToHome.js");
  ok("the back link only appears when it was arrived at from the dashboard",
    /params\?\.get\(BACK_TO_HOME_PARAM\) === BACK_TO_HOME_VALUE/.test(back));
}

// ── Reports count a past job by its real dates ─────────────────────────────
{
  const schema = read("prisma/schema.prisma");
  for (const model of ["Quote", "Job", "Invoice"]) {
    const block = schema.split(`model ${model} {`)[1]?.split("\nmodel ")[0] || "";
    ok(`${model} carries historicalImportedAt`, /historicalImportedAt\s+DateTime\?/.test(block));
  }
}

console.log(`\ncheck-past-jobs-import: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
