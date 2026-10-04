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
  recordedFiguresProblems,
  recordedMarker,
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

// ── Recorded figures (a past job carried over from another system) ─────────
//
// The figures are the source's, never recomputed — so the only defence
// against a bad source row is this consistency check. Executed against
// hostile payloads: each must be refused with the code that names it.
{
  const day = (s) => new Date(`${s}T00:00:00.000Z`);
  const lines = (amts) => amts.map((a) => ({ description: "Line", quantity: 1, rate: a, amount: a }));
  const doc = { lineItems: lines([4200, 0]), subtotal: 4200, discount: 250, tax: 513.5, total: 4463.5, taxEnabled: true };
  const GOOD_REC = {
    sourceRef: "truefinish:quote:abc",
    acceptedAt: day("2026-04-28"),
    quote: doc,
    invoice: { ...doc, dueDate: day("2026-05-28") },
    payments: [
      { amount: 463.5, method: "cheque", date: day("2026-05-02"), sourceRef: "truefinish:payment:p1" },
      { amount: 4310, method: "cash", date: day("2026-06-18") },
    ],
  };
  const codes = (r) => recordedFiguresProblems(r, { today: TODAY }).map((p) => `${p.field}:${p.code}`);
  ok("a consistent recorded payload passes (overpaid, deposit before the job — both as recorded)", codes(GOOD_REC).length === 0, codes(GOOD_REC));
  ok("an open invoice (no payments) is a valid recorded payload", codes({ ...GOOD_REC, payments: [] }).length === 0);
  const refused = [
    ["no payload", null, "recorded:required"],
    ["a ref with a bracket (would break the marker)", { ...GOOD_REC, sourceRef: "a]b" }, "sourceRef:bad_ref"],
    ["a blank ref", { ...GOOD_REC, sourceRef: " " }, "sourceRef:bad_ref"],
    ["a total that is not subtotal − discount + tax", { ...GOOD_REC, invoice: { ...GOOD_REC.invoice, total: 4463.6 } }, "invoice:total_disagrees"],
    ["lines that do not sum to the subtotal", { ...GOOD_REC, quote: { ...doc, lineItems: lines([4100]) } }, "quote:lines_disagree_with_subtotal"],
    ["tax charged with tax switched off", { ...GOOD_REC, quote: { ...doc, taxEnabled: false } }, "quote:tax_without_tax_enabled"],
    ["an unparseable amount", { ...GOOD_REC, quote: { ...doc, subtotal: "abc" } }, "quote:bad_amount"],
    ["a document with no lines", { ...GOOD_REC, quote: { ...doc, lineItems: [] } }, "quote:no_lines"],
    ["a payment in the future", { ...GOOD_REC, payments: [{ amount: 1, method: "cash", date: day("2027-01-01") }] }, "payments[0]:future"],
    ["a zero payment", { ...GOOD_REC, payments: [{ amount: 0, method: "cash", date: day("2026-01-01") }] }, "payments[0]:not_positive"],
    ["a Stripe payment (FieldQuo never took it)", { ...GOOD_REC, payments: [{ amount: 1, method: "stripe", date: day("2026-01-01") }] }, "payments[0]:unknown_method"],
    ["a payment dated by a string", { ...GOOD_REC, payments: [{ amount: 1, method: "cash", date: "2026-01-01" }] }, "payments[0]:bad_date"],
    ["no acceptance date", { ...GOOD_REC, acceptedAt: null }, "acceptedAt:bad_date"],
  ];
  for (const [label, payload, code] of refused) ok(`a recorded payload with ${label} is refused`, codes(payload).includes(code), codes(payload));
  ok("the marker is the bracketed ref", recordedMarker("truefinish:quote:abc") === "[truefinish:quote:abc]");

  const writer = code("lib/jobs/importPastJob.js");
  ok("the writer checks a recorded payload before opening its transaction",
    writer.indexOf("recordedFiguresProblems(recorded") > -1 && writer.indexOf("recordedFiguresProblems(recorded") < writer.indexOf("db.$transaction"));
  ok("...skips a recorded job whose source marker is already on file, under the lock",
    /costReviewNote: \{ contains: recordedMarker\(recorded\.sourceRef\) \}/.test(writer) && writer.indexOf("recordedMarker(recorded.sourceRef) }") > writer.indexOf("pg_advisory_xact_lock"));
  ok("...and never resolves tax for one", /const rate = recorded\s*\?\s*0/.test(writer));
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
  /BackToHome/.test(code("app/app/jobs/import/PastJobsEntry.js")));
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

