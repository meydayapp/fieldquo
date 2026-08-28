// scripts/check-accounting-export.mjs
//
// The bookkeeping export, driven against the things that actually go wrong in
// an accounting file.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-accounting-export.mjs
//
// ══ Why this file is longer than the module it tests ═══════════════════════
//
// Every other export in this repo is read by a human who knows the business.
// This one is read by somebody who does NOT — a bookkeeper in February looking
// at a company they have never visited — and it is read to produce a number
// that goes on a tax return. A quote that renders wrong gets a phone call. A
// revenue figure that is wrong gets filed.
//
// So the assertions below are not "does it produce a CSV". They are the four
// ways this specific file can lie:
//
//   1. DOUBLE COUNTING. app/api/invoices/[id]/route.js does not update a sent
//      invoice — it writes a NEW row with the same invoiceNumber, the parent
//      id set, and version + 1. Any export that iterates Invoice rows counts
//      invoice 1042 twice, at two different totals. This is the single most
//      expensive bug available in this module and it is the first section.
//
//   2. FORMULA INJECTION. A client name beginning `=` executes in Excel. The
//      names in this file were typed by contractors and by homeowners filling
//      in a public self-quote form, which makes it an untrusted-input problem
//      and not a formatting nicety.
//
//   3. INVENTED FACTS. There is no invoice issue-date column, invoice tax is
//      one number with no code behind it, expenses carry no tax, and there is
//      no refund object. A file that quietly papers over any of those is
//      AGENTS.md failure class 5 with a tax authority downstream.
//
//   4. MIXED CURRENCY SUMMED. Invoice has no currency column at all — it is a
//      company-level field — so a single grand total is the easiest thing in
//      the world to emit and the hardest to notice is wrong.
//
// ══ The mutation pass ══════════════════════════════════════════════════════
//
// Assertions that pass against a broken module are decoration. The bottom of
// this file breaks the source on purpose — nine mutations, one per guarantee —
// and fails if any mutation still passes. It works on a COPY in a temp dir
// (never `git checkout`, per the standing rule) and the original is never
// touched.

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAccountingExport,
  invoiceFamilies,
  csvCell,
  toCsv,
  money,
  dayKey,
} from "@/lib/export/accountingExport";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const RANGE = { from: "2026-01-01", to: "2026-01-31", currency: "CAD" };

/** Parse one CSV file back out of the result, as rows of raw cells. */
function file(result, kind) {
  return result.files.find((f) => f.kind === kind);
}
function lines(result, kind) {
  return file(result, kind)
    .csv.split("\r\n")
    .filter((l) => l.length);
}
const codes = (result) => result.warnings.map((w) => w.code);

const client = (name) => ({ name });
const inv = (over) => ({
  id: "i1",
  invoiceNumber: "1042",
  parentInvoiceId: null,
  version: 1,
  status: "sent",
  client: client("Tremblay"),
  createdAt: "2026-01-10T12:00:00Z",
  sentAt: "2026-01-10T12:00:00Z",
  dueDate: "2026-02-09T00:00:00Z",
  subtotal: 2000,
  discount: 0,
  tax: 260,
  taxEnabled: true,
  total: 2260,
  amountPaid: 0,
  amountDue: 2260,
  ...over,
});

// ═══ 1. The amendment, which is where the money goes wrong ══════════════════

console.log("\nAn amended invoice is ONE document, not two");
// Exactly what PATCH /api/invoices/[id] writes: same number, same root, v2.
const v1 = inv({ id: "i1", total: 2260, subtotal: 2000, tax: 260 });
const v2 = inv({
  id: "i2",
  parentInvoiceId: "i1",
  version: 2,
  total: 3390,
  subtotal: 3000,
  tax: 390,
  createdAt: "2026-01-20T12:00:00Z",
  sentAt: "2026-01-20T12:00:00Z",
});
const amended = buildAccountingExport({ ...RANGE, invoices: [v1, v2] });
ok("two rows collapse to one invoice line", file(amended, "invoices").rowCount === 1,
  file(amended, "invoices").rowCount);
ok("...at the LATEST version's total, not the sum",
  amended.totals.CAD.invoiced === 3390, amended.totals.CAD.invoiced);
ok("...and not at the superseded one either",
  amended.totals.CAD.invoiced !== 2260 && amended.totals.CAD.invoiced !== 5650);