// ── A taxed past job committed twice is ONE past job ───────────────────────
//
// Regression, 2026-10-03: the duplicate check keyed rows on the pre-tax
// amount and the rows on file on Invoice.total, so a taxed job never matched
// its own earlier import and a second commit wrote a second quote, job,
// invoice and payment. Executed, not read: the real loadPastJobContext,
// buildPastJobsPreview and createPastJob against an in-memory Prisma stand-in.
{
  // The writer's module graph constructs a Prisma client (lib/db.js); with no
  // URL it has nowhere to connect, so nothing here can reach a database.
  delete process.env.DATABASE_URL;
  const { createPastJob, loadPastJobContext } = await import("../lib/jobs/importPastJob.js");

  const fakeDb = () => {
    let seq = 0;
    const T = { company: [], serviceCategory: [], client: [], quote: [], job: [], invoice: [], payment: [], expense: [] };
    const same = (a, b) => (a instanceof Date || b instanceof Date ? a != null && b != null && new Date(a).getTime() === new Date(b).getTime() : a === b);
    const matches = (row, where = {}) =>
      Object.entries(where).every(([k, v]) => {
        if (k === "OR") return v.some((w) => matches(row, w));
        const val = row[k];
        if (v && typeof v === "object" && !(v instanceof Date)) {
          if ("not" in v && (v.not === null ? val == null : same(val, v.not))) return false;
          if ("contains" in v && !(typeof val === "string" && val.includes(v.contains))) return false;
          if ("equals" in v && String(val).toLowerCase() !== String(v.equals).toLowerCase()) return false;
          if ("in" in v && !v.in.includes(val)) return false;
          return true;
        }
        return v === null ? val == null : same(val, v);
      });
    const withRel = (t, r) => (t === "invoice" ? { ...r, client: T.client.find((c) => c.id === r.clientId), job: T.job.find((j) => j.id === r.jobId) } : { ...r });
    const db = { $executeRaw: async () => 1, $transaction: async (fn) => fn(db), T };
    for (const t of Object.keys(T)) {
      db[t] = {
        findMany: async ({ where } = {}) => T[t].filter((r) => matches(r, where)).map((r) => withRel(t, r)),
        findFirst: async ({ where } = {}) => { const r = T[t].find((x) => matches(x, where)); return r ? withRel(t, r) : null; },
        findUnique: async ({ where } = {}) => { const r = T[t].find((x) => matches(x, where)); return r ? withRel(t, r) : null; },
        create: async ({ data }) => { const { scopeGroups, ...rest } = data; const r = { id: `${t}${++seq}`, version: 1, parentInvoiceId: null, createdAt: new Date(), ...rest }; T[t].push(r); return { ...r }; },
        update: async ({ where, data }) => { const r = T[t].find((x) => matches(x, where)); Object.assign(r, data); return { ...r }; },
      };
    }
    return db;
  };

  const db = fakeDb();
  db.T.company.push({ id: "co1", defaultLanguage: "en", taxRate: 13, autoApplyLocalTax: false, taxMode: "manual", province: "ON", country: "CA", vatRegistered: null, usTaxOverrides: null, taxRates: [] });
  const raw = { ...GOOD, startDate: "2025-06-02", endDate: "2025-06-04", amount: "3200", taxApplied: "yes", paidDate: "2025-06-20" };
  const commit = async () => {
    const context = await loadPastJobContext(db, "co1");
    const preview = buildPastJobsPreview({ rows: [raw], today: TODAY, defaultTaxApplied: true, existingKeys: context.existingKeys, existingInvoiceNumbers: context.existingInvoiceNumbers, existingQuoteNumbers: context.existingQuoteNumbers });
    const result = await createPastJob(db, { companyId: "co1", row: preview.rows[0].value, context, now: TODAY });
    return { preview: preview.rows[0], result };
  };
  const first = await commit();
  ok("a taxed past job is written the first time", first.preview.status === "ok" && first.result.status === "created" && first.result.tax > 0, first.result);
  const second = await commit();
  ok("...the same taxed row a second time is flagged as a duplicate by the preview",
    second.preview.status === "duplicate" && second.preview.duplicateOf === "on_file", second.preview.status);
  ok("...and skipped by the commit, under the lock", second.result.status === "skipped" && second.result.reason === "on_file", second.result);
  ok("...leaving one quote, one job, one invoice, one payment",
    [db.T.quote, db.T.job, db.T.invoice, db.T.payment].every((t) => t.length === 1), [db.T.quote.length, db.T.job.length, db.T.invoice.length, db.T.payment.length]);
  // The same job at a different price is a different job — the fix must not
  // turn the key into "same client, same day".
  const third = await createPastJob(db, {
    companyId: "co1",
    row: normalisePastJob({ ...raw, amount: "3300" }, { today: TODAY, defaultTaxApplied: true }).value,
    context: await loadPastJobContext(db, "co1"),
    now: TODAY,
  });
  ok("...while the same client and dates at another price is still written", third.status === "created", third);
}

console.log(`\ncheck-past-jobs-import: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