ok("...tax follows the same row", amended.totals.CAD.tax === 390, amended.totals.CAD.tax);
// The document was issued on the 10th. Somebody correcting a line item on the
// 20th does not move the invoice into a different reporting period.
ok("the date is the ORIGINAL's, not the amendment's",
  lines(amended, "invoices")[1].includes("2026-01-10"), lines(amended, "invoices")[1]);
ok("...and the reader can see it was amended",
  lines(amended, "invoices")[1].includes("2 of 2"));
// Order must not matter: findMany's orderBy is the caller's business.
const reversed = buildAccountingExport({ ...RANGE, invoices: [v2, v1] });
ok("the answer does not depend on row order",
  reversed.totals.CAD.invoiced === 3390 && file(reversed, "invoices").rowCount === 1);
// Three versions, because "handles two" and "handles n" are different claims.
const v3 = inv({ id: "i3", parentInvoiceId: "i1", version: 3, total: 100, subtotal: 100, tax: 0 });
const thrice = buildAccountingExport({ ...RANGE, invoices: [v1, v2, v3] });
ok("three versions are still one line", file(thrice, "invoices").rowCount === 1);
ok("...at v3's money", thrice.totals.CAD.invoiced === 100, thrice.totals.CAD.invoiced);

console.log("\nA payment taken before the amendment is still money received");
// The payment hangs off the SUPERSEDED row — that is where it was recorded.
// Rolling up to the family is what stops it disappearing.
const beforeAmend = buildAccountingExport({
  ...RANGE,
  invoices: [v1, v2],
  payments: [{ id: "p1", invoiceId: "i1", amount: 1000, method: "cheque", date: "2026-01-12T00:00:00Z" }],
});
ok("it lands in 'Received in range' on the surviving line",
  lines(beforeAmend, "invoices")[1].split(",").includes("1000.00"),
  lines(beforeAmend, "invoices")[1]);
ok("...and appears once in the payments file",
  file(beforeAmend, "payments").rowCount === 1);
ok("...and is counted once in the totals",
  beforeAmend.totals.CAD.paid === 1000, beforeAmend.totals.CAD.paid);

console.log("\nA v2 whose original fell outside the range is FLAGGED, not guessed");
const orphanV2 = buildAccountingExport({ ...RANGE, invoices: [v2] });
ok("it still exports", file(orphanV2, "invoices").rowCount === 1);
ok("...and says the date is not the original's",
  codes(orphanV2).includes("missing_root_version"), codes(orphanV2).join());

// ═══ 2. Formula injection ═══════════════════════════════════════════════════

console.log("\nA client called =cmd does not run when the bookkeeper opens the file");
const HOSTILE = `=cmd|' /C calc'!A0`;
const injected = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ client: client(HOSTILE) })],
  expenses: [{ id: "e1", category: "+SUM(A1:A9)", amount: 50, date: "2026-01-05T00:00:00Z" }],
  payments: [{ id: "p1", invoiceId: "i1", amount: 10, method: "cash", date: "2026-01-06T00:00:00Z", notes: "@SUM(1)" }],
});
const invLine = lines(injected, "invoices")[1];
ok("the name is neutralised with a leading tab", invLine.includes(`"\t${HOSTILE}"`), invLine);
ok("...inside the quotes, not outside them", !invLine.includes(`\t"${HOSTILE}`));
ok("a + category is neutralised too",
  lines(injected, "expenses")[1].includes('\t+SUM(A1:A9)'));
ok("an @ note is neutralised too",
  lines(injected, "payments")[1].includes("\t@SUM(1)"));
// The four Excel formula leaders, plus the two whitespace characters that
// smuggle one past a check that only looks at the first visible character.
for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
  ok(`a cell starting ${JSON.stringify(lead)} is guarded`,
    csvCell(`${lead}danger`).replace(/^"|"$/g, "").startsWith("\t"),
    JSON.stringify(csvCell(`${lead}danger`)));
}
ok("an ordinary name is left alone", csvCell("Tremblay") === "Tremblay");
ok("a quote inside a name is doubled, not dropped",
  csvCell('Bob "Big" Smith') === '"Bob ""Big"" Smith"', csvCell('Bob "Big" Smith'));
ok("a comma forces quoting", csvCell("Smith, Bob") === '"Smith, Bob"');
ok("a newline in a note cannot break the row", csvCell("a\nb") === '"a\nb"');

console.log("\n...but a negative NUMBER must stay a number");
// The payroll route runs money through the same string guard, so a negative
// figure there comes out as "\t-5.00" and imports as text. Money here goes
// through money(), which is exempt, because we generated it.
ok("money(-5) is -5.00, untabbed", csvCell(money(-5)) === "-5.00", csvCell(money(-5)));
ok("...and a raw string '-5.00' would still be guarded",
  csvCell("-5.00") === '"\t-5.00"', JSON.stringify(csvCell("-5.00")));
const negativeInvoice = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ total: -500, subtotal: -500, tax: 0, amountDue: -500 })],
});
ok("a negative total exports as a number a spreadsheet can add",
  lines(negativeInvoice, "invoices")[1].includes(",-500.00,"),
  lines(negativeInvoice, "invoices")[1]);
ok("...and is flagged, because FieldQuo has no credit note",
  codes(negativeInvoice).includes("negative_total"));

// ═══ 3. Facts it refuses to invent ══════════════════════════════════════════

console.log("\nZero is not the same as nothing");
// Invoice.taxEnabled exists precisely because `tax: 0` cannot say WHY. An
// export that prints 0.00 for both throws that distinction away again.
const noTax = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ tax: 0, taxEnabled: false, total: 2000 })],
});
const withTaxZero = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ tax: 0, taxEnabled: true, total: 2000 })],
});
ok("a deliberately untaxed invoice says no", lines(noTax, "invoices")[1].endsWith(",no,2000.00,0.00,0.00,2000.00")
  || lines(noTax, "invoices")[1].includes(",no,"), lines(noTax, "invoices")[1]);
ok("...and one that claims tax and charged none says yes",
  lines(withTaxZero, "invoices")[1].includes(",yes,"));
ok("...so the two rows are NOT identical",
  lines(noTax, "invoices")[1] !== lines(withTaxZero, "invoices")[1]);

console.log("\nA $0 invoice owes nothing and has never been paid");
const zero = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ subtotal: 0, tax: 0, total: 0, amountPaid: 0, amountDue: 0 })],
});
ok("it exports rather than being skipped as falsy", file(zero, "invoices").rowCount === 1);
ok("...at 0.00 across the money columns", lines(zero, "invoices")[1].includes("0.00"));
ok("...and adds nothing to revenue", zero.totals.CAD.invoiced === 0, zero.totals.CAD.invoiced);

console.log("\nThe issue date is named, because there is no issue-date column");
const emailed = buildAccountingExport({ ...RANGE, invoices: [inv({})] });
ok("an emailed invoice is dated from sentAt",
  lines(emailed, "invoices")[1].includes("sentAt (emailed)"), lines(emailed, "invoices")[1]);
const neverSent = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ sentAt: null, status: "draft" })],
});
ok("...and one never emailed is dated from createdAt, and says so",
  lines(neverSent, "invoices")[1].includes("createdAt (raised)"));
const dateless = buildAccountingExport({
  ...RANGE,
  invoices: [inv({ sentAt: null, createdAt: null })],
});
ok("an invoice with neither is warned about, not given today's date",
  codes(dateless).includes("no_issue_date"), codes(dateless).join());
ok("...and is not silently counted into the range",
  file(dateless, "invoices").rowCount === 0);

console.log("\nThe things this file cannot show are printed inside it");
const summary = file(emailed, "summary").csv;
ok("it states it is not a filing", /not a filing/i.test(summary));
ok("it states there are no tax codes", /tax codes/i.test(summary));
ok("it states expenses carry no tax", /Input tax credits/i.test(summary));
ok("it states there are no refunds or credit notes", /no refunds and no credit notes/i.test(summary));
ok("it states the timezone rule", /UTC calendar day/i.test(summary));
// A blank Tax column on the expenses file would read as "we charge no tax",
// which is a statement nobody made.
ok("the expenses file has no Tax column at all",
  !lines(emailed, "expenses")[0].split(",").includes("Tax"),
  lines(emailed, "expenses")[0]);
ok("...and no Vendor column either, for the same reason",
  !/Vendor|Supplier/i.test(lines(emailed, "expenses")[0]));

console.log("\nA payment for an invoice outside the range keeps its identity");
const straddle = buildAccountingExport({
  ...RANGE,
  invoices: [],
  payments: [{ id: "p9", invoiceId: "i-from-december", amount: 500, method: "e_transfer", date: "2026-01-04T00:00:00Z" }],
});
ok("the payment is exported — it is January's cash", file(straddle, "payments").rowCount === 1);
ok("...identified by the invoice id, since no number was supplied",
  lines(straddle, "payments")[1].includes("i-from-december"));
ok("...and flagged so the reader knows why", codes(straddle).includes("orphan_payment"));
ok("...and it still counts toward payments received",
  straddle.totals.CAD.paid === 500, straddle.totals.CAD.paid);

console.log("\nA negative payment cannot come from the app, so it is not netted away");
const refundish = buildAccountingExport({
  ...RANGE,
  invoices: [inv({})],
  payments: [
    { id: "p1", invoiceId: "i1", amount: 1000, method: "cash", date: "2026-01-11T00:00:00Z" },
    { id: "p2", invoiceId: "i1", amount: -1000, method: "cash", date: "2026-01-12T00:00:00Z" },
  ],
});
ok("both rows are in the file", file(refundish, "payments").rowCount === 2);
ok("...and the anomaly is named", codes(refundish).includes("negative_payment"));
ok("...and the summary carries the note to the reader",
  /did not come from the app/.test(file(refundish, "summary").csv));

// ═══ 4. Currency ════════════════════════════════════════════════════════════

console.log("\nCurrency is never assumed and never summed across");
let threw = null;
try {
  buildAccountingExport({ from: "2026-01-01", to: "2026-01-31", invoices: [inv({})] });
} catch (e) {
  threw = e.message;
}
ok("omitting the currency throws rather than defaulting to CAD",
  /never assumed/i.test(threw || ""), threw);
const mixed = buildAccountingExport({
  ...RANGE,
  invoices: [inv({}), inv({ id: "x1", invoiceNumber: "1043", currency: "USD", total: 100, subtotal: 100, tax: 0, amountDue: 100 })],
});
ok("a foreign row gets its own bucket", Object.keys(mixed.totals).sort().join() === "CAD,USD",
  Object.keys(mixed.totals).join());
ok("...CAD holds only the CAD invoice", mixed.totals.CAD.invoiced === 2260, mixed.totals.CAD.invoiced);
ok("...USD holds only the USD one", mixed.totals.USD.invoiced === 100, mixed.totals.USD.invoiced);
ok("...there is no combined 2360 anywhere",
  !file(mixed, "summary").csv.includes("2360"));
ok("...and the summary says so in words",
  /deliberately not combined/.test(file(mixed, "summary").csv));
ok("...and the mismatch is a warning, not a silent conversion",
  codes(mixed).includes("currency_mismatch"));

// ═══ 5. Ranges ══════════════════════════════════════════════════════════════

console.log("\nAn empty month is an empty file, not a missing one");
const empty = buildAccountingExport({ ...RANGE });
ok("all four files exist", empty.files.length === 4, empty.files.length);
for (const kind of ["invoices", "payments", "expenses"]) {
  ok(`the ${kind} file still has its header row`, lines(empty, kind).length === 1);
  ok(`...and reports zero rows`, file(empty, kind).rowCount === 0);
}
ok("the summary still states the range", file(empty, "summary").csv.includes("2026-01-01 to 2026-01-31"));
ok("no warnings are invented for a quiet month", empty.warnings.length === 0, empty.warnings.length);

console.log("\nThe range is inclusive at both ends and rejects nonsense");
const edges = buildAccountingExport({
  ...RANGE,
  expenses: [
    { id: "a", category: "Materials", amount: 1, date: "2025-12-31T23:59:59Z" },
    { id: "b", category: "Materials", amount: 2, date: "2026-01-01T00:00:00Z" },
    { id: "c", category: "Materials", amount: 4, date: "2026-01-31T23:59:59Z" },
    { id: "d", category: "Materials", amount: 8, date: "2026-02-01T00:00:00Z" },
  ],
});
ok("the first and last days are IN", edges.totals.CAD.expensed === 6, edges.totals.CAD.expensed);
ok("...and the days either side are OUT", file(edges, "expenses").rowCount === 2);
let backwards = null;
try {
  buildAccountingExport({ from: "2026-01-31", to: "2026-01-01", currency: "CAD" });
} catch (e) {
  backwards = e.message;
}
ok("a backwards range throws instead of returning an empty year",
  /runs backwards/.test(backwards || ""), backwards);
let bad = null;
try {
  buildAccountingExport({ from: "not a date", to: "2026-01-31", currency: "CAD" });
} catch (e) {
  bad = e.message;
}
ok("an unparseable date throws", /valid `from` and `to`/.test(bad || ""), bad);
ok("dayKey rejects garbage rather than returning Invalid Date",
  dayKey("banana") === null && dayKey(null) === null && dayKey(undefined) === null);

console.log("\nRubbish in does not crash the run");
const junk = buildAccountingExport({
  ...RANGE,
  invoices: [null, undefined, inv({})],
  payments: [null, { id: "p", invoiceId: null, amount: null, date: "2026-01-05T00:00:00Z" }],
  expenses: [null, { id: "e", amount: "not a number", date: "2026-01-05T00:00:00Z" }],
});
ok("null invoice rows are skipped, the real one survives",
  file(junk, "invoices").rowCount === 1, file(junk, "invoices").rowCount);
ok("a payment with no amount is 0.00, not NaN",
  !file(junk, "payments").csv.includes("NaN"), file(junk, "payments").csv);
ok("an unparseable expense amount is 0.00, not NaN",
  !file(junk, "expenses").csv.includes("NaN"));
ok("...and no total is NaN", Number.isFinite(junk.totals.CAD.expensed));
ok("money(undefined) is blank, not 'NaN'", csvCell(money(undefined)) === "");

console.log("\nThe file is shaped the way Excel expects");
ok("rows are CRLF-terminated", file(empty, "invoices").csv.endsWith("\r\n"));
ok("toCsv round-trips an empty row as a blank line", toCsv([["a"], [], ["b"]]).split("\r\n")[1] === "");
ok("the family grouper is exported and usable on its own",
  invoiceFamilies([v1, v2]).length === 1 && invoiceFamilies([v1, v2])[0].versionCount === 2);

// ═══ 6. Mutation pass ═══════════════════════════════════════════════════════
//
// Break the module nine ways and require this file to notice each one. A
// mutation that still passes means the assertion above it is decorative.

// The mutation runner re-invokes THIS file with --no-mutate. Without that
// flag it would mutate the module from inside a mutated run, forever.
const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\nMutation pass — every guarantee above must actually be load-bearing");

const SRC = fileURLToPath(new URL("../lib/export/accountingExport.js", import.meta.url));
const ORIGINAL = readFileSync(SRC, "utf8");
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const backupDir = mkdtempSync(join(tmpdir(), "acct-export-"));
const backup = join(backupDir, "accountingExport.js");
// cp, never git checkout: this tree has uncommitted work in it and `git
// restore` would hand back the last commit, not what is on disk.
writeFileSync(backup, ORIGINAL);

const MUTATIONS = [
  ["double-counts amendments", (s) => s.replace("const rootId = inv.parentInvoiceId || inv.id;", "const rootId = inv.id;")],
  ["dates an amendment from the amendment", (s) => s.replace("const dateSource = root || members[0];", "const dateSource = latest;")],
  ["drops the formula guard", (s) => s.replace("s = `\\t${s}`;\n      guarded = true;", "")],
  ["leaves a guarded cell unquoted", (s) => s.replace("if (guarded || /[\",\\n\\r]/.test(s))", "if (/[\",\\n\\r]/.test(s))")],
  ["tabs negative numbers into text", (s) => s.replace("return new Safe(Number.isFinite(n) ? n.toFixed(2) : \"\");", "return Number.isFinite(n) ? n.toFixed(2) : \"\";")],
  ["collapses taxEnabled into tax === 0", (s) => s.replace("latest?.taxEnabled === false ? \"no\" : \"yes\",", "Number(latest?.tax) > 0 ? \"yes\" : \"no\",")],
  ["defaults the currency to CAD", (s) => s.replace(/if \(!currency \|\| typeof currency !== "string"\) \{[\s\S]*?\n  \}/, "currency = currency || \"CAD\";")],
  ["sums mixed currencies into one bucket", (s) => s.replace("return own;\n    }", "return currency;\n    }")],
  ["makes the range exclusive of its last day", (s) => s.replace("return key !== null && key >= from && key <= to;", "return key !== null && key >= from && key < to;")],
  ["accepts a backwards range", (s) => s.replace(/if \(fromKey > toKey\) \{[\s\S]*?\n  \}/, "")],
];

let mutantsCaught = 0;
const escaped = [];
try {
  for (const [label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(SRC, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      mutantsCaught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  // Restore from the copy, unconditionally, even if a mutation threw.
  writeFileSync(SRC, readFileSync(backup, "utf8"));
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += mutantsCaught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
